import {
  createNode,
  createReferrerNode,
  updateQualifiedNode,
  dbConnection,
  createGraph,
  dropGraph,
} from "./methods";

(async () => {
  await dbConnection();
  // await createGraph("some-graph");

  // await dropGraph("me-graph");

  // console.log(
  //   await createNode({
  //     graph: "some-graph",
  //     userId: "a",
  //     name: "Bob",
  //     qualified: false,
  //   })
  // );

  // console.log(
  //   await createReferrerNode({
  //     graph: "some-graph",
  //     userId: "b",
  //     name: "Alice",
  //     qualified: false,
  //     referrerId: "a",
  //   })
  // );

  //   await updateQualifiedNode({
  //     graph: "some-graph",
  //     userId: 1,
  //     name: "Bob",
  //     qualified: true,
  //   });
})();
