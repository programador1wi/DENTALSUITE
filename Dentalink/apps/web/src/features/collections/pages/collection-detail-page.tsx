import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import { useCollectionCase, useCollectionMutations } from "../hooks/use-collections";
import type { CollectionCaseStatus } from "../services/collections.service";

const STATUS_OPTIONS: CollectionCaseStatus[] = ["PENDING", "CONTACTED", "PROMISE_TO_PAY", "PAID", "UNCOLLECTIBLE", "CANCELLED"];

export function CollectionDetailPage() {
  const { id = "" } = useParams();
  const details = useCollectionCase(id);
  const users = useUsersQuery(undefined, "ACTIVE");
  const mutations = useCollectionMutations();

  const [status, setStatus] = useState<CollectionCaseStatus | "">("");
  const [assignTo, setAssignTo] = useState("");
  const [channel, setChannel] = useState("PHONE");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");

  const saveStatus = () => {
    if (!status) return;
    mutations.updateStatus.mutate({ id, status });
  };

  const saveAssignment = () => {
    if (!assignTo) return;
    mutations.assignCase.mutate({ id, assignedToId: assignTo });
  };

  const saveActivity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!channel || !result.trim()) return;
    mutations.addActivity.mutate({
      id,
      channel,
      result: result.trim(),
      notes: notes || undefined,
      nextActionAt: nextActionAt || undefined
    });
  };

  if (details.isLoading) return <LoadingState message="Cargando caso..." />;
  if (details.isError) return <ErrorState message={details.error.message} />;
  if (!details.data) return <EmptyState title="Caso no encontrado" description="No fue posible cargar el caso de cobranza." />;

  const row = details.data;

  return (
    <div className="space-y-4">
      <PageHeader 
        title={`Caso de cobranza ${row.id}`} 
        description="Seguimiento de morosidad y actividades de contacto." 
        helpText="Panel detallado para la gestión del caso de morosidad. Registra los cambios de estado del cobro, reasigna responsables y añade bitácoras de actividades (llamadas, emails o WhatsApp) para documentar el progreso de la cobranza."
      />

      <Card className="grid gap-3 md:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            Paciente
            <HelpTooltip content="Paciente titular del saldo vencido y receptor de las gestiones de cobranza." />
          </p>
          <p className="font-medium text-slate-900">{row.patient.firstName} {row.patient.lastName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            Monto adeudado
            <HelpTooltip content="Monto de la cuota o saldo total actualmente impago." />
          </p>
          <p className="font-medium text-rose-700">{row.amountDue}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            Dias vencido
            <HelpTooltip content="Días acumulados desde la fecha original programada de vencimiento de pago." />
          </p>
          <p className="font-medium text-slate-900">{row.daysOverdue}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 flex items-center gap-1">
            Estado
            <HelpTooltip content="Estado de la gestión de cobro en el sistema." />
          </p>
          <Badge value={row.status} tone={row.status === "PAID" ? "success" : row.status === "UNCOLLECTIBLE" ? "danger" : "warning"} />
        </div>
      </Card>

      <Card className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-1.5 md:col-span-2">
          <div className="flex-1">
            <Select value={status} onChange={(event) => setStatus((event.target.value as CollectionCaseStatus) || "")}>
              <option value="">Cambiar estado</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <HelpTooltip content="Actualiza la etapa del proceso de cobro (PENDING: Pendiente de contacto, CONTACTED: Contactado, PROMISE_TO_PAY: Promesa de pago registrada, PAID: Deuda saldada, UNCOLLECTIBLE: Deuda incobrable o CANCELLED: Cancelado)." />
        </div>
        <Button onClick={saveStatus} disabled={!status || mutations.updateStatus.isPending}>
          Actualizar estado
        </Button>

        <div className="flex items-center gap-1.5 md:col-span-2">
          <div className="flex-1">
            <Select value={assignTo} onChange={(event) => setAssignTo(event.target.value)}>
              <option value="">Reasignar responsable</option>
              {users.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </Select>
          </div>
          <HelpTooltip content="Transfiere la responsabilidad de cobro de este paciente a otro gestor o administrativo de la sucursal." />
        </div>
        <Button onClick={saveAssignment} disabled={!assignTo || mutations.assignCase.isPending}>
          Reasignar
        </Button>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          Registrar actividad de contacto
          <HelpTooltip content="Documenta el resultado de la comunicación con el paciente (ej. llamada telefónica, mensaje o envío de correos)." />
        </h3>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={saveActivity}>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input placeholder="Canal (PHONE/WHATSAPP/EMAIL)" value={channel} onChange={(event) => setChannel(event.target.value)} />
            </div>
            <HelpTooltip content="Medio por el cual se estableció comunicación con el paciente." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input placeholder="Resultado" value={result} onChange={(event) => setResult(event.target.value)} />
            </div>
            <HelpTooltip content="Resumen breve de la respuesta del deudor (ej: Contesta llamada, Número equivocado, Solicita descuento)." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input type="datetime-local" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} />
            </div>
            <HelpTooltip content="Fecha y hora programada para el siguiente contacto preventivo." />
          </div>
          <div className="md:col-span-3 flex items-start gap-1.5">
            <div className="flex-1">
              <Textarea placeholder="Notas de seguimiento" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="pt-2">
              <HelpTooltip content="Comentarios específicos y acuerdos detallados alcanzados con el deudor." />
            </div>
          </div>
          <Button type="submit" className="md:col-span-3" disabled={mutations.addActivity.isPending}>
            Registrar actividad
          </Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Historial de actividades</h3>
        {row.activities.length ? (
          row.activities.map((activity) => (
            <div key={activity.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge value={activity.channel} />
                <span className="font-medium text-slate-900">{activity.result}</span>
                <span className="text-slate-500">{new Date(activity.createdAt).toLocaleString()}</span>
              </div>
              {activity.notes ? <p className="mt-2 text-sm text-slate-700">{activity.notes}</p> : null}
              {activity.nextActionAt ? <p className="mt-1 text-xs text-slate-500">Proxima accion: {new Date(activity.nextActionAt).toLocaleString()}</p> : null}
            </div>
          ))
        ) : (
          <EmptyState title="Sin actividades" description="Aun no se han registrado contactos para este caso." />
        )}
      </Card>
    </div>
  );
}
