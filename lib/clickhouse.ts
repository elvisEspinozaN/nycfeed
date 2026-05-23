import { createClient } from "@clickhouse/client";

void (async () => {
  const client = createClient({
    url: "https://sa230q21j9.us-east-1.aws.clickhouse.cloud:8443",
    username: "default",
    password: "p9DY7XJB_8H5u",
  });
  const rows = await client.query({
    query: "SELECT 1",
    format: "JSONEachRow",
  });
  console.log("Result: ", await rows.json());
})();
