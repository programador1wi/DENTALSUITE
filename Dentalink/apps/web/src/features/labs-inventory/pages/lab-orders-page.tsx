import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { TableActionGroup, TableToolbar } from "@/components/ui/table-toolbar";
import { APP_ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  LAB_REQUEST_STATE_META,
  LabInfoBanner,
  LabsPrimaryAction,
  LabsWorkspace,
  type LabRequestView
} from "../components/labs-workspace";
import { useLabOrders, useLabProviders, useLabsInventoryMutations } from "../hooks/use-labs-inventory";
import type { LabOrder, LabOrderStatus } from "../services/labs-inventory.service";

const STATUS_OPTIONS: LabOrderStatus[] = ["REQUESTED", "SENT", "IN_PROCESS", "RECEIVED", "DELIVERED", "CANCELLED"];

function asView(value: string | null): LabRequestView {
  if (value === "process" || value === "review" || value === "finished") return value;
  return "pending";
}

function visibleInView(order: LabOrder, view: LabRequestView) {
  if (view === "pending") return order.status === "REQUESTED";
  if (view === "process") return order.status === "SENT" || order.status === "IN_PROCESS";
  if (view === "review") return order.status === "RECEIVED";
  return order.status === "DELIVERED";
}

function statusLabel(status: LabOrderStatus) {
  if (status === "REQUESTED") return "Pendiente";
  if (status === "SENT" || status === "IN_PROCESS") return "En proceso";
  if (status === "RECEIVED") return "En revision";
  if (status === "DELIVERED") return "Finalizada";
  return "Cancelada";
}

function viewForStatus(status: LabOrderStatus): LabRequestView | "cancelled" {
  if (status === "REQUESTED") return "pending";
  if (status === "SENT" || status === "IN_PROCESS") return "process";
  if (status === "RECEIVED") return "review";
  if (status === "DELIVERED") return "finished";
  return "cancelled";
}

function StatusPill({ status }: { status: LabOrderStatus }) {
  const view = viewForStatus(status);
  const meta =
    view === "cancelled"
      ? {
          dotClass: "bg-red-500",
          textClass: "text-red-700",
          bgClass: "bg-red-50",
          borderClass: "border-red-200"
        }
      : LAB_REQUEST_STATE_META[view];

  return (
    <span
      className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${meta.bgClass} ${meta.borderClass} ${meta.textClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
      {statusLabel(status)}
    </span>
  );
}

export function LabOrdersPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const view = asView(params.get("view"));
  const viewMeta = LAB_REQUEST_STATE_META[view];
  const [labProviderId, setLabProviderId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [treatmentPlanId, setTreatmentPlanId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [newLabProviderId, setNewLabProviderId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const providers = useLabProviders(undefined, "true");
  const orders = useLabOrders({ labProviderId: labProviderId || undefined });
  const mutations = useLabsInventoryMutations();
  const visibleOrders = useMemo(
    () => (orders.data ?? []).filter((order) => visibleInView(order, view)),
    [orders.data, view]
  );

  if (orders.isError) return <ErrorState message={orders.error.message} />;

  return (
    <LabsWorkspace
      title={`Solicitudes: ${viewMeta.plural}`}
      description="Seguimiento de trabajos enviados a laboratorio."
      action={<LabsPrimaryAction onClick={() => setModalOpen(true)}>Nueva solicitud</LabsPrimaryAction>}
    >
      <div className="space-y-4">
        <LabInfoBanner>
          Las solicitudes se agrupan como en Warner Suite: pendiente, en proceso, en revision y finalizada.
        </LabInfoBanner>

        <TableToolbar
          filters={
            <>
              <label className="min-w-56 flex-1 text-[var(--text-sm)] font-medium text-[var(--text-primary)] lg:flex-none">
                Laboratorio
                <Select className="mt-1" value={labProviderId} onChange={(event) => setLabProviderId(event.target.value)}>
                  <option value="">Todos los laboratorios</option>
                  {providers.data?.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </Select>
              </label>
              <label className="min-w-56 flex-1 text-[var(--text-sm)] font-medium text-[var(--text-primary)] lg:flex-none">
                Mostrar
                <Select className="mt-1" value={view} onChange={(event) => navigate(`${APP_ROUTES.laboratories.orders}?view=${event.target.value}`)}>
                  {(Object.keys(LAB_REQUEST_STATE_META) as LabRequestView[]).map((option) => (
                    <option key={option} value={option}>{LAB_REQUEST_STATE_META[option].label}</option>
                  ))}
                </Select>
              </label>
            </>
          }
          actions={
            <div className={`flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border px-[var(--space-3)] ${viewMeta.bgClass} ${viewMeta.borderClass}`}>
              <span className={`h-2 w-2 rounded-full ${viewMeta.dotClass}`} />
              <span className={`text-[var(--text-sm)] font-semibold ${viewMeta.textClass}`}>Solicitudes: {viewMeta.plural}</span>
            </div>
          }
        />

        {orders.isLoading ? (
          <LoadingState message="Cargando solicitudes de laboratorio..." />
        ) : !visibleOrders.length ? (
          <EmptyState title="Sin solicitudes" description="No hay solicitudes para esta etapa del flujo." />
        ) : (
          <DataTable
            rows={visibleOrders}
            getRowKey={(order) => order.id}
            empty={<EmptyState title="Sin solicitudes" description="No hay solicitudes para esta etapa del flujo." />}
            columns={[
              { key: "id", title: "Solicitud", primary: true, cellClassName: "font-semibold text-[var(--text-brand-strong)]", render: (order) => order.id.slice(-8).toUpperCase() },
              { key: "patientId", title: "Paciente", wrap: true, render: (order) => order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : order.patientId },
              { key: "labProviderId", title: "Laboratorio", wrap: true, render: (order) => order.labProvider?.name ?? order.labProviderId },
              { key: "status", title: "Estado", render: (order) => <StatusPill status={order.status} /> },
              { key: "cost", title: "Costo", render: (order) => order.cost ?? "-" },
              { key: "expectedAt", title: "Entrega esperada", render: (order) => order.expectedAt ? new Date(order.expectedAt).toLocaleDateString() : "-" },
              {
                key: "id",
                title: "Opciones",
                actions: true,
                headerClassName: "text-right",
                render: (order) => (
                  <TableActionGroup>
                    {nextStatuses(order.status).map((status) => (
                      <Button key={status} variant="secondary" onClick={() => mutations.updateLabOrderStatus.mutate({ id: order.id, status })}>
                        {statusLabel(status)}
                      </Button>
                    ))}
                  </TableActionGroup>
                )
              }
            ]}
          />
        )}
      </div>

      <Modal open={modalOpen} title="Nueva solicitud de laboratorio" onClose={() => setModalOpen(false)}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Patient ID" value={patientId} onChange={(event) => setPatientId(event.target.value)} />
            <Input placeholder="Professional ID" value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} />
          </div>
          <Select value={newLabProviderId} onChange={(event) => setNewLabProviderId(event.target.value)}>
            <option value="">Selecciona laboratorio</option>
            {providers.data?.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Treatment Plan ID (opcional)" value={treatmentPlanId} onChange={(event) => setTreatmentPlanId(event.target.value)} />
            <Input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} />
          </div>
          <Input placeholder="Costo" value={cost} onChange={(event) => setCost(event.target.value)} />
          <Input placeholder="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                mutations.createLabOrder.mutate({
                  patientId,
                  treatmentPlanId: treatmentPlanId || undefined,
                  professionalId,
                  labProviderId: newLabProviderId,
                  expectedAt: expectedAt || undefined,
                  cost: cost ? Number(cost) : undefined,
                  notes: notes || undefined
                }, { onSuccess: () => setModalOpen(false) });
              }}
              disabled={!patientId || !professionalId || !newLabProviderId || mutations.createLabOrder.isPending}
            >
              Crear solicitud
            </Button>
          </div>
        </div>
      </Modal>
    </LabsWorkspace>
  );
}

function nextStatuses(status: LabOrderStatus) {
  if (status === "REQUESTED") return ["SENT"] as LabOrderStatus[];
  if (status === "SENT") return ["IN_PROCESS"] as LabOrderStatus[];
  if (status === "IN_PROCESS") return ["RECEIVED"] as LabOrderStatus[];
  if (status === "RECEIVED") return ["DELIVERED"] as LabOrderStatus[];
  return STATUS_OPTIONS.filter((option) => option !== status).slice(0, 1);
}
