import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import sharp from "sharp";
import {
  LabOrderStatus,
  PaymentStatus,
  Prisma,
  ToothProcedureStatus,
  TreatmentPlanItemStatus
} from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { branchScope } from "../../common/utils/branch-scope.util";
import { PrintTreatmentPlanDocumentDto } from "./dto/treatment-plan.dto";
import {
  TreatmentPlanDocumentImage,
  TreatmentPlanDocumentInput,
  TreatmentPlanDocumentItem,
  TreatmentPlanDocumentOdontogram,
  TreatmentPlanDocumentOdontogramRecord,
  buildTreatmentPlanDocumentPdf
} from "./treatment-plan-documents";

export const TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE: Record<string, string> = {
  BUDGET_COMPLETE: "print_complete_budget",
  BUDGET_TOTAL_ONLY: "print_total_only_budget",
  BUDGET_NO_DETAIL: "print_budget_without_values",
  LAB_ORDER: "print_laboratory_order",
  CARE_PLAN: "print_care_plan",
  SECTIONS: "print_treatment_sections",
  ODONTOGRAM: "print_odontogram",
  CLINICAL_HISTORY: "print_clinical_history"
};

export const TREATMENT_PLAN_PRINT_LABEL_BY_TYPE: Record<string, string> = {
  BUDGET_COMPLETE: "Presupuesto completo",
  BUDGET_TOTAL_ONLY: "Presupuesto con total general",
  BUDGET_NO_DETAIL: "Presupuesto sin valores",
  LAB_ORDER: "Orden de laboratorio",
  CARE_PLAN: "Plan de atencion",
  SECTIONS: "Secciones",
  ODONTOGRAM: "Odontograma",
  CLINICAL_HISTORY: "Historial clinico"
};

export const TREATMENT_PLAN_PRINT_DESCRIPTION_BY_TYPE: Record<string, string> = {
  BUDGET_COMPLETE: "Muestra procedimientos, importes individuales, resumen y estado de cuenta.",
  BUDGET_TOTAL_ONLY: "Muestra procedimientos y el total final, sin precios unitarios.",
  BUDGET_NO_DETAIL: "Muestra el detalle clinico sin informacion economica.",
  LAB_ORDER: "Imprime la orden de laboratorio vinculada al plan.",
  CARE_PLAN: "Documento clinico agrupado por secciones, sin informacion economica.",
  SECTIONS: "Permite imprimir las secciones del plan.",
  ODONTOGRAM: "Imprime el odontograma y su tabla de hallazgos.",
  CLINICAL_HISTORY: "Imprime el historial clinico del paciente."
};

@Injectable()
export class TreatmentPlanPrintService {
  constructor(private readonly prisma: PrismaService) {}

  async getTreatmentPlanPrintOptions(actor: AuthUser, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      select: {
        id: true,
        patientId: true,
        branchId: true,
        items: {
          where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
          select: { id: true },
          take: 1
        },
        budgets: {
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        labOrders: {
          where: { status: { not: LabOrderStatus.CANCELLED } },
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");

    const odontogramRecord = await this.prisma.odontogramRecord.findFirst({
      where: { patientId: plan.patientId },
      select: { id: true },
      orderBy: { createdAt: "desc" }
    });

    const hasItems = plan.items.length > 0;
    const hasBudget = plan.budgets.length > 0;
    const hasLabOrder = plan.labOrders.length > 0;
    const hasOdontogram = Boolean(odontogramRecord);

    return Object.keys(TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE).map((documentType) => {
      const permission = TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE[documentType];
      const permissionAllowed = this.hasAnyPermission(actor, [
        permission,
        ...this.legacyPrintPermissions(documentType)
      ]);
      let disabledReason: string | null = null;

      if (!permissionAllowed) disabledReason = "No tienes permiso para generar este documento.";
      else if (
        documentType === "BUDGET_COMPLETE" ||
        documentType === "BUDGET_TOTAL_ONLY" ||
        documentType === "BUDGET_NO_DETAIL"
      ) {
        if (!hasBudget) disabledReason = "Primero genera un presupuesto.";
      } else if (documentType === "LAB_ORDER") {
        if (!hasLabOrder) disabledReason = "No hay una orden de laboratorio vinculada.";
      } else if (documentType === "ODONTOGRAM") {
        if (!hasOdontogram) disabledReason = "El paciente no tiene una version de odontograma.";
      } else if (documentType === "CARE_PLAN" || documentType === "SECTIONS") {
        if (!hasItems) disabledReason = "Agrega al menos una prestacion al plan.";
      }

      return {
        visible: true,
        enabled: disabledReason === null,
        disabled_reason: disabledReason,
        permission,
        document_type: documentType,
        label: TREATMENT_PLAN_PRINT_LABEL_BY_TYPE[documentType],
        description: TREATMENT_PLAN_PRINT_DESCRIPTION_BY_TYPE[documentType],
        context: {
          budgetId: plan.budgets[0]?.id ?? null,
          laboratoryOrderId: plan.labOrders[0]?.id ?? null,
          odontogramVersionId: odontogramRecord?.id ?? null
        }
      };
    });
  }

  async previewTreatmentPlanDocument(actor: AuthUser, id: string, dto: PrintTreatmentPlanDocumentDto) {
    return this.printTreatmentPlanDocument(actor, id, dto, "preview");
  }

  async printTreatmentPlanDocument(
    actor: AuthUser,
    id: string,
    dto: PrintTreatmentPlanDocumentDto,
    mode: "preview" | "generate" = "generate"
  ) {
    this.ensurePrintPermission(actor, dto.type);
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        organization: { select: { name: true, address: true, phone: true, logoUrl: true } },
        branch: {
          select: {
            name: true,
            brand: { select: { name: true, logoUrl: true } },
            address: true,
            exteriorNumber: true,
            interiorNumber: true,
            neighborhood: true,
            municipality: true,
            city: true,
            state: true,
            phone: true
          }
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            documentNumber: true,
            email: true,
            phone: true,
            occupation: true,
            gender: true,
            createdAt: true,
            agreement: { select: { name: true } }
          }
        },
        professional: {
          select: {
            firstName: true,
            lastName: true,
            licenseNumber: true,
            specialties: { include: { specialty: { select: { name: true } } } }
          }
        },
        specialty: { select: { name: true } },
        items: {
          where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
          include: {
            procedure: { select: { code: true, name: true } },
            section: { select: { name: true, sortOrder: true } },
            paymentAllocations: {
              select: {
                amount: true,
                payment: { select: { status: true } }
              }
            }
          },
          orderBy: [{ section: { sortOrder: "asc" } }, { createdAt: "asc" }]
        },
        budgets: {
          where: dto.budgetId ? { id: dto.budgetId } : {},
          orderBy: { createdAt: "desc" },
          take: 1
        },
        labOrders: {
          where: { status: { not: LabOrderStatus.CANCELLED } },
          include: {
            labProvider: { select: { name: true } },
            items: true
          },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        clinicalEvolutions: {
          where: { annulledAt: null },
          include: {
            professional: { select: { firstName: true, lastName: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 100
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    if (dto.type === "LAB_ORDER" && !plan.labOrders.length) {
      throw new BadRequestException("No hay una orden de laboratorio vinculada.");
    }
    if (dto.type !== "LAB_ORDER" && dto.type !== "ODONTOGRAM" && !plan.items.length) {
      throw new BadRequestException("Treatment plan requires at least one active item to print documents");
    }
    if (dto.budgetId && !plan.budgets.length) throw new NotFoundException("Budget not found");
    if (
      (dto.type === "BUDGET_COMPLETE" ||
        dto.type === "BUDGET_TOTAL_ONLY" ||
        dto.type === "BUDGET_NO_DETAIL") &&
      !plan.budgets.length
    ) {
      throw new BadRequestException("Primero genera un presupuesto.");
    }

    const [logoImage, odontogram] = await Promise.all([
      this.resolveTreatmentPlanDocumentLogo(plan),
      dto.type === "ODONTOGRAM"
        ? this.buildTreatmentPlanDocumentOdontogram(plan.patientId)
        : Promise.resolve(null)
    ]);
    if (dto.type === "ODONTOGRAM" && !odontogram?.records.length) {
      throw new BadRequestException("El paciente no tiene registros de odontograma.");
    }

    const input = this.buildTreatmentPlanDocumentInput(plan, dto, { logoImage, odontogram });
    const document = await buildTreatmentPlanDocumentPdf(input);
    await this.audit(actor, "TreatmentPlanDocument", id, mode === "preview" ? "preview" : "generate", {}, {
      treatmentPlanId: id,
      documentType: dto.type,
      budgetId: dto.budgetId ?? plan.budgets[0]?.id ?? null,
      branchId: plan.branchId,
      patientId: plan.patientId
    } as Prisma.InputJsonValue);
    return document;
  }

  private buildTreatmentPlanDocumentInput(
    plan: any,
    dto: PrintTreatmentPlanDocumentDto,
    extras: {
      logoImage?: TreatmentPlanDocumentImage | null;
      odontogram?: TreatmentPlanDocumentOdontogram | null;
    } = {}
  ): TreatmentPlanDocumentInput {
    const items = plan.items.map((item: any) => this.mapTreatmentPlanDocumentItem(item));
    const subtotal = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.subtotal, 0);
    const discount = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.discount, 0);
    const total = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.total, 0);
    const paid = items.reduce((sum: number, item: TreatmentPlanDocumentItem) => sum + item.paid, 0);
    const budget = plan.budgets[0];
    const clinicAddress = [
      plan.branch.address,
      plan.branch.exteriorNumber,
      plan.branch.interiorNumber,
      plan.branch.neighborhood,
      plan.branch.municipality,
      plan.branch.city,
      plan.branch.state
    ]
      .filter(Boolean)
      .join(", ");

    return {
      documentType: dto.type,
      planId: plan.id,
      planNumber: this.documentNumericId(plan.id),
      planName: plan.name,
      status: plan.status,
      generatedAt: budget?.createdAt ?? plan.createdAt,
      printedAt: new Date(),
      clinicName: plan.organization.name,
      clinicAddress: clinicAddress || plan.organization.address || plan.branch.name,
      clinicPhone: plan.branch.phone || plan.organization.phone || "",
      logoImage: extras.logoImage ?? null,
      patient: {
        id: this.documentNumericId(plan.patient.id),
        name: `${plan.patient.firstName} ${plan.patient.lastName}`.trim(),
        documentNumber: plan.patient.documentNumber || "",
        birthDate: plan.patient.birthDate,
        email: plan.patient.email,
        phone: plan.patient.phone,
        occupation: plan.patient.occupation,
        gender: plan.patient.gender,
        createdAt: plan.patient.createdAt
      },
      professional: {
        name: `${plan.professional.firstName} ${plan.professional.lastName}`.trim(),
        specialty:
          plan.specialtySnapshotName ||
          plan.specialty?.name ||
          plan.professional.specialties?.[0]?.specialty?.name ||
          "General",
        licenseNumber: plan.professional.licenseNumber || "-"
      },
      branchName: plan.branch.name,
      agreementName: plan.patient.agreement?.name || "Sin convenio",
      items,
      odontogram: extras.odontogram ?? null,
      clinicalEvolutions: plan.clinicalEvolutions.map((evolution: any) => ({
        createdAt: evolution.createdAt,
        professionalName: `${evolution.professional.firstName} ${evolution.professional.lastName}`.trim(),
        summary:
          this.plainText(evolution.notes) ||
          this.plainText(evolution.assessment) ||
          this.plainText(evolution.objective) ||
          this.plainText(evolution.plan) ||
          this.plainText(evolution.subjective)
      })),
      labOrder: plan.labOrders?.[0]
        ? {
            id: this.documentNumericId(plan.labOrders[0].id),
            status: plan.labOrders[0].status,
            labProviderName: plan.labOrders[0].labProvider?.name ?? "Laboratorio sin nombre",
            sentAt: plan.labOrders[0].sentAt,
            expectedAt: plan.labOrders[0].expectedAt,
            receivedAt: plan.labOrders[0].receivedAt,
            notes: plan.labOrders[0].notes,
            items: (plan.labOrders[0].items ?? []).map((item: any) => ({
              toothNumber: item.toothNumber ? this.toothPrintLabel(item.toothNumber, null) : null,
              workType: item.description,
              material: null,
              shade: null,
              instructions: item.notes
            }))
          }
        : null,
      totals: {
        subtotal,
        discount,
        total,
        paid,
        balance: Math.max(total - paid, 0)
      }
    };
  }

  private async buildTreatmentPlanDocumentOdontogram(
    patientId: string
  ): Promise<TreatmentPlanDocumentOdontogram> {
    const records = await this.prisma.odontogramRecord.findMany({
      where: {
        patientId,
        status: { not: ToothProcedureStatus.CANCELLED }
      },
      include: {
        professional: { select: { firstName: true, lastName: true } },
        procedure: { select: { code: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const mappedRecords = records.map((record: any) => this.mapTreatmentPlanDocumentOdontogramRecord(record));
    const hasTemporalOnly =
      mappedRecords.length > 0 &&
      mappedRecords.every((record) => ["5", "6", "7", "8"].includes(record.toothNumber[0]));

    return {
      dentition: hasTemporalOnly ? "temporal" : "permanent",
      recordedAt: mappedRecords[0]?.createdAt ?? null,
      records: mappedRecords
    };
  }

  private mapTreatmentPlanDocumentOdontogramRecord(record: any): TreatmentPlanDocumentOdontogramRecord {
    return {
      id: record.id,
      createdAt: record.createdAt,
      toothNumber: record.toothNumber,
      toothLabel: this.toothPrintLabel(record.toothNumber, null),
      surface: record.surface,
      surfaceLabel: this.surfacePrintLabel(record.surface),
      condition: record.condition,
      diagnosis: record.diagnosis,
      odontogramSymbol: record.odontogramSymbol,
      status: record.status,
      procedureCode: record.procedure?.code ?? null,
      procedureName: record.procedure?.name ?? null,
      professionalName:
        `${record.professional?.firstName ?? ""} ${record.professional?.lastName ?? ""}`.trim() || "-"
    };
  }

  private async resolveTreatmentPlanDocumentLogo(plan: any): Promise<TreatmentPlanDocumentImage | null> {
    const logoUrl = plan.branch?.brand?.logoUrl || plan.organization?.logoUrl;
    if (!logoUrl) return null;
    return this.loadTreatmentPlanDocumentImage(logoUrl);
  }

  private async loadTreatmentPlanDocumentImage(value: string): Promise<TreatmentPlanDocumentImage | null> {
    const source = value.trim();
    if (!source) return null;

    const dataMatch = source.match(/^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/=\r\n]+)$/i);
    if (!dataMatch) return null;
    try {
      const bytes = Buffer.from(dataMatch[1], "base64");
      if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) return null;
      const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) return null;
      const normalized = await image
        .rotate()
        .resize({ width: 2_000, height: 2_000, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      return {
        mimeType: "image/png",
        base64: normalized.toString("base64")
      };
    } catch {
      return null;
    }
  }

  private ensurePrintPermission(actor: AuthUser, documentType: string) {
    const permission = TREATMENT_PLAN_PRINT_PERMISSION_BY_TYPE[documentType];
    if (!permission) throw new BadRequestException("Unsupported treatment plan document type");
    if (!this.hasAnyPermission(actor, [permission, ...this.legacyPrintPermissions(documentType)])) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }

  private hasAnyPermission(actor: AuthUser, permissions: string[]) {
    if (actor.permissions.includes("organization.manage_all")) return true;
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  private legacyPrintPermissions(documentType: string) {
    if (documentType === "ODONTOGRAM") return ["clinical.odontogram.read"];
    if (documentType === "CLINICAL_HISTORY") return ["clinical.read"];
    if (documentType === "LAB_ORDER") return ["lab_orders.read"];
    return ["budgets.print"];
  }

  private mapTreatmentPlanDocumentItem(item: any): TreatmentPlanDocumentItem {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const subtotal = quantity * unitPrice;
    const discount = Number(item.discount) || 0;
    const total = Number(item.total) || 0;
    const paid = this.resolveProcedurePayment(item).paidAmount.toNumber();

    return {
      id: item.id,
      status: this.treatmentPlanItemStatusLabel(item.status),
      procedureCode: item.procedure?.code || item.priceSnapshotCode || "-",
      procedureName: item.procedure?.name || item.priceSnapshotName || "Procedimiento sin nombre",
      sectionName: item.section?.name ?? null,
      toothLabel: this.toothPrintLabel(item.toothNumber, item.surface),
      surfaceLabel: this.surfacePrintLabel(item.surface),
      quantity,
      subtotal,
      discount,
      total,
      paid,
      plannedAt: item.plannedAt,
      completedAt: item.completedAt,
      notes: item.notes
    };
  }

  private treatmentPlanItemStatusLabel(status: TreatmentPlanItemStatus) {
    const labels: Record<TreatmentPlanItemStatus, string> = {
      [TreatmentPlanItemStatus.PLANNED]: "Pendiente",
      [TreatmentPlanItemStatus.ACCEPTED]: "Aceptado",
      [TreatmentPlanItemStatus.PAID]: "Pagado",
      [TreatmentPlanItemStatus.IN_PROGRESS]: "En atencion",
      [TreatmentPlanItemStatus.COMPLETED]: "Realizado",
      [TreatmentPlanItemStatus.CANCELLED]: "Cancelado"
    };
    return labels[status] ?? status;
  }

  private toothPrintLabel(toothNumber?: string | null, surface?: string | null) {
    if (!toothNumber) return "-";
    const normalized = toothNumber.length >= 2 ? `${toothNumber[0]}.${toothNumber[1]}` : toothNumber;
    const surfaceCode = surface?.trim().toUpperCase();
    if (!surfaceCode || surfaceCode === "ALL") return normalized;
    return `${normalized}:${surfaceCode.toLowerCase()}`;
  }

  private surfacePrintLabel(surface?: string | null) {
    const value = surface?.trim().toUpperCase();
    if (!value) return "-";
    if (value === "ALL") return "Pieza completa";
    const labels: Record<string, string> = {
      P: "Palatina",
      M: "Mesial",
      B: "Vestibular",
      V: "Vestibular",
      D: "Distal",
      O: "Oclusal",
      L: "Lingual",
      I: "Incisal"
    };
    return value
      .split(",")
      .map((part) => labels[part.trim()] || part.trim())
      .filter(Boolean)
      .join(", ");
  }

  private documentNumericId(id: string) {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = id.charCodeAt(index) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 1000000)
      .toString()
      .padStart(6, "0");
  }

  private plainText(value?: string | null) {
    return (value ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private resolveProcedurePayment(item: {
    total: Prisma.Decimal;
    paymentAllocations?: Array<{
      amount: Prisma.Decimal;
      settlementDiscountAmount?: Prisma.Decimal;
      payment?: { status?: PaymentStatus } | null;
    }>;
  }) {
    const paidAmount = (item.paymentAllocations ?? []).reduce((sum, allocation) => {
      if (allocation.payment?.status === PaymentStatus.VOIDED) return sum;
      return sum.plus(allocation.amount).plus(allocation.settlementDiscountAmount ?? 0);
    }, new Prisma.Decimal(0));
    const balance = new Prisma.Decimal(item.total).minus(paidAmount).toDecimalPlaces(2);
    let status: "UNPAID" | "PARTIAL" | "PAID" | "CREDIT" = "UNPAID";
    if (paidAmount.gt(item.total)) status = "CREDIT";
    else if (paidAmount.gte(item.total)) status = "PAID";
    else if (paidAmount.gt(0)) status = "PARTIAL";
    return {
      paidAmount: paidAmount.toDecimalPlaces(2),
      balance: balance.gt(0) ? balance : new Prisma.Decimal(0),
      status
    };
  }

  private async audit(
    actor: AuthUser,
    entity: string,
    entityId: string | null,
    action: string,
    before: Prisma.InputJsonValue,
    after: Prisma.InputJsonValue
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity,
        entityId: entityId ?? undefined,
        action,
        before,
        after
      }
    });
  }
}
