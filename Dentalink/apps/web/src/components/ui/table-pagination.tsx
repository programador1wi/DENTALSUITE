import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export function TablePagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  itemLabel = "registros"
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <nav
      className="flex min-w-0 flex-col gap-[var(--space-3)] border-t border-[var(--border-default)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginación del listado"
    >
      <span>
        {typeof totalItems === "number" ? `${totalItems} ${itemLabel} · ` : ""}
        Página {safePage} de {safeTotalPages}
      </span>
      <div className="flex items-center gap-[var(--space-2)]">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
