import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { FileText, Image as ImageIcon, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import type { FileAttachment } from "@/features/documents/services/documents.service";
import type {
  OrthodonticClinicalFieldSource,
  OrthodonticDiagnosisResult,
  OrthodonticSummary,
  TreatmentPlanDetail
} from "@/features/treatments/services/treatments.service";
import type { OrthodonticDiagnosisFormValue } from "./orthodontic-diagnosis-modal";
import { formatDate, formatDateTime, finiteNumberValue } from "./treatment-modal-helpers";

export function fieldSourceValue(source?: OrthodonticClinicalFieldSource | null): string {
  return source?.value?.trim() || "";
}

export function clinicalFieldDetail(source?: OrthodonticClinicalFieldSource | null): string | undefined {
  if (!source?.recordedAt) return undefined;
  const professional = source.professionalName ? ` por ${source.professionalName}` : "";
  return `${formatDateTime(source.recordedAt)}${professional}`;
}

export function recordValue(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}


export function addCalendarMonthsInput(value: string, months: number): string {
  if (!value || !months) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const targetMonthIndex = month - 1 + months;
  const lastDay = new Date(year, targetMonthIndex + 1, 0).getDate();
  const date = new Date(year, targetMonthIndex, Math.min(day, lastDay));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function orthodonticStartDurationValue(value?: number | null): number {
  if (value && value >= 3 && value <= 36) return value;
  return 24;
}

export function dateTimeInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function clinicalPlainText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return String(value);
  const row = value as { text?: unknown; plainText?: unknown; root?: { children?: Array<{ text?: unknown }> } };
  if (typeof row.plainText === "string") return row.plainText.trim();
  if (typeof row.text === "string") return row.text.trim();
  if (Array.isArray(row.root?.children)) {
    return row.root.children
      .map((child) => (typeof child.text === "string" ? child.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

export function valueSource(value?: string | null): OrthodonticClinicalFieldSource | null {
  if (!value) return null;
  return { value, recordedAt: null, evolutionId: null, professionalName: null };
}

export function orthodonticStatusLabel(status?: OrthodonticSummary["status"]): string {
  if (status === "NOT_STARTED") return "Tratamiento sin iniciar";
  if (status === "PAUSED") return "Tratamiento pausado";
  if (status === "COMPLETED") return "Tratamiento completado";
  return "Tratamiento activo";
}

export function orthodonticStatusDescription(summary?: OrthodonticSummary | null): string {
  if (!summary || summary.status === "NOT_STARTED") return "El calendario no corre hasta usar Dar inicio.";
  if (summary.status === "PAUSED" && summary.pauseStartDate) {
    return `Pausado desde ${formatDateTime(summary.pauseStartDate)}`;
  }
  if (summary.status === "COMPLETED") return "Tratamiento finalizado.";
  return "Ficha longitudinal para controles, arcos, higiene, alertas y evolucion mas reciente.";
}

export function orthodonticCatalogSelectionsFromProfile(
  profile?: TreatmentPlanDetail["orthodonticProfile"] | null
): Record<string, string[]> {
  const selections: Record<string, string[]> = {};
  for (const value of profile?.fieldValues ?? []) {
    const code = value.field?.code;
    if (code && value.optionId) selections[code] = [value.optionId];
  }
  for (const value of profile?.optionValues ?? []) {
    const code = value.field?.code;
    if (!code || !value.optionId) continue;
    selections[code] = [...(selections[code] ?? []), value.optionId];
  }
  return selections;
}

export const ORTHODONTIC_TECHNICAL_PLAN_FIELDS = [
  "technicalDescription",
  "totalAligners",
  "indicatedExtractions",
  "performedExtractions",
  "reevaluationDate",
  "interconsultations",
  "lastUpperArch",
  "lastLowerArch",
  "hygieneStatus",
  "alert",
  "indications",
  "elastics",
  "planNotes"
] as const;

export function isEmptyOrthodonticProfileValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function isOrthodonticTechnicalPlanEmpty(
  profile?: TreatmentPlanDetail["orthodonticProfile"] | null
): boolean {
  if (!profile) return true;
  const hasScalarValue = ORTHODONTIC_TECHNICAL_PLAN_FIELDS.some(
    (field) => !isEmptyOrthodonticProfileValue(profile[field])
  );
  const hasCatalogValue = Boolean(profile.fieldValues?.length || profile.optionValues?.length);
  return !hasScalarValue && !hasCatalogValue;
}

export function diagnosisFormValuesFromResult(
  result?: OrthodonticDiagnosisResult
): Record<string, OrthodonticDiagnosisFormValue> {
  const values: Record<string, OrthodonticDiagnosisFormValue> = {};
  for (const value of result?.diagnosis?.values ?? []) {
    if (!value.fieldCode) continue;
    values[value.fieldCode] = {
      valueText: value.valueText ?? "",
      valueNumber:
        value.valueNumber !== null && value.valueNumber !== undefined ? String(value.valueNumber) : "",
      optionId: value.optionId ?? "",
      optionIds: value.optionIds ?? []
    };
  }
  return values;
}

export function adaptLegacyOrthodonticSummary(plan: TreatmentPlanDetail): OrthodonticSummary | null {
  const legacy = plan.orthodonticSummary;
  const profile = plan.orthodonticProfile;
  if (!legacy && !profile) return null;

  const startedAt = profile?.startDate ?? null;
  const status: OrthodonticSummary["status"] = !startedAt
    ? "NOT_STARTED"
    : plan.status === "COMPLETED"
      ? "COMPLETED"
      : legacy?.isPaused
        ? "PAUSED"
        : "ACTIVE";
  const latestEvolution = legacy?.latestEvolution
    ? {
        id: legacy.latestEvolution.id,
        createdAt: legacy.latestEvolution.createdAt,
        professionalName: null,
        createdByName: null,
        notes: legacy.latestEvolution.notes,
        plainText:
          clinicalPlainText(legacy.latestEvolution.notes) ||
          clinicalPlainText(legacy.latestEvolution.assessment) ||
          clinicalPlainText(legacy.latestEvolution.objective) ||
          clinicalPlainText(legacy.latestEvolution.plan),
        isPrivate: false,
        fields: [],
        hygiene: null,
        materials: []
      }
    : null;

  return {
    treatmentPlanId: plan.id,
    status,
    startedAt,
    completedAt: plan.completedAt ?? null,
    calendarProgress: status === "NOT_STARTED" ? 0 : (legacy?.calendarProgress ?? 0),
    calendarProgressLabel: status === "NOT_STARTED" ? "Sin iniciar" : "Calculado desde ficha previa",
    elapsedActiveDays: 0,
    elapsedPausedDays: 0,
    realProgress: legacy?.realProgress ?? 0,
    realProgressLabel: "Calculado desde ficha previa",
    realProgressStatus: legacy?.realControlsCount ? "ON_TRACK" : "NO_CONTROLS",
    realControlsCount: legacy?.realControlsCount ?? 0,
    estimatedControls: legacy?.estimatedControls ?? profile?.estimatedControls ?? null,
    estimatedMonths: profile?.estimatedMonths ?? null,
    isPaused: legacy?.isPaused ?? false,
    pauseStartDate: legacy?.pauseStartDate ?? null,
    currentClinicalState: {
      upperArchMaterial: null,
      upperArchSize: valueSource(profile?.lastUpperArch),
      lowerArchMaterial: null,
      lowerArchSize: valueSource(profile?.lastLowerArch),
      upperAligner: null,
      lowerAligner: null,
      elasticsType: valueSource(profile?.elastics),
      elasticsConfig: null,
      nextControl: valueSource(profile?.nextControlAt),
      alert: valueSource(profile?.alert),
      nextSessionInstructions: valueSource(profile?.indications),
      radiographicControl: valueSource(profile?.nextRadiographyAt),
      intraoralPhotos: null,
      extraoralPhotos: null
    },
    hygiene: {
      latestScore: null,
      latestRecordedAt: null,
      trend: "NO_DATA",
      points: []
    },
    latestEvolution,
    recentEvolutions: latestEvolution ? [latestEvolution] : [],
    capabilities: {
      canStart: status === "NOT_STARTED",
      canPause: status === "ACTIVE",
      canResume: status === "PAUSED",
      canComplete: status === "ACTIVE",
      canEdit: true,
      canCreateEvolution: true,
      canViewPrivate: false
    }
  };
}


export function MetricTile({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-h-[92px] rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold leading-tight text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function SummaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

export function ClinicalStateLine({
  label,
  source
}: {
  label: string;
  source?: OrthodonticClinicalFieldSource | null;
}) {
  const value = fieldSourceValue(source);
  return (
    <div className="border-b border-dotted border-slate-200 pb-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-medium text-slate-700">{value || "-"}</span>
      </div>
      {clinicalFieldDetail(source) ? (
        <p className="mt-1 text-right text-[11px] text-slate-400">{clinicalFieldDetail(source)}</p>
      ) : null}
    </div>
  );
}

export function HygieneCurve({
  points
}: {
  points: Array<{
    value: number;
    recordedAt: string;
    professionalName: string | null;
    label?: string | null;
    minimumScore?: number | null;
    maximumScore?: number | null;
  }>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotSize, setPlotSize] = useState({ width: 320, height: 240 });
  const [interaction, setInteraction] = useState<{ index: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      setPlotSize({
        width: Math.max(280, Math.round(rect.width)),
        height: Math.max(220, Math.round(rect.height))
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!points.length) {
    return (
      <p className="text-sm text-slate-500">
        Todavia no existen registros suficientes para mostrar la curva de higiene.
      </p>
    );
  }

  const width = plotSize.width;
  const height = plotSize.height;
  const paddingX = 28;
  const paddingTop = 24;
  const baseline = height - 28;
  const plotWidth = width - paddingX * 2;
  const values = points.map((point) => point.value).filter(Number.isFinite);
  const configuredMin = Math.min(
    ...points.map((point) => finiteNumberValue(point.minimumScore, Number.POSITIVE_INFINITY))
  );
  const configuredMax = Math.max(
    ...points.map((point) => finiteNumberValue(point.maximumScore, Number.NEGATIVE_INFINITY))
  );
  const minValue = Number.isFinite(configuredMin) ? configuredMin : Math.min(1, ...values);
  const maxValue =
    Number.isFinite(configuredMax) && configuredMax > minValue ? configuredMax : Math.max(7, ...values);
  const valueRange = Math.max(1, maxValue - minValue);
  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : points.length === 2
          ? paddingX + plotWidth * (index === 0 ? 0.25 : 0.75)
          : paddingX + (plotWidth / (points.length - 1)) * index;
    const y = paddingTop + ((maxValue - point.value) / valueRange) * (baseline - paddingTop);
    return { ...point, x, y };
  });
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const smoothPath =
    coordinates.length === 1
      ? `M ${width * 0.36} ${first.y} C ${width * 0.44} ${first.y}, ${width * 0.56} ${first.y}, ${width * 0.64} ${first.y}`
      : coordinates.reduce((path, point, index) => {
          if (index === 0) return `M ${point.x} ${point.y}`;
          const previous = coordinates[index - 1];
          const controlX = previous.x + (point.x - previous.x) * 0.5;
          return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
        }, "");
  const areaPath =
    coordinates.length === 1
      ? `${smoothPath} L ${width * 0.64} ${baseline} L ${width * 0.36} ${baseline} Z`
      : `${smoothPath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  const activePoint = interaction ? coordinates[interaction.index] : null;
  const revisionLabel =
    interaction?.index === 0 ? "Revision 0 - Primera" : `Revision ${interaction?.index ?? 0}`;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const tooltipWidth = 172;
  const tooltipHeight = 96;
  const tooltipX = interaction
    ? clamp(
        interaction.x > width - tooltipWidth - 24 ? interaction.x - tooltipWidth - 14 : interaction.x + 14,
        8,
        width - tooltipWidth - 8
      )
    : 0;
  const tooltipY = interaction
    ? clamp(
        interaction.y < tooltipHeight + 24 ? interaction.y + 16 : interaction.y - tooltipHeight - 14,
        8,
        height - tooltipHeight - 8
      )
    : 0;
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = ((event.clientX - rect.left) / rect.width) * width;
    const cursorY = ((event.clientY - rect.top) / rect.height) * height;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach((point, index) => {
      const deltaX = point.x - cursorX;
      const deltaY = point.y - cursorY;
      const distance = deltaX * deltaX + deltaY * deltaY;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setInteraction({
      index: nearestIndex,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-md bg-white"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none text-emerald-500"
        role="img"
        onPointerEnter={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setInteraction(null)}
      >
        <title>Curva de higiene registrada</title>
        <defs>
          <linearGradient id="hygiene-curve-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.82" />
            <stop offset="72%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#hygiene-curve-fill)" />
        <path
          d={smoothPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              y1={activePoint.y}
              x2={activePoint.x}
              y2={baseline}
              stroke="#10b981"
              strokeDasharray="2 3"
              strokeWidth="1"
              opacity="0.38"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="4" fill="#059669" opacity="0.95" />
          </>
        ) : coordinates.length === 1 ? (
          <circle cx={first.x} cy={first.y} r="4" fill="#059669" opacity="0.82" />
        ) : null}
        <line
          x1={paddingX}
          y1={baseline}
          x2={width - paddingX}
          y2={baseline}
          stroke="#d1fae5"
          strokeWidth="1"
        />
        {coordinates.map((point, index) => (
          <circle
            key={`${point.recordedAt}-${point.value}-${index}`}
            cx={point.x}
            cy={point.y}
            r="10"
            fill="transparent"
          >
            <title>{`${point.value}/${maxValue} - ${formatDateTime(point.recordedAt)}${point.label ? ` - ${point.label}` : ""}`}</title>
          </circle>
        ))}
      </svg>
      {interaction && activePoint ? (
        <div
          className="pointer-events-none absolute rounded-md border border-emerald-100 bg-white/95 px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltipX, top: tooltipY, width: tooltipWidth }}
        >
          <p className="font-semibold text-slate-800">{revisionLabel}</p>
          <p className="mt-1 font-semibold text-emerald-700">
            Higiene: {activePoint.value} de {maxValue}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(activePoint.recordedAt)}</p>
          {activePoint.label ? <p className="mt-1 text-[11px] text-slate-500">{activePoint.label}</p> : null}
          {activePoint.professionalName ? (
            <p className="mt-1 truncate text-[11px] text-slate-500">{activePoint.professionalName}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PlanFilesPanel({
  title,
  icon,
  files,
  loading,
  uploading,
  accept,
  onUpload
}: {
  title: string;
  icon: ReactNode;
  files: FileAttachment[];
  loading: boolean;
  uploading: boolean;
  accept: string;
  onUpload: (file?: File) => Promise<void>;
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-sky-50 text-sky-700">{icon}</span>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700">
          <UploadCloud className="h-4 w-4" />
          {uploading ? "Subiendo..." : "Subir archivo"}
          <input
            type="file"
            className="hidden"
            accept={accept}
            disabled={uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              void onUpload(file).finally(() => {
                event.currentTarget.value = "";
              });
            }}
          />
        </label>
      </div>

      {loading ? <LoadingState message="Cargando archivos..." /> : null}
      {!loading && files.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:border-sky-200 hover:bg-sky-50"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-slate-100 text-slate-500">
                  {file.mimeType.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">{file.originalName}</span>
                  <span className="mt-1 block text-xs text-slate-500">{formatDateTime(file.createdAt)}</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : null}
      {!loading && !files.length ? (
        <EmptyState title="Sin archivos" description="Sube archivos asociados a este plan." />
      ) : null}
    </div>
  );
}
