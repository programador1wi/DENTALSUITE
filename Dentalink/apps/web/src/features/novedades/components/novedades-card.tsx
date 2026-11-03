import { Link } from "react-router-dom";
import { ExternalLink, Calendar, Sparkles, ArrowRight } from "lucide-react";
import type { ReleaseItem } from "../types";
import { NovedadesVisualPreview } from "./novedades-visual-preview";
import { cn } from "@/lib/utils/cn";

interface NovedadesCardProps {
  release: ReleaseItem;
  isRead: boolean;
  onMarkAsRead?: () => void;
}

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  NEW: {
    label: "Nuevo",
    bg: "bg-[var(--bg-brand-light)]",
    text: "text-[var(--text-brand)] font-semibold",
    border: "border-[var(--border-brand-light)]"
  },
  IMPROVEMENT: {
    label: "Mejora",
    bg: "bg-emerald-50",
    text: "text-emerald-700 font-semibold",
    border: "border-emerald-200"
  },
  FIX: {
    label: "Corrección",
    bg: "bg-slate-100",
    text: "text-slate-700 font-medium",
    border: "border-slate-200"
  },
  ANNOUNCEMENT: {
    label: "Aviso",
    bg: "bg-amber-50",
    text: "text-amber-800 font-semibold",
    border: "border-amber-200"
  }
};

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function NovedadesCard({ release, isRead, onMarkAsRead }: NovedadesCardProps) {
  const categoryConfig = CATEGORY_STYLES[release.category] || CATEGORY_STYLES.NEW;

  return (
    <article
      data-testid={`novedad-card-${release.id}`}
      className={cn(
        "group relative flex flex-col rounded-[var(--radius-lg)] border bg-[var(--bg-surface)] p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md",
        isRead
          ? "border-[var(--border-default)]"
          : "border-[var(--border-brand-light)] bg-gradient-to-b from-[var(--bg-brand-light)]/20 to-[var(--bg-surface)]"
      )}
      onClick={onMarkAsRead}
    >
      {/* Top row: Badges, Tags & Version */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
              categoryConfig.bg,
              categoryConfig.text,
              categoryConfig.border
            )}
          >
            {release.category === "NEW" && <Sparkles className="h-3 w-3" />}
            {categoryConfig.label}
          </span>

          {release.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!isRead && (
            <span
              data-testid="unread-indicator"
              className="flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-100"
              title="No leído"
            />
          )}
          <span className="text-[11px] font-mono text-[var(--text-secondary)]">v{release.version}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-3 text-base font-semibold leading-snug text-[var(--text-brand-strong)] group-hover:text-[var(--text-brand)] transition-colors">
        {release.title}
      </h3>

      {/* Author & Date metadata */}
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {release.author?.avatarUrl ? (
          <img
            src={release.author.avatarUrl}
            alt={release.author.name}
            className="h-5 w-5 rounded-full object-cover border border-[var(--border-default)]"
          />
        ) : null}
        <span className="font-medium text-[var(--text-primary)]">
          {release.author?.name ? release.author.name : "Equipo Warner Suite"}
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(release.publishedAt)}
        </span>
      </div>

      {/* Summary */}
      <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-[var(--text-primary)]">
        {release.summary}
      </p>

      {/* Bullet points if present */}
      {release.content && release.content.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-l-2 border-[var(--border-brand-light)] pl-3 text-xs text-[var(--text-secondary)]">
          {release.content.map((bullet, idx) => (
            <li key={idx} className="leading-normal">
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Visual Interactive Preview / Media */}
      <div className="mt-4">
        <NovedadesVisualPreview release={release} />
      </div>

      {/* Action / CTA Button */}
      {release.actionUrl && (
        <div className="mt-4 pt-2 border-t border-[var(--border-default)]/60">
          {release.actionUrl.startsWith("/") ? (
            <Link
              to={release.actionUrl}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[var(--action-primary-hover)]"
            >
              <span>{release.actionLabel || "Explorar funcionalidad"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <a
              href={release.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[var(--action-primary-hover)]"
            >
              <span>{release.actionLabel || "Conocer novedades aquí"}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}
