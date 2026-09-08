#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Transform, Writable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const MANIFEST_MAGIC = Buffer.from("DWSM1", "ascii");
const sourceRoot = path.resolve(
  process.env.STORAGE_BACKUP_SOURCE || path.join(__dirname, "..", "apps", "api", "storage")
);
const backupRoot = path.resolve(process.env.STORAGE_BACKUP_DIR || path.join(process.cwd(), "backups", "storage"));

function encryptionKey() {
  const configured = process.env.STORAGE_BACKUP_ENCRYPTION_KEY?.trim() || "";
  if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(configured)) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
  }
  throw new Error("STORAGE_BACKUP_ENCRYPTION_KEY must contain exactly 32 bytes encoded as hexadecimal or base64");
}

function walkFiles(root, current = root) {
  if (!fs.existsSync(current)) return [];
  const entries = fs.readdirSync(current, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported in storage backups: ${absolute}`);
    if (entry.isDirectory()) return walkFiles(root, absolute);
    if (!entry.isFile()) return [];
    return [path.relative(root, absolute).split(path.sep).join("/")];
  });
}

function encryptManifest(manifest, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MANIFEST_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function decryptManifest(bytes, key) {
  if (bytes.length < MANIFEST_MAGIC.length + 12 + 16) throw new Error("Encrypted storage manifest is truncated");
  if (!bytes.subarray(0, MANIFEST_MAGIC.length).equals(MANIFEST_MAGIC)) {
    throw new Error("Encrypted storage manifest has an invalid format");
  }
  const ivOffset = MANIFEST_MAGIC.length;
  const tagOffset = ivOffset + 12;
  const ciphertextOffset = tagOffset + 16;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, bytes.subarray(ivOffset, tagOffset));
  decipher.setAuthTag(bytes.subarray(tagOffset, ciphertextOffset));
  const plaintext = Buffer.concat([decipher.update(bytes.subarray(ciphertextOffset)), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

async function encryptFile(source, destination, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const hash = crypto.createHash("sha256");
  let sizeBytes = 0;
  const observer = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      sizeBytes += chunk.length;
      callback(null, chunk);
    }
  });
  await pipeline(fs.createReadStream(source), observer, cipher, fs.createWriteStream(destination, { flags: "wx" }));
  return {
    sizeBytes,
    sha256: hash.digest("hex"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
}

function resolveInside(root, relativePath) {
  if (!relativePath || relativePath.split("/").some((segment) => segment === ".." || segment === "")) {
    throw new Error(`Unsafe storage path in manifest: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.split("/"));
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Storage path escapes target: ${relativePath}`);
  return resolved;
}

async function verifyOrRestoreFile(entry, backupDirectory, key, restoreRoot) {
  if (!/^[a-f0-9]{64}\.enc$/i.test(entry.encryptedFile)) {
    throw new Error(`Unsafe encrypted filename in manifest: ${entry.encryptedFile}`);
  }
  const encryptedPath = path.join(backupDirectory, entry.encryptedFile);
  if (!fs.existsSync(encryptedPath)) throw new Error(`Encrypted file is missing: ${entry.encryptedFile}`);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(entry.iv, "base64"));
  decipher.setAuthTag(Buffer.from(entry.authTag, "base64"));
  const hash = crypto.createHash("sha256");
  let sizeBytes = 0;
  const observer = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      sizeBytes += chunk.length;
      callback(null, chunk);
    }
  });

  let targetPath;
  let partialTarget;
  let destination;
  if (restoreRoot) {
    targetPath = resolveInside(restoreRoot, entry.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    partialTarget = `${targetPath}.partial`;
    destination = fs.createWriteStream(partialTarget, { flags: "wx" });
  } else {
    destination = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  }

  try {
    await pipeline(fs.createReadStream(encryptedPath), decipher, observer, destination);
    const sha256 = hash.digest("hex");
    if (sizeBytes !== entry.sizeBytes || sha256 !== entry.sha256) {
      throw new Error(`Integrity mismatch for ${entry.relativePath}`);
    }
    if (targetPath && partialTarget) fs.renameSync(partialTarget, targetPath);
  } catch (error) {
    if (partialTarget) fs.rmSync(partialTarget, { force: true });
    throw error;
  }
}

function latestBackupDirectory() {
  if (!fs.existsSync(backupRoot)) throw new Error(`Storage backup directory does not exist: ${backupRoot}`);
  const directories = fs
    .readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("storage-") && !entry.name.endsWith(".partial"))
    .map((entry) => ({ path: path.join(backupRoot, entry.name), mtime: fs.statSync(path.join(backupRoot, entry.name)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime);
  if (!directories.length) throw new Error("No completed storage backup was found");
  return directories[0].path;
}

async function createBackup(key) {
  fs.mkdirSync(backupRoot, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalDirectory = path.join(backupRoot, `storage-${timestamp}`);
  const partialDirectory = `${finalDirectory}.partial`;
  fs.mkdirSync(partialDirectory, { recursive: false });

  try {
    const files = walkFiles(sourceRoot).sort();
    const entries = [];
    for (const relativePath of files) {
      const encryptedFile = `${crypto.createHash("sha256").update(relativePath).digest("hex")}.enc`;
      const details = await encryptFile(
        resolveInside(sourceRoot, relativePath),
        path.join(partialDirectory, encryptedFile),
        key
      );
      entries.push({ relativePath, encryptedFile, ...details });
    }

    const manifest = { version: 1, createdAt: new Date().toISOString(), source: "storage", entries };
    fs.writeFileSync(path.join(partialDirectory, "manifest.enc"), encryptManifest(manifest, key), { flag: "wx" });
    fs.writeFileSync(
      path.join(partialDirectory, "metadata.json"),
      `${JSON.stringify({ version: 1, createdAt: manifest.createdAt, fileCount: entries.length }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
    fs.renameSync(partialDirectory, finalDirectory);
    console.log(`Storage backup generated at ${finalDirectory}`);
    console.log(`Files encrypted: ${entries.length}`);
    return finalDirectory;
  } catch (error) {
    fs.rmSync(partialDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function verifyBackup(backupDirectory, key, restoreRoot) {
  const manifestPath = path.join(backupDirectory, "manifest.enc");
  if (!fs.existsSync(manifestPath)) throw new Error(`Encrypted manifest is missing: ${manifestPath}`);
  const manifest = decryptManifest(fs.readFileSync(manifestPath), key);
  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) throw new Error("Unsupported storage manifest");

  if (restoreRoot) {
    if (fs.existsSync(restoreRoot) && fs.readdirSync(restoreRoot).length > 0) {
      throw new Error(`Restore target must be empty: ${restoreRoot}`);
    }
    fs.mkdirSync(restoreRoot, { recursive: true });
  }

  for (const entry of manifest.entries) await verifyOrRestoreFile(entry, backupDirectory, key, restoreRoot);
  console.log(`${restoreRoot ? "Storage restore" : "Storage verification"} complete: ${manifest.entries.length} files`);
}

async function main() {
  const key = encryptionKey();
  const args = process.argv.slice(2);
  if (args[0] === "--verify") {
    await verifyBackup(path.resolve(args[1] || latestBackupDirectory()), key);
    return;
  }
  if (args[0] === "--restore") {
    if (!args[1]) throw new Error("Usage: storage-backup.cjs --restore <empty-target> [backup-directory]");
    await verifyBackup(path.resolve(args[2] || latestBackupDirectory()), key, path.resolve(args[1]));
    return;
  }
  await createBackup(key);
}

main().catch((error) => {
  console.error(`Storage backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
