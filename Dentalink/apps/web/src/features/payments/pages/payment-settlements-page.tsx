import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import {
  useCurrentCashRegister,
  usePaymentSettlementMutations,
  usePaymentSettlements
} from "../hooks/use-payments";
import type { PaymentSettlement, PaymentSettlementStatus } from "../services/payments.service";

const statuses: Array<{ value: PaymentSettlementStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "OVERDUE", label: "Vencidos" },
  { value: "RECEIVED", label: "Recibidos" },
  { value: "CANCELLED", label: "Cancelados" }
];

export function PaymentSettlementsPage() {
  const { branchId } = useActiveBranchFilter();
  const { hasPermission } = usePermissions();
  const [status, setStatus] = useState<PaymentSettlementStatus | "">("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [receiving, setReceiving] = useState<PaymentSettlement | null>(null);
  const [cancelling, setCancelling] = useState<PaymentSettlement | null>(null);
  const [reference, setReference] = useState("");
  const [financialInstitutionId, setFinancialInstitutionId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const settlements = usePaymentSettlements({
    branchId: branchId || undefined,
    paymentMethodId: paymentMethodId || undefined,
    status: status || undefined,
    dueFrom: dueFrom || undefined,
    dueTo: dueTo || undefined
  });
  const currentRegister = useCurrentCashRegister(branchId || undefined);
  const methods = usePaymentMethods(undefined, "true");
  const institutions = useFinancialInstitutions(undefined, "true");
  const mutations = usePaymentSettlementMutations();
  const canReceive = hasPermission("payment_settlements.receive") || hasPermission("organization.manage_all");
  const canCancel = hasPermission("payment_settlements.cancel") || hasPermission("organization.manage_all");

  const openReceive = (row: PaymentSettlement) => {
    setReceiving(row);
    setReference(row.reference ?? "");
    setFinancialInstitutionId(row.financialInstitution?.id ?? "");
  };

  const confirmReceive = async () => {
    if (!receiving || !currentRegister.data) return;
    await mutations.receive.mutateAsync({
      id: receiving.id,
      cashRegisterId: currentRegister.data.id,
      expectedVersion: receiving.version,
      reference: reference.trim() || undefined,
      financialInstitutionId: financialInstitutionId || undefined
    });
    setReceiving(null);
  };

  const confirmCancel = async () => {
    if (!cancelling || !cancelReason.trim()) return;
    await mutations.cancel.mutateAsync({
      id: cancelling.id,
      expectedVersion: cancelling.version,
      reason: cancelReason.trim()
    });
    setCancelling(null);
    setCancelReason("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recepciones programadas"
        description="Controla vencimientos bancarios o de cheque originados por un solo medio de pago."
        helpText="El paciente ya quedó pagado al registrar el cobro; aquí se concilia cuándo la clínica recibe cada importe."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Importe filtrado" value={money(settlements.data?.totals.grossAmount ?? 0)} />
        <Summary label="Pendiente" value={money(settlements.data?.totals.byStatus.PENDING?.amount ?? 0)} />
        <Summary
          label="Vencido"
          value={money(settlements.data?.totals.byStatus.OVERDUE?.amount ?? 0)}
          danger
        />
      </div>

      <Card className="grid gap-3 md:grid-cols-4">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as PaymentSettlementStatus | "")}
        >
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
          <option value="">Todos los medios</option>
          {methods.data?.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={dueFrom}
          onChange={(event) => setDueFrom(event.target.value)}
          aria-label="Vence desde"
        />
        <Input
          type="date"
          value={dueTo}
          onChange={(event) => setDueTo(event.target.value)}
          aria-label="Vence hasta"
        />
      </Card>

      {!currentRegister.isLoading && !currentRegister.data ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">
          Puedes consultar vencimientos, pero necesitas una caja abierta para confirmar una recepción.
        </Card>
      ) : null}
      {settlements.isLoading ? <LoadingState message="Cargando recepciones programadas..." /> : null}
      {settlements.isError ? <ErrorState message={settlements.error.message} /> : null}

      {settlements.data?.data.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs uppercase text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3">Paciente / pago</th>
                  <th className="px-4 py-3">Medio</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                  <th className="px-4 py-3 text-right">Retención</th>
                  <th className="px-4 py-3 text-right">Neto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {settlements.data.data.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border-default)]">
                    <td className="px-4 py-3">
                      <span className="font-semibold">{date(row.dueAt)}</span>
                      <span className="block text-xs text-[var(--text-secondary)]">#{row.sequence}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">
                        {row.payment.patient.firstName} {row.payment.patient.lastName}
                      </span>
                      <span className="block text-xs text-[var(--text-secondary)]">
                        Pago #{row.payment.paymentNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.paymentMethod.name}</td>
                    <td className="px-4 py-3 text-right">{money(row.grossAmount)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{money(row.retentionAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(row.netAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge value={statusLabel(row.status)} tone={statusTone(row.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canReceive && ["PENDING", "OVERDUE"].includes(row.status) ? (
                          <Button size="sm" onClick={() => openReceive(row)} disabled={!currentRegister.data}>
                            Recibir
                          </Button>
                        ) : null}
                        {canCancel && ["PENDING", "OVERDUE"].includes(row.status) ? (
                          <Button size="sm" variant="secondary" onClick={() => setCancelling(row)}>
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : !settlements.isLoading && !settlements.isError ? (
        <EmptyState
          title="Sin recepciones"
          description="No hay vencimientos con los filtros seleccionados."
        />
      ) : null}

      <Modal open={Boolean(receiving)} title="Confirmar recepción" onClose={() => setReceiving(null)}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Se registrará el importe neto en caja; retención queda separada para reportes.
          </p>
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Referencia"
          />
          <Select
            value={financialInstitutionId}
            onChange={(event) => setFinancialInstitutionId(event.target.value)}
          >
            <option value="">Sin institución</option>
            {institutions.data?.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </Select>
          {mutations.receive.isError ? <ErrorState message={mutations.receive.error.message} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReceiving(null)}>
              Cerrar
            </Button>
            <Button
              onClick={() => void confirmReceive()}
              disabled={!currentRegister.data || mutations.receive.isPending}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(cancelling)} title="Cancelar vencimiento" onClose={() => setCancelling(null)}>
        <div className="space-y-4">
          <Input
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Motivo obligatorio"
          />
          {mutations.cancel.isError ? <ErrorState message={mutations.cancel.error.message} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmCancel()}
              disabled={!cancelReason.trim() || mutations.cancel.isPending}
            >
              Cancelar vencimiento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Summary({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${danger ? "text-[var(--text-danger)]" : "text-[var(--text-primary)]"}`}
      >
        {value}
      </p>
    </Card>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}
function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}
function statusLabel(status: PaymentSettlementStatus) {
  return {
    PENDING: "Pendiente",
    OVERDUE: "Vencido",
    RECEIVED: "Recibido",
    CANCELLED: "Cancelado",
    REVERSED: "Revertido"
  }[status];
}
function statusTone(status: PaymentSettlementStatus): "warning" | "danger" | "success" | "default" {
  return status === "RECEIVED"
    ? "success"
    : status === "OVERDUE"
      ? "danger"
      : status === "PENDING"
        ? "warning"
        : "default";
}
