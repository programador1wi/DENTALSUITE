import { ArrowLeft, FileDown, Printer, Sheet } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useCashRegisterDetail } from "../hooks/use-payments";
import { CashRegisterDetailPanel } from "./cash-register-page";
import { downloadCashRegisterReport } from "../services/payments.service";

export function CashRegisterDetailPage() {
  const navigate = useNavigate();
  const { registerNumber } = useParams();
  const detail = useCashRegisterDetail(registerNumber);
  const [downloading, setDownloading] = useState(false);

  if (detail.isLoading) return <LoadingState message="Cargando detalle histórico de caja..." />;
  if (detail.isError) return <ErrorState message={detail.error.message} />;
  if (!detail.data) return <ErrorState message="No se encontró la caja solicitada." />;

  return (
    <div className="cash-report-page mx-auto w-full max-w-[1240px] space-y-4">
      <style>{`@media print {
        @page { size: A4 portrait; margin: 14mm; }
        body * { visibility: hidden !important; }
        .cash-report-page, .cash-report-page * { visibility: visible !important; }
        .cash-report-page { position: absolute; inset: 0; max-width: none !important; }
        .cash-report-actions { display: none !important; }
        .cash-report-page table { width: 100%; }
        .cash-report-page thead { display: table-header-group; }
        .cash-report-page tr { break-inside: avoid; }
      }`}</style>
      <div className="cash-report-actions flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/cash-register/closed")}>
          <ArrowLeft className="h-4 w-4" /> Volver a cajas
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadCashRegisterReport(registerNumber as string, "csv");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Sheet className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadCashRegisterReport(registerNumber as string, "xlsx");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Sheet className="h-4 w-4" /> Exportar Excel
          </Button>
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadCashRegisterReport(registerNumber as string, "pdf");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <FileDown className="h-4 w-4" /> Descargar PDF
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>
      <CashRegisterDetailPanel register={detail.data} />
    </div>
  );
}
