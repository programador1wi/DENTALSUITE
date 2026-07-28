import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Megaphone, Menu, UserRound, X, Building2, ArrowLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { PatientSearchBox } from "@/features/patients/components/patient-search-box";
import { itemMatchesPath, visibleNavigation, type MenuItem } from "@/components/layout/navigation";
import { useOrganizationSettings } from "@/features/settings/organization/hooks/use-organization";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useBranches, normalizeName } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import { cn } from "@/lib/utils/cn";

export function Header() {
  const user = useAuthStore((state) => state.user);
  const { data: organization } = useOrganizationSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();

  const { data: branches } = useBranches(undefined, "ACTIVE");
  const { activeBranchId, setActiveBranchId } = useBranchStore();

  const activeBranch = useMemo(() => {
    return branches?.find(b => b.id === activeBranchId);
  }, [branches, activeBranchId]);

  const activeBranchBrand = activeBranch?.brand;

  const [globalSearch, setGlobalSearch] = useState("");
  const [cobranzaSearch, setCobranzaSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Custom multi-step branch dropdown state
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
        setSelectedZone(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const permissions = user?.permissions ?? [];
  const navigation = visibleNavigation(permissions);

  const fullName = user ? `${user.firstName} ${user.lastName}` : "Usuario";
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "U";

  const assignedBranches = useMemo(() => {
    return branches?.filter((branch) => user?.branchIds?.includes(branch.id)) ?? [];
  }, [branches, user?.branchIds]);

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

  const activeBranchName = useMemo(() => {
    return assignedBranches.find(b => b.id === activeBranchId)?.name ?? "Seleccionar sucursal...";
  }, [assignedBranches, activeBranchId]);

  const goToPatientSearch = (nextSearch = globalSearch) => {
    const term = nextSearch.trim();
    if (!term) return;
    const params = new URLSearchParams({ search: term });
    navigate(`/patients?${params.toString()}`);
    setGlobalSearch("");
    setMobileOpen(false);
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
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-default)] bg-white text-[var(--text-primary)] shadow-sm">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo & Branch Switcher */}
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              {organization?.logoUrl ? (
                <img src={organization.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
              ) : (
                <span className="text-2xl font-black tracking-tight text-[var(--text-brand-strong)]">
                  Warner Suite
                </span>
              )}
            </Link>

            {/* Desktop Custom Multi-Step Branch Switcher */}
            {assignedBranches.length > 0 && (
              <div className="hidden md:block relative" ref={branchDropdownRef}>
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  className="flex h-8.5 items-center gap-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-zinc-300 transition-colors px-3 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                >
                  <Building2 size={13} className="text-[var(--text-secondary)] opacity-70 shrink-0" />
                  <span className="truncate max-w-[160px]">{activeBranchName}</span>
                  <ChevronDown size={13} className="text-[var(--text-secondary)] opacity-60 shrink-0" />
                </button>

                {branchDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-60 z-50 rounded-lg border border-[var(--border-default)] bg-white p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                    {selectedZone === null ? (
                      <div className="space-y-1">
                        <span className="block px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                          Selecciona una Zona
                        </span>
                        {Object.entries(groupedBranches).map(([zoneKey, list]) => {
                          if (list.length === 0) return null;
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
                        {(permissions.includes("system.manage_all") || permissions.includes("health_center.view")) && (
                          <>
                            <div className="my-1 border-t border-[var(--border-default)]" />
                            <Link
                              to="/health-center"
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
                          {groupedBranches[selectedZone].map((branch) => (
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

          {/* Desktop Navigation (Tabs) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => {
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const isActive = itemMatchesPath(location.pathname, item) || 
                item.children?.some(child => itemMatchesPath(location.pathname, child));
              const isCobranza = item.to === "/accounts-receivable";

              if (hasChildren) {
                if (isCobranza) {
                  return (
                    <div
                      key={item.to}
                      className="relative group py-2"
                      onMouseEnter={() => setActiveDropdown(item.to)}
                      onMouseLeave={() => setActiveDropdown(null)}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                          isActive 
                            ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <span>{item.label}</span>
                        <ChevronDown size={14} className="opacity-60" />
                      </button>

                      {/* Cobranza Custom Dropdown (Only Search Box) */}
                      <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-[var(--border-default)] bg-white p-4 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 w-[320px] before:absolute before:-top-3 before:inset-x-0 before:h-3">
                        <div className="space-y-2">
                          <label className="text-[11px] font-medium text-[var(--text-secondary)] block">
                            Buscar paciente por nombre o documento
                          </label>
                          <PatientSearchBox
                            value={cobranzaSearch}
                            onValueChange={setCobranzaSearch}
                            onSubmit={(value) => {
                              navigate(`/patients?search=${encodeURIComponent(value)}`);
                              setCobranzaSearch("");
                            }}
                            onSelect={(patient) => {
                              navigate(`/patients/${patient.id}/payments`);
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
                    className="relative group py-2"
                    onMouseEnter={() => setActiveDropdown(item.to)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
                        isActive 
                          ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)] font-bold" 
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <span>{item.label}</span>
                      <ChevronDown size={14} className="opacity-60" />
                    </button>

                    {/* Standard Dropdown / Mega Menu */}
                    <div
                      className={cn(
                        "absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-[var(--border-default)] bg-white p-3 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 before:absolute before:-top-3 before:inset-x-0 before:h-3",
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
                    "rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-[var(--duration-fast)]",
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
          <div className="flex items-center gap-3">
            {/* Brand Logo */}
            {activeBranchBrand?.logoUrl && (
              <div className="hidden sm:flex items-center mr-1 md:mr-3 border-r border-[var(--border-default)] pr-3 md:pr-5" title={`Marca: ${activeBranchBrand.name}`}>
                <img 
                  src={activeBranchBrand.logoUrl} 
                  alt={activeBranchBrand.name} 
                  className="h-11 max-w-[160px] object-contain rounded-sm"
                />
              </div>
            )}

            {/* Search Box */}
            <div className="relative hidden md:block w-64">
              <PatientSearchBox
                value={globalSearch}
                onValueChange={setGlobalSearch}
                onSubmit={(value) => goToPatientSearch(value)}
                onSelect={(patient) => {
                  navigate(`/patients/${patient.id}/profile`);
                  setGlobalSearch("");
                }}
                placeholder="Buscar pacientes..."
                inputClassName="bg-[var(--bg-subtle)] border-transparent hover:border-[var(--border-default)] focus:bg-white focus:ring-2 focus:ring-[var(--focus-ring)] rounded-full px-4 text-xs h-9"
              />
            </div>

            {/* Megaphone / Notifications */}
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
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
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--color-base-blue-400)] to-[var(--color-base-blue-600)] p-[1px] text-[11px] font-semibold text-white shadow-sm">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
                    {initials}
                  </div>
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-[var(--color-base-emerald-500)]" />
                </div>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-[var(--border-default)] bg-white py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-[var(--border-default)] px-4 py-2">
                    <p className="truncate text-xs font-bold text-slate-900">{fullName}</p>
                    <p className="truncate text-[10px] text-slate-500 mt-0.5">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings/profile"
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

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] lg:hidden"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-40 flex flex-col bg-white border-t border-[var(--border-default)] animate-in slide-in-from-top duration-200 lg:hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            
            {/* Mobile Custom Multi-Step Branch Switcher */}
            {assignedBranches.length > 0 && (
              <div className="space-y-1.5 px-3 py-2 border-b border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] opacity-60 mb-2">
                  Sucursal Activa
                </div>
                
                {selectedZone === null ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(groupedBranches).map(([zoneKey, list]) => {
                      if (list.length === 0) return null;
                      return (
                        <button
                          key={zoneKey}
                          type="button"
                          onClick={() => setSelectedZone(zoneKey)}
                          className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <span>{zoneKey.replace("Plataforma ", "")}</span>
                          <ChevronRight size={12} className="opacity-50" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedZone(null)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 w-full text-left"
                    >
                      <ArrowLeft size={11} />
                      <span>Volver a Zonas</span>
                    </button>
                    <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-md p-1.5 space-y-0.5">
                      {groupedBranches[selectedZone].map((branch) => (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setActiveBranchId(branch.id);
                            setSelectedZone(null);
                            setMobileOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition-colors",
                            branch.id === activeBranchId
                              ? "bg-blue-50 text-blue-700"
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

            {/* Mobile Search */}
            <div className="relative w-full">
              <PatientSearchBox
                value={globalSearch}
                onValueChange={setGlobalSearch}
                onSubmit={(value) => goToPatientSearch(value)}
                onSelect={(patient) => {
                  navigate(`/patients/${patient.id}/profile`);
                  setGlobalSearch("");
                }}
                placeholder="Buscar pacientes..."
                inputClassName="bg-[var(--bg-subtle)] border-transparent rounded-full px-4 text-xs h-9 w-full"
              />
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex flex-col gap-1">
              {navigation.map((item) => {
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isActive = itemMatchesPath(location.pathname, item) || 
                  item.children?.some(child => itemMatchesPath(location.pathname, child));
                const isCobranza = item.to === "/accounts-receivable";

                if (hasChildren) {
                  if (isCobranza) {
                    return (
                      <div key={item.to} className="space-y-1.5 px-3 py-2 border-b border-slate-100">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                          {item.label}
                        </div>
                        <PatientSearchBox
                          value={cobranzaSearch}
                          onValueChange={setGlobalSearch}
                          onSubmit={(value) => {
                            navigate(`/patients?search=${encodeURIComponent(value)}`);
                            setCobranzaSearch("");
                            setMobileOpen(false);
                          }}
                          onSelect={(patient) => {
                            navigate(`/patients/${patient.id}/payments`);
                            setCobranzaSearch("");
                            setMobileOpen(false);
                          }}
                          placeholder="Buscar paciente..."
                          inputClassName="bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-md px-3 py-1.5 text-xs w-full h-9"
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={item.to} className="space-y-1">
                      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">
                        {item.label}
                      </div>
                      <div className="pl-3 space-y-0.5 border-l border-slate-100">
                        {item.children?.map((subItem) => {
                          const isSubActive = itemMatchesPath(location.pathname, subItem);
                          return (
                            <Link
                              key={subItem.to}
                              to={subItem.to}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs",
                                isSubActive
                                  ? "bg-slate-100 font-semibold text-slate-900"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )}
                            >
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-semibold transition-all",
                      isActive
                        ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)]"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
