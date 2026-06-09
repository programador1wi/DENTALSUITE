import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import { useCollectionCases, useCollectionMutations } from "../hooks/use-collections";
import type { CollectionCaseStatus } from "../services/collections.service";

const STATUS_OPTIONS: CollectionCaseStatus[] = ["PENDING", "CONTACTED", "PROMISE_TO_PAY", "PAID", "UNCOLLECTIBLE", "CANCELLED"];

export function CollectionsPage() {
  const [status, setStatus] = useState<CollectionCaseStatus | "">("");
  const { branchId, setBranchId } = useActiveBranchFilter();
  const [assignedToId, setAssignedToId] = useState("");
  const [detectDays, setDetectDays] = useState("1");

  const [newPatientId, setNewPatientId] = useState("");
  const [newInstallmentId, setNewInstallmentId] = useState("");
  const [newTreatmentPlanId, setNewTreatmentPlanId] = useState("");
  const [newAmountDue, setNewAmountDue] = useState("");
  const [newDaysOverdue, setNewDaysOverdue] = useState("1");
  const [newAssignedToId, setNewAssignedToId] = useState("");
  const [newNextContactAt, setNewNextContactAt] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const users = useUsersQuery(undefined, "ACTIVE", branchId || undefined);
  const cases = useCollectionCases({
    status: status || undefined,
    branchId: branchId || undefined,
    assignedToId: assignedToId || undefined
  });
  const mutations = useCollectionMutations();

  const runDetect = () => {
    mutations.detectOverdue.mutate({
      minDaysOverdue: Number(detectDays) > 0 ? Number(detectDays) : 1,
      branchId: branchId || undefined,
      assignedToId: assignedToId || undefined
    });
  };

  const handleCreateCase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPatientId || !newAssignedToId || Number(newAmountDue) <= 0) return;
    mutations.createCase.mutate({
      patientId: newPatientId.trim(),
      installmentId: newInstallmentId || undefined,
      treatmentPlanId: newTreatmentPlanId || undefined,
      amountDue: Number(newAmountDue),
      daysOverdue: Number(newDaysOverdue) >= 0 ? Number(newDaysOverdue) : 0,
      assignedToId: newAssignedToId,
      nextContactAt: newNextContactAt || undefined
    });
  };

  if (cases.isLoading) return <LoadingState message="Cargando morosidad..." />;
  if (cases.isError) return <ErrorState message={cases.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Morosidad y cobranza" 
        description="Control de saldos vencidos y seguimiento de cobranza." 
        helpText="Módulo de control preventivo de cartera morosa. Permite auditar y detectar automáticamente pacientes con saldos vencidos para asignarlos a gestores de cobranza y dar un seguimiento estructurado."
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input type="number" min="1" value={detectDays} onChange={(event) => setDetectDays(event.target.value)} placeholder="Min dias vencido" />
            </div>
            <HelpTooltip content="Define la antigüedad mínima en días que debe tener un saldo vencido para ser detectado como caso de morosidad." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">Sucursal activa</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <HelpTooltip content="Filtra los casos de morosidad pertenecientes a una sucursal clínica específica." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                <option value="">Asignado a (filtro)</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <HelpTooltip content="Filtra los casos según el gestor o administrativo encargado de realizar el cobro." />
          </div>
          <div className="flex items-center gap-1.5 md:col-span-2">
            <div className="flex-1">
              <Button onClick={runDetect} className="w-full" disabled={mutations.detectOverdue.isPending}>
                Detectar vencidos
              </Button>
            </div>
            <HelpTooltip content="Analiza la base de datos de cuotas y saldos impagos para consolidar nuevos casos de cobranza automática." />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          Crear caso de cobranza manual
          <HelpTooltip content="Crea un caso de morosidad de forma manual ingresando los identificadores correspondientes del paciente y sus saldos." />
        </h3>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={handleCreateCase}>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input placeholder="patientId" value={newPatientId} onChange={(event) => setNewPatientId(event.target.value)} />
            </div>
            <HelpTooltip content="Identificador único del paciente deudor." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input placeholder="installmentId (opcional)" value={newInstallmentId} onChange={(event) => setNewInstallmentId(event.target.value)} />
            </div>
            <HelpTooltip content="Asocia una cuota específica del plan de cuotas si aplica." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input placeholder="treatmentPlanId (opcional)" value={newTreatmentPlanId} onChange={(event) => setNewTreatmentPlanId(event.target.value)} />
            </div>
            <HelpTooltip content="Asocia un plan de tratamiento específico para la cobranza." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input type="number" min="0.01" step="0.01" placeholder="Monto adeudado" value={newAmountDue} onChange={(event) => setNewAmountDue(event.target.value)} />
            </div>
            <HelpTooltip content="Total neto que el paciente adeuda actualmente." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input type="number" min="0" placeholder="Dias vencido" value={newDaysOverdue} onChange={(event) => setNewDaysOverdue(event.target.value)} />
            </div>
            <HelpTooltip content="Días transcurridos desde la fecha de vencimiento original." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={newAssignedToId} onChange={(event) => setNewAssignedToId(event.target.value)}>
                <option value="">Asignar a</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <HelpTooltip content="Usuario responsable del contacto y cobro." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Input type="datetime-local" value={newNextContactAt} onChange={(event) => setNewNextContactAt(event.target.value)} />
            </div>
            <HelpTooltip content="Fecha y hora sugeridas para realizar la siguiente llamada o envío de mensaje de cobro." />
          </div>
          <Button type="submit" disabled={mutations.createCase.isPending}>
            Crear caso
          </Button>
        </form>
      </Card>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <Select value={status} onChange={(event) => setStatus((event.target.value as CollectionCaseStatus) || "")}>
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        rows={cases.data ?? []}
        empty={<EmptyState title="Sin casos de cobranza" description="No hay casos para los filtros seleccionados." />}
        columns={[
          {
            key: "patient",
            title: "Paciente",
            render: (row) => `${row.patient.firstName} ${row.patient.lastName}`
          },
          { key: "amountDue", title: "Monto vencido", render: (row) => row.amountDue },
          { key: "daysOverdue", title: "Dias vencido", render: (row) => String(row.daysOverdue) },
          { key: "assignedTo", title: "Asignado a", render: (row) => `${row.assignedTo.firstName} ${row.assignedTo.lastName}` },
          {
            key: "status",
            title: "Estado",
            render: (row) => <Badge value={row.status} tone={row.status === "PAID" ? "success" : row.status === "UNCOLLECTIBLE" ? "danger" : "warning"} />
          },
          {
            key: "id",
            title: "Detalle",
            render: (row) => (
              <Link to={`/collections/${row.id}`}>
                <Button variant="secondary">Abrir</Button>
              </Link>
            )
          }
        ]}
      />
    </div>
  );
}
