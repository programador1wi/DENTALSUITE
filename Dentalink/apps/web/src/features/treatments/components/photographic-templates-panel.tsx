import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Expand,
  Eye,
  GitCompareArrows,
  ImagePlus,
  Link2,
  MoreHorizontal,
  Plus,
  QrCode,
  RotateCcw,
  Settings2,
  Smartphone,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils/cn";
import {
  usePhotographicAvailableLinks,
  usePhotographicTemplateMutations,
  usePhotographicTemplates
} from "../hooks/use-photographic-templates";
import {
  getPhotographicFileBlob,
  auditPhotographicComparison,
  type PhotographicFile,
  type PhotographicFrequency,
  type PhotographicImageTransformations,
  type PhotographicLinkedEntityType,
  type PhotographicSession,
  type PhotographicSessionImage,
  type PhotographicSessionType,
  type PhotographicSlot
} from "../services/photographic-templates.service";

const SESSION_TYPE_LABELS: Record<PhotographicSessionType, string> = {
  INITIAL: "Inicial",
  FOLLOW_UP: "Seguimiento",
  REEVALUATION: "Reevaluacion",
  FINAL: "Final",
  CUSTOM: "Personalizada",
  IMPORTED: "Importada"
};

const STATUS_LABELS = {
  DRAFT: "Borrador",
  INCOMPLETE: "Incompleta",
  COMPLETE: "Completa",
  ARCHIVED: "Archivada",
  VOIDED: "Anulada"
} as const;

const FREQUENCIES: Array<{ value: PhotographicFrequency; label: string }> = [
  { value: "NONE", label: "Sin frecuencia" },
  { value: "EVERY_CONTROL", label: "Cada control" },
  { value: "EVERY_3_MONTHS", label: "Cada 3 meses" },
  { value: "EVERY_6_MONTHS", label: "Cada 6 meses" },
  { value: "EVERY_12_MONTHS", label: "Cada 12 meses" },
  { value: "INITIAL_AND_FINAL", label: "Inicial y final" },
  { value: "CUSTOM", label: "Personalizada" }
];

const DEFAULT_TRANSFORMATIONS: PhotographicImageTransformations = {
  rotation: 0,
  cropX: 0,
  cropY: 0,
  cropWidth: 1,
  cropHeight: 1,
  zoom: 1,
  brightness: 1,
  contrast: 1
};

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function useObjectUrl(file?: PhotographicFile | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setUrl(undefined);
    if (!file) return;
    void getPhotographicFileBlob(file)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl(undefined);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file?.id]);
  return url;
}

function imageDisplayFile(image?: PhotographicSessionImage | null) {
  return image?.editedFile ?? image?.previewFile ?? image?.thumbnailFile ?? image?.originalFile;
}

function PhotoAsset({
  image,
  contain = false,
  className
}: {
  image?: PhotographicSessionImage | null;
  contain?: boolean;
  className?: string;
}) {
  const url = useObjectUrl(imageDisplayFile(image));
  if (!url) return <div className={cn("h-full w-full animate-pulse bg-slate-100", className)} />;
  return (
    <img
      src={url}
      alt={image?.slot.label ?? image?.originalFile.originalName ?? "Fotografia clinica"}
      className={cn("h-full w-full", contain ? "object-contain" : "object-cover", className)}
      draggable={false}
    />
  );
}

type PanelProps = {
  treatmentPlanId: string;
  patientId: string;
  professionalId: string;
  branchId: string;
  readOnly?: boolean;
};

export function PhotographicTemplatesPanel(props: PanelProps) {
  const [selectedId, setSelectedId] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState<PhotographicSessionImage | null>(null);
  const [editorImage, setEditorImage] = useState<PhotographicSessionImage | null>(null);
  const [mobileInvite, setMobileInvite] = useState<{ uploadUrl: string; expiresAt: string } | null>(null);
  const query = usePhotographicTemplates(props.treatmentPlanId, true, mobileOpen);
  const mutations = usePhotographicTemplateMutations(props.treatmentPlanId);
  const { hasPermission } = usePermissions();
  const can = (permission: string) => hasPermission(permission) || hasPermission("organization.manage_all");
  const sessions = query.data?.sessions ?? [];
  const slots = query.data?.slots ?? [];
  const selectedSession = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null;
  const canUpload = !props.readOnly && can("photographic_photos.upload");

  useEffect(() => {
    if (sessions.length && !sessions.some((session) => session.id === selectedId))
      setSelectedId(sessions[0].id);
    if (!sessions.length) setSelectedId("");
  }, [sessions, selectedId]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
      if (event.key === "ArrowLeft") selectRelative(-1);
      if (event.key === "ArrowRight") selectRelative(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, selectedId, sessions.length]);

  const selectRelative = (direction: -1 | 1) => {
    if (!sessions.length) return;
    const currentIndex = Math.max(
      0,
      sessions.findIndex((session) => session.id === selectedSession?.id)
    );
    const next = Math.min(sessions.length - 1, Math.max(0, currentIndex + direction));
    setSelectedId(sessions[next].id);
  };

  const upload = async (slot: PhotographicSlot, file?: File, replaceImage?: PhotographicSessionImage) => {
    if (!file || !canUpload) return;
    await mutations.uploadImage.mutateAsync({
      treatmentPlanId: props.treatmentPlanId,
      sessionId: selectedSession?.id,
      slotId: slot.id,
      file,
      replaceImageId: replaceImage?.id,
      expectedVersion: replaceImage?.version
    });
  };

  const openMobile = async () => {
    if (!can("photographic_templates.mobile_upload")) return;
    let session = selectedSession;
    if (!session) {
      session = await mutations.createSession.mutateAsync({
        name: "Inicial",
        sessionType: "INITIAL",
        clinicalDate: todayValue(),
        professionalId: props.professionalId,
        branchId: props.branchId
      });
      setSelectedId(session.id);
    }
    const invite = await mutations.createMobileUpload.mutateAsync(session.id);
    setMobileInvite(invite);
    setMobileOpen(true);
  };

  const content = (
    <section
      className={cn(
        "overflow-hidden bg-white",
        fullscreen
          ? "fixed inset-0 z-[1400] flex flex-col bg-slate-950/95 p-4 text-white"
          : "border-t border-slate-100"
      )}
      aria-label="Plantilla fotografica"
    >
      <PhotographicHeader
        session={selectedSession}
        imageCount={selectedSession?.images.length ?? 0}
        fullscreen={fullscreen}
        onFullscreen={() => setFullscreen((value) => !value)}
        onNew={() => setNewOpen(true)}
        onMobile={() => void openMobile()}
        onCompare={() => setCompareOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        canCreate={!props.readOnly && can("photographic_templates.create")}
        canMobile={!props.readOnly && can("photographic_templates.mobile_upload")}
        canCompare={sessions.length >= 2 && can("photographic_templates.compare")}
      />

      {selectedSession?.links.length ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2",
            fullscreen && "border-white/10"
          )}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Vinculos clinicos
          </span>
          {selectedSession.links.map((link) => (
            <span
              key={link.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800",
                fullscreen && "bg-sky-400/10 text-sky-200"
              )}
            >
              <Link2 className="h-3 w-3" />
              {link.linkedEntityType === "APPOINTMENT"
                ? "Cita"
                : link.linkedEntityType === "ORTHODONTIC_CONTROL"
                  ? "Control"
                  : "Evolucion"}
              <span className="text-sky-500">{link.linkedEntityId.slice(-6)}</span>
              {!props.readOnly && can("photographic_templates.link") ? (
                <button
                  type="button"
                  aria-label="Quitar vinculo clinico"
                  onClick={() => {
                    const reason = window.prompt("Motivo para quitar el vinculo clinico:");
                    if (reason) void mutations.removeLink.mutateAsync({ linkId: link.id, reason });
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {query.data?.reminder ? (
        <div
          className={cn(
            "mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3",
            fullscreen && "border-amber-500/30 bg-amber-500/10"
          )}
        >
          <div>
            <p className={cn("text-sm font-semibold text-amber-950", fullscreen && "text-amber-100")}>
              {query.data.reminder.message}
            </p>
            <p className={cn("text-xs text-amber-700", fullscreen && "text-amber-200/70")}>
              Es una sugerencia; no modifica progreso ni bloquea evoluciones.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setNewOpen(true)}>
              Crear ahora
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void mutations.dismissReminder.mutateAsync(
                  new Date(Date.now() + 7 * 86_400_000).toISOString()
                )
              }
            >
              Recordar despues
            </Button>
          </div>
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", fullscreen && "mx-auto w-full max-w-7xl")}>
        {query.isLoading ? (
          <div className="grid min-h-[480px] place-items-center text-sm text-slate-500">
            Preparando posiciones fotograficas...
          </div>
        ) : (
          <PhotoGrid
            slots={slots}
            session={selectedSession}
            canUpload={canUpload}
            fullscreen={fullscreen}
            uploading={mutations.uploadImage.isPending}
            onUpload={upload}
            onView={setViewerImage}
            onEdit={setEditorImage}
            onVoid={(image) => {
              const reason = window.prompt("Motivo de anulacion de la fotografia:");
              if (reason)
                void mutations.voidImage.mutateAsync({ imageId: image.id, version: image.version, reason });
            }}
          />
        )}
      </div>

      <PhotographicTimeline
        sessions={sessions}
        selectedId={selectedSession?.id ?? ""}
        fullscreen={fullscreen}
        onSelect={setSelectedId}
        onPrevious={() => selectRelative(-1)}
        onNext={() => selectRelative(1)}
      />
    </section>
  );

  return (
    <>
      {content}
      <NewSessionModal
        open={newOpen}
        treatmentPlanId={props.treatmentPlanId}
        professionalId={props.professionalId}
        branchId={props.branchId}
        onClose={() => setNewOpen(false)}
        onCreate={async (payload) => {
          const created = await mutations.createSession.mutateAsync(payload);
          setSelectedId(created.id);
          setNewOpen(false);
        }}
        saving={mutations.createSession.isPending}
      />
      <MobileUploadModal
        open={mobileOpen}
        invite={mobileInvite}
        onClose={() => {
          setMobileOpen(false);
          setMobileInvite(null);
        }}
      />
      <SettingsModal
        open={settingsOpen}
        session={selectedSession}
        slots={slots}
        frequency={query.data?.policy.frequency ?? "NONE"}
        customIntervalDays={query.data?.policy.customIntervalDays ?? undefined}
        canConfigure={can("photographic_templates.configure_frequency")}
        canConfigureSlots={can("photographic_templates.configure_slots")}
        canEditSession={!props.readOnly && can("photographic_templates.edit")}
        onClose={() => setSettingsOpen(false)}
        onSave={async (frequency, customIntervalDays) => {
          await mutations.updatePolicy.mutateAsync({ frequency, customIntervalDays });
          setSettingsOpen(false);
        }}
        onSaveSlot={async (slot, label, isRequired) => {
          await mutations.updateSlot.mutateAsync({
            slotId: slot.id,
            version: slot.version,
            label,
            isRequired
          });
        }}
        onSaveSession={async (session, name, clinicalDate) => {
          await mutations.updateSession.mutateAsync({
            sessionId: session.id,
            payload: { version: session.version, name, clinicalDate }
          });
        }}
        onComplete={
          selectedSession && selectedSession.status !== "COMPLETE" && selectedSession.images.length >= 10
            ? async () => {
                await mutations.completeSession.mutateAsync({
                  sessionId: selectedSession.id,
                  version: selectedSession.version
                });
              }
            : undefined
        }
        onVoid={
          selectedSession && can("photographic_templates.void")
            ? async () => {
                const reason = window.prompt("Motivo de anulacion de la plantilla:");
                if (!reason) return;
                await mutations.voidSession.mutateAsync({
                  sessionId: selectedSession.id,
                  version: selectedSession.version,
                  reason
                });
                setSettingsOpen(false);
              }
            : undefined
        }
      />
      <ComparisonModal
        open={compareOpen}
        sessions={sessions}
        slots={slots}
        onClose={() => setCompareOpen(false)}
      />
      <ImageViewer image={viewerImage} onClose={() => setViewerImage(null)} />
      <ImageEditor
        image={editorImage}
        saving={mutations.editImage.isPending}
        onClose={() => setEditorImage(null)}
        onSave={async (image, transformations) => {
          await mutations.editImage.mutateAsync({
            imageId: image.id,
            version: image.version,
            transformations
          });
          setEditorImage(null);
        }}
      />
    </>
  );
}

function PhotographicHeader({
  session,
  imageCount,
  fullscreen,
  onFullscreen,
  onNew,
  onMobile,
  onCompare,
  onSettings,
  canCreate,
  canMobile,
  canCompare
}: {
  session: PhotographicSession | null;
  imageCount: number;
  fullscreen: boolean;
  onFullscreen: () => void;
  onNew: () => void;
  onMobile: () => void;
  onCompare: () => void;
  onSettings: () => void;
  canCreate: boolean;
  canMobile: boolean;
  canCompare: boolean;
}) {
  const status = session?.status ?? "INCOMPLETE";
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3",
        fullscreen && "border-white/10"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700",
            fullscreen && "bg-sky-400/10 text-sky-300"
          )}
        >
          <Camera className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("truncate text-base font-semibold text-slate-950", fullscreen && "text-white")}>
              Plantilla fotografica · {session?.name ?? "Inicial"}
            </h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                status === "COMPLETE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className={cn("mt-0.5 text-xs text-slate-500", fullscreen && "text-slate-400")}>
            {session ? formatDate(session.clinicalDate) : "Se creara al cargar primera imagen"} · {imageCount}
            /10 imagenes
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onFullscreen}>
          {fullscreen ? <X className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          {fullscreen ? "Salir" : "Pantalla completa"}
        </Button>
        <Button size="sm" variant="secondary" disabled={!canCreate} onClick={onNew}>
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
        <Button size="sm" variant="secondary" disabled={!canMobile} onClick={onMobile}>
          <Smartphone className="h-4 w-4" />
          Subir desde celular
        </Button>
        <Button size="sm" variant="secondary" disabled={!canCompare} onClick={onCompare}>
          <GitCompareArrows className="h-4 w-4" />
          Comparar
        </Button>
        <Button size="sm" variant="ghost" aria-label="Mas acciones fotograficas" onClick={onSettings}>
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

function PhotoGrid({
  slots,
  session,
  canUpload,
  fullscreen,
  uploading,
  onUpload,
  onView,
  onEdit,
  onVoid
}: {
  slots: PhotographicSlot[];
  session: PhotographicSession | null;
  canUpload: boolean;
  fullscreen: boolean;
  uploading: boolean;
  onUpload: (slot: PhotographicSlot, file?: File, replaceImage?: PhotographicSessionImage) => Promise<void>;
  onView: (image: PhotographicSessionImage) => void;
  onEdit: (image: PhotographicSessionImage) => void;
  onVoid: (image: PhotographicSessionImage) => void;
}) {
  const rows = [1, 2, 3].map((row) =>
    slots.filter((slot) => slot.rowNumber === row).sort((a, b) => a.columnNumber - b.columnNumber)
  );
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-300 bg-slate-200",
        fullscreen && "border-white/15 bg-white/10"
      )}
      onPaste={(event) => event.preventDefault()}
    >
      {rows.map((rowSlots) => (
        <div key={rowSlots[0]?.rowNumber} className="flex gap-px border-b border-slate-300 last:border-b-0">
          {rowSlots.map((slot) => {
            const image = session?.images.find((item) => item.slotId === slot.id);
            return (
              <PhotoCell
                key={slot.id}
                slot={slot}
                image={image}
                canUpload={canUpload}
                fullscreen={fullscreen}
                uploading={uploading}
                onUpload={onUpload}
                onView={onView}
                onEdit={onEdit}
                onVoid={onVoid}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PhotoCell({
  slot,
  image,
  canUpload,
  fullscreen,
  uploading,
  onUpload,
  onView,
  onEdit,
  onVoid
}: {
  slot: PhotographicSlot;
  image?: PhotographicSessionImage;
  canUpload: boolean;
  fullscreen: boolean;
  uploading: boolean;
  onUpload: (slot: PhotographicSlot, file?: File, replaceImage?: PhotographicSessionImage) => Promise<void>;
  onView: (image: PhotographicSessionImage) => void;
  onEdit: (image: PhotographicSessionImage) => void;
  onVoid: (image: PhotographicSessionImage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const selectFile = (file?: File) => void onUpload(slot, file, image);
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(event.clipboardData.files).find((candidate) =>
      candidate.type.startsWith("image/")
    );
    if (file) {
      event.preventDefault();
      selectFile(file);
    }
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    selectFile(Array.from(event.dataTransfer.files).find((candidate) => candidate.type.startsWith("image/")));
  };
  return (
    <div
      className={cn(
        "group relative min-h-[156px] flex-1 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-inset focus-within:ring-sky-500 md:min-h-[205px]",
        fullscreen && "min-h-[210px] bg-slate-900",
        dragging && "bg-sky-50"
      )}
      title={slot.label}
      tabIndex={0}
      onPaste={handlePaste}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {image ? (
        <>
          <PhotoAsset image={image} />
          <div className="absolute inset-x-0 bottom-0 translate-y-[calc(100%-32px)] bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent p-2 pt-10 text-white transition-transform group-hover:translate-y-0 group-focus-within:translate-y-0">
            <p className="truncate text-xs font-semibold">{slot.label}</p>
            <p className="mt-0.5 truncate text-[10px] text-white/70">
              {image.originalFile.originalName} · {formatDate(image.uploadedAt)}
            </p>
            <div className="mt-2 flex gap-1">
              <button
                className="rounded bg-white/15 p-1.5 hover:bg-white/25"
                onClick={() => onView(image)}
                aria-label={`Ver ${slot.label}`}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                className="rounded bg-white/15 p-1.5 hover:bg-white/25"
                onClick={() => onEdit(image)}
                aria-label={`Editar ${slot.label}`}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                className="rounded bg-white/15 p-1.5 hover:bg-white/25"
                onClick={() => inputRef.current?.click()}
                aria-label={`Reemplazar ${slot.label}`}
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
              <DownloadImageButton image={image} />
              <button
                className="rounded bg-rose-500/60 p-1.5 hover:bg-rose-500/80"
                onClick={() => onVoid(image)}
                aria-label={`Anular ${slot.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="flex h-full min-h-[inherit] w-full flex-col items-center justify-center gap-2 text-slate-400 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed"
          disabled={!canUpload || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-current">
            <Plus className="h-5 w-5" />
          </span>
          <span className="max-w-[90%] text-center text-xs font-medium">{slot.label}</span>
          <span className="text-[10px] opacity-70">Pendiente</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        disabled={!canUpload || uploading}
        onChange={(event) => {
          selectFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function DownloadImageButton({ image }: { image: PhotographicSessionImage }) {
  const download = async () => {
    const blob = await getPhotographicFileBlob(image.originalFile);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = image.originalFile.originalName;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      className="rounded bg-white/15 p-1.5 hover:bg-white/25"
      onClick={() => void download()}
      aria-label="Descargar original"
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}

function PhotographicTimeline({
  sessions,
  selectedId,
  fullscreen,
  onSelect,
  onPrevious,
  onNext
}: {
  sessions: PhotographicSession[];
  selectedId: string;
  fullscreen: boolean;
  onSelect: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const selectedIndex = Math.max(
    0,
    sessions.findIndex((session) => session.id === selectedId)
  );
  const positionPercent = sessions.length <= 1 ? 0 : (selectedIndex / (sessions.length - 1)) * 100;
  return (
    <footer
      className={cn(
        "border-t border-slate-200 bg-slate-50 px-4 py-3",
        fullscreen && "border-white/10 bg-slate-950"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className={cn("text-xs font-semibold text-slate-700", fullscreen && "text-slate-200")}>
            Seguimiento fotografico
          </p>
          <p className="text-[10px] text-slate-500">
            Linea cronologica de sesiones; no representa progreso clinico.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-200"
            onClick={onPrevious}
            disabled={!sessions.length || selectedIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-200"
            onClick={onNext}
            disabled={!sessions.length || selectedIndex >= sessions.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="relative min-w-[560px] px-3 pt-1"
          style={{ width: `${Math.max(100, sessions.length * 18)}%` }}
        >
          <div className="absolute left-3 right-3 top-[10px] h-0.5 bg-slate-300" />
          <div
            className="absolute left-3 top-[10px] h-0.5 bg-sky-600 transition-[width]"
            style={{ width: `calc((100% - 24px) * ${positionPercent / 100})` }}
          />
          <div className="relative flex justify-between">
            {(sessions.length
              ? sessions
              : [
                  {
                    id: "virtual",
                    name: "Inicial",
                    clinicalDate: "",
                    images: [],
                    status: "INCOMPLETE"
                  } as unknown as PhotographicSession
                ]
            ).map((session) => {
              const active = session.id === selectedId || (!sessions.length && session.id === "virtual");
              return (
                <button
                  key={session.id}
                  className="group flex w-28 flex-col items-center text-center"
                  onClick={() => session.id !== "virtual" && onSelect(session.id)}
                >
                  <span
                    className={cn(
                      "relative z-10 h-5 w-5 rounded-full border-[5px] border-slate-50 bg-slate-400 transition-transform group-hover:scale-110",
                      active && "bg-sky-600 ring-2 ring-sky-200",
                      session.status === "COMPLETE" && "bg-emerald-500",
                      fullscreen && "border-slate-950"
                    )}
                  />
                  <span
                    className={cn(
                      "mt-1.5 max-w-full truncate text-[11px] font-semibold text-slate-700",
                      fullscreen && "text-slate-200"
                    )}
                  >
                    {session.name}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {session.images.length}/10 ·{" "}
                    {session.clinicalDate ? formatDate(session.clinicalDate) : "Pendiente"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

function NewSessionModal({
  open,
  treatmentPlanId,
  professionalId,
  branchId,
  onClose,
  onCreate,
  saving
}: {
  open: boolean;
  treatmentPlanId: string;
  professionalId: string;
  branchId: string;
  onClose: () => void;
  onCreate: (payload: {
    name?: string;
    sessionType: PhotographicSessionType;
    clinicalDate: string;
    professionalId: string;
    branchId: string;
    notes?: string;
    links?: Array<{ linkedEntityType: PhotographicLinkedEntityType; linkedEntityId: string }>;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [sessionType, setSessionType] = useState<PhotographicSessionType>("FOLLOW_UP");
  const [clinicalDate, setClinicalDate] = useState(todayValue());
  const [notes, setNotes] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const links = usePhotographicAvailableLinks(treatmentPlanId, open);
  const options = useMemo(
    () => [
      ...(links.data?.appointments ?? []).map((item) => ({
        value: `APPOINTMENT:${item.id}`,
        label: `Cita · ${formatDate(item.startAt)} · ${item.status}`
      })),
      ...(links.data?.controls ?? []).map((item) => ({
        value: `ORTHODONTIC_CONTROL:${item.id}`,
        label: `Control ${item.sequenceNumber} · ${formatDate(item.clinicalDate)} · ${item.status}`
      })),
      ...(links.data?.evolutions ?? []).map((item) => ({
        value: `CLINICAL_EVOLUTION:${item.id}`,
        label: `Evolucion · ${formatDate(item.createdAt)}${item.annulledAt ? " · anulada" : ""}`
      }))
    ],
    [links.data]
  );
  return (
    <Modal open={open} title="Nueva plantilla fotografica" onClose={onClose} size="lg">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const [linkedEntityType, linkedEntityId] = linkValue.split(":");
          void onCreate({
            name: name || undefined,
            sessionType,
            clinicalDate,
            professionalId,
            branchId,
            notes: notes || undefined,
            links: linkedEntityId
              ? [{ linkedEntityType: linkedEntityType as PhotographicLinkedEntityType, linkedEntityId }]
              : undefined
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Nombre
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={SESSION_TYPE_LABELS[sessionType]}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Tipo
            <Select
              value={sessionType}
              onChange={(event) => setSessionType(event.target.value as PhotographicSessionType)}
            >
              {(["INITIAL", "FOLLOW_UP", "REEVALUATION", "FINAL", "CUSTOM"] as PhotographicSessionType[]).map(
                (type) => (
                  <option key={type} value={type}>
                    {SESSION_TYPE_LABELS[type]}
                  </option>
                )
              )}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Fecha clinica
            <Input
              type="date"
              value={clinicalDate}
              onChange={(event) => setClinicalDate(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Vinculo clinico opcional
            <Select value={linkValue} onChange={(event) => setLinkValue(event.target.value)}>
              <option value="">Sin vinculo</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
          <span>Profesional del plan: {professionalId}</span>
          <span>Sucursal del plan: {branchId}</span>
        </div>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Notas
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>
        <p className="text-xs text-slate-500">
          Vincular es opcional. Esta plantilla no crea una evolucion ni modifica porcentajes del tratamiento.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !clinicalDate}>
            {saving ? "Creando..." : "Crear plantilla"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MobileUploadModal({
  open,
  invite,
  onClose
}: {
  open: boolean;
  invite: { uploadUrl: string; expiresAt: string } | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Subir desde celular" onClose={onClose}>
      <div className="space-y-4 text-center">
        {invite ? (
          <>
            <div className="mx-auto w-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <QRCodeCanvas value={invite.uploadUrl} size={220} level="M" marginSize={1} />
            </div>
            <p className="text-sm font-semibold text-slate-900">Escanea el codigo con el celular</p>
            <p className="text-xs text-slate-500">
              Invitacion de un solo uso, sin datos del paciente en URL. Expira{" "}
              {new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(
                new Date(invite.expiresAt)
              )}
              .
            </p>
            <div className="rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600 break-all">
              {invite.uploadUrl}
            </div>
            <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(invite.uploadUrl)}>
              Copiar enlace seguro
            </Button>
          </>
        ) : (
          <p className="text-sm text-slate-500">Generando invitacion segura...</p>
        )}
      </div>
    </Modal>
  );
}

function SettingsModal({
  open,
  session,
  slots,
  frequency,
  customIntervalDays,
  canConfigure,
  canConfigureSlots,
  canEditSession,
  onClose,
  onSave,
  onSaveSlot,
  onSaveSession,
  onComplete,
  onVoid
}: {
  open: boolean;
  session: PhotographicSession | null;
  slots: PhotographicSlot[];
  frequency: PhotographicFrequency;
  customIntervalDays?: number;
  canConfigure: boolean;
  canConfigureSlots: boolean;
  canEditSession: boolean;
  onClose: () => void;
  onSave: (frequency: PhotographicFrequency, customIntervalDays?: number) => Promise<void>;
  onSaveSlot: (slot: PhotographicSlot, label: string, isRequired: boolean) => Promise<void>;
  onSaveSession: (session: PhotographicSession, name: string, clinicalDate: string) => Promise<void>;
  onComplete?: () => Promise<void>;
  onVoid?: () => Promise<void>;
}) {
  const [value, setValue] = useState(frequency);
  const [days, setDays] = useState(customIntervalDays ?? 90);
  const [sessionName, setSessionName] = useState(session?.name ?? "");
  const [sessionDate, setSessionDate] = useState(session?.clinicalDate?.slice(0, 10) ?? todayValue());
  useEffect(() => {
    if (open) {
      setValue(frequency);
      setDays(customIntervalDays ?? 90);
      setSessionName(session?.name ?? "");
      setSessionDate(session?.clinicalDate?.slice(0, 10) ?? todayValue());
    }
  }, [open, frequency, customIntervalDays, session?.id]);
  return (
    <Modal open={open} title="Opciones fotograficas" onClose={onClose} size="lg">
      <div className="space-y-4">
        {session && canEditSession ? (
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Datos de plantilla</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
              <Input
                type="date"
                value={sessionDate}
                onChange={(event) => setSessionDate(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void onSaveSession(session, sessionName, sessionDate)}>
                Guardar datos
              </Button>
              {onComplete ? (
                <Button size="sm" variant="secondary" onClick={() => void onComplete()}>
                  <Check className="h-4 w-4" />
                  Marcar completa
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-900">Frecuencia sugerida</p>
          </div>
          <Select
            value={value}
            disabled={!canConfigure}
            onChange={(event) => setValue(event.target.value as PhotographicFrequency)}
          >
            {FREQUENCIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          {value === "CUSTOM" ? (
            <Input
              className="mt-3"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            />
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            Solo genera recordatorios. No crea sesiones ni altera progreso.
          </p>
          {canConfigure ? (
            <Button
              className="mt-3"
              size="sm"
              onClick={() => void onSave(value, value === "CUSTOM" ? days : undefined)}
            >
              Guardar frecuencia
            </Button>
          ) : null}
        </div>
        {canConfigureSlots ? (
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Catalogo de posiciones</p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {slots.map((slot) => (
                <SlotSettingsRow key={slot.id} slot={slot} onSave={onSaveSlot} />
              ))}
            </div>
          </div>
        ) : null}
        {onVoid ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">Anular plantilla seleccionada</p>
            <p className="mt-1 text-xs text-rose-700">
              Las imagenes y originales se conservan para auditoria.
            </p>
            <Button className="mt-3" size="sm" variant="danger" onClick={() => void onVoid()}>
              Anular con motivo
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function SlotSettingsRow({
  slot,
  onSave
}: {
  slot: PhotographicSlot;
  onSave: (slot: PhotographicSlot, label: string, isRequired: boolean) => Promise<void>;
}) {
  const [label, setLabel] = useState(slot.label);
  const [required, setRequired] = useState(slot.isRequired);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-slate-50 p-2">
      <Input value={label} onChange={(event) => setLabel(event.target.value)} />
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
        Obligatoria
      </label>
      <Button
        size="sm"
        variant="secondary"
        disabled={!label.trim()}
        onClick={() => void onSave(slot, label, required)}
      >
        Guardar
      </Button>
    </div>
  );
}

function ImageViewer({ image, onClose }: { image: PhotographicSessionImage | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(image)}
      title={image?.slot.label ?? "Fotografia clinica"}
      onClose={onClose}
      size="2xl"
    >
      {image ? (
        <div className="space-y-3">
          <div className="h-[68vh] rounded-lg bg-slate-950">
            <PhotoAsset image={image} contain />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <span>{image.originalFile.originalName}</span>
            <span>
              {image.width}×{image.height} · {formatDate(image.uploadedAt)}
            </span>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function ImageEditor({
  image,
  saving,
  onClose,
  onSave
}: {
  image: PhotographicSessionImage | null;
  saving: boolean;
  onClose: () => void;
  onSave: (
    image: PhotographicSessionImage,
    transformations: PhotographicImageTransformations
  ) => Promise<void>;
}) {
  const [value, setValue] = useState(DEFAULT_TRANSFORMATIONS);
  useEffect(() => {
    if (image) setValue(image.transformationsJson ?? DEFAULT_TRANSFORMATIONS);
  }, [image?.id]);
  return (
    <Modal open={Boolean(image)} title="Edicion no destructiva" onClose={onClose} size="2xl">
      {image ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="relative h-[60vh] overflow-hidden rounded-lg bg-slate-950">
            <div
              className="h-full w-full transition-transform"
              style={{
                transform: `rotate(${value.rotation}deg) scale(${value.zoom})`,
                filter: `brightness(${value.brightness}) contrast(${value.contrast})`
              }}
            >
              <PhotoAsset image={image} contain />
            </div>
          </div>
          <div className="space-y-4">
            <EditorRange
              label="Rotacion"
              min={-180}
              max={180}
              step={90}
              value={value.rotation}
              onChange={(rotation) => setValue((current) => ({ ...current, rotation }))}
            />
            <EditorRange
              label="Zoom"
              min={1}
              max={4}
              step={0.1}
              value={value.zoom}
              onChange={(zoom) => setValue((current) => ({ ...current, zoom }))}
            />
            <EditorRange
              label="Brillo"
              min={0.5}
              max={2}
              step={0.05}
              value={value.brightness}
              onChange={(brightness) => setValue((current) => ({ ...current, brightness }))}
            />
            <EditorRange
              label="Contraste"
              min={0.5}
              max={2}
              step={0.05}
              value={value.contrast}
              onChange={(contrast) => setValue((current) => ({ ...current, contrast }))}
            />
            <div className="grid grid-cols-2 gap-2">
              {(["cropX", "cropY", "cropWidth", "cropHeight"] as const).map((field) => (
                <label key={field} className="text-xs font-medium text-slate-600">
                  {field}
                  <Input
                    type="number"
                    min={field.includes("Width") || field.includes("Height") ? 0.05 : 0}
                    max={1}
                    step={0.05}
                    value={value[field]}
                    onChange={(event) =>
                      setValue((current) => ({ ...current, [field]: Number(event.target.value) }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setValue(DEFAULT_TRANSFORMATIONS)}>
                <RotateCcw className="h-4 w-4" />
                Restablecer
              </Button>
              <Button disabled={saving} onClick={() => void onSave(image, value)}>
                {saving ? "Procesando..." : "Guardar nueva version"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Original permanece intacto. No se aplican alteraciones generativas.
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function EditorRange({
  label,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 flex justify-between">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input
        className="w-full accent-sky-600"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ComparisonModal({
  open,
  sessions,
  slots,
  onClose
}: {
  open: boolean;
  sessions: PhotographicSession[];
  slots: PhotographicSlot[];
  onClose: () => void;
}) {
  const [leftId, setLeftId] = useState(sessions[0]?.id ?? "");
  const [rightId, setRightId] = useState(sessions[1]?.id ?? sessions[0]?.id ?? "");
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [mode, setMode] = useState<"side" | "slider" | "overlay">("side");
  const [slider, setSlider] = useState(50);
  useEffect(() => {
    if (open) {
      setLeftId(sessions[0]?.id ?? "");
      setRightId(sessions[1]?.id ?? sessions[0]?.id ?? "");
      setSlotId(slots[0]?.id ?? "");
    }
  }, [open, sessions.length, slots.length]);
  const left = sessions.find((session) => session.id === leftId);
  const right = sessions.find((session) => session.id === rightId);
  const leftImage = left?.images.find((image) => image.slotId === slotId);
  const rightImage = right?.images.find((image) => image.slotId === slotId);
  useEffect(() => {
    if (!open || !leftId || !rightId || leftId === rightId) return;
    void auditPhotographicComparison(leftId, rightId).catch(() => undefined);
  }, [open, leftId, rightId]);
  return (
    <Modal open={open} title="Comparar plantillas" onClose={onClose} size="2xl">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={leftId} onChange={(event) => setLeftId(event.target.value)}>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} · {formatDate(session.clinicalDate)}
              </option>
            ))}
          </Select>
          <Select value={rightId} onChange={(event) => setRightId(event.target.value)}>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} · {formatDate(session.clinicalDate)}
              </option>
            ))}
          </Select>
          <Select value={slotId} onChange={(event) => setSlotId(event.target.value)}>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </Select>
          <Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="side">Lado a lado</option>
            <option value="slider">Deslizador</option>
            <option value="overlay">Superposicion</option>
          </Select>
        </div>
        <div className="relative h-[60vh] overflow-hidden rounded-lg bg-slate-950">
          {mode === "side" ? (
            <div className="grid h-full grid-cols-2 gap-px bg-white/10">
              <PhotoAsset image={leftImage} contain />
              <PhotoAsset image={rightImage} contain />
            </div>
          ) : (
            <>
              <div className="absolute inset-0">
                <PhotoAsset image={leftImage} contain />
              </div>
              <div
                className="absolute inset-0"
                style={
                  mode === "slider"
                    ? { clipPath: `inset(0 ${100 - slider}% 0 0)` }
                    : { opacity: slider / 100 }
                }
              >
                <PhotoAsset image={rightImage} contain />
              </div>
            </>
          )}
          {mode !== "side" ? (
            <input
              className="absolute bottom-4 left-1/2 w-2/3 -translate-x-1/2 accent-sky-500"
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(event) => setSlider(Number(event.target.value))}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          <span>
            {left?.name} · {formatDate(left?.clinicalDate)}
          </span>
          <span className="text-right">
            {right?.name} · {formatDate(right?.clinicalDate)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
