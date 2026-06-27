import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Megaphone, Menu, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { PatientSearchBox } from "@/features/patients/components/patient-search-box";
import { itemMatchesPath, visibleNavigation } from "@/components/layout/navigation";
import { cn } from "@/lib/utils/cn";

function currentSection(pathname: string, permissions: string[]) {
  const item = visibleNavigation(permissions).find(
    (navItem) => itemMatchesPath(pathname, navItem) || navItem.children?.some((child) => itemMatchesPath(pathname, child))
  );

  return item?.label ?? "Panel operativo";
}

export function Header({
  onMenuClick,
  mobileOpen
}: {
  onMenuClick?: () => void;
  mobileOpen?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [globalSearch, setGlobalSearch] = useState("");

  const permissions = user?.permissions ?? [];
  const section = currentSection(location.pathname, permissions);

  const goToPatientSearch = (nextSearch = globalSearch) => {
    const term = nextSearch.trim();
    if (!term) return;
    const params = new URLSearchParams({ search: term });
    navigate(`/patients?${params.toString()}`);
    setGlobalSearch("");
  };

  return (
    <header className="sticky top-[var(--space-2)] z-50 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_12px_28px_rgba(4,44,83,0.06)] lg:top-[var(--space-3)]">
      <div className="flex h-16 items-center gap-[var(--space-4)] px-[var(--space-4)] md:px-[var(--space-8)]">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] lg:hidden"
          aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
          onClick={onMenuClick}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Modulo activo</p>
          <h1 className="truncate text-[var(--text-xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">{section}</h1>
        </div>

        <div className="relative ml-auto hidden w-full max-w-[420px] md:block">
          <PatientSearchBox
            value={globalSearch}
            onValueChange={setGlobalSearch}
            onSubmit={(value) => goToPatientSearch(value)}
            onSelect={(patient) => {
              navigate(`/patients/${patient.id}/profile`);
              setGlobalSearch("");
            }}
            placeholder="Buscar pacientes por nombre o documento"
            inputClassName="bg-[var(--bg-subtle)] border-transparent hover:border-[var(--border-default)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--focus-ring)] rounded-full px-4"
          />
        </div>

        <button
          type="button"
          className="relative hidden h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] lg:flex"
          aria-label="Novedades"
        >
          <Megaphone className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
}
