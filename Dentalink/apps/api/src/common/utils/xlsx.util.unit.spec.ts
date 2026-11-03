import { strFromU8, unzipSync } from "fflate";
import { createXlsxWorkbook } from "./xlsx.util";

describe("createXlsxWorkbook", () => {
  it("creates a formal workbook with presentation headers, filters and frozen table headers", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "Pacientes",
        title: "Pacientes tratados por un profesional",
        subtitle: "Clínica Demo · Email Marketing",
        rows: [
          { Paciente: "Ana López", Elegibilidad: "Elegible" },
          { Paciente: "Luis Pérez", Elegibilidad: "No elegible" }
        ]
      }
    ]);

    const files = unzipSync(new Uint8Array(workbook));
    const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const workbookDefinition = strFromU8(files["xl/workbook.xml"]);
    const styles = strFromU8(files["xl/styles.xml"]);

    expect(worksheet).toContain('mergeCell ref="A1:B1"');
    expect(worksheet).toContain('pane ySplit="4" topLeftCell="A5"');
    expect(worksheet).toContain('autoFilter ref="A4:B6"');
    expect(worksheet).toContain('tabSelected="1"');
    expect(worksheet).toContain("Pacientes tratados por un profesional");
    expect(worksheet).toContain('orientation="landscape"');
    expect(workbookDefinition).toContain('<workbookView activeTab="0"/>');
    expect(styles).toContain('fgColor rgb="FF123B5D"');
    expect(styles).toContain('fgColor rgb="FF0F766E"');
    expect(styles).toContain('wrapText="1"');
  });

  it("keeps column headers visible when a report has no result rows", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "Pacientes",
        title: "Detalle de pacientes",
        columns: ["ID paciente", "Nombre paciente", "Correo electrónico"],
        rows: []
      }
    ]);

    const files = unzipSync(new Uint8Array(workbook));
    const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"]);

    expect(worksheet).toContain("ID paciente");
    expect(worksheet).toContain("Nombre paciente");
    expect(worksheet).toContain("Correo electrónico");
    expect(worksheet).toContain('autoFilter ref="A4:C4"');
  });

  it("widens compact sheets so presentation subtitles are not clipped", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "Parámetros",
        title: "Parámetros aplicados",
        subtitle: "Pacientes tratados por un profesional · Todos los resultados",
        rows: [{ Parámetro: "Profesional", Valor: "TET TEST" }]
      }
    ]);

    const files = unzipSync(new Uint8Array(workbook));
    const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const widths = [...worksheet.matchAll(/<col [^>]*width="([\d.]+)"/g)].map((match) => Number(match[1]));

    expect(widths).toHaveLength(2);
    expect(widths.every((width) => width >= 30)).toBe(true);
  });
});
