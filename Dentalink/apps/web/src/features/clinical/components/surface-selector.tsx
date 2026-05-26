import { Select } from "@/components/ui/select";

const SURFACES = ["O", "I", "M", "D", "B", "L", "P", "C", "MO", "DO", "MOD", "ALL"] as const;

export function SurfaceSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (surface: string) => void;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Superficie</option>
      {SURFACES.map((surface) => (
        <option key={surface} value={surface}>
          {surface}
        </option>
      ))}
    </Select>
  );
}
