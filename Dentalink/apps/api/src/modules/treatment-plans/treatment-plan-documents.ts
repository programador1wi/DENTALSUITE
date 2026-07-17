import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

export const TREATMENT_PLAN_DOCUMENT_TYPES = [
  "BUDGET_COMPLETE",
  "BUDGET_TOTAL_ONLY",
  "BUDGET_NO_DETAIL",
  "LAB_ORDER",
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

export type TreatmentPlanDocumentImage = {
  mimeType: "image/png" | "image/jpeg";
  base64: string;
};

export type TreatmentPlanDocumentOdontogramRecord = {
  id: string;
  createdAt: Date;
  toothNumber: string;
  toothLabel: string;
  surface?: string | null;
  surfaceLabel: string;
  condition: string;
  diagnosis?: string | null;
  odontogramSymbol?: string | null;
  status?: string | null;
  procedureCode?: string | null;
  procedureName?: string | null;
  professionalName: string;
};

export type TreatmentPlanDocumentOdontogram = {
  dentition: "permanent" | "temporal";
  recordedAt?: Date | null;
  records: TreatmentPlanDocumentOdontogramRecord[];
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
  logoImage?: TreatmentPlanDocumentImage | null;
  items: TreatmentPlanDocumentItem[];
  odontogram?: TreatmentPlanDocumentOdontogram | null;
  clinicalEvolutions: Array<{
    createdAt: Date;
    professionalName: string;
    summary: string;
  }>;
  labOrder?: {
    id: string;
    status: string;
    labProviderName: string;
    sentAt?: Date | null;
    expectedAt?: Date | null;
    receivedAt?: Date | null;
    notes?: string | null;
    items: Array<{
      toothNumber?: string | null;
      workType: string;
      material?: string | null;
      shade?: string | null;
      instructions?: string | null;
    }>;
  } | null;
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
  logoImage?: PDFImage | null;
  odontogramImage?: PDFImage | null;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 42;
const TOP_Y = 806;
const FOOTER_Y = 42;
const ROW_HEIGHT = 18;
const ODONTOGRAM_CANVAS = { width: 1177, height: 520 };
const PERMANENT_UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const PERMANENT_LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
const TEMPORAL_UPPER = ["55", "54", "53", "52", "51", "61", "62", "63", "64", "65"];
const TEMPORAL_LOWER = ["85", "84", "83", "82", "81", "71", "72", "73", "74", "75"];
const PERMANENT_FACE_OFFSETS = [0, 74, 146, 218, 290, 362, 434, 506, 578, 650, 722, 794, 866, 938, 1010, 1080];
const TEMPORAL_FACE_OFFSETS = [0, 72, 144, 215, 287, 359, 431, 503, 569, 642];
const FACE_START_X = 25;
const UPPER_FACE_Y = { permanent: 221, temporal: 220 } as const;
const LOWER_FACE_Y = { permanent: 320, temporal: 319 } as const;
const FACE_CENTER = 23.436;
const FACE_RADIUS = 11.34;
const FACE_PATHS = {
  1: "M23.436,0 C29.9076727,0 35.7666727,2.62316365 40.0077545,6.86424548 L31.4545909,15.4174091 C29.4024545,13.3652727 26.5674545,12.096 23.436,12.096 C20.3045455,12.096 17.4695455,13.3652727 15.4174091,15.4174091 L6.86424548,6.86424548 C11.1053273,2.62316365 16.9643273,0 23.436,0 Z",
  2: "M40.0077545,6.86424548 C44.2488363,11.1053273 46.872,16.9643273 46.872,23.436 C46.872,29.9076727 44.2488363,35.7666727 40.0077545,40.0077545 L31.4545909,31.4545909 C33.5067273,29.4024545 34.776,26.5674545 34.776,23.436 C34.776,20.3045455 33.5067273,17.4695455 31.4545909,15.4174091 L40.0077545,6.86424548 Z",
  3: "M23.436,34.776 C26.5674545,34.776 29.4024545,33.5067273 31.4545909,31.4545909 L40.0077545,40.0077545 C35.7666727,44.2488363 29.9076727,46.872 23.436,46.872 C16.9643273,46.872 11.1053273,44.2488363 6.86424548,40.0077545 L15.4174091,31.4545909 C17.4695455,33.5067273 20.3045455,34.776 23.436,34.776 Z",
  4: "M6.86424548,6.86424548 L15.4174091,15.4174091 C13.3652727,17.4695455 12.096,20.3045455 12.096,23.436 C12.096,26.5669527 13.3648659,29.4015459 15.4164226,31.4536042 L6.86424548,40.0077545 C2.62316365,35.7666727 0,29.9076727 0,23.436 C0,16.9643273 2.62316365,11.1053273 6.86424548,6.86424548 Z"
} as const;

const TITLE_BY_TYPE: Record<TreatmentPlanDocumentType, string> = {
  BUDGET_COMPLETE: "Presupuesto",
  BUDGET_TOTAL_ONLY: "Presupuesto",
  BUDGET_NO_DETAIL: "Presupuesto",
  LAB_ORDER: "Orden de Laboratorio",
  CARE_PLAN: "Plan de Atencion",
  SECTIONS: "Secciones",
  ODONTOGRAM: "Odontograma",
  CLINICAL_HISTORY: "Historia Clinica"
};

const FILE_BY_TYPE: Record<TreatmentPlanDocumentType, string> = {
  BUDGET_COMPLETE: "presupuesto-completo",
  BUDGET_TOTAL_ONLY: "presupuesto-solo-total",
  BUDGET_NO_DETAIL: "presupuesto-sin-detalle",
  LAB_ORDER: "orden-laboratorio",
  CARE_PLAN: "plan-de-atencion",
  SECTIONS: "secciones",
  ODONTOGRAM: "odontograma",
  CLINICAL_HISTORY: "historial-clinico"
};

const SEXTANTS_MANDIBLE_SVG = `
<g id="Sextantes-y-mandibula" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
  <g transform="translate(4 13)">
    <polyline stroke="#696969" fill-opacity="0" fill="#FFFFFF" points="17.6112943 0.876524039 43.6645289 40.463211 0.376352209 40.349731"/>
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="4.0725" y="57">Sextante 1</tspan></text>
  </g>
  <g transform="translate(62 11)">
    <polyline stroke="#696969" fill-opacity="0" fill="#FFFFFF" points="51.6474408 0.0688490704 26.8590625 41.8244076 0.0981713814 0.350636613"/>
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="6.0725" y="59">Sextante 2</tspan></text>
  </g>
  <g transform="translate(126 11)">
    <polyline stroke="#696969" fill-opacity="0" fill="#FFFFFF" points="49.2989849 41.8919856 0.482162084 42.4313346 27.1563493 0.530419615"/>
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="2.0725" y="59">Sextante 3</tspan></text>
  </g>
  <g transform="translate(188 14)">
    <polyline stroke="#696969" fill-opacity="0" fill="#FFFFFF" points="26.8499703 39.2872532 0.91021573 0.420973272 44.4393782 0.0805331191"/>
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="4.0725" y="56">Sextante 4</tspan></text>
  </g>
  <g transform="translate(249 10)">
    <polyline stroke="#696969" fill-opacity="0" fill="#FFFFFF" points="52.8330669 43.2120248 25.8452157 0.957919133 0.940807174 43.0118409"/>
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="3.0725" y="60">Sextante 5</tspan></text>
  </g>
  <g transform="translate(310 11)">
    <polyline stroke="#696969" fill-opacity="0" fill="#FFFFFF" points="23.0062379 41.992668 50.251644 0.914887508 0.490305146 0.914887508"/>
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="2.0725" y="59">Sextante 6</tspan></text>
  </g>
  <g transform="translate(373 17)">
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="0.9025" y="53">Arcada Superior</tspan></text>
    <path d="M11.0444715,0.581947803 C11.0444715,0.581947803 8.60160093,35.4803571 34.7907399,35.4803579 C60.9798788,35.4803586 59.5952551,0.692717568 59.5952551,0.692717568" stroke="#696969" stroke-width="5" fill-opacity="0" fill="#FFFFFF" transform="translate(35.296001, 18.031153) rotate(-180.000000) translate(-35.296001, -18.031153)"/>
  </g>
  <g transform="translate(460 17)">
    <text font-family="Helvetica" font-size="10" fill="#000000"><tspan x="0.3725" y="53">Arcada Inferior</tspan></text>
    <path d="M8.04447151,0.581947803 C8.04447151,0.581947803 5.60160093,35.4803571 31.7907399,35.4803579 C57.9798788,35.4803586 56.5952551,0.692717568 56.5952551,0.692717568" stroke="#696969" stroke-width="5" fill-opacity="0" fill="#FFFFFF"/>
  </g>
</g>`;

export async function buildTreatmentPlanDocumentPdf(input: TreatmentPlanDocumentInput) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = input.logoImage ? await embedDocumentImage(pdfDoc, input.logoImage) : null;
  const odontogramImage =
    input.documentType === "ODONTOGRAM"
      ? await renderOdontogramPng(input.odontogram ?? null).then((png) => pdfDoc.embedPng(png))
      : null;
  const ctx: PdfContext = {
    pdfDoc,
    page: pdfDoc.addPage([A4.width, A4.height]),
    regular,
    bold,
    y: TOP_Y,
    pageNumber: 1,
    totalPages: 1,
    input,
    logoImage,
    odontogramImage
  };

  drawHeader(ctx);

  if (input.documentType === "CLINICAL_HISTORY") drawClinicalHistory(ctx);
  else if (input.documentType === "ODONTOGRAM") drawOdontogram(ctx);
  else if (input.documentType === "LAB_ORDER") drawLabOrder(ctx);
  else drawPlanDocument(ctx);

  if (input.documentType !== "ODONTOGRAM") drawSignature(ctx);
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
  if (input.documentType === "ODONTOGRAM") {
    drawOdontogramHeader(ctx);
    return;
  }

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

function drawOdontogramHeader(ctx: PdfContext) {
  const { input } = ctx;
  if (ctx.logoImage) {
    drawImageContain(ctx, ctx.logoImage, 24, ctx.y + 8, 118, 42);
  } else {
    drawText(ctx, input.clinicName || "DENTAL +", 24, ctx.y, 14, true);
  }

  drawTextRight(ctx, input.clinicName || "DENTAL +", 552, ctx.y + 8, 12, true);
  drawTextRight(
    ctx,
    `Dr(a). ${input.professional.name}, Esp. ${input.professional.specialty}, Cedula Profesional: ${input.professional.licenseNumber}`,
    552,
    ctx.y - 4,
    6
  );
  drawTextRight(
    ctx,
    `Fecha de impresion: ${formatFullDate(input.printedAt)}, Fecha odontograma: ${formatFullDate(input.odontogram?.recordedAt ?? input.generatedAt)}`,
    552,
    ctx.y - 14,
    6
  );
  drawTextRight(ctx, `ID: ${input.patient.id}`, 552, ctx.y - 24, 6);

  ctx.y -= 76;
  drawTextCentered(ctx, "Odontograma", A4.width / 2, ctx.y, 13, true);
  ctx.y -= 28;
  drawText(ctx, "Paciente:", 24, ctx.y, 11, true);
  ctx.y -= 22;
  drawText(ctx, "Nombre:", 24, ctx.y, 7, true);
  drawWrappedText(ctx, input.patient.name, 80, ctx.y, 98, 7, 9, 2);
  drawText(ctx, "CURP:", 185, ctx.y, 7, true);
  drawText(ctx, input.patient.documentNumber || "-", 220, ctx.y, 7);
  drawText(ctx, "Nacimiento:", 346, ctx.y, 7, true);
  drawText(ctx, formatFullDate(input.patient.birthDate), 412, ctx.y, 7);
  ctx.y -= 25;
  drawText(ctx, "Convenio:", 24, ctx.y, 7, true);
  drawWrappedText(ctx, input.agreementName || "Sin convenio", 80, ctx.y, 98, 7, 9, 2);
  drawText(ctx, "Sexo:", 185, ctx.y, 7, true);
  drawText(ctx, input.patient.gender || "No ingresado", 220, ctx.y, 7);
  drawText(ctx, "Edad:", 346, ctx.y, 7, true);
  drawText(ctx, formatAge(input.patient.birthDate, input.printedAt), 412, ctx.y, 7);
  ctx.y -= 38;
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

function drawLabOrder(ctx: PdfContext) {
  const order = ctx.input.labOrder;
  drawText(ctx, "Orden de laboratorio", MARGIN_X, ctx.y, 14, true);
  ctx.y -= 24;
  if (!order) {
    drawText(ctx, "No hay una orden de laboratorio vinculada.", MARGIN_X, ctx.y, 9);
    ctx.y -= ROW_HEIGHT;
    return;
  }

  drawKeyValue(ctx, "Laboratorio", order.labProviderName);
  drawKeyValue(ctx, "Numero de orden", order.id);
  drawKeyValue(ctx, "Estado", order.status);
  drawKeyValue(ctx, "Fecha de envio", formatDate(order.sentAt));
  drawKeyValue(ctx, "Fecha requerida", formatDate(order.expectedAt));
  ctx.y -= 10;

  const columns = [
    { label: "Pieza", x: MARGIN_X, width: 54 },
    { label: "Trabajo", x: 104, width: 150 },
    { label: "Material", x: 260, width: 96 },
    { label: "Color", x: 360, width: 60 },
    { label: "Instrucciones", x: 424, width: 124 }
  ];
  drawTableHeader(ctx, columns);
  for (const item of order.items) {
    drawTableRow(ctx, columns, [
      item.toothNumber ? item.toothNumber : "-",
      item.workType,
      item.material || "-",
      item.shade || "-",
      item.instructions || "-"
    ]);
  }
  if (!order.items.length) {
    drawText(ctx, "La orden no tiene items registrados.", MARGIN_X, ctx.y, 9);
    ctx.y -= ROW_HEIGHT;
  }
  if (order.notes) {
    ensureSpace(ctx, 48);
    ctx.y -= 12;
    drawText(ctx, "Instrucciones generales:", MARGIN_X, ctx.y, 10, true);
    ctx.y -= 14;
    for (const line of wrapText(ctx.regular, order.notes, 9, 500)) {
      drawText(ctx, line, MARGIN_X, ctx.y, 9);
      ctx.y -= 12;
    }
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
  ensureSpace(ctx, 300);
  if (ctx.odontogramImage) {
    const width = 520;
    const height = width * (ctx.odontogramImage.height / ctx.odontogramImage.width);
    const x = (A4.width - width) / 2;
    ctx.page.drawImage(ctx.odontogramImage, {
      x,
      y: ctx.y - height,
      width,
      height
    });
    ctx.y -= height + 24;
  } else {
    drawText(ctx, "No se pudo renderizar el odontograma.", MARGIN_X, ctx.y, 9);
    ctx.y -= 24;
  }

  const columns = [
    { label: "Fecha", x: 30, width: 78 },
    { label: "Pieza", x: 144, width: 44 },
    { label: "Caras", x: 190, width: 106 },
    { label: "Estado", x: 330, width: 132 },
    { label: "Creador", x: 480, width: 72 }
  ];
  drawTableHeader(ctx, columns);
  const odontogramRecords = ctx.input.odontogram?.records ?? [];
  for (const record of odontogramRecords) {
    drawTableRow(ctx, columns, [
      formatFullDate(record.createdAt),
      record.toothLabel,
      record.surfaceLabel || "-",
      odontogramRecordStateLabel(record),
      record.professionalName
    ]);
  }
  if (!odontogramRecords.length) {
    drawText(ctx, "No hay registros de odontograma para este paciente.", MARGIN_X, ctx.y, 9);
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
  if (ctx.input.documentType === "ODONTOGRAM") {
    drawTextCentered(ctx, ctx.input.clinicName || "DENTAL +", A4.width / 2, FOOTER_Y + 16, 7, true);
    drawTextCentered(
      ctx,
      [ctx.input.clinicAddress, ctx.input.clinicPhone].filter(Boolean).join(" "),
      A4.width / 2,
      FOOTER_Y + 6,
      6
    );
    if (totalPages > 1) drawText(ctx, `Pagina ${pageNumber} / ${totalPages}`, 510, FOOTER_Y - 6, 7);
    ctx.page = previousPage;
    return;
  }
  drawLine(ctx, MARGIN_X, FOOTER_Y + 36, 552, FOOTER_Y + 36);
  drawText(ctx, ctx.input.clinicName, MARGIN_X, FOOTER_Y + 22, 10, true);
  drawText(ctx, [ctx.input.clinicAddress, ctx.input.clinicPhone].filter(Boolean).join(" "), MARGIN_X, FOOTER_Y + 8, 8);
  drawText(ctx, "Documento generado por DentalSuite", 330, FOOTER_Y + 8, 8);
  drawText(ctx, `Pagina ${pageNumber} / ${totalPages}`, 498, FOOTER_Y - 6, 8);
  ctx.page = previousPage;
}

async function embedDocumentImage(pdfDoc: PDFDocument, image: TreatmentPlanDocumentImage) {
  const bytes = Buffer.from(image.base64, "base64");
  return image.mimeType === "image/jpeg" ? pdfDoc.embedJpg(bytes) : pdfDoc.embedPng(bytes);
}

async function renderOdontogramPng(odontogram: TreatmentPlanDocumentOdontogram | null) {
  await ensureFontconfigCache();
  const assetName =
    odontogram?.dentition === "temporal"
      ? "warner-suite-odontogram-temporal.svg"
      : "warner-suite-odontogram-permanent.svg";
  const assetPath = findWorkspaceFile(path.join("apps", "web", "public", assetName));
  const source = await readFile(assetPath, "utf8");
  const symbolIds = symbolIdsFromRecords(odontogram?.records ?? []);
  const activated = activateWarnerSuiteSvgMarkup(source.replace(/\sstyle="width:\s*700px;?"/, ""), symbolIds);
  const composite = buildOdontogramCompositeSvg(activated, odontogram ?? null);
  return sharp(Buffer.from(composite)).png().toBuffer();
}

async function ensureFontconfigCache() {
  if (process.env.FONTCONFIG_CACHE) return;
  const cachePath = path.join(tmpdir(), "dentalsuite-fontconfig-cache");
  await mkdir(cachePath, { recursive: true });
  process.env.FONTCONFIG_CACHE = cachePath;
}

function findWorkspaceFile(relativePath: string) {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), "..", "..", relativePath),
    path.resolve(__dirname, "..", "..", "..", "..", "..", relativePath)
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error(`Workspace file not found: ${relativePath}`);
  return match;
}

function buildOdontogramCompositeSvg(sourceSvg: string, odontogram: TreatmentPlanDocumentOdontogram | null) {
  const dentition = odontogram?.dentition ?? "permanent";
  const sourceWidth = dentition === "temporal" ? 740 : 1177;
  const sourceHeight = 350;
  const viewBoxX = dentition === "temporal" ? 0 : 200;
  const viewBoxWidth = dentition === "temporal" ? 740 : 760;
  const canvasWidth = viewBoxWidth;
  const canvasHeight = dentition === "temporal" ? 500 : ODONTOGRAM_CANVAS.height;
  const normalizedSource = sourceSvg.replace(
    /<svg\b[^>]*>/,
    `<svg x="0" y="0" width="${sourceWidth}" height="${sourceHeight}" viewBox="0 0 ${sourceWidth} 608" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`
  );
  const overlay = buildSurfaceOverlaySvg(odontogram?.records ?? [], dentition, sourceWidth, sourceHeight);
  const sextantsWidth = dentition === "temporal" ? 620 : 620;
  const sextantsX = viewBoxX + (viewBoxWidth - sextantsWidth) / 2;
  const sextantsY = 362;

  return `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasWidth}" height="${canvasHeight}" viewBox="${viewBoxX} 0 ${viewBoxWidth} ${canvasHeight}">
  <rect x="${viewBoxX}" y="0" width="${viewBoxWidth}" height="${canvasHeight}" fill="#ffffff"/>
  ${normalizedSource}
  ${overlay}
  <svg x="${sextantsX}" y="${sextantsY}" width="${sextantsWidth}" height="128" viewBox="0 0 550 79" overflow="visible">
    ${SEXTANTS_MANDIBLE_SVG}
  </svg>
</svg>`;
}

function buildSurfaceOverlaySvg(
  records: TreatmentPlanDocumentOdontogramRecord[],
  dentition: "permanent" | "temporal",
  width: number,
  height: number
) {
  const upper = dentition === "temporal" ? TEMPORAL_UPPER : PERMANENT_UPPER;
  const lower = dentition === "temporal" ? TEMPORAL_LOWER : PERMANENT_LOWER;
  const states = surfaceStatesFromRecords(records);
  const upperFaces = buildSurfaceFaceRowSvg(dentition, "upper", upper, states);
  const lowerFaces = buildSurfaceFaceRowSvg(dentition, "lower", lower, states);

  return `<svg x="0" y="0" width="${width}" height="${height}" viewBox="0 0 ${width} 608">${upperFaces}${lowerFaces}</svg>`;
}

function buildSurfaceFaceRowSvg(
  dentition: "permanent" | "temporal",
  row: "upper" | "lower",
  teeth: string[],
  states: Record<string, SurfaceVisualState>
) {
  return teeth
    .map((tooth, toothIndex) => {
      const transform = `translate(${faceOffset(dentition, toothIndex)} ${faceRowY(dentition, row)})`;
      const verticalOffset = row === "lower" ? 22 : 0;
      const faces = ([1, 2, 3, 4, 5] as const)
        .map((faceIndex) => {
          const surface = surfaceForFaceIndex(tooth, faceIndex);
          const state = states[surfaceStateKey(tooth, surface)];
          if (!state) return "";
          const style = surfaceFaceStyle(state);
          if (faceIndex === 5) {
            return `<circle cx="${FACE_CENTER}" cy="${FACE_CENTER + verticalOffset}" r="${FACE_RADIUS}" fill="${style.fill}" fill-opacity="${style.opacity}" stroke="${style.stroke}" stroke-opacity="1" stroke-width="1.9"/>`;
          }
          const transformAttribute = verticalOffset ? ` transform="translate(0 ${verticalOffset})"` : "";
          return `<path d="${FACE_PATHS[faceIndex]}"${transformAttribute} fill="${style.fill}" fill-opacity="${style.opacity}" stroke="${style.stroke}" stroke-opacity="1" stroke-width="1.9"/>`;
        })
        .join("");
      return `<g transform="${transform}">${faces}</g>`;
    })
    .join("");
}

type SurfaceVisualState = "lesion" | "todo" | "done";

const WARNER_SUITE_SYMBOL_BY_MARK: Record<string, string> = {
  crown: "cor",
  "temporary-crown": "cp",
  endo: "endo",
  restoration: "r",
  implant: "i",
  post: "pm",
  other: "o",
  removable: "protesis_removible",
  "bad-crown": "cor_achurado",
  "bad-temporary-crown": "cp",
  "bad-post": "pm_achurado",
  "bad-restoration": "r_achurado",
  amalgam: "a",
  "bad-amalgam": "a_achurado",
  sealant: "sell",
  "bad-implant": "i_achurado",
  "bad-endo": "endo_achurado",
  absent: "rx",
  radiography: "rx",
  caries: "c",
  "pulp-infection": "ip",
  fracture: "f",
  mobility: "mov",
  "root-residue": "rr",
  erosion: "e",
  attrition: "at",
  abfraction: "ab",
  "lesion-other": "o",
  unerupted: "se",
  healthy: "s"
};

const DIAGNOSIS_MARKS = new Set(Object.keys(WARNER_SUITE_SYMBOL_BY_MARK));
const DIAGNOSIS_MARK_BY_LABEL = new Map<string, string>([
  ["CORONA", "crown"],
  ["CORONA PROVISORIA", "temporary-crown"],
  ["ENDODONCIA", "endo"],
  ["RESTAURACION", "restoration"],
  ["IMPLANTE", "implant"],
  ["PERNO MUNON", "post"],
  ["OTRO", "other"],
  ["PROTESIS REMOVIBLE", "removable"],
  ["CORONA (MAL ESTADO)", "bad-crown"],
  ["CORONA PROVISORIA (MAL ESTADO)", "bad-temporary-crown"],
  ["PERNO MUNON (MAL ESTADO)", "bad-post"],
  ["RESTAURACION (MAL ESTADO)", "bad-restoration"],
  ["AMALGAMA", "amalgam"],
  ["AMALGAMA (MAL ESTADO)", "bad-amalgam"],
  ["SELLANTE", "sealant"],
  ["IMPLANTE (MAL ESTADO)", "bad-implant"],
  ["ENDODONCIA (MAL ESTADO)", "bad-endo"],
  ["AUSENTE", "absent"],
  ["EXTRACCION", "absent"],
  ["EXTRACCION SIMPLE", "absent"],
  ["RAYOS X", "radiography"],
  ["RADIOGRAFIA", "radiography"],
  ["RX", "radiography"],
  ["CARIES", "caries"],
  ["INFECCION PULPAR", "pulp-infection"],
  ["FRACTURA", "fracture"],
  ["MOVILIDAD", "mobility"],
  ["RESIDUO RADICULAR", "root-residue"],
  ["EROSION", "erosion"],
  ["ATRICION", "attrition"],
  ["ABFRACCION", "abfraction"],
  ["SIN ERUPCIONAR", "unerupted"],
  ["DIENTE SANO", "healthy"],
  ["CROWN", "crown"],
  ["ENDODONTICS", "endo"],
  ["EXTRACTION", "absent"],
  ["IMPLANT", "implant"],
  ["RESTORATION", "restoration"],
  ["RADIOGRAPHY", "radiography"],
  ["SEALANT", "sealant"],
  ["OTHER", "other"]
]);

function symbolIdsFromRecords(records: TreatmentPlanDocumentOdontogramRecord[]) {
  const ids = new Set<string>();
  for (const record of records) {
    if (record.status === "CANCELLED") continue;
    const mark = inferDiagnosisMark(record);
    if (!mark) continue;
    const symbol = WARNER_SUITE_SYMBOL_BY_MARK[mark];
    if (symbol) ids.add(`${symbol}_${record.toothNumber}`);
  }
  return [...ids];
}

function inferDiagnosisMark(record: TreatmentPlanDocumentOdontogramRecord) {
  const exact = getDiagnosisMark(
    record.odontogramSymbol ??
      record.diagnosis ??
      record.condition ??
      record.procedureName ??
      record.procedureCode
  );
  if (exact) return exact;

  const text = normalizeClinicalText(
    [
      record.odontogramSymbol,
      record.diagnosis,
      record.condition,
      record.procedureCode,
      record.procedureName
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (!text) return undefined;
  if (text.includes("CORONA") && (text.includes("PROVISORIA") || text.includes("TEMPORAL"))) return "temporary-crown";
  if (text.includes("CORONA")) return "crown";
  if (text.includes("ENDOD")) return "endo";
  if (text.includes("RESTAUR") || text.includes("OBTUR") || text.includes("RESINA")) return "restoration";
  if (text.includes("IMPLANTE")) return "implant";
  if (text.includes("PERNO") || text.includes("MUNON")) return "post";
  if (text.includes("SELLANTE") || text.includes("SELLADO")) return "sealant";
  if (text.includes("RAYOS X") || text.includes("RADIOGRAF") || text.includes(" RX ")) return "radiography";
  if (text.includes("AMALG")) return "amalgam";
  if (text.includes("AUSENTE") || text.includes("EXODON") || text.includes("EXTRACC")) return "absent";
  if (text.includes("CARIES")) return "caries";
  if (text.includes("FRACT")) return "fracture";
  if (text.includes("MOVIL")) return "mobility";
  if (text.includes("RESIDUO") || text.includes("RADICULAR")) return "root-residue";
  if (text.includes("EROSION")) return "erosion";
  if (text.includes("ATRICION")) return "attrition";
  if (text.includes("ABFRACCION")) return "abfraction";
  return undefined;
}

function getDiagnosisMark(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.trim();
  if (DIAGNOSIS_MARKS.has(normalized)) return normalized;
  const lowerMark = normalized.toLowerCase();
  if (DIAGNOSIS_MARKS.has(lowerMark)) return lowerMark;
  return DIAGNOSIS_MARK_BY_LABEL.get(normalizeClinicalText(normalized));
}

function normalizeClinicalText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function activateWarnerSuiteSvgMarkup(markup: string, visibleIds: string[]) {
  return visibleIds.reduce((current, id) => {
    const idPattern = escapeRegExp(id);
    return current
      .replace(new RegExp(`(id="${idPattern}"[^>]*?)style="display:\\s*none;?"`, "g"), '$1style="display: inline;"')
      .replace(new RegExp(`(id="${idPattern}"[^>]*?style="[^"]*?)display:\\s*none;?`, "g"), "$1display: inline;");
  }, markup);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function surfaceStatesFromRecords(records: TreatmentPlanDocumentOdontogramRecord[]) {
  const states: Record<string, SurfaceVisualState> = {};
  for (const record of records) {
    if (record.status === "CANCELLED") continue;
    applySurfaceState(states, record.toothNumber, record.surface, resolveDentalSurfaceVisualState(record));
  }
  return states;
}

function resolveDentalSurfaceVisualState(record: TreatmentPlanDocumentOdontogramRecord): SurfaceVisualState {
  const isProcedureRecord = record.condition === "TOOTH_PROCEDURE" || record.condition === "TOOTH_PROCEDURE_STATUS";
  if (isProcedureRecord || (!record.condition && record.status)) {
    return record.status === "COMPLETED" ? "done" : "todo";
  }
  return "lesion";
}

function applySurfaceState(
  states: Record<string, SurfaceVisualState>,
  toothNumber: string,
  surface: string | null | undefined,
  state: SurfaceVisualState
) {
  const targetSurface = surface?.trim() ? surface : "ALL";
  for (const faceIndex of faceIndexesForSurface(toothNumber, targetSurface)) {
    const surfaceCode = surfaceForFaceIndex(toothNumber, faceIndex);
    const key = surfaceStateKey(toothNumber, surfaceCode);
    const current = states[key];
    if (!current || surfaceVisualPriority(state) >= surfaceVisualPriority(current)) states[key] = state;
  }
}

function surfaceStateKey(toothNumber: string, surface: string) {
  return `${toothNumber}:${surface}`;
}

function surfaceVisualPriority(state: SurfaceVisualState) {
  if (state === "done") return 3;
  if (state === "todo") return 2;
  return 1;
}

function surfaceFaceStyle(state: SurfaceVisualState) {
  if (state === "done") return { fill: "#1f7ae0", stroke: "#1f7ae0", opacity: 0.82 };
  if (state === "todo") return { fill: "#ff0000", stroke: "#000000", opacity: 0.82 };
  return { fill: "#000000", stroke: "#000000", opacity: 0.82 };
}

function faceOffset(dentition: "permanent" | "temporal", index: number) {
  return FACE_START_X + (dentition === "permanent" ? PERMANENT_FACE_OFFSETS[index] : TEMPORAL_FACE_OFFSETS[index]);
}

function faceRowY(dentition: "permanent" | "temporal", row: "upper" | "lower") {
  return row === "upper" ? UPPER_FACE_Y[dentition] : LOWER_FACE_Y[dentition];
}

function toothArch(toothNumber: string) {
  return ["1", "2", "5", "6"].includes(toothNumber[0]) ? "upper" : "lower";
}

function isIncisalTooth(toothNumber: string) {
  return ["1", "2", "3"].includes(toothNumber[1]);
}

function surfaceForFaceIndex(toothNumber: string, faceIndex: number) {
  const arch = toothArch(toothNumber);
  if (faceIndex === 5) return isIncisalTooth(toothNumber) ? "I" : "O";
  if (arch === "upper") {
    return ({ 1: "B", 2: "M", 3: "P", 4: "D" } as Record<number, string>)[faceIndex] ?? "";
  }
  return ({ 1: "L", 2: "M", 3: "B", 4: "D" } as Record<number, string>)[faceIndex] ?? "";
}

function faceIndexesForSurface(toothNumber: string, surface?: string | null) {
  if (surface?.trim().toUpperCase() === "ALL") return [1, 2, 3, 4, 5];
  const codes = surfaceCodes(surface);
  if (!codes.length) return [];
  const indexes: number[] = [];
  for (let index = 1; index <= 5; index += 1) {
    if (codes.includes(surfaceForFaceIndex(toothNumber, index))) indexes.push(index);
  }
  return indexes;
}

function surfaceCodes(surface?: string | null) {
  if (!surface || surface === "ALL") return [];
  const normalized = surface.trim().toUpperCase();
  if (!normalized) return [];
  if (normalized.includes(",")) return normalized.split(",").map((item) => item.trim()).filter(Boolean);
  if (["MO", "DO", "MOD"].includes(normalized)) return normalized.split("");
  return [normalized];
}

function odontogramRecordStateLabel(record: TreatmentPlanDocumentOdontogramRecord) {
  return record.procedureName || record.diagnosis || conditionPrintLabel(record.condition);
}

function conditionPrintLabel(condition: string) {
  const labels: Record<string, string> = {
    TOOTH_PROCEDURE: "Procedimiento",
    TOOTH_PROCEDURE_STATUS: "Procedimiento",
    CARIES: "Caries",
    FRACTURE: "Fractura",
    PULP_INFECTION: "Infeccion Pulpar"
  };
  return labels[condition] || condition || "-";
}

function drawTableHeader(
  ctx: PdfContext,
  columns: Array<{ label: string; x: number; width: number }>
) {
  ensureSpace(ctx, ROW_HEIGHT * 2);
  const left = Math.min(...columns.map((column) => column.x), MARGIN_X);
  const right = Math.max(...columns.map((column) => column.x + column.width), 552);
  drawRect(ctx, left, ctx.y - 5, right - left, 20, true, 0.94);
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
  const left = Math.min(...columns.map((column) => column.x), MARGIN_X);
  const right = Math.max(...columns.map((column) => column.x + column.width), 552);
  drawLine(ctx, left, ctx.y + 6, right, ctx.y + 6, 0.85);
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

function drawTextRight(ctx: PdfContext, text: string, rightX: number, y: number, size: number, bold = false) {
  const value = cleanText(text);
  const font = bold ? ctx.bold : ctx.regular;
  ctx.page.drawText(value, {
    x: rightX - font.widthOfTextAtSize(value, size),
    y,
    size,
    font,
    color: rgb(0.05, 0.13, 0.24)
  });
}

function drawTextCentered(ctx: PdfContext, text: string, centerX: number, y: number, size: number, bold = false) {
  const value = cleanText(text);
  const font = bold ? ctx.bold : ctx.regular;
  ctx.page.drawText(value, {
    x: centerX - font.widthOfTextAtSize(value, size) / 2,
    y,
    size,
    font,
    color: rgb(0.05, 0.13, 0.24)
  });
}

function drawWrappedText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  maxLines: number
) {
  wrapText(ctx.regular, text, size, maxWidth)
    .slice(0, maxLines)
    .forEach((line, index) => drawText(ctx, line, x, y - index * lineHeight, size));
}

function drawImageContain(ctx: PdfContext, image: PDFImage, x: number, topY: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.page.drawImage(image, {
    x,
    y: topY - height,
    width,
    height
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

function formatFullDate(value?: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);
}

function formatAge(birthDate?: Date | null, at: Date = new Date()) {
  if (!birthDate) return "-";
  let years = at.getUTCFullYear() - birthDate.getUTCFullYear();
  let months = at.getUTCMonth() - birthDate.getUTCMonth();
  if (at.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${Math.max(years, 0)} anos, ${Math.max(months, 0)} meses`;
}

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
