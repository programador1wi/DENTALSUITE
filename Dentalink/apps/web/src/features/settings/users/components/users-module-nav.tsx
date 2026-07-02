import { CalendarClock, ChevronDown, FilePenLine, LockKeyhole, UserRound, UserRoundCheck, UsersRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { cn } from "@/lib/utils/cn";

type UsersModuleNavProps = React.PropsWithChildren<{
  actions?: React.ReactNode;
  className?: string;
}>;

const statusOptions = [
  { to: "/settings/users?status=ACTIVE", label: "Habilitados" },
  { to: "/settings/users?status=INACTIVE", label: "Deshabilitados" },
  { to: "/settings/users?status=LOCKED", label: "Bloqueados" },
  { to: "/settings/users?status=PENDING", label: "Pendientes" }
];

const blockOptions = [
  {
    to: "/settings/users/blocks/agenda",
    label: "Bloquear la agenda de todos los profesionales.",
    icon: CalendarClock
  },
  {
    to: "/settings/users/blocks/access",
    label: "Bloquear el acceso a todos los usuarios.",
    icon: LockKeyhole
  }
];

export function UsersModuleNav({ actions, children, className }: UsersModuleNavProps) {
  const location = useLocation();
  const status = new URLSearchParams(location.search).get("status");
  const statusActive = location.pathname === "/settings/users" && Boolean(status);
  const profilesActive = location.pathname === "/settings/users/profiles" || location.pathname === "/settings/roles";
  const blocksActive = location.pathname.startsWith("/settings/users/blocks");

  return (
    <WarnerSuitePanel className={cn("overflow-visible", className)}>
      <nav className="relative z-20 flex min-h-[48px] flex-wrap items-stretch justify-between border-b border-[var(--border-default)] bg-white px-2">
        <div className="flex flex-wrap items-center gap-1">
          <NavLink
            to="/settings/users"
            active={location.pathname === "/settings/users" && !status}
            icon={<UserRound className="h-4 w-4" />}
          >
            Usuarios
          </NavLink>

          <NavMenu
            label={statusOptions.find((option) => option.to.endsWith(`=${status}`))?.label ?? "Habilitados"}
            active={statusActive}
            icon={<UserRoundCheck className="h-4 w-4" />}
          >
            {statusOptions.map((option) => (
              <MenuLink key={option.to} to={option.to}>
                {option.label}
              </MenuLink>
            ))}
          </NavMenu>

          <NavLink
            to="/settings/users/profiles"
            active={profilesActive}
            icon={<UsersRound className="h-4 w-4" />}
          >
            Perfiles
          </NavLink>

          <NavMenu label="Bloqueos" active={blocksActive} icon={<LockKeyhole className="h-4 w-4" />}>
            {blockOptions.map((option) => {
              const Icon = option.icon;
              return (
                <MenuLink key={option.to} to={option.to}>
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{option.label}</span>
                </MenuLink>
              );
            })}
          </NavMenu>

          <NavLink
            to="/settings/users/contracts/bulk"
            active={location.pathname === "/settings/users/contracts/bulk"}
            icon={<FilePenLine className="h-4 w-4" />}
          >
            Edicion masiva de contratos
          </NavLink>
        </div>

        {actions ? <div className="flex items-center gap-2 px-3 py-1.5">{actions}</div> : null}
      </nav>
      <div className="p-4 sm:p-5">{children}</div>
    </WarnerSuitePanel>
  );
}

function NavLink({
  active,
  children,
  icon,
  to
}: React.PropsWithChildren<{ active: boolean; icon: React.ReactNode; to: string }>) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-[48px] items-center gap-1.5 px-3.5 text-sm font-medium text-slate-500 transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-brand)]",
        active && "text-[var(--text-brand-strong)] font-semibold shadow-[inset_0_-3px_0_0_var(--text-brand)]"
      )}
    >
      <span className={cn("transition-colors", active ? "text-[var(--text-brand)]" : "text-slate-400")}>{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

function NavMenu({
  active,
  children,
  icon,
  label
}: React.PropsWithChildren<{ active: boolean; icon: React.ReactNode; label: string }>) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 px-3.5 text-sm font-medium text-slate-500 transition-colors duration-[var(--duration-fast)] hover:text-[var(--text-brand)] [&::-webkit-details-marker]:hidden",
          active && "text-[var(--text-brand-strong)] font-semibold shadow-[inset_0_-3px_0_0_var(--text-brand)]"
        )}
      >
        <span className={cn("transition-colors", active ? "text-[var(--text-brand)]" : "text-slate-400")}>{icon}</span>
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+4px)] z-30 min-w-[220px] rounded-lg border border-[var(--border-default)] bg-white p-1.5 shadow-[0_4px_20px_rgba(4,44,83,0.08)] animate-in fade-in slide-in-from-top-2 duration-150">
        {children}
      </div>
    </details>
  );
}

function MenuLink({ children, to }: React.PropsWithChildren<{ to: string }>) {
  return (
    <Link
      to={to}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-brand)]"
    >
      {children}
    </Link>
  );
}
