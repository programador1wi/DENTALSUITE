import { Plus, Trash2, UserRound, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type {
  TreatmentPlanClinicalStatus,
  TreatmentPlanFinancialSummary,
  TreatmentPlanKind,
  TreatmentPlanStatus
} from "@/features/treatments/services/treatments.service";
import {
  formatDate,
  money,
  numberValue,
  numericId,
  planClinicalProgressPercentage,
  planHasFinancialDebt
} from "./treatment-modal-helpers";
import { PLAN_KIND_LABELS } from "./new-treatment-plan-modal";

const PLAN_CLINICAL_STATUS_LABELS: Record<TreatmentPlanClinicalStatus, string> = {
  NOT_STARTED: "Sin iniciar",
  IN_PROGRESS: "En ejecucion",
  READY_TO_COMPLETE: "Listo para finalizar",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
  REJECTED: "Rechazado"
};

function planClinicalStatus(plan: {
  status: TreatmentPlanStatus;
  clinicalStatus?: TreatmentPlanClinicalStatus;
}): TreatmentPlanClinicalStatus {
  return (
    plan.clinicalStatus ??
    (plan.status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : plan.status === "COMPLETED"
        ? "COMPLETED"
        : plan.status === "CANCELLED"
          ? "CANCELLED"
          : plan.status === "REJECTED"
            ? "REJECTED"
            : "NOT_STARTED")
  );
}

function PlanFinancialStatus({ summary }: { summary?: TreatmentPlanFinancialSummary | null }) {
  if (!summary) return <span className="text-xs font-medium text-slate-400">Sin cálculo</span>;
  const tone =
    summary.situation.code === "DEBT"
      ? "bg-red-50 text-red-700 border-red-200/80"
      : summary.situation.code === "NO_AVAILABLE_BALANCE"
        ? "bg-amber-50 text-amber-800 border-amber-200/80"
        : summary.situation.code === "CANCELLED"
          ? "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  const amount = summary.situation.amount ? ` ${money(numberValue(summary.situation.amount))}` : "";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-xs ${tone}`}>
      {summary.situation.label}
      {amount}
    </span>
  );
}

function displayPlanSpecialty(plan: {
  kind?: TreatmentPlanKind;
  specialtySnapshotName?: string | null;
  specialty?: { name: string } | null;
}) {
  return (
    plan.specialtySnapshotName ??
    plan.specialty?.name ??
    (plan.kind ? PLAN_KIND_LABELS[plan.kind] : "General / Integral")
  );
}

export type TreatmentPlanListItem = {
  id: string;
  name: string;
  status: TreatmentPlanStatus;
  clinicalStatus?: TreatmentPlanClinicalStatus;
  kind?: TreatmentPlanKind;
  specialtySnapshotName?: string | null;
  specialty?: { name: string } | null;
  professional: { id: string; firstName: string; lastName: string };
  financialSummary?: TreatmentPlanFinancialSummary | null;
  clinicalProgress?: { displayPercentage?: number; percentage?: number } | null;
  items?: Array<{ status: any; completionPercentage?: number | null }>;
  appointments?: Array<{ startAt: string }>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function TreatmentPlanCardsList({
  planList,
  onSelectPlan,
  onOpenCreatePlan,
  creatingPlan
}: {
  planList: TreatmentPlanListItem[];
  onSelectPlan: (planId: string) => void;
  onOpenCreatePlan: () => void;
  creatingPlan?: boolean;
}) {
  const renderCard = (item: TreatmentPlanListItem) => {
    const numericCode = numericId(item.id);
    const clinicalStatus = planClinicalStatus(item);
    const clinicalProgress = planClinicalProgressPercentage(item);

    return (
      <div
        key={item.id}
        className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white transition-all duration-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/5 cursor-pointer shadow-sm"
        onClick={() => onSelectPlan(item.id)}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-sky-700 transition-colors group-hover:text-sky-800 sm:text-lg">
              #{numericCode}: {item.name}
            </span>
            <div
              className="rounded-md p-1 text-sky-600 transition-colors hover:bg-sky-100/70"
              title="Editar plan"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
            }}
            title="Eliminar plan"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Card Columns Body */}
        <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:px-6 md:grid-cols-6 md:gap-3 items-center">
          {/* 1. Profesional */}
          <div className="min-w-0">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Profesional
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                <UserRound className="h-3.5 w-3.5" />
              </div>
              <span className="truncate leading-snug">
                {item.professional.firstName} {item.professional.lastName}
              </span>
            </div>
          </div>

          {/* 2. Especialidad */}
          <div className="min-w-0">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Especialidad
            </div>
            <div className="truncate text-sm font-medium text-slate-700">
              {displayPlanSpecialty(item)}
            </div>
          </div>

          {/* 3. Última cita */}
          <div className="min-w-0">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Ultima cita
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <CalendarClock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {item.appointments?.[0]?.startAt
                  ? formatDate(item.appointments[0].startAt)
                  : "Sin sesiones"}
              </span>
            </div>
          </div>

          {/* 4. Progreso clínico */}
          <div className="flex flex-col items-start min-w-0">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Progreso clinico
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={clinicalProgress === 100 ? "text-emerald-500" : "text-sky-600"}
                    strokeDasharray={`${clinicalProgress}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[11px] font-bold text-slate-700">{clinicalProgress}%</span>
              </div>
            </div>
          </div>

          {/* 5. Estado clínico */}
          <div className="min-w-0">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Estado clinico
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="truncate">{PLAN_CLINICAL_STATUS_LABELS[clinicalStatus]}</span>
            </div>
          </div>

          {/* 6. Estado financiero */}
          <div className="min-w-0">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Estado financiero
            </div>
            <PlanFinancialStatus summary={item.financialSummary} />
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs font-medium text-slate-500 sm:px-6">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="text-slate-500">Presupuesto:</span>
            <span className="text-sm font-bold text-slate-900">
              {money(numberValue(item.financialSummary?.budgetAmount))}
            </span>
          </div>
          <div className="text-slate-400">
            Creado {formatDate(item.createdAt)} · Última actividad {formatDate(item.updatedAt)}
          </div>
        </div>
      </div>
    );
  };

  const finalizedWithDebt = planList.filter(
    (p) => planClinicalStatus(p) === "COMPLETED" && planHasFinancialDebt(p)
  );
  const inProgress = planList.filter(
    (p) => planClinicalStatus(p) === "IN_PROGRESS" && !finalizedWithDebt.includes(p)
  );
  const others = planList.filter(
    (p) => !inProgress.includes(p) && !finalizedWithDebt.includes(p)
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 bg-white border border-slate-200 p-4 rounded-md shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-normal text-slate-700">Planes de tratamiento</h2>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-sm font-medium text-sky-600 cursor-pointer flex items-center gap-1 hover:text-sky-700">
            Tratamientos activos{" "}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <Button
            onClick={onOpenCreatePlan}
            disabled={creatingPlan}
            className="bg-[#5cb85c] text-white hover:bg-[#4cae4c] h-10 rounded shadow-sm px-4 font-semibold"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo plan de tratamiento
          </Button>
        </div>
      </div>

      {!planList.length ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-2">
          <EmptyState
            title="Sin planes de tratamiento"
            description="Crea el primer plan para activar odontograma, precios y presupuesto."
          />
          <Button className="mt-4" onClick={onOpenCreatePlan}>
            Crear plan inicial
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* En ejecución */}
          <div>
            <h3 className="text-2xl font-normal text-sky-600 mb-6">En ejecución</h3>
            {inProgress.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm font-medium">
                El paciente no cuenta con tratamientos en ejecución
              </div>
            ) : (
              <div className="space-y-4">{inProgress.map(renderCard)}</div>
            )}
          </div>

          {/* Otros */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-2xl font-normal text-slate-500">Otros</h3>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>
            {others.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm font-medium">
                No hay otros planes registrados
              </div>
            ) : (
              <div className="space-y-4">{others.map(renderCard)}</div>
            )}
          </div>

          {finalizedWithDebt.length ? (
            <div>
              <div className="mb-6 flex items-center gap-4">
                <h3 className="text-2xl font-normal text-red-600">
                  Presupuestos finalizados con deudas
                </h3>
                <div className="h-px flex-1 bg-red-200" />
              </div>
              <div className="space-y-4">{finalizedWithDebt.map(renderCard)}</div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
