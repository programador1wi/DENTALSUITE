import type { MarketingEligibilityPolicy } from "./marketing-recipient-eligibility.service";

export type MarketingReportParameter = {
  key: string;
  label: string;
  type: "number" | "date" | "month" | "branch" | "professional" | "agreement" | "patientStatus" | "boolean";
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
};

export type MarketingReportDefinition = {
  code: string;
  name: string;
  description: string;
  category: "ACTIVIDAD" | "CITAS" | "PRESUPUESTOS" | "FINANZAS" | "PERSONAL";
  requiredParameters: MarketingReportParameter[];
  optionalParameters: MarketingReportParameter[];
  resultColumns: string[];
  professionalMeaning?: string;
  queryHandler: string;
  eligibilityPolicy: MarketingEligibilityPolicy;
  supportedScopes: Array<"ORGANIZATION" | "BRANCH">;
  permission: string;
  exportable: boolean;
};

const commonColumns = [
  "patientId",
  "documentNumber",
  "firstName",
  "lastName",
  "phone",
  "email",
  "branch",
  "eligibility"
];

const branchParameter: MarketingReportParameter = { key: "branchId", label: "Sucursal", type: "branch" };
const professionalParameter: MarketingReportParameter = {
  key: "professionalId",
  label: "Profesional",
  type: "professional",
  placeholder: "Todos los profesionales"
};

const monthIntervalOptions = [1, 2, 3, 6, 9, 12, 18, 24].map((months) => ({
  value: months,
  label: months === 1 ? "1 mes" : `${months} meses`
}));

export const marketingReportDefinitions: MarketingReportDefinition[] = [
  {
    code: "PATIENTS_TREATED_BY_PROFESSIONAL",
    name: "Pacientes tratados por un profesional",
    description:
      "Pacientes realmente atendidos por el profesional seleccionado que tienen un correo electrónico registrado.",
    category: "CITAS",
    requiredParameters: [{ ...professionalParameter, required: true }],
    optionalParameters: [],
    resultColumns: ["professional", ...commonColumns, "lastAttentionAt"],
    professionalMeaning: "Profesional que atendió al paciente",
    queryHandler: "patientsTreatedByProfessional",
    eligibilityPolicy: "REGISTERED_EMAIL_ONLY",
    supportedScopes: ["ORGANIZATION"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_INACTIVE_MONTHS",
    name: "Pacientes que no han asistido durante X meses",
    description: "Pacientes sin una cita válida dentro del periodo indicado.",
    category: "ACTIVIDAD",
    requiredParameters: [
      {
        key: "months",
        label: "Tiempo sin asistir",
        type: "number",
        required: true,
        defaultValue: 6,
        options: monthIntervalOptions
      }
    ],
    optionalParameters: [
      branchParameter,
      professionalParameter,
      { key: "includeCancelled", label: "Incluir citas anuladas", type: "boolean", defaultValue: false },
      { key: "cutoffDate", label: "Fecha de corte", type: "date" }
    ],
    resultColumns: ["lastProfessional", ...commonColumns, "lastAppointment", "inclusionReason"],
    professionalMeaning: "Profesional de la última cita",
    queryHandler: "patientsInactiveMonths",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_NEW_SINCE",
    name: "Pacientes nuevos desde una fecha",
    description: "Pacientes creados desde la fecha seleccionada.",
    category: "ACTIVIDAD",
    requiredParameters: [{ key: "dateFrom", label: "Desde", type: "date", required: true }],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "createdAt"],
    queryHandler: "patientsNewSince",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_LAST_APPOINTMENT_MONTHS",
    name: "Pacientes cuya última cita fue hace X meses",
    description: "Pacientes cuya actividad clínica más reciente es anterior al periodo.",
    category: "CITAS",
    requiredParameters: [
      {
        key: "months",
        label: "Antigüedad de la última cita",
        type: "number",
        required: true,
        defaultValue: 6,
        options: monthIntervalOptions
      }
    ],
    optionalParameters: [branchParameter, professionalParameter],
    resultColumns: ["lastProfessional", ...commonColumns, "lastAppointment"],
    professionalMeaning: "Profesional de la última cita",
    queryHandler: "patientsLastAppointmentMonths",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "BUDGETS_NOT_STARTED_MONTH",
    name: "Pacientes con presupuestos no iniciados durante un mes",
    description: "Presupuestos en borrador o enviados, sin tratamiento iniciado.",
    category: "PRESUPUESTOS",
    requiredParameters: [{ key: "month", label: "Mes", type: "month", required: true }],
    optionalParameters: [branchParameter, professionalParameter],
    resultColumns: ["professional", ...commonColumns, "budgetStatus", "budgetTotal"],
    professionalMeaning: "Profesional del presupuesto",
    queryHandler: "budgetsNotStartedMonth",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_BY_AGREEMENT",
    name: "Pacientes pertenecientes a un convenio",
    description: "Pacientes asociados al convenio seleccionado.",
    category: "PERSONAL",
    requiredParameters: [{ key: "agreementId", label: "Convenio", type: "agreement", required: true }],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "agreement"],
    queryHandler: "patientsByAgreement",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "BUDGETS_UNFINISHED_BETWEEN",
    name: "Pacientes con presupuestos no finalizados entre fechas",
    description: "Presupuestos activos creados dentro del rango indicado.",
    category: "PRESUPUESTOS",
    requiredParameters: [
      { key: "dateFrom", label: "Desde", type: "date", required: true },
      { key: "dateTo", label: "Hasta", type: "date", required: true }
    ],
    optionalParameters: [branchParameter, professionalParameter],
    resultColumns: ["professional", ...commonColumns, "budgetStatus", "budgetTotal"],
    professionalMeaning: "Profesional del presupuesto",
    queryHandler: "budgetsUnfinishedBetween",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "BIRTHDAYS_THIS_MONTH",
    name: "Pacientes de cumpleaños este mes",
    description: "Pacientes cuyo cumpleaños ocurre durante el mes actual.",
    category: "PERSONAL",
    requiredParameters: [],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "birthDate"],
    queryHandler: "birthdaysThisMonth",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "BIRTHDAYS_TODAY",
    name: "Pacientes de cumpleaños hoy",
    description: "Pacientes que cumplen años en la fecha actual.",
    category: "PERSONAL",
    requiredParameters: [],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "birthDate"],
    queryHandler: "birthdaysToday",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "ALL_PATIENTS",
    name: "Todos los pacientes",
    description: "Todos los pacientes visibles dentro del alcance autorizado.",
    category: "PERSONAL",
    requiredParameters: [],
    optionalParameters: [branchParameter],
    resultColumns: commonColumns,
    queryHandler: "allPatients",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "DEBTOR_PATIENTS",
    name: "Pacientes morosos",
    description: "Pacientes con casos de cobranza y saldo pendiente.",
    category: "FINANZAS",
    requiredParameters: [],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "debt"],
    queryHandler: "debtorPatients",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_DEBT_UNTIL_DATE",
    name: "Pacientes con deuda hasta una fecha",
    description: "Pacientes con deuda registrada antes de la fecha de corte.",
    category: "FINANZAS",
    requiredParameters: [{ key: "cutoffDate", label: "Fecha de corte", type: "date", required: true }],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "debt"],
    queryHandler: "patientsDebtUntilDate",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_ATTENDED_TODAY",
    name: "Pacientes atendidos hoy",
    description: "Pacientes con cita de hoy que no está anulada.",
    category: "CITAS",
    requiredParameters: [],
    optionalParameters: [branchParameter, professionalParameter],
    resultColumns: ["professional", ...commonColumns, "lastAppointment"],
    professionalMeaning: "Profesional que atendió hoy",
    queryHandler: "patientsAttendedToday",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  },
  {
    code: "PATIENTS_BY_TYPE",
    name: "Pacientes por tipo o clasificación",
    description: "Pacientes filtrados por su estado operativo.",
    category: "PERSONAL",
    requiredParameters: [
      {
        key: "patientStatus",
        label: "Tipo de paciente",
        type: "patientStatus",
        required: true,
        defaultValue: "ACTIVE",
        options: [
          { value: "NEW", label: "Nuevo" },
          { value: "ACTIVE", label: "Activo" },
          { value: "IN_TREATMENT", label: "En tratamiento" },
          { value: "INACTIVE", label: "Inactivo" },
          { value: "DEBTOR", label: "Moroso" },
          { value: "COMPLETED", label: "Tratamiento completado" }
        ]
      }
    ],
    optionalParameters: [branchParameter],
    resultColumns: [...commonColumns, "patientStatus"],
    queryHandler: "patientsByType",
    eligibilityPolicy: "MARKETING_DEFAULT",
    supportedScopes: ["ORGANIZATION", "BRANCH"],
    permission: "integrations.communications.read",
    exportable: true
  }
];

export function marketingReportDefinition(code: string) {
  return marketingReportDefinitions.find((definition) => definition.code === code);
}
