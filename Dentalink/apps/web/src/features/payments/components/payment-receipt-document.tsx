import { useEffect, useState } from "react";
import { CheckCircle2, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { DailyPaymentReceipt, Payment, ReceiptBranding, ReceiptEmailResponse } from "../services/payments.service";

export function ReceiptPrintStyles() {
  return (
    <style>{`
      @page {
        size: A4 portrait;
        margin: 0;
      }
      @media print {
        html {
          width: auto !important;
          min-width: 0 !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }
        body {
          width: auto !important;
          min-width: 0 !important;
          height: auto !important;
          margin: 14mm !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
        .receipt-toolbar,
        .receipt-modal-only {
          display: none !important;
        }
        .receipt-shell {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          min-height: calc(297mm - 28mm) !important;
          margin: 0 !important;
          padding: 2mm 3mm !important;
          box-shadow: none !important;
          border: 0 !important;
          transform: none !important;
          zoom: 1 !important;
          background: #ffffff !important;
          font-size: 9pt !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .receipt-header {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8mm !important;
          align-items: start !important;
        }
        .receipt-header > * {
          min-width: 0 !important;
        }
        .receipt-title {
          font-size: 16pt !important;
        }
        .receipt-table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        .receipt-table th {
          font-size: 8.5pt !important;
        }
        .receipt-table td {
          font-size: 9pt !important;
          overflow-wrap: anywhere !important;
          vertical-align: top !important;
        }
        .receipt-money {
          white-space: nowrap !important;
          text-align: right !important;
        }
        .receipt-total-val {
          font-size: 15pt !important;
        }
        thead {
          display: table-header-group !important;
        }
        tr,
        .receipt-section,
        .receipt-total,
        .receipt-footer {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `}</style>
  );
}

export function PaymentReceiptDocument({ payment }: { payment: Payment }) {
  const branding = resolveDocumentBranding(payment.receiptBranding, payment.branch);
  const treatments = payment.treatmentRefs ?? payment.treatments ?? [];
  const methods = payment.paymentMethods?.length
    ? payment.paymentMethods
    : [{ name: payment.paymentMethod.name, amount: Number(payment.amount), reference: payment.reference ?? null }];

  return (
    <article className="receipt-shell flex flex-col mx-auto min-h-[1122px] max-w-[794px] bg-white px-8 py-8 shadow-xl">
      <div className="receipt-content flex-grow">
        <ReceiptHeader
          branding={branding}
          branchName={payment.branch.name}
          title="Comprobante de pago"
          meta={[
            ["Fecha transaccion", dateOnly(payment.paidAt)],
            ["Fecha impresion", dateOnly(new Date().toISOString())],
            ["Pago", `#${payment.paymentNumber}`]
          ]}
        />
        <PatientBlock patient={payment.patient} />

        <section className="receipt-section mb-7">
          <h3 className="mb-4 text-sm font-bold text-slate-800 border-l-2 border-sky-600 pl-2">Tratamientos pagados:</h3>
          {treatments.length ? (
            treatments.map((treatment) => (
              <div key={treatment.id} className="mb-5">
                <div className="border-y border-slate-400 py-2 text-xs font-bold uppercase">
                  {treatment.name} - No {treatment.number}
                </div>
                <ReceiptBreakdownTable rows={payment.breakdown.filter((row) => row.treatmentNumber === treatment.number)} paymentNumber={payment.paymentNumber} />
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">Pago recibido sin aplicaciones a tratamiento.</p>
          )}
        </section>

        <TransactionTable
          rows={methods.map((method) => ({
            paymentNumber: payment.paymentNumber,
            method: method.name,
            reference: method.reference ?? "-",
            date: dateOnly(payment.paidAt),
            amount: Number(method.amount)
          }))}
          total={Number(payment.amount)}
        />
      </div>

      <ReceiptFooter branding={branding} branchName={payment.branch.name} />
    </article>
  );
}

export function DailyReceiptDocument({ receipt }: { receipt: DailyPaymentReceipt }) {
  const branding = resolveDocumentBranding(receipt.receiptBranding, receipt.branch);

  return (
    <article className="receipt-shell flex flex-col mx-auto min-h-[1122px] max-w-[794px] bg-white px-8 py-8 shadow-xl">
      <div className="receipt-content flex-grow">
        <ReceiptHeader
          branding={branding}
          branchName={receipt.branch.name}
          title="Comprobante de pago diario"
          meta={[
            ["Fecha transaccion", localDateLabel(receipt.date)],
            ["Fecha impresion", dateOnly(new Date().toISOString())],
            ["Pagos", receipt.paymentNumbers.join(", ")]
          ]}
        />
        <PatientBlock patient={receipt.patient} />

        <section className="receipt-section mb-7">
          <h3 className="mb-4 text-sm font-bold text-slate-800 border-l-2 border-sky-600 pl-2">Tratamientos pagados:</h3>
          {receipt.treatments.length ? (
            receipt.treatments.map((treatment) => (
              <div key={treatment.id} className="mb-5">
                <div className="border-y border-slate-400 py-2 text-xs font-bold uppercase">
                  {treatment.name} - No {treatment.number}
                </div>
                <ReceiptBreakdownTable rows={receipt.breakdown.filter((row) => row.treatmentNumber === treatment.number)} />
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">Pagos recibidos sin aplicaciones a tratamiento.</p>
          )}
        </section>

        <TransactionTable
          rows={receipt.paymentMethods.map((method) => ({
            paymentNumber: method.paymentNumber,
            method: method.name,
            reference: method.reference ?? "-",
            date: localDateLabel(receipt.date),
            amount: Number(method.amount)
          }))}
          total={receipt.totalAmount}
        />
      </div>

      <ReceiptFooter branding={branding} branchName={receipt.branch.name} />
    </article>
  );
}

export function ReceiptEmailModal({
  open,
  title,
  patientEmail,
  subject,
  message,
  attachmentName,
  onClose,
  onSend
}: {
  open: boolean;
  title: string;
  patientEmail?: string | null;
  subject: string;
  message: string;
  attachmentName: string;
  onClose: () => void;
  onSend: (payload: { to: string; subject: string; message: string; idempotencyKey: string }) => Promise<ReceiptEmailResponse>;
}) {
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftMessage, setDraftMessage] = useState(message);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [result, setResult] = useState<ReceiptEmailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const to = patientEmail?.trim() ?? "";

  useEffect(() => {
    if (!open) return;
    setDraftSubject(subject);
    setDraftMessage(message);
    setPreview(false);
    setStatus("idle");
    setResult(null);
    setErrorMessage(null);
  }, [open, subject, message]);

  const handleSend = async () => {
    if (!to) return;
    setSending(true);
    setStatus("sending");
    setResult(null);
    setErrorMessage(null);
    try {
      const response = await onSend({ to, subject: draftSubject, message: draftMessage, idempotencyKey: createIdempotencyKey() });
      setResult(response);
      setStatus("sent");
      toast.success("Comprobante enviado por correo correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible enviar el correo.";
      setErrorMessage(message);
      setStatus("failed");
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose} size="xl">
      <div className="receipt-modal-only space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Correo del paciente</p>
          {to ? <p className="text-sm text-slate-900">{to}</p> : <p className="text-sm text-rose-700">El paciente no tiene un correo registrado.</p>}
        </div>
        {status === "sent" && result ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold">Comprobante enviado</p>
                <p className="mt-1 text-emerald-900">
                  Se envio a {result.recipient}. Adjunto: <span className="font-medium">{result.attachmentName}</span>.
                </p>
                {result.sentAt ? <p className="mt-1 text-xs text-emerald-800">Registro: {dateTime(result.sentAt)}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
        {status === "failed" && errorMessage ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</div> : null}
        <Input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} disabled={!to || sending} />
        <Textarea className="min-h-[200px]" value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} disabled={!to || sending} />
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Adjunto: <span className="font-medium text-slate-700">{attachmentName}</span>
        </p>
        {preview ? <pre className="max-h-56 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs whitespace-pre-wrap">{draftMessage}</pre> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setPreview((value) => !value)}>
            Previsualizar
          </Button>
          {status === "sent" ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
              <Button type="button" disabled={!to || sending} onClick={() => void handleSend()}>
                <RotateCcw className="h-4 w-4" />
                Enviar nuevamente
              </Button>
            </>
          ) : (
            <Button type="button" disabled={!to || sending} onClick={() => void handleSend()}>
              <Mail className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar correo"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ReceiptHeader({ branding, branchName, title, meta }: { branding: ReceiptBranding; branchName: string; title: string; meta: Array<[string, string]> }) {
  const isSame = branding.businessName.toLowerCase().trim() === branchName.toLowerCase().trim();
  return (
    <>
      <header className="receipt-header flex items-start justify-between gap-8 border-b border-slate-300 pb-4">
        <div className="flex min-w-0 items-start gap-4">
          <BrandMark branding={branding} />
          <div className="min-w-0">
            <div className="text-2xl font-black tracking-tight text-sky-700">{branding.businessName}</div>
            {!isSame && <p className="mt-1 text-xs font-medium text-slate-600">{branchName}</p>}
            <div className="mt-2 space-y-0.5 text-xs leading-5 text-slate-500">
              {branding.address ? <p>{branding.address}</p> : null}
              {branding.phone ? <p>{branding.phone}</p> : null}
              {branding.email ? <p>{branding.email}</p> : null}
            </div>
          </div>
        </div>
        <div className="text-right text-xs leading-5 text-slate-600">
          {meta.map(([label, value]) => (
            <p key={label}>
              <strong>{label}:</strong> {value}
            </p>
          ))}
        </div>
      </header>
      <h2 className="receipt-title my-8 text-center text-xl font-bold">{title}</h2>
    </>
  );
}

function PatientBlock({ patient }: { patient: Payment["patient"] }) {
  return (
    <section className="receipt-section mb-7">
      <h3 className="mb-3 text-sm font-bold text-slate-800 border-l-2 border-sky-600 pl-2">Paciente:</h3>
      <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs">
        <Info label="Nombre" value={fullName(patient)} />
        <Info label="Fecha de nacimiento" value={patient.birthDate ? dateOnly(patient.birthDate) : "-"} />
        <Info label="Documento" value={patient.documentNumber ?? "-"} />
        <Info label="Convenio" value={patient.agreement?.name ?? "-"} />
      </div>
    </section>
  );
}

function ReceiptBreakdownTable({ rows, paymentNumber }: { rows: Array<Payment["breakdown"][number] & { paymentNumber?: string }>; paymentNumber?: string }) {
  return (
    <table className="receipt-table mt-3 w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-300 bg-slate-50 text-left text-slate-600">
          <th className="py-2 px-3 font-semibold">Prestación</th>
          <th className="py-2 px-3 font-semibold text-center">Pieza(s)</th>
          <th className="py-2 px-3 font-semibold text-center">No. Pago</th>
          <th className="py-2 px-3 font-semibold text-right">Precio</th>
          <th className="py-2 px-3 font-semibold text-right">Pagado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.id}-${row.paymentNumber ?? paymentNumber}`} className="border-b border-slate-100 text-slate-800">
            <td className="py-2.5 px-3 font-medium">{humanizeBreakdownDetail(row.detail)}</td>
            <td className="py-2.5 px-3 text-center text-slate-500">{pieceFromDetail(row.detail)}</td>
            <td className="py-2.5 px-3 text-center text-slate-500">{row.paymentNumber ?? paymentNumber ?? "-"}</td>
            <td className="py-2.5 px-3 text-right text-slate-500">{money(row.baseAmount)}</td>
            <td className="receipt-money py-2.5 px-3 text-right font-bold text-slate-900">{money(row.paidAmount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TransactionTable({ rows, total }: { rows: Array<{ paymentNumber: string; method: string; reference: string; date: string; amount: number }>; total: number }) {
  return (
    <section className="receipt-section mb-7">
      <h3 className="mb-4 text-sm font-bold text-slate-800 border-l-2 border-sky-600 pl-2">Transacción:</h3>
      <table className="receipt-table w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-50 text-left text-slate-600">
            <th className="py-2 px-3 font-semibold">No. Pago</th>
            <th className="py-2 px-3 font-semibold">Factura/Boleta</th>
            <th className="py-2 px-3 font-semibold">Medio de pago</th>
            <th className="py-2 px-3 font-semibold">Referencia</th>
            <th className="py-2 px-3 font-semibold">Fecha</th>
            <th className="py-2 px-3 font-semibold text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.paymentNumber}-${row.method}-${index}`} className="border-b border-slate-100 text-slate-800">
              <td className="py-2.5 px-3 font-medium">{row.paymentNumber}</td>
              <td className="py-2.5 px-3 text-slate-500">-</td>
              <td className="py-2.5 px-3 text-slate-700">{row.method}</td>
              <td className="py-2.5 px-3 text-slate-500">{row.reference}</td>
              <td className="py-2.5 px-3 text-slate-600">{row.date}</td>
              <td className="receipt-money py-2.5 px-3 text-right font-bold text-slate-900">{money(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="receipt-total bg-slate-50/50">
            <td colSpan={5} className="py-3 px-3 text-right font-bold text-slate-700">Total:</td>
            <td className="receipt-money receipt-total-val py-3 px-3 text-right font-extrabold text-lg text-sky-700">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function ReceiptFooter({ branding, branchName }: { branding: ReceiptBranding; branchName: string }) {
  const isSame = branding.businessName.toLowerCase().trim() === branchName.toLowerCase().trim();
  return (
    <footer className="receipt-footer mt-24 grid grid-cols-[1fr_1.4fr] gap-8 border-t border-slate-200 pt-5 text-[10px] leading-4 text-slate-400">
      <div>
        <p className="font-bold text-slate-700">{branding.businessName}</p>
        {!isSame && <p>{branchName}</p>}
        {branding.address ? <p>{branding.address}</p> : null}
        {branding.phone ? <p>{branding.phone}</p> : null}
        {branding.email ? <p>{branding.email}</p> : null}
      </div>
      <p>Documento generado por Dentalink. Al iniciar este tratamiento el paciente acepta las políticas y condiciones de la clínica.</p>
    </footer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-1.5 pt-0.5">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="text-slate-900 font-bold">{value}</span>
    </div>
  );
}

export function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(value ?? 0) || 0);
}

export function dateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

export function localDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function fullName(patient: { firstName?: string | null; lastName?: string | null }) {
  return `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim();
}

function pieceFromDetail(detail: string) {
  const match = /Pieza\s+([^\s-]+)/i.exec(detail);
  return match?.[1] ?? "-";
}

function humanizeBreakdownDetail(detail: string) {
  return detail.replace(/\s+-\s+Cara\s+ALL\b/gi, " - Pieza completa");
}

function resolveDocumentBranding(branding: ReceiptBranding | null | undefined, branch: Payment["branch"]): ReceiptBranding {
  if (branding) return branding;
  return {
    businessName: branch.brand?.shortName || branch.brand?.name || branch.name || "Clinica",
    legalName: branch.brand?.legalName ?? null,
    logoUrl: branch.brand?.logoUrl ?? null,
    address:
      [branch.address, branch.exteriorNumber, branch.interiorNumber ? `Int. ${branch.interiorNumber}` : null, branch.neighborhood, branch.municipality || branch.city, branch.state, branch.postalCode]
        .filter(Boolean)
        .join(", ") || null,
    phone: branch.phone ?? null,
    email: branch.replyToEmail || branch.email || branch.brand?.replyToEmail || branch.brand?.senderEmail || null,
    website: branch.website || branch.brand?.website || null,
    privacyNoticeUrl: branch.brand?.privacyNoticeUrl ?? null,
    primaryColor: branch.brand?.primaryColor ?? null,
    secondaryColor: branch.brand?.secondaryColor ?? null
  };
}

function BrandMark({ branding }: { branding: ReceiptBranding }) {
  if (branding.logoUrl) {
    return <img src={branding.logoUrl} alt={branding.businessName} className="h-14 w-28 shrink-0 object-contain object-left" />;
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-sky-700 text-sm font-black text-white">
      {brandInitials(branding.businessName)}
    </div>
  );
}

function brandInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "DS"
  );
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX");
}
