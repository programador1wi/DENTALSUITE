import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { OBJECT_STORAGE, ObjectStoragePort } from "../storage/object-storage.port";

const MAGIC = Buffer.from("DWRP01", "ascii");

@Injectable()
export class ReportStorageService {
  constructor(
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStoragePort
  ) {}

  async store(organizationId: string, requestId: string, bytes: Buffer) {
    const relativeKey = `reports/${this.safe(organizationId)}/${this.safe(requestId)}/${randomBytes(16).toString("hex")}.enc`;
    const encrypted = this.encrypt(bytes);
    const encryptedChecksum = createHash("sha256").update(encrypted).digest("hex");
    await this.objects.put({
      key: relativeKey,
      body: encrypted,
      contentType: "application/octet-stream",
      checksumSha256: encryptedChecksum
    });
    return {
      storageKey: relativeKey,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      fileSize: bytes.byteLength
    };
  }

  async storeFile(organizationId: string, requestId: string, filePath: string) {
    const relativeKey = this.objectKey(organizationId, requestId);
    const temporaryRoot = await mkdtemp(join(tmpdir(), "dentalink-report-encrypted-"));
    const encryptedPath = join(temporaryRoot, "report.enc");
    const plaintextHash = createHash("sha256");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const tap = (hash: ReturnType<typeof createHash>) => new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      }
    });
    try {
      const tagPosition = MAGIC.length + iv.length;
      const contentPosition = tagPosition + 16;
      await writeFile(encryptedPath, Buffer.concat([MAGIC, iv, Buffer.alloc(16)]), { flag: "wx" });
      await pipeline(
        createReadStream(filePath),
        tap(plaintextHash),
        cipher,
        createWriteStream(encryptedPath, { flags: "r+", start: contentPosition })
      );
      const authTag = cipher.getAuthTag();
      const handle = await open(encryptedPath, "r+");
      try {
        await handle.write(authTag, 0, authTag.length, tagPosition);
      } finally {
        await handle.close();
      }
      // Ciphertext checksum covers the exact stored artifact, including framing and authentication tag.
      const framedHash = createHash("sha256");
      for await (const chunk of createReadStream(encryptedPath)) framedHash.update(chunk);
      await this.objects.putFile({
        key: relativeKey,
        filePath: encryptedPath,
        contentType: "application/octet-stream",
        checksumSha256: framedHash.digest("hex")
      });
      return {
        storageKey: relativeKey,
        checksum: plaintextHash.digest("hex"),
        fileSize: (await stat(filePath)).size
      };
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  async read(storageKey: string) {
    const encrypted = await this.objects.read(storageKey);
    const metadata = await this.objects.head(storageKey);
    const actualChecksum = createHash("sha256").update(encrypted).digest("hex");
    if (metadata?.checksumSha256 && metadata.checksumSha256 !== actualChecksum) {
      throw new Error("Checksum del archivo de reporte no coincide");
    }
    return this.decrypt(encrypted);
  }

  async remove(storageKey?: string | null) {
    if (!storageKey) return;
    await this.objects.delete(storageKey);
  }

  async exists(storageKey?: string | null) {
    if (!storageKey) return false;
    return Boolean(await this.objects.head(storageKey));
  }

  private encrypt(bytes: Buffer) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
  }

  private decrypt(bytes: Buffer) {
    if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Archivo de reporte invalido");
    const ivStart = MAGIC.length;
    const tagStart = ivStart + 12;
    const contentStart = tagStart + 16;
    const decipher = createDecipheriv("aes-256-gcm", this.key(), bytes.subarray(ivStart, tagStart));
    decipher.setAuthTag(bytes.subarray(tagStart, contentStart));
    return Buffer.concat([decipher.update(bytes.subarray(contentStart)), decipher.final()]);
  }

  private key() {
    const configured = this.config.get<string>("REPORT_STORAGE_ENCRYPTION_KEY")?.trim();
    if (configured) {
      const decoded = /^[0-9a-f]{64}$/i.test(configured)
        ? Buffer.from(configured, "hex")
        : Buffer.from(configured, "base64");
      if (decoded.length !== 32) throw new Error("REPORT_STORAGE_ENCRYPTION_KEY debe contener 32 bytes");
      return decoded;
    }
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new Error("REPORT_STORAGE_ENCRYPTION_KEY es obligatoria en produccion");
    }
    return createHash("sha256").update("dentalink-development-report-storage").digest();
  }

  private safe(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private objectKey(organizationId: string, requestId: string) {
    return `reports/${this.safe(organizationId)}/${this.safe(requestId)}/${randomBytes(16).toString("hex")}.enc`;
  }
}
