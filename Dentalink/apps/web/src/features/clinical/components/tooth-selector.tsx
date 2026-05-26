import { Select } from "@/components/ui/select";

const FDI_TEETH = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38",
  "55", "54", "53", "52", "51",
  "61", "62", "63", "64", "65",
  "85", "84", "83", "82", "81",
  "71", "72", "73", "74", "75"
] as const;

export function ToothSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (toothNumber: string) => void;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Seleccionar pieza (FDI)</option>
      {FDI_TEETH.map((tooth) => (
        <option key={tooth} value={tooth}>
          {tooth}
        </option>
      ))}
    </Select>
  );
}
