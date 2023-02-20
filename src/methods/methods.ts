import { ApacheAgeClient } from "apache-age-client";

export interface NodeProps {
  userId?: string | number;
  name?: string;
  qualified?: boolean;
  referrerId?: string | number;
  graph?: string;
  property?: string;
  value?: any;
}

export interface dbProps {
  database?: string;
  host?: string;
  password?: string;
  port?: number;
  user?: string;
  graph?: string;
}

let client: any;
export const dbConnection = async (data: dbProps) => {
  client = await ApacheAgeClient.connect({
    database: data.database || "postgres",
    host: data.host || "localhost",
    password: data.password || "postgres",
    port: data.port || 5432,
    user: data.user || "postgres",
    graph: data.graph || "some-graph",
  });
  console.log("connected to db", client.database);
};

export const createGraph = async (graph: string) => {
  return await client.executeCypher(
    `SELECT * FROM ag_catalog.create_graph('${graph}');`
  );
  console.log("The graph created", graph);
};

export const dropGraph = async (graph: string) => {
  await client.executeCypher(
    `SELECT * FROM ag_catalog.drop_graph('${graph}', true);`
  );
  console.log("graph dropped", graph);
};

export const createNode = async (data: NodeProps) => {
  await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MERGE (a:User {UserId:'${data.userId}'})
      SET a.name = '${data.name}', a.qualified = ${data.qualified}
      RETURN a
    $$) as (a agtype);
  `);
  console.log(
    `The User '${data.name}' along with the id '${data.userId}' is created successfully`
  );
};

export const createReferrerNode = async (data: NodeProps) => {
  try {
    return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User)
      WHERE a.UserId = '${data.referrerId}'
      MERGE (b:User {UserId:'${data.userId}'})
      SET b.name = '${data.name}', b.qualified = ${data.qualified}      
      CREATE (a)-[e:REFERRER]->(b)
      return a, e, b 
      $$) as (a agtype, e agtype, b agtype)
  `);
    console.log(
      `The New User '${data.name}' along with id '${data.userId}' is Referred by '${data.referrerId}'`
    );
  } catch (e) {
    console.log("already user exists", e);
  }
};

export const updateQualifiedNode = async (data: NodeProps) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User)
      WHERE a.UserId = '${data.userId}'
      SET a.qualified = ${data.qualified}
      RETURN a
    $$) as (a agtype);
  `);
  console.log(
    data.qualified
      ? `The User '${data.name}' along with id '${data.userId}' is Qualified`
      : `The User '${data.name}' along with id '${data.userId}' is Unqualified`
  );
};

export const getData = async (data: NodeProps) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('dr-graph', $$
      MATCH (a:User)
      WHERE a.userId = 'a'
      RETURN a
    $$) as (a agtype);
  `);
  console.log("Successfully listed the qualified users");
};

export const deleteNode = async (data: NodeProps) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User)
      WHERE a.UserId = '${data.userId}'
      DETACH DELETE a
      RETURN a
    $$) as (a agtype);
  `);
  console.log(
    `The User '${data.name}' along with the id '${data.userId}' is deleted`
  );
};
export const deleteAllNodes = async (data: NodeProps) => {
  return await client.executeCypher(
    `SELECT * FROM ag_catalog.cypher('${data.graph}', $$ MATCH (a:User) DETACH DELETE a RETURN a $$) as (a agtype);`
  );
};
