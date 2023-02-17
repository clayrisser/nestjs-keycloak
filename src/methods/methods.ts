import { ApacheAgeClient } from "apache-age-client";

export interface NodeProps {
  userId: string | number;
  name: string;
  qualified: boolean;
  referrerId?: string | number;
  graph: string;
}

let client: any;
export const dbConnection = async () => {
  client = await ApacheAgeClient.connect({
    database: "postgres",
    host: "localhost",
    password: "postgres",
    port: 5432,
    user: "postgres",
    graph: "some-graph",
  });
};

export const createGraph = async (graph: string) => {
  await dbConnection();
  return await client.executeCypher(
    `SELECT * FROM ag_catalog.create_graph('${graph}');`
  );
};

export const dropGraph = async (graph: string) => {
  await dbConnection();
  await client.executeCypher(
    `SELECT * FROM ag_catalog.drop_graph('${graph}');`
  );
};

export const createNode = async (data: NodeProps) => {
  await dbConnection();
  await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      CREATE (a:User {UserId:'${data.userId}', name:'${data.name}', qualified:'${data.qualified}'})
    $$) as (a agtype);
  `);
};

export const createReferrerNode = async (data: NodeProps) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User)
      WHERE a.UserId = '${data.referrerId}'
      CREATE (b:User {UserId:'${data.userId}', name:'${data.name}', qualified:'${data.qualified}'})
      
      CREATE (a)-[e:REFERRER]->(b)
      return a, e, b 
      $$) as (a agtype, e agtype, b agtype)
  `);
};

export const updateQualifiedNode = async (data: NodeProps) => {
  return await client.executeCypher(`
    SELECT * FROM ag_catalog.cypher('${data.graph}', $$
      MATCH (a:User {userId:'${data.userId}'})
      SET a.qualified = '${data.qualified}'
    $$) as (a agtype);
  `);
};
