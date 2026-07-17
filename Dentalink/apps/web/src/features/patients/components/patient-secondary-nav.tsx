import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils/cn";

export type PatientSecondaryTab = {
  to: string;
  label: string;
  activeMatch?: string;
  permission?: string;
  count?: number;
  children?: Array<{ to: string; label: string; permission?: string }>;
};

export function PatientSecondaryNav({ tabs, label }: { tabs: PatientSecondaryTab[]; label: string }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const visibleTabs = tabs.filter((tab) => !tab.permission || hasPermission(tab.permission));

  if (!visibleTabs.length) return null;

  return (
    <nav className="overflow-x-auto border border-slate-200 bg-white shadow-sm" aria-label={label}>
      <div className="inline-flex min-w-full items-stretch">
        {visibleTabs.map((tab) => {
          const active = location.pathname === tab.to || (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false);
          return <PatientSecondaryNavItem key={tab.to} tab={tab} active={active} />;
        })}
      </div>
    </nav>
  );
}

function PatientSecondaryNavItem({ tab, active }: { tab: PatientSecondaryTab; active: boolean }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220 });
  const children = (tab.children ?? []).filter((child) => !child.permission || hasPermission(child.permission));
  const baseClass = cn(
    "inline-flex whitespace-nowrap border-r border-slate-200 px-4 py-3 text-xs font-semibold transition",
    active ? "bg-white text-[#0879d5] shadow-[inset_0_-3px_0_#0879d5]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  );

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = 240;
      setPosition({
        top: rect.bottom + 6,
        left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
        width
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!children.length) {
    return (
      <Link to={tab.to} className={baseClass}>
        {tab.label}
        {tab.count != null && tab.count > 0 ? <CountBadge count={tab.count} /> : null}
      </Link>
    );
  }

  return (
    <div className="inline-flex border-r border-slate-200">
      <Link to={tab.to} className={cn(baseClass, "border-r-0 pr-2")}>
        {tab.label}
        {tab.count != null && tab.count > 0 ? <CountBadge count={tab.count} /> : null}
      </Link>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex items-center px-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879d5]",
          active ? "bg-white text-[#0879d5] shadow-[inset_0_-3px_0_#0879d5]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
        aria-label={`Abrir opciones de ${tab.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, left: position.left, width: position.width }}
              className="fixed z-[1600] rounded-md border border-slate-200 bg-white py-1 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
            >
              {children.map((child) => {
                const childActive = location.pathname === child.to;
                return (
                  <Link
                    key={child.to}
                    to={child.to}
                    role="menuitem"
                    className={cn(
                      "block px-4 py-2.5 text-sm font-medium transition",
                      childActive ? "bg-sky-50 text-[#0879d5]" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0879d5] px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}
