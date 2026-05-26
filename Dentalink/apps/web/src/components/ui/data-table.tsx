import type { ReactNode } from "react";
import { Card } from "./card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

type Column<T> = {
  key: keyof T;
  title: ReactNode;
  render?: (row: T) => ReactNode;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty
}: {
  columns: Column<T>[];
  rows: T[];
  empty: ReactNode;
}) {
  if (!rows.length) return <>{empty}</>;

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeader key={String(column.key)}>{column.title}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={String(column.key)}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
