#!/usr/bin/env node
/**
 * db-restore.cjs — Restore a PostgreSQL dump into the local Docker container.
 *
 * Usage:
 *   node scripts/db-restore.cjs                          # restores latest dump
 *   node scripts/db-restore.cjs backups/specific.dump    # restores specific dump
 *   node scripts/db-restore.cjs --verify                 # restores into a temporary DB to verify integrity
 *
 * The --verify flag creates a temporary database, restores into it, runs basic
 * integrity checks (table count, row counts for critical tables), then drops it.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CONTAINER = "dentalwarner-postgres";
const PG_USER = "dentalwarner";
const MAIN_DB = "dentalwarner";
const VERIFY_DB = "dentalwarner_verify";

const args = process.argv.slice(2);
const verifyMode = args.includes("--verify");
const dumpArg = args.find((a) => !a.startsWith("--"));

function findLatestDump() {
  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    console.error("No backups/ directory found.");
    process.exit(1);
  }
  const dumps = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({
      name: f,
      path: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (dumps.length === 0) {
    console.error("No .dump files found in backups/.");
    process.exit(1);
  }
  return dumps[0];
}

function dockerExec(cmd, opts = {}) {
  return spawnSync("docker", ["exec", "-i", CONTAINER, ...cmd], {
    stdio: opts.stdio || "inherit",
    input: opts.input,
  });
}


function restoreToDb(dumpPath, targetDb) {
  console.log(`\nRestoring ${path.basename(dumpPath)} into "${targetDb}"...`);

  const dumpData = fs.readFileSync(dumpPath);

  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "pg_restore",
      "-U",
      PG_USER,
      "-d",
      targetDb,
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--exit-on-error",
    ],
    { input: dumpData, stdio: ["pipe", "inherit", "inherit"] }
  );

  if (result.status !== 0) {
    console.error(`pg_restore exited with code ${result.status}`);
    return false;
  }

  console.log("Restore completed.");
  return true;
}

function runIntegrityChecks(db) {
  console.log(`\nRunning integrity checks on "${db}"...`);

  const tableCountResult = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      PG_USER,
      "-d",
      db,
      "-t",
      "-c",
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const tableCount = (tableCountResult.stdout || "").toString().trim();
  console.log(`  Tables found: ${tableCount}`);
  let valid = tableCountResult.status === 0 && Number(tableCount) > 0;

  // Check critical tables exist and have rows
  const criticalTables = [
    "Organization",
    "Branch",
    "User",
    "Role",
    "Permission",
    "Patient",
    "Appointment",
  ];

  for (const table of criticalTables) {
    const result = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        CONTAINER,
        "psql",
        "-U",
        PG_USER,
        "-d",
        db,
        "-t",
        "-c",
        `SELECT count(*) FROM "${table}";`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    const count = (result.stdout || "").toString().trim();
    const err = (result.stderr || "").toString().trim();
    if (err && err.includes("does not exist")) {
      console.log(`  ${table}: TABLE MISSING`);
      valid = false;
    } else if (result.status !== 0) {
      console.log(`  ${table}: CHECK FAILED`);
      valid = false;
    } else {
      console.log(`  ${table}: ${count} rows`);
    }
  }

  // Check migration history
  const migResult = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      PG_USER,
      "-d",
      db,
      "-t",
      "-c",
      'SELECT count(*) FROM "_prisma_migrations";',
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const migCount = (migResult.stdout || "").toString().trim();
  console.log(`  Prisma migrations recorded: ${migCount}`);
  if (migResult.status !== 0 || Number(migCount) <= 0) valid = false;
  return valid;
}

const crypto = require("node:crypto");

const dump = dumpArg
  ? { name: path.basename(dumpArg), path: path.resolve(dumpArg) }
  : findLatestDump();

if (!fs.existsSync(dump.path)) {
  console.error(`Dump file not found: ${dump.path}`);
  process.exit(1);
}

const stats = fs.statSync(dump.path);
if (stats.size === 0) {
  console.error(`Dump file is empty (0 bytes): ${dump.name}`);
  process.exit(1);
}

// Check for manifest and verify checksum if manifest exists
const manifestPath = dump.path.replace(/\.dump$/, ".manifest.json");
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.dumpFile && manifest.dumpFile !== dump.name) {
      throw new Error(`Manifest references ${manifest.dumpFile}, not ${dump.name}`);
    }
    if (manifest.sizeBytes && manifest.sizeBytes !== stats.size) {
      throw new Error(`Manifest size ${manifest.sizeBytes} does not match dump size ${stats.size}`);
    }
    const fileBuffer = fs.readFileSync(dump.path);
    const calculatedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    if (manifest.sha256 && manifest.sha256 !== calculatedHash) {
      console.error(`FATAL: SHA-256 mismatch for ${dump.name}!`);
      console.error(`  Expected: ${manifest.sha256}`);
      console.error(`  Actual:   ${calculatedHash}`);
      process.exit(1);
    }
    console.log(`Verified SHA-256 checksum matches manifest (${calculatedHash.slice(0, 16)}...)`);
  } catch (err) {
    console.error(`FATAL: Invalid manifest ${manifestPath}:`, err.message);
    process.exit(1);
  }
} else {
  console.warn(`Warning: no checksum manifest found for ${dump.name}; legacy backup verification only.`);
}

console.log(`Selected dump: ${dump.name} (${(stats.size / 1024).toFixed(1)} KB)`);

if (verifyMode) {
  // Create temporary database, restore, check, drop
  console.log("\n--- VERIFY MODE: using temporary database ---");

  const initialDrop = dockerExec(["psql", "-U", PG_USER, "-d", "postgres", "-c", `DROP DATABASE IF EXISTS "${VERIFY_DB}";`]);
  if (initialDrop.status !== 0) {
    console.error("Unable to prepare the temporary verification database.");
    process.exit(1);
  }
  const create = dockerExec(["psql", "-U", PG_USER, "-d", "postgres", "-c", `CREATE DATABASE "${VERIFY_DB}";`]);
  if (create.status !== 0) {
    console.error("Unable to create the temporary verification database.");
    process.exit(1);
  }

  const ok = restoreToDb(dump.path, VERIFY_DB);
  const integrityOk = ok && runIntegrityChecks(VERIFY_DB);

  console.log("\nDropping temporary database...");
  const finalDrop = dockerExec(["psql", "-U", PG_USER, "-d", "postgres", "-c", `DROP DATABASE IF EXISTS "${VERIFY_DB}";`]);
  if (finalDrop.status !== 0) {
    console.error("Verify database cleanup failed.");
    process.exitCode = 1;
  }
  if (!integrityOk) {
    console.error("Verify failed.");
    process.exitCode = 1;
  } else {
    console.log("Verify complete.");
  }
} else {
  console.log(`\n*** WARNING: This will OVERWRITE the "${MAIN_DB}" database. ***`);
  console.log("Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n");

  // 5 second countdown
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // busy wait for safety pause
  }

  const restored = restoreToDb(dump.path, MAIN_DB);
  const integrityOk = restored && runIntegrityChecks(MAIN_DB);
  if (!integrityOk) process.exitCode = 1;
}
