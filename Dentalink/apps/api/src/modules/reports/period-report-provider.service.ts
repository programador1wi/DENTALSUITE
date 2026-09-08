import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { ExcelReportDefinition, ReportExportFormat } from "./dto/reports.dto";
import { ReportRow } from "./report-provider";

type SourceSpec = {
  delegate: string;
  organizationPath: string;
  branchPath?: string;
  datePath?: string;
  fixedWhere?: Record<string, unknown>;
  branchArray?: boolean;
};

const source = (
  delegate: string,
  organizationPath = "organizationId",
  branchPath = "branchId",
  datePath = "createdAt",
  fixedWhere?: Record<string, unknown>
): SourceSpec => ({ delegate, organizationPath, branchPath, datePath, fixedWhere });

const SOURCES: Record<string, SourceSpec> = {
  APPOINTMENTS_BY_STATUS: source("appointment", "organizationId", "branchId", "startAt"),
  PROFESSIONAL_BLOCKED_HOURS: source("appointment", "organizationId", "branchId", "startAt", { status: "BLOCKED" }),
  MONTHLY_PATIENT_APPOINTMENT_STATUSES: source("appointment", "organizationId", "branchId", "startAt"),
  CAPACITY_OCCUPANCY: source("appointment", "organizationId", "branchId", "startAt"),
  APPOINTMENTS_DIAGNOSIS_TREATMENT: source("appointment", "organizationId", "branchId", "startAt"),
  BRANCH_APPOINTMENT_STATUSES: source("appointment", "organizationId", "branchId", "startAt"),
  PROFESSIONAL_STATUS_SUMMARY: source("appointment", "organizationId", "branchId", "startAt"),
  APPOINTMENTS_IN_RANGE: source("appointment", "organizationId", "branchId", "createdAt"),
  ONLINE_CAMPAIGN_APPOINTMENTS: source("onlineSchedulingEvent", "organizationId", "appointment.branchId", "createdAt", { eventType: "CONVERSION" }),
  PRICE_LIST_TEMPLATES: { ...source("priceTemplate", "organizationId", "branchIds", "createdAt"), branchArray: true },
  AGREEMENTS_LIST: source("agreement", "organizationId", "branches[].branchId", "createdAt"),
  AGREEMENT_AFFILIATES: source("agreementPatientAssignment", "organizationId", "patient.branchId", "assignedAt"),
  AGREEMENT_BUDGET_PAYMENT_STATUS: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  PATIENT_FOLLOWUP: source("patientTask", "organizationId", "branchId", "createdAt"),
  CRM_TASKS_PERIOD: source("patientTask", "organizationId", "branchId", "createdAt"),
  CRM_TASKS_DUE: source("patientTask", "organizationId", "branchId", "dueDate"),
  SATISFACTION_SURVEY_RESPONSES: source("surveyResponse", "organizationId", "branchId", "submittedAt", { status: "SUBMITTED" }),
  REFUND_REQUESTS: source("refund", "organizationId", "branchId", "createdAt"),
  PAYMENTS_BY_ACTION_DETAIL: source("paymentAllocation", "payment.organizationId", "payment.branchId", "payment.paidAt"),
  PAYMENTS_BY_DUE_DATE: source("installment", "installmentPlan.organizationId", "installmentPlan.treatmentPlan.branchId", "dueDate"),
  PAYMENTS_BY_DUE_DATE_CURRENT: source("installment", "installmentPlan.organizationId", "installmentPlan.treatmentPlan.branchId", "dueDate"),
  DELETED_PAYMENTS: source("payment", "organizationId", "branchId", "voidedAt", { status: "VOIDED" }),
  FINANCING_PAYMENTS: source("installment", "installmentPlan.organizationId", "installmentPlan.treatmentPlan.branchId", "paidAt"),
  PAYROLL_DISCOUNT_PAYMENTS: source("companyPayment", "organizationId", "branchId", "paymentDate"),
  PAYMENTS_WITHOUT_RECEIPT: source("payment", "organizationId", "branchId", "paidAt", { financialDocuments: { none: {} } }),
  CASH_DISCOUNTS: source("cashDiscountApplication", "organizationId", "branchId", "createdAt"),
  FLOW: source("patientLedgerEntry", "organizationId", "branchId", "occurredAt"),
  OPERATIONAL_INCOME_STATEMENT: source("patientLedgerEntry", "organizationId", "branchId", "occurredAt"),
  PAYROLL_COLLECTION_REPORTS: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  PAYROLL_COLLECTION_PERIOD: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  PAYROLL_COLLECTION_ACTION_DETAIL: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  PAYROLL_COLLECTION_ACTION_DETAIL_PERIOD: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  CHECKS_RECEIVABLE: source("paymentSettlement", "organizationId", "branchId", "dueAt", { paymentMethod: { type: "CHECK" }, status: { in: ["PENDING", "OVERDUE"] } }),
  PAYROLL_DISCOUNT_STATUS: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  PAYROLL_DISCOUNT_ORIGINALS: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  PAYROLL_DISCOUNT_CURRENT: source("agreementCharge", "organizationId", "branchId", "dueDate"),
  FINANCING_STATUS: source("installmentPlan", "organizationId", "treatmentPlan.branchId", "createdAt"),
  SAFETY_STOCK: source("inventoryStock", "warehouse.organizationId", "warehouse.branchId", "updatedAt"),
  INVENTORY_TRANSACTIONS: source("inventoryMovement", "organizationId", "branchId", "occurredAt"),
  INVENTORY_PRODUCTS: source("inventoryItem", "organizationId", "branchId", "createdAt"),
  INVENTORY_TRAFFIC_LIGHT: source("inventoryStock", "warehouse.organizationId", "warehouse.branchId", "updatedAt"),
  LAB_REQUESTS_IN_PROCESS: source("labOrder", "organizationId", "patient.branchId", "createdAt", { status: "IN_PROCESS" }),
  LAB_REQUESTS_IN_REVIEW: source("labOrder", "organizationId", "patient.branchId", "createdAt", { status: "RECEIVED" }),
  LAB_COMPLETED_UNPAID: source("labOrder", "organizationId", "patient.branchId", "receivedAt", { status: { in: ["RECEIVED", "DELIVERED"] } }),
  LAB_ALL_REQUESTS: source("labOrder", "organizationId", "patient.branchId", "createdAt"),
  LAB_TOP_ACTIONS: source("labOrderItem", "labOrder.organizationId", "labOrder.patient.branchId", "labOrder.createdAt"),
  LAB_PRICE_VS_COST: source("labProcedureAssignment", "organizationId", undefined, "createdAt"),
  LAB_MARGIN: source("labOrder", "organizationId", "patient.branchId", "receivedAt"),
  FINALIZED_PAYROLL_LIQUIDATIONS: source("payrollLiquidation", "organizationId", "branchId", "finalizedAt"),
  PAYROLLS: source("payrollLiquidation", "organizationId", "branchId", "finalizedAt"),
  PATIENTS_WITH_ODONTOGRAM: source("odontogramRecord", "patient.organizationId", "patient.branchId", "createdAt"),
  PATIENT_TREATMENT_PLANS: source("treatmentPlan", "organizationId", "branchId", "createdAt"),
  DELINQUENT_PATIENTS: source("patientLedgerEntry", "organizationId", "branchId", "occurredAt", { debitAmount: { gt: 0 } }),
  ORTHODONTIC_PATIENTS: source("treatmentPlan", "organizationId", "branchId", "createdAt", { kind: "ORTHODONTICS" }),
  INFORMED_CONSENTS: source("consent", "organizationId", "branchId", "createdAt"),
  NEW_PATIENTS_REGISTERED: source("patient", "organizationId", "branchId", "createdAt"),
  NEW_PATIENTS_FIRST_APPOINTMENT: source("appointment", "organizationId", "branchId", "startAt"),
  NEW_PATIENTS_ONLINE: source("appointmentBookingActor", "organizationId", "appointment.branchId", "createdAt"),
  NEW_PATIENTS_FIRST_PROFESSIONAL: source("appointment", "organizationId", "branchId", "startAt"),
  DELINQUENT_PATIENTS_FINANCING: source("installment", "installmentPlan.organizationId", "installmentPlan.treatmentPlan.branchId", "dueDate", { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }),
  PATIENT_EVOLUTIONS: source("clinicalEvolution", "patient.organizationId", "branchId", "createdAt"),
  PATIENTS_TREATED_BY_PROFESSIONAL: source("appointment", "organizationId", "branchId", "startAt", { status: "ATTENDED" }),
  PATIENTS_WITHOUT_TREATMENTS: source("patient", "organizationId", "branchId", "createdAt"),
  UNREALIZED_PROCEDURES: source("clinicalEvolution", "patient.organizationId", "branchId", "annulledAt", { annulledAt: { not: null } }),
  BALANCE_SUMMARY: source("treatmentPlan", "organizationId", "branchId", "createdAt"),
  ACTIONS_PERFORMED_PERIOD: source("treatmentPlanItem", "treatmentPlan.organizationId", "treatmentPlan.branchId", "completedAt", { status: "COMPLETED" }),
  FINALIZED_TREATMENT_PLANS: source("treatmentPlan", "organizationId", "branchId", "completedAt", { status: "COMPLETED" }),
  BUDGET_STATUS_BY_ACTION: source("budgetItem", "budget.organizationId", "budget.treatmentPlan.branchId", "budget.createdAt"),
  GENERATED_BUDGET_STATUS: source("budget", "organizationId", "treatmentPlan.branchId", "createdAt"),
  UNFINISHED_PLANS_NO_FUTURE_APPOINTMENTS: source("treatmentPlan", "organizationId", "branchId", "createdAt", { status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] }, appointments: { none: { startAt: { gt: new Date() } } } }),
  PAID_NOT_PERFORMED_ACTIONS: source("treatmentPlanItem", "treatmentPlan.organizationId", "treatmentPlan.branchId", "createdAt", { status: { not: "COMPLETED" }, paymentAllocations: { some: {} } }),
  CAPTURED_BUDGETS: source("budget", "organizationId", "treatmentPlan.branchId", "acceptedAt", { status: "ACCEPTED" }),
};

const OMIT = new Set(["passwordHash", "refreshTokenHash", "idempotencyKey", "metadata", "rawPayload"]);

@Injectable()
export class PeriodReportProviderService {
  private readonly batchSize = 5_000;
  private readonly maxXlsxRows = 1_048_575;

  constructor(private readonly prisma: PrismaService) {}

  async rows(
    definition: ExcelReportDefinition,
    actor: AuthUser,
    parameters: Record<string, unknown>,
    format: ReportExportFormat = ReportExportFormat.XLSX
  ) {
    const allRows: ReportRow[] = [];
    for await (const row of this.iterateRows(definition, actor, parameters)) {
      allRows.push(row);
      if (format === ReportExportFormat.XLSX && allRows.length > this.maxXlsxRows) {
        throw new BadRequestException(
          "LIMIT_EXCEEDED: El reporte supera el límite de 1,048,575 filas de Excel. Exporta en formato CSV."
        );
      }
    }
    return allRows;
  }

  async *iterateRows(
    definition: ExcelReportDefinition,
    actor: AuthUser,
    parameters: Record<string, unknown>
  ): AsyncGenerator<ReportRow> {
    const spec = SOURCES[definition.code];
    if (!spec) throw new BadRequestException(`Fuente no configurada para ${definition.code}`);
    const delegate = (this.prisma as unknown as Record<string, { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> }>)[spec.delegate];
    if (!delegate?.findMany) throw new BadRequestException(`Fuente ${spec.delegate} no disponible`);
    const branchIds = actor.branchIds;
    const windows = Array.isArray(parameters.branchWindows) ? parameters.branchWindows as Array<Record<string, string>> : [];
    const scope = this.path(spec.organizationPath, actor.organizationId);
    const branches = spec.branchPath
      ? this.path(spec.branchPath, spec.branchArray ? { hasSome: branchIds } : { in: branchIds })
      : {};
    const dateRange = this.dateRange(spec.datePath, parameters, windows);
    const where = this.merge(scope, branches, spec.fixedWhere ?? {}, dateRange);

    let cursor: string | undefined;

    while (true) {
      const batch = await delegate.findMany({
        where,
        orderBy: spec.datePath ? [this.path(spec.datePath, "asc"), { id: "asc" }] : { id: "asc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: this.batchSize
      });

      if (!batch || batch.length === 0) break;
      for (const row of batch) yield this.normalize(row);
      const lastId = batch.at(-1)?.id;
      if (typeof lastId !== "string" || !lastId) {
        throw new Error(`Fuente ${spec.delegate} no expone un cursor id estable`);
      }
      cursor = lastId;
      if (batch.length < this.batchSize) break;
    }
  }

  private dateRange(datePath: string | undefined, parameters: Record<string, unknown>, windows: Array<Record<string, string>>) {
    if (!datePath) return {};
    const starts = windows.map((window) => window.startUtc).filter(Boolean).map(String);
    const ends = windows.map((window) => window.endExclusiveUtc).filter(Boolean).map(String);
    const from = starts.sort()[0] ?? (parameters.dateFrom ? String(parameters.dateFrom) : undefined);
    const to = ends.sort().at(-1) ?? (parameters.dateTo ? String(parameters.dateTo) : undefined);
    if (!from || !to) return {};
    return this.path(datePath, { gte: new Date(from), lt: new Date(to) });
  }

  private path(path: string, value: unknown) {
    return path.split(".").reverse().reduce<Record<string, unknown>>((out, segment) => {
      const collection = segment.endsWith("[]");
      const key = collection ? segment.slice(0, -2) : segment;
      return { [key]: collection ? { some: out } : out };
    }, value as Record<string, unknown>);
  }

  private merge(...objects: Array<Record<string, unknown>>) {
    const out: Record<string, unknown> = {};
    for (const object of objects) {
      for (const [key, value] of Object.entries(object)) {
        if (value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) {
          out[key] = this.merge(out[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else out[key] = value;
      }
    }
    return out;
  }

  private normalize(row: Record<string, unknown>) {
    const output: Record<string, string | number | boolean | Date | null> = {};
    for (const [key, value] of Object.entries(row)) {
      if (OMIT.has(key)) continue;
      if (value === null || value instanceof Date || ["string", "number", "boolean"].includes(typeof value)) {
        output[key] = value as string | number | boolean | Date | null;
      } else if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
        output[key] = value.toNumber();
      } else output[key] = JSON.stringify(value);
    }
    return output;
  }
}
