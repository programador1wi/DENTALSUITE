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
import { NovedadesButton, NovedadesDrawer, useNovedadesStore } from "@/features/novedades";

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

  const openNovedadesDrawer = useNovedadesStore((state) => state.openDrawer);
  const unreadNovedadesCount = useNovedadesStore((state) =>
    state.releases.filter((r) => !state.readIds.includes(r.id)).length
  );

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
  const primaryRole = user?.roleNames?.[0] || null;

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
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-14 sm:min-h-16 min-w-0 items-center justify-between gap-x-2 lg:gap-x-4 py-1">
          
          {/* Logo & Branch Switcher */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 xl:gap-4 shrink-0">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] xl:hidden"
              aria-label="Abrir navegación"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <MenuIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link to="/" className="flex items-center gap-2 shrink-0">
              {user?.organization?.logoUrl ? (
                <img src={user.organization.logoUrl} alt="Logo" className="h-11 sm:h-12 lg:h-13 w-auto max-w-[170px] object-contain" />
              ) : (
                <span className="truncate text-lg font-bold tracking-tight text-[var(--text-brand-strong)] sm:text-2xl">
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
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-slate-300 transition-colors px-2 sm:px-2.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                >
                  <Building2 size={13} className="text-[var(--text-secondary)] opacity-70 shrink-0" />
                  <span className="truncate max-w-[90px] sm:max-w-[150px]" title={activeBranchName}>{activeBranchName}</span>
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
          <nav ref={navRef} className="hidden min-w-0 flex-1 items-center justify-start 2xl:justify-center gap-0.5 2xl:gap-1 whitespace-nowrap py-1 xl:flex">
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
                          "flex items-center gap-1 rounded-md px-2 2xl:px-2.5 py-1.5 text-xs 2xl:text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                          isActive 
                            ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <span>{item.label}</span>
                        <ChevronDown size={13} className={cn("transition-transform duration-200", activeDropdown === item.to ? "rotate-180 opacity-100" : "opacity-60")} />
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
                        "flex items-center gap-1 rounded-md px-2 2xl:px-2.5 py-1.5 text-xs 2xl:text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                        isActive 
                          ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold" 
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <span>{item.label}</span>
                      <ChevronDown size={13} className={cn("transition-transform duration-200", activeDropdown === item.to ? "rotate-180 opacity-100" : "opacity-60")} />
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
                    "shrink-0 rounded-md px-2 2xl:px-2.5 py-1.5 text-xs 2xl:text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
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
          <div className="flex min-h-14 sm:min-h-16 shrink-0 items-center gap-1.5 sm:gap-2 2xl:gap-3">
            {/* Brand Logo (Marca de Sucursal) */}
            {activeBranchBrand?.logoUrl && (
              <div
                className="hidden xl:flex items-center border-r border-slate-200 pr-3.5 mr-1 shrink-0"
                title={`Marca: ${activeBranchBrand.name}`}
              >
                <img
                  src={activeBranchBrand.logoUrl}
                  alt={activeBranchBrand.name}
                  className="h-10 sm:h-11 lg:h-12 max-w-[140px] lg:max-w-[170px] object-contain rounded-xs"
                />
              </div>
            )}

            {/* Search Box */}
            {canSearchPatients ? (
              <div className="relative hidden w-40 xl:block 2xl:w-56">
                <PatientSearchBox
                  value={globalSearch}
                  onValueChange={setGlobalSearch}
                  onSubmit={(value) => goToPatientSearch(value)}
                  onSelect={(patient) => {
                    navigate(APP_ROUTES.patients.profile(getPatientRouteId(patient)));
                    setGlobalSearch("");
                  }}
                  placeholder="Buscar pacientes..."
                  inputClassName="bg-[var(--bg-subtle)] border-transparent hover:border-[var(--border-default)] focus:bg-white focus:ring-2 focus:ring-[var(--focus-ring)] rounded-full px-3.5 text-xs h-8"
                />
              </div>
            ) : null}

            {/* Novedades / Release Notes */}
            <NovedadesButton />

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] pl-1.5 pr-2.5 py-1 text-slate-700 transition-all hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] shadow-xs",
                  userDropdownOpen && "border-[var(--border-brand)] bg-[var(--bg-subtle)] ring-1 ring-[var(--focus-ring)]"
                )}
                aria-label="Menú de usuario"
                aria-expanded={userDropdownOpen}
              >
                {/* Avatar with active green indicator */}
                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] text-[11px] font-bold text-[var(--text-brand-strong)]">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={fullName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                {/* Name & primary role */}
                <div className="hidden xl:flex items-center gap-1.5 text-left">
                  <span className="truncate max-w-[120px] text-xs font-semibold text-slate-800" title={fullName}>
                    {fullName}
                  </span>
                  {primaryRole && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200">
                      {primaryRole}
                    </span>
                  )}
                </div>

                <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-200", userDropdownOpen && "rotate-180")} />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                  {/* User Profile Card Header */}
                  <div className="flex items-center gap-3 border-b border-slate-100 p-3 bg-slate-50/80 rounded-xl">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-xs font-bold text-blue-800 shadow-xs">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={fullName} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <span>{initials}</span>
                      )}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-slate-900 leading-tight" title={fullName}>{fullName}</p>
                      <p className="truncate text-[11px] text-slate-500 mt-0.5" title={user?.email}>{user?.email}</p>
                      {primaryRole && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-800 uppercase tracking-wide">
                            {primaryRole}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Profile Actions */}
                  <div className="py-1">
                    <Link
                      to={APP_ROUTES.settings.profile}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <UserRound size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-800">Mi perfil</span>
                        <span className="text-[10px] text-slate-400">Datos personales y preferencias</span>
                      </div>
                    </Link>
                  </div>

                  {/* Log Out Action */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout.mutate();
                      }}
                      disabled={logout.isPending}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <LogOut size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold">{logout.isPending ? "Cerrando sesión..." : "Cerrar sesión"}</span>
                        <span className="text-[10px] text-red-400">Finalizar sesión activa</span>
                      </div>
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
            <div className="flex items-center gap-3 px-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-xs font-bold text-blue-800 shadow-xs">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={fullName} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900" title={fullName}>{fullName}</p>
                <p className="truncate text-[10px] text-slate-500 mt-0.5" title={user?.email}>{user?.email}</p>
                {primaryRole && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-block rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 uppercase tracking-tight">
                      {primaryRole}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  openNovedadesDrawer();
                }}
                className="flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Megaphone className="h-4 w-4 text-[var(--text-brand)]" aria-hidden="true" />
                  <span className="font-semibold text-slate-800">Novedades</span>
                </div>
                {unreadNovedadesCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {unreadNovedadesCount}
                  </span>
                )}
              </button>

              <Link
                to={APP_ROUTES.settings.profile}
                onClick={() => setMobileNavOpen(false)}
                className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <UserRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="font-semibold text-slate-800">Mi perfil</span>
              </Link>

              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <LogOut className="h-4 w-4 text-red-500" aria-hidden="true" />
                <span className="font-semibold">{logout.isPending ? "Cerrando sesión..." : "Cerrar sesión"}</span>
              </button>
            </div>
          </div>
        </div>
      </Drawer>
      <NovedadesDrawer />
    </header>
  );
}
