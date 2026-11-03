import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Home, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useCancelledPendingPayments } from "../hooks/use-payments";
import type { CancelledPendingPaymentLinkStatus, Payment, PaymentLink } from "../services/payments.service";

type ActiveTab = "voided" | "pending";

const LINK_STATUS_LABELS: Record<PaymentLink["status"], string> = {
  CREATED: "Pendiente",
  PAID: "Pagado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado"
};

const LINK_STATUS_TONES: Record<PaymentLink["status"], "default" | "success" | "warning" | "danger" | "brand"> = {
  CREATED: "warning",
  PAID: "success",
  EXPIRED: "danger",
  CANCELLED: "danger"
};

function patientName(row: { patient: { firstName: string; lastName: string } }) {
  return `${row.patient.firstName} ${row.patient.lastName}`.trim() || "Paciente sin nombre";
}

function userName(user?: { firstName: string; lastName: string } | null) {
  if (!user) return "-";
  return `${user.firstName} ${user.lastName}`.trim() || "-";
}

function money(value: string | number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value || 0));
}

function longDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function shortTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function shortId(value: string) {
  return value.length <= 8 ? value.toUpperCase() : value.slice(-8).toUpperCase();
}

function treatmentNumbers(payment: Payment) {
  if (!payment.treatments?.length) return "-";
  return (
    <div className="flex flex-col gap-1">
      {payment.treatments.map((treatment) => (
        <Link
          key={treatment.id}
          to={`/patients/${payment.patient.id}/treatments`}
          className="text-sm font-semibold text-sky-700 hover:text-sky-900"
          title={treatment.name}
        >
          {treatment.number}
        </Link>
      ))}
    </div>
  );
}

function treatmentDetail(payment: Payment) {
  if (!payment.treatments?.length) return <span className="text-slate-400">Sin tratamiento asociado</span>;
  return (
    <div className="space-y-1">
      {payment.treatments.map((treatment) => (
        <div key={treatment.id}>
          <p className="font-medium text-slate-900">{treatment.name}</p>
          {treatment.procedures.length ? (
            <p className="text-xs text-slate-500">{treatment.procedures.slice(0, 2).join(", ")}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function paymentMethod(payment: Payment) {
  return (
    <div>
      <p>{payment.paymentMethod.name}</p>
      {payment.financialInstitution ? <p className="text-xs text-slate-500">{payment.financialInstitution.name}</p> : null}
    </div>
  );
}

function deletedInfo(payment: Payment) {
  return (
    <div className="space-y-1">
      <p>{longDate(payment.voidedAt)}</p>
      <p className="text-xs text-slate-600">Eliminado por {userName(payment.voidedBy)}</p>
      {payment.voidReason ? <p className="text-xs text-slate-500">Motivo: {payment.voidReason}</p> : null}
    </div>
  );
}

function receivedInfo(payment: Payment) {
  return (
    <div className="space-y-1">
      <p>{longDate(payment.paidAt)}</p>
      {shortTime(payment.paidAt) ? <p className="text-xs text-slate-500">{shortTime(payment.paidAt)}</p> : null}
      <p className="text-xs text-slate-500">Recibido por {userName(payment.receivedBy)}</p>
    </div>
  );
}

export function CancelledPendingPaymentsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("voided");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [linkStatus, setLinkStatus] = useState<CancelledPendingPaymentLinkStatus | "">("");
  const { branchId, setBranchId } = useActiveBranchFilter();
  const branches = useBranches(undefined, "ACTIVE");

  const params = useMemo(
    () => ({
      branchId: branchId || undefined,
      search: search.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      linkStatus: linkStatus || undefined
    }),
    [branchId, dateFrom, dateTo, linkStatus, search]
  );

  const dashboard = useCancelledPendingPayments(params);
  const data = dashboard.data;

  if (dashboard.isLoading) return <LoadingState message="Cargando pagos anulados y pendientes..." />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;

  const voidedPayments = data?.voidedPayments ?? [];
  const pendingLinks = data?.pendingLinks ?? [];

  return (
    <div className="mx-auto max-w-[1180px] space-y-3">
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 text-sm">
          <button
            type="button"
            className="flex h-12 items-center gap-2 border-r border-slate-200 bg-white px-4 font-medium text-slate-700"
            onClick={() => setActiveTab("voided")}
          >
            <Clock className="h-4 w-4" />
            Pagos anulados y pendientes
          </button>
          <button
            type="button"
            className={`h-12 border-r border-slate-200 px-4 font-semibold ${activeTab === "voided" ? "bg-white text-slate-950" : "text-slate-600 hover:bg-white"}`}
            onClick={() => setActiveTab("voided")}
          >
            Pagos anulados
          </button>
          <button
            type="button"
            className={`h-12 border-r border-slate-200 px-4 font-semibold ${activeTab === "pending" ? "bg-white text-slate-950" : "text-slate-600 hover:bg-white"}`}
            onClick={() => setActiveTab("pending")}
          >
            Pagos pendientes TPV
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 py-5 text-center">
          <h1 className="text-base font-semibold text-slate-900">
            {activeTab === "voided" ? "Pagos anulados" : "Pagos pendientes TPV"}
          </h1>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm font-semibold text-slate-900">
            {activeTab === "voided"
              ? "Sucursal de la cual se están mostrando los pagos anulados"
              : "Sucursal de la cual se están mostrando los pagos pendientes"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Home className="hidden h-5 w-5 text-slate-600 sm:block" />
            <Select value={branchId || ""} onChange={(event) => setBranchId(event.target.value)} containerClassName="min-w-[260px]">
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" size="sm" onClick={() => dashboard.refetch()} aria-label="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200 px-4 py-3 md:grid-cols-4">
          <Input
            placeholder="Buscar paciente, pago, tratamiento, medio o motivo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="md:col-span-2"
          />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          {activeTab === "pending" ? (
            <Select value={linkStatus} onChange={(event) => setLinkStatus((event.target.value as CancelledPendingPaymentLinkStatus) || "")}>
              <option value="">Todos los links</option>
              <option value="CREATED">Pendientes</option>
              <option value="EXPIRED">Vencidos</option>
              <option value="CANCELLED">Cancelados</option>
            </Select>
          ) : null}
        </div>

        {activeTab === "voided" ? (
          <DataTable
            rows={voidedPayments}
            tableClassName="text-[13px]"
            containerClassName="rounded-none border-0"
            empty={<EmptyState title="Sin pagos anulados" description="No hay pagos anulados para los filtros actuales." />}
            columns={[
              { key: "id", title: "#", render: (row: Payment) => row.paymentNumber ?? shortId(row.id) },
              { key: "allocations", title: "# Trat.", render: (row: Payment) => treatmentNumbers(row) },
              { key: "patient", title: "Paciente", wrap: true, render: (row: Payment) => patientName(row).toUpperCase() },
              { key: "reference", title: "Tratamiento", wrap: true, render: (row: Payment) => treatmentDetail(row) },
              { key: "paymentMethod", title: "Medio pago", wrap: true, render: (row: Payment) => paymentMethod(row) },
              { key: "paidAt", title: "Recepción", wrap: true, render: (row: Payment) => receivedInfo(row) },
              { key: "voidedAt", title: "Eliminación", wrap: true, render: (row: Payment) => deletedInfo(row) },
              { key: "amount", title: "Monto", render: (row: Payment) => money(row.amount, row.currency) }
            ]}
          />
        ) : (
          <DataTable
            rows={pendingLinks}
            tableClassName="text-[13px]"
            containerClassName="rounded-none border-0"
            empty={<EmptyState title="Sin pagos pendientes" description="No hay links TPV pendientes, vencidos o cancelados para los filtros actuales." />}
            columns={[
              { key: "id", title: "#", render: (row: PaymentLink) => shortId(row.id) },
              {
                key: "treatmentPlan",
                title: "# Trat.",
                render: (row: PaymentLink) =>
                  row.treatmentPlan ? (
                    <Link to={`/patients/${row.patient.id}/treatments`} className="font-semibold text-sky-700 hover:text-sky-900">
                      {shortId(row.treatmentPlan.id)}
                    </Link>
                  ) : (
                    "-"
                  )
              },
              { key: "patient", title: "Paciente", wrap: true, render: (row: PaymentLink) => patientName(row).toUpperCase() },
              { key: "url", title: "Tratamiento", wrap: true, render: (row: PaymentLink) => row.treatmentPlan?.name ?? "-" },
              {
                key: "status",
                title: "Estado",
                render: (row: PaymentLink) => <Badge value={LINK_STATUS_LABELS[row.status]} tone={LINK_STATUS_TONES[row.status]} />
              },
              { key: "createdAt", title: "Creado", render: (row: PaymentLink) => longDate(row.createdAt) },
              { key: "expiresAt", title: "Vence", render: (row: PaymentLink) => longDate(row.expiresAt) },
              { key: "amount", title: "Monto", render: (row: PaymentLink) => money(row.amount) }
            ]}
          />
        )}
      </div>
    </div>
  );
}
