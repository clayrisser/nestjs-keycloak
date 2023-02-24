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
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.drop_graph('${graphName}',true);

  `);
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

  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      const create_graph = await createGraph("data-graph");
      console.log("create_graph", create_graph);
    }
    const user = await registerUser("data-graph", {
      label: "User",
      properties: `id: ${i}, isQualified: false`,
    });
    console.log("user", user);
  }

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      const userWithRelationship = await registerUserWithRelationship(
        "data-graph",
        {
          label: "User",
          properties: `id: ${i}, isQualified: false`,
        },
        "REFERRED",
        {
          label: "User",
          properties: `id: ${j}, isQualified: false`,
        }
      );
      console.log("userWithRelationship", userWithRelationship);
    }
  }
};
