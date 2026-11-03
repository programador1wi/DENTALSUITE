import { extname } from "node:path";

export type UploadCandidate = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer?: Buffer;
};

export type FileValidationFailureCode =
  | "FILE_REQUIRED"
  | "INVALID_SIZE"
  | "SIZE_MISMATCH"
  | "UNSUPPORTED_EXTENSION"
  | "MIME_MISMATCH"
  | "SIGNATURE_MISMATCH";

export type FileValidationResult =
  | {
      ok: true;
      extension: string;
      mimeType: string;
      originalName: string;
      size: number;
      buffer: Buffer;
    }
  | {
      ok: false;
      code: FileValidationFailureCode;
      extension: string | null;
      mimeType: string | null;
    };

type FileTypeRule = {
  mimeTypes: ReadonlySet<string>;
  matchesContent: (buffer: Buffer) => boolean;
};

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ZIP_LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OOXML_CONTENT_TYPES = Buffer.from("[Content_Types].xml", "utf8");

const hasPrefix = (buffer: Buffer, prefix: readonly number[]) =>
  buffer.length >= prefix.length && prefix.every((value, index) => buffer[index] === value);

const isJpeg = (buffer: Buffer) => hasPrefix(buffer, [0xff, 0xd8, 0xff]);
const isPng = (buffer: Buffer) => hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isWebp = (buffer: Buffer) =>
  buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
const isPdf = (buffer: Buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
const isOleCompoundDocument = (buffer: Buffer) =>
  hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isDicom = (buffer: Buffer) =>
  buffer.length >= 132 && buffer.subarray(128, 132).toString("ascii") === "DICM";
const isUtf8Text = (buffer: Buffer) => {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
};
const isOoxml = (buffer: Buffer, contentDirectory: "word/" | "xl/") =>
  buffer.length >= 4 &&
  buffer.subarray(0, 4).equals(ZIP_LOCAL_FILE_HEADER) &&
  buffer.includes(OOXML_CONTENT_TYPES) &&
  buffer.includes(Buffer.from(contentDirectory, "utf8"));

const mimeSet = (...mimeTypes: string[]) => new Set(mimeTypes);

const FILE_TYPE_RULES: Readonly<Record<string, FileTypeRule>> = {
  ".jpg": { mimeTypes: mimeSet("image/jpeg"), matchesContent: isJpeg },
  ".jpeg": { mimeTypes: mimeSet("image/jpeg"), matchesContent: isJpeg },
  ".png": { mimeTypes: mimeSet("image/png"), matchesContent: isPng },
  ".webp": { mimeTypes: mimeSet("image/webp"), matchesContent: isWebp },
  ".pdf": { mimeTypes: mimeSet("application/pdf"), matchesContent: isPdf },
  ".doc": { mimeTypes: mimeSet("application/msword"), matchesContent: isOleCompoundDocument },
  ".docx": {
    mimeTypes: mimeSet("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    matchesContent: (buffer) => isOoxml(buffer, "word/")
  },
  ".xls": { mimeTypes: mimeSet("application/vnd.ms-excel"), matchesContent: isOleCompoundDocument },
  ".xlsx": {
    mimeTypes: mimeSet("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    matchesContent: (buffer) => isOoxml(buffer, "xl/")
  },
  ".txt": { mimeTypes: mimeSet("text/plain"), matchesContent: isUtf8Text },
  ".dcm": { mimeTypes: mimeSet("application/dicom"), matchesContent: isDicom },
  ".dicom": { mimeTypes: mimeSet("application/dicom"), matchesContent: isDicom }
};

export function validateUploadedFile(file?: UploadCandidate): FileValidationResult {
  if (!file?.buffer || !file.originalname?.trim()) {
    return { ok: false, code: "FILE_REQUIRED", extension: null, mimeType: null };
  }

  const extension = extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype?.trim().toLowerCase() || "application/octet-stream";

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, code: "INVALID_SIZE", extension, mimeType };
  }
  if (file.buffer.length !== file.size) {
    return { ok: false, code: "SIZE_MISMATCH", extension, mimeType };
  }

  const rule = FILE_TYPE_RULES[extension];
  if (!rule) return { ok: false, code: "UNSUPPORTED_EXTENSION", extension, mimeType };
  if (!rule.mimeTypes.has(mimeType)) {
    return { ok: false, code: "MIME_MISMATCH", extension, mimeType };
  }
  if (!rule.matchesContent(file.buffer)) {
    return { ok: false, code: "SIGNATURE_MISMATCH", extension, mimeType };
  }

  return {
    ok: true,
    extension,
    mimeType,
    originalName: file.originalname.trim(),
    size: file.size,
    buffer: file.buffer
  };
}
