/**
 * @deprecated This sidebar component is NOT used by PrivateLayout.
 * The active navigation lives in header.tsx (horizontal tabs with overflow-x-auto).
 * This file is preserved for reference only. Safe to delete in a cleanup pass.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles, X, Building2, LogOut, UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useBranches, normalizeName } from "@/features/settings/branches/hooks/use-branches";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { Select } from "@/components/ui/select";
import { itemMatchesPath, type MainNavItem, type MenuItem, visibleNavigation } from "@/components/layout/navigation";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { cn } from "@/lib/utils/cn";
import { APP_ROUTES } from "@/lib/routes";

const EMPTY_PERMISSIONS: string[] = [];
const PRODUCT_NAME = "Warner Suite";
const FLYOUT_PANEL_WIDTH = 680;
const SIDEBAR_NAV_GROUPS: Array<{ key: string; label: string; paths: string[] }> = [
  { key: "principal", label: "Principal", paths: [APP_ROUTES.healthCenter, APP_ROUTES.agenda.root, APP_ROUTES.patients.root] },
  { key: "operation", label: "Operacion", paths: [APP_ROUTES.cashRegister.open, APP_ROUTES.payments.accountsReceivable] },
  { key: "management", label: "Gestion", paths: [APP_ROUTES.settings.organization, APP_ROUTES.reports.root, APP_ROUTES.dashboard] }
];

type FlyoutState = {
  item: MainNavItem;
  top: number;
  left: number;
  maxHeight: number;
  triggerRect: { top: number; right: number; height: number; left: number };
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
  active
}: {
  item: MainNavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <>
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]",
          active ? "text-[var(--nav-item-active-text)]" : "text-[var(--nav-item-default-icon)] group-hover:text-[var(--text-inverse)]"
        )}
      />
      {!collapsed ? (
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium transition-colors duration-[var(--duration-fast)]",
            active ? "text-[var(--text-inverse)] font-semibold" : "text-[var(--nav-item-default-text)] group-hover:text-[var(--text-inverse)]"
          )}
        >
          {item.label}
        </span>
      ) : (
        <span className="sr-only">{item.label}</span>
      )}
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

      return { 
        item, 
        top, 
        left, 
        maxHeight, 
        triggerRect: { 
          top: rect.top, 
          right: rect.right, 
          height: rect.height, 
          left: rect.left 
        } 
      };
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
      <div className="relative flex h-16 items-center gap-[var(--space-3)] border-b border-[var(--nav-border-subtle)] bg-[rgba(255,255,255,0.01)] px-[var(--space-3)]">
        <Link to={APP_ROUTES.dashboard} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-[var(--space-3)]">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1.5 border border-white/20 shadow-[0_4px_12px_rgba(4,44,83,0.15)] transition-transform duration-[var(--duration-normal)] hover:scale-105">
            <img src="/logo-2.webp" alt="Warner Suite Logo" className="h-full w-full object-contain" />
          </div>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[var(--text-base)] font-semibold leading-tight tracking-[0.01em]">{PRODUCT_NAME}</span>
              <span className="flex items-center gap-1 truncate text-[var(--text-xs)] font-medium text-[rgba(248,250,252,0.6)]">
                <Sparkles className="h-3 w-3 text-[var(--text-brand)]" />
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
                    "group relative flex h-10 animate-[sidebar-item-in_var(--duration-slow)_var(--ease-out)_both] items-center gap-[var(--space-3)] border-l-[3px] border-transparent rounded-r-[var(--radius-md)] px-3 text-[var(--text-sm)] font-medium text-[var(--nav-item-default-text)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--text-inverse)]",
                    active ? "bg-[var(--nav-item-active-bg)] border-[var(--nav-item-active-border)] text-[var(--nav-item-active-text)]" : ""
                  )}
                  style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                >
                  <NavItemContent item={item} collapsed={collapsed} active={active} />
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
                  "group relative flex h-10 w-full animate-[sidebar-item-in_var(--duration-slow)_var(--ease-out)_both] items-center gap-[var(--space-3)] border-l-[3px] border-transparent rounded-r-[var(--radius-md)] px-3 text-left text-[var(--text-sm)] font-medium text-[var(--nav-item-default-text)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--text-inverse)]",
                  active ? "bg-[var(--nav-item-active-bg)] border-[var(--nav-item-active-border)] text-[var(--nav-item-active-text)]" : "",
                  flyoutOpen && "bg-[var(--nav-item-hover-bg)] text-[var(--text-inverse)]"
                )}
                style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
              >
                <NavItemContent item={item} collapsed={collapsed} active={active} />
                {!collapsed ? (
                  isMobileMenu ? (
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--nav-item-default-icon)] transition-transform duration-[var(--duration-normal)] ease-[var(--ease-spring)]", open && "rotate-180")} />
                  ) : (
                    <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-[var(--nav-item-default-icon)] transition-transform duration-[var(--duration-normal)] ease-[var(--ease-spring)]", flyoutOpen && "translate-x-0.5 text-[var(--text-inverse)]")} />
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
                  <div className="ml-5 mt-1 animate-[sidebar-item-in_var(--duration-normal)_var(--ease-out)_both] space-y-1 border-l border-[var(--nav-border-subtle)] pl-3">
                    {item.children?.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = itemMatchesPath(location.pathname, child);
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={onNavigate}
                          className={cn(
                            "flex min-h-[36px] items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-sm)] font-medium text-[var(--nav-item-default-text)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--text-inverse)]",
                            childActive && "bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-text)]"
                          )}
                        >
                          {ChildIcon ? <ChildIcon className="h-3.5 w-3.5 shrink-0 text-[var(--nav-item-default-icon)]" /> : null}
                          <span className="truncate">{child.label}</span>
                          {child.badge ? (
                            <span className="ml-auto rounded-[var(--radius-full)] bg-[var(--action-primary)] px-2 py-0.5 text-[var(--text-xs)] font-semibold text-[var(--text-inverse)]">
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
            <>
              {flyout.triggerRect && (
                <div
                  className="fixed z-[69] h-[2px] bg-gradient-to-r from-blue-500/80 to-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.8)] origin-left animate-in fade-in zoom-in-x duration-150"
                  style={{
                    top: `${flyout.triggerRect.top + flyout.triggerRect.height / 2 - 1}px`,
                    left: `${flyout.triggerRect.right}px`,
                    width: `${Math.max(0, flyout.left - flyout.triggerRect.right)}px`
                  }}
                />
              )}
              <div
                ref={flyoutRef}
                role="menu"
                data-sidebar-flyout
                aria-label={`Opciones de ${flyout.item.label}`}
                className="fixed z-[70] flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.08] bg-[#031c35]/95 backdrop-blur-xl text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.5)] shadow-black/60 animate-in fade-in-50 slide-in-from-left-2 duration-150"
                style={{
                  top: flyout.top,
                  left: flyout.left,
                  maxHeight: flyout.maxHeight,
                  width: `min(${FLYOUT_PANEL_WIDTH}px, calc(100vw - 24px))`
                }}
              >
              <div className="border-b border-white/[0.06] bg-white/[0.01] px-5 py-4">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--nav-section-label)]">Menú rápido</span>
                <span className="mt-1 block text-lg font-bold text-white tracking-tight">{flyout.item.label}</span>
              </div>

              <div className={cn("grid min-h-0 gap-5 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20", flyoutGroups.length > 1 && "grid-cols-2")}>
                {flyoutGroups.map((group) => (
                  <section key={group.key} className="min-w-0">
                    {flyoutGroups.length > 1 ? (
                      <p className="mb-3 px-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--nav-item-active-text)] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
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
                              "flex min-h-[38px] items-center gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-[var(--text-sm)] font-medium transition-all duration-150 ease-in-out cursor-pointer",
                              childActive
                                ? "bg-[var(--nav-item-active-bg)] border-[var(--nav-item-active-border)]/30 text-[var(--nav-item-active-text)] font-semibold"
                                : "text-[var(--nav-item-default-text)] hover:bg-[var(--nav-item-hover-bg)] hover:border-white/[0.04] hover:text-[var(--text-inverse)]"
                            )}
                          >
                            {ChildIcon ? (
                              <ChildIcon className={cn("h-4 w-4 shrink-0 transition-colors duration-150", childActive ? "text-[var(--nav-item-active-text)]" : "text-[var(--nav-item-default-icon)]")} />
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                            {child.badge ? (
                              <span className="shrink-0 rounded-full bg-[var(--action-primary)]/10 border border-[var(--action-primary)]/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--action-primary)]">
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
            </div>
            </>,
            document.body
          )
        : null}

      {/* Bottom Section: Branch Switcher & User Profile */}
      <div className={cn("mt-auto border-t border-[var(--nav-border-subtle)] bg-black/10 transition-all duration-300", collapsed ? "p-2 space-y-0" : "p-4 space-y-3.5")}>
        {/* Branch Selector */}
        {!collapsed && assignedBranches.length > 0 ? (
          <div className="space-y-1.5">
            <label className="px-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--nav-section-label)] flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-[var(--text-brand)]" />
              Sucursal Activa
            </label>
            <Select
              value={activeBranchId}
              onChange={(event) => setActiveBranchId(event.target.value)}
              theme="dark"
              className="h-[36px] text-xs font-medium"
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
          "flex items-center gap-3 transition-all duration-200 border",
          collapsed 
            ? "justify-center py-2 border-transparent" 
            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] p-2.5 rounded-xl shadow-sm"
        )}>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--color-base-blue-400)] to-[var(--color-base-blue-600)] p-[1px] text-[11px] font-semibold text-white shadow-sm">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--bg-nav)]">
              {initials}
            </div>
            {/* Active online dot */}
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[var(--bg-nav)] bg-[var(--color-base-emerald-500)] shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
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
              className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md text-[var(--nav-item-default-icon)] hover:bg-white/[0.05] hover:text-[var(--text-danger)] transition-all active:scale-95 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
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
          className="absolute right-0 top-8 z-50 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-[var(--nav-border-subtle)] bg-[var(--bg-nav)] text-[var(--nav-item-default-icon)] shadow-[0_4px_12px_rgba(4,44,83,0.15)] transition-all hover:text-[var(--text-inverse)] hover:scale-105 active:scale-95 cursor-pointer"
          aria-label={desktopExpanded ? "Colapsar menu lateral" : "Expandir menu lateral"}
        >
          {desktopExpanded ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
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
