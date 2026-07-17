import { NavLink, Outlet, useParams } from "react-router-dom";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { cn } from "@/lib/utils/cn";
import { usePatientOnlineBenefits, usePatientReimbursementRequests } from "@/features/payments/hooks/use-payments";
import { dateOnly, money } from "./shared-helpers";

export function CoverageLayout() {
  const { id = "" } = useParams();
  const tabs = [
    { to: `/patients/${id}/billing/coverages/reimbursements`, label: "Solicitudes de reembolso", icon: FileCheck2 },
    { to: `/patients/${id}/billing/coverages/online-benefits`, label: "Bonificaciones en linea", icon: ShieldCheck }
  ];

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 border-r border-slate-200 px-4 py-3 text-sm font-semibold transition",
                    isActive
                      ? "bg-white text-[#0879d5] shadow-[inset_0_-3px_0_#0879d5]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>
      <Outlet />
    </div>
  );
}

export function ReimbursementRequestsView() {
  const { id = "" } = useParams();
  const requests = usePatientReimbursementRequests(id);

  if (requests.isLoading) return <LoadingState message="Cargando solicitudes de reembolso..." />;
  if (requests.isError) return <ErrorState message={requests.error.message} />;

  const rows = requests.data ?? [];
  const requested = rows.reduce((sum, row) => sum + Number(row.requestedAmount ?? 0), 0);
  const approved = rows.reduce((sum, row) => sum + Number(row.approvedAmount ?? 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.paidAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Solicitudes de reembolso</h2>
        <p className="text-sm text-slate-500">Tramites de aseguradora que no mueven caja ni reducen saldo al crearse.</p>
      </div>
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <CoverageMetric label="Solicitado" value={money(requested)} />
        <CoverageMetric label="Aprobado" value={money(approved)} />
        <CoverageMetric label="Pagado por tercero" value={money(paid)} />
      </Card>
      <DataTable
        rows={rows}
        empty={<EmptyState title="No existen solicitudes de reembolso." description="No hay tramites de reembolso registrados para este paciente." />}
        columns={[
          { key: "createdAt", title: "Fecha", render: (row) => dateOnly(row.createdAt) },
          { key: "agreement", title: "Aseguradora / convenio", render: (row) => row.agreement?.name ?? "-" },
          { key: "policyNumber", title: "Poliza", render: (row) => row.policyNumber ?? "-" },
          { key: "requestedAmount", title: "Solicitado", render: (row) => money(row.requestedAmount) },
          { key: "approvedAmount", title: "Aprobado", render: (row) => money(row.approvedAmount) },
          { key: "paidAmount", title: "Liquidado", render: (row) => money(row.paidAmount) },
          { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={coverageTone(row.status)} /> }
        ]}
      />
    </div>
  );
}

export function OnlineBenefitsView() {
  const { id = "" } = useParams();
  const benefits = usePatientOnlineBenefits(id);

  if (benefits.isLoading) return <LoadingState message="Cargando bonificaciones en linea..." />;
  if (benefits.isError) return <ErrorState message={benefits.error.message} />;

  const rows = benefits.data ?? [];
  const estimated = rows.reduce((sum, row) => sum + Number(row.requestedAmount ?? 0), 0);
  const authorized = rows.reduce((sum, row) => sum + Number(row.authorizedAmount ?? 0), 0);
  const settled = rows.reduce((sum, row) => sum + Number(row.consumedAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Bonificaciones en linea</h2>
        <p className="text-sm text-slate-500">Autorizaciones electronicas separadas de efectivo recibido y copagos.</p>
      </div>
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <CoverageMetric label="Bonificacion estimada" value={money(estimated)} />
        <CoverageMetric label="Bonificacion autorizada" value={money(authorized)} />
        <CoverageMetric label="Liquidado por tercero" value={money(settled)} />
      </Card>
      <DataTable
        rows={rows}
        empty={<EmptyState title="No existen bonificaciones en linea." description="No hay autorizaciones electronicas registradas para este paciente." />}
        columns={[
          { key: "createdAt", title: "Fecha", render: (row) => dateOnly(row.createdAt) },
          { key: "coverageCase", title: "Proveedor / convenio", render: (row) => row.coverageCase.agreement?.name ?? "-" },
          { key: "treatmentPlan", title: "Plan", render: (row) => row.treatmentPlan?.name ?? "-" },
          { key: "requestedAmount", title: "Estimado", render: (row) => money(row.requestedAmount) },
          { key: "authorizedAmount", title: "Autorizado", render: (row) => money(row.authorizedAmount) },
          { key: "consumedAmount", title: "Liquidado", render: (row) => money(row.consumedAmount) },
          { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={coverageTone(row.status)} /> }
        ]}
      />
    </div>
  );
}

function CoverageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function coverageTone(status: string) {
  if (["AUTHORIZED", "PARTIALLY_AUTHORIZED", "SETTLED", "APPROVED", "PAID"].includes(status)) return "success";
  if (["REJECTED", "EXPIRED", "CANCELLED", "ERROR", "INTEGRATION_ERROR"].includes(status)) return "danger";
  return "warning";
}
