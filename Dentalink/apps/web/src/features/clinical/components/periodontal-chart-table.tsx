import { type ReactNode, useMemo, useState } from "react";
import { Droplet } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PeriodontalMeasurement } from "../services/clinical.service";

const OUTER_POSITIONS = ["MB", "B", "DB"] as const;
const INNER_POSITIONS = ["ML", "L", "DL"] as const;
const ALL_POSITIONS = [...OUTER_POSITIONS, ...INNER_POSITIONS] as const;
const TEETH_UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"] as const;
const TEETH_LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"] as const;
const ALL_TEETH = [...TEETH_UPPER, ...TEETH_LOWER] as const;
const LABEL_WIDTH = 92;
const CHART_WIDTH = 820;
const CENTER_SEPARATOR_WIDTH = 10;
const MEASUREMENT_CELL_WIDTH = (CHART_WIDTH - CENTER_SEPARATOR_WIDTH) / (TEETH_UPPER.length * OUTER_POSITIONS.length);
const PERIODONTAL_SCALE = 8;
const PROBING_DEPTH_MIN = 0;
const PROBING_DEPTH_MAX = 20;
const MARGIN_MIN = -8;
const MARGIN_MAX = 5;
const MOBILITY_MIN = 0;
const MOBILITY_MAX = 4;

type Position = (typeof ALL_POSITIONS)[number];
type Metric = "probingDepth" | "recession";
type ToggleField = "suppuration" | "bleeding";
type FurcationGrade = "" | "I" | "II" | "III";

type ChartRow = {
  section: "upper" | "lower";
  teeth: readonly string[];
  positions: readonly Position[];
  imageSrc: string;
  imageHeight: number;
  labels: [string, string];
  baselines: [number, number];
};

function fdiLabel(toothNumber: string) {
  return `${toothNumber[0]}.${toothNumber[1]}`;
}

function rowKey(toothNumber: string, position: string) {
  return `${toothNumber}-${position}`;
}

function defaultRows() {
  return ALL_TEETH.flatMap((toothNumber) =>
    ALL_POSITIONS.map((position) => ({
      toothNumber,
      position,
      probingDepth: 0,
      bleeding: false,
      plaque: false,
      recession: 0,
      mobility: 0,
      furcation: "",
      suppuration: false
    }))
  );
}

function normalizeRows(value: PeriodontalMeasurement[]) {
  const base = defaultRows();
  if (!value.length) return base;

  const current = new Map(value.map((measurement) => [rowKey(measurement.toothNumber, measurement.position), measurement]));
  return base.map((measurement) => current.get(rowKey(measurement.toothNumber, measurement.position)) ?? measurement);
}

function toothPoints(teeth: readonly string[]) {
  const toothWidth = CHART_WIDTH / teeth.length;
  return teeth.flatMap((toothNumber, toothIndex) => {
    const center = toothIndex * toothWidth + toothWidth / 2;
    return [-0.25, 0, 0.25].map((offset, positionIndex) => ({
      toothNumber,
      positionIndex,
      x: center + toothWidth * offset
    }));
  });
}

function makeSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const centerX = (previous.x + point.x) / 2;
    return `${path} C ${centerX},${previous.y} ${centerX},${point.y} ${point.x},${point.y}`;
  }, `M ${points[0].x},${points[0].y}`);
}

function clampChartY(value: number, imageHeight: number) {
  return Math.max(4, Math.min(imageHeight - 4, value));
}

function clampMeasurementValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeAreaBetweenPaths(topPoints: Array<{ x: number; y: number }>, bottomPoints: Array<{ x: number; y: number }>) {
  const reversedBottom = [...bottomPoints].reverse();
  return `${makeSmoothPath(topPoints)} L ${reversedBottom[0].x},${reversedBottom[0].y} ${makeSmoothPath(reversedBottom).replace(/^M [^C]+/, "")} Z`;
}

function valueClassName(value: number) {
  return value > 3 ? "bg-rose-50 font-semibold text-rose-600" : "bg-transparent text-slate-700";
}

function nextFurcationGrade(value?: string | null): FurcationGrade {
  if (value === "I") return "II";
  if (value === "II") return "III";
  if (value === "III") return "";
  return "I";
}

export function PeriodontalChartTable({
  value,
  onChange
}: {
  value: PeriodontalMeasurement[];
  onChange: (measurements: PeriodontalMeasurement[]) => void;
}) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const rows = useMemo(() => normalizeRows(value), [value]);
  const indexMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((measurement, index) => map.set(rowKey(measurement.toothNumber, measurement.position), index));
    return map;
  }, [rows]);

  const getMeasurement = (toothNumber: string, position: Position) => {
    const index = indexMap.get(rowKey(toothNumber, position));
    return index === undefined ? undefined : rows[index];
  };

  const updateMeasurement = (toothNumber: string, position: Position, patch: Partial<PeriodontalMeasurement>) => {
    const index = indexMap.get(rowKey(toothNumber, position));
    if (index === undefined) return;
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const renderNumericInput = (toothNumber: string, position: Position, metric: Metric) => {
    const measurement = getMeasurement(toothNumber, position);
    const value = metric === "probingDepth" ? measurement?.probingDepth ?? 0 : measurement?.recession ?? 0;
    const min = metric === "probingDepth" ? PROBING_DEPTH_MIN : MARGIN_MIN;
    const max = metric === "probingDepth" ? PROBING_DEPTH_MAX : MARGIN_MAX;
    const inputKey = `${rowKey(toothNumber, position)}-${metric}`;
    const draftValue = draftValues[inputKey];

    return (
      <input
        type="text"
        inputMode="numeric"
        value={draftValue ?? value}
        onChange={(event) => {
          const rawValue = event.target.value.trim();
          if (rawValue === "" || (rawValue === "-" && min < 0)) {
            setDraftValues((current) => ({ ...current, [inputKey]: rawValue }));
            return;
          }
          if (!/^-?\d+$/.test(rawValue)) return;

          const nextValue = clampMeasurementValue(Number(rawValue), min, max);
          setDraftValues((current) => ({ ...current, [inputKey]: String(nextValue) }));
          updateMeasurement(toothNumber, position, metric === "probingDepth" ? { probingDepth: nextValue } : { recession: nextValue });
        }}
        onBlur={() =>
          setDraftValues((current) => {
            const next = { ...current };
            delete next[inputKey];
            return next;
          })
        }
        className={`h-[22px] w-full border-0 p-0 text-center font-mono text-[11px] leading-[22px] outline-none focus:bg-sky-50 ${metric === "probingDepth" ? valueClassName(value) : "bg-transparent text-slate-700"}`}
      />
    );
  };

  const renderToggleButton = (toothNumber: string, position: Position, field: ToggleField) => {
    const active = Boolean(getMeasurement(toothNumber, position)?.[field]);
    const activeClassName = field === "bleeding" ? "bg-rose-50 text-[#c73b3b]" : "bg-amber-50 text-[#f59e0b]";
    const inactiveClassName = field === "bleeding" ? "bg-rose-200" : "bg-amber-200";

    const patch = field === "bleeding" ? { bleeding: !active } : { suppuration: !active };

    return (
      <button
        type="button"
        onClick={() => updateMeasurement(toothNumber, position, patch)}
        className={`flex h-[22px] w-full items-center justify-center transition hover:bg-sky-50 ${active ? activeClassName : ""}`}
        aria-pressed={active}
      >
        <div className="switch-container flex h-full w-full items-center justify-center">
          {active ? (
            <div className={`switch ${field === "bleeding" ? "sangramiento_1" : "exudado_1"} flex h-5 w-5 items-center justify-center rounded bg-white shadow-sm ring-1 ring-current/20`}>
              <Droplet className="h-4 w-4 fill-current stroke-current" strokeWidth={2.2} />
            </div>
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${inactiveClassName}`} />
          )}
        </div>
      </button>
    );
  };

  const renderFurcationButton = (toothNumber: string, position: Position) => {
    const current = getMeasurement(toothNumber, position)?.furcation ?? "";
    const active = Boolean(current);

    return (
      <button
        type="button"
        onClick={() => updateMeasurement(toothNumber, position, { furcation: nextFurcationGrade(current) })}
        className="flex h-[22px] w-full items-center justify-center gap-0.5 transition hover:bg-sky-50"
        aria-pressed={active}
        title="Click para cambiar grado de furca"
      >
        {current === "III" ? (
          <div className="switch-container flex h-full w-full items-center justify-center">
            <div className="switch furca_3 flex items-center justify-center">
              <span className="h-4 w-4 rounded-full border border-slate-900 bg-slate-900 shadow-sm" />
            </div>
          </div>
        ) : current === "II" ? (
          <div className="switch-container flex h-full w-full items-center justify-center">
            <div className="switch furca_2 flex items-center justify-center">
              <span className="relative h-4 w-4 overflow-hidden rounded-full border border-slate-900 bg-white shadow-sm">
                <span className="absolute bottom-0 left-0 top-0 w-1/2 bg-slate-900" />
              </span>
            </div>
          </div>
        ) : current === "I" ? (
          <div className="switch-container flex h-full w-full items-center justify-center">
            <div className="switch furca_1 flex items-center justify-center">
              <span className="h-4 w-4 rounded-full border border-slate-900 bg-white shadow-sm" />
            </div>
          </div>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-sky-200" />
        )}
      </button>
    );
  };

  const renderNic = (toothNumber: string, position: Position) => {
    const measurement = getMeasurement(toothNumber, position);
    const nic = Math.max(0, (measurement?.probingDepth ?? 0) - (measurement?.recession ?? 0));
    return (
      <div className="h-[22px] w-full bg-slate-50 text-center font-mono text-[11px] leading-[22px] text-slate-600">
        {nic}
      </div>
    );
  };

  const renderToothCells = (teeth: readonly string[], renderCells: (toothNumber: string) => ReactNode) =>
    teeth.map((toothNumber, toothIndex) => (
      <FragmentWithSeparator key={toothNumber} toothIndex={toothIndex}>
        {renderCells(toothNumber)}
      </FragmentWithSeparator>
    ));

  const renderColGroup = (teeth: readonly string[]) => (
    <colgroup>
      <col style={{ width: LABEL_WIDTH }} />
      {teeth.map((toothNumber, toothIndex) => (
        <FragmentWithSeparator key={`${toothNumber}-cols`} toothIndex={toothIndex} separatorType="col">
          <>
            {OUTER_POSITIONS.map((position) => (
              <col key={`${toothNumber}-${position}-col`} style={{ width: MEASUREMENT_CELL_WIDTH }} />
            ))}
          </>
        </FragmentWithSeparator>
      ))}
    </colgroup>
  );

  const renderTable = (teeth: readonly string[], positions: readonly Position[]) => (
    <div className="mx-auto w-fit max-w-full overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="border-collapse table-fixed font-mono text-[10px] text-slate-700" style={{ width: LABEL_WIDTH + CHART_WIDTH }}>
        {renderColGroup(teeth)}
        <tbody>
          <tr>
            <td className="h-[22px] border border-slate-200 bg-slate-50 px-2 font-sans text-[10px] font-medium"># Pieza</td>
            {renderToothCells(teeth, (toothNumber) => (
              <td colSpan={3} className="h-[22px] border border-slate-200 bg-slate-50 text-center font-semibold">
                {fdiLabel(toothNumber)}
              </td>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[9px] text-[#3a5ccc]">Profundidad Surco</td>
            {renderToothCells(teeth, (toothNumber) => (
              <>
                {positions.map((position) => (
                  <td key={`${toothNumber}-${position}-surco`} className="h-[22px] border border-slate-200 p-0">
                    {renderNumericInput(toothNumber, position, "probingDepth")}
                  </td>
                ))}
              </>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[10px] text-[#cc3a3a]">Margen</td>
            {renderToothCells(teeth, (toothNumber) => (
              <>
                {positions.map((position) => (
                  <td key={`${toothNumber}-${position}-margen`} className="h-[22px] border border-slate-200 p-0">
                    {renderNumericInput(toothNumber, position, "recession")}
                  </td>
                ))}
              </>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[10px] font-semibold text-slate-900">NIC</td>
            {renderToothCells(teeth, (toothNumber) => (
              <>
                {positions.map((position) => (
                  <td key={`${toothNumber}-${position}-nic`} className="h-[22px] border border-slate-200 p-0">
                    {renderNic(toothNumber, position)}
                  </td>
                ))}
              </>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[10px] text-sky-700">Furca</td>
            {renderToothCells(teeth, (toothNumber) => (
              <>
                {positions.map((position) => (
                  <td key={`${toothNumber}-${position}-furca`} className="h-[22px] border border-slate-200 p-0">
                    {renderFurcationButton(toothNumber, position)}
                  </td>
                ))}
              </>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[10px] text-amber-600">Exudado</td>
            {renderToothCells(teeth, (toothNumber) => (
              <>
                {positions.map((position) => (
                  <td key={`${toothNumber}-${position}-exudado`} className="h-[22px] border border-slate-200 p-0">
                    {renderToggleButton(toothNumber, position, "suppuration")}
                  </td>
                ))}
              </>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[10px] text-rose-600">Sangramiento</td>
            {renderToothCells(teeth, (toothNumber) => (
              <>
                {positions.map((position) => (
                  <td key={`${toothNumber}-${position}-sangramiento`} className="h-[22px] border border-slate-200 p-0">
                    {renderToggleButton(toothNumber, position, "bleeding")}
                  </td>
                ))}
              </>
            ))}
          </tr>

          <tr>
            <td className="h-[22px] border border-slate-200 px-2 font-sans text-[10px]">Movilidad</td>
            {renderToothCells(teeth, (toothNumber) => (
              <td colSpan={3} className="h-[22px] border border-slate-200 p-0">
                <input
                  type="number"
                  min={MOBILITY_MIN}
                  max={MOBILITY_MAX}
                  value={getMeasurement(toothNumber, positions[1])?.mobility ?? 0}
                  onChange={(event) => {
                    const nextValue = clampMeasurementValue(Number(event.target.value), MOBILITY_MIN, MOBILITY_MAX);
                    if (Number.isNaN(nextValue)) return;
                    updateMeasurement(toothNumber, positions[1], { mobility: nextValue });
                  }}
                  className="h-[22px] w-full border-0 bg-transparent p-0 text-center font-mono text-[10px] outline-none focus:bg-sky-50"
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  const chartRows: ChartRow[] = [
    {
      section: "upper",
      teeth: TEETH_UPPER,
      positions: OUTER_POSITIONS,
      imageSrc: "/periodontograma_arcada_superior.png",
      imageHeight: 320,
      labels: ["Vestibular", "Palatina"],
      baselines: [94, 254]
    },
    {
      section: "lower",
      teeth: TEETH_LOWER,
      positions: OUTER_POSITIONS,
      imageSrc: "/periodontograma_arcada_inferior.png",
      imageHeight: 294,
      labels: ["Vestibular", "Lingual"],
      baselines: [57, 204]
    }
  ];

  const renderChart = ({ section, teeth, imageSrc, imageHeight, labels, baselines }: ChartRow) => {
    const rowHeight = imageHeight / 2;
    const positionGroups = [OUTER_POSITIONS, INNER_POSITIONS] as const;

    return (
      <div className="mx-auto w-fit max-w-full overflow-x-auto rounded border border-slate-200 bg-white py-2">
        <div className="grid w-max" style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${CHART_WIDTH}px` }}>
          <div className="grid text-center font-sans text-sm font-medium text-slate-600" style={{ height: imageHeight, gridTemplateRows: `repeat(2, ${rowHeight}px)` }}>
            {labels.map((label) => (
              <div key={`${section}-${label}`} className="flex items-center justify-center">
                {label}
              </div>
            ))}
          </div>

          <div
            className="relative overflow-hidden bg-white"
            style={{
              width: CHART_WIDTH,
              height: imageHeight,
              backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 7px, #dbe3ea 8px, #dbe3ea 9px)"
            }}
          >
            {baselines.map((baseline, index) => (
              <div key={`${section}-baseline-${index}`} className="absolute left-0 right-0 z-10 border-t-2 border-[#cc3a3a]" style={{ top: baseline }} />
            ))}
            <img src={imageSrc} alt="" className="absolute inset-0 z-20 h-full w-full object-fill" />
            {positionGroups.map((positions, groupIndex) => (
              <MeasurementOverlay
                key={`${section}-${groupIndex}`}
                teeth={teeth}
                positions={positions}
                baseline={baselines[groupIndex]}
                arch={section}
                imageHeight={imageHeight}
                getMeasurement={getMeasurement}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="space-y-7 p-4">
      <section className="space-y-3">
        <div className="mx-auto max-w-[912px]">
          <h3 className="mb-3 text-base font-semibold text-slate-800">Maxilar superior</h3>
          <div className="space-y-3">
            {renderTable(TEETH_UPPER, OUTER_POSITIONS)}
            {renderChart(chartRows[0])}
            {renderTable(TEETH_UPPER, INNER_POSITIONS)}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="mx-auto max-w-[912px]">
          <h3 className="mb-3 text-base font-semibold text-slate-800">Maxilar inferior</h3>
          <div className="space-y-3">
            {renderTable(TEETH_LOWER, OUTER_POSITIONS)}
            {renderChart(chartRows[1])}
            {renderTable(TEETH_LOWER, INNER_POSITIONS)}
          </div>
        </div>
      </section>
    </Card>
  );
}

function FragmentWithSeparator({
  toothIndex,
  separatorType = "td",
  children
}: {
  toothIndex: number;
  separatorType?: "col" | "td";
  children: ReactNode;
}) {
  return (
    <>
      {toothIndex === 8 && separatorType === "col" ? <col style={{ width: CENTER_SEPARATOR_WIDTH }} /> : null}
      {toothIndex === 8 && separatorType === "td" ? <td className="border-x-2 border-slate-500 bg-slate-100" /> : null}
      {children}
    </>
  );
}

function MeasurementOverlay({
  teeth,
  positions,
  baseline,
  arch,
  imageHeight,
  getMeasurement
}: {
  teeth: readonly string[];
  positions: readonly Position[];
  baseline: number;
  arch: "upper" | "lower";
  imageHeight: number;
  getMeasurement: (toothNumber: string, position: Position) => PeriodontalMeasurement | undefined;
}) {
  const crownDirection = arch === "upper" ? 1 : -1;
  const rootDirection = arch === "upper" ? -1 : 1;
  const points = toothPoints(teeth);
  const recessionPoints = points.map(({ toothNumber, positionIndex, x }) => {
    const measurement = getMeasurement(toothNumber, positions[positionIndex]);
    return {
      x,
      y: clampChartY(baseline + crownDirection * (measurement?.recession ?? 0) * PERIODONTAL_SCALE, imageHeight)
    };
  });
  const probingPoints = points.map(({ toothNumber, positionIndex, x }, index) => {
    const measurement = getMeasurement(toothNumber, positions[positionIndex]);
    return {
      x,
      y: clampChartY(recessionPoints[index].y + rootDirection * (measurement?.probingDepth ?? 0) * PERIODONTAL_SCALE, imageHeight)
    };
  });
  const hasProbingValues = probingPoints.some((point) => Math.abs(point.y - baseline) > 0.1);
  const hasRecessionValues = recessionPoints.some((point) => Math.abs(point.y - baseline) > 0.1);

  if (!hasProbingValues && !hasRecessionValues) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox={`0 0 ${CHART_WIDTH} ${imageHeight}`} preserveAspectRatio="none">
      {hasProbingValues ? (
        <path
          d={makeAreaBetweenPaths(probingPoints, recessionPoints)}
          fill="#3a5ccc"
          fillOpacity="0.16"
        />
      ) : null}
      {hasProbingValues ? <path d={makeSmoothPath(probingPoints)} fill="none" stroke="#3a5ccc" strokeWidth="2" /> : null}
      {hasRecessionValues ? <path d={makeSmoothPath(recessionPoints)} fill="none" stroke="#cc3a3a" strokeWidth="2" /> : null}
    </svg>
  );
}
