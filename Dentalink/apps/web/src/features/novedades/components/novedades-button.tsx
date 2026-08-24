import { Megaphone } from "lucide-react";
import { useNovedadesStore } from "../stores/use-novedades-store";
import { cn } from "@/lib/utils/cn";

interface NovedadesButtonProps {
  className?: string;
  showText?: boolean;
}

export function NovedadesButton({ className, showText = true }: NovedadesButtonProps) {
  const { openDrawer, getUnreadCount } = useNovedadesStore();
  const unreadCount = getUnreadCount();
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      className={cn(
        "relative flex h-9 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-default)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]",
        hasUnread && "border-[var(--border-brand-light)] bg-[var(--bg-brand-light)]/40 text-[var(--text-brand)] hover:bg-[var(--bg-brand-light)]",
        className
      )}
      aria-label={`Novedades${hasUnread ? ` (${unreadCount} sin leer)` : ""}`}
      title="Novedades y actualizaciones"
    >
      <Megaphone className="h-4 w-4 shrink-0 text-current" />
      {showText && <span className="hidden sm:inline font-semibold">Novedades</span>}

      {hasUnread && (
        <span
          data-testid="novedades-unread-badge"
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in fade-in zoom-in-75"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
