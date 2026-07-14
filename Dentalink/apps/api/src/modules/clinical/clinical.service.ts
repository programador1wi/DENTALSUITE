import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
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
import {
  calculateTreatmentPlanClinicalProgress,
  resolveTreatmentPlanStatusFromClinicalProgress
} from "../treatment-plans/treatment-plan-progress";

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
            name: "Bodega central",
            description: "Bodega creada automaticamente para consumo clinico.",
            isDefault: true
          }
        });
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
            inventoryItemId: inventoryItem.id,
            branchId: patient.branchId!,
            warehouseId: warehouse.id,
            type: "OUT",
            quantity: numericQty,
            reason: `Consumo por evolución clínica ${current.id}`,
            source: "CLINICAL",
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

        // Descontar
        await tx.inventoryStock.update({
          where: { id: stockRow.id },
          data: { stock: { decrement: numericQty } }
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
              inventoryItemId: inventoryItem.id,
              branchId: material.inventoryMovement.branchId,
              warehouseId: material.inventoryMovement.warehouseId,
              type: "IN",
              quantity: numericQty,
              reason: `Reversa por anulación de evolución clínica ${current.id}. Motivo: ${dto.reason}`,
              source: "CLINICAL_REVERSAL",
              createdById: actor.id,
              patientId,
              clinicalEvolutionId: current.id,
              stockBefore: numericStock,
              stockAfter: numericStock + numericQty,
              reversalOfMovementId: material.inventoryMovement.id
            }
          });

          if (material.inventoryMovement.warehouseId) {
            await tx.inventoryStock.updateMany({
              where: { inventoryItemId: inventoryItem.id, warehouseId: material.inventoryMovement.warehouseId },
              data: { stock: { increment: numericQty } }
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
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
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
