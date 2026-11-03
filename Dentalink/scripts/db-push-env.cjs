#!/usr/bin/env node
const path = require("path");
const dotenv = require("dotenv");
const { spawnSync } = require("node:child_process");

dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../packages/database/.env") });

const result = spawnSync("npx", ["prisma", "db", "push", "--config", "prisma.config.ts", "--accept-data-loss"], {
  cwd: "packages/database",
  stdio: "inherit",
  shell: true
});

process.exit(result.status ?? 1);
