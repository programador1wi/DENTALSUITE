import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Megaphone, ExternalLink, Sparkles } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useNovedadesStore } from "../stores/use-novedades-store";
import { NovedadesCard } from "./novedades-card";
import type { ReleaseCategory } from "../types";
import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

export function NovedadesDrawer() {
  const { isOpen, closeDrawer, releases, isRead, markAsRead, markAllAsRead, getUnreadCount } =
    useNovedadesStore();

  const [activeFilter, setActiveFilter] = useState<"ALL" | ReleaseCategory>("ALL");
  const unreadCount = getUnreadCount();

  const filteredReleases = useMemo(() => {
    if (activeFilter === "ALL") return releases;
    return releases.filter((r) => r.category === activeFilter);
  }, [releases, activeFilter]);

  return (
    <Drawer
      open={isOpen}
      onClose={closeDrawer}
      title="Novedades y Actualizaciones"
      description="Últimas mejoras, módulos y funcionalidades incorporadas al sistema."
      placement="right"
      size="md"
    >
      <div className="flex flex-col gap-4">
        {/* Header Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
              <Megaphone className="h-3.5 w-3.5" />
            </span>
            <div className="text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                {unreadCount > 0 ? `${unreadCount} novedad(es) sin leer` : "Estás al día con las actualizaciones"}
              </span>
            </div>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 px-2.5 text-xs text-[var(--text-brand)] hover:text-[var(--text-brand-strong)]"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar todo como visto
            </Button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              activeFilter === "ALL"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            Todas ({releases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("NEW")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors",
              activeFilter === "NEW"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            <Sparkles className="h-3 w-3" />
            Nuevas ({releases.filter((r) => r.category === "NEW").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("IMPROVEMENT")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              activeFilter === "IMPROVEMENT"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            Mejoras ({releases.filter((r) => r.category === "IMPROVEMENT").length})
          </button>
        </div>

        {/* Feed List */}
        <div className="space-y-4">
          {filteredReleases.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] p-8 text-center">
              <Megaphone className="h-8 w-8 text-[var(--text-secondary)]/50" />
              <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                No hay novedades en esta categoría
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Selecciona otro filtro para visualizar comunicados anteriores.
              </p>
            </div>
          ) : (
            filteredReleases.map((release) => (
              <NovedadesCard
                key={release.id}
                release={release}
                isRead={isRead(release.id)}
                onMarkAsRead={() => markAsRead(release.id)}
              />
            ))
          )}
        </div>

        {/* Portal Completo Interno Footer Link */}
        <div className="mt-4 border-t border-[var(--border-default)] pt-4 text-center">
          <Link
            to={APP_ROUTES.novedades}
            onClick={closeDrawer}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-brand)] hover:text-[var(--text-brand-strong)] hover:underline"
          >
            <span>Ver portal completo de novedades</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Drawer>
  );
}
