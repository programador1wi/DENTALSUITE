import { BadRequestException } from "@nestjs/common";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function normalizeLogoReference(value: string, current?: string | null) {
  const source = value.trim();
  if (!source) return null;
  if (current && source === current) return current;

  const match = source.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    throw new BadRequestException({
      code: "LOGO_REFERENCE_NOT_ALLOWED",
      message: "El logotipo debe proceder de una carga de imagen validada"
    });
  }
  const bytes = Buffer.from(match[2], "base64");
  const mimeType = match[1].toLowerCase();
  const validSignature = mimeType === "image/png"
    ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : mimeType === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES || !validSignature) {
    throw new BadRequestException({
      code: "INVALID_LOGO_FILE",
      message: "El archivo de logotipo es inválido o excede 2 MB"
    });
  }
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export function safeLogoForPresentation(value?: string | null) {
  return value?.startsWith("data:image/") ? value : null;
}
