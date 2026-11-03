import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { ReportStorageService } from "./report-storage.service";
import type { ObjectStoragePort, StoredObjectMetadata } from "../storage/object-storage.port";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

class MemoryObjectStorage implements ObjectStoragePort {
  readonly provider = "s3" as const;
  readonly objects = new Map<string, { body: Buffer; metadata: StoredObjectMetadata }>();

  async put(input: { key: string; body: Buffer; contentType: string; checksumSha256: string }) {
    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      metadata: { size: input.body.byteLength, contentType: input.contentType, checksumSha256: input.checksumSha256 }
    });
  }

  async putFile(input: { key: string; filePath: string; contentType: string; checksumSha256: string }) {
    await this.put({ ...input, body: await readFile(input.filePath) });
  }

  async read(key: string) {
    const value = this.objects.get(key);
    if (!value) throw new Error("missing object");
    return Buffer.from(value.body);
  }

  async head(key: string) {
    return this.objects.get(key)?.metadata ?? null;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

describe("ReportStorageService", () => {
  const key = Buffer.alloc(32, 7).toString("base64");

  it("stores encrypted reports in shared object storage and verifies them on read", async () => {
    const objects = new MemoryObjectStorage();
    const config = new ConfigService({ REPORT_STORAGE_ENCRYPTION_KEY: key });
    const service = new ReportStorageService(config, objects);
    const plain = Buffer.from("patient,amount\nJane,100\n", "utf8");

    const stored = await service.store("org/one", "request/one", plain);

    expect(stored.storageKey).toMatch(/^reports\/org_one\/request_one\/[a-f0-9]{32}\.enc$/);
    expect(objects.objects.get(stored.storageKey)?.body.equals(plain)).toBe(false);
    await expect(service.read(stored.storageKey)).resolves.toEqual(plain);
    await expect(service.exists(stored.storageKey)).resolves.toBe(true);
  });

  it("fails closed when object metadata checksum does not match ciphertext", async () => {
    const objects = new MemoryObjectStorage();
    const service = new ReportStorageService(
      new ConfigService({ REPORT_STORAGE_ENCRYPTION_KEY: key }),
      objects
    );
    const stored = await service.store("org", "request", Buffer.from("sensitive"));
    const object = objects.objects.get(stored.storageKey)!;
    object.metadata.checksumSha256 = "0".repeat(64);

    await expect(service.read(stored.storageKey)).rejects.toThrow("Checksum del archivo de reporte no coincide");
  });

  it("encrypts a generated file without loading it through the buffer storage path", async () => {
    const root = await mkdtemp(join(tmpdir(), "report-storage-test-"));
    try {
      const source = join(root, "report.csv");
      const plain = Buffer.from("id,name\n1,Jane\n");
      await writeFile(source, plain);
      const objects = new MemoryObjectStorage();
      const service = new ReportStorageService(
        new ConfigService({ REPORT_STORAGE_ENCRYPTION_KEY: key }),
        objects
      );

      const stored = await service.storeFile("org", "request", source);

      await expect(service.read(stored.storageKey)).resolves.toEqual(plain);
      expect(stored.fileSize).toBe(plain.byteLength);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
