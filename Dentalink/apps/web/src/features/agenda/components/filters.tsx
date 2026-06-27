import { useMemo } from "react";
import { Select } from "@/components/ui/select";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { ORDERED_NAMES, normalizeName } from "@/features/settings/branches/hooks/use-branches";

export function BranchFilter({ value, branches, onChange }: { value: string; branches: Branch[]; onChange: (value: string) => void }) {
  const groupedBranches = useMemo(() => {
    const groups: Record<string, Branch[]> = {
      "Plataforma NORTE": [],
      "Plataforma SUR": [],
      "Plataforma DJWARNER": [],
      "Otras sucursales": []
    };

    branches.forEach((branch) => {
      const norm = normalizeName(branch.name);
      const idx = ORDERED_NAMES.indexOf(norm);
      if (idx >= 0 && idx <= 10) {
        groups["Plataforma NORTE"].push(branch);
      } else if (idx >= 11 && idx <= 25) {
        groups["Plataforma SUR"].push(branch);
      } else if (idx >= 26) {
        groups["Plataforma DJWARNER"].push(branch);
      } else {
        groups["Otras sucursales"].push(branch);
      }
    });

    return groups;
  }, [branches]);

  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todas las sucursales</option>
      {Object.entries(groupedBranches).map(([groupLabel, list]) => {
        if (list.length === 0) return null;
        return (
          <optgroup key={groupLabel} label={groupLabel}>
            {list.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </optgroup>
        );
      })}
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
