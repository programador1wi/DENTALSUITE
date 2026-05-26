#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const sql =
  "SELECT schemaname, relname AS table_name, seq_scan, idx_scan, n_live_tup " +
  "FROM pg_stat_user_tables " +
  "ORDER BY seq_scan DESC, n_live_tup DESC " +
  "LIMIT 50;";

const result = spawnSync(
  "docker",
  ["exec", "-i", "dentalwarner-postgres", "psql", "-U", "dentalwarner", "-d", "dentalwarner", "-c", sql],
  { stdio: "inherit" }
);

if ((result.status ?? 1) !== 0) {
  console.error("Index usage check failed.");
  process.exit(result.status ?? 1);
}
