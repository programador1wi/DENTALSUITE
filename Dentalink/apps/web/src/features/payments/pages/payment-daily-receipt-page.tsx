import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Mail, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  DailyReceiptDocument,
  ReceiptEmailModal,
  ReceiptPrintStyles,
  fullName,
  localDateLabel,
  money
} from "../components/payment-receipt-document";
import { downloadDailyReceiptPdf, getDailyPaymentReceipt, sendDailyReceiptEmail } from "../services/payments.service";

export function PaymentDailyReceiptPage() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [emailOpen, setEmailOpen] = useState(false);
  const date = searchParams.get("date") ?? "";
  const branchId = searchParams.get("branchId") ?? "";
  const hasParams = Boolean(id && date && branchId);

  const receipt = useQuery({
    queryKey: ["payment-daily-receipt", id, date, branchId],
    queryFn: () => getDailyPaymentReceipt(id, { date, branchId }),
    enabled: hasParams
  });

  const downloadPdf = async () => {
    const result = await downloadDailyReceiptPdf(id, { date, branchId });
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!hasParams) {
    return (
      <div className="min-h-screen bg-slate-100 py-6">
        <ErrorState message="No fue posible abrir el comprobante diario porque faltan fecha o sucursal." />
      </div>
    );
  }

  if (receipt.isLoading) return <LoadingState message="Cargando comprobante diario..." />;
  if (receipt.isError) return <ErrorState message={receipt.error.message} />;
  if (!receipt.data) return <EmptyState title="Comprobante no disponible" description="No existen pagos validos para esta fecha." />;

  const data = receipt.data;
  const patientName = fullName(data.patient);
  const brandName = data.receiptBranding?.businessName ?? data.branch.brand?.shortName ?? data.branch.brand?.name ?? data.branch.name;
  const subject = `Comprobante de pagos del ${localDateLabel(data.date)} - ${brandName}`;
  const message = `Hola ${patientName}:\n\nAdjuntamos el comprobante consolidado de los pagos registrados el ${localDateLabel(data.date)}.\n\nPagos incluidos: ${data.paymentNumbers.join(", ")}\nTotal del dia: ${money(data.totalAmount)}\n\nSaludos,\n${brandName}`;

  return (
    <div className="min-h-screen bg-slate-100 py-6 text-slate-950">
      <ReceiptPrintStyles />
      <div className="receipt-toolbar mx-auto mb-4 flex max-w-[920px] flex-wrap items-center justify-between gap-3 px-4">
        <Link to={`/patients/${id}/billing`}>
          <Button type="button" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Volver a pagos
          </Button>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <h1 className="mr-2 text-lg font-semibold">Comprobante diario · {localDateLabel(data.date)}</h1>
          <Button type="button" variant="secondary" onClick={() => setEmailOpen(true)}>
            <Mail className="h-4 w-4" />
            Enviar
          </Button>
          <Button type="button" variant="secondary" onClick={downloadPdf}>
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
      <DailyReceiptDocument receipt={data} />
      <ReceiptEmailModal
        open={emailOpen}
        title="Enviar comprobante de pago diario"
        patientEmail={data.patient.email}
        subject={subject}
        message={message}
        attachmentName={`Comprobante_Diario_${data.date}.pdf`}
        onClose={() => setEmailOpen(false)}
        onSend={(payload) => sendDailyReceiptEmail(id, { date, branchId }, payload)}
      />
    </div>
  );
}
