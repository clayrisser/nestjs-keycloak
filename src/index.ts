import { ApacheAgeClient } from "apache-age-client";

(async () => {
  const client = await ApacheAgeClient.connect({
    database: "postgres",
    host: "localhost",
    password: "postgres",
    port: 5432,
    user: "postgres",
    graph: "some-graph",
  });

  console.log(
    await client.executeCypher(`
    SELECT * FROM ag_catalog.create_graph('some-graph');
  `)
  );

  console.log(
    await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('some-graph', $$
      CREATE (n:Person {name: 'Alice', age: 22})
    $$) as (v agtype);
  `)
  );

  await client.disconnect();
})();
