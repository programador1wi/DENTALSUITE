import { Inject, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { validateEnvironment } from "../config/environment.validation";
import { PrismaModule } from "../database/prisma.module";
import { PrismaService } from "../database/prisma.service";
import { validateUploadedFile } from "../modules/documents/file-type-validation";
import { ClinicalFileStorageService } from "../modules/storage/clinical-file-storage.service";
import { StorageModule } from "../modules/storage/storage.module";

type BackfillSummary = {
  inspected: number;
  eligible: number;
  migrated: number;
  metadataOnly: number;
  missingLegacyFile: number;
  failed: number;
  dryRun: boolean;
};

const DEFAULT_LEGACY_STORAGE_ROOT = resolve(__dirname, "../../storage");

class ClinicalFileBackfill {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClinicalFileStorageService) private readonly storage: ClinicalFileStorageService
  ) {}

  async run(options: { apply: boolean; batchSize: number; limit?: number }): Promise<BackfillSummary> {
    const summary: BackfillSummary = {
      inspected: 0,
      eligible: 0,
      migrated: 0,
      metadataOnly: 0,
      missingLegacyFile: 0,
      failed: 0,
      dryRun: !options.apply
    };
    let cursor: string | undefined;

    while (options.limit === undefined || summary.inspected < options.limit) {
      const remaining = options.limit === undefined ? options.batchSize : options.limit - summary.inspected;
      const files = await this.prisma.fileAttachment.findMany({
        where: {
          storageKey: null,
          deletedAt: null,
          OR: [{ patientId: { not: null } }, { userId: { not: null } }]
        },
        select: {
          id: true,
          organizationId: true,
          patientId: true,
          userId: true,
          fileName: true,
          originalName: true,
          mimeType: true,
          size: true,
          url: true
        },
        orderBy: { id: "asc" },
        take: Math.min(options.batchSize, remaining),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      });
      if (files.length === 0) break;

      for (const file of files) {
        cursor = file.id;
        summary.inspected += 1;
        if (!this.isManagedBinary(file)) {
          summary.metadataOnly += 1;
          continue;
        }
        const legacyPath = this.resolveLegacyPath(file);
        if (!legacyPath || !(await this.isFile(legacyPath))) {
          summary.missingLegacyFile += 1;
          continue;
        }
        summary.eligible += 1;
        if (!options.apply) continue;

        try {
          const buffer = await readFile(legacyPath);
          const validation = validateUploadedFile({
            originalname: file.originalName,
            mimetype: file.mimeType,
            size: file.size,
            buffer
          });
          if (!validation.ok) throw new Error(`legacy_validation_${validation.code}`);
          const owner = file.patientId ? `patients/${file.patientId}` : `users/${file.userId}`;
          const stored = await this.storage.store({
            key: `${file.organizationId}/${owner}/${file.id}.enc`,
            buffer,
            mimeType: validation.mimeType
          });
          await this.storage.read(stored);
          const updated = await this.prisma.fileAttachment.updateMany({
            where: { id: file.id, organizationId: file.organizationId, storageKey: null },
            data: { ...stored, detectedMimeType: validation.mimeType }
          });
          if (updated.count !== 1) {
            await this.storage.discard(stored.storageKey);
            continue;
          }
          summary.migrated += 1;
        } catch {
          summary.failed += 1;
        }
      }
    }
    return summary;
  }

  private resolveLegacyPath(file: { organizationId: string; patientId: string | null; userId: string | null; fileName: string }) {
    const root = resolve(process.env.LEGACY_STORAGE_ROOT?.trim() || DEFAULT_LEGACY_STORAGE_ROOT);
    const ownerPath = file.patientId
      ? ["patient-files", file.organizationId, file.patientId]
      : file.userId
        ? ["user-files", file.organizationId, file.userId]
        : null;
    if (!ownerPath) return null;
    const directory = resolve(root, ...ownerPath);
    const target = resolve(directory, file.fileName);
    const segment = relative(directory, target);
    if (!segment || segment.startsWith("..") || isAbsolute(segment)) return null;
    return target;
  }

  private isManagedBinary(file: { id: string; patientId: string | null; userId: string | null; url: string }) {
    if (file.patientId && file.url === `/patients/${file.patientId}/files/${file.id}/content`) return true;
    return Boolean(file.userId && file.url === `/users/${file.userId}/files/${file.id}/content`);
  }

  private async isFile(path: string) {
    const metadata = await stat(path).catch(() => null);
    return metadata?.isFile() ?? false;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment
    }),
    PrismaModule,
    StorageModule
  ],
  providers: [ClinicalFileBackfill]
})
class BackfillModule {}

function numericOption(name: string) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

async function main() {
  const context = await NestFactory.createApplicationContext(BackfillModule, { logger: ["error", "warn"] });
  try {
    const summary = await context.get(ClinicalFileBackfill).run({
      apply: process.argv.includes("--apply"),
      batchSize: numericOption("batch-size") ?? 100,
      limit: numericOption("limit")
    });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
