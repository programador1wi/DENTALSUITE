import { cn } from "@/lib/utils/cn";

type Tab = {
  key: string;
  label: string;
};

export function Tabs({
  items,
  active,
  onChange
}: {
  items: Tab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "rounded-[var(--radius-sm)] px-[var(--space-3)] py-1.5 text-[13px] font-medium transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)]",
            active === item.key ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
