import { ReactNode } from "react";
import { Briefcase, Building2, FolderOpen, UserRound } from "lucide-react";
import { money, numberValue, numericId } from "./treatment-modal-helpers";
import type {
  TreatmentPlanDetail,
  TreatmentPlanFinancialSummary
} from "@/features/treatments/services/treatments.service";

export function SummaryLine({
  label,
  value,
  strong,
  hint
}: {
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dotted border-slate-200 pb-1">
      <span className="text-slate-500" title={hint}>
        {label}
      </span>
      <span className={strong ? "font-bold text-slate-950" : "font-medium text-slate-700"}>{value}</span>
    </div>
  );
}

export function FinancialSituationPanel({
  summary
}: {
  summary?: TreatmentPlanFinancialSummary | null;
}) {
  if (!summary) return null;
  const code = summary.situation.code;
  const tone =
    code === "DEBT"
      ? "border-red-200 bg-red-50 text-red-700"
      : code === "NO_AVAILABLE_BALANCE"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : code === "CANCELLED"
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const amount = summary.situation.amount ? money(numberValue(summary.situation.amount)) : null;

  return (
    <details className={`mt-4 rounded-lg border px-3 py-2 ${tone}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold">
        <span>{summary.situation.label}</span>
        {amount ? <span>{amount}</span> : null}
      </summary>
      <div className="mt-3 space-y-1.5 border-t border-current/15 pt-3 text-[11px]">
        <SummaryLine
          label="Deuda clínica"
          value={money(numberValue(summary.debtAmount))}
          hint="Valor realizado que todavía no está cubierto por pagos."
        />
        <SummaryLine
          label="Abonos asignados"
          value={money(numberValue(summary.assignedBalance))}
          hint="Dinero anticipado vinculado al plan disponible para futuras prestaciones."
        />
        <SummaryLine label="Abono libre disponible" value={money(numberValue(summary.freeCreditAmount))} />
        <SummaryLine label="Importe devuelto" value={money(numberValue(summary.refundedAmount))} />
      </div>
    </details>
  );
}

export function SidebarFact({
  icon,
  label,
  value,
  onClick
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-medium text-[#0b8bd8]">{value}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="flex w-full gap-3 rounded-md text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="flex gap-3">{content}</div>;
}

export function PlanSidebar({
  plan,
  totals,
  patientAgreementName,
  upcomingAppointments,
  onOpenAgreement,
  onOpenBranch,
  onOpenRefunds
}: {
  plan: TreatmentPlanDetail;
  totals: {
    subtotal: number;
    discount: number;
    total: number;
    completed: number;
    paid: number;
    balance: number;
  };
  patientAgreementName?: string | null;
  upcomingAppointments: Array<{
    id: string;
    startAt: string;
    status: string;
    professional: { firstName: string; lastName: string };
    branch?: { name: string } | null;
  }>;
  onOpenAgreement: () => void;
  onOpenBranch: () => void;
  onOpenRefunds: () => void;
}) {
  const financial = plan.financialSummary;
  const budgetAmount = numberValue(financial?.budgetAmount ?? totals.total);
  const discountAmount = numberValue(financial?.discountAmount ?? totals.discount);
  const recognizedAmount = numberValue(financial?.recognizedAmount ?? totals.completed);
  const paidAmount = numberValue(financial?.paidAmount ?? totals.paid);
  const outstandingAmount = numberValue(financial?.outstandingAmount ?? totals.balance);

  return (
    <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[#0b8bd8] to-[#23b4c8] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-white/75">Plan de tratamiento</p>
            <h2 className="mt-1 text-xl font-bold leading-tight">{plan.name}</h2>
          </div>
          <span className="rounded bg-white/15 px-2 py-1 text-xs font-semibold">#{numericId(plan.id)}</span>
        </div>

        <div className="mt-5 rounded-lg bg-white p-4 text-slate-900 shadow-sm">
          <p className="text-center text-xs text-slate-500">Presupuesto total</p>
          <p className="mt-1 text-center text-2xl font-semibold text-[#0879d5]">{money(budgetAmount)}</p>
          <div className="mt-4 space-y-2 text-xs">
            <SummaryLine
              label="Presupuesto bruto"
              value={money(numberValue(financial?.grossBudgetAmount ?? totals.subtotal))}
            />
            <SummaryLine label="Descuento comercial" value={money(discountAmount)} />
            <SummaryLine
              label="Realizado"
              value={money(recognizedAmount)}
              hint="Valor financiero reconocido de las prestaciones evolucionadas."
            />
            <SummaryLine
              label="Abonado"
              value={money(paidAmount)}
              hint="Pagos válidos asignados a este plan."
            />
            <SummaryLine
              label="Saldo por abonar"
              value={money(outstandingAmount)}
              strong
              hint="Importe pendiente para completar el presupuesto total."
            />
          </div>
          <FinancialSituationPanel summary={financial} />
        </div>
      </div>

      <div className="space-y-4 p-5 text-sm">
        <SidebarFact
          icon={<UserRound className="h-5 w-5" />}
          label="Profesional a cargo"
          value={`${plan.professional.firstName} ${plan.professional.lastName}`}
        />
        <SidebarFact
          icon={<FolderOpen className="h-5 w-5" />}
          label="Convenio"
          value={patientAgreementName ?? "Sin convenio"}
          onClick={onOpenAgreement}
        />
        <SidebarFact
          icon={<Building2 className="h-5 w-5" />}
          label="Sucursal"
          value={plan.branch.name}
          onClick={onOpenBranch}
        />
        <SidebarFact
          icon={<Briefcase className="h-5 w-5" />}
          label="Reembolsos"
          value="Ver reembolsos"
          onClick={onOpenRefunds}
        />
      </div>

      <div className="border-t border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Citas del paciente</h3>
        <div className="mt-3 space-y-3">
          {upcomingAppointments.length ? (
            upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="text-xs text-slate-500">
                <p className="font-semibold text-slate-800">Cita #{numericId(appointment.id)}</p>
                <p>{formatDateTime(appointment.startAt)}</p>
                <p>
                  Dr(a). {appointment.professional.firstName} {appointment.professional.lastName}
                </p>
                <p>{appointment.branch?.name ?? plan.branch.name}</p>
                <p>{appointment.status}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">No hay citas registradas para mostrar.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(date);
}
