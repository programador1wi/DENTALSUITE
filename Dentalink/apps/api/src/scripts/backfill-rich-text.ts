import { Inject, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { createHash } from "node:crypto";
import { sanitizeRichTextHtml } from "../common/utils/sanitize-rich-text.util";
import { validateEnvironment } from "../config/environment.validation";
import { PrismaModule } from "../database/prisma.module";
import { PrismaService } from "../database/prisma.service";

type Summary = { inspected: number; changed: number; backups: number; dryRun: boolean };

export class RichTextBackfill {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(apply: boolean): Promise<Summary> {
    const summary: Summary = { inspected: 0, changed: 0, backups: 0, dryRun: !apply };
    await this.processEmailTemplates(apply, summary);
    await this.processSurveyVersions(apply, summary);
    return summary;
  }

  private async processEmailTemplates(apply: boolean, summary: Summary) {
    let cursor: string | undefined;
    while (true) {
      const rows = await this.prisma.emailTemplate.findMany({
        select: { id: true, organizationId: true, html: true },
        orderBy: { id: "asc" },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      });
      if (!rows.length) return;
      for (const row of rows) {
        cursor = row.id;
        await this.processField(apply, summary, {
          entityType: "EmailTemplate",
          entityId: row.id,
          organizationId: row.organizationId,
          fieldName: "html",
          original: row.html
        });
      }
    }
  }

  private async processSurveyVersions(apply: boolean, summary: Summary) {
    let cursor: string | undefined;
    while (true) {
      const rows = await this.prisma.surveyVersion.findMany({
        select: {
          id: true,
          emailHeaderHtml: true,
          emailFooterHtml: true,
          survey: { select: { organizationId: true } }
        },
        orderBy: { id: "asc" },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      });
      if (!rows.length) return;
      for (const row of rows) {
        cursor = row.id;
        for (const field of ["emailHeaderHtml", "emailFooterHtml"] as const) {
          await this.processField(apply, summary, {
            entityType: "SurveyVersion",
            entityId: row.id,
            organizationId: row.survey.organizationId,
            fieldName: field,
            original: row[field]
          });
        }
      }
    }
  }

  private async processField(
    apply: boolean,
    summary: Summary,
    input: {
      entityType: string;
      entityId: string;
      organizationId: string;
      fieldName: string;
      original: string;
    }
  ) {
    summary.inspected += 1;
    const sanitized = sanitizeRichTextHtml(input.original);
    if (sanitized === input.original) return;
    summary.changed += 1;
    if (!apply) return;

    const originalChecksum = this.checksum(input.original);
    const sanitizedChecksum = this.checksum(sanitized);
    const persisted = await this.prisma.$transaction(async (tx) => {
      const updated = input.entityType === "EmailTemplate"
        ? await tx.emailTemplate.updateMany({
            where: { id: input.entityId, html: input.original },
            data: { html: sanitized }
          })
        : input.fieldName === "emailHeaderHtml"
          ? await tx.surveyVersion.updateMany({
              where: { id: input.entityId, emailHeaderHtml: input.original },
              data: { emailHeaderHtml: sanitized }
            })
          : await tx.surveyVersion.updateMany({
              where: { id: input.entityId, emailFooterHtml: input.original },
              data: { emailFooterHtml: sanitized }
            });
      if (updated.count !== 1) return false;
      await tx.richTextSanitizationBackup.createMany({
        data: [{
          organizationId: input.organizationId,
          entityType: input.entityType,
          entityId: input.entityId,
          fieldName: input.fieldName,
          originalContent: input.original,
          originalChecksum,
          sanitizedChecksum
        }],
        skipDuplicates: true
      });
      return true;
    });
    if (persisted) summary.backups += 1;
  }

  private checksum(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"], validate: validateEnvironment }),
    PrismaModule
  ],
  providers: [RichTextBackfill]
})
class RichTextBackfillModule {}

async function main() {
  const context = await NestFactory.createApplicationContext(RichTextBackfillModule, { logger: ["error", "warn"] });
  try {
    const summary = await context.get(RichTextBackfill).run(process.argv.includes("--apply"));
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
