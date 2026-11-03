import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  CommunicationJobStatus,
  LabOrderStatus,
  PaymentStatus,
  Prisma,
  ProfessionalBranchStatus,
  ToothProcedureStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@prisma/client";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { withAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import { coerceClinicalDocumentContent, normalizeClinicalDocumentContent } from "../../common/utils/clinical-document-content.util";
import {
  CreateAllergyDto,
  CreateMedicalConditionDto,
  CreateMedicationDto,
  UpsertMedicalHistoryDto
} from "./dto/medical-history.dto";
import {
  CreateClinicalEvolutionAddendumDto,
  CreateClinicalEvolutionDto,
  UpdateClinicalEvolutionDto,
  ListEvolutionsQueryDto,
  AnnulClinicalEvolutionDto
} from "./dto/clinical-evolution.dto";
import { CreatePrescriptionDto } from "./dto/prescription.dto";
import {
  CreateClinicalDocumentDto,
  CreateClinicalDocumentFromTemplateDto,
  CreateClinicalDocumentTemplateDto
} from "./dto/clinical-document.dto";
import {
  ComparePeriodontalChartsQueryDto,
  CreatePeriodontalChartDto,
  CreateToothConditionDto,
  CreateToothProcedureDto,
  ListOdontogramQueryDto,
  UpdateToothProcedureStatusDto
} from "./dto/odontogram.dto";
import { ListPatientHistoryQueryDto, PATIENT_HISTORY_CATEGORIES, type PatientHistoryCategory } from "./dto/patient-history.dto";
import {
  calculateTreatmentPlanClinicalProgress,
  resolveTreatmentPlanStatusFromClinicalProgress
} from "../treatment-plans/treatment-plan-progress";

type HistoryActor = { id: string; name: string } | null;
type HistoryRef = { id: string; name: string } | null;

type PatientHistoryEvent = {
  id: string;
  eventType: string;
  category: PatientHistoryCategory;
  module: string;
  title: string;
  summary: string;
  occurredAt: string;
  clinicalDate?: string | null;
  createdAt: string;
  branch: HistoryRef;
  professional: HistoryRef;
  createdBy: HistoryActor;
  sourceEntityType: string;
  sourceEntityId: string;
  treatmentPlanId?: string | null;
  appointmentId?: string | null;
  toothId?: string | null;
  status?: string | null;
  isAnnulled: boolean;
  annulledAt?: string | null;
  annulmentReason?: string | null;
  isPrivate: boolean;
  visibility: "PUBLIC" | "PRIVATE" | "FINANCIAL" | "SENSITIVE";
  payload: Record<string, unknown>;
};

const CANCELLED_APPOINTMENT_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED
]);

const ANNULLED_TREATMENT_STATUSES = new Set<TreatmentPlanStatus>([
  TreatmentPlanStatus.CANCELLED,
  TreatmentPlanStatus.REJECTED
]);

const ANNULLED_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.VOIDED,
  PaymentStatus.REFUNDED
]);

@Injectable()
export class ClinicalService {
  constructor(private readonly prisma: PrismaService) {}

  async getClinicalSummary(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    const [history, conditions, allergies, medications, alerts] = await Promise.all([
      this.prisma.medicalHistory.findUnique({ where: { patientId } }),
      this.prisma.medicalCondition.findMany({ where: { patientId, isActive: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.allergy.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      this.prisma.medication.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      this.prisma.patientMedicalAlert.findMany({ where: { patientId, isActive: true }, orderBy: { createdAt: "desc" } })
    ]);
    return { history, conditions, allergies, medications, alerts };
  }

  async listAppointmentHistory(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds }
      },
      include: {
        branch: { select: { id: true, name: true } },
        patient: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        specialty: { select: { id: true, name: true } }
      },
      orderBy: [{ startAt: "desc" }, { createdAt: "desc" }]
    });

    return appointments.map((appointment) => ({
      ...appointment,
      specialty: appointment.specialty ? withAllowedSpecialtyName(appointment.specialty) : null
    }));
  }

  async listPatientHistory(actor: AuthUser, patientId: string, query: ListPatientHistoryQueryDto) {
    const patient = await this.ensurePatient(actor, patientId);
    const selectedCategories = this.resolveHistoryCategories(query.categories);
    const dateRange = this.resolveHistoryDateRange(query);
    const branchWhere = query.branchId ? branchScope(actor, query.branchId) : { in: actor.branchIds };
    const take = Math.min(query.take ?? 40, 100);
    const order = query.order ?? "desc";
    const canViewFinancial = actor.permissions.includes("payments.read");
    const sourceTake = Math.max(take * 4, 80);
    const dateWhere = this.historyDateWhere(dateRange);

    const [
      organization,
      appointments,
      plans,
      budgets,
      evolutions,
      odontogramRecords,
      toothProcedures,
      periodontalCharts,
      clinicalSummary,
      documents,
      prescriptions,
      payments,
      refunds,
      labOrders,
      consents
    ] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: actor.organizationId },
        select: { id: true, name: true, legalName: true, logoUrl: true, phone: true, email: true, address: true }
      }),
      this.prisma.appointment.findMany({
        where: {
          patientId,
          organizationId: actor.organizationId,
          branchId: branchWhere,
          ...(dateWhere
            ? {
                OR: [
                  { startAt: dateWhere },
                  { createdAt: dateWhere },
                  { statusHistory: { some: { createdAt: dateWhere } } },
                  { reminders: { some: { sentAt: dateWhere } } },
                  { communicationJobs: { some: { createdAt: dateWhere } } }
                ]
              }
            : {})
        },
        include: {
          branch: { select: { id: true, name: true, phone: true, address: true, brand: { select: { id: true, name: true, logoUrl: true } } } },
          professional: { select: { id: true, firstName: true, lastName: true } },
          specialty: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
          statusHistory: {
            include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" }
          },
          reminders: { orderBy: { createdAt: "desc" } },
          communicationJobs: { orderBy: { createdAt: "desc" } }
        },
        orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
        take: sourceTake
      }),
      this.prisma.treatmentPlan.findMany({
        where: { patientId, organizationId: actor.organizationId, branchId: branchWhere, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          branch: { select: { id: true, name: true } },
          professional: { select: { id: true, firstName: true, lastName: true } },
          specialty: { select: { id: true, name: true } },
          items: { select: { id: true, total: true, status: true, completionPercentage: true } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.budget.findMany({
        where: {
          patientId,
          organizationId: actor.organizationId,
          treatmentPlan: { branchId: branchWhere },
          ...(dateWhere ? { createdAt: dateWhere } : {})
        },
        include: {
          treatmentPlan: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
          professional: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.clinicalEvolution.findMany({
        where: {
          patientId,
          branchId: branchWhere,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          ...(query.includeAnnulled ? {} : { annulledAt: null })
        },
        include: this.clinicalEvolutionInclude(),
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.odontogramRecord.findMany({
        where: { patientId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } },
          appointment: { select: { id: true, branch: { select: { id: true, name: true } } } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.toothProcedure.findMany({
        where: { patientId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } },
          appointment: { select: { id: true, branch: { select: { id: true, name: true } } } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.periodontalChart.findMany({
        where: { patientId, ...(dateWhere ? { chartDate: dateWhere } : {}) },
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          appointment: { select: { id: true, branch: { select: { id: true, name: true } } } },
          measurements: { select: { id: true } }
        },
        orderBy: { chartDate: "desc" },
        take: sourceTake
      }),
      this.getClinicalSummary(actor, patientId),
      this.prisma.clinicalDocument.findMany({
        where: { patientId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          template: { select: { id: true, name: true } },
          treatmentPlan: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          deletedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.prescription.findMany({
        where: { patientId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          treatmentPlan: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
          appointment: { select: { id: true, branch: { select: { id: true, name: true } } } },
          items: { select: { id: true, medication: true } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      canViewFinancial
        ? this.prisma.payment.findMany({
            where: { patientId, organizationId: actor.organizationId, branchId: branchWhere, ...(dateWhere ? { paidAt: dateWhere } : {}) },
            include: {
              branch: { select: { id: true, name: true } },
              receivedBy: { select: { id: true, firstName: true, lastName: true } },
              paymentMethod: { select: { id: true, name: true } },
              allocations: { select: { id: true, amount: true } }
            },
            orderBy: { paidAt: "desc" },
            take: sourceTake
          })
        : Promise.resolve([]),
      canViewFinancial
        ? this.prisma.refund.findMany({
            where: { patientId, organizationId: actor.organizationId, branchId: branchWhere, ...(dateWhere ? { createdAt: dateWhere } : {}) },
            include: {
              branch: { select: { id: true, name: true } },
              processedBy: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: "desc" },
            take: sourceTake
          })
        : Promise.resolve([]),
      this.prisma.labOrder.findMany({
        where: { patientId, organizationId: actor.organizationId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          treatmentPlan: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
          professional: { select: { id: true, firstName: true, lastName: true } },
          labProvider: { select: { id: true, name: true } },
          items: { select: { id: true, description: true, toothNumber: true } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      }),
      this.prisma.consent.findMany({
        where: { patientId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: {
          template: { select: { id: true, name: true } },
          treatmentPlan: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
          appointment: { select: { id: true, branch: { select: { id: true, name: true } } } }
        },
        orderBy: { createdAt: "desc" },
        take: sourceTake
      })
    ]);

    const events: PatientHistoryEvent[] = [];
    const push = (event: PatientHistoryEvent) => events.push(event);

    for (const appointment of appointments) {
      const branch = this.historyRef(appointment.branch);
      const professional = this.historyPerson(appointment.professional);
      push({
        id: `appointment:${appointment.id}:created`,
        eventType: "appointment.created",
        category: "APPOINTMENTS",
        module: "agenda",
        title: "Cita agendada",
        summary: appointment.reason || appointment.title,
        occurredAt: appointment.startAt.toISOString(),
        clinicalDate: appointment.startAt.toISOString(),
        createdAt: appointment.createdAt.toISOString(),
        branch,
        professional,
        createdBy: this.historyPerson(appointment.createdBy),
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        appointmentId: appointment.id,
        treatmentPlanId: appointment.treatmentPlanId,
        status: appointment.status,
        isAnnulled: CANCELLED_APPOINTMENT_STATUSES.has(appointment.status),
        annulmentReason: appointment.cancellationReason,
        isPrivate: false,
        visibility: "PUBLIC",
        payload: {
          scheduledAt: appointment.startAt,
          specialty: appointment.specialty ? withAllowedSpecialtyName(appointment.specialty)?.name ?? null : null,
          cancellationReason: appointment.cancellationReason
        }
      });
      for (const item of appointment.statusHistory) {
        push({
          id: `appointment:${appointment.id}:status:${item.id}`,
          eventType: `appointment.status.${String(item.newStatus).toLowerCase()}`,
          category: "APPOINTMENTS",
          module: "agenda",
          title: `Cita ${this.appointmentStatusText(item.newStatus).toLowerCase()}`,
          summary: item.reason || `Cambio de ${item.previousStatus ? this.appointmentStatusText(item.previousStatus) : "sin estado"} a ${this.appointmentStatusText(item.newStatus)}`,
          occurredAt: item.createdAt.toISOString(),
          clinicalDate: appointment.startAt.toISOString(),
          createdAt: item.createdAt.toISOString(),
          branch,
          professional,
          createdBy: this.historyPerson(item.changedBy),
          sourceEntityType: "AppointmentStatusHistory",
          sourceEntityId: item.id,
          appointmentId: appointment.id,
          treatmentPlanId: appointment.treatmentPlanId,
          status: item.newStatus,
          isAnnulled: CANCELLED_APPOINTMENT_STATUSES.has(item.newStatus),
          annulmentReason: item.reason,
          isPrivate: false,
          visibility: "PUBLIC",
          payload: { previousStatus: item.previousStatus, newStatus: item.newStatus }
        });
      }
      for (const reminder of appointment.reminders.filter((item) => item.sentAt)) {
        push({
          id: `appointment:${appointment.id}:reminder:${reminder.id}`,
          eventType: "appointment.reminder.sent",
          category: "APPOINTMENTS",
          module: "agenda",
          title: "Recordatorio enviado",
          summary: `${reminder.channel} - ${reminder.status}`,
          occurredAt: (reminder.sentAt ?? reminder.createdAt).toISOString(),
          clinicalDate: appointment.startAt.toISOString(),
          createdAt: reminder.createdAt.toISOString(),
          branch,
          professional,
          createdBy: null,
          sourceEntityType: "AppointmentReminder",
          sourceEntityId: reminder.id,
          appointmentId: appointment.id,
          status: reminder.status,
          isAnnulled: false,
          isPrivate: false,
          visibility: "PUBLIC",
          payload: { channel: reminder.channel }
        });
      }
      for (const job of appointment.communicationJobs.filter((item) => item.status === CommunicationJobStatus.SENT || item.sentAt)) {
        push({
          id: `appointment:${appointment.id}:communication:${job.id}`,
          eventType: `appointment.communication.${String(job.channel).toLowerCase()}`,
          category: "APPOINTMENTS",
          module: "agenda",
          title: job.channel === "WHATSAPP" ? "Confirmacion WhatsApp" : "Comunicacion enviada",
          summary: `${job.channel} - ${job.status}`,
          occurredAt: (job.sentAt ?? job.createdAt).toISOString(),
          clinicalDate: appointment.startAt.toISOString(),
          createdAt: job.createdAt.toISOString(),
          branch,
          professional,
          createdBy: null,
          sourceEntityType: "CommunicationJob",
          sourceEntityId: job.id,
          appointmentId: appointment.id,
          status: job.status,
          isAnnulled: false,
          isPrivate: false,
          visibility: "PUBLIC",
          payload: { channel: job.channel, templateKey: job.templateKey }
        });
      }
    }

    for (const plan of plans) {
      const total = plan.items.reduce((sum, item) => sum + Number(item.total), 0);
      push({
        id: `treatment-plan:${plan.id}:created`,
        eventType: plan.isAlternative ? "treatment_plan.alternative.created" : "treatment_plan.created",
        category: plan.kind === "ORTHODONTICS" ? "ORTHODONTICS" : "TREATMENT_PLANS",
        module: "treatment-plans",
        title: plan.isAlternative ? "Alternativa creada" : "Plan de tratamiento creado",
        summary: `${plan.name} - ${this.treatmentStatusText(plan.status)}`,
        occurredAt: plan.createdAt.toISOString(),
        createdAt: plan.createdAt.toISOString(),
        branch: this.historyRef(plan.branch),
        professional: this.historyPerson(plan.professional),
        createdBy: null,
        sourceEntityType: "TreatmentPlan",
        sourceEntityId: plan.id,
        treatmentPlanId: plan.id,
        status: plan.status,
        isAnnulled: ANNULLED_TREATMENT_STATUSES.has(plan.status),
        isPrivate: false,
        visibility: canViewFinancial ? "PUBLIC" : "SENSITIVE",
        payload: {
          displayTotal: canViewFinancial ? total : null,
          itemCount: plan.items.length,
          specialty: plan.specialty ? withAllowedSpecialtyName(plan.specialty)?.name ?? plan.specialtySnapshotName : plan.specialtySnapshotName
        }
      });
    }

    for (const budget of budgets) {
      push({
        id: `budget:${budget.id}:created`,
        eventType: "budget.created",
        category: "BUDGETS",
        module: "budgets",
        title: "Presupuesto creado",
        summary: `${budget.treatmentPlan.name} - ${this.budgetStatusText(String(budget.status))}`,
        occurredAt: budget.createdAt.toISOString(),
        createdAt: budget.createdAt.toISOString(),
        branch: this.historyRef(budget.treatmentPlan.branch),
        professional: this.historyPerson(budget.professional),
        createdBy: null,
        sourceEntityType: "Budget",
        sourceEntityId: budget.id,
        treatmentPlanId: budget.treatmentPlanId,
        status: budget.status,
        isAnnulled: String(budget.status) === "CANCELLED" || String(budget.status) === "REJECTED",
        isPrivate: false,
        visibility: canViewFinancial ? "FINANCIAL" : "SENSITIVE",
        payload: { total: canViewFinancial ? Number(budget.total) : null, discountTotal: canViewFinancial ? Number(budget.discountTotal) : null }
      });
    }

    for (const evolution of evolutions) {
      push({
        id: `evolution:${evolution.id}:${evolution.annulledAt ? "annulled" : "saved"}`,
        eventType: evolution.annulledAt ? "evolution.annulled" : "evolution.saved",
        category: "EVOLUTIONS",
        module: "clinical",
        title: evolution.annulledAt ? "Evolucion anulada" : "Evolucion guardada",
        summary: this.evolutionSummary(evolution),
        occurredAt: (evolution.annulledAt ?? evolution.createdAt).toISOString(),
        clinicalDate: evolution.createdAt.toISOString(),
        createdAt: evolution.createdAt.toISOString(),
        branch: this.historyRef(evolution.branch),
        professional: this.historyPerson(evolution.professional),
        createdBy: this.historyPerson(evolution.createdBy),
        sourceEntityType: "ClinicalEvolution",
        sourceEntityId: evolution.id,
        treatmentPlanId: evolution.treatmentPlanId,
        appointmentId: evolution.appointmentId,
        toothId: evolution.treatmentPlanItem?.procedure?.id ?? null,
        status: evolution.signedAt ? "SIGNED" : "DRAFT",
        isAnnulled: Boolean(evolution.annulledAt),
        annulledAt: evolution.annulledAt?.toISOString(),
        annulmentReason: evolution.annulReason,
        isPrivate: evolution.isPrivate,
        visibility: evolution.isPrivate ? "PRIVATE" : "PUBLIC",
        payload: {
          treatmentPlan: evolution.treatmentPlanItem?.treatmentPlan?.name,
          procedure: evolution.treatmentPlanItem?.procedure?.name,
          completionPercentage: evolution.completionPercentage,
          fields: evolution.fields?.slice(0, 4).map((field) => ({ label: field.label, value: field.value }))
        }
      });
    }

    for (const procedure of toothProcedures) {
      push({
        id: `procedure:${procedure.id}`,
        eventType: `treatment_item.${String(procedure.status).toLowerCase()}`,
        category: "PROCEDURES",
        module: "odontogram",
        title: procedure.status === ToothProcedureStatus.COMPLETED ? "Prestacion realizada" : "Prestacion actualizada",
        summary: `${procedure.procedure?.name ?? "Procedimiento"} - Pieza ${procedure.toothNumber}${procedure.surface ? ` ${procedure.surface}` : ""}`,
        occurredAt: (procedure.completedAt ?? procedure.updatedAt ?? procedure.createdAt).toISOString(),
        createdAt: procedure.createdAt.toISOString(),
        branch: this.historyRef(procedure.appointment?.branch ?? null),
        professional: this.historyPerson(procedure.professional),
        createdBy: null,
        sourceEntityType: "ToothProcedure",
        sourceEntityId: procedure.id,
        treatmentPlanId: procedure.treatmentPlanId,
        appointmentId: procedure.appointmentId,
        toothId: procedure.toothNumber,
        status: procedure.status,
        isAnnulled: procedure.status === ToothProcedureStatus.CANCELLED,
        isPrivate: false,
        visibility: "PUBLIC",
        payload: { procedureCode: procedure.procedure?.code, diagnosis: procedure.diagnosis }
      });
    }

    for (const record of odontogramRecords) {
      push({
        id: `odontogram:${record.id}`,
        eventType: "odontogram.updated",
        category: "ODONTOGRAM",
        module: "odontogram",
        title: "Odontograma actualizado",
        summary: `${record.condition} - Pieza ${record.toothNumber}${record.surface ? ` ${record.surface}` : ""}`,
        occurredAt: record.createdAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
        branch: this.historyRef(record.appointment?.branch ?? null),
        professional: this.historyPerson(record.professional),
        createdBy: null,
        sourceEntityType: "OdontogramRecord",
        sourceEntityId: record.id,
        appointmentId: record.appointmentId,
        toothId: record.toothNumber,
        status: record.status,
        isAnnulled: record.status === ToothProcedureStatus.CANCELLED,
        isPrivate: false,
        visibility: "PUBLIC",
        payload: { procedure: record.procedure?.name, diagnosis: record.diagnosis, symbol: record.odontogramSymbol }
      });
    }

    for (const chart of periodontalCharts) {
      push({
        id: `periodontogram:${chart.id}`,
        eventType: "periodontogram.saved",
        category: "PERIODONTOGRAM",
        module: "periodontogram",
        title: "Periodontograma guardado",
        summary: `${chart.measurements.length} mediciones registradas`,
        occurredAt: chart.chartDate.toISOString(),
        clinicalDate: chart.chartDate.toISOString(),
        createdAt: chart.createdAt.toISOString(),
        branch: this.historyRef(chart.appointment?.branch ?? null),
        professional: this.historyPerson(chart.professional),
        createdBy: null,
        sourceEntityType: "PeriodontalChart",
        sourceEntityId: chart.id,
        appointmentId: chart.appointmentId,
        status: "SAVED",
        isAnnulled: false,
        isPrivate: false,
        visibility: "PUBLIC",
        payload: { notes: chart.notes }
      });
    }

    this.pushMedicalHistoryEvents(events, clinicalSummary, patient.branchId);

    for (const document of documents) {
      push({
        id: `clinical-document:${document.id}:${document.deletedAt ? "deleted" : "created"}`,
        eventType: document.deletedAt ? "document.annulled" : "document.created",
        category: "DOCUMENTS",
        module: "clinical-documents",
        title: document.deletedAt ? "Documento anulado" : "Documento creado",
        summary: document.title,
        occurredAt: (document.deletedAt ?? document.createdAt).toISOString(),
        createdAt: document.createdAt.toISOString(),
        branch: this.historyRef(document.treatmentPlan?.branch ?? null),
        professional: null,
        createdBy: this.historyPerson(document.deletedAt ? document.deletedBy : document.createdBy),
        sourceEntityType: "ClinicalDocument",
        sourceEntityId: document.id,
        treatmentPlanId: document.treatmentPlanId,
        status: document.status,
        isAnnulled: Boolean(document.deletedAt),
        annulledAt: document.deletedAt?.toISOString(),
        annulmentReason: document.deleteReason,
        isPrivate: false,
        visibility: "PUBLIC",
        payload: { template: document.template?.name, treatmentPlan: document.treatmentPlan?.name }
      });
    }

    for (const prescription of prescriptions) {
      push({
        id: `prescription:${prescription.id}`,
        eventType: "prescription.created",
        category: "PRESCRIPTIONS",
        module: "prescriptions",
        title: "Receta creada",
        summary: `${prescription.items.map((item) => item.medication).slice(0, 3).join(", ")}${prescription.items.length > 3 ? "..." : ""}`,
        occurredAt: prescription.createdAt.toISOString(),
        createdAt: prescription.createdAt.toISOString(),
        branch: this.historyRef(prescription.appointment?.branch ?? prescription.treatmentPlan?.branch ?? null),
        professional: this.historyPerson(prescription.professional),
        createdBy: null,
        sourceEntityType: "Prescription",
        sourceEntityId: prescription.id,
        treatmentPlanId: prescription.treatmentPlanId,
        appointmentId: prescription.appointmentId,
        status: prescription.status,
        isAnnulled: prescription.status !== "ACTIVE",
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: { diagnosis: prescription.diagnosis, itemCount: prescription.items.length }
      });
    }

    for (const payment of payments) {
      push({
        id: `payment:${payment.id}`,
        eventType: payment.status === PaymentStatus.VOIDED ? "payment.voided" : "payment.registered",
        category: "PAYMENTS",
        module: "payments",
        title: payment.status === PaymentStatus.VOIDED ? "Pago anulado" : "Pago registrado",
        summary: `${payment.paymentMethod?.name ?? "Metodo no especificado"} - ${this.moneyText(Number(payment.amount), String(payment.currency))}`,
        occurredAt: payment.paidAt.toISOString(),
        createdAt: payment.createdAt.toISOString(),
        branch: this.historyRef(payment.branch),
        professional: null,
        createdBy: this.historyPerson(payment.receivedBy),
        sourceEntityType: "Payment",
        sourceEntityId: payment.id,
        status: payment.status,
        isAnnulled: ANNULLED_PAYMENT_STATUSES.has(payment.status),
        annulledAt: payment.voidedAt?.toISOString(),
        annulmentReason: payment.voidReason,
        isPrivate: false,
        visibility: "FINANCIAL",
        payload: { paymentNumber: payment.paymentNumber, allocationCount: payment.allocations.length, amount: Number(payment.amount) }
      });
    }

    for (const refund of refunds) {
      push({
        id: `refund:${refund.id}`,
        eventType: "refund.created",
        category: "REFUNDS",
        module: "payments",
        title: "Devolucion registrada",
        summary: `${this.moneyText(Number(refund.amount), "MXN")} - ${refund.reason ?? refund.status}`,
        occurredAt: (refund.processedAt ?? refund.createdAt).toISOString(),
        createdAt: refund.createdAt.toISOString(),
        branch: this.historyRef(refund.branch),
        professional: null,
        createdBy: this.historyPerson(refund.processedBy),
        sourceEntityType: "Refund",
        sourceEntityId: refund.id,
        status: refund.status,
        isAnnulled: String(refund.status) === "CANCELLED" || String(refund.status) === "REJECTED",
        isPrivate: false,
        visibility: "FINANCIAL",
        payload: { amount: Number(refund.amount) }
      });
    }

    for (const labOrder of labOrders) {
      push({
        id: `lab-order:${labOrder.id}`,
        eventType: `laboratory.${String(labOrder.status).toLowerCase()}`,
        category: "LABORATORY",
        module: "labs",
        title: this.labOrderTitle(labOrder.status),
        summary: `${labOrder.labProvider.name} - ${labOrder.items.map((item) => item.description).slice(0, 2).join(", ")}`,
        occurredAt: (labOrder.receivedAt ?? labOrder.sentAt ?? labOrder.createdAt).toISOString(),
        createdAt: labOrder.createdAt.toISOString(),
        branch: this.historyRef(labOrder.treatmentPlan?.branch ?? null),
        professional: this.historyPerson(labOrder.professional),
        createdBy: null,
        sourceEntityType: "LabOrder",
        sourceEntityId: labOrder.id,
        treatmentPlanId: labOrder.treatmentPlanId,
        status: labOrder.status,
        isAnnulled: String(labOrder.status) === "CANCELLED",
        isPrivate: false,
        visibility: "PUBLIC",
        payload: { provider: labOrder.labProvider.name, itemCount: labOrder.items.length, cost: canViewFinancial ? Number(labOrder.cost ?? 0) : null }
      });
    }

    for (const consent of consents) {
      push({
        id: `consent:${consent.id}`,
        eventType: consent.signedAt ? "consent.signed" : "consent.created",
        category: "CONSENTS",
        module: "consents",
        title: consent.signedAt ? "Consentimiento firmado" : "Consentimiento creado",
        summary: consent.template.name,
        occurredAt: (consent.signedAt ?? consent.createdAt).toISOString(),
        createdAt: consent.createdAt.toISOString(),
        branch: this.historyRef(consent.appointment?.branch ?? consent.treatmentPlan?.branch ?? null),
        professional: null,
        createdBy: null,
        sourceEntityType: "Consent",
        sourceEntityId: consent.id,
        treatmentPlanId: consent.treatmentPlanId,
        appointmentId: consent.appointmentId,
        status: consent.status,
        isAnnulled: String(consent.status) === "VOIDED" || String(consent.status) === "CANCELLED",
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: { treatmentPlan: consent.treatmentPlan?.name }
      });
    }

    const filteredEvents = events
      .filter((event) => selectedCategories.has(event.category))
      .filter((event) => (query.includeAnnulled ? true : !event.isAnnulled))
      .filter((event) => (query.professionalId ? event.professional?.id === query.professionalId : true))
      .filter((event) => (query.branchId ? event.branch?.id === query.branchId : true))
      .filter((event) => (query.treatmentPlanId ? event.treatmentPlanId === query.treatmentPlanId : true))
      .filter((event) => (query.toothId ? event.toothId === query.toothId : true))
      .filter((event) => (query.status ? String(event.status ?? "").toLowerCase() === query.status.toLowerCase() : true))
      .filter((event) => this.historyTextMatches(event, query.text));

    const sorted = filteredEvents.sort((left, right) => {
      const delta = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
      if (delta !== 0) return order === "asc" ? delta : -delta;
      return order === "asc" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
    });
    const afterCursor = this.applyHistoryCursor(sorted, query.cursor, order);
    const items = afterCursor.slice(0, take);

    return {
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        documentType: patient.documentType,
        documentNumber: patient.documentNumber,
        birthDate: patient.birthDate,
        phone: patient.phone,
        email: patient.email,
        createdAt: patient.createdAt
      },
      printContext: {
        organizationName: organization?.legalName || organization?.name || "Clinica",
        organizationLogoUrl: organization?.logoUrl ?? null,
        branchName: appointments[0]?.branch?.name ?? patient.branchId,
        branchLogoUrl: appointments[0]?.branch?.brand?.logoUrl ?? organization?.logoUrl ?? null,
        generatedAt: new Date().toISOString(),
        generatedBy: `${actor.firstName} ${actor.lastName}`.trim()
      },
      availableCategories: PATIENT_HISTORY_CATEGORIES,
      items,
      nextCursor: items.length === take ? this.encodeHistoryCursor(items[items.length - 1]) : null,
      totalLoaded: filteredEvents.length
    };
  }

  async upsertHistory(actor: AuthUser, patientId: string, dto: UpsertMedicalHistoryDto) {
    await this.ensurePatient(actor, patientId);
    const data = this.clean(dto);
    const history = await this.prisma.medicalHistory.upsert({
      where: { patientId },
      update: data,
      create: { patientId, ...data }
    });
    await this.audit(actor, patientId, "upsert_history", history);
    return history;
  }

  async createCondition(actor: AuthUser, patientId: string, dto: CreateMedicalConditionDto) {
    await this.ensurePatient(actor, patientId);
    const condition = await this.prisma.medicalCondition.create({
      data: { patientId, name: dto.name.trim(), notes: dto.notes?.trim() }
    });
    await this.audit(actor, patientId, "create_condition", condition);
    return condition;
  }

  async createAllergy(actor: AuthUser, patientId: string, dto: CreateAllergyDto) {
    await this.ensurePatient(actor, patientId);
    const allergy = await this.prisma.allergy.create({
      data: {
        patientId,
        name: dto.name.trim(),
        reaction: dto.reaction?.trim(),
        severity: dto.severity?.trim(),
        notes: dto.notes?.trim()
      }
    });
    await this.audit(actor, patientId, "create_allergy", allergy);
    return allergy;
  }

  async createMedication(actor: AuthUser, patientId: string, dto: CreateMedicationDto) {
    await this.ensurePatient(actor, patientId);
    const medication = await this.prisma.medication.create({
      data: {
        patientId,
        name: dto.name.trim(),
        dosage: dto.dosage?.trim(),
        frequency: dto.frequency?.trim(),
        notes: dto.notes?.trim()
      }
    });
    await this.audit(actor, patientId, "create_medication", medication);
    return medication;
  }

  async listEvolutions(actor: AuthUser, patientId: string, query: ListEvolutionsQueryDto) {
    await this.ensurePatient(actor, patientId);
    return this.prisma.clinicalEvolution.findMany({
      where: {
        patientId,
        addendumOfId: null,
        ...(query.includeAnnulled ? {} : { annulledAt: null }),
        ...(query.mineOnly ? { createdById: actor.id } : {})
      },
      include: this.clinicalEvolutionInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async createEvolution(actor: AuthUser, patientId: string, dto: CreateClinicalEvolutionDto) {
    const patient = await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId, patient.branchId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);
    this.validateOrthodonticEvolutionFields(dto.fields);

    const progress = this.normalizeCompletionPercentage(dto.completionPercentage);

    const evolution = await this.prisma.$transaction(async (tx) => {
      const progressSnapshot =
        dto.treatmentPlanItemId && progress !== undefined
          ? await this.applyTreatmentPlanItemProgress(tx, actor, patientId, dto.treatmentPlanItemId, progress, {
              expectedVersion: dto.expectedVersion
            })
          : null;
      const effectiveTreatmentPlanId = dto.treatmentPlanId ?? progressSnapshot?.treatmentPlanId;

      const created = await tx.clinicalEvolution.create({
        data: {
          patientId,
          branchId: patient.branchId,
          createdById: actor.id,
          professionalId: dto.professionalId,
          appointmentId: dto.appointmentId,
          treatmentPlanId: effectiveTreatmentPlanId,
          treatmentPlanItemId: dto.treatmentPlanItemId,
          completionPercentage: progress,
          performedAmountSnapshot: progressSnapshot?.performedAmount,
          subjective: dto.subjective?.trim(),
          objective: dto.objective?.trim(),
          assessment: dto.assessment?.trim(),
          plan: dto.plan?.trim(),
          notes: dto.notes?.trim(),
          isPrivate: dto.isPrivate ?? false,
          fields: {
            create: (dto.fields || []).map((f, i) => ({
              label: f.label.trim(),
              value: f.value.trim(),
              group: f.group?.trim(),
              sortOrder: i
            }))
          },
          materials: {
            create: (dto.materials || []).map((m) => ({
              inventoryItemId: m.inventoryItemId,
              quantity: m.quantity,
              unitSnapshot: "", // Will be populated when signed if needed, or we can fetch it now. Let's just store empty and fill on sign.
              nameSnapshot: ""
            }))
          }
        },
        include: this.clinicalEvolutionInclude()
      });

      if (progressSnapshot && progress === 100) {
        await tx.treatmentPlanItem.update({
          where: { id: dto.treatmentPlanItemId },
          data: { completedByEvolutionId: created.id }
        });
      }

      return created;
    });
    await this.audit(actor, patientId, "create_evolution", evolution as any);
    return evolution;
  }

  async updateEvolution(actor: AuthUser, patientId: string, evolutionId: string, dto: UpdateClinicalEvolutionDto) {
    const patient = await this.ensurePatient(actor, patientId);
    const current = await this.prisma.clinicalEvolution.findFirst({ where: { id: evolutionId, patientId } });
    if (!current) throw new NotFoundException("Clinical evolution not found");
    if (current.signedAt) throw new BadRequestException("Signed evolutions cannot be edited directly. Create an addendum.");
    if (current.annulledAt) throw new BadRequestException("Annulled evolutions cannot be edited.");

    if (dto.professionalId) await this.validateProfessional(actor, dto.professionalId, patient.branchId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);
    this.validateOrthodonticEvolutionFields(dto.fields);

    const progress = this.normalizeCompletionPercentage(dto.completionPercentage);
    const updated = await this.prisma.$transaction(async (tx) => {
      // Recreate fields and materials
      if (dto.fields) {
        await tx.clinicalEvolutionField.deleteMany({ where: { evolutionId } });
      }
      if (dto.materials) {
        await tx.clinicalEvolutionMaterial.deleteMany({ where: { evolutionId } });
      }

      const progressSnapshot =
        dto.treatmentPlanItemId && progress !== undefined
          ? await this.applyTreatmentPlanItemProgress(tx, actor, patientId, dto.treatmentPlanItemId, progress, {
              expectedVersion: dto.expectedVersion
            })
          : null;
      const effectiveTreatmentPlanId = dto.treatmentPlanId ?? progressSnapshot?.treatmentPlanId;

      const row = await tx.clinicalEvolution.update({
        where: { id: evolutionId },
        data: {
          professionalId: dto.professionalId,
          appointmentId: dto.appointmentId,
          treatmentPlanId: effectiveTreatmentPlanId,
          treatmentPlanItemId: dto.treatmentPlanItemId,
          completionPercentage: progress ?? current.completionPercentage,
          performedAmountSnapshot: progressSnapshot?.performedAmount ?? current.performedAmountSnapshot,
          subjective: dto.subjective?.trim(),
          objective: dto.objective?.trim(),
          assessment: dto.assessment?.trim(),
          plan: dto.plan?.trim(),
          notes: dto.notes?.trim(),
          isPrivate: dto.isPrivate ?? current.isPrivate,
          ...(dto.fields
            ? {
                fields: {
                  create: dto.fields.map((f, i) => ({
                    label: f.label.trim(),
                    value: f.value.trim(),
                    group: f.group?.trim(),
                    sortOrder: i
                  }))
                }
              }
            : {}),
          ...(dto.materials
            ? {
                materials: {
                  create: dto.materials.map((m) => ({
                    inventoryItemId: m.inventoryItemId,
                    quantity: m.quantity,
                    unitSnapshot: "",
                    nameSnapshot: ""
                  }))
                }
              }
            : {})
        },
        include: { fields: true, materials: true }
      });

      if (progressSnapshot && progress === 100) {
        await tx.treatmentPlanItem.update({
          where: { id: dto.treatmentPlanItemId },
          data: { completedByEvolutionId: evolutionId }
        });
      }

      return row;
    });

    await this.audit(actor, patientId, "update_evolution", updated as any);
    return updated;
  }

  async signEvolution(actor: AuthUser, patientId: string, evolutionId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const current = await this.prisma.clinicalEvolution.findFirst({ 
      where: { id: evolutionId, patientId },
      include: { materials: true, treatmentPlanItem: { include: { procedure: true } } }
    });
    if (!current) throw new NotFoundException("Clinical evolution not found");
    if (current.signedAt) return current;
    if (current.annulledAt) throw new BadRequestException("Annulled evolutions cannot be signed.");

    const signed = await this.prisma.$transaction(async (tx) => {
      // 1. Descontar Inventario si aplica
      for (const material of current.materials) {
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { id: material.inventoryItemId, isActive: true, branchId: patient.branchId! }
        });
        
        if (!inventoryItem) throw new BadRequestException(`Material de inventario inactivo o no disponible en esta sucursal (ID: ${material.inventoryItemId})`);
        
        const warehouse = await tx.inventoryWarehouse.findFirst({
          where: { organizationId: actor.organizationId, branchId: patient.branchId!, isDefault: true }
        }) ?? await tx.inventoryWarehouse.create({
          data: {
            organizationId: actor.organizationId,
            branchId: patient.branchId!,
            code: `CLIN-${patient.branchId!.slice(-8).toUpperCase()}`,
            name: "Bodega central",
            description: "Bodega creada automaticamente para consumo clinico.",
            isDefault: true
          }
        });
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.organizationId}:${warehouse.id}:${inventoryItem.id}`}))`;
        const stockRow = await tx.inventoryStock.upsert({
          where: { inventoryItemId_warehouseId: { inventoryItemId: inventoryItem.id, warehouseId: warehouse.id } },
          create: {
            organizationId: actor.organizationId,
            inventoryItemId: inventoryItem.id,
            warehouseId: warehouse.id,
            stock: inventoryItem.stock,
            minStock: inventoryItem.minStock,
            averageCost: 0
          },
          update: {}
        });

        const numericQty = Number(material.quantity);
        const numericStock = Number(stockRow.stock);
        if (numericStock < numericQty) {
          throw new BadRequestException(`Stock insuficiente para el material ${inventoryItem.name}. Stock actual: ${numericStock}, Requerido: ${numericQty}.`);
        }
        
        // Crear movimiento
        const movement = await tx.inventoryMovement.create({
          data: {
            organizationId: actor.organizationId,
            inventoryItemId: inventoryItem.id,
            branchId: patient.branchId!,
            warehouseId: warehouse.id,
            type: "OUT",
            quantity: numericQty,
            reason: `Consumo por evolución clínica ${current.id}`,
            source: "CLINICAL",
            sourceWarehouseId: warehouse.id,
            occurredAt: new Date(),
            postedAt: new Date(),
            createdById: actor.id,
            patientId,
            clinicalEvolutionId: current.id,
            stockBefore: numericStock,
            stockAfter: numericStock - numericQty,
            procedureId: current.treatmentPlanItem?.procedureId,
            treatmentPlanItemId: current.treatmentPlanItemId,
            treatmentPlanId: current.treatmentPlanId
          }
        });

        await tx.inventoryMovementLine.create({
          data: {
            movementId: movement.id,
            inventoryItemId: inventoryItem.id,
            quantity: numericQty,
            unitCost: stockRow.averageCost,
            totalCost: numericQty * Number(stockRow.averageCost),
            stockBefore: numericStock,
            stockAfter: numericStock - numericQty,
            averageCostBefore: stockRow.averageCost,
            averageCostAfter: stockRow.averageCost,
            notes: `Consumo por evolución clínica ${current.id}`
          }
        });

        // Descontar
        await tx.inventoryStock.update({
          where: { id: stockRow.id },
          data: { stock: { decrement: numericQty }, lastMovementAt: new Date(), version: { increment: 1 } }
        });
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { stock: { decrement: numericQty } }
        });

        // Actualizar material snapshot
        await tx.clinicalEvolutionMaterial.update({
          where: { id: material.id },
          data: { 
            unitSnapshot: inventoryItem.unit,
            nameSnapshot: inventoryItem.name,
            inventoryMovementId: movement.id
          }
        });
      }

      // 2. Completar Treatment Plan Item si existe
      let actionSnapshot = "";
      if (current.treatmentPlanItemId && current.treatmentPlanItem) {
        actionSnapshot = current.treatmentPlanItem.procedure.name;
        if (current.completionPercentage == null) {
          const snapshot = await this.applyTreatmentPlanItemProgress(tx, actor, patientId, current.treatmentPlanItemId, 100);
          if (snapshot.completionPercentage === 100) {
            await tx.treatmentPlanItem.update({
              where: { id: current.treatmentPlanItemId },
              data: { completedByEvolutionId: current.id }
            });
          }
        } else if (current.completionPercentage === 100 && current.treatmentPlanItem.completedByEvolutionId !== current.id) {
          await tx.treatmentPlanItem.update({
            where: { id: current.treatmentPlanItemId },
            data: { completedByEvolutionId: current.id }
          });
        }
      }

      // 3. Firmar
      return tx.clinicalEvolution.update({
        where: { id: evolutionId },
        data: { 
          signedAt: new Date(), 
          signedById: actor.id,
          actionNameSnapshot: actionSnapshot
        }
      });
    });

    await this.audit(actor, patientId, "sign_evolution", signed as any);
    return signed;
  }

  async annulEvolution(actor: AuthUser, patientId: string, evolutionId: string, dto: AnnulClinicalEvolutionDto) {
    const patient = await this.ensurePatient(actor, patientId);
    const current = await this.prisma.clinicalEvolution.findFirst({ 
      where: { id: evolutionId, patientId },
      include: { materials: { include: { inventoryMovement: true } }, treatmentPlanItem: true }
    });
    if (!current) throw new NotFoundException("Clinical evolution not found");
    if (current.annulledAt) return current;

    const annulled = await this.prisma.$transaction(async (tx) => {
      // 1. Revertir inventario
      for (const material of current.materials) {
        if (!material.inventoryMovementId || !material.inventoryMovement) continue;
        
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { id: material.inventoryItemId }
        });
        
        if (inventoryItem) {
          const numericQty = Number(material.quantity);
          const numericStock = Number(inventoryItem.stock);
          
          const reversal = await tx.inventoryMovement.create({
            data: {
              organizationId: actor.organizationId,
              inventoryItemId: inventoryItem.id,
              branchId: material.inventoryMovement.branchId,
              warehouseId: material.inventoryMovement.warehouseId,
              type: "IN",
              quantity: numericQty,
              reason: `Reversa por anulación de evolución clínica ${current.id}. Motivo: ${dto.reason}`,
              source: "CLINICAL_REVERSAL",
              destinationWarehouseId: material.inventoryMovement.warehouseId,
              occurredAt: new Date(),
              postedAt: new Date(),
              createdById: actor.id,
              patientId,
              clinicalEvolutionId: current.id,
              stockBefore: numericStock,
              stockAfter: numericStock + numericQty,
              reversalOfMovementId: material.inventoryMovement.id
            }
          });

          await tx.inventoryMovementLine.create({
            data: {
              movementId: reversal.id,
              inventoryItemId: inventoryItem.id,
              quantity: numericQty,
              unitCost: material.inventoryMovement.unitCost ?? 0,
              totalCost: numericQty * Number(material.inventoryMovement.unitCost ?? 0),
              stockBefore: numericStock,
              stockAfter: numericStock + numericQty,
              averageCostBefore: material.inventoryMovement.unitCost ?? 0,
              averageCostAfter: material.inventoryMovement.unitCost ?? 0,
              notes: `Reversa por anulación de evolución clínica ${current.id}`
            }
          });

          if (material.inventoryMovement.warehouseId) {
            await tx.inventoryStock.updateMany({
              where: { inventoryItemId: inventoryItem.id, warehouseId: material.inventoryMovement.warehouseId },
              data: { stock: { increment: numericQty }, lastMovementAt: new Date(), version: { increment: 1 } }
            });
          }
          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: { increment: numericQty } }
          });

          await tx.clinicalEvolutionMaterial.update({
            where: { id: material.id },
            data: { reversedMovementId: reversal.id }
          });
        }
      }

      // 2. Revertir estado del item del plan (solo si esta evolución lo completó)
      if (current.treatmentPlanItemId && current.completionPercentage != null) {
        const previousProgressEvolution = await tx.clinicalEvolution.findFirst({
          where: {
            patientId,
            treatmentPlanItemId: current.treatmentPlanItemId,
            annulledAt: null,
            completionPercentage: { not: null },
            NOT: { id: current.id }
          },
          orderBy: { createdAt: "desc" }
        });
        const restoredProgress = previousProgressEvolution?.completionPercentage ?? 0;
        await this.applyTreatmentPlanItemProgress(tx, actor, patientId, current.treatmentPlanItemId, restoredProgress);
        await tx.treatmentPlanItem.update({
          where: { id: current.treatmentPlanItemId },
          data: {
            completedByEvolutionId: restoredProgress === 100 ? previousProgressEvolution?.id ?? null : null
          }
        });
      } else if (current.treatmentPlanItemId && current.treatmentPlanItem?.completedByEvolutionId === current.id) {
        await this.applyTreatmentPlanItemProgress(tx, actor, patientId, current.treatmentPlanItemId, 0);
        await tx.treatmentPlanItem.update({
          where: { id: current.treatmentPlanItemId },
          data: { completedByEvolutionId: null }
        });
      }

      // 3. Anular
      return tx.clinicalEvolution.update({
        where: { id: evolutionId },
        data: { 
          annulledAt: new Date(), 
          annulledById: actor.id,
          annulReason: dto.reason.trim()
        }
      });
    });

    await this.audit(actor, patientId, "annul_evolution", annulled as any);
    return annulled;
  }

  async createEvolutionAddendum(actor: AuthUser, patientId: string, evolutionId: string, dto: CreateClinicalEvolutionAddendumDto) {
    const patient = await this.ensurePatient(actor, patientId);
    const parent = await this.prisma.clinicalEvolution.findFirst({ where: { id: evolutionId, patientId } });
    if (!parent) throw new NotFoundException("Clinical evolution not found");
    if (!parent.signedAt) throw new BadRequestException("Only signed evolutions require addenda");
    await this.validateProfessional(actor, dto.professionalId, patient.branchId);

    const addendum = await this.prisma.clinicalEvolution.create({
      data: {
        patientId,
        professionalId: dto.professionalId,
        appointmentId: parent.appointmentId,
        treatmentPlanId: parent.treatmentPlanId,
        notes: dto.notes.trim(),
        addendumOfId: parent.id
      }
    });
    await this.audit(actor, patientId, "create_evolution_addendum", addendum);
    return addendum;
  }

  async listPrescriptions(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    return this.prisma.prescription.findMany({
      where: { patientId },
      include: { professional: true, appointment: true, treatmentPlan: true, items: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPrescription(actor: AuthUser, patientId: string, dto: CreatePrescriptionDto) {
    const patient = await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId, patient.branchId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);
    if (!dto.items.length) throw new BadRequestException("Prescription requires at least one item");

    const prescription = await this.prisma.prescription.create({
      data: {
        patientId,
        professionalId: dto.professionalId,
        appointmentId: dto.appointmentId,
        treatmentPlanId: dto.treatmentPlanId,
        status: dto.status || "ACTIVE",
        diagnosis: dto.diagnosis?.trim(),
        notes: dto.notes?.trim(),
        items: {
          create: dto.items.map((item) => ({
            medication: item.medication.trim(),
            dosage: item.dosage?.trim(),
            frequency: item.frequency?.trim(),
            duration: item.duration?.trim(),
            instructions: item.instructions?.trim()
          }))
        }
      },
      include: { professional: true, patient: true, items: true }
    });
    await this.audit(actor, patientId, "create_prescription", prescription);
    return prescription;
  }

  async updatePrescriptionStatus(actor: AuthUser, patientId: string, prescriptionId: string, status: string) {
    await this.ensurePatient(actor, patientId);
    const existing = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId }
    });
    if (!existing) throw new NotFoundException("Prescription not found");

    const updated = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { status },
      include: { professional: true, items: true }
    });

    await this.audit(actor, patientId, "update_prescription_status", { prescriptionId, previousStatus: existing.status, newStatus: status });
    return updated;
  }

  async printPrescription(actor: AuthUser, patientId: string, prescriptionId: string) {
    await this.ensurePatient(actor, patientId);
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId },
      include: { patient: true, professional: true, items: true }
    });
    if (!prescription) throw new NotFoundException("Prescription not found");
    return {
      ...prescription,
      printableText: [
        `Paciente: ${prescription.patient.firstName} ${prescription.patient.lastName}`,
        `Doctor: ${prescription.professional.firstName} ${prescription.professional.lastName}`,
        `Diagnostico: ${prescription.diagnosis ?? "-"}`,
        ...prescription.items.map((item) => `- ${item.medication} ${item.dosage ?? ""} ${item.frequency ?? ""} ${item.duration ?? ""}`.trim()),
        prescription.notes ? `Notas: ${prescription.notes}` : ""
      ].filter(Boolean).join("\n")
    };
  }

  async listDocuments(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    const documents = await this.prisma.clinicalDocument.findMany({
      where: { patientId, deletedAt: null },
      include: { template: true },
      orderBy: { createdAt: "desc" }
    });
    return documents.map((document) => this.serializeClinicalDocument(document));
  }

  async listTemplates(actor: AuthUser) {
    const templates = await this.prisma.clinicalDocumentTemplate.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: { name: "asc" }
    });
    return templates.map((template) => this.serializeClinicalDocumentTemplate(template));
  }

  async createTemplate(actor: AuthUser, dto: CreateClinicalDocumentTemplateDto) {
    const template = await this.prisma.clinicalDocumentTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        content: normalizeClinicalDocumentContent(dto.content)
      }
    });
    await this.audit(actor, null, "create_document_template", { id: template.id, name: template.name });
    return this.serializeClinicalDocumentTemplate(template);
  }

  async createDocument(actor: AuthUser, patientId: string, dto: CreateClinicalDocumentDto) {
    await this.ensurePatient(actor, patientId);
    const templateId = dto.templateId?.trim() || undefined;
    if (templateId) await this.ensureClinicalDocumentTemplate(actor, templateId);

    const document = await this.prisma.clinicalDocument.create({
      data: {
        patientId,
        templateId,
        title: dto.title.trim(),
        content: normalizeClinicalDocumentContent(dto.content),
        createdById: actor.id
      },
      include: { template: true }
    });
    await this.audit(actor, patientId, "create_document", { documentId: document.id, templateId });
    return this.serializeClinicalDocument(document);
  }

  async createDocumentFromTemplate(actor: AuthUser, patientId: string, dto: CreateClinicalDocumentFromTemplateDto) {
    await this.ensurePatient(actor, patientId);
    const template = await this.ensureClinicalDocumentTemplate(actor, dto.templateId);
    return this.createDocument(actor, patientId, {
      templateId: template.id,
      title: dto.title,
      content: coerceClinicalDocumentContent(template.content)
    });
  }

  async listOdontogram(actor: AuthUser, patientId: string, query: ListOdontogramQueryDto) {
    await this.ensurePatient(actor, patientId);
    const toothNumber = query.toothNumber ? this.normalizeToothNumber(query.toothNumber) : undefined;
    const surface = query.surface ? this.normalizeSurface(query.surface) : undefined;
    const odontogramWhere = {
      patientId,
      ...(toothNumber ? { toothNumber } : {}),
      ...(surface ? { surface } : {})
    };

    const [records, conditions, procedures] = await Promise.all([
      this.prisma.odontogramRecord.findMany({
        where: odontogramWhere,
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.toothCondition.findMany({
        where: {
          patientId,
          ...(toothNumber ? { toothNumber } : {}),
          ...(surface ? { surface } : {}),
          OR: [
            { odontogramRecordId: null },
            { odontogramRecord: { is: { status: { not: ToothProcedureStatus.CANCELLED } } } }
          ]
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.toothProcedure.findMany({
        where: odontogramWhere,
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const latestByTooth = records.reduce<Record<string, (typeof records)[number]>>((accumulator, item) => {
      if (item.status === ToothProcedureStatus.CANCELLED) return accumulator;
      if (!accumulator[item.toothNumber]) accumulator[item.toothNumber] = item;
      return accumulator;
    }, {});

    const latestBySurface = records.reduce<Record<string, (typeof records)[number]>>((accumulator, item) => {
      if (item.status === ToothProcedureStatus.CANCELLED) return accumulator;
      const key = `${item.toothNumber}:${item.surface ?? "-"}`;
      if (!accumulator[key]) accumulator[key] = item;
      return accumulator;
    }, {});

    return { records, conditions, procedures, latestByTooth, latestBySurface };
  }

  async getToothHistory(actor: AuthUser, patientId: string, toothNumberInput: string, surfaceInput?: string) {
    await this.ensurePatient(actor, patientId);
    const toothNumber = this.normalizeToothNumber(toothNumberInput);
    const surface = surfaceInput ? this.normalizeSurface(surfaceInput) : undefined;
    const toothWhere = { patientId, toothNumber, ...(surface ? { surface } : {}) };

    const [records, conditions, procedures] = await Promise.all([
      this.prisma.odontogramRecord.findMany({
        where: toothWhere,
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.toothCondition.findMany({
        where: {
          patientId,
          toothNumber,
          ...(surface ? { surface } : {}),
          OR: [
            { odontogramRecordId: null },
            { odontogramRecord: { is: { status: { not: ToothProcedureStatus.CANCELLED } } } }
          ]
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.toothProcedure.findMany({
        where: toothWhere,
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    return { toothNumber, surface, records, conditions, procedures };
  }

  async createToothCondition(actor: AuthUser, patientId: string, dto: CreateToothConditionDto) {
    const patient = await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId, patient.branchId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);

    const toothNumber = this.normalizeToothNumber(dto.toothNumber);
    const surface = this.normalizeSurface(dto.surface);
    const conditionLabel = dto.condition.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.odontogramRecord.create({
        data: {
          patientId,
          professionalId: dto.professionalId,
          appointmentId: dto.appointmentId,
          toothNumber,
          surface,
          condition: conditionLabel,
          diagnosis: dto.diagnosis?.trim(),
          status: "PLANNED",
          notes: dto.notes?.trim()
        }
      });

      const condition = await tx.toothCondition.create({
        data: {
          patientId,
          odontogramRecordId: record.id,
          toothNumber,
          surface,
          condition: conditionLabel,
          diagnosis: dto.diagnosis?.trim(),
          notes: dto.notes?.trim()
        }
      });

      return { record, condition };
    });

    await this.audit(actor, patientId, "create_tooth_condition", result as Prisma.InputJsonValue);
    return result;
  }

  async cancelOdontogramRecord(actor: AuthUser, patientId: string, odontogramRecordId: string) {
    await this.ensurePatient(actor, patientId);

    const current = await this.prisma.odontogramRecord.findFirst({
      where: { id: odontogramRecordId, patientId }
    });
    if (!current) throw new NotFoundException("Odontogram record not found");

    const updated = await this.prisma.odontogramRecord.update({
      where: { id: current.id },
      data: { status: ToothProcedureStatus.CANCELLED }
    });

    await this.audit(actor, patientId, "cancel_odontogram_record", {
      id: updated.id,
      toothNumber: updated.toothNumber,
      condition: updated.condition
    });
    return updated;
  }

  async createToothProcedure(actor: AuthUser, patientId: string, dto: CreateToothProcedureDto) {
    const patient = await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId, patient.branchId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);
    if (dto.procedureId) await this.validateProcedure(actor, dto.procedureId);

    const toothNumber = this.normalizeToothNumber(dto.toothNumber);
    const surface = this.normalizeSurface(dto.surface);
    const status = dto.status ?? ToothProcedureStatus.PLANNED;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.toothProcedure.create({
        data: {
          patientId,
          professionalId: dto.professionalId,
          appointmentId: dto.appointmentId,
          procedureId: dto.procedureId,
          treatmentPlanId: dto.treatmentPlanId?.trim(),
          toothNumber,
          surface,
          diagnosis: dto.diagnosis?.trim(),
          status,
          notes: dto.notes?.trim(),
          completedAt: status === ToothProcedureStatus.COMPLETED ? new Date() : null
        },
        include: {
          procedure: { select: { id: true, code: true, name: true } },
          professional: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      let clinicalEvolutionId: string | undefined;
      if (status === ToothProcedureStatus.COMPLETED) {
        clinicalEvolutionId = await this.createEvolutionFromCompletedProcedure(tx, created, dto.notes);
      }

      const record = await tx.odontogramRecord.create({
        data: {
          patientId,
          professionalId: dto.professionalId,
          appointmentId: dto.appointmentId,
          toothNumber,
          surface,
          condition: "TOOTH_PROCEDURE",
          diagnosis: dto.diagnosis?.trim(),
          procedureId: dto.procedureId,
          status,
          notes: dto.notes?.trim()
        }
      });

      const updated = await tx.toothProcedure.update({
        where: { id: created.id },
        data: {
          odontogramRecordId: record.id,
          clinicalEvolutionId
        },
        include: {
          procedure: { select: { id: true, code: true, name: true } },
          professional: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      return updated;
    });

    await this.audit(actor, patientId, "create_tooth_procedure", row as Prisma.InputJsonValue);
    return row;
  }

  async updateToothProcedureStatus(actor: AuthUser, patientId: string, toothProcedureId: string, dto: UpdateToothProcedureStatusDto) {
    await this.ensurePatient(actor, patientId);

    const current = await this.prisma.toothProcedure.findFirst({
      where: { id: toothProcedureId, patientId },
      include: {
        procedure: { select: { id: true, code: true, name: true } },
        professional: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!current) throw new NotFoundException("Tooth procedure not found");

    const createClinicalEvolution = dto.createClinicalEvolution ?? true;
    const progress =
      this.normalizeCompletionPercentage(dto.completionPercentage) ??
      (dto.status === ToothProcedureStatus.COMPLETED
        ? 100
        : dto.status === ToothProcedureStatus.IN_PROGRESS
          ? 25
          : dto.status === ToothProcedureStatus.PLANNED || dto.status === ToothProcedureStatus.ACCEPTED
            ? 0
            : undefined);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.toothProcedure.update({
        where: { id: toothProcedureId },
        data: {
          status: dto.status,
          notes: dto.notes?.trim() ?? current.notes,
          completedAt:
            dto.status === ToothProcedureStatus.COMPLETED
              ? current.completedAt ?? new Date()
              : current.completedAt
        },
        include: {
          procedure: { select: { id: true, code: true, name: true } },
          professional: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      if (row.treatmentPlanItemId && progress !== undefined) {
        await this.applyTreatmentPlanItemProgress(tx, actor, patientId, row.treatmentPlanItemId, progress, {
          expectedVersion: dto.expectedVersion
        });
      }

      if (dto.status === ToothProcedureStatus.COMPLETED && createClinicalEvolution && !row.clinicalEvolutionId) {
        const clinicalEvolutionId = await this.createEvolutionFromCompletedProcedure(tx, row, dto.notes);
        await tx.toothProcedure.update({
          where: { id: row.id },
          data: { clinicalEvolutionId }
        });
      }

      await tx.odontogramRecord.create({
        data: {
          patientId,
          professionalId: row.professionalId,
          appointmentId: row.appointmentId,
          toothNumber: row.toothNumber,
          surface: row.surface,
          condition: "TOOTH_PROCEDURE_STATUS",
          diagnosis: row.diagnosis,
          procedureId: row.procedureId,
          status: row.status,
          notes: dto.notes?.trim()
        }
      });

      return tx.toothProcedure.findUniqueOrThrow({
        where: { id: row.id },
        include: {
          procedure: { select: { id: true, code: true, name: true } },
          professional: { select: { id: true, firstName: true, lastName: true } }
        }
      });
    });

    await this.audit(
      actor,
      patientId,
      "update_tooth_procedure_status",
      {
        toothProcedureId,
        previousStatus: current.status,
        newStatus: dto.status,
        completionPercentage: progress,
        createClinicalEvolution
      } as Prisma.InputJsonValue
    );
    return updated;
  }

  async listPeriodontalCharts(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    return this.prisma.periodontalChart.findMany({
      where: { patientId },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        measurements: { orderBy: [{ toothNumber: "asc" }, { position: "asc" }] }
      },
      orderBy: { chartDate: "desc" }
    });
  }

  async createPeriodontalChart(actor: AuthUser, patientId: string, dto: CreatePeriodontalChartDto) {
    const patient = await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId, patient.branchId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);
    if (!dto.measurements.length) throw new BadRequestException("Periodontal chart requires at least one measurement");

    const dedupe = new Set<string>();
    for (const measurement of dto.measurements) {
      const toothNumber = this.normalizeToothNumber(measurement.toothNumber);
      const key = `${toothNumber}:${measurement.position}`;
      if (dedupe.has(key)) throw new BadRequestException(`Duplicate periodontal measurement for ${key}`);
      dedupe.add(key);
    }

    const chart = await this.prisma.periodontalChart.create({
      data: {
        patientId,
        professionalId: dto.professionalId,
        appointmentId: dto.appointmentId,
        chartDate: new Date(dto.chartDate),
        notes: dto.notes?.trim(),
        measurements: {
          create: dto.measurements.map((measurement) => ({
            toothNumber: this.normalizeToothNumber(measurement.toothNumber),
            position: measurement.position,
            probingDepth: measurement.probingDepth,
            bleeding: measurement.bleeding,
            plaque: measurement.plaque,
            recession: measurement.recession,
            mobility: measurement.mobility,
            furcation: measurement.furcation?.trim(),
            suppuration: measurement.suppuration
          }))
        }
      },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        measurements: { orderBy: [{ toothNumber: "asc" }, { position: "asc" }] }
      }
    });

    await this.audit(actor, patientId, "create_periodontal_chart", chart as Prisma.InputJsonValue);
    return chart;
  }

  async comparePeriodontalCharts(actor: AuthUser, patientId: string, query: ComparePeriodontalChartsQueryDto) {
    await this.ensurePatient(actor, patientId);
    if (query.chartAId === query.chartBId) throw new BadRequestException("chartAId and chartBId must be different");

    const [chartA, chartB] = await Promise.all([
      this.prisma.periodontalChart.findFirst({
        where: { id: query.chartAId, patientId },
        include: { measurements: true }
      }),
      this.prisma.periodontalChart.findFirst({
        where: { id: query.chartBId, patientId },
        include: { measurements: true }
      })
    ]);

    if (!chartA || !chartB) throw new NotFoundException("One or both periodontal charts were not found");

    const byKey = (chart: typeof chartA) =>
      new Map(chart.measurements.map((item) => [`${item.toothNumber}:${item.position}`, item] as const));

    const mapA = byKey(chartA);
    const mapB = byKey(chartB);
    const keys = [...new Set([...mapA.keys(), ...mapB.keys()])];
    const positionOrder = ["MB", "B", "DB", "ML", "L", "DL"];

    const items = keys
      .map((key) => {
        const [toothNumber, position] = key.split(":");
        const a = mapA.get(key);
        const b = mapB.get(key);
        return {
          toothNumber,
          position,
          chartA: a ?? null,
          chartB: b ?? null,
          probingDepthDelta: (b?.probingDepth ?? 0) - (a?.probingDepth ?? 0),
          recessionDelta: (b?.recession ?? 0) - (a?.recession ?? 0),
          mobilityDelta: (b?.mobility ?? 0) - (a?.mobility ?? 0),
          bleedingChanged: (a?.bleeding ?? false) !== (b?.bleeding ?? false),
          plaqueChanged: (a?.plaque ?? false) !== (b?.plaque ?? false),
          suppurationChanged: (a?.suppuration ?? false) !== (b?.suppuration ?? false)
        };
      })
      .sort((left, right) => {
        if (left.toothNumber !== right.toothNumber) return Number(left.toothNumber) - Number(right.toothNumber);
        return positionOrder.indexOf(left.position) - positionOrder.indexOf(right.position);
      });

    return {
      chartA: { id: chartA.id, chartDate: chartA.chartDate, notes: chartA.notes },
      chartB: { id: chartB.id, chartDate: chartB.chartDate, notes: chartB.notes },
      items
    };
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const trimmed = patientId.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    const patient = await this.prisma.patient.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        deletedAt: null,
        ...(isNumeric
          ? { OR: [{ id: trimmed }, { patientNumber: parseInt(trimmed, 10) }] }
          : { id: trimmed })
      }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private resolveHistoryCategories(value?: string) {
    const all = new Set<PatientHistoryCategory>(PATIENT_HISTORY_CATEGORIES);
    if (!value?.trim()) return all;
    const selected = value
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is PatientHistoryCategory => all.has(item as PatientHistoryCategory));
    return selected.length ? new Set(selected) : all;
  }

  private resolveHistoryDateRange(query: ListPatientHistoryQueryDto) {
    if (query.month?.trim()) {
      const match = /^(\d{4})-(\d{2})$/.exec(query.month.trim());
      if (!match) throw new BadRequestException("Invalid history month");
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const from = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      return { from, to };
    }

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException("Invalid history from date");
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException("Invalid history to date");
    if (to) to.setHours(23, 59, 59, 999);
    if (from && to && from > to) throw new BadRequestException("Invalid history date range");
    return { from, to };
  }

  private historyDateWhere(range: { from?: Date; to?: Date }) {
    if (!range.from && !range.to) return undefined;
    return {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {})
    };
  }

  private historyRef(row?: { id: string; name: string } | null): HistoryRef {
    return row ? { id: row.id, name: row.name } : null;
  }

  private historyPerson(row?: { id: string; firstName: string; lastName: string } | null): HistoryActor {
    return row ? { id: row.id, name: `${row.firstName} ${row.lastName}`.trim() } : null;
  }

  private pushMedicalHistoryEvents(
    events: PatientHistoryEvent[],
    summary: Awaited<ReturnType<ClinicalService["getClinicalSummary"]>>,
    branchId?: string | null
  ) {
    const branch = branchId ? { id: branchId, name: "Sucursal del paciente" } : null;
    if (summary.history) {
      const activeFlags = [
        summary.history.hasDiabetes ? "diabetes" : null,
        summary.history.hasHypertension ? "hipertension" : null,
        summary.history.hasHeartDisease ? "cardiopatia" : null,
        summary.history.isPregnant ? "embarazo" : null,
        summary.history.smokes ? "tabaquismo" : null,
        summary.history.drinksAlcohol ? "alcohol" : null
      ].filter(Boolean);
      events.push({
        id: `medical-history:${summary.history.id}`,
        eventType: "medical_history.updated",
        category: "MEDICAL_HISTORY",
        module: "clinical",
        title: "Antecedente medico guardado",
        summary: activeFlags.length ? activeFlags.join(", ") : summary.history.notes || "Historia medica actualizada",
        occurredAt: summary.history.updatedAt.toISOString(),
        createdAt: summary.history.createdAt.toISOString(),
        branch,
        professional: null,
        createdBy: null,
        sourceEntityType: "MedicalHistory",
        sourceEntityId: summary.history.id,
        status: "ACTIVE",
        isAnnulled: false,
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: { bloodType: summary.history.bloodType }
      });
    }

    for (const alert of summary.alerts) {
      events.push({
        id: `medical-alert:${alert.id}`,
        eventType: "medical_history.alert.updated",
        category: "MEDICAL_HISTORY",
        module: "clinical",
        title: "Alerta medica guardada",
        summary: `${alert.type}: ${alert.description}`,
        occurredAt: alert.createdAt.toISOString(),
        createdAt: alert.createdAt.toISOString(),
        branch,
        professional: null,
        createdBy: null,
        sourceEntityType: "PatientMedicalAlert",
        sourceEntityId: alert.id,
        status: alert.severity,
        isAnnulled: !alert.isActive,
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: { severity: alert.severity }
      });
    }

    for (const condition of summary.conditions) {
      events.push({
        id: `medical-condition:${condition.id}`,
        eventType: "medical_history.condition.created",
        category: "MEDICAL_HISTORY",
        module: "clinical",
        title: "Enfermedad registrada",
        summary: condition.notes ? `${condition.name}: ${condition.notes}` : condition.name,
        occurredAt: condition.createdAt.toISOString(),
        createdAt: condition.createdAt.toISOString(),
        branch,
        professional: null,
        createdBy: null,
        sourceEntityType: "MedicalCondition",
        sourceEntityId: condition.id,
        status: condition.isActive ? "ACTIVE" : "INACTIVE",
        isAnnulled: !condition.isActive,
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: {}
      });
    }

    for (const allergy of summary.allergies) {
      events.push({
        id: `allergy:${allergy.id}`,
        eventType: "medical_history.allergy.created",
        category: "MEDICAL_HISTORY",
        module: "clinical",
        title: "Alergia registrada",
        summary: allergy.reaction ? `${allergy.name}: ${allergy.reaction}` : allergy.name,
        occurredAt: allergy.createdAt.toISOString(),
        createdAt: allergy.createdAt.toISOString(),
        branch,
        professional: null,
        createdBy: null,
        sourceEntityType: "Allergy",
        sourceEntityId: allergy.id,
        status: allergy.severity,
        isAnnulled: false,
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: { severity: allergy.severity }
      });
    }

    for (const medication of summary.medications) {
      events.push({
        id: `medication:${medication.id}`,
        eventType: "medical_history.medication.created",
        category: "MEDICAL_HISTORY",
        module: "clinical",
        title: "Medicamento registrado",
        summary: [medication.name, medication.dosage, medication.frequency].filter(Boolean).join(" - "),
        occurredAt: medication.createdAt.toISOString(),
        createdAt: medication.createdAt.toISOString(),
        branch,
        professional: null,
        createdBy: null,
        sourceEntityType: "Medication",
        sourceEntityId: medication.id,
        status: "ACTIVE",
        isAnnulled: false,
        isPrivate: false,
        visibility: "SENSITIVE",
        payload: {}
      });
    }
  }

  private appointmentStatusText(status: AppointmentStatus | string) {
    const labels: Record<string, string> = {
      SCHEDULED: "Agendada",
      CONFIRMED: "Confirmada",
      CONFIRMED_BY_WHATSAPP: "Confirmada por WhatsApp",
      CONFIRMED_BY_PHONE: "Confirmada por telefono",
      CONFIRMED_BY_EMAIL: "Confirmada por email",
      PENDING_CONFIRMATION: "Por confirmar",
      NOTIFIED_BY_WHATSAPP: "Notificada por WhatsApp",
      NOTIFIED_BY_EMAIL: "Notificada por email",
      ARRIVED: "Llegada",
      WAITING_ROOM: "Sala de espera",
      IN_PROGRESS: "En atencion",
      COMPLETED: "Atendida",
      CANCELLED_BY_PATIENT: "Cancelada por paciente",
      CANCELLED_BY_CLINIC: "Cancelada por clinica",
      CANCELLED_CONFLICT: "Cancelada por conflicto",
      CANCELLED_RESCHEDULED: "Anulada por reprogramacion",
      NO_SHOW: "No asistio",
      RESCHEDULED: "Reagendada",
      BLOCKED: "Bloqueada"
    };
    return labels[String(status)] ?? String(status);
  }

  private treatmentStatusText(status: TreatmentPlanStatus | string) {
    const labels: Record<string, string> = {
      DRAFT: "Borrador",
      PROPOSED: "Propuesto",
      ACCEPTED: "Aceptado",
      IN_PROGRESS: "En progreso",
      COMPLETED: "Finalizado",
      CANCELLED: "Cancelado",
      REJECTED: "Rechazado"
    };
    return labels[String(status)] ?? String(status);
  }

  private budgetStatusText(status: string) {
    const labels: Record<string, string> = {
      DRAFT: "Borrador",
      SENT: "Enviado",
      ACCEPTED: "Aceptado",
      REJECTED: "Rechazado",
      EXPIRED: "Expirado",
      CANCELLED: "Cancelado"
    };
    return labels[status] ?? status;
  }

  private evolutionSummary(evolution: {
    actionNameSnapshot?: string | null;
    notes?: string | null;
    objective?: string | null;
    assessment?: string | null;
    treatmentPlanItem?: { procedure?: { name: string } | null } | null;
  }) {
    return (
      evolution.actionNameSnapshot ||
      evolution.treatmentPlanItem?.procedure?.name ||
      evolution.objective ||
      evolution.assessment ||
      evolution.notes ||
      "Evolucion clinica"
    );
  }

  private moneyText(amount: number, currency: string) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);
  }

  private labOrderTitle(status: LabOrderStatus | string) {
    const labels: Record<string, string> = {
      REQUESTED: "Orden de laboratorio creada",
      SENT: "Orden de laboratorio enviada",
      RECEIVED: "Orden de laboratorio recibida",
      DELIVERED: "Trabajo de laboratorio entregado",
      CANCELLED: "Orden de laboratorio anulada"
    };
    return labels[String(status)] ?? "Orden de laboratorio";
  }

  private historyTextMatches(event: PatientHistoryEvent, text?: string) {
    const needle = text?.trim().toLowerCase();
    if (!needle) return true;
    return [
      event.title,
      event.summary,
      event.category,
      event.module,
      event.branch?.name,
      event.professional?.name,
      event.status,
      event.sourceEntityType
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle);
  }

  private applyHistoryCursor(events: PatientHistoryEvent[], cursor: string | undefined, order: "asc" | "desc") {
    const decoded = this.decodeHistoryCursor(cursor);
    if (!decoded) return events;
    return events.filter((event) => {
      const eventTime = new Date(event.occurredAt).getTime();
      if (order === "asc") {
        return eventTime > decoded.occurredAt || (eventTime === decoded.occurredAt && event.id > decoded.id);
      }
      return eventTime < decoded.occurredAt || (eventTime === decoded.occurredAt && event.id < decoded.id);
    });
  }

  private encodeHistoryCursor(event: PatientHistoryEvent) {
    return Buffer.from(JSON.stringify({ occurredAt: new Date(event.occurredAt).getTime(), id: event.id })).toString("base64url");
  }

  private decodeHistoryCursor(cursor?: string) {
    if (!cursor) return null;
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { occurredAt?: unknown; id?: unknown };
      if (typeof parsed.occurredAt !== "number" || typeof parsed.id !== "string") return null;
      return { occurredAt: parsed.occurredAt, id: parsed.id };
    } catch {
      return null;
    }
  }

  private async validateProfessional(actor: AuthUser, professionalId: string, branchId?: string) {
    const now = new Date();
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        ...(branchId
          ? {
              branches: {
                some: {
                  branchId,
                  status: ProfessionalBranchStatus.ACTIVE,
                  startsAt: { lte: now },
                  OR: [{ endsAt: null }, { endsAt: { gt: now } }]
                }
              }
            }
          : {})
      }
    });
    if (!professional) throw new BadRequestException("Invalid professionalId");
  }

  private async validateAppointment(actor: AuthUser, patientId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: actor.organizationId, patientId }
    });
    if (!appointment) throw new BadRequestException("Invalid appointmentId for patient");
  }

  private async validateProcedure(actor: AuthUser, procedureId: string) {
    const row = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private normalizeToothNumber(value: string) {
    const toothNumber = value.trim();
    if (!/^([1-4][1-8]|[5-8][1-5])$/.test(toothNumber)) {
      throw new BadRequestException("Invalid toothNumber for FDI notation");
    }
    return toothNumber;
  }

  private normalizeSurface(value?: string) {
    if (!value) return undefined;
    const surface = value.trim().toUpperCase();
    const allowedSingle = new Set(["O", "I", "M", "D", "B", "L", "P", "C"]);
    const allowedLegacy = new Set(["MO", "DO", "MOD", "ALL"]);
    if (allowedSingle.has(surface) || allowedLegacy.has(surface)) return surface;

    const preferredOrder = ["P", "M", "B", "D", "O", "I", "L", "C"];
    const parts = [...new Set(surface.split(",").map((part) => part.trim()).filter(Boolean))];
    if (!parts.length || parts.some((part) => !allowedSingle.has(part))) throw new BadRequestException("Invalid tooth surface");
    parts.sort((left, right) => preferredOrder.indexOf(left) - preferredOrder.indexOf(right));
    return parts.join(",");
  }

  private normalizeCompletionPercentage(value?: number | null) {
    if (value === undefined || value === null) return undefined;
    if (![0, 25, 50, 75, 100].includes(value)) {
      throw new BadRequestException("completionPercentage must be one of 0, 25, 50, 75 or 100");
    }
    return value;
  }

  private validateOrthodonticEvolutionFields(fields?: Array<{ label: string; value: string; group?: string }>) {
    if (!fields?.length) return;

    for (const field of fields) {
      const label = this.normalizeClinicalFieldLabel(field.label);
      const group = this.normalizeClinicalFieldLabel(field.group ?? "");
      if (label !== "higiene" || (group && group !== "orthodontics")) continue;

      const score = Number(field.value);
      if (!Number.isInteger(score) || score < 1 || score > 7) {
        throw new BadRequestException("Orthodontic hygiene score must be an integer from 1 to 7");
      }
    }
  }

  private normalizeClinicalFieldLabel(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .toLowerCase()
      .trim();
  }

  private treatmentStatusForProgress(percentage: number) {
    if (percentage === 100) return TreatmentPlanItemStatus.COMPLETED;
    if (percentage > 0) return TreatmentPlanItemStatus.IN_PROGRESS;
    return TreatmentPlanItemStatus.PLANNED;
  }

  private toothStatusForProgress(percentage: number) {
    if (percentage === 100) return ToothProcedureStatus.COMPLETED;
    if (percentage > 0) return ToothProcedureStatus.IN_PROGRESS;
    return ToothProcedureStatus.ACCEPTED;
  }

  private performedAmountForProgress(total: Prisma.Decimal | number | string, percentage: number) {
    return new Prisma.Decimal(total).mul(percentage).div(100).toDecimalPlaces(2);
  }

  private async applyTreatmentPlanItemProgress(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    patientId: string,
    itemId: string,
    completionPercentage: number,
    options: { expectedVersion?: number } = {}
  ) {
    const item = await tx.treatmentPlanItem.findFirst({
      where: {
        id: itemId,
        treatmentPlan: {
          organizationId: actor.organizationId,
          patientId,
          branchId: branchScope(actor)
        }
      },
      include: { treatmentPlan: true, toothProcedure: true }
    });
    if (!item) throw new NotFoundException("Treatment plan item not found for patient");
    if (item.status === TreatmentPlanItemStatus.CANCELLED) {
      throw new BadRequestException("Cancelled treatment plan items cannot be evolved");
    }
    if (options.expectedVersion !== undefined && item.version !== options.expectedVersion) {
      throw new BadRequestException("Treatment plan item was updated by another operation. Reload and try again.");
    }

    const performedAmount = this.performedAmountForProgress(item.total, completionPercentage);
    const status = this.treatmentStatusForProgress(completionPercentage);
    const completedAt = completionPercentage === 100 ? item.completedAt ?? new Date() : null;

    await tx.treatmentPlanItem.update({
      where: { id: item.id },
      data: {
        completionPercentage,
        performedAmount,
        status,
        completedAt,
        ...(completionPercentage < 100 ? { completedByEvolutionId: null } : {}),
        version: { increment: 1 }
      }
    });

    await this.syncTreatmentItemProcedureProgress(tx, item.id, completionPercentage);
    await this.syncTreatmentPlanStatusFromItems(tx, item.treatmentPlanId);

    return {
      treatmentPlanId: item.treatmentPlanId,
      completionPercentage,
      performedAmount
    };
  }

  private async syncTreatmentItemProcedureProgress(
    tx: Prisma.TransactionClient,
    itemId: string,
    completionPercentage: number
  ) {
    const status = this.toothStatusForProgress(completionPercentage);
    const current = await tx.toothProcedure.findUnique({
      where: { treatmentPlanItemId: itemId },
      select: { id: true, odontogramRecordId: true, completedAt: true }
    });
    if (!current) return;

    const completedAt = status === ToothProcedureStatus.COMPLETED ? current.completedAt ?? new Date() : null;
    await tx.toothProcedure.update({
      where: { id: current.id },
      data: { status, completedAt }
    });
    if (current.odontogramRecordId) {
      await tx.odontogramRecord.update({
        where: { id: current.odontogramRecordId },
        data: { status }
      });
    }
  }

  private async syncTreatmentPlanStatusFromItems(tx: Prisma.TransactionClient, treatmentPlanId: string) {
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { status: true }
    });
    if (!plan) return;
    if (
      plan.status === TreatmentPlanStatus.CANCELLED ||
      plan.status === TreatmentPlanStatus.REJECTED ||
      plan.status === TreatmentPlanStatus.COMPLETED
    ) {
      return;
    }

    const items = await tx.treatmentPlanItem.findMany({
      where: { treatmentPlanId },
      select: { status: true, completionPercentage: true }
    });
    const progress = calculateTreatmentPlanClinicalProgress(items);
    const nextStatus = resolveTreatmentPlanStatusFromClinicalProgress(plan.status, progress);
    if (nextStatus !== plan.status) {
      await tx.treatmentPlan.update({
        where: { id: treatmentPlanId },
        data: { status: nextStatus }
      });
    }
  }

  private async createEvolutionFromCompletedProcedure(
    tx: Prisma.TransactionClient,
    toothProcedure: {
      id: string;
      patientId: string;
      appointmentId: string | null;
      professionalId: string;
      treatmentPlanId: string | null;
      toothNumber: string;
      surface: string | null;
      diagnosis: string | null;
      procedure: { name: string } | null;
      treatmentPlanItemId?: string | null;
    },
    notes?: string
  ) {
    const position = toothProcedure.surface ? `${toothProcedure.toothNumber}-${toothProcedure.surface}` : toothProcedure.toothNumber;
    const procedureName = toothProcedure.procedure?.name ?? "Procedimiento odontologico";

    const treatmentItem = toothProcedure.treatmentPlanItemId
      ? await tx.treatmentPlanItem.findUnique({ where: { id: toothProcedure.treatmentPlanItemId } })
      : null;
    const evolution = await tx.clinicalEvolution.create({
      data: {
        patientId: toothProcedure.patientId,
        appointmentId: toothProcedure.appointmentId,
        professionalId: toothProcedure.professionalId,
        treatmentPlanId: toothProcedure.treatmentPlanId,
        treatmentPlanItemId: toothProcedure.treatmentPlanItemId,
        completionPercentage: 100,
        performedAmountSnapshot: treatmentItem ? this.performedAmountForProgress(treatmentItem.total, 100) : undefined,
        objective: `Procedimiento completado en pieza ${position}`,
        assessment: toothProcedure.diagnosis ?? undefined,
        plan: "Seguimiento clinico posterior al procedimiento",
        notes: notes?.trim() || `Generado desde odontograma: ${procedureName}`
      }
    });

    return evolution.id;
  }

  private clinicalEvolutionInclude() {
    return {
      professional: true,
      appointment: true,
      signedBy: { select: { id: true, firstName: true, lastName: true } },
      addenda: { orderBy: { createdAt: "asc" as const } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      branch: { select: { id: true, name: true } },
      fields: { orderBy: { sortOrder: "asc" as const } },
      materials: { include: { inventoryItem: true } },
      annulledBy: { select: { id: true, firstName: true, lastName: true } },
      treatmentPlanItem: {
        include: {
          procedure: { select: { id: true, code: true, name: true } },
          treatmentPlan: { select: { id: true, name: true } }
        }
      }
    };
  }

  private async audit(actor: AuthUser, patientId: string | null, action: string, after: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: patientId ? "PatientClinicalRecord" : "ClinicalConfiguration",
        entityId: patientId,
        action,
        after
      }
    });
  }

  async deleteClinicalDocument(actor: AuthUser, patientId: string, documentId: string, reason: string) {
    await this.ensurePatient(actor, patientId);
    const document = await this.prisma.clinicalDocument.findFirst({
      where: { id: documentId, patientId, deletedAt: null }
    });

    if (!document) throw new NotFoundException("Clinical document not found or already deleted");

    const updated = await this.prisma.clinicalDocument.update({
      where: { id: documentId },
      data: {
        deletedAt: new Date(),
        deletedById: actor.id,
        deleteReason: reason.trim()
      },
      include: { template: true }
    });

    await this.audit(actor, patientId, "delete_clinical_document", { documentId, reason: reason.trim() });

    return this.serializeClinicalDocument(updated);
  }

  private serializeClinicalDocument<T extends { content: Prisma.JsonValue; template?: ({ content: Prisma.JsonValue } | null) }>(document: T) {
    return {
      ...document,
      content: coerceClinicalDocumentContent(document.content),
      template: document.template
        ? { ...document.template, content: coerceClinicalDocumentContent(document.template.content) }
        : document.template
    };
  }

  private serializeClinicalDocumentTemplate<T extends { content: Prisma.JsonValue }>(template: T) {
    return { ...template, content: coerceClinicalDocumentContent(template.content) };
  }

  private async ensureClinicalDocumentTemplate(actor: AuthUser, templateId: string) {
    const template = await this.prisma.clinicalDocumentTemplate.findFirst({
      where: { id: templateId, organizationId: actor.organizationId, isActive: true }
    });
    if (!template) throw new NotFoundException("Clinical document template not found");
    return template;
  }

  private clean<T extends object>(input: T): T {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as T;
  }
}
