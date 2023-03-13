import { ApacheAgeClient } from "apache-age-client";

let client: ApacheAgeClient;
async function ConnectToDatabase(
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

const createGraph = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.create_graph('${graphName}');
  `);
};

const dropGraph = async (graphName: string) => {
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
async function registerUser(graphName: string, node: any) {
  return await client.executeCypher(`
          SELECT * FROM ag_catalog.cypher('${graphName}', $$
        CREATE (n:${node.label} {${node.properties}})
        return n
      $$) as (v agtype);
      `);
}

const registerUserWithRelationship = async (
  graphName: string,
  fromNode: any,
  relationship: any,
  toNode: any
) => {
  return await client.executeCypher(`
        SELECT * FROM ag_catalog.cypher('${graphName}', $$
        MATCH (n:${fromNode.label} {${fromNode.properties}})
        create (n)-[e:${relationship}]->(b:${toNode.label} {${toNode.properties}})
        RETURN n,e,b
        $$) as (v agtype,a varchar,b agtype);
        `);
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

  const drop_graph = await dropGraph("data-graph");

  let arr: number[] = [];
  let arr2: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (i === 0) {
      const create_graph = await createGraph("data-graph");
      console.log("create_graph", create_graph);
      const user = await registerUser("data-graph", {
        label: "User",
        properties: `id: ${i}, isQualified: false`,
      });
      console.log("user", user);
      arr2.push(i);
    }
    for (let j = 0; j < arr2.length; j++) {
      for (let k = 0; k < arr2.length * 2; k++) {
        const random = Math.round(Math.random() * 1000);
        arr.push(random);
        const userWithRelationship = await registerUserWithRelationship(
          "data-graph",
          {
            label: "User",
            properties: `id: ${arr2[j]}, isQualified: false`,
          },
          "REFERRED",
          {
            label: "User",
            properties: `id: ${random}, isQualified: false`,
          }
        );
        console.log("userWithRelationship", userWithRelationship);
      }
    }
    arr2 = arr;
    arr = [];
  }
};
