import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[var(--text-sm)] text-[var(--text-primary)] shadow-sm outline-none transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:border-[var(--border-strong)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--focus-ring)]",
          open && "border-[var(--border-brand)] ring-2 ring-[var(--focus-ring)]"
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate pr-4 font-medium">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--text-secondary)] transition-transform duration-[var(--duration-fast)]",
            open && "rotate-180 text-[var(--text-brand)]"
          )}
        />
      </button>

      {open && (
        <div role="listbox" className="absolute left-0 right-0 z-50 mt-1.5 max-h-[300px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-default)]/90 bg-white/95 backdrop-blur-md p-1 shadow-[0_12px_30px_rgba(4,44,83,0.12)] animate-in fade-in-50 slide-in-from-top-1 duration-[var(--duration-fast)] custom-scrollbar">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "relative flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--text-sm)] transition-all duration-[var(--duration-fast)]",
                  isSelected
                    ? "bg-[var(--bg-brand-light)] font-semibold text-[var(--text-brand)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] hover:pl-4"
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 text-[var(--text-brand)] shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
