import type { Specialty } from "../services/specialties.service";

export const ALLOWED_SPECIALTY_NAMES = ["Odontología General (Integral)", "Ortodoncia"] as const;

export type AllowedSpecialtyName = (typeof ALLOWED_SPECIALTY_NAMES)[number];

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

export function canonicalizeSpecialty<T extends Specialty>(specialty: T): T | null {
  const allowedName = resolveAllowedSpecialtyName(specialty.name);
  return allowedName ? { ...specialty, name: allowedName } : null;
}

export function filterAllowedSpecialties<T extends Specialty>(specialties: T[]) {
  return specialties
    .map((specialty) => canonicalizeSpecialty(specialty))
    .filter((specialty): specialty is T => Boolean(specialty));
}

export function specialtyMatchesSelection(
  candidate: { id: string; name: string },
  selectedId: string,
  selected?: { id: string; name: string } | null
) {
  if (!selectedId) return true;
  if (candidate.id === selectedId) return true;

  const candidateName = resolveAllowedSpecialtyName(candidate.name);
  const selectedName = resolveAllowedSpecialtyName(selected?.name);
  return Boolean(candidateName && selectedName && candidateName === selectedName);
}
