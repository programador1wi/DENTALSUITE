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
      onSubmit={onSubmit}
      getItemKey={(patient) => patient.id}
      onSelect={onSelect}
      renderItem={(patient) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-brand-light)] text-xs font-bold text-[var(--text-brand)]">
            {patientInitials(patient)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
              {patientName(patient)}
            </span>
            <span className="block truncate text-xs text-[var(--text-secondary)]">
              {[patient.documentNumber, patient.phone, patient.email, patient.branchName].filter(Boolean).join(" · ") || "Sin contacto registrado"}
            </span>
          </span>
        </div>
      )}
    />
  );
}

export { patientName as getPatientSearchLabel };
