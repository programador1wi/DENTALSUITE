import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Eye, EyeOff, Info, Minus, Pencil, Plus, Save, ScanLine, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import {
  getPatientFileBlob,
  type FileAttachment,
  type RadiographyAnalysis,
  type RadiographyFinding
} from "@/features/documents/services/documents.service";
import {
  usePatientRadiographyAnalysis,
  useRadiographyAnalysisMutations
} from "@/features/documents/hooks/use-documents";

type SidebarTab = "analysis" | "info";
type ImageSize = { width: number; height: number };
type ImageLayerMetrics = { left: number; top: number; width: number; height: number };

const minZoom = 1;
const maxZoom = 2.5;
const zoomStep = 0.25;
const minBoxSize = 0.02;

const findingCatalog = [
  "Implante",
  "Muela del juicio",
  "Cavidad",
  "Empaste no metalico",
  "Calculo dental",
  "Corona",
  "Tratamiento de conducto",
  "Ausente",
  "Otro"
];

export function isRadiographyViewerFile(file: FileAttachment | null | undefined) {
  return Boolean(file && file.category === "XRAY" && file.mimeType.startsWith("image/"));
}

export function RadiographyViewerModal({
  file,
  patientId,
  patientName,
  onClose
}: {
  file: FileAttachment | null;
  patientId: string;
  patientName?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(minZoom);
  const [tab, setTab] = useState<SidebarTab>("analysis");
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [findings, setFindings] = useState<RadiographyFinding[]>([]);
  const [savedFindings, setSavedFindings] = useState<RadiographyFinding[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const analysis = usePatientRadiographyAnalysis(patientId, file?.id);
  const { savePatientRadiographyAnalysis } = useRadiographyAnalysisMutations();

  useEffect(() => {
    if (!file) return;
    setZoom(minZoom);
    setTab("analysis");
    setLabelsVisible(true);
    setFindings([]);
    setSavedFindings([]);
    setIsEditing(false);
    setSelectedFindingId(null);
    setValidationMessage("");
  }, [file?.id, file]);

  useEffect(() => {
    if (!file || analysis.isLoading) return;
    const nextFindings = normalizePersistedFindings(analysis.data);
    setFindings(nextFindings);
    setSavedFindings(nextFindings);
    setIsEditing(false);
    setSelectedFindingId(nextFindings[0]?.id ?? null);
    setValidationMessage("");
  }, [analysis.data, analysis.isLoading, file]);

  useEffect(() => {
    if (!file) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, onClose]);

  const visibleCount = useMemo(() => findings.filter((finding) => finding.visible).length, [findings]);

  if (!file) return null;

  const zoomOutDisabled = zoom <= minZoom;
  const zoomInDisabled = zoom >= maxZoom;
  const isSaving = savePatientRadiographyAnalysis.isPending;

  const updateFinding = (findingId: string, patch: Partial<RadiographyFinding>) => {
    setValidationMessage("");
    setFindings((current) => current.map((finding) => (finding.id === findingId ? { ...finding, ...patch } : finding)));
  };

  const updateFindingBbox = (findingId: string, bbox: RadiographyFinding["bbox"]) => {
    setFindings((current) => current.map((finding) => (finding.id === findingId ? { ...finding, bbox } : finding)));
  };

  const createFinding = (bbox?: RadiographyFinding["bbox"]) => {
    const finding = createManualFinding(bbox);
    setValidationMessage("");
    setFindings((current) => [...current, finding]);
    setSelectedFindingId(finding.id);
    setIsEditing(true);
    return finding.id;
  };

  const removeFinding = (findingId: string) => {
    setFindings((current) => {
      const next = current.filter((finding) => finding.id !== findingId);
      setSelectedFindingId((selected) => (selected === findingId ? next[0]?.id ?? null : selected));
      return next;
    });
  };

  const cancelEditing = () => {
    setFindings(savedFindings);
    setSelectedFindingId(savedFindings[0]?.id ?? null);
    setIsEditing(false);
    setValidationMessage("");
  };

  const saveAnalysis = async () => {
    const hasIncompleteFinding = findings.some((finding) => !finding.tooth.trim() || !finding.label.trim());
    if (hasIncompleteFinding) {
      setValidationMessage("Completa pieza y hallazgo antes de guardar.");
      return;
    }

    const saved = await savePatientRadiographyAnalysis.mutateAsync({
      patientId,
      fileId: file.id,
      findings: findings.map((finding) => ({
        ...finding,
        tooth: finding.tooth.trim(),
        label: finding.label.trim(),
        source: "MANUAL"
      })),
      status: "DRAFT"
    });
    const nextFindings = normalizePersistedFindings(saved);
    setFindings(nextFindings);
    setSavedFindings(nextFindings);
    setSelectedFindingId(nextFindings[0]?.id ?? null);
    setIsEditing(false);
    setValidationMessage("");
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[#07111f] text-white" role="dialog" aria-modal="true" aria-label="Visor radiografico">
      <div className="flex h-full min-h-0 flex-col">
        <ViewerHeader
          file={file}
          patientName={patientName}
          zoom={zoom}
          zoomOutDisabled={zoomOutDisabled}
          zoomInDisabled={zoomInDisabled}
          onZoomIn={() => setZoom((current) => Math.min(maxZoom, current + zoomStep))}
          onZoomOut={() => setZoom((current) => Math.max(minZoom, current - zoomStep))}
          onShowInfo={() => setTab("info")}
          onClose={onClose}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[#0b1220] lg:grid-cols-[minmax(0,1fr)_420px]">
          <RadiographyCanvas
            file={file}
            findings={findings}
            labelsVisible={labelsVisible}
            zoom={zoom}
            isEditing={isEditing}
            selectedFindingId={selectedFindingId}
            onSelectFinding={setSelectedFindingId}
            onCreateFinding={createFinding}
            onChangeFindingBbox={updateFindingBbox}
          />
          <RadiographyAnalysisSidebar
            file={file}
            tab={tab}
            onTabChange={setTab}
            findings={findings}
            selectedFindingId={selectedFindingId}
            visibleCount={visibleCount}
            labelsVisible={labelsVisible}
            isEditing={isEditing}
            isLoading={analysis.isLoading}
            isSaving={isSaving}
            validationMessage={validationMessage}
            hasSavedAnalysis={Boolean(analysis.data)}
            onToggleLabels={() => setLabelsVisible((current) => !current)}
            onToggleFinding={(findingId) =>
              setFindings((current) =>
                current.map((finding) => (finding.id === findingId ? { ...finding, visible: !finding.visible } : finding))
              )
            }
            onSelectFinding={setSelectedFindingId}
            onUpdateFinding={updateFinding}
            onAddFinding={() => createFinding()}
            onRemoveFinding={removeFinding}
            onStartEditing={() => setIsEditing(true)}
            onCancelEditing={cancelEditing}
            onSaveAnalysis={saveAnalysis}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function ViewerHeader({
  file,
  patientName,
  zoom,
  zoomOutDisabled,
  zoomInDisabled,
  onZoomIn,
  onZoomOut,
  onShowInfo,
  onClose
}: {
  file: FileAttachment;
  patientName?: string;
  zoom: number;
  zoomOutDisabled: boolean;
  zoomInDisabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShowInfo: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex min-h-[72px] flex-col gap-3 border-b border-white/10 bg-[#101827] px-4 py-3 shadow-lg lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[var(--text-base)] font-semibold text-white">{file.originalName}</p>
        <p className="mt-0.5 truncate text-[var(--text-sm)] text-slate-300">{patientName || "Paciente sin nombre disponible"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-white/10 bg-white/5 p-1">
          <IconButton label="Alejar" disabled={zoomOutDisabled} onClick={onZoomOut}>
            <Minus size={16} />
          </IconButton>
          <span className="min-w-[52px] px-2 text-center text-[var(--text-xs)] font-semibold text-slate-200">{Math.round(zoom * 100)}%</span>
          <IconButton label="Acercar" disabled={zoomInDisabled} onClick={onZoomIn}>
            <Plus size={16} />
          </IconButton>
        </div>
        <IconButton label="Abrir externo" onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}>
          <ExternalLink size={16} />
        </IconButton>
        <IconButton label="Informacion del archivo" onClick={onShowInfo}>
          <Info size={16} />
        </IconButton>
        <IconButton label="Eliminar no disponible en demo" disabled onClick={() => undefined}>
          <Trash2 size={16} />
        </IconButton>
        <IconButton label="Cerrar visor" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
    </header>
  );
}

function RadiographyCanvas({
  file,
  findings,
  labelsVisible,
  zoom,
  isEditing,
  selectedFindingId,
  onSelectFinding,
  onCreateFinding,
  onChangeFindingBbox
}: {
  file: FileAttachment;
  findings: RadiographyFinding[];
  labelsVisible: boolean;
  zoom: number;
  isEditing: boolean;
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
  onCreateFinding: (bbox?: RadiographyFinding["bbox"]) => string;
  onChangeFindingBbox: (findingId: string, bbox: RadiographyFinding["bbox"]) => void;
}) {
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef<{ findingId: string; startX: number; startY: number } | null>(null);
  const needsSecureFetch = isManagedFileUrl(file.url);

  useEffect(() => {
    setNaturalSize(null);
    if (!needsSecureFetch) {
      setObjectUrl("");
      setFailed(false);
      return;
    }

    let disposed = false;
    let nextUrl = "";
    setFailed(false);

    void getPatientFileBlob(file)
      .then((blob) => {
        if (disposed) return;
        nextUrl = URL.createObjectURL(blob);
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [file, needsSecureFetch]);

  const source = objectUrl || (!needsSecureFetch ? file.url : "");
  const imageLayerStyle = getImageLayerStyle(containerRef.current, naturalSize);

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = containerRef.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const layer = getImageLayerMetrics(rect.width, rect.height, naturalSize);
    const x = (event.clientX - rect.left - layer.left) / layer.width;
    const y = (event.clientY - rect.top - layer.top) / layer.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: clamp01(x), y: clamp01(y) };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const findingId =
      selectedFindingId ||
      onCreateFinding({
        x: Math.max(0, point.x - 0.05),
        y: Math.max(0, point.y - 0.05),
        width: 0.1,
        height: 0.1
      });
    drawingRef.current = { findingId, startX: point.x, startY: point.y };
    onSelectFinding(findingId);
    onChangeFindingBbox(findingId, normalizeDraftBox(point.x, point.y, point.x + minBoxSize, point.y + minBoxSize));
  };

  const continueDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    onChangeFindingBbox(drawing.findingId, normalizeDraftBox(drawing.startX, drawing.startY, point.x, point.y));
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <main className="min-h-[440px] overflow-auto bg-[#080d16] p-4 lg:min-h-0" data-responsive-overflow="contained" aria-label="Visor radiográfico desplazable">
      <div className="flex h-full min-h-[420px] items-center justify-center">
        <div
          ref={containerRef}
          className={cn(
            "relative aspect-[16/10] w-full max-w-[1180px] origin-center overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-black shadow-2xl transition-transform",
            isEditing && "cursor-crosshair ring-1 ring-emerald-300/50"
          )}
          style={{ transform: `scale(${zoom})` }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        >
          {source && !failed ? (
            <img
              src={source}
              alt={file.originalName}
              draggable={false}
              className="h-full w-full select-none object-contain"
              onLoad={(event) => {
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight
                });
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
              <ScanLine size={42} />
              <p className="text-[var(--text-sm)] font-semibold">{failed ? "No se pudo cargar la radiografia" : "Cargando radiografia..."}</p>
            </div>
          )}
          <div className="pointer-events-none absolute" style={imageLayerStyle}>
            {labelsVisible
              ? findings
                  .filter((finding) => finding.visible)
                  .map((finding) => (
                    <FindingOverlay
                      key={finding.id}
                      finding={finding}
                      selected={finding.id === selectedFindingId}
                      isEditing={isEditing}
                      onSelect={() => onSelectFinding(finding.id)}
                    />
                  ))
              : null}
          </div>
          {isEditing ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-[var(--radius-md)] bg-slate-950/80 px-3 py-2 text-[var(--text-xs)] font-semibold text-slate-100 shadow-lg">
              Dibuja una caja sobre la imagen para ubicar el hallazgo seleccionado
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function FindingOverlay({
  finding,
  selected,
  isEditing,
  onSelect
}: {
  finding: RadiographyFinding;
  selected: boolean;
  isEditing: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto absolute rounded-[var(--radius-sm)] border-2 border-amber-300 bg-amber-300/10 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
        selected && "border-emerald-300 bg-emerald-300/15 shadow-[0_0_0_2px_rgba(16,185,129,0.38)]",
        isEditing ? "cursor-pointer" : "cursor-default"
      )}
      data-testid={`finding-overlay-${finding.id}`}
      style={{
        left: `${finding.bbox.x * 100}%`,
        top: `${finding.bbox.y * 100}%`,
        width: `${finding.bbox.width * 100}%`,
        height: `${finding.bbox.height * 100}%`
      }}
      onPointerDown={(event) => {
        if (!isEditing) return;
        event.stopPropagation();
        onSelect();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (isEditing) onSelect();
      }}
      aria-label={`Seleccionar ${finding.tooth || "pieza sin asignar"} ${finding.label}`}
    >
      <span
        className={cn(
          "absolute -top-6 left-0 max-w-[190px] truncate rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-semibold shadow-sm",
          selected ? "bg-emerald-300 text-slate-950" : "bg-amber-300 text-slate-950"
        )}
      >
        {finding.tooth || "--"} {finding.label}
      </span>
    </button>
  );
}

function RadiographyAnalysisSidebar({
  file,
  tab,
  onTabChange,
  findings,
  selectedFindingId,
  visibleCount,
  labelsVisible,
  isEditing,
  isLoading,
  isSaving,
  validationMessage,
  hasSavedAnalysis,
  onToggleLabels,
  onToggleFinding,
  onSelectFinding,
  onUpdateFinding,
  onAddFinding,
  onRemoveFinding,
  onStartEditing,
  onCancelEditing,
  onSaveAnalysis
}: {
  file: FileAttachment;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  findings: RadiographyFinding[];
  selectedFindingId: string | null;
  visibleCount: number;
  labelsVisible: boolean;
  isEditing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  validationMessage: string;
  hasSavedAnalysis: boolean;
  onToggleLabels: () => void;
  onToggleFinding: (findingId: string) => void;
  onSelectFinding: (findingId: string) => void;
  onUpdateFinding: (findingId: string, patch: Partial<RadiographyFinding>) => void;
  onAddFinding: () => void;
  onRemoveFinding: (findingId: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveAnalysis: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="grid grid-cols-2 border-b border-[var(--border-default)]">
        <button
          type="button"
          className={cn(
            "flex items-center justify-center gap-2 px-3 py-4 text-[var(--text-sm)] font-semibold",
            tab === "analysis" ? "border-b-2 border-[var(--border-brand)] text-[var(--text-brand)]" : "text-[var(--text-secondary)]"
          )}
          onClick={() => onTabChange("analysis")}
        >
          Analisis RX
          <span className="rounded-full bg-[var(--bg-brand-light)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--text-brand)]">{findings.length}</span>
        </button>
        <button
          type="button"
          className={cn(
            "px-3 py-4 text-[var(--text-sm)] font-semibold",
            tab === "info" ? "border-b-2 border-[var(--border-brand)] text-[var(--text-brand)]" : "text-[var(--text-secondary)]"
          )}
          onClick={() => onTabChange("info")}
        >
          Informacion del archivo
        </button>
      </div>

      {tab === "analysis" ? (
        <>
          <div className="border-b border-[var(--border-default)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Analisis manual RX</p>
                <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">
                  {hasSavedAnalysis ? "Hallazgos guardados para esta radiografia" : "Sin analisis guardado para esta radiografia"}
                </p>
              </div>
              {isEditing ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[var(--text-xs)] font-semibold text-emerald-700">Editando</span>
              ) : null}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-[58px_1fr_38px_38px] border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-2 text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">
              <span>Pieza</span>
              <span>Hallazgo</span>
              <span className="text-center">Ver</span>
              <span className="text-center">{isEditing ? "Del" : ""}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <EmptyAnalysisState title="Cargando analisis..." description="Consultando hallazgos guardados." />
              ) : findings.length === 0 ? (
                <EmptyAnalysisState
                  title="Sin hallazgos"
                  description={isEditing ? "Agrega un hallazgo y dibuja su caja sobre la radiografia." : "Activa la edicion para crear un analisis manual."}
                />
              ) : (
                findings.map((finding) => (
                  <FindingRow
                    key={finding.id}
                    finding={finding}
                    selected={finding.id === selectedFindingId}
                    isEditing={isEditing}
                    onSelect={() => onSelectFinding(finding.id)}
                    onToggle={() => onToggleFinding(finding.id)}
                    onUpdate={(patch) => onUpdateFinding(finding.id, patch)}
                    onRemove={() => onRemoveFinding(finding.id)}
                  />
                ))
              )}
              <div className="grid grid-cols-[1fr_46px] items-center gap-2 px-4 py-3">
                <span className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Capa etiquetas</span>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-brand)] transition hover:bg-[var(--bg-brand-light)]"
                  onClick={onToggleLabels}
                  aria-label={labelsVisible ? "Ocultar capa etiquetas" : "Mostrar capa etiquetas"}
                >
                  {labelsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t border-[var(--border-default)] p-4">
            {isEditing ? (
              <Button type="button" variant="secondary" className="w-full" onClick={onAddFinding}>
                <Plus size={16} />
                Agregar hallazgo
              </Button>
            ) : null}
            {validationMessage ? <p className="rounded-[var(--radius-md)] bg-red-50 px-3 py-2 text-[var(--text-xs)] font-semibold text-red-700">{validationMessage}</p> : null}
            <p className="text-[var(--text-xs)] font-semibold text-[var(--text-brand)]">{visibleCount} hallazgos visibles</p>
            <p className="text-[var(--text-xs)] leading-relaxed text-[var(--text-secondary)]">
              El analisis manual de radiografias debe ser registrado y validado por un profesional de la salud calificado. La IA podra generar borradores editables en una fase posterior.
            </p>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={onCancelEditing} disabled={isSaving}>
                  <Undo2 size={16} />
                  Cancelar
                </Button>
                <Button type="button" onClick={onSaveAnalysis} disabled={isSaving}>
                  <Save size={16} />
                  {isSaving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={onStartEditing}>
                <Pencil size={16} />
                {findings.length > 0 ? "Editar analisis" : "Crear analisis"}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3 p-4">
          <DetailItem label="Creado" value={new Date(file.createdAt).toLocaleString("es-MX")} />
          <DetailItem label="Tipo" value="Radiografia" />
          <DetailItem label="Nombre" value={file.originalName} />
          <DetailItem label="Formato" value={file.mimeType} />
          <DetailItem label="Tamano" value={formatBytes(file.size)} />
        </div>
      )}
    </aside>
  );
}

function FindingRow({
  finding,
  selected,
  isEditing,
  onSelect,
  onToggle,
  onUpdate,
  onRemove
}: {
  finding: RadiographyFinding;
  selected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<RadiographyFinding>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[58px_1fr_38px_38px] items-center gap-2 border-b border-[var(--border-default)] px-4 py-3",
        selected && "bg-emerald-50/80"
      )}
    >
      {isEditing ? (
        <Input
          value={finding.tooth}
          onChange={(event) => onUpdate({ tooth: event.target.value })}
          onFocus={onSelect}
          className="h-8 px-2 text-center"
          placeholder="FDI"
          aria-label={`Pieza ${finding.id}`}
        />
      ) : (
        <button type="button" className="text-left text-[var(--text-sm)] font-semibold text-[var(--text-primary)]" onClick={onSelect}>
          {finding.tooth || "--"}
        </button>
      )}
      {isEditing ? (
        <Select
          value={finding.label}
          onChange={(event) => onUpdate({ label: event.target.value })}
          onFocus={onSelect}
          className="h-8 truncate px-2"
          aria-label={`Hallazgo ${finding.id}`}
        >
          {findingCatalog.includes(finding.label) ? null : <option value={finding.label}>{finding.label}</option>}
          {findingCatalog.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </Select>
      ) : (
        <button
          type="button"
          className="min-w-0 truncate rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-1 text-left text-[var(--text-sm)] text-[var(--text-primary)]"
          onClick={onSelect}
        >
          {finding.label}
        </button>
      )}
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-brand)] transition hover:bg-[var(--bg-brand-light)]"
        onClick={onToggle}
        aria-label={`${finding.visible ? "Ocultar" : "Mostrar"} ${finding.tooth || "pieza"} ${finding.label}`}
      >
        {finding.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      {isEditing ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-red-600 transition hover:bg-red-50"
          onClick={onRemove}
          aria-label={`Eliminar ${finding.tooth || "pieza"} ${finding.label}`}
        >
          <Trash2 size={16} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function EmptyAnalysisState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-brand)]">
        <ScanLine size={18} />
      </span>
      <p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="max-w-[280px] text-[var(--text-xs)] leading-relaxed text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white p-3">
      <p className="text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 break-words text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function normalizePersistedFindings(analysis: RadiographyAnalysis | null | undefined) {
  return (analysis?.findings ?? []).map((finding) => ({
    id: finding.id,
    tooth: finding.tooth,
    label: finding.label,
    bbox: normalizeBox(finding.bbox),
    visible: finding.visible !== false,
    source: finding.source ?? "MANUAL"
  }));
}

function createManualFinding(bbox?: RadiographyFinding["bbox"]): RadiographyFinding {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tooth: "",
    label: "Cavidad",
    bbox: bbox ?? { x: 0.45, y: 0.45, width: 0.1, height: 0.12 },
    visible: true,
    source: "MANUAL"
  };
}

function normalizeDraftBox(startX: number, startY: number, endX: number, endY: number) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.max(Math.abs(endX - startX), minBoxSize);
  const height = Math.max(Math.abs(endY - startY), minBoxSize);
  return normalizeBox({ x: left, y: top, width, height });
}

function normalizeBox(box: RadiographyFinding["bbox"]) {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  return {
    x: Math.min(0.99, x),
    y: Math.min(0.99, y),
    width: Math.min(1 - Math.min(0.99, x), Math.max(0.01, box.width)),
    height: Math.min(1 - Math.min(0.99, y), Math.max(0.01, box.height))
  };
}

function getImageLayerStyle(container: HTMLDivElement | null, naturalSize: ImageSize | null) {
  const metrics = getImageLayerMetrics(container?.clientWidth ?? 0, container?.clientHeight ?? 0, naturalSize);
  return {
    left: `${metrics.left}px`,
    top: `${metrics.top}px`,
    width: `${metrics.width}px`,
    height: `${metrics.height}px`
  };
}

function getImageLayerMetrics(containerWidth: number, containerHeight: number, naturalSize: ImageSize | null): ImageLayerMetrics {
  if (!containerWidth || !containerHeight || !naturalSize?.width || !naturalSize.height) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight };
  }

  const imageAspect = naturalSize.width / naturalSize.height;
  const containerAspect = containerWidth / containerHeight;
  if (containerAspect > imageAspect) {
    const height = containerHeight;
    const width = height * imageAspect;
    return { left: (containerWidth - width) / 2, top: 0, width, height };
  }

  const width = containerWidth;
  const height = width / imageAspect;
  return { left: 0, top: (containerHeight - height) / 2, width, height };
}

function isManagedFileUrl(url: string) {
  return url.startsWith("/patients/") || url.startsWith("/api/v1/patients/") || url.includes("/api/v1/patients/");
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
