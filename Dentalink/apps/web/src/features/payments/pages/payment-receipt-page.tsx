import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { downloadPaymentReceiptPdf, getPaymentReceipt, type Payment } from "../services/payments.service";
import { useQuery } from "@tanstack/react-query";

export function PaymentReceiptPage() {
  const { paymentNumber = "" } = useParams();
  const [searchParams] = useSearchParams();
  const receipt = useQuery({
    queryKey: ["payment-receipt", paymentNumber],
    queryFn: () => getPaymentReceipt(paymentNumber),
    enabled: Boolean(paymentNumber)
  });

  useEffect(() => {
    if (!receipt.data || searchParams.get("print") !== "1") return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [receipt.data, searchParams]);

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

  return (
    <div className="min-h-screen bg-slate-100 py-6 text-slate-950">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          body { background: #fff !important; }
          .receipt-toolbar { display: none !important; }
          .receipt-shell { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; max-width: none !important; }
        }
      `}</style>
      <div className="receipt-toolbar mx-auto mb-4 flex max-w-[920px] flex-wrap items-center justify-between gap-3 px-4">
        <Link to={`/patients/${payment.patientId}/billing`}>
          <Button type="button" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Volver a pagos
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="mr-2 text-lg font-semibold">Comprobante de pago #{payment.paymentNumber}</h1>
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
      <ReceiptDocument payment={payment} />
    </div>
  );
}

function ReceiptDocument({ payment }: { payment: Payment }) {
  const patientName = `${payment.patient.firstName} ${payment.patient.lastName}`.trim();
  const brandName = payment.branch?.name ?? "Clinica";
  const treatments = payment.treatmentRefs ?? payment.treatments ?? [];
  const methods = payment.paymentMethods?.length
    ? payment.paymentMethods
    : [{ name: payment.paymentMethod.name, amount: Number(payment.amount), reference: payment.reference ?? null }];

  return (
    <article className="receipt-shell mx-auto min-h-[1122px] max-w-[794px] bg-white px-8 py-8 shadow-xl">
      <header className="flex items-start justify-between border-b border-slate-300 pb-4">
        <div>
          <div className="text-2xl font-black tracking-tight text-sky-700">{brandName}</div>
          <p className="mt-1 text-xs text-slate-500">{payment.branch.name}</p>
        </div>
        <div className="text-right text-xs leading-5 text-slate-600">
          <p><strong>Fecha transaccion:</strong> {dateOnly(payment.paidAt)}</p>
          <p><strong>Fecha impresion:</strong> {dateOnly(new Date().toISOString())}</p>
          <p><strong>Pago:</strong> #{payment.paymentNumber}</p>
        </div>
      </header>

      <h2 className="my-8 text-center text-xl font-bold">Comprobante de pago</h2>

      <section className="mb-7">
        <h3 className="mb-3 text-sm font-bold">Paciente:</h3>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs">
          <Info label="Nombre" value={patientName} />
          <Info label="Fecha de nacimiento" value="-" />
          <Info label="Documento" value={payment.patient.documentNumber ?? "-"} />
          <Info label="Convenio" value={payment.patient.agreement?.name ?? "-"} />
        </div>
      </section>

      <section className="mb-7">
        <h3 className="mb-4 text-sm font-bold">Tratamientos pagados:</h3>
        {treatments.length ? (
          treatments.map((treatment) => (
            <div key={treatment.id} className="mb-5">
              <div className="border-y border-slate-400 py-2 text-xs font-bold uppercase">
                {treatment.name} - No {treatment.number}
              </div>
              <table className="mt-3 w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    <th className="py-2">Prestacion</th>
                    <th className="py-2">Pieza(s)</th>
                    <th className="py-2">No Pago</th>
                    <th className="py-2 text-right">Precio</th>
                    <th className="py-2 text-right">Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.breakdown
                    .filter((row) => row.treatmentNumber === treatment.number)
                    .map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="py-2">{row.detail}</td>
                        <td className="py-2">{pieceFromDetail(row.detail)}</td>
                        <td className="py-2">{payment.paymentNumber}</td>
                        <td className="py-2 text-right">{money(row.baseAmount)}</td>
                        <td className="py-2 text-right">{money(row.paidAmount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500">Pago recibido sin aplicaciones a tratamiento.</p>
        )}
      </section>

      <section className="mb-7">
        <h3 className="mb-4 text-sm font-bold">Transaccion:</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-slate-400 text-left">
              <th className="py-2">No Pago</th>
              <th className="py-2">Factura/Boleta</th>
              <th className="py-2">Medio de pago</th>
              <th className="py-2">Referencia</th>
              <th className="py-2">Fecha</th>
              <th className="py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((method, index) => (
              <tr key={`${method.name}-${index}`} className="border-b border-slate-100">
                <td className="py-2">{payment.paymentNumber}</td>
                <td className="py-2">-</td>
                <td className="py-2">{method.name}</td>
                <td className="py-2">{method.reference ?? "-"}</td>
                <td className="py-2">{dateOnly(payment.paidAt)}</td>
                <td className="py-2 text-right">{money(method.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="py-3 text-right font-bold">Total:</td>
              <td className="py-3 text-right font-bold">{money(payment.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <footer className="mt-24 grid grid-cols-[1fr_1.4fr] gap-8 border-t border-slate-200 pt-5 text-[10px] leading-4 text-slate-500">
        <div>
          <p className="font-bold text-slate-700">{brandName}</p>
          <p>{payment.branch.name}</p>
        </div>
        <p>
          Documento generado por Dentalink. Al iniciar este tratamiento el paciente acepta las politicas y condiciones de la clinica.
        </p>
      </footer>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(value ?? 0) || 0);
}

function dateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

function pieceFromDetail(detail: string) {
  const match = /Pieza\s+([^\s-]+)/i.exec(detail);
  return match?.[1] ?? "-";
}
