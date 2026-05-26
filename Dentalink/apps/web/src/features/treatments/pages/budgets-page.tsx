import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useBudgets, useTreatmentMutations } from "../hooks/use-treatments";
import type { BudgetStatus } from "../services/treatments.service";

const STATUS_OPTIONS: BudgetStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];

export function BudgetsPage() {
  const [status, setStatus] = useState<BudgetStatus | "">("");
  const [patientId, setPatientId] = useState("");

  const budgets = useBudgets({
    status: status || undefined,
    patientId: patientId || undefined
  });
  const mutations = useTreatmentMutations();

  if (budgets.isLoading) return <LoadingState message="Cargando presupuestos..." />;
  if (budgets.isError) return <ErrorState message={budgets.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Presupuestos"
        description="Envío, aceptación y rechazo de presupuestos clínicos."
        helpText="Los presupuestos son propuestas económicas de tratamientos clínicos que se envían al paciente. Desde aquí puedes enviar planes por correo, registrar la aceptación, marcarlos como rechazados o imprimirlos en formato físico formal."
      />

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Filtrar por pacienteId"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            className="flex-1"
          />
          <HelpTooltip content="Filtra el listado de presupuestos ingresando el ID único del paciente para encontrar rápidamente sus propuestas económicas." />
        </div>

        <div className="flex items-center gap-1.5">
          <Select
            value={status}
            onChange={(event) => setStatus((event.target.value as BudgetStatus) || "")}
            className="flex-1"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <HelpTooltip content="Filtra los presupuestos por su estado en el ciclo de vida: DRAFT (Borrador sin enviar), SENT (Enviado al paciente), ACCEPTED (Aprobado), REJECTED (Rechazado por el paciente), EXPIRED (Venció sin respuesta), CANCELLED (Cancelado por la clínica)." />
        </div>
      </div>

      <DataTable
        rows={budgets.data ?? []}
        empty={<EmptyState title="Sin presupuestos" description="No hay presupuestos para los filtros seleccionados." />}
        columns={[
          {
            key: "id",
            title: "Presupuesto",
            render: (row) => (
              <div>
                <p className="font-medium text-slate-900">{row.id.slice(0, 10)}</p>
                <p className="text-xs text-slate-500">{row.patient.firstName} {row.patient.lastName}</p>
              </div>
            )
          },
          {
            key: "total",
            title: (
              <span className="flex items-center gap-1.5">
                Total
                <HelpTooltip content="Monto total del arancel calculado para todas las prestaciones incluidas en el presupuesto, antes de aplicar descuentos o seguros." />
              </span>
            ),
            render: (row) => (
              <div className="flex flex-col items-start gap-0.5">
                {Number(row.discountTotal) > 0 && (
                  <span className="text-xs text-slate-400 line-through">
                    ${Number(row.subtotal).toLocaleString()}
                  </span>
                )}
                <span className="font-medium text-slate-900">
                  ${Number(row.total).toLocaleString()}
                </span>
                {Number(row.discountTotal) > 0 && (
                  <div className="mt-1">
                    <Badge value="Convenio / Dcto" tone="success" />
                  </div>
                )}
              </div>
            )
          },
          {
            key: "status",
            title: (
              <span className="flex items-center gap-1.5">
                Estado
                <HelpTooltip content="Estado actual del presupuesto dentro del flujo de aprobación clínico-financiero." />
              </span>
            ),
            render: (row) => (
              <Badge
                value={row.status}
                tone={row.status === "ACCEPTED" ? "success" : row.status === "REJECTED" ? "danger" : "warning"}
              />
            )
          },
          {
            key: "id",
            title: (
              <span className="flex items-center gap-1.5">
                Acciones
                <HelpTooltip content="Acciones disponibles: 'Enviar' remite el presupuesto al paciente, 'Aceptar' lo aprueba e inicia el plan de tratamiento, 'Rechazar' registra la negativa del paciente, e 'Imprimir' genera la hoja membretada para firma física." />
              </span>
            ),
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {row.status === "DRAFT" ? (
                  <Button variant="secondary" onClick={() => mutations.sendBudget.mutate(row.id)}>
                    Enviar
                  </Button>
                ) : null}
                {(row.status === "DRAFT" || row.status === "SENT") ? (
                  <Button onClick={() => mutations.acceptBudget.mutate(row.id)}>Aceptar</Button>
                ) : null}
                {(row.status === "DRAFT" || row.status === "SENT") ? (
                  <Button variant="danger" onClick={() => mutations.rejectBudget.mutate(row.id)}>
                    Rechazar
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => mutations.printBudget.mutate(row.id)}>
                  Imprimir
                </Button>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
