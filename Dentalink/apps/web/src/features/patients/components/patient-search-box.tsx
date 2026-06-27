import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { usePatientSearch } from "../hooks/use-patients";
import type { PatientListItem } from "../services/patients.service";

type PatientSearchBoxProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (patient: PatientListItem) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  onSubmit?: (value: string) => void;
  minChars?: number;
};

function patientName(patient: PatientListItem) {
  return `${patient.firstName} ${patient.lastName}`.trim() || "Paciente sin nombre";
}

function patientInitials(patient: PatientListItem) {
  const first = patient.firstName?.trim().charAt(0) ?? "";
  const last = patient.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "P";
}

export function PatientSearchBox({
  value,
  onValueChange,
  onSelect,
  placeholder = "Buscar paciente",
  className,
  inputClassName,
  dropdownClassName,
  onSubmit,
  minChars = 1
}: PatientSearchBoxProps) {
  const query = value.trim();
  const patients = usePatientSearch({ q: query || undefined });

  return (
    <EntitySearchBox
      value={value}
      onValueChange={onValueChange}
      items={patients.data ?? []}
      loading={patients.isFetching}
      minChars={minChars}
      className={className}
      inputClassName={inputClassName}
      dropdownClassName={dropdownClassName}
      placeholder={placeholder}
      emptyMessage="Sin pacientes encontrados"
      headerTitle="Pacientes encontrados"
      onSubmit={onSubmit}
      getItemKey={(patient) => patient.id}
      onSelect={onSelect}
      renderItem={(patient, active) => (
        <div className="flex min-w-0 w-full items-center justify-between gap-3 py-0.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--bg-brand-light)] to-[var(--bg-subtle)] text-xs font-bold text-[var(--text-brand)] shadow-sm ring-1 ring-[var(--border-default)]/30">
              {patientInitials(patient)}
            </span>
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                {patientName(patient)}
              </span>
              <span className="block truncate text-xs text-[var(--text-secondary)]">
                {[patient.documentNumber, patient.phone || patient.email].filter(Boolean).join(" · ") || "Sin contacto registrado"}
              </span>
            </div>
          </div>
          {patient.branchName && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors ${
              active
                ? "border-[var(--border-brand)] bg-[var(--bg-surface)] text-[var(--text-brand)]"
                : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            }`}>
              {patient.branchName}
            </span>
          )}
        </div>
      )}
    />
  );
}

export { patientName as getPatientSearchLabel };
