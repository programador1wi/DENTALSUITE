import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, ChevronDown, LogOut, Megaphone, Menu, UserRound, X } from "lucide-react";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
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
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const accountRef = useRef<HTMLDivElement | null>(null);
  const { data: branches } = useBranches(undefined, "ACTIVE");
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const [globalSearch, setGlobalSearch] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  const permissions = user?.permissions ?? [];
  const section = currentSection(location.pathname, permissions);
  const assignedBranches = useMemo(() => branches ?? [], [branches]);

  useEffect(() => {
    if (assignedBranches.length > 0) {
      const isValid = assignedBranches.some((branch) => branch.id === activeBranchId);
      if (!isValid) setActiveBranchId(assignedBranches[0].id);
    }
  }, [assignedBranches, activeBranchId, setActiveBranchId]);

  useEffect(() => {
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && event.target instanceof Node && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToPatientSearch = (nextSearch = globalSearch) => {
    const term = nextSearch.trim();
    if (!term) return;
    const params = new URLSearchParams({ search: term });
    navigate(`/patients?${params.toString()}`);
    setGlobalSearch("");
  };

  const initials = `${user?.firstName?.charAt(0) ?? "P"}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const fullName = `${user?.firstName || "Soporte"} ${user?.lastName || ""}`.trim();

  return (
    <header className="sticky top-[var(--space-2)] z-30 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_12px_28px_rgba(4,44,83,0.06)] lg:top-[var(--space-3)]">
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
            inputClassName="bg-[var(--bg-page)] hover:border-[var(--border-strong)] focus:bg-[var(--bg-surface)]"
          />
        </div>

        <button
          type="button"
          className="hidden h-10 items-center gap-2 rounded-[var(--radius-md)] px-[var(--space-3)] text-[var(--text-sm)] font-semibold text-[var(--text-brand-strong)] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-brand-light)] hover:text-[var(--text-brand)] lg:inline-flex"
        >
          <Megaphone className="h-4 w-4" />
          Novedades
        </button>

        {assignedBranches.length > 0 ? (
          <label className="hidden h-10 max-w-[260px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-page)] px-[var(--space-3)] text-[var(--text-sm)] font-semibold text-[var(--text-primary)] transition-[border-color,background-color] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] xl:inline-flex">
            <Building2 className="h-4 w-4 text-[var(--text-secondary)]" />
            <select
              value={activeBranchId}
              onChange={(event) => setActiveBranchId(event.target.value)}
              className="min-w-0 cursor-pointer bg-transparent text-[var(--text-sm)] text-[var(--text-primary)] outline-none [&>option]:bg-[var(--bg-surface)] [&>option]:text-[var(--text-primary)]"
            >
              {assignedBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  Suc. {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((value) => !value)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-page)] px-2 text-left transition-[background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]",
              accountOpen && "border-[var(--border-brand-light)] bg-[var(--bg-brand-light)]"
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg-brand-light)] text-[11px] font-semibold text-[var(--text-brand)]">
              {initials}
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="block max-w-[140px] truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{fullName}</span>
            </span>
            <ChevronDown className={cn("hidden h-4 w-4 text-[var(--text-secondary)] transition-transform md:block", accountOpen && "rotate-180")} />
          </button>

          {accountOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-2)] shadow-[var(--shadow-modal)]">
              <div className="border-b border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-3)]">
                <p className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{fullName}</p>
                <p className="mt-1 truncate text-[13px] text-[var(--text-secondary)]">{user?.email ?? "Sesion activa"}</p>
              </div>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="mt-[var(--space-2)] flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-[var(--space-3)] text-[13px] font-medium text-[var(--text-danger)] transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {logout.isPending ? <UserRound className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {logout.isPending ? "Cerrando..." : "Salir"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
