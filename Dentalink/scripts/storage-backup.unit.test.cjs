const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const script = path.join(repositoryRoot, "scripts", "storage-backup.cjs");
const key = "ab".repeat(32);

function run(args, source, backupRoot) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      STORAGE_BACKUP_SOURCE: source,
      STORAGE_BACKUP_DIR: backupRoot,
      STORAGE_BACKUP_ENCRYPTION_KEY: key
    }
  });
}

test("storage backup encrypts, verifies and restores files with their relative paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dentalink-storage-backup-"));
  const source = path.join(root, "source");
  const backupRoot = path.join(root, "backups");
  const restore = path.join(root, "restore");
  fs.mkdirSync(path.join(source, "patient-files", "org-1", "patient-1"), { recursive: true });
  fs.writeFileSync(path.join(source, "patient-files", "org-1", "patient-1", "image.bin"), Buffer.from([0, 1, 2, 3, 255]));
  fs.mkdirSync(path.join(source, "report-files"), { recursive: true });
  fs.writeFileSync(path.join(source, "report-files", "report.txt"), "private report", "utf8");

  const created = run([], source, backupRoot);
  assert.equal(created.status, 0, created.stderr);
  const backupDirectory = path.join(backupRoot, fs.readdirSync(backupRoot)[0]);
  assert.equal(fs.readdirSync(backupDirectory).some((name) => name.endsWith(".partial")), false);
  assert.equal(fs.readFileSync(path.join(backupDirectory, "manifest.enc")).includes(Buffer.from("patient-1")), false);

  const verified = run(["--verify", backupDirectory], source, backupRoot);
  assert.equal(verified.status, 0, verified.stderr);

  const restored = run(["--restore", restore, backupDirectory], source, backupRoot);
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(
    fs.readFileSync(path.join(restore, "patient-files", "org-1", "patient-1", "image.bin")),
    Buffer.from([0, 1, 2, 3, 255])
  );
  assert.equal(fs.readFileSync(path.join(restore, "report-files", "report.txt"), "utf8"), "private report");
});

test("storage verification fails closed after encrypted content is modified", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dentalink-storage-tamper-"));
  const source = path.join(root, "source");
  const backupRoot = path.join(root, "backups");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "clinical.txt"), "clinical", "utf8");
  assert.equal(run([], source, backupRoot).status, 0);
  const backupDirectory = path.join(backupRoot, fs.readdirSync(backupRoot)[0]);
  const encryptedFile = fs.readdirSync(backupDirectory).find((name) => name.endsWith(".enc") && name !== "manifest.enc");
  fs.appendFileSync(path.join(backupDirectory, encryptedFile), Buffer.from([1]));

  const verified = run(["--verify", backupDirectory], source, backupRoot);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /Storage backup failed/);
});
