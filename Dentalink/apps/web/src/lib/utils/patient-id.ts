/**
 * Utility functions for formatting and standardizing patient identifiers.
 */

/**
 * Formats a patient number to a standard 6-digit zero-padded string (e.g. 152 -> "000152").
 * If patientNumber is missing, it returns the provided fallbackId or empty string.
 */
export function formatPatientNumber(patientNumber?: number | string | null, fallbackId?: string): string {
  if (patientNumber !== undefined && patientNumber !== null && patientNumber !== "") {
    const num = typeof patientNumber === "number" ? patientNumber : parseInt(String(patientNumber).trim(), 10);
    if (!Number.isNaN(num) && num >= 0) {
      return String(num).padStart(6, "0");
    }
  }
  return fallbackId ?? "";
}

/**
 * Resolves the canonical route ID for a patient.
 * Always prefers the 6-digit padded patientNumber over raw CUID strings.
 */
export function getPatientRouteId(patient?: { id?: string; patientNumber?: number | null } | null): string {
  if (!patient) return "";
  if (patient.patientNumber !== undefined && patient.patientNumber !== null) {
    return formatPatientNumber(patient.patientNumber);
  }
  return patient.id ?? "";
}
