#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const result = spawnSync("npm", ["run", "prisma:migrate:status", "--workspace=@dentalwarner/database"], {
  stdio: "inherit",
  shell: true
});

process.exit(result.status ?? 1);
