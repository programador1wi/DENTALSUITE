import { FormEvent, useState } from "react";
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
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useInstallments, usePaymentsMutations } from "../hooks/use-payments";
import type { InstallmentFrequency } from "../services/payments.service";

export function InstallmentsPage() {
  const [patientId, setPatientId] = useState("");
  const [status, setStatus] = useState("");

  const [newPatientId, setNewPatientId] = useState("");
  const [newTreatmentPlanId, setNewTreatmentPlanId] = useState("");
  const [newTotalAmount, setNewTotalAmount] = useState("");
  const [newDownPayment, setNewDownPayment] = useState("0");
  const [newInstallments, setNewInstallments] = useState("6");
  const [newFrequency, setNewFrequency] = useState<InstallmentFrequency>("MONTHLY");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [payInstallmentId, setPayInstallmentId] = useState("");
  const [payBranchId, setPayBranchId] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const paymentMethods = usePaymentMethods(undefined, "true");
  const installments = useInstallments({ patientId: patientId || undefined, status: status || undefined });
  const mutations = usePaymentsMutations();

  const handleCreatePlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPatientId || !newTreatmentPlanId || Number(newTotalAmount) <= 0 || Number(newInstallments) <= 0) return;
    mutations.createInstallmentPlan.mutate({
      patientId: newPatientId,
      treatmentPlanId: newTreatmentPlanId,
      totalAmount: Number(newTotalAmount),
      downPayment: Number(newDownPayment || 0),
      numberOfInstallments: Number(newInstallments),
      frequency: newFrequency,
      startDate: newStartDate
    });
  };

  const handlePay = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payInstallmentId || !payBranchId || !payMethodId || Number(payAmount) <= 0) return;
    mutations.payInstallment.mutate({
      installmentId: payInstallmentId,
      branchId: payBranchId,
      paymentMethodId: payMethodId,
      amount: Number(payAmount)
    });
  };

  if (installments.isLoading) return <LoadingState message="Cargando cuotas..." />;
  if (installments.isError) return <ErrorState message={installments.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuotas"
        description="Planes de financiamiento y pagos de cuotas."
        helpText="Gestión de cuotas de financiamiento interno. Permite crear planes de cuotas personalizados para planes de tratamiento extensos (especificando enganche y frecuencia) y registrar abonos a cuotas específicas."
      />

      {/* Crear Plan */}
      <Card>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-800">Crear Plan de Financiamiento</h3>
          <HelpTooltip content="Configura un cronograma de financiamiento interno para un paciente. Divide el saldo del tratamiento en cuotas fijas recurrentes." />
        </div>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={handleCreatePlan}>
          <div className="flex items-center gap-1.5 w-full">
            <Input 
              placeholder="patientId" 
              value={newPatientId} 
              onChange={(event) => setNewPatientId(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="ID del paciente al cual se le asociará el plan de financiamiento." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input 
              placeholder="treatmentPlanId" 
              value={newTreatmentPlanId} 
              onChange={(event) => setNewTreatmentPlanId(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="ID del plan de tratamiento clínico aprobado que se va a financiar." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input 
              type="number" 
              min="0" 
              step="0.01" 
              placeholder="Monto total" 
              value={newTotalAmount} 
              onChange={(event) => setNewTotalAmount(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="El monto total a financiar después de restar cualquier abono directo." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input 
              type="number" 
              min="0" 
              step="0.01" 
              placeholder="Enganche" 
              value={newDownPayment} 
              onChange={(event) => setNewDownPayment(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="Monto inicial o pie que el paciente pagará al momento de firmar el plan de cuotas (0 si no aplica)." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input 
              type="number" 
              min="1" 
              placeholder="Numero de cuotas" 
              value={newInstallments} 
              onChange={(event) => setNewInstallments(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="Cantidad de pagos parciales en los que se dividirá el saldo financiado." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Select 
              value={newFrequency} 
              onChange={(event) => setNewFrequency(event.target.value as InstallmentFrequency)}
              className="flex-1"
            >
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="WEEKLY">Semanal</option>
            </Select>
            <HelpTooltip content="Periodicidad entre cada cuota: Mensual, Quincenal o Semanal." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input 
              type="date" 
              value={newStartDate} 
              onChange={(event) => setNewStartDate(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="Fecha límite de pago de la primera cuota." />
          </div>

          <Button type="submit" disabled={mutations.createInstallmentPlan.isPending}>
            Crear plan de cuotas
          </Button>
        </form>
      </Card>

      {/* Registrar Pago */}
      <Card>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-800">Registrar Pago de Cuota</h3>
          <HelpTooltip content="Abona o salda una cuota específica de financiamiento de un paciente." />
        </div>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={handlePay}>
          <div className="flex items-center gap-1.5 w-full">
            <Input 
              placeholder="installmentId" 
              value={payInstallmentId} 
              onChange={(event) => setPayInstallmentId(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="El ID único de la cuota específica a saldar." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Select value={payBranchId} onChange={(event) => setPayBranchId(event.target.value)} className="flex-1">
              <option value="">Sucursal</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <HelpTooltip content="Sucursal donde se recibe físicamente el pago de la cuota." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Select value={payMethodId} onChange={(event) => setPayMethodId(event.target.value)} className="flex-1">
              <option value="">Metodo de pago</option>
              {paymentMethods.data?.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
            <HelpTooltip content="El medio financiero utilizado por el paciente para pagar la cuota." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input 
              type="number" 
              min="0" 
              step="0.01" 
              placeholder="Monto" 
              value={payAmount} 
              onChange={(event) => setPayAmount(event.target.value)} 
              className="flex-1"
            />
            <HelpTooltip content="El monto exacto que se va a abonar a la cuota seleccionada." />
          </div>

          <Button type="submit" variant="secondary" disabled={mutations.payInstallment.isPending}>
            Pagar cuota
          </Button>
        </form>
      </Card>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <div className="flex items-center gap-1.5 w-full">
          <Input 
            placeholder="Filtrar por patientId" 
            value={patientId} 
            onChange={(event) => setPatientId(event.target.value)} 
            className="flex-1"
          />
          <HelpTooltip content="Filtra cuotas de financiamiento pertenecientes a un paciente específico." />
        </div>

        <div className="flex items-center gap-1.5 w-full">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="flex-1">
            <option value="">Todos los estados</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PAID">PAID</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
          <HelpTooltip content="Filtra cuotas por su estado de pago: PENDING (Pendiente de pago), PARTIAL (Abono parcial), PAID (Pagada completa) u OVERDUE (Vencida)." />
        </div>
      </div>

      <DataTable
        rows={installments.data ?? []}
        stickyFirstColumn={true}
        stickyLastColumn={true}
        responsiveCards={true}
        empty={<EmptyState title="Sin cuotas" description="No hay cuotas para los filtros actuales." />}
        columns={[
          {
            key: "patient",
            title: "Paciente",
            render: (row) => (row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : row.patientId)
          },
          { key: "number", title: "No. cuota" },
          { key: "dueDate", title: "Vence", render: (row) => new Date(row.dueDate).toLocaleDateString() },
          { key: "amount", title: "Monto" },
          { key: "paidAmount", title: "Pagado" },
          {
            key: "status",
            title: "Estado",
            render: (row) => (
              <Badge value={row.isOverdue ? "OVERDUE" : row.status} tone={row.isOverdue ? "danger" : row.status === "PAID" ? "success" : "warning"} />
            )
          }
        ]}
      />
    </div>
  );
}
