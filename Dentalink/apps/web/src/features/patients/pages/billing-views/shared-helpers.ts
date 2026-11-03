import { PaymentStatus, RefundStatus, Payment } from "@/features/payments/services/payments.service";

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  RECEIVED: "Recibido",
  PARTIALLY_ALLOCATED: "Parcialmente aplicado",
  ALLOCATED: "Aplicado",
  REFUNDED: "Devuelto",
  VOIDED: "Anulado"
};

export const refundStatusLabels: Record<RefundStatus, string> = {
  PENDING: "Pendiente",
  PROCESSED: "Procesado",
  REJECTED: "Rechazado"
};

export function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(value ?? 0) || 0);
}

export function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX");
}

export function dateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

export function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function userName(user?: { firstName?: string | null; lastName?: string | null } | null) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "-";
}

export function patientName(patient?: { firstName?: string | null; lastName?: string | null } | null) {
  return `${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`.trim() || "Paciente";
}

export function paymentLocalDate(payment: Payment) {
  const timezone = payment.branch.timezone || "America/Mexico_City";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(payment.paidAt));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return new Date(payment.paidAt).toISOString().slice(0, 10);
  }
}

export function localDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function buildReceiptEmailDefaults(request: { kind: "payment" | "daily"; payment: Payment; date?: string; dailyPayments?: Payment[] }) {
  const name = patientName(request.payment.patient);
  const brand = request.payment.receiptBranding?.businessName ?? request.payment.branch.name;
  if (request.kind === "daily") {
    const date = request.date ?? paymentLocalDate(request.payment);
    const dailyPayments = request.dailyPayments?.length ? request.dailyPayments : [request.payment];
    const paymentNumbers = dailyPayments.map((payment) => payment.paymentNumber).join(", ");
    const total = dailyPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    return {
      subject: `Comprobante de pagos del ${localDateLabel(date)} - ${brand}`,
      message: `Hola ${name}:\n\nAdjuntamos el comprobante consolidado de los pagos registrados el ${localDateLabel(date)}.\n\nPagos incluidos: ${paymentNumbers}\nTotal del dia: ${money(total)}\n\nSaludos,\n${brand}`,
      attachmentName: `Comprobante_Diario_${date}.pdf`
    };
  }
  return {
    subject: `Comprobante de pago #${request.payment.paymentNumber} - ${brand}`,
    message: `Hola ${name}:\n\nAdjuntamos el comprobante del pago #${request.payment.paymentNumber} registrado en ${brand}.\n\nFecha: ${dateOnly(request.payment.paidAt)}\nMonto: ${money(request.payment.amount)}\n\nSaludos,\n${brand}`,
    attachmentName: `Comprobante_Pago_${request.payment.paymentNumber}.pdf`
  };
}

export function paymentStatusTone(status: PaymentStatus) {
  if (status === "ALLOCATED") return "success";
  if (status === "REFUNDED" || status === "VOIDED") return "danger";
  return "warning";
}

export function refundStatusTone(status: RefundStatus) {
  if (status === "PROCESSED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}
