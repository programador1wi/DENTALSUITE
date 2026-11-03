import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Mail, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  PaymentReceiptDocument,
  ReceiptEmailModal,
  ReceiptPrintStyles,
  dateOnly,
  fullName,
  money
} from "../components/payment-receipt-document";
import { downloadPaymentReceiptPdf, getPaymentReceipt, sendPaymentReceiptEmail } from "../services/payments.service";

export function PaymentReceiptPage() {
  const { paymentNumber = "" } = useParams();
  const [emailOpen, setEmailOpen] = useState(false);
  const receipt = useQuery({
    queryKey: ["payment-receipt", paymentNumber],
    queryFn: () => getPaymentReceipt(paymentNumber),
    enabled: Boolean(paymentNumber)
  });

  const downloadPdf = async () => {
    const result = await downloadPaymentReceiptPdf(paymentNumber);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (receipt.isLoading) return <LoadingState message="Cargando comprobante..." />;
  if (receipt.isError) return <ErrorState message={receipt.error.message} />;
  if (!receipt.data?.payment) return <EmptyState title="Comprobante no disponible" description="No se encontro el pago solicitado." />;

  const payment = receipt.data.payment;
  const patientName = fullName(payment.patient);
  const brandName = payment.receiptBranding?.businessName ?? payment.branch.name;
  const subject = `Comprobante de pago #${payment.paymentNumber} - ${brandName}`;
  const message = `Hola ${patientName}:\n\nAdjuntamos el comprobante del pago #${payment.paymentNumber} registrado en ${brandName}.\n\nFecha: ${dateOnly(payment.paidAt)}\nMonto: ${money(payment.amount)}\n\nSaludos,\n${brandName}`;

  return (
    <div className="min-h-screen bg-slate-100 py-6 text-slate-950">
      <ReceiptPrintStyles />
      <div className="receipt-toolbar mx-auto mb-4 flex max-w-[920px] flex-wrap items-center justify-between gap-3 px-4">
        <Link to={`/patients/${payment.patientId}/billing`}>
          <Button type="button" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Volver a pagos
          </Button>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <h1 className="mr-2 text-lg font-semibold">Comprobante de pago #{payment.paymentNumber}</h1>
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
      <PaymentReceiptDocument payment={payment} />
      <ReceiptEmailModal
        open={emailOpen}
        title="Enviar comprobante de pago"
        patientEmail={payment.patient.email}
        subject={subject}
        message={message}
        attachmentName={`Comprobante_Pago_${payment.paymentNumber}.pdf`}
        onClose={() => setEmailOpen(false)}
        onSend={(payload) => sendPaymentReceiptEmail(payment.paymentNumber, payload)}
      />
    </div>
  );
}
