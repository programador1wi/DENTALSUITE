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
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            active === item.key ? "bg-white text-slate-900 shadow" : "text-slate-600"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
