import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PermissionDeniedVariant = "inline" | "tab" | "page";

export interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
  variant?: PermissionDeniedVariant;
  action?: ReactNode;
  showHomeLink?: boolean;
}

export function PermissionDeniedState({
  title = "Acceso no autorizado",
  description = "No cuentas con los permisos necesarios para visualizar o gestionar esta sección.",
  variant = "inline",
  action,
  showHomeLink = variant === "page"
}: PermissionDeniedStateProps) {
  if (variant === "page") {
    return (
      <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-full)] bg-[var(--status-danger-bg)] text-[var(--text-danger)] shadow-sm">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {showHomeLink ? (
            <Link to="/">
              <Button variant="secondary" size="md" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "tab") {
    return (
      <div className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    );
  }

  // variant === "inline"
  return (
    <div className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-left">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-2xs">
        <Lock className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-[var(--text-primary)] leading-tight">
          {title}
        </h4>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
