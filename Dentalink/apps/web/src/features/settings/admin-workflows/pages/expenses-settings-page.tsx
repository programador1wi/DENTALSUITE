import { FormEvent, useState } from "react";
import {
  Ban,
  ExternalLink,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  ReceiptText,
  WalletCards
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api/error";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import {
  useCreateExpense,
  useExpenseSummary,
  useExpenses,
  useUpdateExpense,
  useVoidExpense
} from "../hooks/use-admin-workflows";
import type { Expense, ExpenseSummary } from "../services/admin-workflows.service";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currency(value: string | number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
}

function localDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("es-MX") : "—";
}

function expenseNumber(expense: Pick<Expense, "publicNumber">) {
  return `GAS-${String(expense.publicNumber).padStart(6, "0")}`;
}

type ExpenseForm = {
  categoryName: string;
  categoryReportGroup: "PROFESSIONALS" | "LABORATORIES" | "COMMISSIONS" | "GENERAL";
  description: string;
  supplierName: string;
  quantity: string;
  unitCost: string;
  invoicedAt: string;
  accountingDate: string;
  paidAt: string;
  paymentMethodId: string;
  documentUrl: string;
  notes: string;
  assignToOpenCash: boolean;
};

const EMPTY_FORM: ExpenseForm = {
  categoryName: "",
  categoryReportGroup: "GENERAL",
  description: "",
  supplierName: "",
  quantity: "1",
  unitCost: "",
  invoicedAt: "",
  accountingDate: today(),
  paidAt: today(),
  paymentMethodId: "",
  documentUrl: "",
  notes: "",
  assignToOpenCash: true
};

export function ExpensesSettingsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { branchId, setBranchId } = useActiveBranchFilter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("gastos");
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [lockedExpense, setLockedExpense] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const currentDate = new Date();
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentDate.getFullYear()));

  const branches = useBranches(undefined, "ACTIVE");
  const paymentMethods = usePaymentMethods(undefined, "true");
  const expenses = useExpenses({
    search: search || undefined,
    branchId: branchId || undefined,
    month: Number(month),
    year: Number(year)
  });
  const expenseSummary = useExpenseSummary({
    branchId: branchId || undefined,
    month: Number(month),
    year: Number(year)
  });
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const voidExpense = useVoidExpense();
  const canCreate =
    hasPermission("expenses.create") ||
    hasPermission("settings.update") ||
    hasPermission("organization.manage_all");
  const canUpdate =
    hasPermission("expenses.update") ||
    hasPermission("settings.update") ||
    hasPermission("organization.manage_all");
  const canVoid =
    hasPermission("expenses.void") || hasPermission("settings.update") || hasPermission("organization.manage_all");

  const rows = expenses.data ?? [];
  const activeRows = rows.filter((expense: Expense) => expense.status !== "VOIDED");
  const total = expenseSummary.data?.total ?? 0;
  const assignedTotal = activeRows
    .filter((expense: Expense) => expense.cashMovements.length > 0)
    .reduce((sum: number, expense: Expense) => sum + Number(expense.total), 0);
  const summaryRows = expenseSummary.data?.rows ?? [];

  const setField = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (!expense.permissions.canEdit) {
      if (expense.cashAssociation.locked) setLockedExpense(expense);
      return;
    }
    setEditing(expense);
    setBranchId(expense.branch.id);
    setForm({
      categoryName: expense.category.name,
      categoryReportGroup: expense.category.reportGroup,
      description: expense.description,
      supplierName: expense.supplierName ?? "",
      quantity: expense.quantity,
      unitCost: expense.unitCost,
      invoicedAt: expense.invoicedAt?.slice(0, 10) ?? "",
      accountingDate: expense.accountingDate?.slice(0, 10) ?? "",
      paidAt: expense.paidAt.slice(0, 10),
      paymentMethodId: expense.paymentMethod?.id ?? "",
      documentUrl: expense.documentUrl ?? "",
      notes: expense.notes ?? "",
      assignToOpenCash: expense.cashMovements.length > 0
    });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId || !form.categoryName.trim() || !form.description.trim()) return;
    const payload = {
      branchId,
      categoryName: form.categoryName.trim(),
      categoryReportGroup: form.categoryReportGroup,
      description: form.description.trim(),
      supplierName: form.supplierName.trim() || undefined,
      quantity: Number(form.quantity),
      unitCost: Number(form.unitCost),
      invoicedAt: form.invoicedAt || undefined,
      accountingDate: form.accountingDate,
      paidAt: form.paidAt,
      paymentMethodId: form.paymentMethodId || undefined,
      documentUrl: form.documentUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
      assignToOpenCash: form.assignToOpenCash
    };
    try {
      if (editing) {
        await updateExpense.mutateAsync({
          id: editing.id,
          payload: { ...payload, expectedVersion: editing.version }
        });
      } else {
        await createExpense.mutateAsync(payload);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      if (editing && error instanceof ApiError && error.code?.startsWith("EXPENSE_LOCKED_BY_")) {
        setFormOpen(false);
        setLockedExpense({
          ...editing,
          cashAssociation: {
            ...editing.cashAssociation,
            locked: true,
            status: String(error.details?.cashSessionStatus ?? "CLOSED") as "CLOSED",
            cashSessionNumber:
              String(error.details?.cashSessionNumber ?? editing.cashAssociation.cashSessionNumber ?? "") ||
              null,
            branchName: String(error.details?.branchName ?? editing.cashAssociation.branchName ?? "") || null,
            responsibleName:
              String(error.details?.responsibleName ?? editing.cashAssociation.responsibleName ?? "") || null,
            closedAt: String(error.details?.closedAt ?? editing.cashAssociation.closedAt ?? "") || null,
            lockReason: error.code.includes("CLOSING") ? "CLOSING_CASH_SESSION" : "CLOSED_CASH_SESSION"
          },
          permissions: { ...editing.permissions, canEdit: false, canVoid: false }
        });
      }
    }
  };

  const confirmVoid = async () => {
    if (!voiding || !voidReason.trim()) return;
    try {
      await voidExpense.mutateAsync({ expense: voiding, reason: voidReason.trim() });
      setVoiding(null);
      setVoidReason("");
    } catch (error) {
      if (error instanceof ApiError && error.code?.startsWith("EXPENSE_LOCKED_BY_")) {
        setVoiding(null);
        setLockedExpense(voiding);
      }
    }
  };

  if (expenses.isLoading || expenseSummary.isLoading) return <LoadingState message="Cargando gastos..." />;
  if (expenses.isError) return <ErrorState message={expenses.error.message} />;
  if (expenseSummary.isError) return <ErrorState message={expenseSummary.error.message} />;

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-4">
      <PageHeader
        title="Gastos"
        description="Egresos administrativos y operativos, con trazabilidad hacia caja cuando corresponde."
        helpText="Un gasto por transferencia puede reportarse sin reducir efectivo. Solo gastos asignados a una caja y pagados con un medio físico afectan conciliación."
      />

      <Card className="space-y-4 overflow-visible border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_72%,#ecfeff_100%)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            items={[
              { key: "gastos", label: "Gastos" },
              { key: "detalle", label: "Detalle" },
              { key: "resumen", label: "Resumen por categoría" }
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-[140px_110px_minmax(220px,280px)]">
            <Select value={month} onChange={(event) => setMonth(event.target.value)}>
              {MONTHS.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(event) => setYear(event.target.value)}>
              {Array.from({ length: 7 }, (_, index) => currentDate.getFullYear() - 3 + index).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            icon={ReceiptText}
            label="Gasto del periodo"
            value={currency(total)}
            detail={`${activeRows.length} registros vigentes`}
          />
          <Metric
            icon={WalletCards}
            label="Asignado a cajas"
            value={currency(assignedTotal)}
            detail="Impacto sujeto a medio de pago"
          />
          <Metric
            icon={FileText}
            label="Categorías activas"
            value={String(summaryRows.length)}
            detail={`${rows.filter((row) => row.status === "VOIDED").length} anulados`}
          />
        </div>
      </Card>

      {activeTab !== "resumen" ? (
        <Card className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <EntitySearchBox
              className="w-full sm:max-w-[360px]"
              placeholder="Buscar folio, categoría o detalle"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? rows : []}
              onSelect={(expense) => setSearch(expense.description)}
              getItemKey={(expense) => expense.id}
              emptyMessage="Sin gastos encontrados"
              renderItem={(expense) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {expenseNumber(expense)} · {expense.description}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {expense.category.name} · {currency(expense.total)}
                  </p>
                </div>
              )}
            />
            {canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Agregar gasto
              </Button>
            ) : null}
          </div>

          <DataTable
            rows={rows as Array<Expense & Record<string, unknown>>}
            empty={<EmptyState title="Sin gastos" description="No hay gastos registrados en el periodo." />}
            columns={[
              {
                key: "publicNumber",
                title: "Folio",
                render: (row) => (
                  <span className="font-mono text-xs font-semibold text-slate-700">{expenseNumber(row)}</span>
                )
              },
              {
                key: "category",
                title: "Categoría",
                render: (row) => (
                  <span className="text-xs font-semibold uppercase text-slate-600">{row.category.name}</span>
                )
              },
              {
                key: "description",
                title: "Detalle",
                render: (row) => (
                  <div className="max-w-[360px]">
                    <p className="text-sm text-slate-900">{row.description}</p>
                    <p className="text-xs text-slate-500">
                      {row.paymentMethod?.name ?? "Medio no informado"}
                    </p>
                  </div>
                )
              },
              { key: "invoicedAt", title: "Factura", render: (row) => localDate(row.invoicedAt) },
              { key: "paidAt", title: "Pago", render: (row) => localDate(row.paidAt) },
              {
                key: "total",
                title: "Total",
                render: (row) => (
                  <span className="block text-right font-semibold tabular-nums text-slate-950">
                    {currency(row.total)}
                  </span>
                )
              },
              {
                key: "status",
                title: "Estado",
                render: (row) => (
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge
                      value={
                        row.status === "VOIDED"
                          ? "Anulado"
                          : row.cashAssociation.locked
                            ? row.cashAssociation.status === "CLOSING"
                              ? "Caja en cierre"
                              : "Caja cerrada"
                            : row.cashMovements.length
                              ? "Caja abierta"
                              : "Administrativo"
                      }
                      tone={
                        row.status === "VOIDED"
                          ? "danger"
                          : row.cashAssociation.locked
                            ? "warning"
                            : row.cashMovements.length
                              ? "success"
                              : "default"
                      }
                    />
                    {row.cashAssociation.associated ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                        aria-label={`Gasto asociado a ${row.cashAssociation.cashSessionNumber ?? "caja"}, estado ${row.cashAssociation.status ?? "desconocido"}`}
                        title={
                          row.cashAssociation.locked
                            ? `Este gasto forma parte de ${row.cashAssociation.cashSessionNumber}. No puede editarse ni anularse directamente.`
                            : `Gasto asociado a ${row.cashAssociation.cashSessionNumber}`
                        }
                        onClick={() => setLockedExpense(row)}
                      >
                        {row.cashAssociation.locked ? (
                          <LockKeyhole className="h-3.5 w-3.5" />
                        ) : (
                          <ReceiptText className="h-3.5 w-3.5" />
                        )}
                        {row.cashAssociation.cashSessionNumber}
                      </button>
                    ) : null}
                  </div>
                )
              },
              {
                key: "id",
                title: "",
                render: (row) =>
                  row.status === "VOIDED" ? null : (
                    <div className="flex justify-end gap-1">
                      {canUpdate ? (
                        <button
                          type="button"
                          aria-label={`Editar ${expenseNumber(row)}`}
                          aria-disabled={!row.permissions.canEdit}
                          title={
                            row.permissions.canEdit
                              ? `Editar ${expenseNumber(row)}`
                              : `No puede editarse porque pertenece a ${row.cashAssociation.cashSessionNumber ?? "una caja bloqueada"}.`
                          }
                          className={`rounded-md p-2 ${row.permissions.canEdit ? "text-amber-700 hover:bg-amber-50" : "cursor-not-allowed text-slate-300"}`}
                          onClick={() => (row.permissions.canEdit ? openEdit(row) : setLockedExpense(row))}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canVoid ? (
                        <button
                          type="button"
                          aria-label={`Anular ${expenseNumber(row)}`}
                          aria-disabled={!row.permissions.canVoid}
                          title={
                            row.permissions.canVoid
                              ? `Anular ${expenseNumber(row)}`
                              : `No puede anularse directamente porque pertenece a ${row.cashAssociation.cashSessionNumber ?? "una caja bloqueada"}.`
                          }
                          className={`rounded-md p-2 ${row.permissions.canVoid ? "text-red-700 hover:bg-red-50" : "cursor-not-allowed text-slate-300"}`}
                          onClick={() => (row.permissions.canVoid ? setVoiding(row) : setLockedExpense(row))}
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : null}
                      {row.permissions.canViewCashSession && row.cashAssociation.cashSessionNumber ? (
                        <button
                          type="button"
                          aria-label={`Ver ${row.cashAssociation.cashSessionNumber}`}
                          title={`Ver ${row.cashAssociation.cashSessionNumber}`}
                          className="rounded-md p-2 text-cyan-700 hover:bg-cyan-50"
                          onClick={() => navigate(APP_ROUTES.cashRegister.detail(row.cashAssociation.cashSessionNumber))}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  )
              }
            ]}
          />
        </Card>
      ) : (
        <Card className="space-y-5">
          {expenseSummary.data?.trend.some((point: { amount: number }) => point.amount > 0) ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Tendencia mensual</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={expenseSummary.data.trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    tickFormatter={(value) =>
                      `$${Number(value).toLocaleString("es-MX", { notation: "compact" })}`
                    }
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Bar dataKey="amount" name="Gastos" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <DataTable
            rows={summaryRows as Array<ExpenseSummary["rows"][number] & Record<string, unknown>>}
            empty={<EmptyState title="Sin gastos" description="No hay gastos registrados para resumir." />}
            columns={[
              {
                key: "category",
                title: "Categoría",
                render: (row) => <span className="font-semibold text-slate-800">{row.category}</span>
              },
              {
                key: "count",
                title: "Registros",
                render: (row) => <span className="tabular-nums">{row.count}</span>
              },
              {
                key: "total",
                title: "Total",
                render: (row) => (
                  <span className="block text-right font-semibold tabular-nums">{currency(row.total)}</span>
                )
              },
              {
                key: "percentage",
                title: "% periodo",
                render: (row) => <span className="block text-right tabular-nums">{row.percentage}%</span>
              },
              {
                key: "comparisonPercent",
                title: "Vs. mes anterior",
                render: (row) => (
                  <span
                    className={`block text-right tabular-nums ${Number(row.comparisonPercent ?? 0) > 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {row.comparisonPercent === null || row.comparisonPercent === undefined
                      ? "Sin base"
                      : `${Number(row.comparisonPercent) > 0 ? "+" : ""}${row.comparisonPercent}%`}
                  </span>
                )
              }
            ]}
          />
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar ${expenseNumber(editing)}` : "Agregar gasto"}
        size="lg"
      >
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Sucursal
              <Select
                className="mt-1"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                disabled={Boolean(editing)}
                required
              >
                <option value="">Seleccionar</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Categoría
              <Input
                className="mt-1"
                value={form.categoryName}
                onChange={(event) => setField("categoryName", event.target.value)}
                placeholder="Ej. Laboratorio"
                required
              />
            </label>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Detalle
            <Input
              className="mt-1"
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Proveedor
            <Input
              className="mt-1"
              value={form.supplierName}
              onChange={(event) => setField("supplierName", event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Costo unitario
              <Input
                className="mt-1"
                type="number"
                min="0.01"
                step="0.01"
                value={form.unitCost}
                onChange={(event) => setField("unitCost", event.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Cantidad
              <Input
                className="mt-1"
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={(event) => setField("quantity", event.target.value)}
                required
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Fecha correspondencia
              <Input
                className="mt-1"
                type="date"
                value={form.accountingDate}
                onChange={(event) => setField("accountingDate", event.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha factura
              <Input
                className="mt-1"
                type="date"
                value={form.invoicedAt}
                onChange={(event) => setField("invoicedAt", event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha pago
              <Input
                className="mt-1"
                type="date"
                value={form.paidAt}
                onChange={(event) => setField("paidAt", event.target.value)}
                required
              />
            </label>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Grupo para reportes
            <Select
              className="mt-1"
              value={form.categoryReportGroup}
              onChange={(event) => setField("categoryReportGroup", event.target.value as ExpenseForm["categoryReportGroup"])}
            >
              <option value="GENERAL">Gastos generales</option>
              <option value="PROFESSIONALS">Profesionales</option>
              <option value="LABORATORIES">Laboratorios</option>
              <option value="COMMISSIONS">Comisiones</option>
            </Select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Medio de pago
            <Select
              className="mt-1"
              value={form.paymentMethodId}
              onChange={(event) => setField("paymentMethodId", event.target.value)}
            >
              <option value="">No informado</option>
              {paymentMethods.data?.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Documento (HTTPS)
            <Input
              className="mt-1"
              type="url"
              value={form.documentUrl}
              onChange={(event) => setField("documentUrl", event.target.value)}
              placeholder="https://..."
            />
          </label>
          {!editing ? (
            <label className="flex items-start gap-3 rounded-lg border border-cyan-100 bg-cyan-50/60 p-3 text-sm text-slate-700">
              <input
                className="mt-1"
                type="checkbox"
                checked={form.assignToOpenCash}
                onChange={(event) => setField("assignToOpenCash", event.target.checked)}
              />
              <span>
                <strong className="block text-slate-900">Asignar a mi caja abierta</strong>Si el medio está
                configurado como efectivo físico, reducirá efectivo esperado.
              </span>
            </label>
          ) : null}
          <Textarea
            value={form.notes}
            onChange={(event) => setField("notes", event.target.value)}
            placeholder="Notas y contexto del gasto"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createExpense.isPending || updateExpense.isPending}>
              {editing ? "Guardar cambios" : "Registrar gasto"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title={voiding ? `Anular ${expenseNumber(voiding)}` : "Anular gasto"}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            No se eliminará el registro. Se conservará historial y se generará contramovimiento cuando exista
            impacto de caja.
          </p>
          <Textarea
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="Motivo obligatorio"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVoiding(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!voidReason.trim() || voidExpense.isPending}
              onClick={confirmVoid}
            >
              Anular gasto
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(lockedExpense)}
        onClose={() => setLockedExpense(null)}
        title={
          lockedExpense?.cashAssociation.locked
            ? "Gasto bloqueado por cierre de caja"
            : "Gasto asignado a caja"
        }
      >
        {lockedExpense ? (
          <div className="space-y-4">
            <div
              className={`flex gap-3 rounded-lg border p-4 ${lockedExpense.cashAssociation.locked ? "border-amber-200 bg-amber-50" : "border-cyan-200 bg-cyan-50"}`}
            >
              <LockKeyhole
                className={`mt-0.5 h-5 w-5 shrink-0 ${lockedExpense.cashAssociation.locked ? "text-amber-700" : "text-cyan-700"}`}
              />
              <p className="text-sm leading-6 text-slate-700">
                {lockedExpense.cashAssociation.locked
                  ? `Este gasto pertenece a ${lockedExpense.cashAssociation.cashSessionNumber}, ${lockedExpense.cashAssociation.status === "CLOSING" ? "actualmente en proceso de cierre" : "ya cerrada"}. Sus movimientos forman parte de una conciliación financiera y no pueden editarse ni anularse directamente.`
                  : `Este gasto está asociado a ${lockedExpense.cashAssociation.cashSessionNumber}. Mientras la caja permanezca abierta puede modificarse con los permisos correspondientes.`}
              </p>
            </div>
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-medium text-slate-500">Gasto</dt>
              <dd className="font-semibold text-slate-800">{expenseNumber(lockedExpense)}</dd>
              <dt className="font-medium text-slate-500">Caja</dt>
              <dd>{lockedExpense.cashAssociation.cashSessionNumber ?? "-"}</dd>
              <dt className="font-medium text-slate-500">Responsable</dt>
              <dd>{lockedExpense.cashAssociation.responsibleName ?? "-"}</dd>
              <dt className="font-medium text-slate-500">Sucursal</dt>
              <dd>{lockedExpense.cashAssociation.branchName ?? lockedExpense.branch.name}</dd>
              <dt className="font-medium text-slate-500">Estado</dt>
              <dd>{lockedExpense.cashAssociation.status ?? "-"}</dd>
              <dt className="font-medium text-slate-500">Fecha de cierre</dt>
              <dd>{localDate(lockedExpense.cashAssociation.closedAt)}</dd>
              <dt className="font-medium text-slate-500">Importe</dt>
              <dd className="font-semibold tabular-nums">{currency(lockedExpense.total)}</dd>
            </dl>
            {lockedExpense.cashAssociation.locked ? (
              <p className="text-xs leading-5 text-slate-500">
                Para corregirlo debe registrarse una operación posterior. El gasto y la caja originales
                permanecen intactos.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setLockedExpense(null)}>
                Cerrar
              </Button>
              {lockedExpense.cashAssociation.cashSessionNumber ? (
                <Button
                  onClick={() => {
                    navigate(APP_ROUTES.cashRegister.detail(lockedExpense.cashAssociation.cashSessionNumber));
                    setLockedExpense(null);
                  }}
                >
                  <ExternalLink className="h-4 w-4" /> Ver detalle de caja
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        <Icon className="h-4 w-4 text-cyan-700" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
