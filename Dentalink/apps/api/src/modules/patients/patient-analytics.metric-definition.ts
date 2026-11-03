import { AppointmentStatus, TreatmentPlanItemStatus } from "@prisma/client";

export const PATIENT_ANALYTICS_METRIC_VERSION = "1.0.0";

const DETAIL_METRIC_ALIASES: Record<string, string> = {
  totalPatients: "patients",
  averageAttendance: "attendance",
  accumulatedDebt: "debt",
  pendingBudgets: "pending-budgets"
};

export function normalizePatientAnalyticsDetailMetric(metric: string) {
  return DETAIL_METRIC_ALIASES[metric] ?? metric;
}

export const CONFIRMATION_EVENT_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CONFIRMED_BY_EMAIL,
  AppointmentStatus.CONFIRMED_BY_PHONE,
  AppointmentStatus.CONFIRMED_BY_WHATSAPP
]);

export const ATTENDANCE_EVIDENCE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.COMPLETED
]);

export const ATTENDANCE_DENOMINATOR_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW
]);

export const PATIENT_ANALYTICS_METRICS = {
  scheduledAppointments: {
    formula: "COUNT(DISTINCT appointment.id)",
    denominator: "Citas con paciente y fecha programada dentro del periodo; excluye bloqueos."
  },
  confirmedAppointments: {
    formula:
      "COUNT(DISTINCT appointment.id) con evento de confirmacion historico previo al corte o evidencia COMPLETED",
    denominator: "Citas agendadas del periodo."
  },
  acceptedBudgets: {
    formula:
      "COUNT(DISTINCT appointment.id) vinculada a plan con al menos una prestacion COMPLETED al 100% y no cancelada",
    denominator: "Citas agendadas del periodo."
  },
  attendance: {
    formula: "COMPLETED / (COMPLETED + NO_SHOW) * 100",
    denominator: "Citas pasadas con resultado efectivo COMPLETED o NO_SHOW."
  },
  patients: {
    formula: "COUNT(DISTINCT patient.id)",
    denominator: "Pacientes no eliminados y no fusionados dentro del alcance de sucursal."
  },
  debt: {
    formula:
      "Prestaciones reconocidas - asignaciones validas - descuentos de liquidacion + efecto proporcional de devoluciones",
    denominator: "Planes clinicos vigentes dentro del alcance; importes separados por moneda."
  },
  pendingBudgets: {
    formula: "SUM(item.total - item.performedAmount) de prestaciones vigentes no completadas",
    denominator: "Prestaciones creadas en los ultimos cinco anos, separadas por estado y moneda."
  }
} as const;

export function isConfirmedFromHistory(input: {
  status: AppointmentStatus;
  history: Array<{ newStatus: AppointmentStatus; createdAt: Date }>;
  cutoffAt: Date;
}) {
  if (ATTENDANCE_EVIDENCE_STATUSES.has(input.status)) return true;
  return input.history.some(
    (event) =>
      event.createdAt <= input.cutoffAt &&
      (CONFIRMATION_EVENT_STATUSES.has(event.newStatus) ||
        ATTENDANCE_EVIDENCE_STATUSES.has(event.newStatus))
  );
}

export function isAcceptedTreatmentItem(input: {
  status: TreatmentPlanItemStatus;
  completionPercentage: number;
  completedAt: Date | null;
}, cutoffAt: Date) {
  return (
    input.status === TreatmentPlanItemStatus.COMPLETED &&
    input.completionPercentage === 100 &&
    (!input.completedAt || input.completedAt <= cutoffAt)
  );
}

export function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}
