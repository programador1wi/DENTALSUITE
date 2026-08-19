import { Button } from "@/components/ui/button";
import { PermissionDeniedState } from "./permission-denied-state";

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Reintentar"
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const isPermissionError =
    message.toLowerCase().includes("forbidden") ||
    message.toLowerCase().includes("no tienes permiso") ||
    message.toLowerCase().includes("insufficient permissions") ||
    message.includes("403") ||
    message.toLowerCase().includes("access denied");

  if (isPermissionError) {
    return (
      <PermissionDeniedState
        variant="inline"
        title="Acceso restringido"
        description={message}
        action={
          onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] p-[var(--space-4)] text-[var(--text-sm)] text-[var(--status-danger-text)]">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-full)] border border-[var(--text-danger)] text-[10px]">
          !
        </span>
        Error
      </div>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <div className="mt-[var(--space-3)]">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
