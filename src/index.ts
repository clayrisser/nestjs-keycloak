import { ApacheAgeClient } from "apache-age-client";

let client: any;
async function ConnectToDatabase(
  databaseName: string,
  databaseHost: string,
  databasePort: number,
  databaseUser: string,
  databasePassword: string
) {
  client = await ApacheAgeClient.connect({
    database: databaseName,
    host: databaseHost,
    password: databasePassword,
    port: 5432,
    user: "postgres",
    graph: databaseName,
  });
}

const createGraph = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.create_graph('${graphName}');
  `);
};

(async () => {
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

  console.log(
    await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('some-graph', $$
      CREATE (n:Dog {name: 'Fido', age: 12, favorite_color: 'green'})
    $$) as (v agtype);
  `)
  );

  const referringUserId = "Bob";
  const referredUserId = "Fido";

  console.log(
    await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('some-graph', $$
      MATCH (a:User {userId: '${referredUserId}', qualified: false}), (b:User {userId: '${referringUserId}', qualified: false}'})
      CREATE (a)-[e:REFERRAL]->(b)
      RETURN a, e, b
    $$) as (a agtype, e agtype, b agtype);
  `)
  );

  const userId = "Bob";
  const qualified = true;

  console.log(
    await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('some-graph', $$
      MATCH (a:User {userId: '${userId}'})
      UPDATE a SET a.qualified = ${qualified}
      RETURN a
    $$) as (a agtype);
  `)
  );

  await client.disconnect();
})();
