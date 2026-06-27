import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles, X, Building2, LogOut, UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useBranches, ORDERED_NAMES, normalizeName } from "@/features/settings/branches/hooks/use-branches";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { Select } from "@/components/ui/select";
import { itemMatchesPath, type MainNavItem, type MenuItem, visibleNavigation } from "@/components/layout/navigation";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { cn } from "@/lib/utils/cn";

const EMPTY_PERMISSIONS: string[] = [];
const PRODUCT_NAME = "Warner Suite";
const FLYOUT_PANEL_WIDTH = 560;
const SIDEBAR_NAV_GROUPS = [
  { key: "principal", label: "Principal", paths: ["/agenda", "/patients"] },
  { key: "operation", label: "Operacion", paths: ["/cash-register/open", "/accounts-receivable"] },
  { key: "management", label: "Gestion", paths: ["/settings/organization", "/reports", "/dashboard"] }
];

type FlyoutState = {
  item: MainNavItem;
  top: number;
  left: number;
  maxHeight: number;
};

function groupedChildren(children: MenuItem[]) {
  return [
    { key: "primary", label: "Accesos", items: children.filter((child) => !child.section) },
    { key: "administration", label: "Administracion", items: children.filter((child) => child.section === "administration") },
    { key: "configuration", label: "Configuracion", items: children.filter((child) => child.section === "configuration") }
  ].filter((group) => group.items.length > 0);
}

function groupedNavigation(items: MainNavItem[]) {
  return SIDEBAR_NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => group.paths.includes(item.to))
  })).filter((group) => group.items.length > 0);
}

function NavItemContent({
  item,
  collapsed,
  active,
  index
}: {
  item: MainNavItem;
  collapsed: boolean;
  active: boolean;
  index: number;
}) {
  const Icon = item.icon;

  return (
    <>
      <span
        className={cn(
          "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-[var(--radius-full)] bg-[var(--nav-item-active-border)] opacity-0 transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)]",
          active && "opacity-100 shadow-[0_0_12px_rgba(55,138,221,0.55)]"
        )}
      />
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--nav-control-border)] bg-[var(--nav-control-bg)] text-[var(--nav-item-default-icon)] transition-[background-color,border-color,transform,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] group-hover:translate-x-0.5 group-hover:border-[rgba(255,255,255,0.22)] group-hover:bg-[rgba(255,255,255,0.1)] group-hover:text-[var(--text-inverse)]",
          active && "border-[rgba(55,138,221,0.55)] bg-[rgba(55,138,221,0.22)] text-[var(--text-inverse)]"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      {!collapsed ? (
        <span className={cn("min-w-0 flex-1 truncate", active && "text-[var(--text-inverse)]")}>{item.label}</span>
      ) : (
        <span className="sr-only">{item.label}</span>
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 rounded-[var(--radius-md)] opacity-0 transition-[opacity,transform] duration-[var(--duration-normal)] ease-[var(--ease-out)] group-hover:translate-x-1 group-hover:opacity-100"
        style={{ transitionDelay: `${Math.min(index, 6) * 12}ms` }}
      />
    </>
  );
}

function SidebarContent({
  collapsed,
  onDesktopFlyoutChange,
  onNavigate,
  onCloseMobile
}: {
  collapsed: boolean;
  onDesktopFlyoutChange?: (open: boolean) => void;
  onNavigate?: () => void;
  onCloseMobile?: () => void;
}) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? EMPTY_PERMISSIONS;
  const navigation = useMemo(() => visibleNavigation(permissions), [permissions]);
  const navigationGroups = useMemo(() => groupedNavigation(navigation), [navigation]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const isMobileMenu = Boolean(onCloseMobile);
  const logout = useLogout();
  const { data: branches } = useBranches(undefined, "ACTIVE");
  const { activeBranchId, setActiveBranchId } = useBranchStore();

  const assignedBranches = useMemo(() => branches ?? [], [branches]);

  const groupedBranches = useMemo(() => {
    const groups: Record<string, typeof assignedBranches> = {
      "Plataforma NORTE": [],
      "Plataforma SUR": [],
      "Plataforma DJWARNER": [],
      "Otras sucursales": []
    };

    assignedBranches.forEach((branch) => {
      const norm = normalizeName(branch.name);
      const idx = ORDERED_NAMES.indexOf(norm);
      if (idx >= 0 && idx <= 10) {
        groups["Plataforma NORTE"].push(branch);
      } else if (idx >= 11 && idx <= 25) {
        groups["Plataforma SUR"].push(branch);
      } else if (idx >= 26) {
        groups["Plataforma DJWARNER"].push(branch);
      } else {
        groups["Otras sucursales"].push(branch);
      }
    });

    return groups;
  }, [assignedBranches]);

  const initials = `${user?.firstName?.charAt(0) ?? "P"}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const fullName = `${user?.firstName || "Soporte"} ${user?.lastName || ""}`.trim();

  const closeDesktopFlyout = useCallback(() => {
    setFlyout(null);
    if (!isMobileMenu) onDesktopFlyoutChange?.(false);
  }, [isMobileMenu, onDesktopFlyoutChange]);

  useEffect(() => {
    const activeParent = navigation.find((item) => item.children?.some((child) => itemMatchesPath(location.pathname, child)));
    if (activeParent) {
      setOpenSections((state) => (state[activeParent.to] ? state : { ...state, [activeParent.to]: true }));
    }
    closeDesktopFlyout();
  }, [closeDesktopFlyout, location.pathname, navigation]);

  useEffect(() => {
    if (!isMobileMenu && collapsed) closeDesktopFlyout();
  }, [closeDesktopFlyout, collapsed, isMobileMenu]);

  useEffect(() => {
    if (isMobileMenu) return;
    onDesktopFlyoutChange?.(Boolean(flyout));
  }, [flyout, isMobileMenu, onDesktopFlyoutChange]);

  useEffect(() => {
    if (!flyout || isMobileMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && flyoutRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-sidebar-flyout]")) return;
      if (target instanceof Element && target.closest("[data-sidebar-flyout-trigger]")) return;
      closeDesktopFlyout();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDesktopFlyout();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeDesktopFlyout);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeDesktopFlyout);
    };
  }, [closeDesktopFlyout, flyout, isMobileMenu]);

  const toggleDesktopFlyout = useCallback((item: MainNavItem, trigger: HTMLElement) => {
    setFlyout((current) => {
      if (current?.item.to === item.to) {
        return null;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const maxHeight = Math.max(260, viewportHeight - 24);
      const estimatedHeight = Math.min(maxHeight, Math.max(260, (item.children?.length ?? 1) * 42 + 92));
      const top = Math.min(Math.max(12, rect.top - 8), Math.max(12, viewportHeight - estimatedHeight - 12));
      const width = Math.min(FLYOUT_PANEL_WIDTH, viewportWidth - 24);
      const preferredLeft = rect.right + 10;
      const left = preferredLeft + width > viewportWidth - 12 ? Math.max(12, rect.left - width - 10) : preferredLeft;

      return { item, top, left, maxHeight };
    });
  }, []);

  const flyoutGroups = flyout?.item.children ? groupedChildren(flyout.item.children) : [];

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-hidden bg-[var(--bg-nav)] text-[var(--text-inverse)] transition-[width,transform,box-shadow] duration-[var(--duration-normal)] ease-[var(--ease-default)]",
        isMobileMenu ? "border-r border-[var(--nav-border-subtle)]" : "rounded-[var(--radius-md)] border border-[var(--nav-border-subtle)] shadow-[0_12px_30px_rgba(4,44,83,0.08)]",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className="relative flex h-16 items-center gap-[var(--space-3)] border-b border-[var(--nav-border-subtle)] bg-[rgba(255,255,255,0.02)] px-[var(--space-3)]">
        <Link to="/dashboard" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-[var(--space-3)]">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-transform duration-[var(--duration-normal)] hover:scale-105">
            <img src="/logo-2.png" alt="Warner Suite Logo" className="h-full w-full object-contain" />
          </div>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[var(--text-base)] font-semibold leading-tight tracking-[0.01em]">{PRODUCT_NAME}</span>
              <span className="flex items-center gap-[var(--space-1)] truncate text-[var(--text-xs)] font-medium text-[rgba(248,250,252,0.52)]">
                <Sparkles className="h-3 w-3" />
                Gestion clinica
              </span>
            </span>
          ) : null}
        </Link>

        {onCloseMobile ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--nav-item-default-text)] transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--text-inverse)] lg:hidden"
            aria-label="Cerrar menu"
            onClick={onCloseMobile}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav
        className="relative flex-1 overflow-y-auto px-[var(--space-2)] py-[var(--space-4)]"
        onScroll={() => {
          if (!isMobileMenu && flyout) setFlyout(null);
        }}
      >
        <div className="space-y-[var(--space-4)]">
          {navigationGroups.map((group) => (
            <section key={group.key} className="min-w-0">
              <p
                className={cn(
                  "mb-[var(--space-2)] px-[var(--space-2)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--nav-section-label)]",
                  collapsed && "sr-only"
                )}
              >
                {group.label}
              </p>
              <div className={cn("space-y-1", collapsed && group.key !== "principal" && "border-t border-[var(--nav-border-subtle)] pt-[var(--space-4)]")}>
                {group.items.map((item) => {
                  const index = navigation.findIndex((navItem) => navItem.to === item.to);
            const hasChildren = Boolean(item.children?.length);
            const active = itemMatchesPath(location.pathname, item) || Boolean(item.children?.some((child) => itemMatchesPath(location.pathname, child)));
            const open = openSections[item.to] || active;
            const flyoutOpen = flyout?.item.to === item.to;

            if (!hasChildren) {
              const navLink = (
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "group relative isolate flex h-11 animate-[sidebar-item-in_var(--duration-slow)_var(--ease-out)_both] items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-2)] text-[var(--text-sm)] font-semibold text-[var(--nav-item-default-text)] transition-[background-color,transform,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:translate-x-0.5 hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--text-inverse)]",
                    active && "bg-[rgba(255,255,255,0.075)] text-[var(--text-inverse)]"
                  )}
                  style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                >
                  <NavItemContent item={item} collapsed={collapsed} active={active} index={index} />
                </Link>
              );

              return collapsed && !isMobileMenu ? (
                <HelpTooltip key={item.to} content={item.label} position="right" triggerClassName="w-full">
                  {navLink}
                </HelpTooltip>
              ) : (
                <div key={item.to}>{navLink}</div>
              );
            }

            const navButton = (
              <button
                type="button"
                data-sidebar-flyout-trigger={!isMobileMenu ? true : undefined}
                aria-haspopup={!isMobileMenu ? "menu" : undefined}
                aria-expanded={isMobileMenu ? open : flyoutOpen}
                onClick={(event) => {
                  if (isMobileMenu) {
                    setOpenSections((state) => ({ ...state, [item.to]: !open }));
                    return;
                  }
                  toggleDesktopFlyout(item, event.currentTarget);
                }}
                className={cn(
                  "group relative isolate flex h-11 w-full animate-[sidebar-item-in_var(--duration-slow)_var(--ease-out)_both] items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-2)] text-left text-[var(--text-sm)] font-semibold text-[var(--nav-item-default-text)] transition-[background-color,transform,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:translate-x-0.5 hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--text-inverse)]",
                  active && "bg-[rgba(255,255,255,0.075)] text-[var(--text-inverse)]",
                  flyoutOpen && "bg-[rgba(255,255,255,0.1)] text-[var(--text-inverse)]"
                )}
                style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
              >
                <NavItemContent item={item} collapsed={collapsed} active={active} index={index} />
                {!collapsed ? (
                  isMobileMenu ? (
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--nav-item-default-icon)] transition-transform duration-[var(--duration-normal)] ease-[var(--ease-spring)]", open && "rotate-180")} />
                  ) : (
                    <ChevronRight className={cn("h-4 w-4 shrink-0 text-[var(--nav-item-default-icon)] transition-transform duration-[var(--duration-normal)] ease-[var(--ease-spring)]", flyoutOpen && "translate-x-0.5 text-[var(--text-inverse)]")} />
                  )
                ) : null}
              </button>
            );

            return (
              <div key={item.to}>
                {collapsed && !isMobileMenu ? (
                  <HelpTooltip content={item.label} position="right" triggerClassName="w-full">
                    {navButton}
                  </HelpTooltip>
                ) : (
                  navButton
                )}

                {isMobileMenu && !collapsed && open ? (
                  <div className="ml-[var(--space-5)] mt-1 animate-[sidebar-item-in_var(--duration-normal)_var(--ease-out)_both] space-y-1 border-l border-[var(--nav-border-subtle)] pl-[var(--space-2)]">
                    {item.children?.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = itemMatchesPath(location.pathname, child);
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={onNavigate}
                          className={cn(
                            "flex min-h-9 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-medium text-[var(--nav-item-default-icon)] transition-[background-color,transform,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:translate-x-0.5 hover:bg-[var(--nav-item-hover-bg)]",
                            childActive && "bg-[var(--nav-item-hover-bg)] text-[var(--nav-item-active-text)]"
                          )}
                        >
                          {ChildIcon ? <ChildIcon className="h-4 w-4 shrink-0" /> : null}
                          <span className="truncate">{child.label}</span>
                          {child.badge ? (
                            <span className="ml-auto rounded-[var(--radius-full)] bg-[var(--action-primary)] px-[var(--space-2)] py-0.5 text-[var(--text-xs)] font-semibold text-[var(--text-inverse)]">
                              {child.badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      {!isMobileMenu && flyout && flyout.item.children?.length && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={flyoutRef}
              role="menu"
              data-sidebar-flyout
              aria-label={`Opciones de ${flyout.item.label}`}
              className="fixed z-[70] flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--nav-border-subtle)] bg-[var(--bg-nav)] text-[var(--text-inverse)] shadow-[0_18px_42px_rgba(4,44,83,0.22)]"
              style={{
                top: flyout.top,
                left: flyout.left,
                maxHeight: flyout.maxHeight,
                width: `min(${FLYOUT_PANEL_WIDTH}px, calc(100vw - 24px))`
              }}
            >
              <div className="border-b border-[var(--nav-border-subtle)] bg-[rgba(255,255,255,0.025)] px-[var(--space-4)] py-[var(--space-3)]">
                <span className="block text-[var(--text-xs)] font-semibold uppercase tracking-widest text-[var(--nav-section-label)]">Menu rapido</span>
                <span className="mt-0.5 block text-[var(--text-base)] font-semibold text-[var(--text-inverse)]">{flyout.item.label}</span>
              </div>

              <div className={cn("grid min-h-0 gap-[var(--space-3)] overflow-y-auto p-[var(--space-3)]", flyoutGroups.length > 1 && "grid-cols-2")}>
                {flyoutGroups.map((group) => (
                  <section key={group.key} className="min-w-0">
                    {flyoutGroups.length > 1 ? (
                      <p className="mb-[var(--space-2)] px-[var(--space-2)] text-[var(--text-xs)] font-semibold uppercase tracking-widest text-[var(--nav-section-label)]">
                        {group.label}
                      </p>
                    ) : null}
                    <div className="space-y-1">
                      {group.items.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = itemMatchesPath(location.pathname, child);

                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            role="menuitem"
                            onClick={() => {
                              closeDesktopFlyout();
                              onNavigate?.();
                            }}
                            className={cn(
                              "flex min-h-10 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-medium text-[var(--nav-item-default-text)] transition-[background-color,transform,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:translate-x-0.5 hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--text-inverse)]",
                              childActive && "bg-[rgba(255,255,255,0.075)] text-[var(--text-inverse)]"
                            )}
                          >
                            {ChildIcon ? (
                              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--nav-control-border)] bg-[var(--nav-control-bg)] text-[var(--nav-item-default-icon)]", childActive && "border-[rgba(55,138,221,0.55)] bg-[rgba(55,138,221,0.22)] text-[var(--text-inverse)]")}>
                                <ChildIcon className="h-4 w-4" />
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                            {child.badge ? (
                              <span className="shrink-0 rounded-[var(--radius-full)] bg-[var(--action-primary)] px-[var(--space-2)] py-0.5 text-[var(--text-xs)] font-semibold text-[var(--text-inverse)]">
                                {child.badge}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Bottom Section: Branch Switcher & User Profile */}
      <div className={cn("mt-auto border-t border-slate-800 bg-slate-950/30 transition-all duration-300", collapsed ? "p-2 space-y-0" : "p-4 space-y-4")}>
        {/* Branch Selector */}
        {!collapsed && assignedBranches.length > 0 ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/35 p-3 shadow-inner">
            <label className="mb-2 text-[9px] font-extrabold uppercase tracking-widest text-[var(--nav-section-label)] flex items-center gap-1.5 opacity-80">
              <Building2 className="h-3.5 w-3.5 text-sky-400" />
              Sucursal Activa
            </label>
            <Select
              value={activeBranchId}
              onChange={(event) => setActiveBranchId(event.target.value)}
              theme="dark"
              className="h-9 border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-950/60 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              containerClassName="text-white"
            >
              {Object.entries(groupedBranches).map(([groupLabel, list]) => {
                if (list.length === 0) return null;
                return (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {list.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </div>
        ) : null}

        {/* User Profile Info & Logout */}
        <div className={cn(
          "flex items-center gap-3 transition-all duration-200",
          collapsed ? "justify-center py-1" : "bg-slate-900/20 border border-slate-850 p-2.5 rounded-xl"
        )}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 p-[1.5px] text-xs font-extrabold text-white border border-slate-700/30 shadow-md">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950">
              {initials}
            </div>
            {/* Active online dot */}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-slate-950 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-200 leading-tight tracking-[0.01em]">{fullName}</p>
              <p className="truncate text-[10px] text-slate-500 mt-0.5 leading-none">{user?.email ?? "Usuario activo"}</p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950/20 text-slate-400 border border-slate-800/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

    </aside>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileClose
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [desktopFlyoutOpen, setDesktopFlyoutOpen] = useState(false);
  const desktopFlyoutOpenRef = useRef(false);

  const handleDesktopFlyoutChange = useCallback((open: boolean) => {
    desktopFlyoutOpenRef.current = open;
    setDesktopFlyoutOpen(open);
  }, []);

  return (
    <>
      <div
        className={cn(
          "relative z-40 hidden h-[calc(100vh-24px)] shrink-0 transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-default)] lg:sticky lg:top-[var(--space-3)] lg:block",
          desktopExpanded ? "w-60" : "w-[72px]"
        )}
      >
        <SidebarContent collapsed={!desktopExpanded} onDesktopFlyoutChange={handleDesktopFlyoutChange} />

        {/* Floating Toggle Button on the right border */}
        <button
          type="button"
          onClick={() => setDesktopExpanded(!desktopExpanded)}
          className="absolute right-0 top-8 z-50 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all hover:bg-slate-800 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
          aria-label={desktopExpanded ? "Colapsar menu lateral" : "Expandir menu lateral"}
        >
          {desktopExpanded ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-60 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--backdrop-modal)] backdrop-blur-sm"
            aria-label="Cerrar menu"
            onClick={onMobileClose}
          />
          <div className="relative h-full w-60">
            <SidebarContent
              collapsed={false}
              onCloseMobile={onMobileClose}
              onNavigate={onMobileClose}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
