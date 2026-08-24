import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const MAGIC = Buffer.from("DWRP01", "ascii");

@Injectable()
export class ReportStorageService {
  private readonly root = resolve(process.cwd(), "storage", "reports");

  constructor(private readonly config: ConfigService) {}

  async store(organizationId: string, requestId: string, bytes: Buffer) {
    const relativeKey = `${this.safe(organizationId)}/${this.safe(requestId)}.xlsx.enc`;
    const target = this.resolveKey(relativeKey);
    await mkdir(resolve(target, ".."), { recursive: true });
    const encrypted = this.encrypt(bytes);
    await writeFile(target, encrypted, { flag: "wx" });
    return {
      storageKey: relativeKey,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      fileSize: bytes.byteLength
    };
  }

  async read(storageKey: string) {
    return this.decrypt(await readFile(this.resolveKey(storageKey)));
  }

  async remove(storageKey?: string | null) {
    if (!storageKey) return;
    await unlink(this.resolveKey(storageKey)).catch(() => undefined);
  }

  async exists(storageKey?: string | null) {
    if (!storageKey) return false;
    return stat(this.resolveKey(storageKey)).then(() => true, () => false);
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

  private resolveKey(key: string) {
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) throw new Error("Ruta de reporte invalida");
    return target;
  }

  private safe(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
}
