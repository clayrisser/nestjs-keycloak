# apache-age-client

> nodejs client for apache age

This client was adapted from the apache age viewer.

https://github.com/apache/age-viewer

You can learn more about Apache Age at the following link.

https://age.apache.org

## Setup

```sh
yarn add apache-age-client
```

## Usage

```ts
import ApacheAgeClient from "apache-age-client";

(async () => {
  const client = ApacheAgeClient.connect({
    database: "postgres",
    graph: "some-graph",
    host: "localhost",
    password: "postgres",
    port: 5432,
    user: "postgres",
  });

  const result = await client.executeCypher(`
    SOME_CYPHER_QUERY
  `);

  console.log(result);
})();
```
