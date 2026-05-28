import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

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
  containerClassName
}: {
  columns: Column<T>[];
  rows: T[];
  empty: ReactNode;
  tableClassName?: string;
  containerClassName?: string;
}) {
  if (!rows.length) return <>{empty}</>;

  return (
    <div>
      <Table className={tableClassName} containerClassName={containerClassName}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeader key={String(column.key)} className={column.headerClassName} wrap={column.wrap}>
                {column.title}
              </TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={String(column.key)} className={column.cellClassName} wrap={column.wrap}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
