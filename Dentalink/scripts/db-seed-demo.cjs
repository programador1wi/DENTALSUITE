#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const base = spawnSync("npm", ["run", "prisma:seed", "--workspace=@dentalwarner/database"], {
  stdio: "inherit",
  shell: true
});

if ((base.status ?? 1) !== 0) process.exit(base.status ?? 1);

const demo = spawnSync("npm", ["run", "prisma:seed:demo", "--workspace=@dentalwarner/database"], {
  stdio: "inherit",
  shell: true
});

process.exit(demo.status ?? 1);
