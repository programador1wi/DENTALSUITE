import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck,
  FileText,
  FlaskConical,
  Image,
  Landmark,
  Link as LinkIcon,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Stethoscope,
  UserCog,
  Users,
  UsersRound,
  X
} from "lucide-react";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { cn } from "@/lib/utils/cn";

type MenuSection = "administration" | "configuration";

type MenuItem = {
  to: string;
  label: string;
  permission?: string;
  section?: MenuSection;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: string;
};

type MainNavItem = MenuItem & {
  icon: LucideIcon;
  children?: MenuItem[];
};

const navItems: MainNavItem[] = [
  { to: "/agenda", label: "Agenda", icon: Calendar, permission: "appointments.read" },
  { to: "/patients", label: "Pacientes", icon: Users, permission: "patients.read" },
  { to: "/cash-register/open", label: "Cajas", icon: CreditCard, permission: "cash_register.read" },
  {
    to: "/accounts-receivable",
    label: "Cobranza",
    icon: ShoppingCart,
    permission: "accounts_receivable.read",
    children: [
      { to: "/accounts-receivable", label: "Cuentas por cobrar", permission: "accounts_receivable.read", icon: Receipt },
      { to: "/payments", label: "Pagos recibidos", permission: "payments.read", icon: DollarSign },
      { to: "/installments", label: "Cuotas", permission: "installments.read", icon: Calculator },
      { to: "/collections", label: "Gestion de morosidad", permission: "collections.read", icon: Clock }
    ]
  },
  {
    to: "/settings/organization",
    label: "Administracion",
    icon: ClipboardList,
    children: [
      { to: "/settings/agreements", label: "Convenios", section: "administration", icon: Briefcase },
      { to: "/settings/expenses", label: "Gastos", section: "administration", icon: DollarSign },
      { to: "/settings/professionals", label: "Gestion de profesionales", permission: "professionals.read", section: "administration", icon: UserCog },
      { to: "/settings/specialties", label: "Gestion de especialidades", permission: "specialties.read", section: "administration", icon: Stethoscope },
      { to: "/inventory", label: "Inventario", permission: "inventory.read", section: "administration", icon: Package },
      { to: "/labs", label: "Laboratorios", permission: "lab_providers.read", section: "administration", icon: FlaskConical },
      { to: "/settings/payroll", label: "Nominas", section: "administration", icon: Receipt },
      { to: "/settings/chairs", label: "Planificacion de cubiculos", permission: "chairs.read", section: "administration", icon: Armchair },
      { to: "/settings/users", label: "Usuarios", permission: "users.read", section: "administration", icon: UsersRound },
      { to: "/patients/merge", label: "Fusion de fichas", section: "administration", icon: ClipboardList },
      { to: "/payments/tpv", label: "Pagos TPV", section: "administration", badge: "Nuevo", icon: CreditCard },
      { to: "/settings/plans", label: "Planes y servicios", section: "administration", icon: FileCheck },
      { to: "/settings/online-scheduling", label: "Agenda Online", permission: "schedules.read", section: "configuration", icon: Calendar },
      { to: "/settings/price-lists", label: "Listado de precios", permission: "price_lists.read", section: "configuration", icon: Calculator },
      { to: "/settings/banks", label: "Bancos y entidades financieras", permission: "settings.read", section: "configuration", icon: Landmark },
      { to: "/settings/clinical-documents", label: "Documentos clinicos", permission: "clinical.templates.manage", section: "configuration", icon: FileText },
      { to: "/settings/consent-templates", label: "Consentimientos informados", permission: "consent_templates.read", section: "configuration", icon: FileCheck },
      { to: "/settings/logo", label: "Logotipo", permission: "settings.read", section: "configuration", icon: Image },
      { to: "/settings/payment-methods", label: "Opciones de pago", permission: "payment_methods.read", section: "configuration", icon: Receipt },
      { to: "/payments/cancelled-pending", label: "Pagos anulados y pendientes", section: "configuration", icon: Clock }
    ]
  },
  {
    to: "/reports",
    label: "Reportes",
    icon: BarChart3,
    permission: "reports.read",
    children: [
      { to: "/reports/appointments", label: "Agenda", permission: "reports.read", icon: Calendar },
      { to: "/reports/patients", label: "Pacientes", permission: "reports.read", icon: Users },
      { to: "/reports/treatments", label: "Tratamientos", permission: "reports.read", icon: FileCheck },
      { to: "/reports/financial", label: "Financieros", permission: "reports.read", icon: DollarSign },
      { to: "/reports/professionals", label: "Profesionales", permission: "reports.read", icon: UserCog }
    ]
  },
  { to: "/dashboard", label: "CRM", icon: LinkIcon }
];

function canSee(item: MenuItem, permissions: string[]) {
  return !item.permission || permissions.includes(item.permission);
}

function itemMatchesPath(pathname: string, item: MenuItem) {
  return pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
}

function DropdownLink({ item, onClick }: { item: MenuItem; onClick?: () => void }) {
  const Icon = item.icon ?? CircleHelp;

  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-2 text-[12px] text-slate-400"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Pendiente
        </span>
      </span>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-[12px] text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">{item.label}</span>
      </span>
      {item.badge ? (
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function AdministrationMenu({ items, onItemClick }: { items: MenuItem[]; onItemClick?: () => void }) {
  const groups: Array<{ title: string; section: MenuSection }> = [
    { title: "Administracion", section: "administration" },
    { title: "Configuracion", section: "configuration" }
  ];

  return (
    <div className="grid w-[620px] grid-cols-2 gap-x-5 px-4 py-3">
      {groups.map((group) => (
        <div key={group.section}>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {items
              .filter((child) => child.section === group.section)
              .map((child) => <DropdownLink key={child.to} item={child} onClick={onItemClick} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: branches } = useBranches(undefined, "ACTIVE");
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const [globalSearch, setGlobalSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDesktopDropdown, setOpenDesktopDropdown] = useState<string | null>(null);
  const [openMobileDropdown, setOpenMobileDropdown] = useState<string | null>(null);
  const desktopNavRef = useRef<HTMLElement | null>(null);

  const permissions = user?.permissions ?? [];
  const assignedBranches = useMemo(
    () => branches?.filter((branch) => user?.branchIds?.includes(branch.id)) ?? [],
    [branches, user?.branchIds]
  );

  useEffect(() => {
    if (assignedBranches.length > 0) {
      const isValid = assignedBranches.some((branch) => branch.id === activeBranchId);
      if (!isValid) setActiveBranchId(assignedBranches[0].id);
    }
  }, [assignedBranches, activeBranchId, setActiveBranchId]);

  const visibleNav = navItems
    .filter((item) => canSee(item, permissions))
    .map((item) => ({ ...item, children: item.children?.filter((child) => canSee(child, permissions)) }));

  const goToPatientSearch = () => {
    const term = globalSearch.trim();
    if (!term) return;
    navigate(`/patients?search=${encodeURIComponent(term)}`);
    setGlobalSearch("");
    setMobileOpen(false);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goToPatientSearch();
  };

  useEffect(() => {
    setOpenDesktopDropdown(null);
    setOpenMobileDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopNavRef.current && event.target instanceof Node && !desktopNavRef.current.contains(event.target)) {
        setOpenDesktopDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="bg-[#0879d5] text-white">
        <div className="mx-auto flex min-h-[50px] w-full max-w-[1150px] items-center gap-4 px-4">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2 text-xl font-bold tracking-tight">
            <span>dentalink</span>
            <span className="h-4 w-4 rounded-full border-2 border-white/90" />
          </Link>

          <form onSubmit={submitSearch} className="relative hidden min-w-[260px] flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/75" />
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goToPatientSearch();
                }
              }}
              className="h-9 w-full rounded bg-white/16 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/78 focus:bg-white/24 focus:ring-2 focus:ring-white/30"
              placeholder="Busca pacientes por nombre o documento de ID"
            />
          </form>

          <div className="ml-auto hidden items-center gap-4 text-xs font-semibold lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <Megaphone className="h-4 w-4" />
              Novedades
            </span>

            {assignedBranches.length > 0 ? (
              <label className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                <select
                  value={activeBranchId}
                  onChange={(event) => setActiveBranchId(event.target.value)}
                  className="max-w-[220px] cursor-pointer rounded border-0 bg-transparent p-0 text-xs font-semibold text-white outline-none"
                >
                  {assignedBranches.map((branch) => (
                    <option key={branch.id} value={branch.id} className="text-slate-900">
                      Dental + Suc. {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold uppercase">
                {user?.firstName?.charAt(0) || "P"}
              </span>
              {(user?.firstName || "Soporte").toLowerCase()} {(user?.lastName || "").toLowerCase()}
            </span>

            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="inline-flex items-center gap-1 rounded bg-white/16 px-2.5 py-1.5 transition hover:bg-white/25 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>

          <button
            type="button"
            className="ml-auto rounded p-2 text-white lg:hidden"
            aria-label={mobileOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav ref={desktopNavRef} className="hidden bg-white lg:block">
        <div className="mx-auto flex h-12 w-full max-w-[1150px] items-center gap-1 px-4">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const hasChildren = Boolean(item.children?.length);
            const active = itemMatchesPath(location.pathname, item) || Boolean(item.children?.some((child) => itemMatchesPath(location.pathname, child)));
            const dropdownOpen = openDesktopDropdown === item.to;
            return (
              <div key={item.to} className="group relative h-full">
                {hasChildren ? (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    onClick={() => setOpenDesktopDropdown((value) => (value === item.to ? null : item.to))}
                    className={cn(
                      "flex h-full items-center gap-1.5 px-3 text-sm font-medium text-slate-600 transition hover:text-[#0879d5]",
                      active && "text-[#0879d5]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", dropdownOpen && "rotate-180")}
                    />
                  </button>
                ) : (
                  <Link
                    to={item.to}
                    className={cn(
                      "flex h-full items-center gap-1.5 px-3 text-sm font-medium text-slate-600 transition hover:text-[#0879d5]",
                      active && "text-[#0879d5]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )}

                {hasChildren ? (
                  <div
                    className={cn(
                      "absolute left-0 top-full z-50 rounded-md border border-slate-200 bg-white shadow-lg transition",
                      dropdownOpen ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
                    )}
                  >
                    {item.label === "Administracion" ? (
                      <AdministrationMenu
                        items={item.children ?? []}
                        onItemClick={() => setOpenDesktopDropdown(null)}
                      />
                    ) : (
                      <div className="min-w-[250px] space-y-0.5 p-2">
                        {item.children?.map((child) => (
                          <DropdownLink
                            key={child.to}
                            item={child}
                            onClick={() => setOpenDesktopDropdown(null)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-sky-700 bg-white p-4 lg:hidden">
          <form onSubmit={submitSearch} className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goToPatientSearch();
                }
              }}
              className="h-10 w-full rounded border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-[#0879d5]"
              placeholder="Busca pacientes por nombre o documento"
            />
          </form>
          <div className="space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const dropdownOpen = openMobileDropdown === item.to;
              return (
                <div key={item.to} className="rounded border border-slate-100">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => setOpenMobileDropdown((value) => (value === item.to ? null : item.to))}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
                    >
                      <Icon className="h-4 w-4 text-[#0879d5]" />
                      <span>{item.label}</span>
                      <ChevronDown
                        className={cn("ml-auto h-3.5 w-3.5 text-slate-400 transition-transform", dropdownOpen && "rotate-180")}
                      />
                    </button>
                  ) : (
                    <Link
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      <Icon className="h-4 w-4 text-[#0879d5]" />
                      {item.label}
                    </Link>
                  )}
                  {hasChildren && dropdownOpen ? (
                    <div className="grid gap-1 border-t border-slate-100 p-2">
                      {item.children?.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={() => setMobileOpen(false)}
                          className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
