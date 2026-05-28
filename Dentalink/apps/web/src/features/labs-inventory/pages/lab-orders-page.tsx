import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { LabInfoBanner, LabsPrimaryAction, LabsWorkspace } from "../components/labs-workspace";
import { useLabOrders, useLabProviders, useLabsInventoryMutations } from "../hooks/use-labs-inventory";
import type { LabOrder, LabOrderStatus } from "../services/labs-inventory.service";

type RequestsView = "pending" | "process" | "review" | "finished";

const STATUS_OPTIONS: LabOrderStatus[] = ["REQUESTED", "SENT", "IN_PROCESS", "RECEIVED", "DELIVERED", "CANCELLED"];

const viewLabels: Record<RequestsView, string> = {
  pending: "Pendientes",
  process: "En proceso",
  review: "En revision",
  finished: "Finalizadas"
};

function asView(value: string | null): RequestsView {
  if (value === "process" || value === "review" || value === "finished") return value;
  return "pending";
}

function visibleInView(order: LabOrder, view: RequestsView) {
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

function statusTone(status: LabOrderStatus) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "warning" as const;
}

export function LabOrdersPage() {
  const [params] = useSearchParams();
  const view = asView(params.get("view"));
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
      title={`Solicitudes ${viewLabels[view].toLowerCase()}`}
      description="Seguimiento de trabajos enviados a laboratorio."
      action={<LabsPrimaryAction onClick={() => setModalOpen(true)}>Nueva solicitud</LabsPrimaryAction>}
    >
      <div className="space-y-4">
        <LabInfoBanner>
          Las solicitudes se agrupan como en Warner Suite: pendiente, en proceso, en revision y finalizada.
        </LabInfoBanner>

        <div className="grid gap-3 md:grid-cols-[minmax(240px,320px)_1fr]">
          <Select value={labProviderId} onChange={(event) => setLabProviderId(event.target.value)}>
            <option value="">Todos los laboratorios</option>
            {providers.data?.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </Select>
          <div className="flex items-center rounded-xl bg-slate-50 px-3 text-sm text-slate-600">
            Vista actual: <strong className="ml-1">{viewLabels[view]}</strong>
          </div>
        </div>

        {orders.isLoading ? (
          <LoadingState message="Cargando solicitudes de laboratorio..." />
        ) : !visibleOrders.length ? (
          <EmptyState title="Sin solicitudes" description="No hay solicitudes para esta etapa del flujo." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full border-collapse bg-white text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Solicitud</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Laboratorio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Entrega esperada</th>
                  <th className="px-4 py-3 text-right">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">{order.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-4">
                      {order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : order.patientId}
                    </td>
                    <td className="px-4 py-4">{order.labProvider?.name ?? order.labProviderId}</td>
                    <td className="px-4 py-4"><Badge value={statusLabel(order.status)} tone={statusTone(order.status)} /></td>
                    <td className="px-4 py-4">{order.cost ?? "-"}</td>
                    <td className="px-4 py-4">{order.expectedAt ? new Date(order.expectedAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {nextStatuses(order.status).map((status) => (
                          <Button
                            key={status}
                            variant="secondary"
                            onClick={() => mutations.updateLabOrderStatus.mutate({ id: order.id, status })}
                          >
                            {statusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
