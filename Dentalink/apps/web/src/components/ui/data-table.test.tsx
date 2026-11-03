import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./data-table";

type Row = { id: string; name: string; email: string; branch: string };

const columns: DataTableColumn<Row>[] = [
  { key: "name", title: "Paciente", primary: true },
  { key: "email", title: "Correo", priority: "P1" },
  { key: "branch", title: "Sucursal", priority: "P3" },
  { key: "id", title: "Acciones", actions: true, render: () => <button type="button">Abrir</button> }
];

describe("DataTable responsive contract", () => {
  it("renders a compact mobile record without losing fields or actions", () => {
    const { container } = render(
      <DataTable<Row>
        rows={[{ id: "patient-1", name: "JUAN FRANCISCO DE JESÚS HERNÁNDEZ MARTÍNEZ", email: "administracion.sucursal.centro@empresaexample.com.mx", branch: "Clínica Tuxtla Centro" }]}
        columns={columns}
        empty={<span>Sin datos</span>}
        getRowKey={(row) => row.id}
      />
    );

    const mobileRecord = container.querySelector("article");
    expect(mobileRecord).not.toBeNull();
    expect(within(mobileRecord as HTMLElement).getByText("JUAN FRANCISCO DE JESÚS HERNÁNDEZ MARTÍNEZ")).toBeInTheDocument();
    expect(within(mobileRecord as HTMLElement).getByText("administracion.sucursal.centro@empresaexample.com.mx")).toBeInTheDocument();
    expect(within(mobileRecord as HTMLElement).getByRole("button", { name: "Abrir" })).toBeInTheDocument();
    expect(screen.getAllByText("Clínica Tuxtla Centro").length).toBeGreaterThan(0);
  });
});
