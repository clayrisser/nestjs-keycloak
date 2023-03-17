import { ApacheAgeClient } from "apache-age-client";
import { generation } from "./generation";

let client: ApacheAgeClient;

export async function ConnectToDatabase(
  databaseName: string,
  databaseHost: string,
  databasePort: number,
  databaseUser: string,
  databasePassword: string,
  graphName: string
) {
  client = await ApacheAgeClient.connect({
    database: databaseName,
    host: databaseHost,
    password: databasePassword,
    port: databasePort,
    user: databaseUser,
    graph: graphName,
  });
}

export function generateRandomString(length: number) {
  let referralCode = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    referralCode += characters.charAt(
      Math.floor(Math.random() * charactersLength)
    );
  }
  return referralCode;
}

export const createGraph = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.create_graph('${graphName}');
  `);
};

export const dropGraph = async (graphName: string) => {
  const result = await client.executeCypher(` 
      SELECT COUNT(*) as count FROM ag_catalog.ag_graph WHERE name = '${graphName}';
  `);

  const count = result.rows[0].count;

  if (count === "1") {
    return await client.executeCypher(`
    SELECT * FROM ag_catalog.drop_graph('${graphName}',true);
    `);
  }
};

export async function registerUser(graphName: string, node: any) {
  console.log(node.properties);
  return await client.executeCypher(`
          SELECT * FROM ag_catalog.cypher('${graphName}', $$
        CREATE (n:${node.label} {${node.properties}})
        return n
      $$) as (v agtype);
      `);
}

export const findById = async (id: number, graphName: string) => {
  return await client.executeCypher(`
        SELECT * FROM cypher('${graphName}', $$
          MATCH (n)
          WHERE n.id=${id}
          RETURN n
        $$) as (name agtype);
      `);
};

export const createNodeAndEdge = async (
  graphName: any,
  referralCode: string,
  edge: any,
  toNode: any,
  tier: number
) => {
  return await client.executeCypher(`
        SELECT * FROM ag_catalog.cypher('${graphName}', $$
        MATCH (n)
        where n.referralCode='${referralCode}'
        create (n)-[e:${edge.edgeName}]->(b:${toNode.label} {${toNode.properties},tier:${tier}})
        RETURN n,e,b
        $$) as (fromVertex agtype,Edge varchar,toVertex agtype);
        `);
};

export const findByReferralCode = async (
  graphName: string,
  referralCode: string
) => {
  return await client.executeCypher(`
        SELECT * FROM cypher('${graphName}', $$
          MATCH (n)
          WHERE n.referralCode='${referralCode}'
          RETURN n
        $$) as (name agtype);
      `);
};

const findEdgeByLabel = async (graphName: string, label: string) => {
  return await client.executeCypher(`
  SELECT * FROM cypher('${graphName}', $$
    MATCH (n)-[e:${label}]->(m)
    RETURN e
  $$) as (name agtype);
`);
};

export const findEdgeByProperty = async (graphName: string, node: any) => {
  console.log("from", node.from, "-[]->", node.to);
  return await client.executeCypher(`
        SELECT * FROM cypher('${graphName}', $$
          MATCH (m)
          where m.${node.propertyName}=${node.from}
          match (n)
          where n.${node.propertyName}=${node.to}
          match(m)-[e:${node.label}]->(n)
          return e         
        $$) as (edge agtype);
      `);
};

export const createCustomEdge = async (graphName: string, nodes: any) => {
  // const verifyEdge = await findEdgeByProperty(graphName, nodes);
  // if (verifyEdge.rowCount === 0) {
  return await client.executeCypher(`
        SELECT * FROM cypher('${graphName}', $$
            match(m)
            where m.${nodes.propertyName}=${nodes.from}
            match(n)
            where n.${nodes.propertyName}=${nodes.to}
            create (m)-[r:${nodes.label}]->(n)
            return m,r,n
        $$) as (fromNode agtype, relation agtype ,toNode agtype);
      `);
  // } else {
  //   return;
  // }
};

const registerUserWithRelationship = async (
  graphName: string,
  fromNode: any,
  edge: any,
  toNode: any
) => {
  const id = await findById(toNode.id, graphName);

  if (id.rowCount === 0) {
    const referralCode = await findByReferralCode(
      graphName,
      fromNode.referralCode
    );
    console.log("referalCode", referralCode);

    const suffix = "::vertex";
    const trimmedRows = referralCode.rows.map((row) => ({
      ...row,
      name: row.name.endsWith(suffix)
        ? row.name.slice(0, -suffix.length)
        : row.name,
    }));
    // const tier =
    //   JSON.parse(referralCode.rows[0].name.slice(0, -8)).properties.tier + 1;
    const tier = JSON.parse(trimmedRows[0].name).properties.tier + 1;
    if (referralCode.rowCount !== 0) {
      const newVertex = await createNodeAndEdge(
        graphName,
        fromNode.referralCode,
        edge,
        toNode,
        tier
      );
      // const verifyId = await edge.influencer.map(async (id: number) => {
      //   // console.log("verifying id", await findById(id, "data-graph"));
      //   // return await createInfluencerEdge(graphName, {
      //   //   propertyName: "id",
      //   //   from: id,
      //   //   to: toNode.id,
      //   //   label: "INFLUENCER",
      //   // });
      // });
      return newVertex;
      // console.log("verifyId", verifyId);
    } else {
      return "Invalid ReferralCode ";
    }
  } else return "user already exists";
};
export const generateReferralCode = async () => {
  while (true) {
    const randomCode = generateRandomString(7);
    const verifyRandomCode = await findByReferralCode("data-graph", randomCode);
    if (verifyRandomCode.rowCount === 0) {
      return randomCode;
    }
  }
};

export const generateId = async () => {
  while (true) {
    const random = Math.round(Math.random() * 10000);
    const verifyId = await findById(random, "data-graph");
    if (verifyId.rowCount === 0) {
      return random;
    }
  }
};

export const users = async () => {
  await ConnectToDatabase(
    "postgres",
    "localhost",
    5432,
    "postgres",
    "postgres",
    "some-graph"
  );

  // const findEdge = await findEdgeByLabel("data-graph", "INFLUENCER");
  // console.log("findEdge", findEdge);

  // const graph = await createGraph("data-graph");

  // console.log(
  //   await registerUser("data-graph", {
  //     label: "user",
  //     properties: " id: 2, referralCode: 'abcde' ,isQualified:false,tier:1",
  //   })
  // );

  const drop_graph = await dropGraph("data-graph");
  // const referralCode = await generateReferralCode();
  // const id = await generateId();

  // const findEdge = await findEdgeByProperty("data-graph", {
  //   propertyName: "id",
  //   from: 814,
  //   to: 231,
  //   label: "INFLUENCER",
  // });
  // console.log("edge is ", findEdge.rowCount);

  // const userWithRelationship = await registerUserWithRelationship(
  //   "data-graph",
  //   {
  //     label: "user",
  //     properties: " id: 4, referralCode: 'abcde' ,isQualified:true,tier:1",
  //     referralCode: "JZ4StVn",
  //   },
  //   {
  //     edgeName: "REFERRAL",
  //     influencer: [814, 352, 1939, 214],
  //   },
  //   {
  //     label: "user",
  //     properties: ` id: ${id}, isQualified: true,referralCode:'${referralCode}',tier:0`,
  //     id: id,
  //   }
  // );
  // console.log("userWithRelationship", userWithRelationship);

  let arr: string[] = [];
  let arr2: string[] = [];
  for (let i = 0; i < 4; i++) {
    if (i === 0) {
      const create_graph = await createGraph("data-graph");
      console.log("create_graph", create_graph);
      const user = await registerUser("data-graph", {
        label: "User",
        properties: `id: 2, referralCode: 'abcde' ,isQualified:false,tier:1`,
      });
      console.log("user", user);
      arr2.push("abcde");
    }
    for (let j = 0; j < arr2.length; j++) {
      for (let k = 0; k < 2; k++) {
        const referralCode = await generateReferralCode();
        const id = await generateId();
        // const random = Math.round(Math.random() * 1000);
        arr.push(referralCode);
        const userWithRelationship = await registerUserWithRelationship(
          "data-graph",
          {
            label: "User",
            properties: `id: ${arr2[j]}, isQualified: false`,
            referralCode: arr2[j],
          },
          {
            influencer: [1, 2, 3],
            edgeName: "REFERRAL",
          },
          {
            label: "User",
            properties: ` id: ${id}, isQualified: ${
              id % 2 === 0
            },referralCode:'${referralCode}',tier:0`,
            id: id,
          }
        );
        console.log("userWithRelationship", userWithRelationship);
      }
    }
    arr2 = arr;
    arr = [];
  }
  generation(client);
};
