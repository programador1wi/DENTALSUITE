import { type ChangeEvent, type DragEvent, type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Image,
  LayoutGrid,
  List,
  LockKeyhole,
  Search,
  ScanLine,
  Upload,
  X,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { cn } from "@/lib/utils/cn";
import { PatientSectionPage } from "../components/patient-section-page";
import { useDocumentsMutations, usePatientFiles } from "@/features/documents/hooks/use-documents";
import { getPatientFileBlob, type FileAttachment } from "@/features/documents/services/documents.service";

type ViewMode = "gallery" | "list";

const fileCategories: Array<{ value: string; label: string; shortLabel: string; description: string; icon: LucideIcon; accent: string }> = [
  {
    value: "XRAY",
    label: "Radiografias",
    shortLabel: "RX",
    description: "Panoramicas, cefalometrias y estudios DICOM",
    icon: ScanLine,
    accent: "bg-sky-50 text-sky-700 ring-sky-200"
  },
  {
    value: "PHOTO",
    label: "Fotos clinicas",
    shortLabel: "Foto",
    description: "Extraorales, intraorales y avances",
    icon: Image,
    accent: "bg-emerald-50 text-emerald-700 ring-emerald-200"
  },
  {
    value: "DOCUMENT",
    label: "Documentos",
    shortLabel: "Doc",
    description: "PDF, Word, Excel y archivos administrativos",
    icon: FileText,
    accent: "bg-slate-100 text-slate-700 ring-slate-200"
  },
  {
    value: "CONSENT",
    label: "Consentimientos",
    shortLabel: "Consent.",
    description: "Formatos firmados y autorizaciones",
    icon: FileCheck2,
    accent: "bg-amber-50 text-amber-700 ring-amber-200"
  },
  {
    value: "OTHER",
    label: "Otros",
    shortLabel: "Otro",
    description: "Adjuntos generales del expediente",
    icon: FileText,
    accent: "bg-indigo-50 text-indigo-700 ring-indigo-200"
  }
];

const categoryLookup = new Map(fileCategories.map((category) => [category.value, category]));
const maxUploadSizeBytes = 25 * 1024 * 1024;
const uploadAccept = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".dcm",
  ".dicom",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/dicom"
].join(",");
const allowedUploadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".dcm", ".dicom"]);
const allowedUploadMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/dicom"
]);

export function PatientFilesPage() {
  const { id = "" } = useParams();
  const files = usePatientFiles(id);
  const mutations = useDocumentsMutations();
  const uploadInputId = useId();
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("XRAY");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);

  const allFiles = files.data ?? [];
  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allFiles.filter((file) => {
      const matchesCategory = category ? file.category === category : true;
      const matchesMonth = month ? file.createdAt.slice(0, 7) === month : true;
      const matchesQuery = normalizedQuery
        ? [file.originalName, file.fileName, file.mimeType, file.category].some((value) => value.toLowerCase().includes(normalizedQuery))
        : true;
      return matchesCategory && matchesMonth && matchesQuery;
    });
  }, [allFiles, category, month, query]);

  const groupedFiles = useMemo(() => {
    return visibleFiles.reduce<Array<{ label: string; items: FileAttachment[] }>>((groups, file) => {
      const label = formatDateLabel(file.createdAt);
      const current = groups.find((group) => group.label === label);
      if (current) current.items.push(file);
      else groups.push({ label, items: [file] });
      return groups;
    }, []);
  }, [visibleFiles]);

  const counters = useMemo(() => {
    return fileCategories.map((item) => ({
      ...item,
      count: allFiles.filter((file) => file.category === item.value).length
    }));
  }, [allFiles]);

  const handleSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addPendingFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addPendingFiles(event.dataTransfer.files);
  };

  const addPendingFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const selectedFiles = Array.from(fileList);
    const validFiles = selectedFiles.filter((file) => {
      const validationError = validateUploadFile(file);
      if (validationError) {
        toast.error(validationError);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;
    setPendingFiles((current) => [...current, ...validFiles]);
    const inferredCategory = inferCategory(validFiles[0]);
    if (inferredCategory) setUploadCategory(inferredCategory);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleUpload = async () => {
    if (!id || !pendingFiles.length) return;
    try {
      await Promise.all(
        pendingFiles.map((file) =>
          mutations.uploadPatientBinaryFile.mutateAsync({
            patientId: id,
            file,
            category: uploadCategory
          })
        )
      );
      setPendingFiles([]);
      setUploadOpen(false);
    } catch {
      // The mutation already shows the API error toast.
    }
  };

  if (files.isLoading) return <LoadingState message="Cargando archivos del paciente..." />;
  if (files.isError) return <ErrorState message={files.error.message} />;

  return (
    <PatientSectionPage patientId={id} title="Rx y documentos" description="Imagenes, radiografias y documentos del expediente.">
      <section className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border-default)] p-[var(--space-5)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[var(--text-xs)] font-semibold uppercase text-[var(--text-brand)]">Biblioteca clinica</p>
            <h2 className="mt-1 text-[var(--text-2xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">Rx y Documentos</h2>
            <p className="mt-1 max-w-2xl text-[var(--text-sm)] text-[var(--text-secondary)]">
              Centraliza radiografias, fotografias clinicas, consentimientos y archivos administrativos del paciente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setViewMode(viewMode === "gallery" ? "list" : "gallery")}>
              {viewMode === "gallery" ? <List size={16} /> : <LayoutGrid size={16} />}
              {viewMode === "gallery" ? "Ver lista" : "Ver galeria"}
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload size={16} />
              Subir archivo
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-[var(--space-5)] md:grid-cols-2 xl:grid-cols-5">
          {counters.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.value}
                className={cn(
                  "flex min-h-[86px] items-start gap-3 rounded-[var(--radius-md)] border p-[var(--space-3)] text-left transition hover:-translate-y-px hover:border-[var(--border-brand)] hover:shadow-[var(--shadow-card-hover)]",
                  category === item.value ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)]" : "border-[var(--border-default)] bg-white"
                )}
                onClick={() => setCategory((current) => (current === item.value ? "" : item.value))}
              >
                <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] ring-1", item.accent)}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[var(--text-xl)] font-semibold leading-none text-[var(--text-primary)]">{item.count}</span>
                  <span className="mt-1 block text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[var(--text-xs)] text-[var(--text-secondary)]">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
            <Input className="pl-9" placeholder="Buscar por nombre, tipo o formato" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todos los tipos</option>
            {fileCategories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <Button variant="ghost" onClick={() => {
            setCategory("");
            setMonth("");
            setQuery("");
          }}>
            <Filter size={16} />
            Limpiar
          </Button>
        </div>
      </section>

      {!visibleFiles.length ? (
        <EmptyState title="Sin archivos" description="Sube radiografias, imagenes clinicas o documentos para construir el expediente digital del paciente." />
      ) : viewMode === "gallery" ? (
        <div className="space-y-5">
          {groupedFiles.map((group) => (
            <section key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
                  <Clock3 size={15} />
                  {group.label}
                </span>
                <span className="h-px flex-1 bg-[var(--border-default)]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.items.map((file) => (
                  <FileCard key={file.id} file={file} onOpen={() => setSelectedFile(file)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <FileList files={visibleFiles} onOpen={setSelectedFile} />
      )}

      <UploadFilesModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        inputId={uploadInputId}
        pendingFiles={pendingFiles}
        uploadCategory={uploadCategory}
        setUploadCategory={setUploadCategory}
        onDrop={handleDrop}
        onSelectFiles={handleSelectFiles}
        onRemoveFile={removePendingFile}
        onUpload={handleUpload}
        uploading={mutations.uploadPatientBinaryFile.isPending}
      />

      <FilePreviewDrawer file={selectedFile} onClose={() => setSelectedFile(null)} />
    </PatientSectionPage>
  );
}

function FileCard({ file, onOpen }: { file: FileAttachment; onOpen: () => void }) {
  const category = getCategory(file.category);
  const Icon = category.icon;

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white shadow-sm transition hover:-translate-y-px hover:border-[var(--border-brand)] hover:shadow-[var(--shadow-card-hover)]">
      <button type="button" className="block w-full text-left" onClick={onOpen}>
        <div className="aspect-[4/3] bg-[var(--bg-subtle)]">
          <AttachmentPreview file={file} mode="thumb" />
        </div>
        <div className="space-y-3 p-[var(--space-3)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{file.originalName}</p>
              <p className="mt-0.5 text-[var(--text-xs)] text-[var(--text-secondary)]">{formatBytes(file.size)}</p>
            </div>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] font-semibold ring-1", category.accent)}>
              <Icon size={13} />
              {category.shortLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--text-secondary)]">
            <span>{formatShortDate(file.createdAt)}</span>
            <span className="inline-flex items-center gap-1 text-[var(--text-brand)]">
              <Eye size={13} />
              Ver
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function FileList({ files, onOpen }: { files: FileAttachment[]; onOpen: (file: FileAttachment) => void }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white">
      <div className="grid grid-cols-[1fr_150px_150px_120px] gap-3 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)] max-lg:hidden">
        <span>Archivo</span>
        <span>Tipo</span>
        <span>Fecha</span>
        <span className="text-right">Accion</span>
      </div>
      <div className="divide-y divide-[var(--border-default)]">
        {files.map((file) => {
          const category = getCategory(file.category);
          const Icon = category.icon;
          return (
            <button
              type="button"
              key={file.id}
              className="grid w-full gap-3 px-[var(--space-4)] py-[var(--space-3)] text-left transition hover:bg-[var(--bg-subtle)] lg:grid-cols-[1fr_150px_150px_120px] lg:items-center"
              onClick={() => onOpen(file)}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="h-14 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
                  <AttachmentPreview file={file} mode="thumb" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{file.originalName}</span>
                  <span className="mt-0.5 block text-[var(--text-xs)] text-[var(--text-secondary)]">{file.mimeType} / {formatBytes(file.size)}</span>
                </span>
              </span>
              <span className={cn("inline-flex w-max items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] font-semibold ring-1", category.accent)}>
                <Icon size={13} />
                {category.label}
              </span>
              <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">{formatShortDate(file.createdAt)}</span>
              <span className="inline-flex items-center justify-start gap-1 text-[var(--text-sm)] font-semibold text-[var(--text-brand)] lg:justify-end">
                <Eye size={14} />
                Ver detalle
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function UploadFilesModal({
  open,
  onClose,
  inputId,
  pendingFiles,
  uploadCategory,
  setUploadCategory,
  onDrop,
  onSelectFiles,
  onRemoveFile,
  onUpload,
  uploading
}: {
  open: boolean;
  onClose: () => void;
  inputId: string;
  pendingFiles: File[];
  uploadCategory: string;
  setUploadCategory: (value: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onSelectFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  const handlePickerKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    document.getElementById(inputId)?.click();
  };

  return (
    <Modal open={open} title="Subir archivos del paciente" onClose={onClose} size="xl">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div
          className="flex min-h-[260px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-brand)] bg-[var(--bg-brand-light)] p-[var(--space-6)] text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input
            id={inputId}
            type="file"
            multiple
            className="sr-only"
            accept={uploadAccept}
            onChange={onSelectFiles}
          />
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-white text-[var(--text-brand)] shadow-sm">
            <Upload size={22} />
          </span>
          <h3 className="mt-4 text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Arrastra archivos aqui</h3>
          <p className="mt-1 max-w-sm text-[var(--text-sm)] text-[var(--text-secondary)]">
            Acepta imagenes, radiografias DICOM, PDF, Word, Excel y TXT hasta 25 MB por archivo.
          </p>
          <label
            htmlFor={inputId}
            role="button"
            tabIndex={0}
            className="mt-4 inline-flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--action-primary)] bg-[var(--action-primary)] px-[var(--space-4)] text-[var(--text-base)] font-medium text-[var(--text-inverse)] transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:border-[var(--action-primary-hover)] hover:bg-[var(--action-primary-hover)] active:scale-[0.98]"
            onKeyDown={handlePickerKeyDown}
          >
            <Upload size={16} />
            Seleccionar archivos
          </label>
        </div>

        <aside className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Tipo de archivo</span>
            <Select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}>
              {fileCategories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)]">
              <span className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Lista de carga</span>
              <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">{pendingFiles.length} archivos</span>
            </div>
            <div className="max-h-[230px] divide-y divide-[var(--border-default)] overflow-y-auto">
              {!pendingFiles.length ? (
                <p className="p-[var(--space-4)] text-[var(--text-sm)] text-[var(--text-secondary)]">Aun no hay archivos seleccionados.</p>
              ) : (
                pendingFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-3 px-[var(--space-3)] py-[var(--space-2)]">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                      {file.type.startsWith("image/") ? <Image size={16} /> : <FileText size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{file.name}</span>
                      <span className="block text-[var(--text-xs)] text-[var(--text-secondary)]">{formatBytes(file.size)}</span>
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-danger)]"
                      onClick={() => onRemoveFile(index)}
                      aria-label={`Quitar ${file.name}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button className="w-full" disabled={!pendingFiles.length || uploading} onClick={onUpload}>
            <Upload size={16} />
            {uploading ? "Subiendo..." : "Guardar en expediente"}
          </Button>
        </aside>
      </div>
    </Modal>
  );
}

function FilePreviewDrawer({ file, onClose }: { file: FileAttachment | null; onClose: () => void }) {
  useEffect(() => {
    if (!file) return;

    const blockDocumentShortcuts = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isBlockedShortcut = (event.ctrlKey || event.metaKey) && (key === "p" || key === "s");
      if (!isBlockedShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      toast.info("La vista del documento es solo lectura.");
    };

    window.addEventListener("keydown", blockDocumentShortcuts, true);
    return () => window.removeEventListener("keydown", blockDocumentShortcuts, true);
  }, [file]);

  return (
    <Drawer open={Boolean(file)} title={file?.originalName ?? "Vista previa"} onClose={onClose}>
      {file ? (
        <div className="space-y-4">
          <div
            className="min-h-[360px] select-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[#262626]"
            onContextMenu={(event) => event.preventDefault()}
          >
            <AttachmentPreview file={file} mode="full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Tipo" value={getCategory(file.category).label} />
            <DetailItem label="Fecha de carga" value={new Date(file.createdAt).toLocaleString("es-MX")} />
            <DetailItem label="Formato" value={file.mimeType} />
            <DetailItem label="Tamano" value={formatBytes(file.size)} />
          </div>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold text-[var(--text-secondary)]">
            <LockKeyhole size={15} className="text-[var(--text-brand)]" />
            Vista de solo lectura
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white p-[var(--space-3)]">
      <p className="text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 break-words text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function AttachmentPreview({ file, mode }: { file: FileAttachment; mode: "thumb" | "full" }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";
  const needsSecureFetch = isManagedFileUrl(file.url) && (isImage || isPdf);

  useEffect(() => {
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

  if (isImage) {
    const source = objectUrl || (!needsSecureFetch ? file.url : "");
    if (source && !failed) {
      return <img src={source} alt={file.originalName} draggable={false} className="h-full w-full object-cover" />;
    }
  }

  if (isPdf && mode === "full" && objectUrl && !failed) {
    return (
      <iframe
        src={getPdfViewerUrl(objectUrl)}
        title={file.originalName}
        className="h-[72vh] w-full border-0 bg-[#262626]"
        sandbox="allow-same-origin allow-scripts"
        aria-label="Documento en solo lectura"
      />
    );
  }

  const category = getCategory(file.category);
  const Icon = isPdf ? FileText : category.icon;
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center p-[var(--space-4)] text-center", mode === "full" ? "min-h-[360px]" : "")}>
      <span className={cn("inline-flex items-center justify-center rounded-[var(--radius-md)] ring-1", mode === "full" ? "h-16 w-16" : "h-12 w-12", category.accent)}>
        <Icon size={mode === "full" ? 28 : 22} />
      </span>
      <p className="mt-3 max-w-[220px] truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{file.originalName}</p>
      <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{file.mimeType}</p>
    </div>
  );
}

function getCategory(category: string) {
  return categoryLookup.get(category) ?? fileCategories[fileCategories.length - 1];
}

function inferCategory(file: File) {
  const extension = getFileExtension(file);
  if (file.type.startsWith("image/")) return "PHOTO";
  if (file.type === "application/dicom" || extension === ".dcm" || extension === ".dicom") return "XRAY";
  if (file.type === "application/pdf" || extension === ".pdf") return "DOCUMENT";
  return "OTHER";
}

function validateUploadFile(file: File) {
  if (file.size <= 0) return `${file.name} esta vacio.`;
  if (file.size > maxUploadSizeBytes) return `${file.name} supera el limite de 25 MB.`;

  const extension = getFileExtension(file);
  if (allowedUploadMimeTypes.has(file.type) || allowedUploadExtensions.has(extension)) return "";
  return `${file.name} no tiene un formato permitido.`;
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? `.${extension}` : "";
}

function isManagedFileUrl(url: string) {
  return url.startsWith("/patients/") || url.startsWith("/api/v1/patients/") || url.includes("/api/v1/patients/");
}

function getPdfViewerUrl(source: string) {
  const separator = source.includes("#") ? "&" : "#";
  return `${source}${separator}toolbar=0&navpanes=0&scrollbar=1&statusbar=0&messages=0&view=FitH`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
