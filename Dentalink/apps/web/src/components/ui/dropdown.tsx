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
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selected?.label ?? placeholder}
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100"
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
