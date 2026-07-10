import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { cn } from "@/lib/utils/cn";

type Column<T> = {
  key: keyof T;
  title: ReactNode;
  cellClassName?: string;
  headerClassName?: string;
  render?: (row: T) => ReactNode;
  wrap?: boolean;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty,
  tableClassName,
  containerClassName,
  stickyFirstColumn = false,
  stickyLastColumn = false,
  responsiveCards = false
}: {
  columns: Column<T>[];
  rows: T[];
  empty: ReactNode;
  tableClassName?: string;
  containerClassName?: string;
  stickyFirstColumn?: boolean;
  stickyLastColumn?: boolean;
  responsiveCards?: boolean;
}) {
  if (!rows.length) return <>{empty}</>;

  return (
    <div className="space-y-4">
      {/* Vista de tabla para pantallas grandes */}
      <div className={cn("w-full", responsiveCards && "hidden md:block")}>
        <Table className={tableClassName} containerClassName={containerClassName}>
          <TableHead>
            <TableRow>
              {columns.map((column, colIdx) => (
                <TableHeader
                  key={String(column.key)}
                  className={column.headerClassName}
                  wrap={column.wrap}
                  stickyLeft={stickyFirstColumn && colIdx === 0}
                  stickyRight={stickyLastColumn && colIdx === columns.length - 1}
                >
                  {column.title}
                </TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column, colIdx) => (
                  <TableCell
                    key={String(column.key)}
                    className={column.cellClassName}
                    wrap={column.wrap}
                    stickyLeft={stickyFirstColumn && colIdx === 0}
                    stickyRight={stickyLastColumn && colIdx === columns.length - 1}
                  >
                    {column.render ? column.render(row) : String(row[column.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Vista responsiva de tarjetas para pantallas móviles */}
      {responsiveCards && (
        <div className="block md:hidden space-y-3">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-sm space-y-3 transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-md"
            >
              {columns.map((column) => {
                const isActions = column.key === "id" || String(column.title).toLowerCase().includes("acciones");
                return (
                  <div
                    key={String(column.key)}
                    className={cn(
                      isActions
                        ? "flex justify-end gap-2 border-t border-[var(--border-default)] pt-3 mt-2"
                        : "flex justify-between items-start gap-4 text-[var(--text-sm)]"
                    )}
                  >
                    {!isActions && (
                      <span className="text-[var(--text-secondary)] font-medium shrink-0">
                        {column.title}
                      </span>
                    )}
                    <span className={cn(isActions ? "w-full" : "text-[var(--text-primary)] font-semibold text-right min-w-0 break-words")}>
                      {column.render ? column.render(row) : String(row[column.key] ?? "")}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

