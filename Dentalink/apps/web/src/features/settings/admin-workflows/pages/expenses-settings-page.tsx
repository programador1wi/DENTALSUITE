import { FormEvent, useState } from "react";
import { Edit2, ReceiptText, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useCreateExpense, useExpenses } from "../hooks/use-admin-workflows";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
];

const YEARS = ["2024", "2025", "2026", "2027", "2028"];

export function ExpensesSettingsPage() {
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [invoicedAt, setInvoicedAt] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [notes, setNotes] = useState("");
  const [assignToOpenCash, setAssignToOpenCash] = useState(true);
  const [activeTab, setActiveTab] = useState("detalle");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentDate = new Date();
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentDate.getFullYear()));

  const branches = useBranches(undefined, "ACTIVE");
  const expenses = useExpenses({
    search: search || undefined,
    branchId: branchId || undefined,
    month: Number(month),
    year: Number(year)
  });
  const createExpense = useCreateExpense();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId || !categoryName.trim() || !description.trim() || Number(unitCost) <= 0 || Number(quantity) <= 0) return;

    await createExpense.mutateAsync({
      branchId,
      categoryName: categoryName.trim(),
      description: description.trim(),
      quantity: Number(quantity),
      unitCost: Number(unitCost),
      invoicedAt: invoicedAt || undefined,
      paidAt,
      notes: notes.trim() || undefined,
      assignToOpenCash
    });
    setCategoryName("");
    setDescription("");
    setQuantity("1");
    setUnitCost("");
    setInvoicedAt("");
    setNotes("");
    setIsModalOpen(false);
  };

  const summary = expenses.data?.reduce(
    (totals, expense) => {
      const category = expense.category.name;
      totals[category] = (totals[category] ?? 0) + Number(expense.total);
      return totals;
    },
    {} as Record<string, number>
  );
  const summaryRows = Object.entries(summary ?? {}).map(([category, total]) => ({ category, total }));

  if (expenses.isLoading) return <LoadingState message="Cargando gastos..." />;
  if (expenses.isError) return <ErrorState message={expenses.error.message} />;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4">
      <PageHeader
        title="Gastos"
        description="Registro de gastos por categoria, sucursal y caja."
        helpText="Los gastos se registran con detalle, monto y fecha; si se asignan a caja abierta quedan reflejados en la recaudacion."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={[
              { key: "detalle", label: "Detalle" },
              { key: "resumen", label: "Resumen por categoria" }
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[112px_88px_minmax(180px,220px)] lg:justify-end">
            <Select value={month} onChange={(event) => setMonth(event.target.value)} className="h-9">
              {MONTHS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(event) => setYear(event.target.value)} className="h-9">
              {YEARS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-9 sm:col-span-2 lg:col-span-1">
              <option value="">Todas las sucursales</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {activeTab === "detalle" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-[280px]">
              <Input placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-9" />
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="h-9 bg-emerald-500 hover:bg-emerald-600">
              + Agregar gasto
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar gasto">
        <form className="grid gap-3" onSubmit={submit}>
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
            <option value="">Selecciona sucursal</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Categoria (ej. pasajes)" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          <Input placeholder="Detalle del gasto" value={description} onChange={(event) => setDescription(event.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" min="0.01" step="0.01" placeholder="Costo unitario" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} required />
            <Input type="number" min="0.01" step="0.01" placeholder="Cantidad" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-700">
              Fecha factura
              <Input type="date" value={invoicedAt} onChange={(event) => setInvoicedAt(event.target.value)} />
            </label>
            <label className="text-sm text-slate-700">
              Fecha pago
              <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} required />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={assignToOpenCash} onChange={(event) => setAssignToOpenCash(event.target.checked)} />
            Asignar a caja abierta
          </label>
          <Textarea placeholder="Notas adicionales" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button type="submit" disabled={createExpense.isPending} className="mt-2">
            Guardar gasto
          </Button>
        </form>
      </Modal>

      {activeTab === "detalle" ? (
        <DataTable
          rows={expenses.data ?? []}
          empty={<EmptyState title="Sin gastos" description="No hay gastos registrados con esos filtros." />}
          columns={[
            {
              key: "category",
              title: "Categoria",
              render: (row) => <span className="text-xs font-medium uppercase text-slate-600">{row.category.name}</span>
            },
            { key: "description", title: "Detalle", render: (row) => <span className="text-xs text-slate-800">{row.description}</span> },
            { key: "id", title: "", render: () => <ReceiptText className="mx-auto h-5 w-5 text-red-500" /> },
            {
              key: "invoicedAt",
              title: "Fecha factura",
              render: (row) => <span className="text-sm">{row.invoicedAt ? new Date(row.invoicedAt).toLocaleDateString() : "-"}</span>
            },
            { key: "paidAt", title: "Fecha pago", render: (row) => <span className="text-sm">{new Date(row.paidAt).toLocaleDateString()}</span> },
            {
              key: "total",
              title: "Total",
              render: (row) => (
                <span className="font-semibold text-slate-900">
                  ${Number(row.total).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                </span>
              )
            },
            {
              key: "createdBy",
              title: "",
              render: () => (
                <div className="flex gap-2">
                  <button className="rounded bg-orange-400 p-1.5 text-white shadow-sm hover:bg-orange-500">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button className="rounded bg-red-500 p-1.5 text-white shadow-sm hover:bg-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            }
          ]}
        />
      ) : (
        <div className="mx-auto w-full max-w-4xl">
          <DataTable
            rows={summaryRows}
            empty={<EmptyState title="Sin gastos" description="No hay gastos registrados para resumir." />}
            columns={[
              {
                key: "category",
                title: "Categoria",
                render: (row) => <span className="text-sm font-medium uppercase text-slate-700">{row.category}</span>
              },
              {
                key: "total",
                title: "Total",
                render: (row) => <span className="font-semibold text-slate-900">${row.total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
              }
            ]}
          />
        </div>
      )}
    </div>
  );
}
