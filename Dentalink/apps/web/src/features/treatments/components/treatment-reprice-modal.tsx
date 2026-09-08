import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type {
  TreatmentPlanDetail,
  TreatmentPlanRepricePreview
} from "@/features/treatments/services/treatments.service";
import { money, numberValue } from "./treatment-modal-helpers";

export function TreatmentRepriceModal({
  preview,
  plan,
  reason,
  applying,
  onReasonChange,
  onClose,
  onApply
}: {
  preview: TreatmentPlanRepricePreview | null;
  plan: TreatmentPlanDetail | null;
  reason: string;
  applying: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const totalDifference = (preview?.items ?? []).reduce(
    (sum, item) => sum + numberValue(item.difference),
    0
  );
  const itemById = new Map((plan?.items ?? []).map((item) => [item.id, item]));

  return (
    <Modal open={Boolean(preview)} title="Actualizar precios del borrador" onClose={onClose} size="2xl">
      {preview ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Esta acción solo cambia este plan en borrador. No modifica versiones antiguas ni otros
            tratamientos.
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[minmax(180px,1fr)_90px_90px_90px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Prestación</span>
              <span>Actual</span>
              <span>Propuesto</span>
              <span>Diferencia</span>
            </div>
            <div className="divide-y divide-slate-200">
              {preview.items.map((row) => {
                const item = itemById.get(row.itemId);
                return (
                  <div
                    key={row.itemId}
                    className="grid grid-cols-[minmax(180px,1fr)_90px_90px_90px] gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {item?.procedure?.name ?? item?.priceSnapshotName ?? row.procedureId}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        v{row.current.versionNumber ?? "—"} → v{row.proposed?.version.number ?? "—"}
                      </p>
                      {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
                      {row.hasFinancialDependencies ? (
                        <p className="mt-1 text-xs text-amber-700">Tiene pagos o presupuesto no borrador.</p>
                      ) : null}
                    </div>
                    <span className="font-medium text-slate-700">
                      {money(numberValue(row.current.total))}
                    </span>
                    <span className="font-medium text-slate-900">
                      {row.proposed ? money(numberValue(row.proposed.total)) : "—"}
                    </span>
                    <span
                      className={
                        numberValue(row.difference) > 0 ? "text-amber-700" : "text-emerald-700"
                      }
                    >
                      {row.difference === null ? "—" : money(numberValue(row.difference))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Diferencia total</span>
            <span className="text-base font-semibold text-slate-900">{money(totalDifference)}</span>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Motivo obligatorio</span>
            <Textarea
              className="mt-1"
              rows={3}
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Ej. Actualización autorizada por cambio de tarifario"
            />
          </label>

          {!preview.canApply ? (
            <p className="text-sm font-medium text-red-600">
              No se puede aplicar: corrige errores o dependencias financieras antes de recalcular.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!preview.canApply || !reason.trim() || applying} onClick={onApply}>
              {applying ? "Actualizando..." : "Confirmar actualización"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
