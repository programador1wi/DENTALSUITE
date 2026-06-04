export const ALLOWED_SPECIALTY_NAMES = ["Odontología General (Integral)", "Ortodoncia"] as const;

export type AllowedSpecialtyName = (typeof ALLOWED_SPECIALTY_NAMES)[number];

export const SPECIALTY_POLICY_MESSAGE = "Solo se permiten las especialidades Ortodoncia y Odontología General (Integral)";

const GENERAL_SPECIALTY = "Odontología General (Integral)" satisfies AllowedSpecialtyName;
const ORTHODONTICS_SPECIALTY = "Ortodoncia" satisfies AllowedSpecialtyName;

const ALLOWED_SPECIALTY_ALIASES = new Map<string, AllowedSpecialtyName>([
  ["general", GENERAL_SPECIALTY],
  ["integral", GENERAL_SPECIALTY],
  ["general integral", GENERAL_SPECIALTY],
  ["general e integral", GENERAL_SPECIALTY],
  ["odontologia general", GENERAL_SPECIALTY],
  ["odontologia integral", GENERAL_SPECIALTY],
  ["odontologia general integral", GENERAL_SPECIALTY],
  ["odontologia general e integral", GENERAL_SPECIALTY],
  ["odontologia general y estetica", GENERAL_SPECIALTY],
  ["odontologia general estetica", GENERAL_SPECIALTY],
  ["ortodoncia", ORTHODONTICS_SPECIALTY],
  ["ortodoncia y ortopedia maxilofacial", ORTHODONTICS_SPECIALTY],
  ["orthodontics", ORTHODONTICS_SPECIALTY]
]);

export function normalizeSpecialtyKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveAllowedSpecialtyName(value?: string | null): AllowedSpecialtyName | null {
  if (!value) return null;
  return ALLOWED_SPECIALTY_ALIASES.get(normalizeSpecialtyKey(value)) ?? null;
}

export function isAllowedSpecialtyName(value?: string | null) {
  return Boolean(resolveAllowedSpecialtyName(value));
}

export function withAllowedSpecialtyName<T extends { name: string }>(specialty: T): T | null {
  const allowedName = resolveAllowedSpecialtyName(specialty.name);
  return allowedName ? { ...specialty, name: allowedName } : null;
}

export function matchesAllowedSpecialtySearch(
  specialty: { name: string; description?: string | null },
  search?: string
) {
  if (!search?.trim()) return true;
  const needle = normalizeSpecialtyKey(search);
  const allowedName = resolveAllowedSpecialtyName(specialty.name) ?? specialty.name;
  return [allowedName, specialty.description ?? ""].some((value) => normalizeSpecialtyKey(value).includes(needle));
}
