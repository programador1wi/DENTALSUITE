export const CLINICAL_DOCUMENT_CONTENT_VERSION = "clinical-doc-blocks/v1";

export type ClinicalDocumentBlockType = "title" | "text" | "image" | "file" | "divider" | "row";

export type ClinicalDocumentBlock = {
  id: string;
  type: ClinicalDocumentBlockType;
  text?: string;
  url?: string;
  fileName?: string;
  altText?: string;
  mimeType?: string;
  children?: ClinicalDocumentBlock[];
};

export type ClinicalDocumentContent = {
  version: typeof CLINICAL_DOCUMENT_CONTENT_VERSION;
  blocks: ClinicalDocumentBlock[];
};

function createId(type: ClinicalDocumentBlockType) {
  return globalThis.crypto?.randomUUID?.() ?? `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function createClinicalDocumentBlock(type: ClinicalDocumentBlockType): ClinicalDocumentBlock {
  if (type === "row") {
    return {
      id: createId(type),
      type,
      children: [createClinicalDocumentBlock("text"), createClinicalDocumentBlock("text")]
    };
  }
  return { id: createId(type), type, text: type === "title" ? "Nuevo titulo" : type === "text" ? "Nuevo texto" : undefined, url: "" };
}

function normalizeBlock(input: unknown): ClinicalDocumentBlock | null {
  if (!isRecord(input)) return null;
  const type = input.type;
  if (!["title", "text", "image", "file", "divider", "row"].includes(String(type))) return null;
  const normalizedType = type as ClinicalDocumentBlockType;
  return {
    id: textValue(input.id) || createId(normalizedType),
    type: normalizedType,
    text: textValue(input.text),
    url: textValue(input.url),
    fileName: textValue(input.fileName),
    altText: textValue(input.altText),
    mimeType: textValue(input.mimeType),
    children: normalizedType === "row" && Array.isArray(input.children) ? (input.children.map(normalizeBlock).filter(Boolean) as ClinicalDocumentBlock[]) : undefined
  };
}

export function emptyClinicalDocumentContent(): ClinicalDocumentContent {
  return { version: CLINICAL_DOCUMENT_CONTENT_VERSION, blocks: [] };
}

export function normalizeClinicalDocumentContent(input: unknown): ClinicalDocumentContent {
  if (typeof input === "string") {
    const text = input.trim();
    return {
      version: CLINICAL_DOCUMENT_CONTENT_VERSION,
      blocks: text ? [{ id: "legacy-text", type: "text", text }] : []
    };
  }
  if (!isRecord(input) || !Array.isArray(input.blocks)) return emptyClinicalDocumentContent();
  return {
    version: CLINICAL_DOCUMENT_CONTENT_VERSION,
    blocks: input.blocks.map(normalizeBlock).filter(Boolean) as ClinicalDocumentBlock[]
  };
}

export function clinicalDocumentContentToPlainText(content: ClinicalDocumentContent): string {
  const readBlock = (block: ClinicalDocumentBlock): string => {
    if (block.type === "row") return (block.children ?? []).map(readBlock).filter(Boolean).join(" ");
    if (block.type === "image") return block.altText || block.fileName || "";
    if (block.type === "file") return block.fileName || block.url || "";
    return block.text ?? "";
  };
  return content.blocks.map(readBlock).filter(Boolean).join("\n");
}
