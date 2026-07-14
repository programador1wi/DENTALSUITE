import { AppointmentStatus, PaymentStatus } from "@prisma/client";
import { ExcelReportDefinition, ReportExportFormat, ReportParameterDefinition } from "./dto/reports.dto";

const formats: ExcelReportDefinition["supportedFormats"] = [ReportExportFormat.CSV, ReportExportFormat.XLSX];

const branchDateRange: ReportParameterDefinition[] = [
  { key: "branchId", label: "Sucursal", type: "branch" as const },
  { key: "dateFrom", label: "Fecha inicial", type: "date" as const, required: true, maxRangeDays: 366 },
  { key: "dateTo", label: "Fecha final", type: "date" as const, required: true, maxRangeDays: 366 }
];

const appointmentStatusOptions = Object.values(AppointmentStatus).map((status) => ({ label: status, value: status }));
const paymentStatusOptions = Object.values(PaymentStatus).map((status) => ({ label: status, value: status }));

function enabled(
  code: string,
  name: string,
  description: string,
  category: string,
  handler: string,
  parameters = branchDateRange,
  permission = "reports.read",
  keywords: string[] = []
): ExcelReportDefinition {
  return {
    id: code.toLowerCase().replace(/_/g, "-"),
    code,
    name,
    description,
    category,
    permission,
    supportedFormats: formats,
    parameters,
    handler,
    estimatedComplexity: "LOW",
    enabled: true,
    country: "MX",
    keywords
  };
}

function disabled(code: string, name: string, description: string, category: string, keywords: string[] = []): ExcelReportDefinition {
  return {
    id: code.toLowerCase().replace(/_/g, "-"),
    code,
    name,
    description,
    category,
    permission: "reports.read",
    supportedFormats: formats,
    parameters: branchDateRange,
    handler: null,
    estimatedComplexity: "MEDIUM",
    enabled: false,
    country: "MX",
    keywords
  };
}

export const excelReportDefinitions: ExcelReportDefinition[] = [
  enabled("APPOINTMENTS_SUMMARY", "Agenda", "Citas, cancelaciones, no asistencias y ocupacion por profesional.", "AGENDA", "appointments", branchDateRange, "reports.read", ["citas", "agenda", "ocupacion"]),
  enabled(
    "APPOINTMENTS_PATIENTS",
    "Citas pacientes",
    "Citas de pacientes dentro de un rango con sucursal, profesional y estados opcionales.",
    "AGENDA",
    "appointments-patients",
    [
      ...branchDateRange,
      { key: "professionalId", label: "Profesional", type: "professional", dependsOn: "branchId" },
      { key: "statuses", label: "Estados", type: "appointmentStatus", options: appointmentStatusOptions }
    ],
    "reports.read",
    ["citas pacientes", "pacientes", "estados"]
  ),
  enabled("PATIENTS_SUMMARY", "Pacientes", "Pacientes nuevos, activos, sin cita futura y fuentes de captacion.", "PACIENTES", "patients", branchDateRange, "reports.read", ["pacientes", "captacion"]),
  enabled("TREATMENTS_SUMMARY", "Tratamientos", "Planes creados, aceptados, en progreso y finalizados.", "TRATAMIENTOS", "treatments", branchDateRange, "reports.read", ["tratamientos", "presupuestos"]),
  enabled(
    "FINANCIAL_SUMMARY",
    "Financieros",
    "Ingresos, saldos pendientes, morosidad y produccion.",
    "FINANZAS",
    "financial",
    branchDateRange,
    "reports.read",
    ["finanzas", "ingresos", "cobranza"]
  ),
  enabled(
    "PATIENT_PAYMENTS",
    "Pagos pacientes",
    "Pagos de pacientes filtrados por sucursal, fechas, metodo, caja y estado.",
    "FINANZAS",
    "patient-payments",
    [
      ...branchDateRange,
      { key: "paymentMethodId", label: "Medio de pago", type: "paymentMethod" },
      { key: "cashRegisterId", label: "Caja", type: "select", dependsOn: "branchId" },
      { key: "status", label: "Estado", type: "select", options: [{ label: "Todos", value: "ALL" }, ...paymentStatusOptions] }
    ],
    "reports.read",
    ["pagos", "pacientes", "caja"]
  ),
  enabled("PROFESSIONALS_SUMMARY", "Profesionales", "Productividad, agenda, cancelaciones y laboratorio pendiente.", "USUARIOS", "professionals", branchDateRange, "reports.read", ["profesionales", "productividad"]),
  enabled(
    "USERS_LIST",
    "Listado usuarios",
    "Listado de todos los usuarios del sistema.",
    "USUARIOS",
    "users-list",
    [
      {
        key: "status",
        label: "Estado",
        type: "select",
        required: true,
        defaultValue: "ALL",
        options: [
          { label: "Todos", value: "ALL" },
          { label: "Habilitados", value: "ENABLED" },
          { label: "Deshabilitados", value: "DISABLED" }
        ]
      }
    ],
    "users.read",
    ["usuarios", "colaboradores", "habilitados", "deshabilitados"]
  ),

  disabled("APPOINTMENTS_BY_STATUS", "Citas cuyo estado haya sido alguno de los disponibles", "Citas filtradas por uno o varios estados.", "AGENDA"),
  disabled("PROFESSIONAL_BLOCKED_HOURS", "Horas bloqueadas en profesionales", "Bloqueos de agenda por profesional.", "AGENDA"),
  disabled("MONTHLY_PATIENT_APPOINTMENT_STATUSES", "Estados de citas de pacientes en mes especifico", "Estados mensuales de citas de pacientes.", "AGENDA"),
  disabled("CAPACITY_OCCUPANCY", "Cupos y ocupacion", "Cupos disponibles y ocupacion por sucursal/profesional.", "AGENDA"),
  disabled("APPOINTMENTS_DIAGNOSIS_TREATMENT", "Citas, sus estados y si son de diagnostico o tratamiento", "Detalle de citas clasificadas por diagnostico/tratamiento.", "AGENDA"),
  disabled("BRANCH_APPOINTMENT_STATUSES", "Estados de citas por sucursal y rango de fechas", "Resumen de estados por sucursal.", "AGENDA"),
  disabled("PROFESSIONAL_STATUS_SUMMARY", "Resumen de estados por profesional entre dos fechas", "Resumen por profesional y estado.", "AGENDA"),
  disabled("APPOINTMENTS_IN_RANGE", "Citas agendadas dentro de un rango", "Citas agendadas por rango de fechas.", "AGENDA"),
  disabled("ONLINE_CAMPAIGN_APPOINTMENTS", "Citas online por campanas", "Citas generadas desde campanas online.", "AGENDA"),

  disabled("PRICE_LIST", "Listado de precios", "Listado de precios vigente.", "LISTADO DE PRECIOS"),
  disabled("PRICE_LIST_TEMPLATES", "Plantillas de arancel", "Plantillas de arancel configuradas.", "LISTADO DE PRECIOS"),
  disabled("AGREEMENTS_LIST", "Listado de convenios", "Convenios registrados.", "CONVENIOS"),
  disabled("CRM_TASKS_PERIOD", "Tareas de gestion generadas en un periodo", "Tareas CRM generadas por periodo.", "CRM"),
  disabled("CRM_TASKS_DUE", "Tareas de gestion por vencer", "Tareas CRM proximas a vencer.", "CRM"),
  disabled("SATISFACTION_SURVEY_RESPONSES", "Respuestas de encuestas de satisfaccion", "Respuestas de encuestas registradas.", "CRM"),
  disabled("REFUND_REQUESTS", "Solicitudes de reembolso", "Solicitudes de reembolso registradas.", "FINANZAS"),
  disabled("AGREEMENT_BUDGET_PAYMENT_STATUS", "Estado de pagos de presupuestos por convenio", "Estado de pagos por convenio.", "FINANZAS"),
  disabled("PAYMENTS_BY_ACTION_DETAIL", "Pagos pacientes, detalle por accion", "Pagos por accion clinica.", "FINANZAS"),
  disabled("PAYMENTS_BY_DUE_DATE", "Pagos por fecha de vencimiento", "Pagos agrupados por vencimiento.", "FINANZAS"),
  disabled("PAYMENTS_BY_DUE_DATE_CURRENT", "Pagos por fecha de vencimiento incluyendo pagos al dia", "Pagos vencidos y al dia.", "FINANZAS"),
  disabled("DELETED_PAYMENTS", "Pagos eliminados", "Pagos eliminados o anulados.", "FINANZAS"),
  disabled("FINANCING_PAYMENTS", "Pagos de financiamientos", "Pagos vinculados a financiamientos.", "FINANZAS"),
  disabled("PAYROLL_DISCOUNT_PAYMENTS", "Pagos por descuento de planilla", "Pagos por descuento de planilla.", "FINANZAS"),
  disabled("PAYMENTS_WITHOUT_RECEIPT", "Pagos sin comprobante asociado", "Pagos sin comprobante.", "FINANZAS"),
  disabled("CASH_DISCOUNTS", "Descuentos por caja", "Descuentos registrados por caja.", "FINANZAS"),
  disabled("FLOW", "Flujo", "Flujo financiero.", "FINANZAS"),
  disabled("CASH_FLOW", "Flujo de caja", "Flujo de caja por periodo.", "FINANZAS"),
  disabled("OPERATIONAL_INCOME_STATEMENT", "Estado de resultado operacional", "Resultado operacional.", "FINANZAS"),
  disabled("EXPENSE_DETAIL", "Detalle de gastos", "Detalle de gastos por periodo.", "FINANZAS"),
  disabled("PAYROLL_COLLECTION_REPORTS", "Informes de cobranza por planilla", "Cobranza por descuento de planilla.", "FINANZAS"),
  disabled("SAFETY_STOCK", "Stock de seguridad", "Productos bajo stock de seguridad.", "INVENTARIO"),
  disabled("INVENTORY_TRANSACTIONS", "Transacciones de inventario", "Movimientos de inventario.", "INVENTARIO"),
  disabled("INVENTORY_PRODUCTS", "Productos de inventario", "Productos registrados en inventario.", "INVENTARIO"),
  disabled("LAB_REQUESTS_IN_PROCESS", "Solicitudes en proceso", "Solicitudes de laboratorio en proceso.", "LABORATORIOS"),
  disabled("LAB_REQUESTS_IN_REVIEW", "Solicitudes en revision", "Solicitudes de laboratorio en revision.", "LABORATORIOS"),
  disabled("LAB_COMPLETED_UNPAID", "Solicitudes finalizadas no pagadas", "Solicitudes de laboratorio finalizadas pendientes de pago.", "LABORATORIOS"),
  disabled("LAB_ALL_REQUESTS", "Todas las solicitudes", "Todas las solicitudes de laboratorio.", "LABORATORIOS"),
  disabled("LAB_TOP_ACTIONS", "Acciones de laboratorio mas solicitadas", "Ranking de acciones de laboratorio.", "LABORATORIOS"),
  disabled("LAB_PRICE_VS_COST", "Precio de acciones versus costo de laboratorio", "Comparacion precio/costo laboratorio.", "LABORATORIOS"),
  disabled("LAB_MARGIN", "Margen de ganancias", "Margen de ganancia de laboratorio.", "LABORATORIOS"),
  disabled("FINALIZED_PAYROLL_LIQUIDATIONS", "Liquidaciones finalizadas", "Liquidaciones finalizadas de nomina.", "NOMINAS"),
  disabled("PAYROLLS", "Nominas", "Nominas registradas.", "NOMINAS"),
  disabled("PATIENT_FOLLOWUP", "Seguimiento de pacientes", "Seguimiento operacional de pacientes.", "PACIENTES"),
  disabled("AGREEMENT_AFFILIATES", "Afiliados a convenios", "Pacientes afiliados a convenios.", "PACIENTES"),
  disabled("PATIENTS_WITH_ODONTOGRAM", "Pacientes con odontograma", "Pacientes con odontograma registrado.", "PACIENTES"),
  disabled("PATIENT_TREATMENT_PLANS", "Planes de tratamiento de un paciente", "Planes de tratamiento por paciente.", "PACIENTES"),
  disabled("DELINQUENT_PATIENTS", "Pacientes morosos", "Pacientes con deuda.", "PACIENTES"),
  disabled("ORTHODONTIC_PATIENTS", "Pacientes de ortodoncia", "Pacientes de ortodoncia.", "PACIENTES"),
  disabled("INFORMED_CONSENTS", "Consentimientos informados", "Consentimientos informados generados.", "PACIENTES"),
  disabled("NEW_PATIENTS_REGISTERED", "Pacientes nuevos registrados entre fechas", "Pacientes creados entre fechas.", "PACIENTES"),
  disabled("NEW_PATIENTS_FIRST_APPOINTMENT", "Pacientes nuevos segun primera cita", "Pacientes nuevos por primera cita.", "PACIENTES"),
  disabled("NEW_PATIENTS_ONLINE", "Pacientes nuevos desde Agenda Online", "Pacientes captados desde agenda online.", "PACIENTES"),
  disabled("NEW_PATIENTS_FIRST_PROFESSIONAL", "Pacientes nuevos por primer profesional", "Pacientes nuevos por primer profesional.", "PACIENTES"),
  disabled("DELINQUENT_PATIENTS_FINANCING", "Pacientes morosos por financiamiento", "Mora por financiamiento.", "PACIENTES"),
  disabled("PATIENT_EVOLUTIONS", "Evoluciones de pacientes", "Evoluciones clinicas de pacientes.", "PACIENTES"),
  disabled("PATIENTS_TREATED_BY_PROFESSIONAL", "Pacientes tratados por un profesional", "Pacientes atendidos por profesional.", "PACIENTES"),
  disabled("PATIENTS_WITHOUT_TREATMENTS", "Pacientes sin tratamientos o con una sola cita asistida", "Pacientes sin tratamiento o baja actividad.", "PACIENTES"),
  disabled("UNREALIZED_PROCEDURES", "Prestaciones desrealizadas", "Prestaciones revertidas o desrealizadas.", "TRATAMIENTOS"),
  disabled("BALANCE_SUMMARY", "Resumen de saldos", "Resumen de saldos de tratamientos.", "TRATAMIENTOS"),
  disabled("ACTIONS_PERFORMED_PERIOD", "Acciones realizadas en un periodo", "Acciones realizadas en rango.", "TRATAMIENTOS"),
  disabled("FINALIZED_TREATMENT_PLANS", "Planes de tratamiento finalizados", "Planes finalizados.", "TRATAMIENTOS"),
  disabled("BUDGET_STATUS_BY_ACTION", "Estado de presupuestos por accion", "Estado de presupuestos por accion.", "TRATAMIENTOS"),
  disabled("GENERATED_BUDGET_STATUS", "Estado de presupuestos generados", "Estado de presupuestos generados.", "TRATAMIENTOS"),
  disabled("UNFINISHED_PLANS_NO_FUTURE_APPOINTMENTS", "Planes no finalizados sin citas futuras", "Planes activos sin futuras citas.", "TRATAMIENTOS"),
  disabled("PAID_NOT_PERFORMED_ACTIONS", "Acciones pagadas pero no realizadas", "Acciones pagadas sin realizar.", "TRATAMIENTOS"),
  disabled("CAPTURED_BUDGETS", "Presupuestos capturados", "Presupuestos capturados.", "TRATAMIENTOS"),
  disabled("BUDGET_UNEXPIRATIONS", "Des-expiraciones", "Des-expiraciones de presupuestos.", "TRATAMIENTOS"),
  enabled(
    "DENTIST_CONTRACTS",
    "Contratos dentistas",
    "Listado de todos los contratos de los dentistas del sistema.",
    "USUARIOS",
    "dentist-contracts",
    [
      {
        key: "branchId",
        label: "Sucursal",
        type: "branch",
        required: true
      }
    ],
    "reports.read",
    ["contratos", "dentistas", "profesionales", "nomina"]
  )
];
