import { useMemo, useState, type ReactNode } from "react";
import { Eye, FileText, Heading1, Image, Minus, Rows3, Trash2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import {
  createClinicalDocumentBlock,
  normalizeClinicalDocumentContent,
  type ClinicalDocumentBlock,
  type ClinicalDocumentBlockType,
  type ClinicalDocumentContent
} from "./clinical-document-content";

type UploadedAsset = { url: string; fileName: string; mimeType?: string };

type EditorProps = {
  value: ClinicalDocumentContent;
  onChange: (value: ClinicalDocumentContent) => void;
  onAssetUpload?: (file: File) => Promise<UploadedAsset>;
};

function cloneContent(blocks: ClinicalDocumentBlock[]): ClinicalDocumentContent {
  return normalizeClinicalDocumentContent({ version: "clinical-doc-blocks/v1", blocks });
}

export function ClinicalDocumentBlockEditor({ value, onChange, onAssetUpload }: EditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const content = useMemo(() => normalizeClinicalDocumentContent(value), [value]);

  const addBlock = (type: ClinicalDocumentBlockType) => {
    onChange(cloneContent([...content.blocks, createClinicalDocumentBlock(type)]));
  };

  const updateBlock = (index: number, block: ClinicalDocumentBlock) => {
    const blocks = [...content.blocks];
    blocks[index] = block;
    onChange(cloneContent(blocks));
  };

  const removeBlock = (index: number) => {
    onChange(cloneContent(content.blocks.filter((_, currentIndex) => currentIndex !== index)));
  };

  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <ToolbarButton label="Agregar titulo" icon={<Heading1 className="h-4 w-4" />} onClick={() => addBlock("title")} />
        <ToolbarButton label="Agregar texto" icon={<Type className="h-4 w-4" />} onClick={() => addBlock("text")} />
        <ToolbarButton label="Agregar imagen" icon={<Image className="h-4 w-4" />} onClick={() => addBlock("image")} />
        <ToolbarButton label="Agregar fila" icon={<Rows3 className="h-4 w-4" />} onClick={() => addBlock("row")} />
        <ToolbarButton label="Agregar linea separadora" icon={<Minus className="h-4 w-4" />} onClick={() => addBlock("divider")} />
        <ToolbarButton label="Vista previa" icon={<Eye className="h-4 w-4" />} onClick={() => setPreviewOpen(true)} />
      </div>

      <div className="space-y-3 p-3">
        {content.blocks.length ? null : <p className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">Sin bloques.</p>}
        {content.blocks.map((block, index) => (
          <EditableBlock
            key={block.id}
            block={block}
            onChange={(next) => updateBlock(index, next)}
            onRemove={() => removeBlock(index)}
            onAssetUpload={onAssetUpload}
          />
        ))}
      </div>

      <Modal open={previewOpen} title="Vista previa" onClose={() => setPreviewOpen(false)} size="xl">
        <ClinicalDocumentPreview content={content} />
      </Modal>
    </div>
  );
}

function ToolbarButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="secondary" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

function EditableBlock({
  block,
  onChange,
  onRemove,
  onAssetUpload
}: {
  block: ClinicalDocumentBlock;
  onChange: (block: ClinicalDocumentBlock) => void;
  onRemove: () => void;
  onAssetUpload?: (file: File) => Promise<UploadedAsset>;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!onAssetUpload) return;
    setUploading(true);
    try {
      const uploaded = await onAssetUpload(file);
      onChange({ ...block, url: uploaded.url, fileName: uploaded.fileName, mimeType: uploaded.mimeType });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-slate-500">{block.type}</span>
        <Button type="button" size="sm" variant="danger" onClick={onRemove} title="Eliminar bloque">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {block.type === "title" ? (
        <Textarea aria-label="Titulo del bloque" rows={2} value={block.text ?? ""} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      ) : null}

      {block.type === "text" ? (
        <Textarea aria-label="Texto del bloque" rows={5} value={block.text ?? ""} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      ) : null}

      {block.type === "image" || block.type === "file" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input aria-label="URL del recurso" placeholder="URL" value={block.url ?? ""} onChange={(event) => onChange({ ...block, url: event.target.value })} />
          <Input aria-label="Nombre del recurso" placeholder="Nombre visible" value={block.fileName ?? ""} onChange={(event) => onChange({ ...block, fileName: event.target.value })} />
          {block.type === "image" ? (
            <Input aria-label="Texto alternativo" placeholder="Texto alternativo" value={block.altText ?? ""} onChange={(event) => onChange({ ...block, altText: event.target.value })} />
          ) : null}
          {onAssetUpload ? (
            <label className="flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FileText className="h-4 w-4" />
              {uploading ? "Subiendo..." : "Subir archivo"}
              <input
                className="sr-only"
                type="file"
                accept={block.type === "image" ? "image/png,image/jpeg,image/webp" : undefined}
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {block.type === "row" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {(block.children ?? []).map((child, index) => (
            <Textarea
              key={child.id}
              aria-label={`Texto de columna ${index + 1}`}
              rows={4}
              value={child.text ?? ""}
              onChange={(event) => {
                const children = [...(block.children ?? [])];
                children[index] = { ...child, type: "text", text: event.target.value };
                onChange({ ...block, children });
              }}
            />
          ))}
        </div>
      ) : null}

      {block.type === "divider" ? <div className="h-px bg-slate-200" /> : null}
    </div>
  );
}

export function ClinicalDocumentPreview({ content }: { content: ClinicalDocumentContent }) {
  const normalized = normalizeClinicalDocumentContent(content);
  return (
    <div className="mx-auto max-w-[760px] rounded border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
      <div className="space-y-4">
        {normalized.blocks.map((block) => (
          <PreviewBlock key={block.id} block={block} />
        ))}
      </div>
    </div>
  );
}

function PreviewBlock({ block }: { block: ClinicalDocumentBlock }) {
  if (block.type === "title") return <h2 className="text-xl font-semibold text-slate-950">{block.text}</h2>;
  if (block.type === "text") return <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{block.text}</p>;
  if (block.type === "divider") return <hr className="border-slate-200" />;
  if (block.type === "image") {
    return block.url ? <img src={block.url} alt={block.altText || block.fileName || "Imagen"} className="max-h-[420px] rounded border border-slate-200 object-contain" /> : null;
  }
  if (block.type === "file") {
    return block.url ? (
      <a className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-brand)]" href={block.url} target="_blank" rel="noreferrer">
        <FileText className="h-4 w-4" />
        {block.fileName || block.url}
      </a>
    ) : null;
  }
  if (block.type === "row") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {(block.children ?? []).map((child) => (
          <div key={child.id} className="rounded border border-slate-200 p-3">
            <PreviewBlock block={child} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}
