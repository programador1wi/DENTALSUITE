import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export const CLINICAL_DOCUMENT_CONTENT_VERSION = "clinical-doc-blocks/v1";

const BLOCK_TYPES = ["title", "text", "image", "file", "divider", "row"] as const;
type ClinicalDocumentBlockType = (typeof BLOCK_TYPES)[number];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const text = textValue(value);
  return text ? text : undefined;
}

function blockId(type: ClinicalDocumentBlockType, index: number) {
  return `${type}-${index}-${randomUUID()}`;
}

function normalizeBlock(input: unknown, index: number, depth: number): Prisma.InputJsonObject {
  if (!isRecord(input)) throw new BadRequestException("Clinical document block is invalid");
  const type = input.type;
  if (typeof type !== "string" || !BLOCK_TYPES.includes(type as ClinicalDocumentBlockType)) {
    throw new BadRequestException("Clinical document block type is invalid");
  }

  const normalizedType = type as ClinicalDocumentBlockType;
  const base: JsonRecord = {
    id: optionalText(input.id) ?? blockId(normalizedType, index),
    type: normalizedType
  };

  if (normalizedType === "title" || normalizedType === "text") {
    base.text = textValue(input.text);
  }

  if (normalizedType === "image") {
    base.url = textValue(input.url);
    base.fileName = optionalText(input.fileName);
    base.altText = optionalText(input.altText);
    base.mimeType = optionalText(input.mimeType);
  }

  if (normalizedType === "file") {
    base.url = textValue(input.url);
    base.fileName = optionalText(input.fileName) ?? textValue(input.url);
    base.mimeType = optionalText(input.mimeType);
  }

  if (normalizedType === "row") {
    if (depth > 0) throw new BadRequestException("Nested clinical document rows are not allowed");
    const children = Array.isArray(input.children) ? input.children : [];
    base.children = children.map((child, childIndex) => normalizeBlock(child, childIndex, depth + 1));
  }

  return base as Prisma.InputJsonObject;
}

function legacyTextContent(text: string): Prisma.InputJsonObject {
  const trimmed = text.trim();
  return {
    version: CLINICAL_DOCUMENT_CONTENT_VERSION,
    blocks: trimmed ? [{ id: "legacy-text", type: "text", text: trimmed }] : []
  } as Prisma.InputJsonObject;
}

export function normalizeClinicalDocumentContent(input: unknown): Prisma.InputJsonObject {
  if (typeof input === "string") return legacyTextContent(input);
  if (!isRecord(input)) throw new BadRequestException("Clinical document content is invalid");
  if (!Array.isArray(input.blocks)) throw new BadRequestException("Clinical document content blocks are required");

  return {
    version: CLINICAL_DOCUMENT_CONTENT_VERSION,
    blocks: input.blocks.map((block, index) => normalizeBlock(block, index, 0))
  } as Prisma.InputJsonObject;
}

export function coerceClinicalDocumentContent(input: unknown): Prisma.InputJsonObject {
  try {
    return normalizeClinicalDocumentContent(input);
  } catch {
    return legacyTextContent(typeof input === "string" ? input : "");
  }
}
