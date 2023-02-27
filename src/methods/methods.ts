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
  try {
    client = await ApacheAgeClient.connect({
      database: data.database || "postgres",
      host: data.host || "localhost",
      password: data.password || "postgres",
      port: data.port || 5432,
      user: data.user || "postgres",
      graph: data.graph || "some-graph",
    });
    console.log("connected to db", client.database);
  } catch (err) {
    console.log(err);
  }
};

export const createGraph = async (graph: string) => {
  try {
    return await client.executeCypher(
      `SELECT * FROM ag_catalog.create_graph('${graph}');`
    );
    console.log("The graph created", graph);
  } catch (err) {
    console.log("graph already exists");
  }
};

export const dropGraph = async (graph: string) => {
  try {
    await client.executeCypher(
      `SELECT * FROM ag_catalog.drop_graph('${graph}', true);`
    );
    console.log("graph dropped", graph);
  } catch (err) {
    console.log("graph does not exist");
  }
};

export const createNode = async (data: NodeProps) => {
  const existedUser = await client.executeCypher(
    `SELECT * FROM ag_catalog.cypher('${data.graph}', $$ MATCH (u:User {UserId: '${data.userId}'})$$) as (u agtype)`
  );
  existedUser.rows.length > 0
    ? console.log("user already exists")
    : await client.executeCypher(`
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
  const existedUser =
    await client.executeCypher(`SELECT * FROM ag_catalog.cypher('${data.graph}', $$ MATCH (u:User {UserId: '${data.userId}'})
    RETURN u $$) as (u agtype)`);

  if (existedUser.rows.length > 0) {
    console.log("user already exists");
  } else {
    return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User)
      WHERE a.UserId = '${data.referrerId}'
      MERGE (b:User {UserId:'${data.userId}'})
      SET b.name = '${data.name}', b.qualified = ${data.qualified}      
      MERGE (a)-[e:REFERRAL]->(b)
      return a, e, b 
      $$) as (a agtype, e agtype, b agtype)
  `);
    console.log(
      `The New User '${data.name}' along with id '${data.userId}' is Referred by '${data.referrerId}'`
    );
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
  try {
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
  } catch (err) {
    console.log(err);
  }
};
export const deleteAllNodes = async (data: NodeProps) => {
  try {
    return await client.executeCypher(
      `SELECT * FROM ag_catalog.cypher('${data.graph}', $$ MATCH (a:User) DETACH DELETE a RETURN a $$) as (a agtype);`
    );
    console.log("All the nodes are deleted");
  } catch (err) {
    console.log(err);
  }
};

export const deleteRelationship = async (data: NodeProps) => {
  try {
    return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User)-[e:REFERRAL]->(b:User)
      WHERE a.UserId = '${data.referrerId}' AND b.UserId = '${data.userId}'
      DELETE e
      RETURN a, e, b
    $$) as (a agtype, e agtype, b agtype);
  `);
    console.log(
      `The Relationship between '${data.referrerId}' and '${data.userId}' is deleted`
    );
  } catch (err) {
    console.log(err);
  }
};
