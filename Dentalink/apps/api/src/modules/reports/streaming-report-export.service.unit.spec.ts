import "reflect-metadata";
import { readFile, stat } from "node:fs/promises";
import { unzipSync } from "fflate";
import { ReportExportFormat } from "./dto/reports.dto";
import type { ReportRow } from "./report-provider";
import { StreamingReportExportService } from "./streaming-report-export.service";

async function* rows(count: number): AsyncGenerator<ReportRow> {
  for (let index = 1; index <= count; index += 1) {
    yield { id: `patient-${index}`, name: index === 1 ? "=FORMULA()" : `Patient ${index}`, amount: index };
  }
}

describe("StreamingReportExportService", () => {
  const service = new StreamingReportExportService();

  it("exports more than 50k CSV rows completely and reports incremental progress", async () => {
    const progress: number[] = [];
    const generated = await service.create({
      rows: rows(50_001),
      format: ReportExportFormat.CSV,
      baseFileName: "large-patient-report",
      sheetName: "Patients",
      onProgress: async (count) => { progress.push(count); }
    });
    try {
      const csv = await readFile(generated.path, "utf8");
      expect(generated.rowCount).toBe(50_001);
      expect(csv.split("\n")).toHaveLength(50_003);
      expect(csv).toContain("patient-50001,Patient 50001,50001");
      expect(csv).toContain("'=FORMULA()");
      expect(progress).toEqual([5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000]);
    } finally {
      await generated.cleanup();
    }
    await expect(stat(generated.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates a valid streaming XLSX archive without retaining a row array", async () => {
    const generated = await service.create({
      rows: rows(3),
      format: ReportExportFormat.XLSX,
      baseFileName: "patient-report",
      sheetName: "Patients",
    });
    try {
      const archive = unzipSync(await readFile(generated.path));
      const worksheet = Buffer.from(archive["xl/worksheets/sheet1.xml"]).toString("utf8");
      expect(generated.rowCount).toBe(3);
      expect(Object.keys(archive)).toEqual(expect.arrayContaining([
        "[Content_Types].xml",
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml"
      ]));
      expect(worksheet).toContain('autoFilter ref="A1:C4"');
      expect(worksheet).toContain("patient-3");
    } finally {
      await generated.cleanup();
    }
  });
});
