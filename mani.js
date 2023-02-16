const { ApacheAgeClient } = require("apache-age-client");

(async () => {
  const client = await ApacheAgeClient.connect({
    database: "postgres",
    host: "localhost",
    password: "postgres",
    port: 5432,
    user: "postgres",
    graph: "some-graph",
  });
  const result = await client.executeCypher(
    `select * from ag_catalog.create_graph('some-graph')`
  );
  console.log(client, "client");
  console.log(result, "result");
})();
