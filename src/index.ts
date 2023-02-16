import { ApacheAgeClient } from "apache-age-client";

let client: any;
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
  console.log("Connected to database", client);
}

const createGraph = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.create_graph('${graphName}');
  `);
};

const createNode = async (graphName: string, node: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      CREATE (n:${node.label} {${node.properties}})
    $$) as (v agtype);
  `);
};

const createRelationship = async (
  graphName: string,
  relationship: any,
  fromNode: any,
  toNode: any
) => {
  return await client.executeCypher(`
 SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (a:${fromNode.label} {${fromNode.properties}}), (b:${toNode.label} {${toNode.properties}})
      CREATE (a)-[e:${relationship.label}]->(b)
      RETURN a, e, b
    $$) as (a agtype, e agtype, b agtype);
  `);
};

(async () => {
  ConnectToDatabase(
    "postgres",
    "localhost",
    5432,
    "postgres",
    "postgres",
    "some-graph"
  );
})();

// (async () => {
// console.log(
//   await client.executeCypher(`
//   SELECT * FROM ag_catalog.create_graph('some-graph');
// `)
// );

// console.log(
//   await client.executeCypher(`
//   SELECT * FROM ag_catalog.cypher('some-graph', $$
//     CREATE (n:Person {name: 'Bob', age: 22, favorite_color: 'blue'})
//   $$) as (v agtype);
// `)
// );

// console.log(
//   await client.executeCypher(`
//   SELECT * FROM ag_catalog.cypher('some-graph', $$
//     CREATE (n:Dog {name: 'Fido', age: 12, favorite_color: 'green'})
//   $$) as (v agtype);
// `)
// );

//   const referringUserId = "Bob";
//   const referredUserId = "Fido";

//   console.log(
//     await client.executeCypher(`
//     SELECT * FROM ag_catalog.cypher('some-graph', $$
//       MATCH (a:User {userId: '${referredUserId}', qualified: false}), (b:User {userId: '${referringUserId}', qualified: false}'})
//       CREATE (a)-[e:REFERRAL]->(b)
//       RETURN a, e, b
//     $$) as (a agtype, e agtype, b agtype);
//   `)
//   );

//   const userId = "Bob";
//   const qualified = true;

//   console.log(
//     await client.executeCypher(`
//     SELECT * FROM ag_catalog.cypher('some-graph', $$
//       MATCH (a:User {userId: '${userId}'})
//       UPDATE a SET a.qualified = ${qualified}
//       RETURN a
//     $$) as (a agtype);
//   `)
//   );

//   await client.disconnect();
// })();
