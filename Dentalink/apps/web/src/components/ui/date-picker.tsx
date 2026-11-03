import { Input } from "./input";

export function DatePicker({
  value,
  onChange,
  ariaLabel
}: {
  value?: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <Input
      type="date"
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
