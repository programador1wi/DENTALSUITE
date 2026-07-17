import { useState, useEffect, useRef, useLayoutEffect, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { ChevronDown, FileText, Mail, Pencil, Printer, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { usePatientPayments, usePaymentsMutations } from "@/features/payments/hooks/use-payments";
import { sendDailyReceiptEmail, sendPaymentReceiptEmail, type Payment, type PaymentStatus, type RefundStatus } from "@/features/payments/services/payments.service";
import { ReceiptEmailModal } from "@/features/payments/components/payment-receipt-document";
import { useBudgets } from "@/features/treatments/hooks/use-treatments";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import {
  paymentStatusLabels,
  refundStatusLabels,
  money,
  dateTime,
  dateOnly,
  userName,
  patientName,
  paymentLocalDate,
  localDateLabel,
  buildReceiptEmailDefaults,
  paymentStatusTone,
  refundStatusTone,
  toDateTimeLocal
} from "./shared-helpers";

function BillingMetric({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "success" | "danger" }) {
  return (
    <div className="flex flex-col gap-1 p-4 border rounded-lg bg-muted/50">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">({hint})</span>}
      </div>
    </div>
  );
}

import { useParams } from "react-router-dom";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";

export function PaymentsView() {
  const { id = "" } = useParams();
  const payments = usePatientPayments(id);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [breakdownPayment, setBreakdownPayment] = useState<Payment | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [emailReceipt, setEmailReceipt] = useState<{ kind: "payment" | "daily"; payment: Payment; date?: string; dailyPayments?: Payment[] } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const mutations = usePaymentsMutations();
  const { hasPermission } = usePermissions();
  
  if (payments.isLoading) return <LoadingState message="Cargando..." />;
  if (payments.isError || !payments.data) return <ErrorState message="Error al cargar pagos" />;
  
  const rows = payments.data.payments.filter((p) => p.status !== "VOIDED");
  const canUpdate = hasPermission("payments.update") || hasPermission("system.manage_all");
  const canVoid = hasPermission("payments.refund") || hasPermission("system.manage_all");

  const handleViewReceipt = (payment: Payment) => {
    window.open(`/payments/${encodeURIComponent(payment.paymentNumber)}/receipt`, "_blank", "noopener,noreferrer");
  };

  const handleViewDailyReceipt = (payment: Payment) => {
    const date = paymentLocalDate(payment);
    const url = `/patients/${encodeURIComponent(payment.patientId)}/payments/daily-receipt?date=${encodeURIComponent(date)}&branchId=${encodeURIComponent(payment.branchId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSendDaily = (payment: Payment) => {
    const date = paymentLocalDate(payment);
    setEmailReceipt({
      kind: "daily",
      payment,
      date,
      dailyPayments: rows.filter((row) => row.patientId === payment.patientId && row.branchId === payment.branchId && paymentLocalDate(row) === date)
    });
  };

  const handleVoid = async () => {
    if (!voidingPayment || !voidReason.trim()) return;
    await mutations.voidPayment.mutateAsync({ paymentId: voidingPayment.id, reason: voidReason.trim() });
    setVoidingPayment(null);
    setVoidReason("");
  };

  const emailDefaults = emailReceipt ? buildReceiptEmailDefaults(emailReceipt) : null;

  return (
    <>
      <DataTable
        rows={rows}
        empty={<EmptyState title="Sin pagos" description="El paciente no cuenta con pagos en el sistema." />}
        tableClassName="text-[var(--text-sm)]"
        containerClassName="md:!overflow-visible"
        columns={[
          {
            key: "paymentNumber",
            title: "# Pago",
            render: (row) => (
              <div>
                <p className="font-[var(--weight-bold)] text-[var(--text-primary)]">{row.paymentNumber}</p>
                {row.reference ? <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">Referencia: {row.reference}</p> : null}
              </div>
            )
          },
          {
            key: "treatmentRefs",
            title: "# Trat.",
            render: (row) => {
              const refs = row.treatmentRefs ?? row.treatments ?? [];
              if (!refs.length) return "-";
              return (
                <div className="flex flex-wrap gap-1">
                  {refs.map((treatment, idx) => (
                    <span key={treatment.id}>
                      <Link
                        to={`/patients/${row.patientId}/treatments?planId=${treatment.id}`}
                        className="text-[var(--text-brand)] hover:underline font-[var(--weight-medium)]"
                      >
                        {treatment.number}
                      </Link>
                      {idx < refs.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              );
            }
          },
          {
            key: "paymentMethod",
            title: "Medio de pago",
            render: (row) => (
              <div>
                <p className="font-[var(--weight-medium)] text-[var(--text-primary)]">
                  {row.paymentMethods && row.paymentMethods.length > 1 ? `Pago mixto Â· ${row.paymentMethods.length} medios` : row.paymentMethods?.[0]?.name ?? row.paymentMethod.name}
                </p>
                {row.paymentMethods && row.paymentMethods.length > 1 ? (
                  <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                    {row.paymentMethods.map((method) => method.name).join(" + ")}
                  </p>
                ) : null}
                <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                  Recibido por {userName(row.receivedBy)}, en sucursal {row.branch.name}
                </p>
              </div>
            ),
            wrap: true
          },
          { key: "ticketId", title: "ID ticket", render: (row) => row.ticketId ?? "-" },
          { key: "paidAt", title: "Recepcion", render: (row) => dateTime(row.paidAt) },
          { key: "dueDate", title: "Vencimiento", render: (row) => (row.dueDate ? dateOnly(row.dueDate) : "-") },
          {
            key: "amount",
            title: "Monto",
            render: (row) => (
              <div className="text-right">
                <p className="font-[var(--weight-bold)] text-[var(--text-primary)]">{money(row.amount)}</p>
                <button type="button" className="text-[var(--text-xs)] text-[var(--text-brand)] hover:underline" onClick={() => setBreakdownPayment(row)}>
                  Ver desglose
                </button>
              </div>
            )
          },
          { key: "status", title: "Estado", render: (row) => <Badge value={paymentStatusLabels[row.status]} tone={paymentStatusTone(row.status)} /> },
          {
            key: "receipt",
            title: "Acciones",
            render: (row) => (
              <PaymentActionsMenu
                row={row}
                open={actionsFor === row.id}
                onToggle={() => setActionsFor(actionsFor === row.id ? null : row.id)}
                onClose={() => setActionsFor(null)}
                onViewReceipt={() => handleViewReceipt(row)}
                onViewDailyReceipt={() => handleViewDailyReceipt(row)}
                onSendReceipt={() => setEmailReceipt({ kind: "payment", payment: row })}
                onSendDailyReceipt={() => handleSendDaily(row)}
                onEdit={() => setEditingPayment(row)}
                onVoid={() => setVoidingPayment(row)}
                canUpdate={canUpdate && row.status !== "VOIDED" && row.status !== "REFUNDED"}
                canVoid={canVoid && row.status !== "VOIDED" && row.status !== "REFUNDED"}
              />
            )
          }
        ]}
      />

      <PaymentBreakdownModal payment={breakdownPayment} onClose={() => setBreakdownPayment(null)} />
      <EditPaymentModal payment={editingPayment} onClose={() => setEditingPayment(null)} />
      {emailDefaults ? (
        <ReceiptEmailModal
          open={Boolean(emailReceipt)}
          title={emailReceipt?.kind === "daily" ? "Enviar comprobante de pago diario" : "Enviar comprobante de pago"}
          patientEmail={emailReceipt?.payment.patient.email}
          subject={emailDefaults.subject}
          message={emailDefaults.message}
          attachmentName={emailDefaults.attachmentName}
          onClose={() => setEmailReceipt(null)}
          onSend={(payload) =>
            emailReceipt?.kind === "daily"
              ? sendDailyReceiptEmail(emailReceipt.payment.patientId, { date: emailReceipt.date ?? paymentLocalDate(emailReceipt.payment), branchId: emailReceipt.payment.branchId }, payload)
              : sendPaymentReceiptEmail(emailReceipt?.payment.paymentNumber ?? "", payload)
          }
        />
      ) : null}
      <Modal open={Boolean(voidingPayment)} title={`Anular pago #${voidingPayment?.paymentNumber ?? ""}`} onClose={() => setVoidingPayment(null)}>
        <div className="space-y-3">
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">La anulacion revierte aplicaciones y registra contramovimiento de caja. El pago queda auditado.</p>
          <Input placeholder="Motivo obligatorio" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          <div className="flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={() => setVoidingPayment(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" disabled={!voidReason.trim() || mutations.voidPayment.isPending} onClick={() => void handleVoid()}>
              Anular pago
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PaymentActionsMenu({
  row,
  open,
  onToggle,
  onClose,
  onViewReceipt,
  onViewDailyReceipt,
  onSendReceipt,
  onSendDailyReceipt,
  onEdit,
  onVoid,
  canUpdate,
  canVoid
}: {
  row: Payment;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onViewReceipt: () => void;
  onViewDailyReceipt: () => void;
  onSendReceipt: () => void;
  onSendDailyReceipt: () => void;
  onEdit: () => void;
  onVoid: () => void;
  canUpdate: boolean;
  canVoid: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const padding = 12;
      const rect = button.getBoundingClientRect();
      const width = Math.min(360, Math.max(300, window.innerWidth - padding * 2));
      const menuHeight = menuRef.current?.offsetHeight ?? 312;
      const opensUp = rect.bottom + 6 + menuHeight > window.innerHeight - padding && rect.top > menuHeight;
      const top = opensUp ? Math.max(padding, rect.top - menuHeight - 6) : Math.min(rect.bottom + 6, window.innerHeight - padding - menuHeight);
      const left = Math.min(Math.max(padding, rect.right - width), window.innerWidth - width - padding);
      setPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      onClose();
      buttonRef.current?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const run = (callback: () => void) => {
    onClose();
    callback();
  };

  return (
    <div className="flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acciones del pago ${row.paymentNumber}`}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-brand)] bg-transparent px-[var(--space-3)] text-[var(--text-sm)] font-medium text-[var(--text-brand)] transition-colors hover:border-[var(--action-brand-hover)] hover:text-[var(--action-brand-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        onClick={onToggle}
      >
        Acciones <ChevronDown className="h-4 w-4" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Acciones del pago ${row.paymentNumber}`}
              style={{ top: position.top, left: position.left, width: position.width }}
              className="fixed z-[1600] rounded-[var(--radius-lg)] border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5"
            >
              <ActionMenuSection>Comprobantes</ActionMenuSection>
              <ActionMenuButton icon={<Printer />} onClick={() => run(onViewReceipt)}>
                Ver comprobante
              </ActionMenuButton>
              <ActionMenuButton icon={<FileText />} onClick={() => run(onViewDailyReceipt)}>
                Ver comprobante diario
              </ActionMenuButton>
              <ActionMenuSection>Envio</ActionMenuSection>
              <ActionMenuButton icon={<Mail />} onClick={() => run(onSendReceipt)}>
                Enviar comprobante por correo
              </ActionMenuButton>
              <ActionMenuButton icon={<Mail />} onClick={() => run(onSendDailyReceipt)}>
                Enviar comprobante diario por correo
              </ActionMenuButton>
              <ActionMenuSection>Administracion</ActionMenuSection>
              <ActionMenuButton disabled={!canUpdate} icon={<Pencil />} onClick={() => run(onEdit)}>
                Modificar datos del pago
              </ActionMenuButton>
              <div className="my-1 border-t border-slate-100" />
              <ActionMenuButton danger disabled={!canVoid} icon={<Trash2 />} onClick={() => run(onVoid)}>
                Anular pago
              </ActionMenuButton>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function ActionMenuButton({
  children,
  danger,
  disabled,
  icon,
  onClick
}: {
  children: string;
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm leading-5 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 ${
        danger
          ? "text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-300 [&_svg]:text-rose-600"
          : "text-slate-800 hover:bg-sky-50 hover:text-sky-900 focus-visible:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-300 [&_svg]:text-slate-500"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 whitespace-normal sm:whitespace-nowrap">{children}</span>
    </button>
  );
}

function ActionMenuSection({ children }: { children: string }) {
  return <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 first:pt-1">{children}</div>;
}

function PaymentBreakdownModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  if (!payment) return null;

  return (
    <Modal open={Boolean(payment)} title={`Desglose de pago #${payment.paymentNumber}`} onClose={onClose} size="xl">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[var(--text-sm)]">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-xs)] font-[var(--weight-bold)] text-[var(--text-secondary)]">
              <th className="px-[var(--space-3)] py-[var(--space-2)]"># Trat.</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)]">Detalle</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)] text-right">Precio</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)] text-right">Pagado</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)] text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {payment.breakdown.length ? (
              payment.breakdown.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-default)]">
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-brand)]">{row.treatmentNumber}</td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)]">
                    <p className="font-[var(--weight-medium)] text-[var(--text-primary)]">{row.detail}</p>
                    <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{row.treatmentName}</p>
                  </td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{money(row.baseAmount)}</td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{money(row.paidAmount)}</td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{money(row.remainingAmount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-[var(--space-3)] py-[var(--space-4)] text-[var(--text-secondary)]" colSpan={5}>
                  Pago recibido sin aplicaciones a tratamientos o cuotas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-[var(--space-4)] grid gap-[var(--space-3)] md:grid-cols-3">
        <BillingMetric label="Monto pago" value={money(payment.amount)} />
        <BillingMetric label="Aplicado" value={money(payment.allocatedAmount)} tone="success" />
        <BillingMetric label="Sin aplicar" value={money(payment.unallocatedAmount)} tone="danger" />
      </div>
    </Modal>
  );
}

function EditPaymentModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const paymentMethods = usePaymentMethods(undefined, "true");
  const financialInstitutions = useFinancialInstitutions(undefined, "true");
  const mutations = usePaymentsMutations();
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [financialInstitutionId, setFinancialInstitutionId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState("");

  useEffect(() => {
    if (!payment) return;
    setPaymentMethodId(payment.paymentMethod.id);
    setFinancialInstitutionId(payment.financialInstitution?.id ?? "");
    setReference(payment.reference ?? "");
    setNotes(payment.notes ?? "");
    setPaidAt(toDateTimeLocal(payment.paidAt));
  }, [payment]);

  if (!payment) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await mutations.updatePayment.mutateAsync({
      paymentId: payment.id,
      payload: {
        paymentMethodId,
        financialInstitutionId,
        reference,
        notes,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined
      }
    });
    onClose();
  };

  return (
    <Modal open={Boolean(payment)} title={`Modificar pago #${payment.paymentNumber}`} onClose={onClose} size="lg">
      <form className="grid gap-[var(--space-3)]" onSubmit={(event) => void handleSubmit(event)}>
        <Select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
          <option value="">Metodo de pago</option>
          {paymentMethods.data?.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </Select>
        <Select value={financialInstitutionId} onChange={(event) => setFinancialInstitutionId(event.target.value)}>
          <option value="">Banco / entidad</option>
          {financialInstitutions.data?.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </Select>
        <Input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        <Input placeholder="Referencia" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Input placeholder="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="flex justify-end gap-[var(--space-2)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!paymentMethodId || mutations.updatePayment.isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}








