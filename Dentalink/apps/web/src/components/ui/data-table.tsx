import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { cn } from "@/lib/utils/cn";

export type DataTableColumnPriority = "P1" | "P2" | "P3";

export type DataTableColumn<T> = {
  key: keyof T;
  title: ReactNode;
  cellClassName?: string;
  headerClassName?: string;
  render?: (row: T) => ReactNode;
  mobileRender?: (row: T) => ReactNode;
  mobileLabel?: ReactNode;
  mobileHidden?: boolean;
  priority?: DataTableColumnPriority;
  primary?: boolean;
  actions?: boolean;
  wrap?: boolean;
};

export type DataTableMobileView = "list" | "cards" | "table";

function priorityClass(priority: DataTableColumnPriority | undefined) {
  if (priority === "P3") return "hidden 2xl:table-cell";
  return undefined;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty,
  tableClassName,
  containerClassName,
  stickyFirstColumn = false,
  stickyLastColumn = false,
  responsiveCards,
  mobileView = responsiveCards ? "cards" : "list",
  getRowKey
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  empty: ReactNode;
  tableClassName?: string;
  containerClassName?: string;
  stickyFirstColumn?: boolean;
  stickyLastColumn?: boolean;
  /** @deprecated Use mobileView="cards". */
  responsiveCards?: boolean;
  mobileView?: DataTableMobileView;
  getRowKey?: (row: T, index: number) => string;
}) {
  if (!rows.length) return <>{empty}</>;

  const primaryColumn = columns.find((column) => column.primary) ?? columns.find((column) => !column.actions) ?? columns[0];
  const mobileColumns = columns.filter((column) => !column.mobileHidden && column !== primaryColumn);

  return (
    <div className="min-w-0">
      <div className={cn("w-full", mobileView !== "table" && "hidden lg:block")}>
        <Table className={tableClassName} containerClassName={containerClassName}>
          <TableHead>
            <TableRow>
              {columns.map((column, colIdx) => (
                <TableHeader
                  key={`${String(column.key)}-${colIdx}`}
                  className={cn(priorityClass(column.priority), column.headerClassName)}
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
              <TableRow key={getRowKey?.(row, rowIndex) ?? rowIndex}>
                {columns.map((column, colIdx) => (
                  <TableCell
                    key={`${String(column.key)}-${colIdx}`}
                    className={cn(priorityClass(column.priority), column.cellClassName)}
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

      {mobileView !== "table" ? (
        <div
          className={cn(
            "divide-y divide-[var(--border-default)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] lg:hidden",
            mobileView === "cards" && "space-y-[var(--space-3)] divide-y-0 border-0 bg-transparent"
          )}
        >
          {rows.map((row, rowIndex) => {
            const rowKey = getRowKey?.(row, rowIndex) ?? rowIndex;
            const primaryContent = primaryColumn.mobileRender?.(row) ?? primaryColumn.render?.(row) ?? String(row[primaryColumn.key] ?? "");
            return (
              <article
                key={rowKey}
                className={cn(
                  "min-w-0 px-[var(--space-3)] py-[var(--space-4)]",
                  mobileView === "cards" && "rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
                )}
              >
                <div className="min-w-0 text-[var(--text-base)] font-semibold text-[var(--text-primary)]">{primaryContent}</div>
                <dl className="mt-[var(--space-3)] grid min-w-0 gap-[var(--space-2)]">
                  {mobileColumns.map((column, colIdx) => {
                    const isActions = column.actions || String(column.title).toLocaleLowerCase().includes("acciones");
                    const value = column.mobileRender?.(row) ?? column.render?.(row) ?? String(row[column.key] ?? "");
                    if (isActions) {
                      return (
                        <div
                          key={`${String(column.key)}-${colIdx}`}
                          className="mt-[var(--space-1)] flex min-w-0 flex-wrap justify-end gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-3)] [&>div]:min-w-0 [&>div]:max-w-full [&>div]:flex-wrap [&>div]:justify-end"
                        >
                          {value}
                        </div>
                      );
                    }
                    return (
                      <div key={`${String(column.key)}-${colIdx}`} className="grid min-w-0 grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] gap-[var(--space-3)] text-[var(--text-sm)]">
                        <dt className="font-medium text-[var(--text-secondary)]">{column.mobileLabel ?? column.title}</dt>
                        <dd className="min-w-0 break-words text-right font-medium text-[var(--text-primary)]">{value}</dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
