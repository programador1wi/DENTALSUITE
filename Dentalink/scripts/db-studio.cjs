#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const result = spawnSync("npm", ["exec", "--workspace=@dentalwarner/database", "--", "prisma", "studio", "--config", "prisma.config.ts"], {
  stdio: "inherit",
  shell: true
});

process.exit(result.status ?? 1);
