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
}
async function connection() {
  await ConnectToDatabase(
    "postgres",
    "localhost",
    5432,
    "postgres",
    "postgres",
    "some-graph"
  );
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

const findByNodeLabel = async (graphName: string, node: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (n:${node.label})
      RETURN n
    $$) as (v agtype);
  `);
};

const findByNodeProperty = async (graphName: string, node: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (n:${node.label} {${node.properties}})
      RETURN n
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
      SET n.${currentNode.name} = ${currentNode.value}
      return n
    $$) as (v agtype);
  `);
};

const deleteNode = async (graphName: string, node: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (n:${node.label} {${node.properties}})
      DETACH DELETE n
    $$) as (v agtype);
  `);
};

const updateEdgeProperty = async (
  graphName: string,
  prevEdge: any,
  currentEdge: any
) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH ()-[e:${prevEdge.label} {${prevEdge.properties}}]-()
      SET e.${currentEdge.name} = ${currentEdge.value}
      return e
    $$) as (v agtype);
  `);
};

const deleteParticularRelationEdge = async (graphName: string, edge: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH ()-[e:${edge.label} {${edge.properties}}]-()  
      DELETE e
    $$) as (v agtype);
  `);
};

const deleteAllEdge = async (graphName: string) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH ()-[e]-()
      DELETE e
    $$) as (v agtype);
  `);
};

const findById = async (graphName: string, node: any) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${graphName}', $$
      MATCH (n)
             where id=${node.id}
      RETURN n
    $$) as (v agtype);
  `);
};

(async () => {
  await connection();

  const create_graph = await createGraph("demo-graph");
  console.log(create_graph);

  const drop_graph = await dropGraph("demo-graph");
  console.log(drop_graph);

  const deleteAllNodesInGraph = await deleteAllNodes("data-graph");
  console.log(deleteAllNodesInGraph);

  const create_node = await createNode("data-graph", {
    label: "User",
    properties: "userId: 'krishna', qualified: false",
  });
  console.log(create_node);

  const create_node_relationship = await matchNodeAndCreateRelationship(
    "data-graph",
    { label: "REFERRAL", properties: "referralCode: '1234'" },
    { label: "User", properties: "userId: 'Mohan',age:25, qualified: false" },
    { label: "User", properties: "userId: 'Rohan',age:24, qualified: false" }
  );
  console.log(create_node_relationship);

  const create_nodes_and_relationship = await createNodesAndRelationship(
    "data-graph",
    { label: "REFERRAL", properties: "referralCode: '1236'" },
    { label: "User", properties: "userId: 'Mohan', age:25,qualified: false" },
    { label: "User", properties: "userId: 'Rohan',age:24, qualified: false" }
  );
  console.log(create_nodes_and_relationship);

  const delete_node = await deleteNode("data-graph", {
    label: "User",
    properties: "userId: 'Rohan',age:24, qualified: false",
  });
  console.log(delete_node);

  const update_node_property = await UpdateNodeProperty(
    "data-graph",
    { label: "User", properties: "userId: 'Mohan',age:28, qualified: false" },
    { name: "userId", value: "'Sohan'" }
  );
  console.log(update_node_property);

  const update_edge_property = await updateEdgeProperty(
    "data-graph",
    { label: "REFERRAL", properties: "referralCode: '1234'" },
    { name: "referralCode", value: "'11122233'" }
  );
  console.log(update_edge_property);

  const delete_particular_edge = await deleteParticularRelationEdge(
    "data-graph",
    {
      label: "REFERRAL",
      properties: "referralCode: '1235'",
    }
  );
  console.log(delete_particular_edge);

  const delete_all_edge = await deleteAllEdge("data-graph");
  console.log(delete_all_edge);

  const find_by_node_property = await findByNodeProperty("data-graph", {
    label: "User",
    properties: "userId: 'Mohan'",
  });
  console.log(find_by_node_property);

  const find_by_label = await findByNodeLabel("data-graph", {
    label: "Person",
  });
  console.log(find_by_label);

  const find_by_id = await findById("data-graph", {
    id: 844424930131974,
  });
  console.log(find_by_id);

  await client.disconnect();
})();
