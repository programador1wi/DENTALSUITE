import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Megaphone, UserRound, Building2, ArrowLeft, ChevronRight, LayoutDashboard, Menu as MenuIcon } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { PatientSearchBox } from "@/features/patients/components/patient-search-box";
import { hasRequiredPermissions, itemMatchesPath, visibleNavigation, type MenuItem } from "@/components/layout/navigation";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useBranches, normalizeName } from "@/features/settings/branches/hooks/use-branches";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import { useBranchStore } from "@/stores/branch.store";
import { cn } from "@/lib/utils/cn";
import { Drawer } from "@/components/ui/drawer";
import { APP_ROUTES } from "@/lib/routes";
import { getPatientRouteId } from "@/lib/utils/patient-id";

type HeaderBranch = Pick<Branch, "id" | "name"> & {
  code?: string | null;
  brand?: Branch["brand"];
  zone?: Branch["zone"];
};

export function Header() {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const canReadBranches = hasRequiredPermissions(permissions, "branches.read");
  const canSearchPatients = hasRequiredPermissions(permissions, "patients.read");
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();

  const { data: branches } = useBranches(undefined, "ACTIVE", canReadBranches);
  const { activeBranchId, setActiveBranchId } = useBranchStore();

  const [globalSearch, setGlobalSearch] = useState("");
  const [cobranzaSearch, setCobranzaSearch] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openMobileSections, setOpenMobileSections] = useState<Record<string, boolean>>({});

  // Custom multi-step branch dropdown state
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
        setSelectedZone(null);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveDropdown(null);
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navigation = visibleNavigation(permissions);

  const fullName = user ? `${user.firstName} ${user.lastName}` : "Usuario";
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "U";

  const assignedBranches = useMemo<HeaderBranch[]>(() => {
    const source: HeaderBranch[] = canReadBranches ? (branches ?? []) : (user?.branches ?? []);
    return source.filter((branch) => user?.branchIds?.includes(branch.id));
  }, [branches, canReadBranches, user?.branchIds, user?.branches]);

  const activeBranch = useMemo(() => {
    return assignedBranches.find((branch) => branch.id === activeBranchId);
  }, [activeBranchId, assignedBranches]);

  const activeBranchBrand = activeBranch?.brand;

  const groupedBranches = useMemo(() => {
    const groups: Record<string, typeof assignedBranches> = {
      "Plataforma NORTE": [],
      "Plataforma SUR": [],
      "Plataforma DJWARNER": [],
      "Otras sucursales": []
    };

    assignedBranches.forEach((branch) => {
      const zoneCode = branch.zone?.code?.toUpperCase();
      const norm = normalizeName(branch.name);
      if (zoneCode === "NORTE") {
        groups["Plataforma NORTE"].push(branch);
      } else if (zoneCode === "SUR") {
        groups["Plataforma SUR"].push(branch);
      } else if (zoneCode === "DJWARNER" || norm.includes("jwarner")) {
        groups["Plataforma DJWARNER"].push(branch);
      } else {
        groups["Otras sucursales"].push(branch);
      }
    });

    return groups;
  }, [assignedBranches]);

  const activeBranchName = activeBranch?.name || "Seleccionar Sucursal";

  const activeZoneEntries = useMemo(() => {
    return Object.entries(groupedBranches).filter(([_, list]) => list.length > 0);
  }, [groupedBranches]);

  const hasMultipleZones = activeZoneEntries.length > 1;

  const goToPatientSearch = (nextSearch = globalSearch) => {
    const term = nextSearch.trim();
    if (!term) return;
    const params = new URLSearchParams({ search: term });
    navigate(`${APP_ROUTES.patients.root}?${params.toString()}`);
    setGlobalSearch("");
  };

  const getGroupedItems = (children: MenuItem[]) => {
    const hasSections = children.some(c => c.section);
    if (!hasSections) {
      return [{ key: "default", label: "", items: children }];
    }
    return [
      { key: "administration", label: "Administración", items: children.filter(c => c.section === "administration") },
      { key: "configuration", label: "Configuración", items: children.filter(c => c.section === "configuration") }
    ].filter(g => g.items.length > 0);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center justify-between gap-x-3 lg:gap-x-4">
          
          {/* Logo & Branch Switcher */}
          <div className="flex h-14 min-w-0 items-center gap-2 sm:gap-4 xl:gap-6 xl:shrink-0">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] xl:hidden"
              aria-label="Abrir navegación"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <MenuIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link to="/" className="flex items-center gap-2 shrink-0">
              {user?.organization?.logoUrl ? (
                <img src={user.organization.logoUrl} alt="Logo" className="h-10 lg:h-12 w-auto object-contain" />
              ) : (
                <span className="truncate text-lg font-semibold tracking-tight text-[var(--text-brand-strong)] sm:text-2xl">
                  Warner Suite
                </span>
              )}
            </Link>

            {/* Desktop Custom Multi-Step Branch Switcher */}
            {assignedBranches.length > 0 && (
              <div className="relative hidden sm:block" ref={branchDropdownRef}>
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-zinc-300 transition-colors px-2 sm:px-3 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                >
                  <Building2 size={13} className="text-[var(--text-secondary)] opacity-70 shrink-0" />
                  <span className="truncate max-w-[90px] sm:max-w-[160px]" title={activeBranchName}>{activeBranchName}</span>
                  <ChevronDown size={13} className="text-[var(--text-secondary)] opacity-60 shrink-0" />
                </button>

                {branchDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-60 z-50 rounded-lg border border-[var(--border-default)] bg-white p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                    {!hasMultipleZones ? (
                      <div className="space-y-1">
                        <span className="block px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                          Sucursales {activeZoneEntries.length === 1 ? `(${activeZoneEntries[0][0].replace("Plataforma ", "")})` : ""}
                        </span>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {assignedBranches.map((branch) => (
                            <button
                              key={branch.id}
                              type="button"
                              onClick={() => {
                                setActiveBranchId(branch.id);
                                setBranchDropdownOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                                branch.id === activeBranchId
                                  ? "bg-blue-50 text-blue-700 font-bold"
                                  : "text-slate-700 hover:bg-slate-50"
                              )}
                            >
                              {branch.name}
                            </button>
                          ))}
                        </div>
                        {hasRequiredPermissions(permissions, "health_center.view") && (
                          <>
                            <div className="my-1 border-t border-[var(--border-default)]" />
                            <Link
                              to={APP_ROUTES.healthCenter}
                              onClick={() => setBranchDropdownOpen(false)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <LayoutDashboard size={14} className="opacity-70" />
                              <span>Mi centro de salud</span>
                            </Link>
                          </>
                        )}
                      </div>
                    ) : selectedZone === null ? (
                      <div className="space-y-1">
                        <span className="block px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                          Selecciona una Zona
                        </span>
                        {activeZoneEntries.map(([zoneKey]) => {
                          return (
                            <button
                              key={zoneKey}
                              type="button"
                              onClick={() => setSelectedZone(zoneKey)}
                              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <span>{zoneKey.replace("Plataforma ", "")}</span>
                              <ChevronRight size={12} className="opacity-40" />
                            </button>
                          );
                        })}
                        {hasRequiredPermissions(permissions, "health_center.view") && (
                          <>
                            <div className="my-1 border-t border-[var(--border-default)]" />
                            <Link
                              to={APP_ROUTES.healthCenter}
                              onClick={() => setBranchDropdownOpen(false)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <LayoutDashboard size={14} className="opacity-70" />
                              <span>Mi centro de salud</span>
                            </Link>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setSelectedZone(null)}
                          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50/50 transition-colors w-full text-left mb-1"
                        >
                          <ArrowLeft size={11} />
                          <span>Zonas</span>
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <span className="block px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                          Sucursales ({selectedZone.replace("Plataforma ", "")})
                        </span>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {(groupedBranches[selectedZone] ?? []).map((branch) => (
                            <button
                              key={branch.id}
                              type="button"
                              onClick={() => {
                                setActiveBranchId(branch.id);
                                setBranchDropdownOpen(false);
                                setSelectedZone(null);
                              }}
                              className={cn(
                                "flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                                branch.id === activeBranchId
                                  ? "bg-blue-50 text-blue-700 font-bold"
                                  : "text-slate-700 hover:bg-slate-50"
                              )}
                            >
                              {branch.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs — second row on mobile/tablet, inline on desktop */}
          <nav ref={navRef} className="hidden min-w-0 flex-1 items-center gap-1 whitespace-nowrap py-1 xl:flex">
            {navigation.map((item) => {
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const isActive = itemMatchesPath(location.pathname, item) ||
                item.children?.some(child =>
                  itemMatchesPath(location.pathname, child) &&
                  !navigation.some(nav => nav !== item && nav.to === child.to)
                );
              const isCobranza = canSearchPatients && (
                item.to === APP_ROUTES.payments.accountsReceivable || item.to === "/accounts-receivable"
              );

              if (hasChildren) {
                if (isCobranza) {
                  return (
                    <div
                      key={item.to}
                      className="relative py-2 shrink-0"
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveDropdown(item.to); }}
                      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActiveDropdown(null); }}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(prev => prev === item.to ? null : item.to)}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                          isActive 
                            ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <span>{item.label}</span>
                        <ChevronDown size={14} className={cn("transition-transform duration-200", activeDropdown === item.to ? "rotate-180 opacity-100" : "opacity-60")} />
                      </button>

                      {/* Cobranza Custom Dropdown (Only Search Box) */}
                      <div className={cn("absolute left-0 sm:left-1/2 top-full z-50 mt-1 sm:-translate-x-1/2 rounded-lg border border-[var(--border-default)] bg-white p-4 shadow-lg transition-all duration-200 w-[320px] before:absolute before:-top-3 before:inset-x-0 before:h-3", activeDropdown === item.to ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
                        <div className="space-y-2">
                          <label className="text-[11px] font-medium text-[var(--text-secondary)] block">
                            Buscar paciente por nombre o documento
                          </label>
                          <PatientSearchBox
                            value={cobranzaSearch}
                            onValueChange={setCobranzaSearch}
                            onSubmit={(value) => {
                              navigate(`${APP_ROUTES.patients.root}?search=${encodeURIComponent(value)}`);
                              setCobranzaSearch("");
                            }}
                            onSelect={(patient) => {
                              navigate(APP_ROUTES.patients.payments(getPatientRouteId(patient)));
                              setCobranzaSearch("");
                            }}
                            placeholder="Escribe nombre o documento..."
                            inputClassName="bg-[var(--bg-subtle)] border border-[var(--border-default)] focus:bg-white focus:ring-2 focus:ring-[var(--focus-ring)] rounded-md px-3 py-1.5 text-xs w-full h-9"
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                const grouped = getGroupedItems(item.children || []);
                const isMega = grouped.length > 1;

                return (
                  <div
                    key={item.to}
                    className="relative py-2 shrink-0"
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveDropdown(item.to); }}
                    onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActiveDropdown(null); }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(prev => prev === item.to ? null : item.to)}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                        isActive 
                          ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold" 
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <span>{item.label}</span>
                      <ChevronDown size={14} className={cn("transition-transform duration-200", activeDropdown === item.to ? "rotate-180 opacity-100" : "opacity-60")} />
                    </button>

                    {/* Standard Dropdown / Mega Menu */}
                    <div
                      className={cn(
                        "absolute left-0 sm:left-1/2 top-full z-50 mt-1 sm:-translate-x-1/2 rounded-lg border border-[var(--border-default)] bg-white p-3 shadow-lg transition-all duration-200 before:absolute before:-top-3 before:inset-x-0 before:h-3",
                        activeDropdown === item.to ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                        isMega ? "w-[500px]" : "w-[240px]"
                      )}
                    >
                      <div className={cn("grid gap-4", isMega ? "grid-cols-2" : "grid-cols-1")}>
                        {grouped.map((group) => (
                          <div key={group.key} className="space-y-1.5">
                            {group.label && (
                              <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                                {group.label}
                              </h4>
                            )}
                            <div className="space-y-0.5">
                              {group.items.map((subItem) => {
                                const SubIcon = subItem.icon;
                                const isSubActive = itemMatchesPath(location.pathname, subItem);

                                return (
                                  <Link
                                    key={subItem.to}
                                    to={subItem.to}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                                      isSubActive
                                        ? "bg-slate-100 font-semibold text-[var(--text-primary)]"
                                        : "text-[var(--text-secondary)] hover:bg-slate-50 hover:text-[var(--text-primary)]"
                                    )}
                                  >
                                    {SubIcon && <SubIcon size={14} className="opacity-70" />}
                                    <span>{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                    isActive
                      ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Search & Profile */}
          <div className="flex h-14 shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
            {/* Brand Logo */}
            {activeBranchBrand?.logoUrl && (
              <div className="mr-1 hidden items-center border-r border-[var(--border-default)] pr-3 xl:flex" title={`Marca: ${activeBranchBrand.name}`}>
                <img 
                  src={activeBranchBrand.logoUrl} 
                  alt={activeBranchBrand.name} 
                  className="h-9 lg:h-11 max-w-[100px] lg:max-w-[160px] object-contain rounded-sm"
                />
              </div>
            )}

            {/* Search Box */}
            {canSearchPatients ? (
              <div className="relative hidden w-48 xl:block xl:w-64">
                <PatientSearchBox
                  value={globalSearch}
                  onValueChange={setGlobalSearch}
                  onSubmit={(value) => goToPatientSearch(value)}
                  onSelect={(patient) => {
                    navigate(APP_ROUTES.patients.profile(getPatientRouteId(patient)));
                    setGlobalSearch("");
                  }}
                  placeholder="Buscar pacientes..."
                  inputClassName="bg-[var(--bg-subtle)] border-transparent hover:border-[var(--border-default)] focus:bg-white focus:ring-2 focus:ring-[var(--focus-ring)] rounded-full px-4 text-xs h-9"
                />
              </div>
            ) : null}

            {/* Megaphone / Notifications */}
            <button
              type="button"
              className="relative hidden h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] sm:flex"
              aria-label="Novedades"
            >
              <Megaphone className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
              >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-full)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] text-[11px] font-semibold text-[var(--text-brand-strong)]">
                  <div className="flex h-full w-full items-center justify-center rounded-[var(--radius-full)]">
                    {initials}
                  </div>
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-[var(--color-base-emerald-500)]" />
                </div>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-[var(--border-default)] bg-white py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-[var(--border-default)] px-4 py-2">
                    <p className="truncate text-xs font-bold text-slate-900" title={fullName}>{fullName}</p>
                    <p className="truncate text-[10px] text-slate-500 mt-0.5" title={user?.email}>{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to={APP_ROUTES.settings.profile}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <UserRound size={14} className="opacity-70" />
                      <span>Mi perfil</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout.mutate();
                      }}
                      disabled={logout.isPending}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={14} className="opacity-70" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      <Drawer
        open={mobileNavOpen}
        title="Navegación"
        description="Accesos disponibles según tus permisos."
        placement="left"
        size="sm"
        onClose={() => setMobileNavOpen(false)}
      >
        <div className="space-y-[var(--space-5)]">
          {canSearchPatients ? (
            <PatientSearchBox
              value={globalSearch}
              onValueChange={setGlobalSearch}
              onSubmit={(value) => {
                goToPatientSearch(value);
                setMobileNavOpen(false);
              }}
              onSelect={(patient) => {
                navigate(APP_ROUTES.patients.profile(getPatientRouteId(patient)));
                setGlobalSearch("");
                setMobileNavOpen(false);
              }}
              placeholder="Buscar pacientes..."
            />
          ) : null}

          {assignedBranches.length > 0 ? (
            <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Sucursal activa
              <select
                className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] text-[var(--text-sm)]"
                value={activeBranchId ?? ""}
                onChange={(event) => setActiveBranchId(event.target.value)}
              >
                <option value="">Seleccionar sucursal</option>
                {assignedBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          ) : null}

          <nav className="space-y-[var(--space-2)]" aria-label="Navegación principal móvil">
            {navigation.map((item) => {
              const ItemIcon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const active = itemMatchesPath(location.pathname, item) || Boolean(item.children?.some((child) => itemMatchesPath(location.pathname, child)));
              const expanded = openMobileSections[item.to] ?? active;

              if (!hasChildren) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border-l-[3px] px-[var(--space-3)] text-[var(--text-sm)] font-medium",
                      active
                        ? "border-[var(--nav-item-active-border)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
                        : "border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    )}
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <div key={item.to} className="min-w-0">
                  <button
                    type="button"
                    className={cn(
                      "flex min-h-11 w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border-l-[3px] px-[var(--space-3)] text-left text-[var(--text-sm)] font-medium",
                      active
                        ? "border-[var(--nav-item-active-border)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
                        : "border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    )}
                    aria-expanded={expanded}
                    onClick={() => setOpenMobileSections((current) => ({ ...current, [item.to]: !expanded }))}
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <div className="ml-[var(--space-5)] mt-[var(--space-1)] space-y-[var(--space-1)] border-l border-[var(--border-default)] pl-[var(--space-3)]">
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = itemMatchesPath(location.pathname, child);
                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            onClick={() => setMobileNavOpen(false)}
                            className={cn(
                              "flex min-h-10 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)]",
                              childActive ? "bg-[var(--bg-brand-light)] font-semibold text-[var(--text-brand-strong)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            {ChildIcon ? <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-[var(--border-default)] pt-[var(--space-4)]">
            <p className="truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]" title={fullName}>{fullName}</p>
            <p className="truncate text-[var(--text-xs)] text-[var(--text-secondary)]" title={user?.email}>{user?.email}</p>
            <div className="mt-[var(--space-3)] grid gap-[var(--space-2)]">
              <Link to={APP_ROUTES.settings.profile} onClick={() => setMobileNavOpen(false)} className="flex min-h-11 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] text-[var(--text-sm)] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">
                <UserRound className="h-4 w-4" aria-hidden="true" /> Mi perfil
              </Link>
              <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className="flex min-h-11 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] text-left text-[var(--text-sm)] font-medium text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] disabled:opacity-40">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
