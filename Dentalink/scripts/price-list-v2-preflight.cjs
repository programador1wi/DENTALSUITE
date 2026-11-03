const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "packages",
        "database",
        "prisma",
        "migrations",
        "20260717010000_price_list_versioning_v2",
        "dry-run.sql"
      ),
      "utf8"
    );
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    for (const [index, query] of results.entries()) {
      console.log(JSON.stringify({ query: index + 1, rows: query.rows }, null, 2));
    }
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
