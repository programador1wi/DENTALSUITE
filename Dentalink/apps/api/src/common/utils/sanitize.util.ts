const TAG_REGEX = /<\/?[^>]+(>|$)/g;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

export function sanitizeString(value: string) {
  return value.replace(TAG_REGEX, "").replace(CONTROL_CHARS_REGEX, "").trim();
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
