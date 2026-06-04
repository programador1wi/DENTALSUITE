import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ToothProcedureStatus } from "@prisma/client";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { withAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import {
  CreateAllergyDto,
  CreateMedicalConditionDto,
  CreateMedicationDto,
  UpsertMedicalHistoryDto
} from "./dto/medical-history.dto";
import {
  CreateClinicalEvolutionAddendumDto,
  CreateClinicalEvolutionDto,
  UpdateClinicalEvolutionDto
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

  async listEvolutions(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    return this.prisma.clinicalEvolution.findMany({
      where: { patientId },
      include: {
        professional: true,
        appointment: true,
        signedBy: { select: { id: true, firstName: true, lastName: true } },
        addenda: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createEvolution(actor: AuthUser, patientId: string, dto: CreateClinicalEvolutionDto) {
    await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);

    const evolution = await this.prisma.clinicalEvolution.create({
      data: {
        patientId,
        professionalId: dto.professionalId,
        appointmentId: dto.appointmentId,
        treatmentPlanId: dto.treatmentPlanId,
        subjective: dto.subjective?.trim(),
        objective: dto.objective?.trim(),
        assessment: dto.assessment?.trim(),
        plan: dto.plan?.trim(),
        notes: dto.notes?.trim()
      }
    });
    await this.audit(actor, patientId, "create_evolution", evolution);
    return evolution;
  }

  async updateEvolution(actor: AuthUser, patientId: string, evolutionId: string, dto: UpdateClinicalEvolutionDto) {
    await this.ensurePatient(actor, patientId);
    const current = await this.prisma.clinicalEvolution.findFirst({ where: { id: evolutionId, patientId } });
    if (!current) throw new NotFoundException("Clinical evolution not found");
    if (current.signedAt) throw new BadRequestException("Signed evolutions cannot be edited directly. Create an addendum.");

    if (dto.professionalId) await this.validateProfessional(actor, dto.professionalId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);

    const updated = await this.prisma.clinicalEvolution.update({
      where: { id: evolutionId },
      data: {
        professionalId: dto.professionalId,
        appointmentId: dto.appointmentId,
        treatmentPlanId: dto.treatmentPlanId,
        subjective: dto.subjective?.trim(),
        objective: dto.objective?.trim(),
        assessment: dto.assessment?.trim(),
        plan: dto.plan?.trim(),
        notes: dto.notes?.trim()
      }
    });
    await this.audit(actor, patientId, "update_evolution", updated);
    return updated;
  }

  async signEvolution(actor: AuthUser, patientId: string, evolutionId: string) {
    await this.ensurePatient(actor, patientId);
    const current = await this.prisma.clinicalEvolution.findFirst({ where: { id: evolutionId, patientId } });
    if (!current) throw new NotFoundException("Clinical evolution not found");
    if (current.signedAt) return current;

    const signed = await this.prisma.clinicalEvolution.update({
      where: { id: evolutionId },
      data: { signedAt: new Date(), signedById: actor.id }
    });
    await this.audit(actor, patientId, "sign_evolution", signed);
    return signed;
  }

  async createEvolutionAddendum(actor: AuthUser, patientId: string, evolutionId: string, dto: CreateClinicalEvolutionAddendumDto) {
    await this.ensurePatient(actor, patientId);
    const parent = await this.prisma.clinicalEvolution.findFirst({ where: { id: evolutionId, patientId } });
    if (!parent) throw new NotFoundException("Clinical evolution not found");
    if (!parent.signedAt) throw new BadRequestException("Only signed evolutions require addenda");
    await this.validateProfessional(actor, dto.professionalId);

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
      include: { professional: true, appointment: true, items: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPrescription(actor: AuthUser, patientId: string, dto: CreatePrescriptionDto) {
    await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId);
    if (dto.appointmentId) await this.validateAppointment(actor, patientId, dto.appointmentId);
    if (!dto.items.length) throw new BadRequestException("Prescription requires at least one item");

    const prescription = await this.prisma.prescription.create({
      data: {
        patientId,
        professionalId: dto.professionalId,
        appointmentId: dto.appointmentId,
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
    return this.prisma.clinicalDocument.findMany({ where: { patientId }, include: { template: true }, orderBy: { createdAt: "desc" } });
  }

  async listTemplates(actor: AuthUser) {
    return this.prisma.clinicalDocumentTemplate.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: { name: "asc" }
    });
  }

  async createTemplate(actor: AuthUser, dto: CreateClinicalDocumentTemplateDto) {
    const template = await this.prisma.clinicalDocumentTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        content: dto.content
      }
    });
    await this.audit(actor, null, "create_document_template", template);
    return template;
  }

  async createDocument(actor: AuthUser, patientId: string, dto: CreateClinicalDocumentDto) {
    await this.ensurePatient(actor, patientId);
    const document = await this.prisma.clinicalDocument.create({
      data: {
        patientId,
        templateId: dto.templateId,
        title: dto.title.trim(),
        content: dto.content,
        createdById: actor.id
      }
    });
    await this.audit(actor, patientId, "create_document", document);
    return document;
  }

  async createDocumentFromTemplate(actor: AuthUser, patientId: string, dto: CreateClinicalDocumentFromTemplateDto) {
    await this.ensurePatient(actor, patientId);
    const template = await this.prisma.clinicalDocumentTemplate.findFirst({
      where: { id: dto.templateId, organizationId: actor.organizationId, isActive: true }
    });
    if (!template) throw new NotFoundException("Clinical document template not found");
    return this.createDocument(actor, patientId, { templateId: template.id, title: dto.title, content: template.content });
  }

  async listOdontogram(actor: AuthUser, patientId: string, query: ListOdontogramQueryDto) {
    await this.ensurePatient(actor, patientId);
    const toothNumber = query.toothNumber ? this.normalizeToothNumber(query.toothNumber) : undefined;

    const [records, conditions, procedures] = await Promise.all([
      this.prisma.odontogramRecord.findMany({
        where: {
          patientId,
          ...(toothNumber ? { toothNumber } : {})
        },
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
          OR: [
            { odontogramRecordId: null },
            { odontogramRecord: { is: { status: { not: ToothProcedureStatus.CANCELLED } } } }
          ]
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.toothProcedure.findMany({
        where: { patientId, ...(toothNumber ? { toothNumber } : {}) },
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const latestByTooth = records.reduce<Record<string, (typeof records)[number]>>((accumulator, item) => {
      if (item.status === ToothProcedureStatus.CANCELLED) return accumulator;
      const key = `${item.toothNumber}:${item.surface ?? "-"}`;
      if (!accumulator[key]) accumulator[key] = item;
      return accumulator;
    }, {});

    return { records, conditions, procedures, latestByTooth };
  }

  async getToothHistory(actor: AuthUser, patientId: string, toothNumberInput: string) {
    await this.ensurePatient(actor, patientId);
    const toothNumber = this.normalizeToothNumber(toothNumberInput);

    const [records, conditions, procedures] = await Promise.all([
      this.prisma.odontogramRecord.findMany({
        where: { patientId, toothNumber },
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
          OR: [
            { odontogramRecordId: null },
            { odontogramRecord: { is: { status: { not: ToothProcedureStatus.CANCELLED } } } }
          ]
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.toothProcedure.findMany({
        where: { patientId, toothNumber },
        include: {
          professional: { select: { id: true, firstName: true, lastName: true } },
          procedure: { select: { id: true, code: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    return { toothNumber, records, conditions, procedures };
  }

  async createToothCondition(actor: AuthUser, patientId: string, dto: CreateToothConditionDto) {
    await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId);
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
    await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId);
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
    await this.ensurePatient(actor, patientId);
    await this.validateProfessional(actor, dto.professionalId);
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
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async validateProfessional(actor: AuthUser, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: actor.organizationId, isActive: true }
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
    const allowed = new Set(["O", "I", "M", "D", "B", "L", "P", "C", "MO", "DO", "MOD", "ALL"]);
    if (!allowed.has(surface)) throw new BadRequestException("Invalid tooth surface");
    return surface;
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
    },
    notes?: string
  ) {
    const position = toothProcedure.surface ? `${toothProcedure.toothNumber}-${toothProcedure.surface}` : toothProcedure.toothNumber;
    const procedureName = toothProcedure.procedure?.name ?? "Procedimiento odontologico";

    const evolution = await tx.clinicalEvolution.create({
      data: {
        patientId: toothProcedure.patientId,
        appointmentId: toothProcedure.appointmentId,
        professionalId: toothProcedure.professionalId,
        treatmentPlanId: toothProcedure.treatmentPlanId,
        objective: `Procedimiento completado en pieza ${position}`,
        assessment: toothProcedure.diagnosis ?? undefined,
        plan: "Seguimiento clinico posterior al procedimiento",
        notes: notes?.trim() || `Generado desde odontograma: ${procedureName}`
      }
    });

    return evolution.id;
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

  private clean<T extends object>(input: T): T {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as T;
  }
}
