import { useState, useMemo } from "react";
import { Sparkles, CheckCheck, Megaphone, Search, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useNovedadesStore } from "../stores/use-novedades-store";
import { NovedadesCard } from "../components/novedades-card";
import type { ReleaseCategory } from "../types";
import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

export function NovedadesPage() {
  const { releases, isRead, markAsRead, markAllAsRead, getUnreadCount } = useNovedadesStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<"ALL" | ReleaseCategory>("ALL");

  const unreadCount = getUnreadCount();
  const latestVersion = releases[0]?.version ?? "1.0.0";

  const filteredReleases = useMemo(() => {
    return releases.filter((release) => {
      const matchesCategory = activeCategory === "ALL" || release.category === activeCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        release.title.toLowerCase().includes(term) ||
        release.summary.toLowerCase().includes(term) ||
        release.tags.some((t) => t.toLowerCase().includes(term)) ||
        release.version.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [releases, activeCategory, searchTerm]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-14">
      {/* Top Header */}
      <PageHeader
        eyebrow={`WARNER SUITE • v${latestVersion}`}
        title="Novedades y Actualizaciones"
        description="Conoce las últimas funcionalidades, optimizaciones de rendimiento y mejoras clínicas incorporadas a la plataforma."
        primaryAction={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 border-[var(--border-brand-light)] text-[var(--text-brand)] hover:text-[var(--text-brand-strong)]"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Marcar todo como visto ({unreadCount})</span>
            </Button>
          ) : undefined
        }
        secondaryActions={
          <Link to={APP_ROUTES.agenda.root}>
            <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a la Agenda</span>
            </Button>
          </Link>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              activeCategory === "ALL"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            )}
          >
            Todas ({releases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("NEW")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors",
              activeCategory === "NEW"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            )}
          >
            <Sparkles className="h-3 w-3" />
            Nuevas ({releases.filter((r) => r.category === "NEW").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("IMPROVEMENT")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              activeCategory === "IMPROVEMENT"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            )}
          >
            Mejoras ({releases.filter((r) => r.category === "IMPROVEMENT").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("FIX")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              activeCategory === "FIX"
                ? "bg-[var(--action-primary)] text-white shadow-xs"
                : "border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            )}
          >
            Correcciones ({releases.filter((r) => r.category === "FIX").length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por función o tag..."
            className="h-8 w-full rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-secondary)] focus:border-[var(--border-brand)] focus:bg-white focus:ring-1 focus:ring-[var(--focus-ring)]"
          />
        </div>
      </div>

      {/* Release Feed List */}
      <div className="space-y-6">
        {filteredReleases.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center">
            <Megaphone className="h-10 w-10 text-[var(--text-secondary)]/40" />
            <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              No se encontraron novedades
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
              No existen notas de versión que coincidan con los criterios de búsqueda o categoría seleccionados.
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
    </div>
  );
}
