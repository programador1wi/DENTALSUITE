#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const base = spawnSync("npm", ["run", "prisma:seed", "--workspace=@dentalwarner/database"], {
  stdio: "inherit",
  shell: true
});

process.exit(base.status ?? 0);
