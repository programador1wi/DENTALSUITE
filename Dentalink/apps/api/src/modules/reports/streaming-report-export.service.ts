import { BadRequestException, Injectable } from "@nestjs/common";
import { strToU8, Zip, ZipDeflate } from "fflate";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { once } from "node:events";
import { ReportExportFormat } from "./dto/reports.dto";
import { ReportRow } from "./report-provider";

export type StreamingReportFile = {
  path: string;
  fileName: string;
  mimeType: string;
  rowCount: number;
  cleanup(): Promise<void>;
};

@Injectable()
export class StreamingReportExportService {
  async create(input: {
    rows: AsyncIterable<ReportRow>;
    format: ReportExportFormat;
    baseFileName: string;
    sheetName: string;
    onProgress?: (rows: number) => Promise<void>;
  }): Promise<StreamingReportFile> {
    if (input.format !== ReportExportFormat.CSV && input.format !== ReportExportFormat.XLSX) {
      throw new BadRequestException("Formato de exportacion no soportado por el worker");
    }
    const root = await mkdtemp(join(tmpdir(), "dentalink-report-"));
    const extension = input.format === ReportExportFormat.CSV ? "csv" : "xlsx";
    const path = join(root, `${this.safeFileName(input.baseFileName)}.${extension}`);
    try {
      const rowCount = input.format === ReportExportFormat.CSV
        ? await this.writeCsv(path, input.rows, input.onProgress)
        : await this.writeXlsx(path, input.rows, input.sheetName, input.onProgress);
      return {
        path,
        fileName: basename(path),
        mimeType: input.format === ReportExportFormat.CSV
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        rowCount,
        cleanup: () => rm(root, { recursive: true, force: true })
      };
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  }

  private async writeCsv(path: string, rows: AsyncIterable<ReportRow>, onProgress?: (rows: number) => Promise<void>) {
    const output = createWriteStream(path, { flags: "wx" });
    const iterator = rows[Symbol.asyncIterator]();
    let count = 0;
    try {
      await this.write(output, "\uFEFF");
      const first = await iterator.next();
      if (first.done) return 0;
      const headers = Object.keys(first.value);
      await this.write(output, `${headers.map((value) => this.csv(value)).join(",")}\n`);
      let current: IteratorResult<ReportRow> = first;
      while (!current.done) {
        await this.write(output, `${headers.map((header) => this.csv(current.value[header])).join(",")}\n`);
        count += 1;
        if (onProgress && count % 5_000 === 0) await onProgress(count);
        current = await iterator.next();
      }
      return count;
    } finally {
      output.end();
      if (!output.closed) await once(output, "close");
    }
  }

  private async writeXlsx(
    path: string,
    rows: AsyncIterable<ReportRow>,
    sheetName: string,
    onProgress?: (rows: number) => Promise<void>
  ) {
    const output = createWriteStream(path, { flags: "wx" });
    let pendingDrain: Promise<unknown> | undefined;
    let completionError: unknown;
    const completed = new Promise<void>((resolve, reject) => {
      output.once("finish", resolve);
      output.once("error", reject);
    });
    const zip = new Zip((error, data, final) => {
      if (error) {
        completionError = error;
        output.destroy(error);
        return;
      }
      if (data?.length && !output.write(data)) pendingDrain = once(output, "drain");
      if (final) output.end();
    });
    const pushEntry = async (name: string, chunks: AsyncIterable<string> | string) => {
      const entry = new ZipDeflate(name, { level: 6 });
      zip.add(entry);
      const source = typeof chunks === "string" ? this.one(chunks) : chunks;
      for await (const chunk of source) {
        if (pendingDrain) {
          await pendingDrain;
          pendingDrain = undefined;
        }
        entry.push(strToU8(chunk));
      }
      entry.push(new Uint8Array(), true);
    };

    try {
      const cleanName = this.sheetName(sheetName);
      const statics = this.xlsxStaticFiles(cleanName);
      for (const [name, value] of Object.entries(statics)) await pushEntry(name, value);
      const { chunks, result } = this.worksheet(rows, onProgress);
      await pushEntry("xl/worksheets/sheet1.xml", chunks);
      zip.end();
      await completed;
      if (completionError) throw completionError;
      return await result;
    } catch (error) {
      zip.terminate();
      output.destroy();
      throw error;
    }
  }

  private worksheet(rows: AsyncIterable<ReportRow>, onProgress?: (rows: number) => Promise<void>) {
    let resolveCount!: (value: number) => void;
    let rejectCount!: (reason: unknown) => void;
    const result = new Promise<number>((resolve, reject) => {
      resolveCount = resolve;
      rejectCount = reject;
    });
    const chunks = (async function* (self: StreamingReportExportService) {
      try {
        const iterator = rows[Symbol.asyncIterator]();
        const first = await iterator.next();
        const headers = first.done ? [] : Object.keys(first.value);
        const lastColumn = self.columnName(Math.max(1, headers.length));
        yield `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" tabSelected="1">${headers.length ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${headers.length ? `<cols>${headers.map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="20" customWidth="1"/>`).join("")}</cols>` : ""}<sheetData>`;
        if (headers.length) {
          yield `<row r="1" ht="23" customHeight="1">${headers.map((value, index) => self.cell(value, index + 1, 1, 1)).join("")}</row>`;
        }
        let count = 0;
        let current: IteratorResult<ReportRow> = first;
        while (!current.done) {
          if (count >= 1_048_575) {
            throw new BadRequestException(
              "LIMIT_EXCEEDED: El reporte supera el límite de 1,048,575 filas de Excel. Exporta en formato CSV."
            );
          }
          const rowNumber = count + 2;
          yield `<row r="${rowNumber}">${headers.map((header, index) => self.cell(current.value[header], index + 1, rowNumber, count % 2 ? 3 : 2)).join("")}</row>`;
          count += 1;
          if (onProgress && count % 5_000 === 0) await onProgress(count);
          current = await iterator.next();
        }
        yield `</sheetData>${headers.length ? `<autoFilter ref="A1:${lastColumn}${count + 1}"/>` : ""}</worksheet>`;
        resolveCount(count);
      } catch (error) {
        rejectCount(error);
        throw error;
      }
    })(this);
    return { chunks, result };
  }

  private xlsxStaticFiles(sheetName: string) {
    const now = new Date().toISOString();
    return {
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
      "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Dentalink</Application><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${this.xml(sheetName)}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`,
      "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Dentalink</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${this.xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><color rgb="FF334155"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F7F9"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    };
  }

  private cell(value: unknown, column: number, row: number, style: number) {
    const ref = `${this.columnName(column)}${row}`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    if (typeof value === "boolean") return `<c r="${ref}" t="b" s="${style}"><v>${value ? 1 : 0}</v></c>`;
    const normalized = value instanceof Date ? value.toISOString() : String(value ?? "");
    return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${this.xml(normalized)}</t></is></c>`;
  }

  private csv(value: unknown) {
    const rawValue = String(value ?? "");
    const raw = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  }

  private async write(output: ReturnType<typeof createWriteStream>, value: string) {
    if (!output.write(value, "utf8")) await once(output, "drain");
  }

  private async *one(value: string) {
    yield value;
  }

  private columnName(column: number) {
    let value = column;
    let result = "";
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }

  private sheetName(name: string) {
    return (name.replace(/[\\/*?:[\]]/g, " ").trim() || "Reporte").slice(0, 31);
  }

  private safeFileName(value: string) {
    return (value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "report").slice(0, 100);
  }

  private xml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
}
