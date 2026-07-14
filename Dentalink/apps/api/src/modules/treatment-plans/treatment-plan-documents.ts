import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export const TREATMENT_PLAN_DOCUMENT_TYPES = [
  "BUDGET_COMPLETE",
  "BUDGET_TOTAL_ONLY",
  "BUDGET_NO_DETAIL",
  "CARE_PLAN",
  "SECTIONS",
  "ODONTOGRAM",
  "CLINICAL_HISTORY"
] as const;

export type TreatmentPlanDocumentType = (typeof TREATMENT_PLAN_DOCUMENT_TYPES)[number];

export type TreatmentPlanDocumentItem = {
  id: string;
  status: string;
  procedureCode: string;
  procedureName: string;
  sectionName?: string | null;
  toothLabel: string;
  surfaceLabel: string;
  quantity: number;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  plannedAt?: Date | null;
  completedAt?: Date | null;
  notes?: string | null;
};

export type TreatmentPlanDocumentInput = {
  documentType: TreatmentPlanDocumentType;
  planId: string;
  planNumber: string;
  planName: string;
  status: string;
  generatedAt: Date;
  printedAt: Date;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  patient: {
    id: string;
    name: string;
    documentNumber: string;
    birthDate?: Date | null;
    email?: string | null;
    phone?: string | null;
    occupation?: string | null;
    gender?: string | null;
    createdAt?: Date | null;
  };
  professional: {
    name: string;
    specialty: string;
    licenseNumber: string;
  };
  branchName: string;
  agreementName: string;
  items: TreatmentPlanDocumentItem[];
  clinicalEvolutions: Array<{
    createdAt: Date;
    professionalName: string;
    summary: string;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    balance: number;
  };
};

type PdfContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  pageNumber: number;
  totalPages: number;
  input: TreatmentPlanDocumentInput;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 42;
const TOP_Y = 806;
const FOOTER_Y = 42;
const ROW_HEIGHT = 18;

const TITLE_BY_TYPE: Record<TreatmentPlanDocumentType, string> = {
  BUDGET_COMPLETE: "Presupuesto",
  BUDGET_TOTAL_ONLY: "Presupuesto",
  BUDGET_NO_DETAIL: "Presupuesto",
  CARE_PLAN: "Plan de Atencion",
  SECTIONS: "Secciones",
  ODONTOGRAM: "Odontograma",
  CLINICAL_HISTORY: "Historia Clinica"
};

const FILE_BY_TYPE: Record<TreatmentPlanDocumentType, string> = {
  BUDGET_COMPLETE: "presupuesto-completo",
  BUDGET_TOTAL_ONLY: "presupuesto-solo-total",
  BUDGET_NO_DETAIL: "presupuesto-sin-detalle",
  CARE_PLAN: "plan-de-atencion",
  SECTIONS: "secciones",
  ODONTOGRAM: "odontograma",
  CLINICAL_HISTORY: "historial-clinico"
};

export async function buildTreatmentPlanDocumentPdf(input: TreatmentPlanDocumentInput) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfContext = {
    pdfDoc,
    page: pdfDoc.addPage([A4.width, A4.height]),
    regular,
    bold,
    y: TOP_Y,
    pageNumber: 1,
    totalPages: 1,
    input
  };

  drawHeader(ctx);

  if (input.documentType === "CLINICAL_HISTORY") drawClinicalHistory(ctx);
  else if (input.documentType === "ODONTOGRAM") drawOdontogram(ctx);
  else drawPlanDocument(ctx);

  drawSignature(ctx);
  drawAllFooters(ctx);

  const bytes = await pdfDoc.save();
  const fileName = `${FILE_BY_TYPE[input.documentType]}-${input.planNumber}.pdf`;
  return {
    fileName,
    mimeType: "application/pdf",
    base64: Buffer.from(bytes).toString("base64")
  };
}

function drawHeader(ctx: PdfContext) {
  const { input } = ctx;
  drawText(ctx, "DENTAL +", MARGIN_X, ctx.y, 18, true);
  drawText(
    ctx,
    `Dr(a). ${input.professional.name}, Esp. ${input.professional.specialty}, Cedula Profesional: ${input.professional.licenseNumber}`,
    MARGIN_X,
    ctx.y - 22,
    9
  );
  drawText(ctx, `PDT.: no ${input.planNumber} ${input.planName}`, MARGIN_X, ctx.y - 40, 10, true);
  drawText(
    ctx,
    `Generado: ${formatDate(input.generatedAt)}, Impreso: ${formatDate(input.printedAt)}`,
    MARGIN_X,
    ctx.y - 56,
    9
  );
  drawText(ctx, `ID: ${input.patient.id}`, MARGIN_X, ctx.y - 72, 9);
  ctx.y -= 96;

  if (input.documentType !== "CLINICAL_HISTORY") {
    drawText(ctx, `${TITLE_BY_TYPE[input.documentType]} no ${input.planNumber}:`, MARGIN_X, ctx.y, 12, true);
    drawText(ctx, input.planName, MARGIN_X, ctx.y - 16, 10);
    ctx.y -= 38;
  }

  drawText(ctx, "Paciente:", MARGIN_X, ctx.y, 10, true);
  drawText(ctx, `Nombre: ${input.patient.name}`, MARGIN_X, ctx.y - 16, 9);
  drawText(ctx, `Fecha de Nacimiento: ${formatDate(input.patient.birthDate)}`, 330, ctx.y - 16, 9);
  drawText(ctx, `CURP/RFC: ${input.patient.documentNumber || "No definido"}`, MARGIN_X, ctx.y - 32, 9);
  drawText(ctx, `Convenio: ${input.agreementName}`, 250, ctx.y - 32, 9);
  ctx.y -= 58;
}

function drawPlanDocument(ctx: PdfContext) {
  const { input } = ctx;
  const tableTitle =
    input.documentType === "CARE_PLAN" ? "Plan de Tratamiento:" : "Detalle del Presupuesto:";
  drawText(ctx, tableTitle, MARGIN_X, ctx.y, 11, true);
  ctx.y -= 18;

  if (input.documentType === "SECTIONS") {
    drawSectionTable(ctx);
  } else {
    const showPrices = input.documentType === "BUDGET_COMPLETE";
    const columns = showPrices
      ? [
          { label: "Estado", x: MARGIN_X, width: 58 },
          { label: "Procedimientos Clinicos", x: 104, width: 242 },
          { label: "Pieza(s)", x: 348, width: 56 },
          { label: "Subtotal", x: 405, width: 52 },
          { label: "Dcto.", x: 463, width: 42 },
          { label: "Total", x: 512, width: 42 }
        ]
      : [
          { label: "Estado", x: MARGIN_X, width: 68 },
          { label: "Procedimientos Clinicos", x: 116, width: 315 },
          { label: "Pieza(s)", x: 440, width: 92 }
        ];
    drawTableHeader(ctx, columns);
    for (const item of input.items) {
      const row = showPrices
        ? [
            item.status,
            procedureLabel(item),
            item.toothLabel,
            money(item.subtotal),
            discountLabel(item),
            money(item.total)
          ]
        : [item.status, procedureLabel(item), item.toothLabel];
      drawTableRow(ctx, columns, row);
    }
  }

  if (input.documentType === "BUDGET_COMPLETE") {
    ensureSpace(ctx, 126);
    ctx.y -= 10;
    drawText(ctx, "Resumen del Presupuesto:", MARGIN_X, ctx.y, 11, true);
    ctx.y -= 18;
    drawKeyValue(ctx, "Procedimientos Clinicos", money(input.totals.subtotal));
    drawKeyValue(ctx, "Subtotal", money(input.totals.subtotal));
    drawKeyValue(ctx, "Descuento total (-)", money(input.totals.discount));
    drawKeyValue(ctx, "Total del presupuesto", money(input.totals.total), true);
    drawAccountStatus(ctx);
  } else if (input.documentType === "BUDGET_TOTAL_ONLY") {
    drawAccountStatus(ctx);
  }
}

function drawSectionTable(ctx: PdfContext) {
  const columns = [
    { label: "Seccion", x: MARGIN_X, width: 120 },
    { label: "Procedimiento", x: 168, width: 240 },
    { label: "Pieza", x: 412, width: 48 },
    { label: "Estado", x: 462, width: 62 },
    { label: "Total", x: 525, width: 44 }
  ];
  drawTableHeader(ctx, columns);
  for (const item of ctx.input.items) {
    drawTableRow(ctx, columns, [
      item.sectionName || "Sin seccion",
      procedureLabel(item),
      item.toothLabel,
      item.status,
      money(item.total)
    ]);
  }
}

function drawAccountStatus(ctx: PdfContext) {
  ensureSpace(ctx, 82);
  ctx.y -= 18;
  drawText(ctx, "Estado de cuenta:", MARGIN_X, ctx.y, 11, true);
  ctx.y -= 18;
  drawKeyValue(ctx, "Total del presupuesto", money(ctx.input.totals.total));
  drawKeyValue(ctx, "Abonos del paciente (-)", money(ctx.input.totals.paid));
  drawKeyValue(ctx, "Total por pagar", money(ctx.input.totals.balance), true);
}

function drawOdontogram(ctx: PdfContext) {
  const permanentTop = ["1.8", "1.7", "1.6", "1.5", "1.4", "1.3", "1.2", "1.1", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"];
  const permanentBottom = ["4.8", "4.7", "4.6", "4.5", "4.4", "4.3", "4.2", "4.1", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"];
  drawText(ctx, "Odontograma", MARGIN_X, ctx.y, 14, true);
  ctx.y -= 30;
  drawToothRow(ctx, permanentTop);
  ctx.y -= 34;
  drawToothRow(ctx, permanentBottom);
  ctx.y -= 42;
  drawText(ctx, "Sextante 1      Sextante 2      Sextante 3      Sextante 4      Sextante 5      Sextante 6      Arcada Superior      Arcada Inferior", MARGIN_X, ctx.y, 8);
  ctx.y -= 28;

  const columns = [
    { label: "Fecha", x: MARGIN_X, width: 76 },
    { label: "Pieza", x: 122, width: 52 },
    { label: "Caras", x: 178, width: 92 },
    { label: "Estado", x: 274, width: 180 },
    { label: "Creador", x: 458, width: 74 }
  ];
  drawTableHeader(ctx, columns);
  const odontogramItems = ctx.input.items.filter((item) => item.toothLabel !== "-");
  for (const item of odontogramItems) {
    drawTableRow(ctx, columns, [
      formatDate(item.completedAt ?? item.plannedAt ?? ctx.input.printedAt),
      item.toothLabel,
      item.surfaceLabel || "-",
      item.procedureName,
      ctx.input.professional.name
    ]);
  }
  if (!odontogramItems.length) {
    drawText(ctx, "No hay procedimientos con pieza dental vinculada a este plan.", MARGIN_X, ctx.y, 9);
    ctx.y -= ROW_HEIGHT;
  }
}

function drawClinicalHistory(ctx: PdfContext) {
  const { input } = ctx;
  drawText(ctx, "Historia Clinica", MARGIN_X, ctx.y, 16, true);
  ctx.y -= 28;
  drawText(ctx, input.patient.name, MARGIN_X, ctx.y, 12, true);
  ctx.y -= 22;
  drawKeyValue(ctx, "ID", input.patient.id);
  drawKeyValue(ctx, "Telefono", input.patient.phone || "-");
  drawKeyValue(ctx, "Telefono movil", input.patient.phone || "-");
  drawKeyValue(ctx, "Email", input.patient.email || "-");
  drawKeyValue(ctx, "Actividad / Profesion", input.patient.occupation || "-");
  drawKeyValue(ctx, "Fecha de creacion", formatDate(input.patient.createdAt));
  ctx.y -= 16;
  drawText(ctx, "Procedimientos del plan", MARGIN_X, ctx.y, 11, true);
  ctx.y -= 18;
  drawSectionTable(ctx);
  ensureSpace(ctx, 76);
  ctx.y -= 12;
  drawText(ctx, "Evoluciones clinicas", MARGIN_X, ctx.y, 11, true);
  ctx.y -= 18;
  for (const evolution of input.clinicalEvolutions) {
    ensureSpace(ctx, 46);
    drawText(ctx, `${formatDate(evolution.createdAt)} - ${evolution.professionalName}`, MARGIN_X, ctx.y, 9, true);
    ctx.y -= 14;
    for (const line of wrapText(ctx.regular, evolution.summary || "-", 9, 500)) {
      drawText(ctx, line, MARGIN_X + 12, ctx.y, 9);
      ctx.y -= 12;
    }
    ctx.y -= 4;
  }
  if (!input.clinicalEvolutions.length) {
    drawText(ctx, "No hay evoluciones clinicas vinculadas a este plan.", MARGIN_X, ctx.y, 9);
    ctx.y -= ROW_HEIGHT;
  }
}

function drawSignature(ctx: PdfContext) {
  ensureSpace(ctx, 110);
  ctx.y -= 48;
  drawLine(ctx, MARGIN_X, ctx.y, 226, ctx.y);
  drawLine(ctx, 330, ctx.y, 552, ctx.y);
  drawText(ctx, `Dr(a). ${ctx.input.professional.name}`, MARGIN_X, ctx.y - 16, 9);
  drawText(ctx, "Firma Paciente y/o Apoderado", 368, ctx.y - 16, 9);
  ctx.y -= 40;
}

function drawAllFooters(ctx: PdfContext) {
  const pages = ctx.pdfDoc.getPages();
  for (const [index, page] of pages.entries()) {
    drawFooter(ctx, page, index + 1, pages.length);
  }
}

function drawFooter(ctx: PdfContext, page: PDFPage, pageNumber: number, totalPages: number) {
  const previousPage = ctx.page;
  ctx.page = page;
  drawLine(ctx, MARGIN_X, FOOTER_Y + 36, 552, FOOTER_Y + 36);
  drawText(ctx, ctx.input.clinicName, MARGIN_X, FOOTER_Y + 22, 10, true);
  drawText(ctx, [ctx.input.clinicAddress, ctx.input.clinicPhone].filter(Boolean).join(" "), MARGIN_X, FOOTER_Y + 8, 8);
  drawText(ctx, "Documento generado por DentalSuite", 330, FOOTER_Y + 8, 8);
  drawText(ctx, `Pagina ${pageNumber} / ${totalPages}`, 498, FOOTER_Y - 6, 8);
  ctx.page = previousPage;
}

function drawToothRow(ctx: PdfContext, teeth: string[]) {
  const startX = MARGIN_X;
  const gap = 31;
  teeth.forEach((tooth, index) => {
    const x = startX + index * gap;
    drawRect(ctx, x, ctx.y - 16, 24, 24, false);
    drawText(ctx, tooth, x + 4, ctx.y - 30, 7);
  });
}

function drawTableHeader(
  ctx: PdfContext,
  columns: Array<{ label: string; x: number; width: number }>
) {
  ensureSpace(ctx, ROW_HEIGHT * 2);
  drawRect(ctx, MARGIN_X, ctx.y - 5, 512, 20, true, 0.94);
  for (const column of columns) {
    drawText(ctx, column.label, column.x, ctx.y, 8, true);
  }
  ctx.y -= 23;
}

function drawTableRow(
  ctx: PdfContext,
  columns: Array<{ label: string; x: number; width: number }>,
  values: string[]
) {
  const wrapped = values.map((value, index) =>
    wrapText(ctx.regular, value || "-", 8, columns[index].width)
  );
  const height = Math.max(ROW_HEIGHT, Math.max(...wrapped.map((lines) => lines.length)) * 10 + 8);
  ensureSpace(ctx, height + 4);
  drawLine(ctx, MARGIN_X, ctx.y + 6, 552, ctx.y + 6, 0.85);
  for (const [columnIndex, column] of columns.entries()) {
    wrapped[columnIndex].slice(0, 4).forEach((line, lineIndex) => {
      drawText(ctx, line, column.x, ctx.y - lineIndex * 10, 8);
    });
  }
  ctx.y -= height;
}

function drawKeyValue(ctx: PdfContext, label: string, value: string, bold = false) {
  ensureSpace(ctx, ROW_HEIGHT);
  drawText(ctx, label, MARGIN_X + 16, ctx.y, 9, bold);
  drawText(ctx, value, 430, ctx.y, 9, bold);
  ctx.y -= 16;
}

function ensureSpace(ctx: PdfContext, height: number) {
  if (ctx.y - height > FOOTER_Y + 60) return;
  ctx.page = ctx.pdfDoc.addPage([A4.width, A4.height]);
  ctx.pageNumber += 1;
  ctx.totalPages = ctx.pageNumber;
  ctx.y = TOP_Y;
  drawHeader(ctx);
}

function drawText(ctx: PdfContext, text: string, x: number, y: number, size: number, bold = false) {
  ctx.page.drawText(cleanText(text), {
    x,
    y,
    size,
    font: bold ? ctx.bold : ctx.regular,
    color: rgb(0.05, 0.13, 0.24)
  });
}

function drawLine(ctx: PdfContext, startX: number, startY: number, endX: number, endY: number, shade = 0.75) {
  ctx.page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness: 0.6,
    color: rgb(shade, shade, shade)
  });
}

function drawRect(ctx: PdfContext, x: number, y: number, width: number, height: number, fill = false, shade = 1) {
  ctx.page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.78, 0.82, 0.88),
    borderWidth: 0.5,
    color: fill ? rgb(shade, shade, shade) : undefined
  });
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function procedureLabel(item: TreatmentPlanDocumentItem) {
  return `[${item.procedureCode}] - ${item.procedureName}`;
}

function discountLabel(item: TreatmentPlanDocumentItem) {
  if (!item.subtotal) return "0%";
  return `${Math.round((item.discount / item.subtotal) * 100)}%`;
}

function money(value: number) {
  return `$${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function formatDate(value?: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeZone: "UTC" }).format(value);
}

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
