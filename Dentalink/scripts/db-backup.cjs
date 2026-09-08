#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");

const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
const minimumBytes = Number(process.env.DB_BACKUP_MIN_BYTES || 1024);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const baseName = `dentalwarner-${timestamp}`;
const partialPath = path.join(backupDir, `${baseName}.dump.partial`);
const finalDumpPath = path.join(backupDir, `${baseName}.dump`);
const partialManifestPath = path.join(backupDir, `${baseName}.manifest.json.partial`);
const manifestPath = path.join(backupDir, `${baseName}.manifest.json`);

function resolveDumpProcess() {
  const driver = (process.env.DB_BACKUP_DRIVER || "docker").trim().toLowerCase();
  if (driver === "fixture" && process.env.NODE_ENV === "test") {
    const shouldFail = process.env.DB_BACKUP_FIXTURE_MODE === "failure";
    return {
      driver,
      database: "fixture",
      command: process.execPath,
      args: [
        "-e",
        shouldFail
          ? "process.stderr.write('forced failure'); process.exit(7)"
          : "process.stdout.write('valid-backup-payload-repeated-valid-backup-payload')"
      ],
      env: process.env
    };
  }

  if (driver === "docker") {
    const container = process.env.POSTGRES_CONTAINER || "dentalwarner-postgres";
    const user = process.env.POSTGRES_USER || "dentalwarner";
    const database = process.env.POSTGRES_DB || "dentalwarner";
    return {
      driver,
      database,
      command: "docker",
      args: [
        "exec",
        "-i",
        container,
        "pg_dump",
        "-U",
        user,
        "-d",
        database,
        "-Fc",
        "--no-owner",
        "--no-privileges"
      ],
      env: process.env
    };
  }

  if (driver !== "direct") throw new Error(`Unsupported DB_BACKUP_DRIVER: ${driver}`);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required when DB_BACKUP_DRIVER=direct");
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the postgresql:// or postgres:// protocol");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL must include a database name");
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(parsed.password),
    ...(parsed.searchParams.get("sslmode") ? { PGSSLMODE: parsed.searchParams.get("sslmode") } : {})
  };

  return {
    driver,
    database,
    command: process.env.PG_DUMP_BIN || "pg_dump",
    args: [
      "-h",
      parsed.hostname,
      "-p",
      parsed.port || "5432",
      "-U",
      decodeURIComponent(parsed.username),
      "-d",
      database,
      "-Fc",
      "--no-owner",
      "--no-privileges"
    ],
    env
  };
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function latestSchemaVersion() {
  const migrationsDir = path.resolve(process.cwd(), "packages", "database", "prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) return "unknown";
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return migrations.at(-1) || "unknown";
}

function removeIfPresent(filePath) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Best-effort cleanup; the original backup error remains authoritative.
  }
}

async function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  const dumpProcess = resolveDumpProcess();
  const output = fs.createWriteStream(partialPath, { flags: "wx" });
  const child = spawn(dumpProcess.command, dumpProcess.args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: dumpProcess.env,
    windowsHide: true
  });
  child.stderr.pipe(process.stderr);

  const exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump failed with exit code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`));
    });
  });

  try {
    await Promise.all([pipeline(child.stdout, output), exit]);
    const stats = fs.statSync(partialPath);
    if (!Number.isFinite(minimumBytes) || minimumBytes < 1) {
      throw new Error("DB_BACKUP_MIN_BYTES must be a positive number");
    }
    if (stats.size < minimumBytes) {
      throw new Error(`Backup file too small (${stats.size} bytes; minimum ${minimumBytes})`);
    }

    const sha256 = await sha256File(partialPath);
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      dumpFile: path.basename(finalDumpPath),
      sizeBytes: stats.size,
      sha256,
      format: "pg_dump-custom",
      driver: dumpProcess.driver,
      sourceDatabase: dumpProcess.database,
      schemaVersion: latestSchemaVersion()
    };

    fs.writeFileSync(partialManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    fs.renameSync(partialPath, finalDumpPath);
    fs.renameSync(partialManifestPath, manifestPath);

    console.log(`Backup generated at ${finalDumpPath}`);
    console.log(`SHA-256 ${sha256}`);
    console.log(`Manifest generated at ${manifestPath}`);
  } catch (error) {
    removeIfPresent(partialPath);
    removeIfPresent(partialManifestPath);
    removeIfPresent(finalDumpPath);
    removeIfPresent(manifestPath);
    throw error;
  }
}

main().catch((error) => {
  console.error(`Database backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
