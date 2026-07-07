import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { CheckCircle2, Info, Plus, Printer, Stethoscope, X } from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils/cn";
import { useOdontogramStore, type OdontogramContextMenu, type OdontogramTool } from "@/stores/odontogram.store";
import type { OdontogramRecord, ToothCondition, ToothProcedure } from "../services/clinical.service";
import { getDiagnosisMark, type DiagnosisMark } from "./tooth-diagnosis-symbols";
import { faceIndexesForSurface, fdiLabel, pieceSurfaceLabel, surfaceCodes, surfaceForFaceIndex, surfaceLabel } from "../utils/tooth-surface";

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
  1: "M23.436,3.46389584e-14 C29.9076727,3.46389584e-14 35.7666727,2.62316365 40.0077545,6.86424548 L31.4545909,15.4174091 C29.4024545,13.3652727 26.5674545,12.096 23.436,12.096 C20.3045455,12.096 17.4695455,13.3652727 15.4174091,15.4174091 L6.86424548,6.86424548 C11.1053273,2.62316365 16.9643273,3.46389584e-14 23.436,3.46389584e-14 Z",
  2: "M40.0077545,6.86424548 C44.2488363,11.1053273 46.872,16.9643273 46.872,23.436 C46.872,29.9076727 44.2488363,35.7666727 40.0077545,40.0077545 L31.4545909,31.4545909 C33.5067273,29.4024545 34.776,26.5674545 34.776,23.436 C34.776,20.3045455 33.5067273,17.4695455 31.4545909,15.4174091 L40.0077545,6.86424548 Z",
  3: "M23.436,34.776 C26.5674545,34.776 29.4024545,33.5067273 31.4545909,31.4545909 L40.0077545,40.0077545 C35.7666727,44.2488363 29.9076727,46.872 23.436,46.872 C16.9643273,46.872 11.1053273,44.2488363 6.86424548,40.0077545 L15.4174091,31.4545909 C17.4695455,33.5067273 20.3045455,34.776 23.436,34.776 Z",
  4: "M6.86424548,6.86424548 L15.4174091,15.4174091 C13.3652727,17.4695455 12.096,20.3045455 12.096,23.436 C12.096,26.5669527 13.3648659,29.4015459 15.4164226,31.4536042 L6.86424548,40.0077545 C2.62316365,35.7666727 0,29.9076727 0,23.436 C0,16.9643273 2.62316365,11.1053273 6.86424548,6.86424548 Z"
} as const;

type SurfaceTone = "diagnosis" | "procedure";
type SurfaceStateMap = Record<string, SurfaceTone>;

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

function symbolIdsFromRecords(sources: WarnerSuiteSymbolSource[]) {
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

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function warnerSuiteActivationCss(symbolIds: string[], activeTeeth: string[]) {
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

function activateWarnerSuiteSvgMarkup(markup: string, visibleIds: string[]) {
  return visibleIds.reduce((current, id) => {
    const idPattern = escapeRegExp(id);
    return current
      .replace(new RegExp(`(id="${idPattern}"[^>]*?)style="display:\\s*none;?"`, "g"), '$1style="display: inline;"')
      .replace(new RegExp(`(id="${idPattern}"[^>]*?style="[^"]*?)display:\\s*none;?`, "g"), '$1display: inline;');
  }, markup);
}

function surfaceStateKey(toothNumber: string, surface: string) {
  return `${toothNumber}:${surface}`;
}

function applySurfaceState(states: SurfaceStateMap, toothNumber: string, surface: string | null | undefined, tone: SurfaceTone) {
  for (const faceIndex of faceIndexesForSurface(toothNumber, surface)) {
    const surfaceCode = surfaceForFaceIndex(toothNumber, faceIndex);
    const key = surfaceStateKey(toothNumber, surfaceCode);
    if (states[key] !== "diagnosis") states[key] = tone;
  }
}

function surfaceStatesFromSources({
  records = [],
  conditions = [],
  procedures = []
}: {
  records?: OdontogramRecord[];
  conditions?: ToothCondition[];
  procedures?: ToothProcedure[];
}) {
  const states: SurfaceStateMap = {};

  for (const record of records) {
    if (record.status === "CANCELLED") continue;
    const tone = record.condition === "TOOTH_PROCEDURE" || record.condition === "TOOTH_PROCEDURE_STATUS" ? "procedure" : "diagnosis";
    applySurfaceState(states, record.toothNumber, record.surface, tone);
  }

  for (const procedure of procedures) {
    if (procedure.status === "CANCELLED") continue;
    applySurfaceState(states, procedure.toothNumber, procedure.surface, "procedure");
  }

  for (const condition of conditions) {
    applySurfaceState(states, condition.toothNumber, condition.surface, "diagnosis");
  }

  return states;
}

function faceOffset(dentition: "permanent" | "temporal", index: number) {
  return FACE_START_X + (dentition === "permanent" ? PERMANENT_FACE_OFFSETS[index] : TEMPORAL_FACE_OFFSETS[index]);
}

function faceRowY(dentition: "permanent" | "temporal", row: "upper" | "lower") {
  return row === "upper" ? UPPER_FACE_Y[dentition] : LOWER_FACE_Y[dentition];
}

function surfaceFaceClass(tone?: SurfaceTone, selected?: boolean) {
  return cn(
    "cursor-pointer transition-[fill,fill-opacity,stroke,stroke-width] duration-150 outline-none",
    tone === "procedure" ? "fill-[#ff0000] stroke-black" : selected ? "fill-[#008aca] stroke-[#008aca]" : tone === "diagnosis" ? "fill-black stroke-black" : "fill-white stroke-transparent"
  );
}

function surfaceFaceOpacity(tone?: SurfaceTone, selected?: boolean) {
  if (tone === "procedure") return 0.82;
  if (selected) return 0.32;
  if (tone === "diagnosis") return 0.22;
  return 0.001;
}

function SurfaceFaceOverlay({
  dentition,
  row,
  teeth,
  selectedTeeth,
  selectedSurface,
  surfaceStates,
  onSelectSurface,
  onOpenSurfaceContextMenu
}: {
  dentition: "permanent" | "temporal";
  row: "upper" | "lower";
  teeth: string[];
  selectedTeeth: string[];
  selectedSurface: string;
  surfaceStates: SurfaceStateMap;
  onSelectSurface: (tooth: string, surface: string, options?: { additive?: boolean }) => void;
  onOpenSurfaceContextMenu: (tooth: string, surface: string, event: MouseEvent<SVGElement>) => void;
}) {
  return (
    <g>
      {teeth.map((tooth, toothIndex) => {
        const transform = `translate(${faceOffset(dentition, toothIndex)} ${faceRowY(dentition, row)})`;
        const verticalOffset = row === "lower" ? 22 : 0;
        const faceIndexes = [1, 2, 3, 4, 5] as const;

        return (
          <g key={`surface-hit-${row}-${tooth}`} transform={transform}>
            {faceIndexes.map((faceIndex) => {
              const surface = surfaceForFaceIndex(tooth, faceIndex);
              const tone = surfaceStates[surfaceStateKey(tooth, surface)];
              const selected = Boolean(selectedSurface && selectedTeeth.includes(tooth) && surfaceCodes(selectedSurface).includes(surface));
              const commonProps = {
                role: "button",
                tabIndex: 0,
                "aria-label": `Cara ${surfaceLabel(surface).toLowerCase()} de pieza ${fdiLabel(tooth)}`,
                "aria-pressed": selected,
                "data-testid": `surface-face-${tooth}-${surface}`,
                className: surfaceFaceClass(tone, selected),
                fillOpacity: surfaceFaceOpacity(tone, selected),
                strokeOpacity: selected || tone ? 1 : 0,
                strokeWidth: tone === "procedure" ? 1.9 : selected ? 2.1 : 1.5,
                style: { pointerEvents: "all" as const },
                onClick: (event: MouseEvent<SVGElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectSurface(tooth, surface, { additive: event.ctrlKey || event.metaKey });
                },
                onContextMenu: (event: MouseEvent<SVGElement>) => onOpenSurfaceContextMenu(tooth, surface, event),
                onKeyDown: (event: ReactKeyboardEvent<SVGElement>) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectSurface(tooth, surface);
                  }
                }
              };

              if (faceIndex === 5) {
                return <circle key={`${tooth}-${surface}`} {...commonProps} cx={FACE_CENTER} cy={FACE_CENTER + verticalOffset} r={FACE_RADIUS} />;
              }

              return <path key={`${tooth}-${surface}`} {...commonProps} d={FACE_PATHS[faceIndex]} transform={verticalOffset ? `translate(0 ${verticalOffset})` : undefined} />;
            })}
          </g>
        );
      })}
    </g>
  );
}

function SextantsMandibleSvg() {
  return (
    <svg className="h-auto w-[532px] max-w-full" viewBox="0 0 532 79" xmlns="http://www.w3.org/2000/svg" aria-label="Sextantes y mandibula">
      <defs>
        <pattern id="diagonalHatchMandibula" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#5CB75B" strokeWidth="2" />
        </pattern>
        <pattern id="diagonalHatchMandibulaConsumed" width="4" height="4" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#D0021B" strokeWidth="2" />
        </pattern>
      </defs>
      <g id="Sextantes-y-mandibula" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
        <g id="pieza_sextante_1" transform="translate(4 13)">
          <polyline id="Path-20" stroke="#696969" fillOpacity="0" fill="#FFFFFF" points="17.6112943 0.876524039 43.6645289 40.463211 0.376352209 40.349731" />
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="4.0725" y="57">Sextante 1</tspan>
          </text>
        </g>
        <g id="pieza_sextante_2" transform="translate(62 11)">
          <polyline id="Path-19" stroke="#696969" fillOpacity="0" fill="#FFFFFF" points="51.6474408 0.0688490704 26.8590625 41.8244076 0.0981713814 0.350636613" />
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="6.0725" y="59">Sextante 2</tspan>
          </text>
        </g>
        <g id="pieza_sextante_3" transform="translate(126 11)">
          <polyline id="Path-18" stroke="#696969" fillOpacity="0" fill="#FFFFFF" points="49.2989849 41.8919856 0.482162084 42.4313346 27.1563493 0.530419615" />
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="2.0725" y="59">Sextante 3</tspan>
          </text>
        </g>
        <g id="pieza_sextante_4" transform="translate(188 14)">
          <polyline id="Path-17" stroke="#696969" fillOpacity="0" fill="#FFFFFF" points="26.8499703 39.2872532 0.91021573 0.420973272 44.4393782 0.0805331191" />
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="4.0725" y="56">Sextante 4</tspan>
          </text>
        </g>
        <g id="pieza_sextante_5" transform="translate(249 10)">
          <polyline id="Path-16" stroke="#696969" fillOpacity="0" fill="#FFFFFF" points="52.8330669 43.2120248 25.8452157 0.957919133 0.940807174 43.0118409" />
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="3.0725" y="60">Sextante 5</tspan>
          </text>
        </g>
        <g id="pieza_sextante_6" transform="translate(310 11)">
          <polyline id="Path-15" stroke="#696969" fillOpacity="0" fill="#FFFFFF" points="23.0062379 41.992668 50.251644 0.914887508 0.490305146 0.914887508" />
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="2.0725" y="59">Sextante 6</tspan>
          </text>
        </g>
        <g id="pieza_arcada_1" transform="translate(373 17)">
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="0.9025" y="53">Arcada Superior</tspan>
          </text>
          <path d="M11.0444715,0.581947803 C11.0444715,0.581947803 8.60160093,35.4803571 34.7907399,35.4803579 C60.9798788,35.4803586 59.5952551,0.692717568 59.5952551,0.692717568" stroke="#696969" strokeWidth="5" fillOpacity="0" fill="#FFFFFF" transform="translate(35.296001, 18.031153) rotate(-180.000000) translate(-35.296001, -18.031153)" />
        </g>
        <g id="pieza_arcada_17" transform="translate(460 17)">
          <text fontFamily="Lato-Regular, Lato" fontSize="10" fontWeight="normal" fill="#000000">
            <tspan x="0.3725" y="53">Arcada Inferior</tspan>
          </text>
          <path d="M8.04447151,0.581947803 C8.04447151,0.581947803 5.60160093,35.4803571 31.7907399,35.4803579 C57.9798788,35.4803586 56.5952551,0.692717568 56.5952551,0.692717568" stroke="#696969" strokeWidth="5" fillOpacity="0" fill="#FFFFFF" />
        </g>
      </g>
    </svg>
  );
}

function ClinicalSvg({
  dentition,
  teethUpper,
  teethLower,
  selectedTooth,
  selectedTeeth,
  selectedSurface,
  hoveredTooth,
  latestByTooth,
  conditions,
  records,
  procedures,
  onSelectTooth,
  onSelectSurface,
  onHoverTooth,
  onOpenContextMenu,
  onOpenSurfaceContextMenu
}: {
  dentition: "permanent" | "temporal";
  teethUpper: string[];
  teethLower: string[];
  selectedTooth: string;
  selectedTeeth: string[];
  selectedSurface: string;
  hoveredTooth: string;
  latestByTooth: Record<string, OdontogramRecord>;
  conditions?: ToothCondition[];
  records?: OdontogramRecord[];
  procedures?: ToothProcedure[];
  onSelectTooth: (tooth: string, options?: { additive?: boolean }) => void;
  onSelectSurface: (tooth: string, surface: string, options?: { additive?: boolean }) => void;
  onHoverTooth: (tooth: string) => void;
  onOpenContextMenu: (tooth: string, event: MouseEvent<SVGElement>) => void;
  onOpenSurfaceContextMenu: (tooth: string, surface: string, event: MouseEvent<SVGElement>) => void;
}) {
  const [svgMarkup, setSvgMarkup] = useState("");
  const assetPath = dentition === "temporal" ? "/warner-suite-odontogram-temporal.svg" : "/warner-suite-odontogram-permanent.svg";
  const overlayViewBox = dentition === "temporal" ? "0 0 740 607" : "0 0 1177 608";
  const upperStartX = dentition === "temporal" ? 10 : 12;
  const lowerStartX = dentition === "temporal" ? 10 : 12;
  const toothWidth = dentition === "temporal" ? 72 : 72.0666667;
  const interactiveTeeth = [...teethUpper, ...teethLower];
  const interactiveToothSet = useMemo(() => new Set(interactiveTeeth), [interactiveTeeth]);
  const symbolSources = useMemo(
    () =>
      [...Object.values(latestByTooth), ...(records ?? []), ...(conditions ?? []), ...(procedures ?? [])].filter((source) =>
        interactiveToothSet.has(source.toothNumber)
      ),
    [conditions, interactiveToothSet, latestByTooth, procedures, records]
  );
  const symbolIds = useMemo(() => symbolIdsFromRecords(symbolSources), [symbolSources]);
  const activeTeeth = useMemo(() => uniqueValues([selectedTooth, hoveredTooth, ...selectedTeeth]), [hoveredTooth, selectedTeeth, selectedTooth]);
  const surfaceStates = useMemo(
    () => surfaceStatesFromSources({ records, conditions, procedures }),
    [conditions, procedures, records]
  );
  const visibleIds = useMemo(() => [...symbolIds, ...activeTeeth.map((tooth) => `hover_${tooth}`)].filter(Boolean), [activeTeeth, symbolIds]);
  const activationCss = useMemo(() => warnerSuiteActivationCss(symbolIds, activeTeeth), [activeTeeth, symbolIds]);
  const activatedSvgMarkup = useMemo(() => activateWarnerSuiteSvgMarkup(svgMarkup, visibleIds), [svgMarkup, visibleIds]);

  useEffect(() => {
    let cancelled = false;
    setSvgMarkup("");
    fetch(assetPath)
      .then((response) => response.text())
      .then((markup) => {
        if (!cancelled) setSvgMarkup(markup.replace(/\sstyle="width:\s*700px;?"/, ""));
      })
      .catch(() => {
        if (!cancelled) setSvgMarkup("");
      });

    return () => {
      cancelled = true;
    };
  }, [assetPath]);

  return (
    <div className="relative mx-auto h-auto w-full max-w-[980px]">
      {activationCss ? <style>{activationCss}</style> : null}
      {svgMarkup ? (
        <div
          className="pointer-events-none block h-auto w-full select-none [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: activatedSvgMarkup }}
        />
      ) : (
        <img
          src={assetPath}
          alt="Odontograma Internacional FDI"
          className="block h-auto w-full select-none"
          draggable={false}
        />
      )}
      <svg
        className="absolute inset-0 z-10 h-full w-full"
        viewBox={overlayViewBox}
        aria-label="Zonas interactivas del odontograma"
        style={{ pointerEvents: "none" }}
      >
        {teethUpper.map((tooth, index) => {
          const x = upperStartX + index * toothWidth;
          const selected = activeTeeth.includes(tooth);
          return (
            <g key={`upper-hit-${tooth}`}>
              {selected ? (
                <rect
                  data-testid={`tooth-highlight-${tooth}`}
                  x={x}
                  y="29"
                  width="72"
                  height="260"
                  rx="30"
                  fill="#008aca"
                  opacity="0.13"
                  style={{ pointerEvents: "none" }}
                />
              ) : null}
              <rect
                role="button"
                tabIndex={0}
                aria-pressed={selectedTeeth.includes(tooth)}
                aria-label={`Pieza ${fdiLabel(tooth)}`}
                x={x}
                y="29"
                width="72"
                height="260"
                rx="30"
                fill="#fff"
                fillOpacity="0"
                className="cursor-pointer"
                style={{ pointerEvents: "all" }}
                onMouseEnter={() => onHoverTooth(tooth)}
                onMouseLeave={() => onHoverTooth("")}
                onFocus={() => onHoverTooth(tooth)}
                onBlur={() => onHoverTooth("")}
                onClick={(event) => onSelectTooth(tooth, { additive: event.ctrlKey || event.metaKey })}
                onContextMenu={(event) => onOpenContextMenu(tooth, event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelectTooth(tooth);
                }}
              />
            </g>
          );
        })}
        {teethLower.map((tooth, index) => {
          const x = lowerStartX + index * toothWidth;
          const selected = activeTeeth.includes(tooth);
          return (
            <g key={`lower-hit-${tooth}`}>
              {selected ? (
                <rect
                  data-testid={`tooth-highlight-${tooth}`}
                  x={x}
                  y="318"
                  width="72"
                  height="260"
                  rx="30"
                  fill="#008aca"
                  opacity="0.13"
                  style={{ pointerEvents: "none" }}
                />
              ) : null}
              <rect
                role="button"
                tabIndex={0}
                aria-pressed={selectedTeeth.includes(tooth)}
                aria-label={`Pieza ${fdiLabel(tooth)}`}
                x={x}
                y="318"
                width="72"
                height="260"
                rx="30"
                fill="#fff"
                fillOpacity="0"
                className="cursor-pointer"
                style={{ pointerEvents: "all" }}
                onMouseEnter={() => onHoverTooth(tooth)}
                onMouseLeave={() => onHoverTooth("")}
                onFocus={() => onHoverTooth(tooth)}
                onBlur={() => onHoverTooth("")}
                onClick={(event) => onSelectTooth(tooth, { additive: event.ctrlKey || event.metaKey })}
                onContextMenu={(event) => onOpenContextMenu(tooth, event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelectTooth(tooth);
                }}
              />
            </g>
          );
        })}
        <SurfaceFaceOverlay
          dentition={dentition}
          row="upper"
          teeth={teethUpper}
          selectedTeeth={selectedTeeth}
          selectedSurface={selectedSurface}
          surfaceStates={surfaceStates}
          onSelectSurface={onSelectSurface}
          onOpenSurfaceContextMenu={onOpenSurfaceContextMenu}
        />
        <SurfaceFaceOverlay
          dentition={dentition}
          row="lower"
          teeth={teethLower}
          selectedTeeth={selectedTeeth}
          selectedSurface={selectedSurface}
          surfaceStates={surfaceStates}
          onSelectSurface={onSelectSurface}
          onOpenSurfaceContextMenu={onOpenSurfaceContextMenu}
        />
        <title>{interactiveTeeth.length ? "Selecciona una pieza dental" : "Odontograma"}</title>
      </svg>
    </div>
  );
}

function contextMenuPosition(menu: NonNullable<OdontogramContextMenu>) {
  const width = 248;
  const height = 332;
  if (typeof window === "undefined") return { left: menu.x, top: menu.y };
  return {
    left: Math.min(menu.x, window.innerWidth - width - 12),
    top: Math.min(menu.y, window.innerHeight - height - 12)
  };
}

function OdontogramContextMenuView({
  menu,
  mode,
  selectedCount,
  onClose,
  onOpenPreexistence,
  onOpenLesion,
  onOpenTreatment,
  onOpenInformation,
  onApplyQuickDiagnosis,
  onOpenMultiHelp
}: {
  menu: OdontogramContextMenu;
  mode: "clinical" | "treatment-plan";
  selectedCount: number;
  onClose: () => void;
  onOpenPreexistence: () => void;
  onOpenLesion: () => void;
  onOpenTreatment: () => void;
  onOpenInformation: () => void;
  onApplyQuickDiagnosis?: (diagnosis: string) => void;
  onOpenMultiHelp: () => void;
}) {
  useEffect(() => {
    if (!menu) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu, onClose]);

  if (!menu) return null;

  const position = contextMenuPosition(menu);
  const targetLabel =
    selectedCount > 1
      ? `${selectedCount} piezas${menu.surface ? ` - Cara ${surfaceLabel(menu.surface).toLowerCase()}` : ""}`
      : pieceSurfaceLabel(menu.toothNumber, menu.surface).toLowerCase();
  const procedureEnabled = mode === "treatment-plan";
  const itemClass = "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[var(--text-sm)] text-[var(--text-primary)] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)] disabled:hover:bg-transparent";

  return (
    <div className="fixed inset-0 z-40" role="presentation" onMouseDown={onClose}>
      <div
        role="menu"
        aria-label={`Opciones de pieza ${fdiLabel(menu.toothNumber)}`}
        className="fixed w-[248px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-sm)] shadow-[var(--shadow-modal)]"
        style={{ left: position.left, top: position.top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2 bg-[var(--bg-nav)] px-3 py-3 text-[var(--text-inverse)]">
          <div>
            <p className="text-sm font-bold">Opciones</p>
            <p className="mt-0.5 text-xs text-[rgba(248,250,252,0.65)]">Aplicar estos cambios a {targetLabel}</p>
          </div>
          <button type="button" aria-label="Cerrar opciones" className="rounded-[var(--radius-sm)] p-0.5 text-[rgba(248,250,252,0.85)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[var(--text-inverse)]" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="py-1">
          <button type="button" role="menuitem" className={itemClass} onClick={onOpenPreexistence}>
            <span className="grid h-5 w-5 place-items-center rounded bg-[#58ba5b] text-white">
              <Plus className="h-3.5 w-3.5" />
            </span>
            Agregar preexistencia
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={onOpenLesion}>
            <span className="grid h-5 w-5 place-items-center rounded bg-black text-white">
              <Stethoscope className="h-3.5 w-3.5" />
            </span>
            Definir lesion
          </button>
          <button type="button" role="menuitem" className={itemClass} disabled={!procedureEnabled} onClick={onOpenTreatment}>
            <span className={cn("grid h-5 w-5 place-items-center rounded text-white", procedureEnabled ? "bg-slate-500" : "bg-slate-300")}>
              <Plus className="h-3.5 w-3.5" />
            </span>
            Agregar prestacion
          </button>
        </div>

        <div className="border-t border-slate-200 py-1">
          <button type="button" role="menuitem" className={itemClass} onClick={() => onApplyQuickDiagnosis?.("Sin erupcionar")}>
            Sin erupcionar
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => onApplyQuickDiagnosis?.("Diente sano")}>
            Diente sano
          </button>
        </div>

        <div className="border-t border-slate-200 py-1">
          <button type="button" role="menuitem" className={itemClass} onClick={onOpenInformation}>
            <Info className="h-4 w-4 text-slate-400" />
            Ver Informacion
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={onOpenMultiHelp}>
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
            Seleccionar multiples piezas
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CL");
}

function recordSurface(value?: string | null) {
  return surfaceLabel(value);
}

export function OdontogramView({
  mode = "clinical",
  selectedTooth,
  latestByTooth,
  conditions,
  records,
  procedures,
  onSelectTooth,
  onOpenDiagnosis,
  onOpenPreexistence,
  onOpenLesion,
  onOpenTreatment,
  onOpenProcedureCatalog,
  onOpenInformation,
  onApplyQuickDiagnosis,
  onCancelRecord,
  showHistoryTable = true
}: {
  mode?: "clinical" | "treatment-plan";
  selectedTooth: string;
  latestByTooth: Record<string, OdontogramRecord>;
  conditions?: ToothCondition[];
  records?: OdontogramRecord[];
  procedures?: ToothProcedure[];
  onSelectTooth: (toothNumber: string, options?: { additive?: boolean }) => void;
  onOpenDiagnosis: () => void;
  onOpenPreexistence?: () => void;
  onOpenLesion?: () => void;
  onOpenTreatment: () => void;
  onOpenProcedureCatalog?: () => void;
  onOpenInformation: () => void;
  onApplyQuickDiagnosis?: (diagnosis: string) => void;
  onCancelRecord?: (odontogramRecordId: string) => void;
  showHistoryTable?: boolean;
}) {
  const dentition = useOdontogramStore((state) => state.dentition);
  const activeTool = useOdontogramStore((state) => state.activeTool);
  const selectedTeeth = useOdontogramStore((state) => state.selectedTeeth);
  const hoveredTooth = useOdontogramStore((state) => state.hoveredTooth);
  const selectedSurface = useOdontogramStore((state) => state.selectedSurface);
  const contextMenu = useOdontogramStore((state) => state.contextMenu);
  const showOnlyDiagnosis = useOdontogramStore((state) => state.showOnlyDiagnosis);
  const setHoveredTooth = useOdontogramStore((state) => state.setHoveredTooth);
  const setDentition = useOdontogramStore((state) => state.setDentition);
  const selectToothSurface = useOdontogramStore((state) => state.selectToothSurface);
  const openContextMenu = useOdontogramStore((state) => state.openContextMenu);
  const closeContextMenu = useOdontogramStore((state) => state.closeContextMenu);
  const openModal = useOdontogramStore((state) => state.openModal);
  const enableMultiSelectMode = useOdontogramStore((state) => state.enableMultiSelectMode);
  const toggleShowOnlyDiagnosis = useOdontogramStore((state) => state.toggleShowOnlyDiagnosis);

  const upper = dentition === "permanent" ? PERMANENT_UPPER : TEMPORAL_UPPER;
  const lower = dentition === "permanent" ? PERMANENT_LOWER : TEMPORAL_LOWER;
  const activeDentitionTeeth = useMemo(() => new Set([...upper, ...lower]), [lower, upper]);
  const activeRecords = useMemo(
    () => (records ?? []).filter((record) => record.status !== "CANCELLED" && activeDentitionTeeth.has(record.toothNumber)),
    [activeDentitionTeeth, records]
  );
  const activeConditions = useMemo(() => {
    const cancelledRecordIds = new Set((records ?? []).filter((record) => record.status === "CANCELLED").map((record) => record.id));
    return (conditions ?? []).filter(
      (condition) =>
        activeDentitionTeeth.has(condition.toothNumber) && (!condition.odontogramRecordId || !cancelledRecordIds.has(condition.odontogramRecordId))
    );
  }, [activeDentitionTeeth, conditions, records]);
  const activeProcedures = useMemo(
    () => (procedures ?? []).filter((procedure) => procedure.status !== "CANCELLED" && activeDentitionTeeth.has(procedure.toothNumber)),
    [activeDentitionTeeth, procedures]
  );

  const rows = useMemo(() => {
    const conditionRows = activeRecords.map((record) => {
      const isProcedureRecord = record.condition === "TOOTH_PROCEDURE" || record.condition === "TOOTH_PROCEDURE_STATUS";
      return {
        id: `record-${record.id}`,
        recordId: isProcedureRecord ? "" : record.id,
        date: record.createdAt,
        tooth: fdiLabel(record.toothNumber),
        surface: recordSurface(record.surface),
        status: record.condition,
        detail: record.diagnosis,
        creator: record.professional ? `${record.professional.firstName} ${record.professional.lastName}` : "-"
      };
    });

    const procedureRows = activeProcedures.map((procedure) => ({
      id: `procedure-${procedure.id}`,
      recordId: "",
      date: procedure.createdAt,
      tooth: fdiLabel(procedure.toothNumber),
      surface: recordSurface(procedure.surface),
      status: procedure.procedure?.name ?? procedure.status,
      detail: procedure.diagnosis,
      creator: procedure.professional ? `${procedure.professional.firstName} ${procedure.professional.lastName}` : "-"
    }));

    return [...conditionRows, ...(showOnlyDiagnosis ? [] : procedureRows)].sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date)));
  }, [activeProcedures, activeRecords, showOnlyDiagnosis]);

  const actionTeethCount = Math.max(selectedTeeth.length, selectedTooth ? 1 : 0);
  const handleOpenContextMenu = (toothNumber: string, event: MouseEvent<SVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu({ toothNumber, x: event.clientX, y: event.clientY });
  };
  const handleOpenSurfaceContextMenu = (toothNumber: string, surface: string, event: MouseEvent<SVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const menuSurface = selectedTooth === toothNumber && selectedSurface && surfaceCodes(selectedSurface).includes(surface) ? selectedSurface : surface;
    openContextMenu({ toothNumber, surface: menuSurface, x: event.clientX, y: event.clientY });
  };
  const handleMenuAction = (action: () => void) => {
    closeContextMenu();
    action();
  };
  const toolButtonClass = (tool: OdontogramTool) =>
    cn(
      "inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] border px-3 font-[var(--weight-bold)] transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] disabled:opacity-40",
      activeTool === tool
        ? "border-[var(--action-brand)] bg-[var(--action-brand)] text-[var(--text-inverse)] hover:bg-[var(--action-brand-hover)]"
        : selectedTooth && (tool === "procedure" || tool === "info")
          ? "border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] text-[var(--text-brand)] hover:bg-[var(--border-brand-light)]"
          : "border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-default)]"
    );

  return (
    <section className="border-[0.5px] border-[var(--border-default)] rounded-[var(--radius-lg)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-card-hover)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            className={cn("border-b-2 px-1 pb-2", dentition === "permanent" ? "border-[var(--text-brand)] text-[var(--text-primary)] font-[var(--weight-bold)]" : "border-transparent text-[var(--text-secondary)]")}
            onClick={() => setDentition("permanent")}
          >
            Permanente
          </button>
          <button
            type="button"
            className={cn("border-b-2 px-1 pb-2", dentition === "temporal" ? "border-[var(--text-brand)] text-[var(--text-primary)] font-[var(--weight-bold)]" : "border-transparent text-[var(--text-secondary)]")}
            onClick={() => setDentition("temporal")}
          >
            Temporal
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select className="h-9 rounded border border-slate-300 bg-white px-2 text-sm text-slate-600">
            <option>Ver. {new Date().toLocaleDateString("es-CL")} Odontograma Inicial</option>
          </select>
          <button
            type="button"
            className={toolButtonClass("diagnosis")}
            onClick={onOpenDiagnosis}
          >
            <Stethoscope className="h-4 w-4" />
            Diagnostico
          </button>
          <button
            type="button"
            className={toolButtonClass("procedure")}
            onClick={mode === "treatment-plan" && onOpenProcedureCatalog ? onOpenProcedureCatalog : onOpenTreatment}
          >
            <Plus className="h-4 w-4" />
            Tratamiento
          </button>
          <button
            type="button"
            className={toolButtonClass("info")}
            onClick={onOpenInformation}
          >
            <Info className="h-4 w-4" />
            Informacion
          </button>
          <button
            type="button"
            className={cn(
              "h-9 rounded-[var(--radius-md)] px-3 text-[var(--text-sm)] transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] border",
              showOnlyDiagnosis
                ? "bg-[var(--bg-brand-light)] border-[var(--border-brand-light)] text-[var(--text-brand-strong)] font-[var(--weight-bold)]"
                : "bg-[var(--bg-subtle)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--border-default)]"
            )}
            onClick={toggleShowOnlyDiagnosis}
          >
            Ver solo diagnostico
          </button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-default)] transition-colors">
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-5">
        <p className="mb-2 text-center text-sm text-[#7a4f52]">Odontograma Internacional <span className="text-[#0879d5]">FDI</span></p>
        <div className="w-full overflow-x-auto">
          <ClinicalSvg
            dentition={dentition}
            teethUpper={upper}
            teethLower={lower}
            selectedTooth={selectedTooth}
            selectedTeeth={selectedTeeth}
            selectedSurface={selectedSurface}
            hoveredTooth={hoveredTooth}
            latestByTooth={latestByTooth}
            conditions={activeConditions}
            records={activeRecords}
            procedures={activeProcedures}
            onSelectTooth={onSelectTooth}
            onSelectSurface={selectToothSurface}
            onHoverTooth={setHoveredTooth}
            onOpenContextMenu={handleOpenContextMenu}
            onOpenSurfaceContextMenu={handleOpenSurfaceContextMenu}
          />
          <div className="mx-auto mt-3 flex w-full max-w-[980px] justify-center">
            <SextantsMandibleSvg />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <HelpTooltip content="Diagnostico" position="top">
              <span className="h-3 w-3 rounded bg-black" />
            </HelpTooltip>
            <HelpTooltip content="Anulado o ausente" position="top">
              <span className="h-3 w-3 rounded bg-[#d2182a]" />
            </HelpTooltip>
            <HelpTooltip content="Planificado" position="top">
              <span className="h-3 w-3 rounded bg-[#ff0000]" />
            </HelpTooltip>
          </div>
          <button type="button" className="text-sm text-[#0879d5]">
            Arcadas y Sextantes v
          </button>
        </div>
      </div>

      {showHistoryTable ? (
        <div className="border-t border-[var(--border-default)]">
          <DataTable
            rows={rows as any}
            empty={
              <div className="p-[var(--space-8)] text-center text-[var(--text-secondary)]">
                Sin diagnosticos registrados.
              </div>
            }
            columns={[
              {
                key: "date",
                title: "Fecha",
                render: (row: any) => formatDate(row.date)
              },
              {
                key: "tooth",
                title: "Pieza"
              },
              {
                key: "surface",
                title: "Caras"
              },
              {
                key: "status",
                title: "Estado",
                render: (row: any) => (
                  <div>
                    <p className="font-[var(--weight-medium)] text-[var(--text-primary)]">{row.status}</p>
                    {row.detail ? <p className="mt-1 text-[var(--text-xs)] uppercase text-[var(--text-secondary)]">{row.detail}</p> : null}
                  </div>
                )
              },
              {
                key: "creator",
                title: "Creador"
              },
              {
                key: "recordId",
                title: "Anular",
                render: (row: any) => (
                  row.recordId && onCancelRecord ? (
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] bg-[var(--status-danger-text)] px-2.5 py-1 text-[var(--text-xs)] font-[var(--weight-bold)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity"
                      onClick={() => onCancelRecord(row.recordId)}
                    >
                      Anular
                    </button>
                  ) : (
                    <span className="text-[var(--border-strong)]">-</span>
                  )
                )
              }
            ]}
          />
        </div>
      ) : null}

      <OdontogramContextMenuView
        menu={contextMenu}
        mode={mode}
        selectedCount={actionTeethCount}
        onClose={closeContextMenu}
        onOpenPreexistence={() => handleMenuAction(onOpenPreexistence ?? (() => openModal("preexistence")))}
        onOpenLesion={() => handleMenuAction(onOpenLesion ?? (() => openModal("lesion")))}
        onOpenTreatment={() => handleMenuAction(onOpenProcedureCatalog ?? onOpenTreatment)}
        onOpenInformation={() => handleMenuAction(onOpenInformation)}
        onApplyQuickDiagnosis={(diagnosis) => handleMenuAction(() => onApplyQuickDiagnosis?.(diagnosis))}
        onOpenMultiHelp={() => handleMenuAction(enableMultiSelectMode)}
      />
    </section>
  );
}
