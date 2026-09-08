import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type {
  TreatmentPlanDetail,
  TreatmentPlanItem
} from "@/features/treatments/services/treatments.service";
import { SummaryLine, money, numberValue } from "./treatment-modal-helpers";

export function itemPaidAmount(item: TreatmentPlanItem): number {
  return (item.paymentAllocations ?? []).reduce(
    (sum, allocation) => sum + numberValue(allocation.amount),
    0
  );
}

export function isBulkDiscountEligible(item: TreatmentPlanItem): boolean {
  const paid = itemPaidAmount(item);
  return (
    item.allowsDiscountSnapshot !== false &&
    !["CANCELLED", "PAID"].includes(item.status) &&
    paid < numberValue(item.total)
  );
}

export function itemDiscountBase(item: TreatmentPlanItem): number {
  return numberValue(item.originalPrice) || numberValue(item.quantity) * numberValue(item.unitPrice);
}

export function BulkDiscountModal({
  open,
  plan,
  selectedItemIds,
  eligibleItems,
  discountLimitsByItemId,
  onSelectedItemIdsChange,
  onClose,
  onApply
}: {
  open: boolean;
  plan: TreatmentPlanDetail;
  selectedItemIds: string[];
  eligibleItems: TreatmentPlanItem[];
  discountLimitsByItemId: Map<
    string,
    {
      userMaximumDiscountPercent?: string;
      procedureMaximumDiscountPercent?: string;
      effectiveMaximumDiscountPercent?: string;
    }
  >;
  onSelectedItemIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onApply: (payload: {
    itemIds: string[];
    discountType: "PERCENTAGE" | "AMOUNT";
    value: number;
    discountReason?: string;
  }) => Promise<void>;
}) {
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "AMOUNT">("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [discountReason, setDiscountReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDiscountType("PERCENTAGE");
    setValue("10");
    setDiscountReason("");
    if (!selectedItemIds.length && eligibleItems.length) {
      onSelectedItemIdsChange(eligibleItems.map((item) => item.id));
    }
  }, [eligibleItems, onSelectedItemIdsChange, open, selectedItemIds.length]);

  const selectedItems = plan.items.filter(
    (item) => selectedItemIds.includes(item.id) && isBulkDiscountEligible(item)
  );
  const numericValue = numberValue(value);
  const selectedBase = selectedItems.reduce((sum, item) => sum + itemDiscountBase(item), 0);
  const effectiveMaximum = selectedItems.length
    ? Math.min(
        ...selectedItems.map((item) =>
          Number(discountLimitsByItemId.get(item.id)?.effectiveMaximumDiscountPercent ?? 0)
        )
      )
    : 0;
  const requestedPercent =
    discountType === "PERCENTAGE"
      ? numericValue
      : selectedBase > 0
        ? (numericValue / selectedBase) * 100
        : 0;
  const previousTotal = selectedItems.reduce((sum, item) => sum + numberValue(item.total), 0);
  const previewDiscount =
    discountType === "PERCENTAGE"
      ? selectedItems.reduce(
          (sum, item) => sum + Number((itemDiscountBase(item) * (numericValue / 100)).toFixed(2)),
          0
        )
      : numericValue;
  const preview = {
    previousTotal,
    discount: Math.min(previewDiscount, selectedBase),
    newTotal: Math.max(selectedBase - Math.min(previewDiscount, selectedBase), 0)
  };
  const invalidValue =
    numericValue < 0 ||
    requestedPercent > effectiveMaximum ||
    (discountType === "AMOUNT" && numericValue > selectedBase) ||
    selectedItems.length === 0;

  const toggleItem = (itemId: string, checked: boolean) => {
    onSelectedItemIdsChange(
      checked ? [...new Set([...selectedItemIds, itemId])] : selectedItemIds.filter((id) => id !== itemId)
    );
  };

  const handleApply = async () => {
    if (invalidValue || saving) return;
    setSaving(true);
    try {
      await onApply({
        itemIds: selectedItems.map((item) => item.id),
        discountType,
        value: numericValue,
        discountReason: discountReason.trim() || undefined
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Aplicar descuentos a varios procedimientos" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="text-xs font-semibold text-slate-600">Tipo de descuento</span>
            <Select
              className="mt-1"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as "PERCENTAGE" | "AMOUNT")}
            >
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="AMOUNT">Importe fijo</option>
            </Select>
          </label>
          <label className="w-40">
            <span className="text-xs font-semibold text-slate-600">Valor</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={
                discountType === "PERCENTAGE"
                  ? effectiveMaximum
                  : Number((selectedBase * (effectiveMaximum / 100)).toFixed(2))
              }
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            type="button"
            onClick={() => onSelectedItemIdsChange(eligibleItems.map((item) => item.id))}
            disabled={!eligibleItems.length}
          >
            Seleccionar elegibles
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          {eligibleItems.map((item) => {
            const base = itemDiscountBase(item);
            const nextDiscount = Number((base * (requestedPercent / 100)).toFixed(2));
            const nextTotal = Math.max(base - Math.min(nextDiscount, base), 0);
            const limits = discountLimitsByItemId.get(item.id);
            return (
              <label
                key={item.id}
                className="grid cursor-pointer grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedItemIds.includes(item.id)}
                  onChange={(event) => toggleItem(item.id, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">
                    {item.procedure ? `[${item.procedure.code}] ${item.procedure.name}` : item.procedureId}
                  </span>
                  <span className="text-xs text-slate-500">{item.section?.name ?? "Sin seccion"}</span>
                  <span className="block text-xs font-medium text-emerald-700">
                    Máximo aplicable {limits?.effectiveMaximumDiscountPercent ?? "0.00"} %
                  </span>
                </span>
                <span className="text-right text-xs text-slate-500">
                  Antes
                  <strong className="ml-1 text-slate-900">{money(numberValue(item.total))}</strong>
                </span>
                <span className="text-right text-xs text-slate-500">
                  Nuevo
                  <strong className="ml-1 text-slate-900">{money(nextTotal)}</strong>
                </span>
              </label>
            );
          })}
          {!eligibleItems.length ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No hay procedimientos elegibles para descuento masivo.
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs text-slate-600 sm:grid-cols-3">
          <div>
            <span className="block text-slate-500">Límite usuario</span>
            <strong>
              {selectedItems[0]
                ? discountLimitsByItemId.get(selectedItems[0].id)?.userMaximumDiscountPercent
                : "0.00"}{" "}
              %
            </strong>
          </div>
          <div>
            <span className="block text-slate-500">Menor límite prestación</span>
            <strong>{effectiveMaximum.toFixed(2)} %</strong>
          </div>
          <div>
            <span className="block text-slate-500">Máximo aplicable</span>
            <strong className="text-sky-800">{effectiveMaximum.toFixed(2)} %</strong>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Motivo del descuento</span>
          <Input
            className="mt-1"
            value={discountReason}
            maxLength={240}
            onChange={(event) => setDiscountReason(event.target.value)}
            placeholder="Ej. Promoción, fidelización o ajuste comercial"
          />
        </label>

        {requestedPercent > effectiveMaximum && selectedItems.length ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Descuento solicitado {requestedPercent.toFixed(2)} %, máximo aplicable{" "}
            {effectiveMaximum.toFixed(2)} %. No se guardará ningún cambio.
          </p>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3">
          <SummaryLine label="Subtotal anterior" value={money(preview.previousTotal)} strong />
          <SummaryLine label="Descuento" value={money(preview.discount)} strong />
          <SummaryLine label="Nuevo total" value={money(preview.newTotal)} strong />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button disabled={invalidValue || saving} onClick={() => void handleApply()}>
            {saving ? "Guardando..." : "Aplicar descuentos"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
