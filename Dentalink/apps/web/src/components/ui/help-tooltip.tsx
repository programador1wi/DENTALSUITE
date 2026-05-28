import { ReactNode } from "react";

type HelpTooltipProps = {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  children?: ReactNode;
};

export function HelpTooltip({ content, position = "top", children }: HelpTooltipProps) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-[var(--bg-nav)] border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--bg-nav)] border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-[var(--bg-nav)] border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-[var(--bg-nav)] border-y-transparent border-l-transparent",
  };

  return (
    <div className="relative group inline-flex items-center shrink-0">
      {children ? (
        <div className="cursor-help">{children}</div>
      ) : (
        <button
          type="button"
          className="p-0.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-brand)] focus:outline-none"
          aria-label="Ayuda del sistema"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}

      <div
        className={`pointer-events-none absolute z-[999] w-64 scale-95 rounded-[var(--radius-lg)] bg-[var(--bg-nav)] p-[var(--space-3)] text-[var(--text-xs)] font-medium leading-relaxed text-[var(--text-inverse)] opacity-0 shadow-[var(--shadow-modal)] transition-[opacity,transform] duration-[var(--duration-normal)] ease-[var(--ease-default)] select-none group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 ${positionClasses[position]}`}
      >
        <div className={`absolute border-4 border-solid ${arrowClasses[position]}`} />
        {content}
      </div>
    </div>
  );
}
