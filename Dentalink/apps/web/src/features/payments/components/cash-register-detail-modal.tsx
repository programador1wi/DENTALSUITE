import { useState } from "react";
import { FileDown, Printer, Sheet } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useCashRegisterDetail } from "../hooks/use-payments";
import { downloadCashRegisterReport } from "../services/payments.service";
import { CashRegisterDetailPanel } from "../pages/cash-register-page";

type CashRegisterDetailModalProps = {
  registerId: string | null;
  open: boolean;
  onClose: () => void;
};

export function CashRegisterDetailModal({ registerId, open, onClose }: CashRegisterDetailModalProps) {
  const detail = useCashRegisterDetail(registerId || undefined);
  const [downloading, setDownloading] = useState(false);

  const title = registerId ? `Detalle de Caja ${registerId}` : "Detalle de Caja";

  return (
    <Modal open={open} title={title} onClose={onClose} size="3xl">
      <div className="space-y-4 pb-2">
        {registerId && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border-default)] pb-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadCashRegisterReport(registerId, "csv");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Sheet className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadCashRegisterReport(registerId, "xlsx");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Sheet className="h-4 w-4" /> Exportar Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadCashRegisterReport(registerId, "pdf");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <FileDown className="h-4 w-4" /> Descargar PDF
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        )}

        {detail.isLoading ? (
          <LoadingState message="Cargando detalle de caja..." />
        ) : detail.isError ? (
          <ErrorState message={detail.error.message} />
        ) : !detail.data ? (
          <ErrorState message="No se encontró la caja solicitada." />
        ) : (
          <CashRegisterDetailPanel register={detail.data} />
        )}
      </div>
    </Modal>
  );
}
