import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useRefunds } from "@/features/payments/hooks/use-payments";
import type { Refund, RefundStatus } from "@/features/payments/services/payments.service";
import type { TreatmentPlanDetail } from "@/features/treatments/services/treatments.service";
import { money, numberValue, numericId } from "./treatment-modal-helpers";

const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  PENDING: "Pendiente",
  PROCESSED: "Procesado",
  REJECTED: "Rechazado"
};

function formatDateTime(value?: string | Date | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function refundProcedureSummary(refund: Refund, treatmentPlanId: string): string {
  const matching = (refund.payment.allocations ?? []).filter(
    (allocation) => allocation.treatmentPlanItem?.treatmentPlanId === treatmentPlanId
  );
  if (!matching.length) return "Prestaciones del tratamiento";
  return matching
    .map((allocation) => {
      const tooth = allocation.treatmentPlanItem?.toothNumber
        ? `Pieza ${allocation.treatmentPlanItem.toothNumber}`
        : null;
      const name =
        allocation.treatmentPlanItem?.procedure?.name ??
        allocation.treatmentPlanItem?.procedure?.code ??
        "Prestación";
      return [name, tooth].filter(Boolean).join(" · ");
    })
    .join(", ");
}

function refundMatchesSearch(refund: Refund, treatmentPlanId: string, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  const idShort = refund.id.slice(-6).toLowerCase();
  const paymentShort = refund.payment.id.slice(-6).toLowerCase();
  const reason = (refund.reason ?? "").toLowerCase();
  const procedureSummary = refundProcedureSummary(refund, treatmentPlanId).toLowerCase();
  return (
    idShort.includes(normalized) ||
    paymentShort.includes(normalized) ||
    reason.includes(normalized) ||
    procedureSummary.includes(normalized)
  );
}

export function RefundsModal({
  open,
  patientId,
  plan,
  onClose
}: {
  open: boolean;
  patientId: string;
  plan: TreatmentPlanDetail | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RefundStatus | "">("");
  const refunds = useRefunds(
    {
      patientId,
      treatmentPlanId: plan?.id,
      status: status || undefined
    },
    open && Boolean(patientId && plan?.id)
  );
  const filteredRefunds = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = refunds.data ?? [];
    if (!term) return rows;
    return rows.filter((refund) => refundMatchesSearch(refund, plan?.id ?? "", term));
  }, [plan?.id, refunds.data, search]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setStatus("");
  }, [open]);

  return (
    <Modal open={open} title="Reembolsos" onClose={onClose} size="2xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Tratamiento {plan ? numericId(plan.id) : "-"}</p>

        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por ID o prestación"
            />
          </div>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as RefundStatus | "")}
            className="md:w-[220px]"
          >
            <option value="">Todos los reembolsos</option>
            <option value="PROCESSED">Procesados</option>
            <option value="PENDING">Pendientes</option>
            <option value="REJECTED">Rechazados</option>
          </Select>
        </div>

        {refunds.isLoading ? <LoadingState message="Cargando reembolsos..." /> : null}
        {refunds.isError ? <ErrorState message={refunds.error.message} /> : null}
        {!refunds.isLoading && !refunds.isError ? (
          filteredRefunds.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Reembolso</th>
                    <th className="px-4 py-3">Prestación</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefunds.map((refund) => (
                    <tr key={refund.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">#{refund.id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-slate-500">{refund.reason ?? "Sin motivo capturado"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {refundProcedureSummary(refund, plan?.id ?? "")}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        #{refund.payment.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {money(numberValue(refund.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={REFUND_STATUS_LABELS[refund.status]}
                          tone={
                            refund.status === "PROCESSED"
                              ? "success"
                              : refund.status === "REJECTED"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(refund.processedAt ?? refund.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No hay elementos"
              description="Paciente sin reembolsos para este tratamiento."
            />
          )
        ) : null}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
