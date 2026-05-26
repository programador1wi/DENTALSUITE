import { Select } from "@/components/ui/select";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";

export function BranchFilter({ value, branches, onChange }: { value: string; branches: Branch[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todas las sucursales</option>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>{branch.name}</option>
      ))}
    </Select>
  );
}

export function ProfessionalFilter({
  value,
  professionals,
  onChange
}: {
  value: string;
  professionals: Professional[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todos los doctores</option>
      {professionals.map((professional) => (
        <option key={professional.id} value={professional.id}>
          {professional.firstName} {professional.lastName}
        </option>
      ))}
    </Select>
  );
}

export function ChairFilter({ value, chairs, onChange }: { value: string; chairs: Chair[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todos los sillones</option>
      {chairs.map((chair) => (
        <option key={chair.id} value={chair.id}>{chair.name}</option>
      ))}
    </Select>
  );
}
