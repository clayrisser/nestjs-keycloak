import { truncate } from "fs";
import { createGraph, users, createCustomEdge } from "./users";

const findMaxTier = async (client: any, graphName: string) => {
  const result = await client.executeCypher(`
      SELECT * FROM cypher('${graphName}', $$
       MATCH (n)
       RETURN max(n.tier)
       $$) as (max_tier agtype);
 `);

  return result.rows[0].max_tier;
};

const getPropertyByPropertyName = async (
  client: any,
  graphName: string,
  node: any
) => {
  const result = await client.executeCypher(`
      SELECT * FROM cypher('${graphName}', $$
       MATCH (n)
       WHERE n.${node.propertyName}= ${node.value} and n.id=${node.id}
       RETURN n.${node.returnPropertyName}
    $$) as (result agtype);
 `);
  return result.rows.map((row: any) => row.result);
};

const findTheUsersConnectedToTheNode = async (
  client: any,
  graphName: string,
  id: number
) => {
  const result = await client.executeCypher(`
      SELECT * FROM cypher('${graphName}', $$
        MATCH (n)
        where n.id=${id}
        MATCH (n)-[e:REFERRAL]->(b)
        return b.id
      $$) as (id agtype);
  `);

  console.log(result);
};

const findTheEdgesConnectedToTheNode = async (
  client: any,
  graphName: string,
  id: number,
  edgeName?: string
) => {
  const result = await client.executeCypher(`
      SELECT * FROM cypher('${graphName}', $$
        MATCH (n)
        where n.id=${id}
        MATCH (n)-[e:${edgeName ? edgeName : "REFERRAL"}]->(b)
        return b.id
      $$) as (id agtype);
  `);
  return result;
};

const findTheRootNodes = async (client: any, graphName: string) => {
  const maxTier = await findMaxTier(client, "data-graph");

  for (let i = 1; i <= maxTier; i++) {}
  const result = await client.executeCypher(`
      SELECT * FROM cypher('${graphName}', $$
        MATCH (n)
        WHERE n.tier = 1
        RETURN n.id
      $$) as (id agtype);
  `);
  return result.rows.map((row: any) => row.id);
};
let count = 0;
const goToEveryNode = async (
  client: any,
  graphName: string,
  id: number,
  generationData: any
) => {
  const result = await findTheEdgesConnectedToTheNode(
    client,
    graphName,
    id,
    "REFERRAL"
  );
  const users = result.rows.map((row: any) => row.id);
  if (users.length === 0) return;
  else {
    let lastQualifiedId = generationData.lastQualifiedId;
    let gap = generationData.gap;
    let nextQualifiedId = generationData.nextQualifiedId;

    for (let i = 0; i < users.length; i++) {
      const isQualified = await getPropertyByPropertyName(client, graphName, {
        propertyName: "isQualified",
        value: true,
        id: users[i],
        returnPropertyName: "id",
      });

      const qualifiedLength = isQualified.length;

      if (qualifiedLength === 0 && lastQualifiedId !== undefined) {
        gap = true;
      }
      if (qualifiedLength !== 0 && !gap) {
        lastQualifiedId = isQualified[0];
      }
      if (gap && qualifiedLength !== 0) {
        nextQualifiedId = isQualified[0];
      }

      if (
        nextQualifiedId !== undefined &&
        lastQualifiedId !== undefined &&
        gap
      ) {
        await createCustomEdge("data-graph", {
          from: lastQualifiedId,
          to: nextQualifiedId,
          propertyName: "id",
          label: "GENERATION",
        });
        lastQualifiedId = nextQualifiedId;
        nextQualifiedId = undefined;
        gap = false;
      }

      await goToEveryNode(client, "data-graph", users[i], {
        lastQualifiedId: lastQualifiedId,
        gap: gap,
        nextQualifiedId: nextQualifiedId,
      });
      count++;
    }
  }
};
const goToEveryTree = async (
  client: any,
  graphName: string,
  users: number[]
) => {
  for (let i = 0; i < users.length; i++) {
    const isQualified = await getPropertyByPropertyName(client, graphName, {
      propertyName: "isQualified",
      value: true,
      id: users[i],
      returnPropertyName: "id",
    });
    await goToEveryNode(client, graphName, users[i], {
      lastQualifiedId:
        isQualified[0] === undefined ? undefined : isQualified[0],
      gap: false,
      nextQualifiedId: undefined,
    });
    count++;
  }
};

export const generation = async (client: any) => {
  const getAllUsers = await findTheRootNodes(client, "data-graph");
  console.log(getAllUsers);
  const checkEveryTree = await goToEveryTree(client, "data-graph", getAllUsers);
  console.log("count", count);
  // const checkEveryNode = await goToEveryNode(client, "data-graph", 1);
  // console.log(checkEveryNode);
};
