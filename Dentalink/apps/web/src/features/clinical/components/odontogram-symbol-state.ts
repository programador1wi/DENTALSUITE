import { getDiagnosisMark, type DiagnosisMark } from "./tooth-diagnosis-symbols";

type WarnerSuiteSymbolSource = {
  toothNumber: string;
  surface?: string | null;
  status?: string | null;
  condition?: string | null;
  diagnosis?: string | null;
  odontogramSymbol?: string | null;
  procedure?: { code?: string | null; name?: string | null } | null;
};

const WARNER_SUITE_SYMBOL_BY_MARK: Partial<Record<DiagnosisMark, string>> = {
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

function normalizeClinicalText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function inferDiagnosisMark(source: WarnerSuiteSymbolSource) {
  const exact = getDiagnosisMark(source.odontogramSymbol ?? source.diagnosis ?? source.condition ?? source.procedure?.name ?? source.procedure?.code);
  if (exact) return exact;

  const text = normalizeClinicalText([source.odontogramSymbol, source.diagnosis, source.condition, source.procedure?.code, source.procedure?.name].filter(Boolean).join(" "));
  if (!text) return undefined;
  if (text.includes("CORONA") && (text.includes("PROVISORIA") || text.includes("TEMPORAL"))) return "temporary-crown";
  if (text.includes("CORONA")) return "crown";
  if (text.includes("ENDOD")) return "endo";
  if (text.includes("RESTAUR") || text.includes("OBTUR") || text.includes("RESINA")) return "restoration";
  if (text.includes("IMPLANTE")) return "implant";
  if (text.includes("PERNO") || text.includes("MUÑON") || text.includes("MUNON")) return "post";
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

export function symbolIdsFromRecords(sources: WarnerSuiteSymbolSource[]) {
  const ids = new Set<string>();

  for (const record of sources) {
    if (record.status === "CANCELLED") continue;
    const mark = inferDiagnosisMark(record);
    if (!mark) continue;
    const symbol = WARNER_SUITE_SYMBOL_BY_MARK[mark];
    if (symbol) ids.add(`${symbol}_${record.toothNumber}`);
  }

  return [...ids];
}

export function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function warnerSuiteActivationCss(symbolIds: string[], activeTeeth: string[]) {
  const activeIds = activeTeeth.map((tooth) => `hover_${tooth}`);
  const visibleIds = [...symbolIds, ...activeIds].filter(Boolean);
  if (!visibleIds.length) return "";

  return `
    ${visibleIds.map((id) => `#${id}`).join(", ")} {
      display: inline !important;
    }
    ${activeIds.length ? `${activeIds.map((id) => `#${id}`).join(", ")} { fill-opacity: 0.13 !important; stroke-opacity: 1 !important; }` : ""}
  `;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function activateWarnerSuiteSvgMarkup(markup: string, visibleIds: string[]) {
  return visibleIds.reduce((current, id) => {
    const idPattern = escapeRegExp(id);
    return current
      .replace(new RegExp(`(id="${idPattern}"[^>]*?)style="display:\\s*none;?"`, "g"), '$1style="display: inline;"')
      .replace(new RegExp(`(id="${idPattern}"[^>]*?style="[^"]*?)display:\\s*none;?`, "g"), '$1display: inline;');
  }, markup);
}
