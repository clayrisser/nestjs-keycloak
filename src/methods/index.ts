import {
  createNode,
  createReferrerNode,
  updateQualifiedNode,
  dbConnection,
  createGraph,
  dropGraph,
  deleteNode,
  getData,
  deleteAllNodes,
  deleteRelationship,
} from "./methods";

(async () => {
  console.log(await dbConnection({}));
  // console.log(await createGraph("dr-graph"));

  // console.log(await dropGraph("dr-graph"));

  // console.log(
  //   await createNode({
  //     graph: "dr-graph",
  //     userId: "a",
  //     name: "a",
  //     qualified: true,
  //   })
  // );

  // console.log(
  //   await createReferrerNode({
  //     graph: "dr-graph",
  //     userId: "aa2",
  //     name: "aa2",
  //     qualified: false,
  //     referrerId: "b",
  //   })
  // );

  // console.log(
  //   await updateQualifiedNode({
  //     graph: "dr-graph",
  //     userId: "a",
  //     name: "Bob",
  //     qualified: true,
  //   })
  // );

  // console.log(await getData({}));

  // console.log(await deleteNode({ graph: "dr-graph", userId: "bb3" }));

  // console.log(await deleteAllNodes({ graph: "dr-graph" }));

  // console.log(
  //   await deleteRelationship({
  //     graph: "dr-graph",
  //     userId: "bb3",
  //     referrerId: "a",
  //   })
  // );
})();
