import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
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

        <div className="grid gap-3 xl:grid-cols-[minmax(260px,360px)_1fr_minmax(220px,260px)]">
          <label className="text-sm font-medium text-slate-700">
            Laboratorio
            <Select className="mt-1" value={labProviderId} onChange={(event) => setLabProviderId(event.target.value)}>
              <option value="">Todos los laboratorios</option>
              {providers.data?.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </Select>
          </label>

          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${viewMeta.bgClass} ${viewMeta.borderClass}`}>
            <span className={`h-3 w-3 rounded-full ${viewMeta.dotClass}`} />
            <div>
              <p className={`text-sm font-semibold ${viewMeta.textClass}`}>Solicitudes: {viewMeta.plural}</p>
              <p className="text-xs text-slate-500">Estado seleccionado para esta vista</p>
            </div>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Mostrar
            <Select
              className="mt-1"
              value={view}
              onChange={(event) => navigate(`/labs/orders?view=${event.target.value}`)}
            >
              {(Object.keys(LAB_REQUEST_STATE_META) as LabRequestView[]).map((option) => (
                <option key={option} value={option}>
                  {LAB_REQUEST_STATE_META[option].label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {orders.isLoading ? (
          <LoadingState message="Cargando solicitudes de laboratorio..." />
        ) : !visibleOrders.length ? (
          <EmptyState title="Sin solicitudes" description="No hay solicitudes para esta etapa del flujo." />
        ) : (
          <div className={`overflow-x-auto rounded-2xl border ${viewMeta.borderClass}`}>
            <div className={`border-b px-5 py-3 ${viewMeta.bgClass} ${viewMeta.borderClass}`}>
              <h2 className="text-base font-semibold text-slate-900">Solicitudes: {viewMeta.plural}</h2>
            </div>
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
                    <td className="px-4 py-4"><StatusPill status={order.status} /></td>
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
