import { strToU8, zipSync } from "fflate";

export type XlsxCellValue = string | number | boolean | Date | null | undefined;

export type XlsxSheet = {
  name: string;
  rows: Array<Record<string, XlsxCellValue>>;
  columns?: string[];
  title?: string;
  subtitle?: string;
};

export function createXlsxWorkbook(sheets: XlsxSheet[]) {
  const normalizedSheets = sheets.length ? sheets : [{ name: "Reporte", rows: [] }];
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xmlFile(contentTypes(normalizedSheets.length)),
    "_rels/.rels": xmlFile(rootRelationships()),
    "docProps/app.xml": xmlFile(appProperties(normalizedSheets.map((sheet) => sheet.name))),
    "docProps/core.xml": xmlFile(coreProperties()),
    "xl/workbook.xml": xmlFile(workbookXml(normalizedSheets.map((sheet) => sheet.name))),
    "xl/_rels/workbook.xml.rels": xmlFile(workbookRelationships(normalizedSheets.length)),
    "xl/styles.xml": xmlFile(stylesXml())
  };

  normalizedSheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = xmlFile(worksheetXml(sheet, index === 0));
  });

  return Buffer.from(zipSync(files, { level: 6 }));
}

function worksheetXml(sheet: XlsxSheet, isActive: boolean) {
  const rows = sheet.rows;
  const headers = sheet.columns?.length ? sheet.columns : rows.length ? Object.keys(rows[0]) : [];
  const hasPresentationHeader = Boolean(sheet.title || sheet.subtitle);
  const headerRow = hasPresentationHeader ? 4 : 1;
  const lastColumn = columnName(Math.max(headers.length, 1));
  const naturalColumnWidths = headers.map((header) =>
    Math.min(48, Math.max(12, header.length + 2, ...rows.map((row) => String(row[header] ?? "").length + 2)))
  );
  const presentationWidth = hasPresentationHeader
    ? Math.min(96, Math.max(sheet.title?.length ?? 0, sheet.subtitle?.length ?? 0) + 4)
    : 0;
  const currentWidth = naturalColumnWidths.reduce((total, width) => total + width, 0);
  const extraWidthPerColumn = naturalColumnWidths.length
    ? Math.max(0, presentationWidth - currentWidth) / naturalColumnWidths.length
    : 0;
  const columnWidths = naturalColumnWidths.map((width) => Math.min(48, width + extraWidthPerColumn));
  const columns = columnWidths.length
    ? `<cols>${columnWidths
        .map(
          (width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
        )
        .join("")}</cols>`
    : "";
  const presentationRows = hasPresentationHeader
    ? [
        `<row r="1" ht="28" customHeight="1">${cellXml(sheet.title ?? sheet.name, "A", 1, 1)}</row>`,
        `<row r="2" ht="21" customHeight="1">${cellXml(sheet.subtitle ?? "Reporte generado por Dentalink", "A", 2, 2)}</row>`,
        '<row r="3" ht="8" customHeight="1"/>'
      ].join("")
    : "";
  const tableRows = headers.length
    ? [headers, ...rows.map((row) => headers.map((header) => row[header]))]
        .map((row, rowIndex) => {
          const excelRow = headerRow + rowIndex;
          const style = rowIndex === 0 ? 3 : rowIndex % 2 === 0 ? 5 : 4;
          const height = rowIndex === 0 ? ' ht="23" customHeight="1"' : "";
          return `<row r="${excelRow}"${height}>${row
            .map((value, columnIndex) => cellXml(value, columnName(columnIndex + 1), excelRow, style))
            .join("")}</row>`;
        })
        .join("")
    : "";
  const filter = headers.length
    ? `<autoFilter ref="A${headerRow}:${columnName(headers.length)}${headerRow + rows.length}"/>`
    : "";
  const selectedAttribute = isActive ? ' tabSelected="1"' : "";
  const frozenHeader = headers.length
    ? `<sheetViews><sheetView workbookViewId="0"${selectedAttribute}><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"${selectedAttribute}/></sheetViews>`;
  const mergedHeaders = hasPresentationHeader
    ? `<mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${frozenHeader}<sheetFormatPr defaultRowHeight="18"/>${columns}<sheetData>${presentationRows}${tableRows}</sheetData>${filter}${mergedHeaders}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>`;
}

function cellXml(value: XlsxCellValue, column: string, row: number, style: number) {
  const ref = `${column}${row}`;
  const styleAttribute = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${ref}"${styleAttribute}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" t="b"${styleAttribute}><v>${value ? 1 : 0}</v></c>`;
  const normalized = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXml(normalized)}</t></is></c>`;
}

function columnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function workbookXml(names: string[]) {
  const sheets = names
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(cleanSheetName(name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelationships(sheetCount: number) {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function rootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function contentTypes(sheetCount: number) {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheets}</Types>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><color rgb="FF334155"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Aptos Display"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FF155E75"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123B5D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F4F1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F7F9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7E0E7"/></left><right style="thin"><color rgb="FFD7E0E7"/></right><top style="thin"><color rgb="FFD7E0E7"/></top><bottom style="thin"><color rgb="FFD7E0E7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function coreProperties() {
  const createdAt = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Dentalink</dc:creator><cp:lastModifiedBy>Dentalink</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created></cp:coreProperties>`;
}

function appProperties(names: string[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Dentalink</Application><TitlesOfParts><vt:vector size="${names.length}" baseType="lpstr">${names.map((name, index) => `<vt:lpstr>${escapeXml(cleanSheetName(name, index))}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts></Properties>`;
}

function cleanSheetName(name: string, index: number) {
  const cleaned = name.replace(/[\\/*?:[\]]/g, " ").trim();
  return (cleaned || `Reporte ${index + 1}`).slice(0, 31);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlFile(value: string) {
  return strToU8(value);
}
