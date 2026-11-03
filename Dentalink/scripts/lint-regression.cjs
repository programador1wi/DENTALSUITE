#!/usr/bin/env node
const { mkdirSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const warningLimit = Number(process.env.LINT_WARNING_LIMIT ?? 641);
const artifactsDir = resolve(process.cwd(), "artifacts");
const reportPath = resolve(artifactsDir, "eslint-report.json");
mkdirSync(artifactsDir, { recursive: true });

const eslintBin = resolve(dirname(require.resolve("eslint/package.json")), "bin", "eslint.js");
const result = spawnSync(
  process.execPath,
  [eslintBin, ".", "--format", "json", "--output-file", reportPath],
  { stdio: "inherit", shell: false }
);

if (result.error) {
  console.error(`Unable to execute ESLint: ${result.error.message}`);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Unable to read ESLint report: ${error.message}`);
  process.exit(result.status ?? 1);
}

const totals = report.reduce(
  (acc, file) => ({
    errors: acc.errors + Number(file.errorCount ?? 0),
    warnings: acc.warnings + Number(file.warningCount ?? 0)
  }),
  { errors: 0, warnings: 0 }
);

console.log(`ESLint regression gate: errors=${totals.errors}, warnings=${totals.warnings}, limit=${warningLimit}`);
if (totals.errors > 0 || totals.warnings > warningLimit) {
  process.exit(1);
}
