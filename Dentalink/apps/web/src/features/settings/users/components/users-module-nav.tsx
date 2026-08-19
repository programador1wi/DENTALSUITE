import { CalendarClock, ChevronDown, FilePenLine, LockKeyhole, UserRound, UserRoundCheck, UsersRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { cn } from "@/lib/utils/cn";
import { Select } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { APP_ROUTES } from "@/lib/routes";

type UsersModuleNavProps = React.PropsWithChildren<{
  actions?: React.ReactNode;
  className?: string;
}>;

const statusOptions = [
  { to: `${APP_ROUTES.settings.users}?status=ACTIVE`, label: "Habilitados" },
  { to: `${APP_ROUTES.settings.users}?status=INACTIVE`, label: "Deshabilitados" },
  { to: `${APP_ROUTES.settings.users}?status=LOCKED`, label: "Bloqueados" },
  { to: `${APP_ROUTES.settings.users}?status=PENDING`, label: "Pendientes" }
];

const blockOptions = [
  {
    to: `${APP_ROUTES.settings.users}/bloqueos/agenda`,
    label: "Bloquear la agenda de todos los profesionales.",
    icon: CalendarClock
  },
  {
    to: `${APP_ROUTES.settings.users}/bloqueos/acceso`,
    label: "Bloquear el acceso a todos los usuarios.",
    icon: LockKeyhole
  }
];

export function UsersModuleNav({ actions, children, className }: UsersModuleNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManageAll = can("system.manage_all");
  const canReadRoles = canManageAll || can("roles.read");
  const canBlockAgenda = canManageAll || (can("appointments.create") && can("professionals.read"));
  const canBlockAccess = canManageAll || can("users.update");
  const canEditContracts = canManageAll || (can("professionals.read") && can("professionals.update"));
  const visibleBlockOptions = blockOptions.filter((option) =>
    option.to.endsWith("/agenda") ? canBlockAgenda : canBlockAccess
  );
  const status = new URLSearchParams(location.search).get("status");
  const isUsersPath = location.pathname === APP_ROUTES.settings.users || location.pathname === "/settings/users";
  const statusActive = isUsersPath && Boolean(status);
  const profilesActive =
    location.pathname === APP_ROUTES.settings.userProfiles ||
    location.pathname === "/settings/users/profiles" ||
    location.pathname.startsWith(APP_ROUTES.settings.roles) ||
    location.pathname.startsWith("/settings/roles");
  const blocksActive =
    location.pathname.startsWith(`${APP_ROUTES.settings.users}/bloqueos`) ||
    location.pathname.startsWith("/settings/users/blocks");
  const mobileValue = isUsersPath && status
    ? `${APP_ROUTES.settings.users}?status=${status}`
    : location.pathname;

  return (
    <WarnerSuitePanel className={cn("overflow-visible", className)}>
      <nav className="relative z-20 flex min-h-[48px] min-w-0 flex-wrap items-stretch justify-between border-b border-[var(--border-default)] bg-white px-2">
        <div className="flex w-full min-w-0 items-center gap-2 py-2 xl:hidden">
          <Select
            aria-label="Sección de usuarios"
            value={mobileValue}
            onChange={(event) => navigate(event.target.value)}
          >
            <option value={APP_ROUTES.settings.users}>Usuarios</option>
            {statusOptions.map((option) => <option key={option.to} value={option.to}>{option.label}</option>)}
            {canReadRoles ? <option value={APP_ROUTES.settings.userProfiles}>Perfiles</option> : null}
            {visibleBlockOptions.map((option) => <option key={option.to} value={option.to}>{option.label}</option>)}
            {canEditContracts ? <option value={APP_ROUTES.settings.userContractsBulk}>Edición masiva de contratos</option> : null}
          </Select>
        </div>

        <div className="hidden flex-wrap items-center gap-1 xl:flex">
          <NavLink
            to={APP_ROUTES.settings.users}
            active={isUsersPath && !status}
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

          {canReadRoles ? (
            <NavLink
              to={APP_ROUTES.settings.userProfiles}
              active={profilesActive}
              icon={<UsersRound className="h-4 w-4" />}
            >
              Perfiles
            </NavLink>
          ) : null}

          {visibleBlockOptions.length ? <NavMenu label="Bloqueos" active={blocksActive} icon={<LockKeyhole className="h-4 w-4" />}>
            {visibleBlockOptions.map((option) => {
              const Icon = option.icon;
              return (
                <MenuLink key={option.to} to={option.to}>
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{option.label}</span>
                </MenuLink>
              );
            })}
          </NavMenu> : null}

          {canEditContracts ? (
            <NavLink
              to={APP_ROUTES.settings.userContractsBulk}
              active={location.pathname === APP_ROUTES.settings.userContractsBulk || location.pathname === "/settings/users/contracts/bulk"}
              icon={<FilePenLine className="h-4 w-4" />}
            >
              Edicion masiva de contratos
            </NavLink>
          ) : null}
        </div>

        {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-1.5">{actions}</div> : null}
      </nav>

      <div className="p-4 sm:p-5">{children}</div>
    </WarnerSuitePanel>
  );
}

function NavLink({
  to,
  active,
  icon,
  children
}: React.PropsWithChildren<{
  to: string;
  active: boolean;
  icon: React.ReactNode;
}>) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand-primary,#0072ce)] font-semibold text-[var(--brand-primary,#0072ce)]"
          : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function NavMenu({
  label,
  active,
  icon,
  children
}: React.PropsWithChildren<{
  label: string;
  active: boolean;
  icon: React.ReactNode;
}>) {
  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          "inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
          active
            ? "border-[var(--brand-primary,#0072ce)] font-semibold text-[var(--brand-primary,#0072ce)]"
            : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
        )}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
      </button>

      <div className="invisible absolute left-0 top-full z-50 min-w-64 rounded-lg border border-slate-200 bg-white p-1.5 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100">
        {children}
      </div>
    </div>
  );
}

function MenuLink({
  to,
  children
}: React.PropsWithChildren<{
  to: string;
}>) {
  const location = useLocation();
  const active = location.pathname + location.search === to;

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-sky-50 font-medium text-[#0784d8]" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {children}
    </Link>
  );
}
