import { sanitizePlainText } from "./sanitize-rich-text.util";

export function sanitizeString(value: string) {
  return sanitizePlainText(value);
}

export function sanitizeUnknown<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value) as T;
  if (Array.isArray(value)) return value.map((entry) => sanitizeUnknown(entry)) as T;
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeUnknown(entry);
    }
    return result as T;
  }
  return value;
}
