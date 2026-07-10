import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useTreatmentMutations, useTreatmentPlans } from "../hooks/use-treatments";
import type { TreatmentPlanStatus } from "../services/treatments.service";

const STATUS_OPTIONS: TreatmentPlanStatus[] = ["DRAFT", "PRESENTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"];
const CLOSED_PLAN_STATUSES = new Set<TreatmentPlanStatus>(["CANCELLED", "REJECTED"]);

export function TreatmentPlansPage() {
  const { branchId, setBranchId } = useActiveBranchFilter();
  const [status, setStatus] = useState<TreatmentPlanStatus | "">("");
  const [patientId, setPatientId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const plans = useTreatmentPlans({
    branchId: branchId || undefined,
    status: status || undefined,
    patientId: patientId || undefined
  });
  const mutations = useTreatmentMutations();

  const selected = useMemo(() => plans.data?.find((plan) => plan.id === selectedPlanId) ?? null, [plans.data, selectedPlanId]);
  const selectedIsClosed = selected ? CLOSED_PLAN_STATUSES.has(selected.status) : false;

  if (plans.isLoading) return <LoadingState message="Cargando planes de tratamiento..." />;
  if (plans.isError) return <ErrorState message={plans.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planes de tratamiento"
        description="Gestión central de planes, alternativas y conversión a presupuestos."
        helpText="Los planes de tratamiento agrupan las fases, el diagnóstico dental y las prestaciones propuestas para resolver las necesidades del paciente. Permiten estructurar diferentes alternativas clínicas antes de generar el presupuesto financiero final."
      />

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        {/* Filtro paciente */}
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Filtrar por pacienteId"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            className="flex-1"
          />
          <HelpTooltip content="Filtra los planes de tratamiento ingresando el ID del paciente para encontrar rápidamente su historial de propuestas clínicas." />
        </div>

        {/* Filtro sucursal */}
        <div className="flex items-center gap-1.5">
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="flex-1">
            <option value="">Sucursal activa</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <HelpTooltip content="Filtra los planes creados en una sucursal específica. Solo verás las sucursales a las que tienes acceso asignado según tu perfil de usuario." />
        </div>

        {/* Filtro estado */}
        <div className="flex items-center gap-1.5">
          <Select value={status} onChange={(event) => setStatus((event.target.value as TreatmentPlanStatus) || "")} className="flex-1">
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <HelpTooltip content="Filtra según la etapa clínica del plan: DRAFT (Borrador), PRESENTED (Presentado al paciente), ACCEPTED (Aprobado), IN_PROGRESS (En ejecución activa en citas), COMPLETED (Tratamiento finalizado), CANCELLED o REJECTED." />
        </div>

        {/* Crear desde paciente */}
        <div className="flex items-center justify-end gap-1.5">
          <HelpTooltip content="Para iniciar un plan de tratamiento, ve a la ficha de un paciente desde el módulo de Pacientes y presiona 'Crear Plan'. Esto asociará el plan directamente a su expediente clínico." />
          <Link to="/patients">
            <Button variant="secondary">Crear desde paciente</Button>
          </Link>
        </div>
      </div>

      <DataTable
        rows={plans.data ?? []}
        stickyFirstColumn={true}
        stickyLastColumn={true}
        responsiveCards={true}
        empty={<EmptyState title="Sin planes" description="No hay planes para los filtros seleccionados." />}
        columns={[
          {
            key: "name",
            title: "Plan",
            render: (row) => (
              <div>
                <p className="font-medium text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-500">{row.patient.firstName} {row.patient.lastName}</p>
              </div>
            )
          },
          { key: "branch", title: "Sucursal", render: (row) => row.branch.name },
          { key: "professional", title: "Profesional", render: (row) => `${row.professional.firstName} ${row.professional.lastName}` },
          {
            key: "status",
            title: (
              <span className="flex items-center gap-1.5">
                Estado
                <HelpTooltip content="Estado actual del plan dentro del flujo clínico. Un plan en IN_PROGRESS permite registrar evoluciones en cada cita de atención." />
              </span>
            ),
            render: (row) => <Badge value={row.status} tone={row.status === "ACCEPTED" || row.status === "COMPLETED" ? "success" : "warning"} />
          },
          {
            key: "id",
            title: (
              <span className="flex items-center gap-1.5">
                Acciones
                <HelpTooltip content="'Ver detalle' muestra el desglose de prestaciones y presupuestos del plan. 'Generar presupuesto' crea una propuesta económica formal a partir de las prestaciones del plan para enviar al paciente." />
              </span>
            ),
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setSelectedPlanId(row.id)}>
                  Ver detalle
                </Button>
                <Button
                  disabled={CLOSED_PLAN_STATUSES.has(row.status)}
                  onClick={() => mutations.createBudget.mutate({ treatmentPlanId: row.id })}
                >
                  Generar presupuesto
                </Button>
              </div>
            )
          }
        ]}
      />

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{selected.name}</h3>
              <p className="text-sm text-slate-600">{selected.description || "Sin descripción"}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  disabled={selectedIsClosed}
                  onClick={() => mutations.updateTreatmentPlan.mutate({ id: selected.id, payload: { status: "PRESENTED" } })}
                >
                  Marcar presentado
                </Button>
                <HelpTooltip content="Cambia el estado del plan a 'Presentado' para registrar que las opciones clínicas y el presupuesto fueron formalmente explicados y mostrados al paciente en consulta." />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  disabled={selectedIsClosed}
                  onClick={() => mutations.updateTreatmentPlan.mutate({ id: selected.id, payload: { status: "IN_PROGRESS" } })}
                >
                  Iniciar
                </Button>
                <HelpTooltip content="Cambia el estado a 'En Progreso'. Activa el plan para que puedas registrar evoluciones clínicas de cada pieza dental tratada en las siguientes citas de atención." />
              </div>
              {selectedIsClosed ? (
                <Button
                  variant="secondary"
                  disabled={mutations.reactivateTreatmentPlan.isPending}
                  onClick={() => mutations.reactivateTreatmentPlan.mutate({ id: selected.id })}
                >
                  Reactivar
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={selected.status === "COMPLETED" || mutations.deactivateTreatmentPlan.isPending}
                  onClick={() => mutations.deactivateTreatmentPlan.mutate({ id: selected.id })}
                >
                  Deshabilitar
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <p className="text-sm text-slate-600">Items: {selected.itemsCount ?? 0} | Presupuestos: {selected.budgetCount ?? 0}</p>
            <HelpTooltip content="'Items' indica el número de prestaciones clínicas (ej. resina, extracción, corona) incluidas en este plan. 'Presupuestos' muestra cuántas propuestas económicas se han generado desde él para este paciente." />
          </div>
        </div>
      ) : null}
    </div>
  );
}
