import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSectionPage } from "../components/patient-section-page";
import { usePatientPayments, usePaymentsMutations } from "@/features/payments/hooks/use-payments";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { usePatient } from "../hooks/use-patients";

export function PatientPaymentsPage() {
  const { id = "" } = useParams();
  const patient = usePatient(id);
  const payments = usePatientPayments(id);
  const paymentMethods = usePaymentMethods(undefined, "true");
  const financialInstitutions = useFinancialInstitutions(undefined, "true");
  const mutations = usePaymentsMutations();
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [financialInstitutionId, setFinancialInstitutionId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const canCreatePayment = Boolean(patient.data?.branchId && id && paymentMethodId && Number(amount) > 0);

  const handleCreatePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreatePayment || !patient.data) return;

    await mutations.createPayment.mutateAsync({
      branchId: patient.data.branchId,
      patientId: id,
      paymentMethodId,
      financialInstitutionId: financialInstitutionId || undefined,
      amount: Number(amount),
      reference: reference || undefined,
      notes: notes || undefined
    });

    setAmount("");
    setReference("");
    setNotes("");
    setFinancialInstitutionId("");
  };

  if (payments.isLoading || patient.isLoading) return <LoadingState message="Cargando pagos del paciente..." />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (!payments.data) return <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Pagos" description="Estado financiero del paciente.">
      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Recibir pago de este paciente</h3>
          <p className="text-xs text-slate-500">El pago se registra directamente contra el expediente del paciente seleccionado.</p>
        </div>
        <form className="grid gap-3 md:grid-cols-5" onSubmit={handleCreatePayment}>
          <Select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
            <option value="">Metodo de pago</option>
            {paymentMethods.data?.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </Select>
          <Select value={financialInstitutionId} onChange={(event) => setFinancialInstitutionId(event.target.value)}>
            <option value="">Banco / entidad</option>
            {financialInstitutions.data?.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Monto" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input placeholder="Referencia" value={reference} onChange={(event) => setReference(event.target.value)} />
          <Button type="submit" disabled={!canCreatePayment || mutations.createPayment.isPending}>
            {mutations.createPayment.isPending ? "Registrando..." : "Registrar pago"}
          </Button>
          <Input className="md:col-span-5" placeholder="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </form>
      </Card>

      <Card className="grid gap-3 md:grid-cols-6">
        <div>
          <p className="text-xs uppercase text-slate-500">Planificado</p>
          <p className="font-medium text-slate-900">{payments.data.balance.plannedAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Pagado aplicado</p>
          <p className="font-medium text-slate-900">{payments.data.balance.allocatedPaidAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Pagado total</p>
          <p className="font-medium text-slate-900">{payments.data.balance.totalPaidAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
          <p className="font-medium text-rose-700">{payments.data.balance.outstandingAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Credito sin aplicar</p>
          <p className="font-medium text-emerald-700">{payments.data.balance.unallocatedCredit.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Cuotas vencidas</p>
          <p className="font-medium text-amber-700">{payments.data.balance.overdueInstallments}</p>
        </div>
      </Card>

      <DataTable
        rows={payments.data.payments}
        empty={<EmptyState title="Sin pagos" description="El paciente no tiene pagos registrados." />}
        columns={[
          { key: "paidAt", title: "Fecha", render: (row) => new Date(row.paidAt).toLocaleString() },
          { key: "amount", title: "Monto", render: (row) => `${row.amount} ${row.currency}` },
          { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethod.name },
          { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={row.status === "REFUNDED" ? "danger" : "success"} /> },
          { key: "allocations", title: "Aplicaciones", render: (row) => String(row.allocations.length) }
        ]}
      />
    </PatientSectionPage>
  );
}
