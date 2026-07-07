import { Select } from "@/components/ui/select";
import { surfaceLabel } from "../utils/tooth-surface";

const SURFACES = ["O", "I", "M", "D", "B", "L", "P", "C", "MO", "DO", "MOD", "ALL"] as const;
const SURFACE_SET = new Set<string>(SURFACES);

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
      {value && !SURFACE_SET.has(value) ? (
        <option value={value}>
          {surfaceLabel(value)}
        </option>
      ) : null}
      {SURFACES.map((surface) => (
        <option key={surface} value={surface}>
          {surfaceLabel(surface)}
        </option>
      ))}
    </Select>
  );
}
