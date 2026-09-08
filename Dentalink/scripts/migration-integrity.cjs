#!/usr/bin/env node
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function variants(bytes) {
  const text = bytes.toString("utf8");
  const lf = text.replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return {
    exact: sha256(bytes),
    lf: sha256(Buffer.from(lf, "utf8")),
    crlf: sha256(Buffer.from(crlf, "utf8"))
  };
}

function classifyMigrationRecord(row, fileExists, hashes) {
  if (row.rolled_back_at) return "ROLLED_BACK_RECORD";
  if (!row.finished_at) return "INCOMPLETE_MIGRATION";
  if (!fileExists) return "FILE_MISSING";
  if (row.checksum === hashes.exact) return "EXACT_MATCH";
  if (row.checksum === hashes.lf || row.checksum === hashes.crlf) {
    return "LINE_ENDINGS_ONLY";
  }
  return "SQL_CONTENT_DIFFERS";
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required");
  const root = path.resolve(process.cwd(), "packages/database/prisma/migrations");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name'
    );
    const summary = {
      checked: rows.length,
      applied: 0,
      exactMatches: 0,
      lineEndingsOnly: 0,
      rolledBackRecords: 0
    };
    const differences = [];
    for (const row of rows) {
      const file = path.join(root, row.migration_name, "migration.sql");
      const fileExists = fs.existsSync(file);
      const hashes = fileExists ? variants(fs.readFileSync(file)) : undefined;
      const classification = classifyMigrationRecord(row, fileExists, hashes);

      if (classification === "ROLLED_BACK_RECORD") {
        summary.rolledBackRecords += 1;
        continue;
      }
      if (row.finished_at) summary.applied += 1;
      if (classification === "EXACT_MATCH") {
        summary.exactMatches += 1;
        continue;
      }
      if (classification === "LINE_ENDINGS_ONLY") {
        summary.lineEndingsOnly += 1;
        continue;
      }
      differences.push({
        migration: row.migration_name,
        classification,
        appliedChecksum: row.checksum,
        ...(hashes ? { currentChecksum: hashes.exact } : {}),
        finished: Boolean(row.finished_at),
        rolledBack: false
      });
    }
    process.stdout.write(
      `${JSON.stringify({ ...summary, materialDifferences: differences.length, differences }, null, 2)}\n`
    );
    if (differences.length > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { classifyMigrationRecord, variants };
