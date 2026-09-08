import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type {
  InstallmentFrequency,
  PayableTreatmentItem
} from "@/features/payments/services/payments.service";
import type { TreatmentPlanDetail } from "@/features/treatments/services/treatments.service";
import {
  SummaryLine,
  SummaryPill,
  addInstallmentPeriod,
  fdiLabel,
  financeableAmount,
  money,
  numberValue,
  numericId,
  roundMoney,
  splitAmount
} from "./treatment-modal-helpers";

export function FinancingModal({
  open,
  plan,
  items,
  totalAvailable,
  saving,
  onClose,
  onCreate
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  items: PayableTreatmentItem[];
  totalAvailable: number;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: {
    patientId: string;
    treatmentPlanId: string;
    totalAmount: number;
    downPayment: number;
    numberOfInstallments: number;
    frequency: InstallmentFrequency;
    startDate: string;
    itemAllocations: Array<{ treatmentPlanItemId: string; amount: number; expectedVersion?: number }>;
  }) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downPayment, setDownPayment] = useState("0");
  const [numberOfInstallments, setNumberOfInstallments] = useState("1");
  const [frequency, setFrequency] = useState<InstallmentFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    setSelectedIds(items.map((item) => item.id));
    setDownPayment("0");
    setNumberOfInstallments("1");
    setFrequency("MONTHLY");
    setStartDate(new Date().toISOString().slice(0, 10));
  }, [items, open]);

  if (!plan) return null;

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedTotal = roundMoney(selectedItems.reduce((sum, item) => sum + financeableAmount(item), 0));
  const downPaymentValue = roundMoney(numberValue(downPayment));
  const installmentsCount = Math.max(0, Math.trunc(numberValue(numberOfInstallments)));
  const financedAmount = roundMoney(Math.max(selectedTotal - downPaymentValue, 0));
  const installmentAmounts = installmentsCount > 0 ? splitAmount(financedAmount, installmentsCount) : [];
  const schedule = installmentAmounts.map((amount, index) => ({
    number: index + 1,
    dueDate: addInstallmentPeriod(startDate, frequency, index),
    amount
  }));
  const canCreate =
    selectedTotal > 0 &&
    downPaymentValue >= 0 &&
    downPaymentValue < selectedTotal &&
    installmentsCount > 0 &&
    Boolean(startDate) &&
    !saving;

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  };

  const submit = async () => {
    if (!canCreate) return;
    await onCreate({
      patientId: plan.patient.id,
      treatmentPlanId: plan.id,
      totalAmount: selectedTotal,
      downPayment: downPaymentValue,
      numberOfInstallments: installmentsCount,
      frequency,
      startDate,
      itemAllocations: selectedItems.map((item) => ({
        treatmentPlanItemId: item.id,
        amount: financeableAmount(item),
        expectedVersion: item.version
      }))
    });
  };

  return (
    <Modal open={open} title="Financiamiento por credito" onClose={onClose} size="2xl">
      <div className="space-y-5">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4">
          <SummaryPill label="Paciente" value={`${plan.patient.firstName} ${plan.patient.lastName}`} />
          <SummaryPill label="Plan" value={`#${numericId(plan.id)}`} />
          <SummaryPill label="Sucursal" value={plan.branch.name} />
          <SummaryPill label="Disponible" value={money(totalAvailable)} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-3 py-3">Procedimiento</th>
                <th className="px-3 py-3">Pieza</th>
                <th className="px-3 py-3 text-right">Precio</th>
                <th className="px-3 py-3 text-right">Abonado</th>
                <th className="px-3 py-3 text-right">Ya financiado</th>
                <th className="px-3 py-3 text-right">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900">{item.procedure.name}</td>
                  <td className="px-3 py-3 text-slate-600">{fdiLabel(item.toothNumber)}</td>
                  <td className="px-3 py-3 text-right">{money(item.total)}</td>
                  <td className="px-3 py-3 text-right">{money(item.paidAmount)}</td>
                  <td className="px-3 py-3 text-right">{money(item.financedAmount ?? 0)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{money(financeableAmount(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={downPayment}
              onChange={(event) => setDownPayment(event.target.value)}
              placeholder="Enganche"
            />
            <Input
              type="number"
              min="1"
              step="1"
              value={numberOfInstallments}
              onChange={(event) => setNumberOfInstallments(event.target.value)}
              placeholder="Cuotas"
            />
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as InstallmentFrequency)}
            >
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="WEEKLY">Semanal</option>
            </Select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <SummaryLine label="Por financiar" value={money(selectedTotal)} />
            <SummaryLine label="Enganche" value={money(downPaymentValue)} />
            <SummaryLine label="Monto financiado" value={money(financedAmount)} strong />
            {!canCreate ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Selecciona prestaciones, usa un enganche menor al total y define al menos una cuota.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Vista previa de cuotas</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {schedule.map((installment) => (
              <div
                key={installment.number}
                className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-slate-900">Cuota {installment.number}</p>
                <p className="text-slate-500">{installment.dueDate}</p>
                <p className="font-semibold">{money(installment.amount)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canCreate} onClick={() => void submit()}>
            {saving ? "Creando..." : "Crear financiamiento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
