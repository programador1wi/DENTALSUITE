export type ToothArch = "upper" | "lower";

const SINGLE_SURFACE_LABELS: Record<string, string> = {
  B: "Vestibular",
  M: "Mesial",
  D: "Distal",
  P: "Palatina",
  L: "Lingual",
  O: "Oclusal",
  I: "Incisal",
  C: "Cervical"
};

const LEGACY_SURFACE_LABELS: Record<string, string> = {
  MO: "Mesial/Oclusal",
  DO: "Distal/Oclusal",
  MOD: "Mesial/Oclusal/Distal",
  ALL: "Pieza completa"
};

export function fdiLabel(toothNumber: string) {
  return toothNumber.length >= 2 ? `${toothNumber[0]}.${toothNumber[1]}` : toothNumber;
}

export function toothArch(toothNumber: string): ToothArch {
  return ["1", "2", "5", "6"].includes(toothNumber[0]) ? "upper" : "lower";
}

export function isIncisalTooth(toothNumber: string) {
  return ["1", "2", "3"].includes(toothNumber[1]);
}

export function surfaceForFaceIndex(toothNumber: string, faceIndex: number) {
  const arch = toothArch(toothNumber);
  if (faceIndex === 5) return isIncisalTooth(toothNumber) ? "I" : "O";
  if (arch === "upper") {
    return ({ 1: "B", 2: "M", 3: "P", 4: "D" } as Record<number, string>)[faceIndex] ?? "";
  }
  return ({ 1: "L", 2: "M", 3: "B", 4: "D" } as Record<number, string>)[faceIndex] ?? "";
}

export function faceIndexesForSurface(toothNumber: string, surface?: string | null) {
  if (surface?.trim().toUpperCase() === "ALL") return [1, 2, 3, 4, 5];

  const codes = surfaceCodes(surface);
  if (!codes.length) return [];

  const indexes: number[] = [];
  for (let index = 1; index <= 5; index += 1) {
    if (codes.includes(surfaceForFaceIndex(toothNumber, index))) indexes.push(index);
  }
  return indexes;
}

export function surfaceCodes(surface?: string | null) {
  if (!surface || surface === "ALL") return [];
  const normalized = surface.trim().toUpperCase();
  if (!normalized) return [];
  if (normalized.includes(",")) return normalized.split(",").map((item) => item.trim()).filter(Boolean);
  if (LEGACY_SURFACE_LABELS[normalized] && normalized !== "ALL") return normalized.split("");
  return [normalized];
}

export function orderedSurfaceCodesForTooth(toothNumber: string, surface?: string | null) {
  const codes = [...new Set(surfaceCodes(surface))];
  return [1, 2, 3, 4, 5].map((faceIndex) => surfaceForFaceIndex(toothNumber, faceIndex)).filter((code) => codes.includes(code));
}

export function surfaceCodeStringForTooth(toothNumber: string, codes: string[]) {
  const codeSet = new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean));
  return [1, 2, 3, 4, 5].map((faceIndex) => surfaceForFaceIndex(toothNumber, faceIndex)).filter((code) => codeSet.has(code)).join(",");
}

export function toggleSurfaceForTooth(toothNumber: string, currentSurface: string | undefined, surface: string) {
  const codes = new Set(orderedSurfaceCodesForTooth(toothNumber, currentSurface));
  const normalized = surface.trim().toUpperCase();
  if (codes.has(normalized)) {
    codes.delete(normalized);
  } else {
    codes.add(normalized);
  }
  return surfaceCodeStringForTooth(toothNumber, [...codes]);
}

export function surfaceLabel(surface?: string | null) {
  if (!surface || surface === "ALL") return "Pieza completa";
  const normalized = surface.trim().toUpperCase();
  if (LEGACY_SURFACE_LABELS[normalized]) return LEGACY_SURFACE_LABELS[normalized];
  const labels = surfaceCodes(normalized).map((code) => SINGLE_SURFACE_LABELS[code] ?? code);
  return labels.length ? labels.join(", ") : normalized;
}

export function pieceSurfaceLabel(toothNumber: string, surface?: string | null) {
  const toothLabel = `Pieza ${fdiLabel(toothNumber)}`;
  return surface ? `${toothLabel} - Cara ${surfaceLabel(surface).toLowerCase()}` : toothLabel;
}
