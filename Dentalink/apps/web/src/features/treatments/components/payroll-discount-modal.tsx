import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type {
  TreatmentPlanDetail,
  TreatmentPlanItem,
  TreatmentPlanItemStatus
} from "@/features/treatments/services/treatments.service";
import {
  SummaryPill,
  addInstallmentPeriod,
  fdiLabel,
  money,
  numberValue,
  roundMoney,
  splitAmount
} from "./treatment-modal-helpers";

const ITEM_STATUS_LABELS: Record<TreatmentPlanItemStatus, string> = {
  PLANNED: "Planificado",
  ACCEPTED: "Aceptado",
  PAID: "Pagado",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado"
};

export function PayrollDiscountModal({
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
  items: TreatmentPlanItem[];
  totalAvailable: number;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: {
    treatmentPlanId: string;
    treatmentPlanItemIds: string[];
    installmentCount: number;
    firstDueDate: string;
    periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  }) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [installmentCount, setInstallmentCount] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodicity, setPeriodicity] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("MONTHLY");

  useEffect(() => {
    if (!open) return;
    setSelectedIds(items.map((item) => item.id));
    setInstallmentCount("1");
    setFirstDueDate(new Date().toISOString().slice(0, 10));
    setPeriodicity("MONTHLY");
  }, [items, open]);

  if (!plan) return null;
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedTotal = roundMoney(
    selectedItems.reduce((sum, item) => sum + numberValue(item.agreementCoverage), 0)
  );
  const count = Math.max(0, Math.trunc(numberValue(installmentCount)));
  const currency = selectedItems[0]?.priceCurrency ?? "MXN";
  const schedule = count
    ? splitAmount(selectedTotal, count).map((amount, index) => ({
        number: index + 1,
        dueDate: addInstallmentPeriod(firstDueDate, periodicity, index),
        amount
      }))
    : [];
  const canCreate =
    selectedItems.length > 0 && selectedTotal > 0 && count > 0 && Boolean(firstDueDate) && !saving;

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  };

  return (
    <Modal open={open} title="Descuento por planilla" onClose={onClose} size="2xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <SummaryPill label="Empresa / convenio" value={plan.agreement?.name ?? "Convenio del plan"} />
            <SummaryPill
              label="Paciente afiliado"
              value={`${plan.patient.firstName} ${plan.patient.lastName}`}
            />
            <SummaryPill label="Sucursal" value={plan.branch.name} />
            <SummaryPill label="Cobertura disponible" value={money(totalAvailable)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-sky-900">
            Estas cuotas serán deuda de la empresa hacia la clínica. No se registrarán como pago ni como deuda
            particular del paciente.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-3 py-3">Prestación</th>
                <th className="px-3 py-3">Pieza</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Cobro a empresa</th>
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
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-950">
                      {item.procedure?.name ?? item.priceSnapshotName ?? "Prestación"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.procedure?.code ?? item.priceSnapshotCode ?? item.id}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{fdiLabel(item.toothNumber)}</td>
                  <td className="px-3 py-3">
                    <Badge value={ITEM_STATUS_LABELS[item.status]} tone="default" />
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-slate-950">
                    {new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: item.priceCurrency ?? "MXN"
                    }).format(numberValue(item.agreementCoverage))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">Número de cuotas</span>
              <Input
                type="number"
                min="1"
                max="120"
                step="1"
                value={installmentCount}
                onChange={(event) => setInstallmentCount(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">Primera cuota</span>
              <Input
                type="date"
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">Periodicidad</span>
              <Select
                value={periodicity}
                onChange={(event) => setPeriodicity(event.target.value as typeof periodicity)}
              >
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="MONTHLY">Mensual</option>
              </Select>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-300">Plan empresarial</p>
            <p className="mt-1 text-2xl font-bold">
              {new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(selectedTotal)}
            </p>
            <div className="mt-3 flex justify-between text-sm text-slate-300">
              <span>Prestaciones</span>
              <strong className="text-white">{selectedItems.length}</strong>
            </div>
            <div className="mt-1 flex justify-between text-sm text-slate-300">
              <span>Cargos a generar</span>
              <strong className="text-white">{selectedItems.length * count}</strong>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">Vista previa de cuotas</p>
          <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto md:grid-cols-3">
            {schedule.map((installment) => (
              <div
                key={installment.number}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Cuota {installment.number}</p>
                  <span className="font-bold text-sky-800">
                    {new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(
                      installment.amount
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Vence {installment.dueDate}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() =>
              void onCreate({
                treatmentPlanId: plan.id,
                treatmentPlanItemIds: selectedIds,
                installmentCount: count,
                firstDueDate,
                periodicity
              })
            }
          >
            {saving ? "Generando cargos..." : "Generar cargos empresariales"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
