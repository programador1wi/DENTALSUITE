#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const result = spawnSync("npx", ["dotenvx", "run", "-f", "../../.env", "-f", ".env", "--", "npx", "prisma", "db", "push", "--config", "prisma.config.ts"], {
  cwd: "packages/database",
  stdio: "inherit",
  shell: true
});

process.exit(result.status ?? 1);
