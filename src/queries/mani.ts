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
  const client = await ApacheAgeClient.connect({
    database: databaseName,
    host: databaseHost,
    password: databasePassword,
    port: databasePort,
    user: databaseUser,
    graph: graphName,
  });
  // console.log("Connected to database", client);
  return client;
}
async function connection() {
  const client = await ConnectToDatabase(
    "postgres",
    "localhost",
    5432,
    "postgres",
    "postgres",
    "some-graph"
  );
  return client;
}

const createGraph = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.create_graph('${graphName}');
  `);
};

const dropGraph = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.drop_graph('${graphName}');
  `);
};

const deleteAllNodes = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (n)
      DETACH DELETE n
    $$) as (v agtype);
  `);
};

const createNode = async (graphName: string, node: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      CREATE (n:${node.label} {${node.properties}})
    $$) as (v agtype);
  `);
};

const matchNodeAndCreateRelationship = async (
  graphName: string,
  relationship: any,
  fromNode: any,
  toNode: any
) => {
  return await client.executeCypher(`
 SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (a:${fromNode.label} {${fromNode.properties}}), (b:${toNode.label} {${toNode.properties}})
      CREATE (a)-[e:${relationship.label} {${relationship.properties}}]->(b)
      RETURN a, e, b
    $$) as (a agtype, e agtype, b agtype);
  `);
};

const createNodesAndRelationship = async (
  graphName: string,
  relationship: any,
  fromNode: any,
  toNode: any
) => {
  return await client.executeCypher(`
  SELECT * FROM ag_catalog.cypher('${graphName}', $$
  CREATE (a:${fromNode.label} {${fromNode.properties}})-[e:${relationship.label} {${relationship.properties}}]->(b:${toNode.label} {${toNode.properties}})
  RETURN a, e, b
  $$) as (a agtype, e agtype, b agtype);
  `);
};

const UpdateNodeProperty = async (
  graphName: string,
  prevNode: any,
  currentNode: any
) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (n:${prevNode.label} {${prevNode.properties}})
     SET n.${currentNode.properties.name} = ${currentNode.properties.value}
      return n
    $$) as (v agtype);
  `);
};

(async () => {
  client = await connection();

  // const create_graph = await createGraph("data-graph");
  // console.log(create_graph);

  const create_node = await createNode("data-graph", {
    label: "Name",
    properties: 'name: "Ram Krishna", qualified: false',
  });
  console.log(create_node);

  const create_nodes = await createNode("data-graph", {
    label: "Name",
    properties: 'name:"Sara Singh", qualified: false',
  });

  console.log(create_nodes);

  const showNode = await createNode("data-graph", {
    label: "Name",
    properties: 'name:"Bala", qualified: false',
  });

  console.log(showNode);

  const create_node_relationship = await matchNodeAndCreateRelationship(
    "data-graph",
    { label: "LOVERS", properties: 'referralCode: "12345566"' },
    { label: "Name", properties: 'Person: "Ram Krishna", qualified: false' },
    { label: "Name", properties: 'Person: "Sara Singh", qualified: false' }
  );
  const create_node_relationship1 = await matchNodeAndCreateRelationship(
    "data-graph",
    { label: "ENEMIES", properties: 'referralCode: "12345566"' },
    { label: "Name", properties: 'Person: "Ram Krishna", qualified: false' },
    { label: "Name", properties: 'Person: "Bala", qualified: false' }
  );
  console.log(create_node_relationship);

  const create_node_relationship2 = await matchNodeAndCreateRelationship(
    "data-graph",
    { label: "FRIENDS", properties: 'referralCode: "1234556677"' },
    { label: "Name", properties: 'Person: "Ram Krishna", qualified: false' },
    { label: "Name", properties: 'Person: "Bala", qualified: false' }
  );
  console.log(create_node_relationship2);

  const create_nodes_and_relationship = await createNodesAndRelationship(
    "data-graph",
    { label: "REFERRAL", properties: "referralCode: '1236'" },
    { label: "Name", properties: "Person: 'HariKrishna', qualified: false" },
    { label: "Name", properties: "Person: 'PhaniBhushan', qualified: false" }
  );
  console.log(create_nodes_and_relationship);
})();
