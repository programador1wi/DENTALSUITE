import { useMemo, useState } from "react";

type Option = {
  label: string;
  value: string;
};

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Selecciona"
}: {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);

  return (
    <div className="relative">
      <button
        type="button"
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[var(--text-sm)] text-[var(--text-primary)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:border-[var(--border-strong)] focus:border-[var(--border-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selected?.label ?? placeholder}
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-1)] shadow-[var(--shadow-modal)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="block w-full rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-2)] text-left text-[var(--text-sm)] text-[var(--text-primary)] transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)]"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
