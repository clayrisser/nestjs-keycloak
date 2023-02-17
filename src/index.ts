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
    CREATE (n:Person {name: 'Bob', age: 22, favorite_color: 'blue'})
  $$) as (v agtype);
`)
  );

  console.log(
    await client.executeCypher(`
  SELECT * FROM ag_catalog.cypher('some-graph', $$
    CREATE (n:Dog {name: 'Fido', age: 12, favorite_color: 'green'})
  $$) as (v agtype);
`)
  );

  console.log(
    await client.executeCypher(`
  SELECT * FROM ag_catalog.cypher('some-graph', $$
    CREATE (n:User {userId: 'mani', qualified: pass ,color:'red'})
  $$) as (v agtype);
`)
  );

  const referringUserId = "Bob";
  const referredUserId = "Fido";
  const referralId = "mani";

  console.log(
    await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('some-graph', $$
      MATCH (a:User {userId: '${referredUserId}', qualified: false}), (b:User {userId: '${referringUserId}', qualified: false}',(c:User {userId: '${referralId}', qualified: false})}'))})
      CREATE (a)-[e:REFERRAL]->(b)-[f:LOVER]->(C)
      RETURN a, e, b,f,c
    $$) as (a agtype, e agtype, b agtype f agtype c agtype);
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
