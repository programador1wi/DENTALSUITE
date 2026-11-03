const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const backupScript = path.join(repositoryRoot, "scripts", "db-backup.cjs");
const restoreScript = path.join(repositoryRoot, "scripts", "db-restore.cjs");

function runBackup(directory, mode) {
  return spawnSync(process.execPath, [backupScript], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      BACKUP_DIR: directory,
      DB_BACKUP_DRIVER: "fixture",
      DB_BACKUP_FIXTURE_MODE: mode,
      DB_BACKUP_MIN_BYTES: "16",
      DATABASE_URL: "postgresql://backup_user:private-password@db.internal:5432/dentalink?sslmode=require"
    }
  });
}

test("db backup publishes dump and manifest only after a successful complete stream", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dentalink-backup-success-"));
  const result = runBackup(directory, "success");

  assert.equal(result.status, 0, result.stderr);
  const files = fs.readdirSync(directory);
  const dumpName = files.find((name) => name.endsWith(".dump"));
  const manifestName = files.find((name) => name.endsWith(".manifest.json"));
  assert.ok(dumpName);
  assert.ok(manifestName);
  assert.equal(files.some((name) => name.endsWith(".partial")), false);

  const bytes = fs.readFileSync(path.join(directory, dumpName));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, manifestName), "utf8"));
  assert.equal(manifest.dumpFile, dumpName);
  assert.equal(manifest.sizeBytes, bytes.length);
  assert.equal(manifest.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
  assert.equal(manifest.driver, "fixture");
  assert.equal(manifest.sourceDatabase, "fixture");
});

test("db backup removes partial artifacts when pg_dump fails", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dentalink-backup-failure-"));
  const result = runBackup(directory, "failure");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Database backup failed/);
  assert.equal(
    fs.readdirSync(directory).some(
      (name) => name.endsWith(".dump") || name.includes("manifest.json") || name.endsWith(".partial")
    ),
    false
  );
});

test("restore rejects a tampered dump before invoking PostgreSQL", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dentalink-restore-tamper-"));
  const dumpPath = path.join(directory, "tampered.dump");
  fs.writeFileSync(dumpPath, "tampered-dump-content", "utf8");
  fs.writeFileSync(
    path.join(directory, "tampered.manifest.json"),
    JSON.stringify({
      dumpFile: "tampered.dump",
      sizeBytes: fs.statSync(dumpPath).size,
      sha256: "0".repeat(64)
    }),
    "utf8"
  );

  const result = spawnSync(process.execPath, [restoreScript, "--verify", dumpPath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SHA-256 mismatch/);
});
