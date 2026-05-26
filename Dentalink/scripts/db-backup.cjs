#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const backupDir = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = path.join(backupDir, `dentalwarner-${timestamp}.dump`);
const fileStream = fs.createWriteStream(outputPath);

const dump = spawn(
  "docker",
  ["exec", "-i", "dentalwarner-postgres", "pg_dump", "-U", "dentalwarner", "-d", "dentalwarner", "-Fc"],
  { stdio: ["ignore", "pipe", "inherit"] }
);

dump.stdout.pipe(fileStream);

dump.on("close", (code) => {
  if (code !== 0) {
    console.error("Database backup failed.");
    process.exit(code ?? 1);
  }
  console.log(`Backup generated at ${outputPath}`);
});
