#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");
const { variants } = require("./migration-integrity.cjs");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function git(args, options = {}) {
  const result = spawnSync("git", ["-c", "safe.directory=*", ...args], {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(String(result.stderr || `git ${args.join(" ")} failed`).trim());
  }
  return result.stdout;
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required");

  const repositoryRoot = String(git(["rev-parse", "--show-toplevel"], { encoding: "utf8" })).trim();
  const migrationsRoot = path.resolve(process.cwd(), "packages/database/prisma/migrations");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name'
    );
    const findings = [];
    for (const row of rows) {
      const file = path.join(migrationsRoot, row.migration_name, "migration.sql");
      if (!fs.existsSync(file)) continue;
      const current = variants(fs.readFileSync(file));
      if ([current.exact, current.lf, current.crlf].includes(row.checksum)) continue;

      const repoPath = path.relative(repositoryRoot, file).replace(/\\/g, "/");
      const commits = String(
        git(["rev-list", "--all", "--", repoPath], { cwd: repositoryRoot, encoding: "utf8" })
      )
        .split(/\r?\n/)
        .filter(Boolean);
      const matches = [];
      for (const commit of commits) {
        const blob = git(["show", `${commit}:${repoPath}`], { cwd: repositoryRoot });
        const hashes = variants(blob);
        if ([hashes.exact, hashes.lf, hashes.crlf].includes(row.checksum)) {
          matches.push(commit);
        }
      }
      findings.push({
        migration: row.migration_name,
        appliedChecksum: row.checksum,
        currentChecksum: current.exact,
        matchingCommits: matches
      });
    }
    process.stdout.write(`${JSON.stringify({ materialDifferences: findings.length, findings }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
