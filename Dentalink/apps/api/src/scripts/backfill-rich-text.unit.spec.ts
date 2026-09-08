import { createHash } from "node:crypto";
import { RichTextBackfill } from "./backfill-rich-text";

describe("RichTextBackfill", () => {
  it("backs up original HTML and updates through compare-and-swap", async () => {
    const original = '<p onclick="steal()">Texto</p><script>alert(1)</script>';
    const tx = {
      emailTemplate: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      surveyVersion: { updateMany: jest.fn() },
      richTextSanitizationBackup: { createMany: jest.fn().mockResolvedValue({ count: 1 }) }
    };
    const prisma = {
      emailTemplate: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: "template-1", organizationId: "org-1", html: original }])
          .mockResolvedValueOnce([])
      },
      surveyVersion: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    };

    const result = await new RichTextBackfill(prisma as never).run(true);

    expect(result).toEqual({ inspected: 1, changed: 1, backups: 1, dryRun: false });
    expect(tx.emailTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: "template-1", html: original },
      data: { html: "<p>Texto</p>" }
    });
    expect(tx.richTextSanitizationBackup.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        entityType: "EmailTemplate",
        entityId: "template-1",
        originalContent: original,
        originalChecksum: createHash("sha256").update(original).digest("hex"),
        sanitizedChecksum: createHash("sha256").update("<p>Texto</p>").digest("hex")
      })],
      skipDuplicates: true
    });
  });

  it("does not create a stale backup when a concurrent edit wins the CAS", async () => {
    const tx = {
      emailTemplate: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      surveyVersion: { updateMany: jest.fn() },
      richTextSanitizationBackup: { createMany: jest.fn() }
    };
    const prisma = {
      emailTemplate: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: "template-1", organizationId: "org-1", html: "<script>x()</script><p>A</p>" }])
          .mockResolvedValueOnce([])
      },
      surveyVersion: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    };

    const result = await new RichTextBackfill(prisma as never).run(true);

    expect(result).toMatchObject({ changed: 1, backups: 0 });
    expect(tx.richTextSanitizationBackup.createMany).not.toHaveBeenCalled();
  });
});
