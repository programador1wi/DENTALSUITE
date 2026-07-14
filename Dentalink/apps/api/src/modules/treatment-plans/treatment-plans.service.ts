import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  BudgetStatus,
  PaymentStatus,
  Prisma,
  ProfessionalBranchStatus,
  TreatmentPriceSource,
  ToothProcedureStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanKind,
  TreatmentPlanStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { resolveAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  BulkDiscountTreatmentPlanItemsDto,
  ChangeTreatmentPlanBranchDto,
  CreateAlternativeDto,
  CreateBudgetDto,
  CreateOrthodonticMonthlyItemsDto,
  CreateTreatmentPlanDto,
  ListBudgetsQueryDto,
  ListTreatmentPlansQueryDto,
  OrthodonticEvolutionsQueryDto,
  PrintTreatmentPlanDocumentDto,
  TreatmentPlanSectionInputDto,
  UpdateOrthodonticDiagnosisDto,
  UpdateOrthodonticProfileDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanItemDto,
  UpdateTreatmentPlanItemStatusDto,
  ReactivateTreatmentPlanDto,
  DeactivateTreatmentPlanDto,
  DuplicateTreatmentPlanDto,
  ReferTreatmentPlanDto,
  StartOrthodonticTreatmentDto
} from "./dto/treatment-plan.dto";
import {
  buildTreatmentPlanDocumentPdf,
  type TreatmentPlanDocumentInput,
  type TreatmentPlanDocumentItem
} from "./treatment-plan-documents";
import {
  calculateTreatmentPlanClinicalProgress,
  resolveTreatmentPlanClinicalStatus,
  resolveTreatmentPlanStatusFromClinicalProgress
} from "./treatment-plan-progress";

type TreatmentAgreementSnapshot = {
  id?: string | null;
  isActive?: boolean;
  discountPercent?: Prisma.Decimal | number | string | null;
} | null;

type TreatmentPatientForPricing = {
  agreement?: {
    id?: string | null;
    isActive?: boolean;
    priceListId?: string | null;
    discountPercent?: Prisma.Decimal | number | string | null;
  } | null;
};

type ProcedurePriceSnapshot = {
  unitPrice: number;
  priceListId: string | null;
  priceListItemId: string | null;
  priceSource: TreatmentPriceSource;
  priceSnapshotName: string | null;
  priceSnapshotCode: string | null;
  priceSnapshotCategory: string | null;
  priceResolvedAt: Date | null;
};

type TreatmentPlanItemBuildInput = Required<
  Pick<UpdateTreatmentPlanItemDto, "procedureId" | "quantity" | "unitPrice" | "discount">
> &
  UpdateTreatmentPlanItemDto &
  ProcedurePriceSnapshot;

type ProfessionalPlanSpecialty = {
  id: string;
  name: string;
  kind: TreatmentPlanKind;
};

const CLOSED_TREATMENT_PLAN_STATUSES = new Set<TreatmentPlanStatus>([
  TreatmentPlanStatus.CANCELLED,
  TreatmentPlanStatus.REJECTED
]);

@Injectable()
export class TreatmentPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listTreatmentPlans(actor: AuthUser, query: ListTreatmentPlansQueryDto) {
    const { skip, take } = resolvePagination(query);
    const rows = await this.prisma.treatmentPlan.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.patientId ? { patientId: query.patientId } : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.professionalId ? { professionalId: query.professionalId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {})
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialties: { include: { specialty: { select: { id: true, name: true } } } }
          }
        },
        specialty: { select: { id: true, name: true } },
        orthodonticProfile: true,
        pauses: true,
        branch: { select: { id: true, name: true } },
        items: true,
        budgets: true,
        clinicalEvolutions: {
          where: { annulledAt: null },
          select: {
            id: true,
            createdAt: true,
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            notes: true
          },
          orderBy: { createdAt: "desc" },
          take: 100
        }
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => this.withTreatmentPlanDerivedState(row, {
      itemsCount: row.items.length,
      budgetCount: row.budgets.length
    }));
  }

  async createTreatmentPlan(actor: AuthUser, dto: CreateTreatmentPlanDto) {
    await this.validateBranch(actor, dto.branchId);
    const patient = await this.validatePatient(actor, dto.patientId);
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      dto.professionalId,
      dto.branchId,
      dto.kind
    );
    if (dto.parentTreatmentPlanId) await this.ensureTreatmentPlan(actor, dto.parentTreatmentPlanId);

    const created = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          kind: planSpecialty.kind,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          status: dto.status ?? TreatmentPlanStatus.DRAFT,
          isAlternative: dto.isAlternative ?? false,
          parentTreatmentPlanId: dto.parentTreatmentPlanId
        }
      });

      if (planSpecialty.kind === TreatmentPlanKind.ORTHODONTICS) {
        await tx.orthodonticTreatmentProfile.create({
          data: { treatmentPlanId: plan.id }
        });
      }

      if (dto.sections?.length) {
        for (const section of dto.sections) {
          await tx.treatmentPlanSection.create({
            data: {
              treatmentPlanId: plan.id,
              name: section.name.trim(),
              sortOrder: section.sortOrder ?? 0
            }
          });
        }
      }

      if (dto.items?.length) {
        for (const item of dto.items) {
          await this.validateProcedureInTransaction(tx, actor, item.procedureId);
          if (item.sectionId) await this.validateSectionInTransaction(tx, plan.id, item.sectionId);

          const agreement = patient.agreement;
          const itemPayload = await this.resolveItemPayload(actor, dto.branchId, patient, item);
          await tx.treatmentPlanItem.create({
            data: this.buildItemData(plan.id, itemPayload, agreement)
          });
        }
      }

      if (dto.parentTreatmentPlanId) {
        await tx.treatmentPlanAlternative.upsert({
          where: {
            parentTreatmentPlanId_alternativeTreatmentPlanId: {
              parentTreatmentPlanId: dto.parentTreatmentPlanId,
              alternativeTreatmentPlanId: plan.id
            }
          },
          update: {},
          create: {
            parentTreatmentPlanId: dto.parentTreatmentPlanId,
            alternativeTreatmentPlanId: plan.id
          }
        });
      }

      return plan;
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      created.id,
      "create",
      {},
      {
        name: created.name,
        status: created.status,
        isAlternative: created.isAlternative,
        kind: created.kind,
        specialtySnapshotName: created.specialtySnapshotName
      }
    );
    return this.getTreatmentPlan(actor, created.id);
  }

  async getTreatmentPlan(actor: AuthUser, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialties: { include: { specialty: { select: { id: true, name: true } } } }
          }
        },
        specialty: { select: { id: true, name: true } },
        orthodonticProfile: true,
        pauses: true,
        branch: { select: { id: true, name: true } },
        sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        items: {
          include: {
            procedure: { select: { id: true, code: true, name: true } },
            section: true,
            paymentAllocations: { select: { id: true, amount: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        budgets: {
          include: { items: true },
          orderBy: { createdAt: "desc" }
        },
        alternativePlans: {
          include: {
            items: true,
            professional: { select: { firstName: true, lastName: true } }
          }
        },
        clinicalEvolutions: {
          where: { annulledAt: null },
          select: {
            id: true,
            createdAt: true,
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            notes: true
          },
          orderBy: { createdAt: "desc" },
          take: 24
        },
        alternativesAsParent: {
          include: {
            alternativeTreatmentPlan: {
              include: { items: true, professional: { select: { firstName: true, lastName: true } } }
            }
          }
        }
      }
    });

    if (!plan) throw new NotFoundException("Treatment plan not found");
    return this.withTreatmentPlanDerivedState(plan);
  }

  async updateTreatmentPlan(actor: AuthUser, id: string, dto: UpdateTreatmentPlanDto) {
    const current = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(current);
    if (dto.status && CLOSED_TREATMENT_PLAN_STATUSES.has(dto.status)) {
      throw new BadRequestException("Use the treatment plan deactivation endpoint to close a plan");
    }
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);
    let planSpecialty: ProfessionalPlanSpecialty | null = null;
    if (dto.branchId || dto.professionalId) {
      planSpecialty = await this.validateProfessionalPlanSpecialty(
        actor,
        dto.professionalId ?? current.professionalId,
        dto.branchId ?? current.branchId,
        current.kind
      );
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        specialtyId: planSpecialty?.id,
        specialtySnapshotName: planSpecialty?.name,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        status: dto.status,
        acceptedAt:
          dto.status === TreatmentPlanStatus.ACCEPTED
            ? (current.acceptedAt ?? new Date())
            : current.acceptedAt,
        completedAt:
          dto.status === TreatmentPlanStatus.COMPLETED
            ? (current.completedAt ?? new Date())
            : current.completedAt
      }
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "update",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async updateOrthodonticProfile(actor: AuthUser, id: string, dto: UpdateOrthodonticProfileDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "update orthodontic data for");
    const payload = {
      startDate: this.optionalDate(dto.startDate),
      estimatedMonths: dto.estimatedMonths === undefined ? undefined : dto.estimatedMonths,
      estimatedControls: dto.estimatedControls === undefined ? undefined : dto.estimatedControls,
      lastUpperArch: this.optionalString(dto.lastUpperArch),
      lastLowerArch: this.optionalString(dto.lastLowerArch),
      nextControlAt: this.optionalDate(dto.nextControlAt),
      nextRadiographyAt: this.optionalDate(dto.nextRadiographyAt),
      hygieneStatus: this.optionalString(dto.hygieneStatus),
      alert: this.optionalString(dto.alert),
      indications: this.optionalString(dto.indications),
      elastics: this.optionalString(dto.elastics),
      planNotes: this.optionalString(dto.planNotes)
    };

    const saved = await this.prisma.orthodonticTreatmentProfile.upsert({
      where: { treatmentPlanId: plan.id },
      create: {
        treatmentPlanId: plan.id,
        ...payload
      },
      update: payload
    });

    await this.audit(
      actor,
      "OrthodonticTreatmentProfile",
      saved.id,
      "update",
      {},
      saved as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async updateOrthodonticDiagnosis(actor: AuthUser, id: string, dto: UpdateOrthodonticDiagnosisDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "update orthodontic diagnosis for");
    const saved = await this.prisma.orthodonticTreatmentProfile.upsert({
      where: { treatmentPlanId: plan.id },
      create: {
        treatmentPlanId: plan.id,
        diagnosis: dto.diagnosis as Prisma.InputJsonValue
      },
      update: {
        diagnosis: dto.diagnosis as Prisma.InputJsonValue
      }
    });

    await this.audit(actor, "OrthodonticTreatmentProfile", saved.id, "update_diagnosis", {}, {
      treatmentPlanId: plan.id
    } as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, id);
  }

  async startOrthodonticTreatment(actor: AuthUser, id: string, dto: StartOrthodonticTreatmentDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "start");
    const existingProfile = await this.prisma.orthodonticTreatmentProfile.findUnique({
      where: { treatmentPlanId: plan.id }
    });
    if (existingProfile?.startDate) {
      throw new BadRequestException("Orthodontic treatment has already been started");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException("Invalid startDate");

    const saved = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.orthodonticTreatmentProfile.upsert({
        where: { treatmentPlanId: plan.id },
        create: { treatmentPlanId: plan.id, startDate },
        update: { startDate }
      });
      await tx.treatmentPlan.update({
        where: { id: plan.id },
        data: {
          status:
            plan.status === TreatmentPlanStatus.DRAFT || plan.status === TreatmentPlanStatus.ACCEPTED
              ? TreatmentPlanStatus.IN_PROGRESS
              : plan.status
        }
      });
      return profile;
    });

    await this.audit(actor, "OrthodonticTreatmentProfile", saved.id, "start", {}, {
      treatmentPlanId: plan.id,
      startDate
    } as Prisma.InputJsonValue);
    return this.getOrthodonticSummary(actor, id);
  }

  async getOrthodonticSummary(actor: AuthUser, id: string) {
    const canViewPrivate = this.canViewPrivateEvolutions(actor);
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        orthodonticProfile: true,
        pauses: { orderBy: { startDate: "desc" } },
        clinicalEvolutions: {
          where: {
            annulledAt: null,
            ...(canViewPrivate ? {} : { OR: [{ isPrivate: false }, { createdById: actor.id }] })
          },
          include: this.orthodonticEvolutionInclude(),
          orderBy: { createdAt: "desc" },
          take: 200
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    if (plan.kind !== TreatmentPlanKind.ORTHODONTICS) {
      throw new BadRequestException("Orthodontic summary is only available for orthodontic treatment plans");
    }

    return this.mapOrthodonticSummary(plan, canViewPrivate);
  }

  async listOrthodonticEvolutions(actor: AuthUser, id: string, query: OrthodonticEvolutionsQueryDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    const { page, pageSize, skip, take } = resolvePagination(query);
    const canViewPrivate = this.canViewPrivateEvolutions(actor);
    const where: Prisma.ClinicalEvolutionWhereInput = {
      treatmentPlanId: plan.id,
      addendumOfId: null,
      annulledAt: null,
      ...(canViewPrivate ? {} : { OR: [{ isPrivate: false }, { createdById: actor.id }] }),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    if (query.hasHygiene !== undefined) {
      where.fields = query.hasHygiene
        ? { some: { group: "ORTHODONTICS", label: { contains: "Higiene", mode: "insensitive" } } }
        : { none: { group: "ORTHODONTICS", label: { contains: "Higiene", mode: "insensitive" } } };
    }
    if (query.search?.trim()) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { notes: { contains: query.search.trim(), mode: "insensitive" } },
            { fields: { some: { value: { contains: query.search.trim(), mode: "insensitive" } } } }
          ]
        }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.clinicalEvolution.findMany({
        where,
        include: this.orthodonticEvolutionInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.clinicalEvolution.count({ where })
    ]);

    return {
      items: items.map((evolution) => this.mapOrthodonticEvolution(evolution)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  async createOrthodonticMonthlyItems(actor: AuthUser, id: string, dto: CreateOrthodonticMonthlyItemsDto) {
    const plan = await this.ensureOrthodonticTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "create monthly items for");
    await this.validateProcedure(actor, dto.procedureId);
    const agreement = plan.patient.agreement;
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException("Invalid startDate");
    const sectionName = dto.sectionName?.trim() || "Mensualidades";

    const createdIds = await this.prisma.$transaction(async (tx) => {
      const section =
        (await tx.treatmentPlanSection.findFirst({
          where: { treatmentPlanId: plan.id, name: sectionName }
        })) ??
        (await tx.treatmentPlanSection.create({
          data: {
            treatmentPlanId: plan.id,
            name: sectionName,
            sortOrder:
              ((
                await tx.treatmentPlanSection.aggregate({
                  where: { treatmentPlanId: plan.id },
                  _max: { sortOrder: true }
                })
              )._max.sortOrder ?? -1) + 1
          }
        }));

      const ids: string[] = [];
      for (let index = 0; index < dto.months; index++) {
        const plannedAt = new Date(startDate);
        plannedAt.setMonth(startDate.getMonth() + index);
        const itemPayload = await this.resolveItemPayload(actor, plan.branchId, plan.patient, {
          procedureId: dto.procedureId,
          quantity: 1,
          unitPrice: dto.unitPrice,
          discount: 0,
          plannedAt: plannedAt.toISOString(),
          notes: dto.notes?.trim()
        });

        const item = await tx.treatmentPlanItem.create({
          data: this.buildItemData(
            plan.id,
            {
              ...itemPayload,
              sectionId: section.id,
              plannedAt: plannedAt.toISOString(),
              notes: dto.notes?.trim() || `Mensualidad ${index + 1}/${dto.months}`
            },
            agreement
          )
        });
        ids.push(item.id);
      }
      return ids;
    });

    await this.audit(actor, "TreatmentPlanItem", null, "create_orthodontic_monthly_items", {}, {
      treatmentPlanId: plan.id,
      count: createdIds.length
    } as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, id);
  }

  async changeBranch(actor: AuthUser, id: string, dto: ChangeTreatmentPlanBranchDto) {
    const current = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(current, "change branch for");
    await this.validateBranch(actor, dto.branchId);
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      dto.professionalId,
      dto.branchId,
      current.kind
    );

    const futureAppointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      patientId: current.patientId,
      treatmentPlanId: id,
      startAt: { gte: new Date() },
      status: {
        notIn: [
          AppointmentStatus.COMPLETED,
          AppointmentStatus.CANCELLED_BY_PATIENT,
          AppointmentStatus.CANCELLED_BY_CLINIC,
          AppointmentStatus.NO_SHOW,
          AppointmentStatus.RESCHEDULED,
          AppointmentStatus.BLOCKED
        ]
      }
    };
    const futureAppointmentsCount = await this.prisma.appointment.count({ where: futureAppointmentWhere });

    const movedFutureAppointmentsCount = await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: current.patientId },
        data: { branchId: dto.branchId }
      });

      await tx.treatmentPlan.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          professionalId: dto.professionalId,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name
        }
      });

      if (!dto.moveFutureAppointments || futureAppointmentsCount === 0) return 0;

      const result = await tx.appointment.updateMany({
        where: futureAppointmentWhere,
        data: {
          branchId: dto.branchId,
          professionalId: dto.professionalId,
          chairId: null,
          updatedById: actor.id
        }
      });
      return result.count;
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "change_branch",
      {
        patientId: current.patientId,
        branchId: current.branchId,
        professionalId: current.professionalId
      } as Prisma.InputJsonValue,
      {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        futureAppointmentsCount,
        movedFutureAppointmentsCount
      } as Prisma.InputJsonValue
    );

    return {
      ...(await this.getTreatmentPlan(actor, id)),
      futureAppointmentsCount,
      movedFutureAppointmentsCount
    };
  }

  async addSection(actor: AuthUser, treatmentPlanId: string, dto: TreatmentPlanSectionInputDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "add sections to");
    const nextSortOrder =
      dto.sortOrder ??
      ((
        await this.prisma.treatmentPlanSection.aggregate({
          where: { treatmentPlanId },
          _max: { sortOrder: true }
        })
      )._max.sortOrder ?? -1) + 1;

    const created = await this.prisma.treatmentPlanSection.create({
      data: {
        treatmentPlanId,
        name: dto.name.trim(),
        sortOrder: nextSortOrder
      }
    });

    await this.audit(
      actor,
      "TreatmentPlanSection",
      created.id,
      "create",
      {},
      created as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async createAlternative(actor: AuthUser, parentId: string, dto: CreateAlternativeDto) {
    const parent = await this.ensureTreatmentPlan(actor, parentId);
    this.ensureTreatmentPlanCanMutate(parent, "create alternatives for");
    const created = await this.createTreatmentPlan(actor, {
      ...dto,
      branchId: dto.branchId ?? parent.branchId,
      patientId: dto.patientId ?? parent.patientId,
      professionalId: dto.professionalId ?? parent.professionalId,
      isAlternative: true,
      parentTreatmentPlanId: parentId
    });
    return created;
  }

  async activateAlternative(actor: AuthUser, parentId: string, alternativeId: string) {
    const [parent, alternative, link] = await Promise.all([
      this.ensureTreatmentPlan(actor, parentId),
      this.ensureTreatmentPlan(actor, alternativeId),
      this.prisma.treatmentPlanAlternative.findUnique({
        where: {
          parentTreatmentPlanId_alternativeTreatmentPlanId: {
            parentTreatmentPlanId: parentId,
            alternativeTreatmentPlanId: alternativeId
          }
        }
      })
    ]);

    if (!link)
      throw new BadRequestException(
        "The selected plan is not registered as an alternative of the parent plan"
      );
    this.ensureTreatmentPlanCanMutate(parent, "activate alternatives for");
    this.ensureTreatmentPlanCanMutate(alternative, "activate");
    if (parent.patientId !== alternative.patientId)
      throw new BadRequestException("Alternative and parent plan must belong to the same patient");

    await this.prisma.$transaction(async (tx) => {
      await tx.treatmentPlan.update({
        where: { id: alternative.id },
        data: {
          isAlternative: false,
          parentTreatmentPlanId: null
        }
      });

      await tx.treatmentPlan.update({
        where: { id: parent.id },
        data: {
          isAlternative: true,
          parentTreatmentPlanId: alternative.id,
          status: TreatmentPlanStatus.REJECTED
        }
      });
    });

    await this.audit(
      actor,
      "TreatmentPlanAlternative",
      parentId,
      "activate_alternative",
      {
        parentId,
        alternativeId
      } as Prisma.InputJsonValue,
      {}
    );

    return this.getTreatmentPlan(actor, alternative.id);
  }

  async addItem(actor: AuthUser, treatmentPlanId: string, dto: UpdateTreatmentPlanItemDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "add items to");
    if (!dto.procedureId) throw new BadRequestException("procedureId is required");

    await this.validateProcedure(actor, dto.procedureId);
    if (dto.sectionId) await this.validateSection(treatmentPlanId, dto.sectionId);

    const agreement = plan.patient.agreement;
    const itemPayload = await this.resolveItemPayload(actor, plan.branchId, plan.patient, {
      ...dto,
      procedureId: dto.procedureId
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.treatmentPlanItem.create({
        data: this.buildItemData(treatmentPlanId, itemPayload, agreement),
        include: { procedure: true, section: true }
      });

      if (dto.syncOdontogram && item.toothNumber) {
        await this.syncTreatmentItemOdontogram(tx, plan, item, dto.notes?.trim());
      }

      return item;
    });

    await this.audit(actor, "TreatmentPlanItem", created.id, "create", {}, created as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, plan.id);
  }

  async getProcedures(actor: AuthUser, treatmentPlanId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        items: {
          include: {
            procedure: true,
            section: true,
            paymentAllocations: {
              include: { payment: { select: { id: true, status: true } } }
            },
            budgetItems: { include: { budget: { select: { id: true, status: true } } } }
          },
          orderBy: [{ section: { sortOrder: "asc" } }, { createdAt: "asc" }]
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");

    const activeItems = plan.items.filter((item) => item.status !== TreatmentPlanItemStatus.CANCELLED);
    const clinicalProgress = calculateTreatmentPlanClinicalProgress(activeItems);
    const sections = plan.sections.map((section) => ({
      id: section.id,
      name: section.name,
      description: null,
      position: section.sortOrder,
      procedures: activeItems
        .filter((item) => item.sectionId === section.id)
        .map((item) => this.mapProcedureListItem(plan, item))
    }));
    const unsectionedProcedures = activeItems
      .filter((item) => !item.sectionId)
      .map((item) => this.mapProcedureListItem(plan, item));

    return {
      planId: plan.id,
      summary: {
        sectionsCount: plan.sections.length,
        proceduresCount: activeItems.length,
        clinicalProgress,
        clinicalStatus: resolveTreatmentPlanClinicalStatus(plan.status, clinicalProgress),
        pendingCount: activeItems.filter(
          (item) => item.status === TreatmentPlanItemStatus.PLANNED || item.status === TreatmentPlanItemStatus.ACCEPTED
        ).length,
        inProgressCount: activeItems.filter((item) => item.status === TreatmentPlanItemStatus.IN_PROGRESS).length,
        completedCount: activeItems.filter((item) => item.status === TreatmentPlanItemStatus.COMPLETED).length,
        paidCount: activeItems.filter((item) => this.resolveProcedurePayment(item).status === "PAID").length,
        withDebtCount: activeItems.filter((item) => this.resolveProcedurePayment(item).balance.gt(0)).length
      },
      sections,
      unsectionedProcedures,
      capabilities: {
        canAddSection: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canAddProcedure: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canApplyBulkDiscount: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) && activeItems.length > 0
      }
    };
  }

  async applyBulkDiscount(actor: AuthUser, treatmentPlanId: string, dto: BulkDiscountTreatmentPlanItemsDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "apply discounts to");
    const itemIds = [...new Set(dto.itemIds.map((id) => id.trim()).filter(Boolean))];
    if (!itemIds.length) throw new BadRequestException("Select at least one procedure");
    if (dto.discountType === "PERCENTAGE" && dto.value > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100");
    }

    const updatedIds = await this.prisma.$transaction(async (tx) => {
      const items = await tx.treatmentPlanItem.findMany({
        where: { id: { in: itemIds }, treatmentPlanId },
        include: {
          paymentAllocations: { include: { payment: { select: { id: true, status: true } } } },
          budgetItems: { include: { budget: { include: { items: true } } } }
        }
      });
      if (items.length !== itemIds.length) throw new BadRequestException("One or more procedures do not belong to this plan");

      const touchedBudgetIds = new Set<string>();
      const budgetExtraDiscount = new Map<string, Prisma.Decimal>();

      for (const item of items) {
        if (item.status === TreatmentPlanItemStatus.CANCELLED) {
          throw new BadRequestException("Cancelled procedures cannot receive discounts");
        }
        const payment = item.paymentAllocations.reduce(
          (sum, allocation) =>
            allocation.payment?.status === PaymentStatus.VOIDED ? sum : sum.plus(allocation.amount),
          new Prisma.Decimal(0)
        );
        if (item.status === TreatmentPlanItemStatus.PAID || payment.gte(item.total)) {
          throw new BadRequestException("Paid procedures cannot receive discounts");
        }
        const nonDraftBudget = item.budgetItems.find((budgetItem) => budgetItem.budget.status !== BudgetStatus.DRAFT);
        if (nonDraftBudget) {
          throw new BadRequestException("Cannot update discounts for procedures in sent or accepted budgets");
        }

        for (const budgetItem of item.budgetItems) {
          touchedBudgetIds.add(budgetItem.budgetId);
          if (!budgetExtraDiscount.has(budgetItem.budgetId)) {
            const currentItemsDiscount = budgetItem.budget.items.reduce(
              (sum, row) => sum.plus(row.discount),
              new Prisma.Decimal(0)
            );
            const extra = new Prisma.Decimal(budgetItem.budget.discountTotal).minus(currentItemsDiscount);
            budgetExtraDiscount.set(budgetItem.budgetId, extra.gt(0) ? extra : new Prisma.Decimal(0));
          }
        }
      }

      for (const item of items) {
        const base = new Prisma.Decimal(item.quantity).mul(item.unitPrice);
        const discount =
          dto.discountType === "PERCENTAGE"
            ? base.mul(dto.value).div(100).toDecimalPlaces(2)
            : new Prisma.Decimal(dto.value).toDecimalPlaces(2);
        if (discount.gt(base)) throw new BadRequestException("Discount cannot exceed procedure subtotal");
        const total = base.minus(discount).toDecimalPlaces(2);

        await tx.treatmentPlanItem.update({
          where: { id: item.id },
          data: {
            discount,
            total,
            version: { increment: 1 }
          }
        });

        for (const budgetItem of item.budgetItems) {
          await tx.budgetItem.update({
            where: { id: budgetItem.id },
            data: {
              discount,
              total,
              version: { increment: 1 }
            }
          });
        }
      }

      for (const budgetId of touchedBudgetIds) {
        const budgetItems = await tx.budgetItem.findMany({ where: { budgetId } });
        const subtotal = budgetItems.reduce(
          (sum, item) => sum.plus(new Prisma.Decimal(item.quantity).mul(item.unitPrice)),
          new Prisma.Decimal(0)
        );
        const itemDiscount = budgetItems.reduce(
          (sum, item) => sum.plus(item.discount),
          new Prisma.Decimal(0)
        );
        const discountTotal = itemDiscount.plus(budgetExtraDiscount.get(budgetId) ?? 0).toDecimalPlaces(2);
        await tx.budget.update({
          where: { id: budgetId },
          data: {
            subtotal: subtotal.toDecimalPlaces(2),
            discountTotal,
            total: subtotal.minus(discountTotal).toDecimalPlaces(2)
          }
        });
      }

      return items.map((item) => item.id);
    });

    await this.audit(actor, "TreatmentPlanItem", null, "bulk_discount", {}, {
      treatmentPlanId,
      itemIds: updatedIds,
      discountType: dto.discountType,
      value: dto.value
    } as Prisma.InputJsonValue);
    return this.getProcedures(actor, treatmentPlanId);
  }

  async updateItem(
    actor: AuthUser,
    treatmentPlanId: string,
    itemId: string,
    dto: UpdateTreatmentPlanItemDto
  ) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "update items in");
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");

    if (
      current.status === TreatmentPlanItemStatus.PAID &&
      (dto.procedureId !== undefined ||
        dto.quantity !== undefined ||
        dto.unitPrice !== undefined ||
        dto.discount !== undefined ||
        dto.toothNumber !== undefined ||
        dto.surface !== undefined ||
        dto.odontogramSymbol !== undefined)
    ) {
      throw new BadRequestException("Paid procedures cannot be modified");
    }

    if (dto.procedureId) await this.validateProcedure(actor, dto.procedureId);
    if (dto.sectionId) await this.validateSection(treatmentPlanId, dto.sectionId);

    const quantity = dto.quantity ?? Number(current.quantity);
    let unitPrice = dto.unitPrice ?? Number(current.unitPrice);
    let priceSnapshot = this.snapshotFromCurrentItem(current);
    if (
      dto.procedureId !== undefined ||
      (dto.unitPrice !== undefined && !this.sameMoney(dto.unitPrice, Number(current.unitPrice)))
    ) {
      const resolvedPayload = await this.resolveItemPayload(actor, plan.branchId, plan.patient, {
        ...dto,
        procedureId: dto.procedureId ?? current.procedureId,
        quantity,
        unitPrice: dto.unitPrice,
        discount: dto.discount ?? Number(current.discount)
      });
      unitPrice = resolvedPayload.unitPrice;
      priceSnapshot = this.snapshotFromResolvedPayload(resolvedPayload);
    }

    let discount = dto.discount ?? Number(current.discount);
    let agreementCoverage = Number(current.agreementCoverage || 0);
    const agreement = plan.patient.agreement;

    if (dto.quantity !== undefined || dto.unitPrice !== undefined) {
      if (agreement && agreement.isActive && Number(agreement.discountPercent) > 0) {
        agreementCoverage = Number(
          (quantity * unitPrice * (Number(agreement.discountPercent) / 100)).toFixed(2)
        );
        discount = Number(agreementCoverage.toFixed(2));
      }
    }

    const total = this.computeTotal(quantity, unitPrice, discount);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.treatmentPlanItem.update({
        where: { id: current.id },
        data: {
          sectionId: dto.sectionId ?? current.sectionId,
          procedureId: dto.procedureId ?? current.procedureId,
          toothNumber: dto.toothNumber ?? current.toothNumber,
          surface: dto.surface ?? current.surface,
          odontogramSymbol:
            dto.odontogramSymbol === undefined ? current.odontogramSymbol : dto.odontogramSymbol.trim() || null,
          quantity: this.decimal(quantity),
          unitPrice: this.decimal(unitPrice),
          discount: this.decimal(discount),
          total: this.decimal(total),
          priceListId: priceSnapshot.priceListId,
          priceListItemId: priceSnapshot.priceListItemId,
          priceSource: priceSnapshot.priceSource,
          priceSnapshotName: priceSnapshot.priceSnapshotName,
          priceSnapshotCode: priceSnapshot.priceSnapshotCode,
          priceSnapshotCategory: priceSnapshot.priceSnapshotCategory,
          priceResolvedAt: priceSnapshot.priceResolvedAt,
          notes: dto.notes ?? current.notes,
          plannedAt:
            dto.plannedAt === undefined ? current.plannedAt : dto.plannedAt ? new Date(dto.plannedAt) : null,
          agreementId: agreement?.id || null,
          agreementCoverage: this.decimal(agreementCoverage)
        }
      });

      if (dto.syncOdontogram && row.toothNumber) {
        await this.syncTreatmentItemOdontogram(tx, plan, row, dto.notes?.trim());
      }

      return row;
    });

    if (
      quantity !== Number(current.quantity) ||
      unitPrice !== Number(current.unitPrice) ||
      discount !== Number(current.discount) ||
      total !== Number(current.total)
    ) {
      await this.audit(
        actor,
        "TreatmentPlanItem",
        itemId,
        "price_update",
        {
          quantity: current.quantity,
          unitPrice: current.unitPrice,
          discount: current.discount,
          total: current.total
        } as Prisma.InputJsonValue,
        {
          quantity: updated.quantity,
          unitPrice: updated.unitPrice,
          discount: updated.discount,
          total: updated.total
        } as Prisma.InputJsonValue
      );
    } else {
      await this.audit(
        actor,
        "TreatmentPlanItem",
        itemId,
        "update",
        current as Prisma.InputJsonValue,
        updated as Prisma.InputJsonValue
      );
    }

    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async updateItemStatus(
    actor: AuthUser,
    treatmentPlanId: string,
    itemId: string,
    dto: UpdateTreatmentPlanItemStatusDto
  ) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "update item statuses in");
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");
    if (dto.expectedVersion !== undefined && current.version !== dto.expectedVersion) {
      throw new BadRequestException("Treatment plan item was updated by another operation. Reload and try again.");
    }

    if (dto.status === TreatmentPlanItemStatus.PAID && plan.isAlternative) {
      throw new BadRequestException(
        "Alternative plans cannot receive paid items until they become the principal plan"
      );
    }

    const completionPercentage = this.resolveItemCompletionPercentage(dto.status, current.completionPercentage, dto.completionPercentage);
    const performedAmount = this.performedAmountForProgress(current.total, completionPercentage);
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.treatmentPlanItem.update({
        where: { id: itemId },
        data: {
          status: dto.status,
          completionPercentage,
          performedAmount,
          notes: dto.notes ?? current.notes,
          completedAt:
            dto.status === TreatmentPlanItemStatus.COMPLETED
              ? (current.completedAt ?? new Date())
              : completionPercentage < 100
                ? null
                : current.completedAt,
          ...(completionPercentage < 100 ? { completedByEvolutionId: null } : {}),
          version: { increment: 1 }
        }
      });
      await this.syncTreatmentPlanStatusFromItems(tx, treatmentPlanId);
      return updatedItem;
    });

    await this.syncTreatmentItemProcedureStatus(itemId, dto.status, completionPercentage);

    await this.audit(
      actor,
      "TreatmentPlanItem",
      itemId,
      "status_update",
      { status: current.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async deleteItem(actor: AuthUser, treatmentPlanId: string, itemId: string) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "delete items from");
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId },
      include: { budgetItems: { include: { budget: true } } }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");
    if (current.status === TreatmentPlanItemStatus.PAID) {
      throw new BadRequestException("Cannot remove paid procedures");
    }

    const nonDraftBudgets = current.budgetItems.filter((bi) => bi.budget.status !== BudgetStatus.DRAFT);
    if (nonDraftBudgets.length > 0) {
      throw new BadRequestException("Cannot remove item because it belongs to a sent or accepted budget");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const bi of current.budgetItems) {
        await tx.budgetItem.delete({ where: { id: bi.id } });

        const itemRawSubtotal = Number(bi.quantity) * Number(bi.unitPrice);
        const newSubtotal = Number(bi.budget.subtotal) - itemRawSubtotal;
        const newDiscountTotal = Number(bi.budget.discountTotal) - Number(bi.discount);
        const newTotal = Number(bi.budget.total) - Number(bi.total);

        await tx.budget.update({
          where: { id: bi.budgetId },
          data: {
            subtotal: this.decimal(Math.max(0, newSubtotal)),
            discountTotal: this.decimal(Math.max(0, newDiscountTotal)),
            total: this.decimal(Math.max(0, newTotal))
          }
        });
      }

      await tx.treatmentPlanItem.delete({ where: { id: itemId } });
      await this.syncTreatmentPlanStatusFromItems(tx, treatmentPlanId);
    });

    const auditData = { ...current };
    delete (auditData as any).budgetItems;
    await this.audit(actor, "TreatmentPlanItem", itemId, "delete", auditData as Prisma.InputJsonValue, {});
    return { success: true };
  }

  async createBudget(actor: AuthUser, treatmentPlanId: string, dto: CreateBudgetDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "create budgets for");
    const items = await this.prisma.treatmentPlanItem.findMany({
      where: { treatmentPlanId, status: { not: TreatmentPlanItemStatus.CANCELLED } },
      include: { procedure: true }
    });
    if (!items.length)
      throw new BadRequestException("Treatment plan requires at least one active item to generate a budget");

    let rawSubtotal = 0;
    let itemsDiscount = 0;

    for (const item of items) {
      rawSubtotal += Number(item.quantity) * Number(item.unitPrice);
      itemsDiscount += Number(item.discount);
    }

    const budgetDiscountTotal = dto.discountTotal ?? 0;
    const totalDiscount = itemsDiscount + budgetDiscountTotal;

    if (totalDiscount > rawSubtotal)
      throw new BadRequestException("total discount cannot be greater than subtotal");
    const total = rawSubtotal - totalDiscount;

    const budget = await this.prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          treatmentPlanId: plan.id,
          patientId: plan.patientId,
          professionalId: plan.professionalId,
          organizationId: actor.organizationId,
          subtotal: this.decimal(rawSubtotal),
          discountTotal: this.decimal(totalDiscount),
          total: this.decimal(total),
          status: BudgetStatus.DRAFT,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          notes: dto.notes?.trim()
        }
      });

      for (const item of items) {
        await tx.budgetItem.create({
          data: {
            budgetId: created.id,
            treatmentPlanItemId: item.id,
            description: `${item.procedure.code} - ${item.procedure.name}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total
          }
        });
      }

      return created;
    });

    await this.audit(actor, "Budget", budget.id, "create", {}, budget as Prisma.InputJsonValue);
    return this.getBudget(actor, budget.id);
  }

  async listBudgets(actor: AuthUser, query: ListBudgetsQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.budget.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.treatmentPlanId ? { treatmentPlanId: query.treatmentPlanId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        treatmentPlan: { select: { id: true, name: true, status: true, isAlternative: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: true
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async getBudget(actor: AuthUser, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        treatmentPlan: {
          select: {
            id: true,
            name: true,
            status: true,
            isAlternative: true,
            patientId: true
          }
        },
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            treatmentPlanItem: {
              include: {
                procedure: { select: { code: true, name: true } }
              }
            }
          }
        }
      }
    });
    if (!budget) throw new NotFoundException("Budget not found");
    return budget;
  }

  async sendBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    this.ensureTreatmentPlanCanMutate(current.treatmentPlan, "send budgets for");
    if (current.status !== BudgetStatus.DRAFT)
      throw new BadRequestException("Only DRAFT budgets can be sent");
    const updated = await this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.SENT, sentAt: new Date() }
    });
    await this.audit(
      actor,
      "Budget",
      id,
      "send",
      { status: current.status } as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async acceptBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    this.ensureTreatmentPlanCanMutate(current.treatmentPlan, "accept budgets for");
    if (current.treatmentPlan.isAlternative) {
      throw new BadRequestException(
        "Alternative treatment plans cannot be accepted for payments until converted to principal"
      );
    }
    const acceptStatuses: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.SENT];
    if (!acceptStatuses.includes(current.status)) {
      throw new BadRequestException("Only DRAFT or SENT budgets can be accepted");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });
      await tx.treatmentPlan.update({
        where: { id: current.treatmentPlan.id },
        data: {
          status: TreatmentPlanStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });
    });

    await this.audit(
      actor,
      "Budget",
      id,
      "accept",
      { status: current.status } as Prisma.InputJsonValue,
      { status: BudgetStatus.ACCEPTED } as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async rejectBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    const rejectStatuses: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.SENT];
    if (!rejectStatuses.includes(current.status)) {
      throw new BadRequestException("Only DRAFT or SENT budgets can be rejected");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.REJECTED,
          rejectedAt: new Date()
        }
      });
      if (current.treatmentPlan.status === TreatmentPlanStatus.PRESENTED) {
        await tx.treatmentPlan.update({
          where: { id: current.treatmentPlan.id },
          data: { status: TreatmentPlanStatus.REJECTED }
        });
      }
    });

    await this.audit(
      actor,
      "Budget",
      id,
      "reject",
      { status: current.status } as Prisma.InputJsonValue,
      { status: BudgetStatus.REJECTED } as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async printBudget(actor: AuthUser, id: string) {
    const budget = await this.getBudget(actor, id);
    const lines = budget.items.map((item) => {
      const label = `${item.treatmentPlanItem.procedure.code} ${item.treatmentPlanItem.procedure.name}`;
      return `- ${label} x${item.quantity} = ${item.total}`;
    });

    return {
      ...budget,
      printableText: [
        `Presupuesto: ${budget.id}`,
        `Paciente: ${budget.patient.firstName} ${budget.patient.lastName}`,
        `Plan: ${budget.treatmentPlan.name}`,
        `Estado: ${budget.status}`,
        ...lines,
        `Subtotal: ${budget.subtotal}`,
        `Descuento: ${budget.discountTotal}`,
        `Total: ${budget.total}`
      ].join("\n")
    };
  }

  async printTreatmentPlanDocument(actor: AuthUser, id: string, dto: PrintTreatmentPlanDocumentDto) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        organization: { select: { name: true, address: true, phone: true } },
        branch: {
          select: {
            name: true,
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
    if (!plan.items.length) {
      throw new BadRequestException("Treatment plan requires at least one active item to print documents");
    }
    if (dto.budgetId && !plan.budgets.length) throw new NotFoundException("Budget not found");

    const input = this.buildTreatmentPlanDocumentInput(plan, dto);
    return buildTreatmentPlanDocumentPdf(input);
  }

  private buildTreatmentPlanDocumentInput(plan: any, dto: PrintTreatmentPlanDocumentDto): TreatmentPlanDocumentInput {
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
        specialty: plan.specialtySnapshotName || plan.specialty?.name || plan.professional.specialties?.[0]?.specialty?.name || "General",
        licenseNumber: plan.professional.licenseNumber || "-"
      },
      branchName: plan.branch.name,
      agreementName: plan.patient.agreement?.name || "Sin convenio",
      items,
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
      totals: {
        subtotal,
        discount,
        total,
        paid,
        balance: Math.max(total - paid, 0)
      }
    };
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

  private mapProcedureListItem(
    plan: { professional: { id: string; firstName: string; lastName: string }; status: TreatmentPlanStatus },
    item: any
  ) {
    const payment = this.resolveProcedurePayment(item);
    const basePrice = new Prisma.Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2);
    const completionPercentage = this.resolveItemCompletionPercentage(
      item.status,
      item.completionPercentage,
      item.completionPercentage
    );

    return {
      id: item.id,
      code: item.procedure?.code ?? "",
      name: item.procedure?.name ?? "",
      description: item.procedure?.description ?? null,
      priceListName: item.priceSnapshotName,
      sectionId: item.sectionId,
      sectionName: item.section?.name ?? null,
      professional: {
        id: plan.professional.id,
        name: `${plan.professional.firstName} ${plan.professional.lastName}`.trim()
      },
      dentalScope: {
        type: item.toothNumber ? (item.surface && item.surface !== "ALL" ? "SURFACES" : "WHOLE_TOOTH") : "GENERAL",
        toothNumber: item.toothNumber,
        surfaces: item.surface && item.surface !== "ALL" ? item.surface.split(",").map((surface: string) => surface.trim()) : []
      },
      discount: {
        type: "AMOUNT",
        value: item.discount.toString(),
        amount: item.discount.toString()
      },
      pricing: {
        basePrice: basePrice.toString(),
        finalPrice: item.total.toString(),
        currency: "MXN"
      },
      payment: {
        paidAmount: payment.paidAmount.toString(),
        balance: payment.balance.toString(),
        status: payment.status
      },
      progress: {
        percentage: completionPercentage,
        status: item.status,
        lastEvolutionAt: item.completedAt,
        performedBy: null
      },
      future: {
        isFuture: Boolean(item.plannedAt),
        scheduledAt: item.plannedAt
      },
      status: item.status,
      capabilities: {
        canEdit: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) && payment.paidAmount.lt(item.total),
        canEvolve: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) && item.status !== TreatmentPlanItemStatus.COMPLETED,
        canUnperform: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) && item.status !== TreatmentPlanItemStatus.PLANNED,
        canCollect: payment.balance.gt(0),
        canDelete:
          !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status) &&
          payment.paidAmount.eq(0) &&
          !item.budgetItems?.some((budgetItem: any) => budgetItem.budget?.status !== BudgetStatus.DRAFT)
      }
    };
  }

  private resolveProcedurePayment(item: {
    total: Prisma.Decimal;
    paymentAllocations?: Array<{ amount: Prisma.Decimal; payment?: { status?: PaymentStatus } | null }>;
  }) {
    const paidAmount = (item.paymentAllocations ?? []).reduce((sum, allocation) => {
      if (allocation.payment?.status === PaymentStatus.VOIDED) return sum;
      return sum.plus(allocation.amount);
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

  private buildItemData(
    treatmentPlanId: string,
    dto: TreatmentPlanItemBuildInput,
    agreement: TreatmentAgreementSnapshot = null
  ): Prisma.TreatmentPlanItemUncheckedCreateInput {
    let finalDiscount = dto.discount;
    let agreementCoverage = 0;
    if (agreement && agreement.isActive && Number(agreement.discountPercent) > 0) {
      agreementCoverage = Number(
        (dto.quantity * dto.unitPrice * (Number(agreement.discountPercent) / 100)).toFixed(2)
      );
      finalDiscount = finalDiscount + agreementCoverage;
    }
    const total = this.computeTotal(dto.quantity, dto.unitPrice, finalDiscount);
    return {
      treatmentPlanId,
      sectionId: dto.sectionId,
      procedureId: dto.procedureId,
      toothNumber: dto.toothNumber?.trim(),
      surface: dto.surface?.trim().toUpperCase(),
      odontogramSymbol: dto.odontogramSymbol?.trim() || null,
      quantity: this.decimal(dto.quantity),
      unitPrice: this.decimal(dto.unitPrice),
      discount: this.decimal(finalDiscount),
      total: this.decimal(total),
      status: TreatmentPlanItemStatus.PLANNED,
      priceListId: dto.priceListId,
      priceListItemId: dto.priceListItemId,
      priceSource: dto.priceSource,
      priceSnapshotName: dto.priceSnapshotName,
      priceSnapshotCode: dto.priceSnapshotCode,
      priceSnapshotCategory: dto.priceSnapshotCategory,
      priceResolvedAt: dto.priceResolvedAt,
      notes: dto.notes?.trim(),
      plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : null,
      agreementId: agreement?.id || null,
      agreementCoverage: this.decimal(agreementCoverage)
    };
  }

  private computeTotal(quantity: number, unitPrice: number, discount: number) {
    if (quantity <= 0) throw new BadRequestException("quantity must be greater than 0");
    if (unitPrice < 0) throw new BadRequestException("unitPrice cannot be negative");
    if (discount < 0) throw new BadRequestException("discount cannot be negative");
    const total = Number((quantity * unitPrice - discount).toFixed(2));
    if (total < 0) throw new BadRequestException("discount cannot exceed quantity * unitPrice");
    return total;
  }

  private decimal(value: number) {
    return new Prisma.Decimal(value);
  }

  private performedAmountForProgress(total: Prisma.Decimal | number | string, percentage: number) {
    return new Prisma.Decimal(total).mul(percentage).div(100).toDecimalPlaces(2);
  }

  private resolveItemCompletionPercentage(
    status: TreatmentPlanItemStatus,
    currentPercentage: number,
    requestedPercentage?: number
  ) {
    if (requestedPercentage !== undefined) {
      if (![0, 25, 50, 75, 100].includes(requestedPercentage)) {
        throw new BadRequestException("completionPercentage must be one of 0, 25, 50, 75 or 100");
      }
      return requestedPercentage;
    }
    if (status === TreatmentPlanItemStatus.COMPLETED) return 100;
    if (status === TreatmentPlanItemStatus.IN_PROGRESS) return currentPercentage > 0 ? currentPercentage : 25;
    if (status === TreatmentPlanItemStatus.PLANNED || status === TreatmentPlanItemStatus.ACCEPTED) return 0;
    return currentPercentage;
  }

  private async resolveItemPayload(
    actor: AuthUser,
    branchId: string,
    patient: TreatmentPatientForPricing,
    dto: UpdateTreatmentPlanItemDto & { procedureId: string }
  ): Promise<TreatmentPlanItemBuildInput> {
    const quantity = dto.quantity ?? 1;
    const discount = dto.discount ?? 0;
    const resolved = await this.resolveProcedurePriceSnapshot(actor, branchId, patient, dto.procedureId);
    let unitPrice = resolved.unitPrice;
    let priceSource = resolved.priceSource;

    if (dto.unitPrice !== undefined) {
      if (this.sameMoney(dto.unitPrice, resolved.unitPrice)) {
        unitPrice = dto.unitPrice;
      } else {
        if (!this.canOverrideManualPrices(actor)) {
          throw new BadRequestException(
            "Manual price overrides require price_lists.override_manual permission"
          );
        }
        unitPrice = dto.unitPrice;
        priceSource = TreatmentPriceSource.MANUAL;
      }
    }

    return {
      ...dto,
      procedureId: dto.procedureId,
      quantity,
      unitPrice,
      discount,
      priceListId: resolved.priceListId,
      priceListItemId: resolved.priceListItemId,
      priceSource,
      priceSnapshotName: resolved.priceSnapshotName,
      priceSnapshotCode: resolved.priceSnapshotCode,
      priceSnapshotCategory: resolved.priceSnapshotCategory,
      priceResolvedAt: resolved.priceResolvedAt
    };
  }

  private async resolveProcedurePriceSnapshot(
    actor: AuthUser,
    branchId: string,
    patient: TreatmentPatientForPricing,
    procedureId: string
  ): Promise<ProcedurePriceSnapshot> {
    const preferredPriceListId = patient.agreement?.priceListId;
    const hasBranchScopedLists = await this.prisma.branchPriceList.count({
      where: {
        organizationId: actor.organizationId,
        branchId,
        isActive: true,
        priceList: { isActive: true }
      }
    });

    if (preferredPriceListId) {
      const agreementPrice = await this.findPriceListItemSnapshot({
        procedureId,
        priceListId: preferredPriceListId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          ...(hasBranchScopedLists
            ? {
                branchAssignments: {
                  some: { branchId, isActive: true }
                }
              }
            : {})
        }
      });
      if (agreementPrice) return agreementPrice;
    }

    if (hasBranchScopedLists) {
      const branchDefaultPrice = await this.findPriceListItemSnapshot({
        procedureId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          branchAssignments: {
            some: { branchId, isActive: true, isDefault: true }
          }
        }
      });
      if (branchDefaultPrice) return branchDefaultPrice;

      const branchPrice = await this.findPriceListItemSnapshot({
        procedureId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          branchAssignments: {
            some: { branchId, isActive: true }
          }
        }
      });
      if (branchPrice) return branchPrice;
    }

    const defaultPrice = await this.findPriceListItemSnapshot({
      procedureId,
      priceList: {
        organizationId: actor.organizationId,
        isActive: true,
        isDefault: true
      }
    });
    if (defaultPrice) return defaultPrice;

    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true },
      include: { category: true }
    });
    if (!procedure) throw new BadRequestException("Invalid procedureId");

    return {
      unitPrice: 0,
      priceListId: null,
      priceListItemId: null,
      priceSource: TreatmentPriceSource.UNPRICED,
      priceSnapshotName: null,
      priceSnapshotCode: procedure.code,
      priceSnapshotCategory: procedure.category?.name ?? null,
      priceResolvedAt: new Date()
    };
  }

  private async findPriceListItemSnapshot(where: Prisma.PriceListItemWhereInput) {
    const row = await this.prisma.priceListItem.findFirst({
      where,
      include: {
        priceList: { select: { id: true, name: true } },
        priceListCategory: { select: { name: true } },
        procedure: { select: { code: true, name: true, category: { select: { name: true } } } }
      }
    });
    if (!row) return null;

    return {
      unitPrice: Number(row.price),
      priceListId: row.priceListId,
      priceListItemId: row.id,
      priceSource: TreatmentPriceSource.PRICE_LIST,
      priceSnapshotName: row.priceList.name,
      priceSnapshotCode: row.procedure.code,
      priceSnapshotCategory: row.priceListCategory?.name ?? row.procedure.category.name,
      priceResolvedAt: new Date()
    };
  }

  private snapshotFromCurrentItem(item: {
    priceListId?: string | null;
    priceListItemId?: string | null;
    priceSource?: TreatmentPriceSource | null;
    priceSnapshotName?: string | null;
    priceSnapshotCode?: string | null;
    priceSnapshotCategory?: string | null;
    priceResolvedAt?: Date | null;
  }): ProcedurePriceSnapshot {
    return {
      unitPrice: 0,
      priceListId: item.priceListId ?? null,
      priceListItemId: item.priceListItemId ?? null,
      priceSource: item.priceSource ?? TreatmentPriceSource.MANUAL,
      priceSnapshotName: item.priceSnapshotName ?? null,
      priceSnapshotCode: item.priceSnapshotCode ?? null,
      priceSnapshotCategory: item.priceSnapshotCategory ?? null,
      priceResolvedAt: item.priceResolvedAt ?? null
    };
  }

  private snapshotFromResolvedPayload(payload: ProcedurePriceSnapshot): ProcedurePriceSnapshot {
    return {
      unitPrice: payload.unitPrice,
      priceListId: payload.priceListId,
      priceListItemId: payload.priceListItemId,
      priceSource: payload.priceSource,
      priceSnapshotName: payload.priceSnapshotName,
      priceSnapshotCode: payload.priceSnapshotCode,
      priceSnapshotCategory: payload.priceSnapshotCategory,
      priceResolvedAt: payload.priceResolvedAt
    };
  }

  private canOverrideManualPrices(actor: AuthUser) {
    return (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("price_lists.override_manual")
    );
  }

  private sameMoney(left: number, right: number) {
    return this.roundMoney(left) === this.roundMoney(right);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
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
    const parts = [
      ...new Set(
        surface
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      )
    ];
    if (!parts.length || parts.some((part) => !allowedSingle.has(part)))
      throw new BadRequestException("Invalid tooth surface");
    parts.sort((left, right) => preferredOrder.indexOf(left) - preferredOrder.indexOf(right));
    return parts.join(",");
  }

  private mapItemStatusToToothProcedureStatus(status: TreatmentPlanItemStatus) {
    if (status === TreatmentPlanItemStatus.IN_PROGRESS) return ToothProcedureStatus.IN_PROGRESS;
    if (status === TreatmentPlanItemStatus.COMPLETED) return ToothProcedureStatus.COMPLETED;
    if (status === TreatmentPlanItemStatus.CANCELLED) return ToothProcedureStatus.CANCELLED;
    if (status === TreatmentPlanItemStatus.ACCEPTED || status === TreatmentPlanItemStatus.PAID)
      return ToothProcedureStatus.ACCEPTED;
    return ToothProcedureStatus.PLANNED;
  }

  private mapItemProgressToToothProcedureStatus(status: TreatmentPlanItemStatus, completionPercentage?: number) {
    if (status === TreatmentPlanItemStatus.CANCELLED) return ToothProcedureStatus.CANCELLED;
    if (completionPercentage === 100 || status === TreatmentPlanItemStatus.COMPLETED) return ToothProcedureStatus.COMPLETED;
    if ((completionPercentage ?? 0) > 0 || status === TreatmentPlanItemStatus.IN_PROGRESS) return ToothProcedureStatus.IN_PROGRESS;
    return this.mapItemStatusToToothProcedureStatus(status);
  }

  private async syncTreatmentItemOdontogram(
    tx: Prisma.TransactionClient,
    plan: { id: string; patientId: string; professionalId: string },
    item: {
      id: string;
      procedureId: string;
      toothNumber: string | null;
      surface: string | null;
      odontogramSymbol: string | null;
      status: TreatmentPlanItemStatus;
      notes: string | null;
    },
    notes?: string
  ) {
    if (!item.toothNumber) return;

    const toothNumber = this.normalizeToothNumber(item.toothNumber);
    const surface = this.normalizeSurface(item.surface ?? undefined);
    const status = this.mapItemStatusToToothProcedureStatus(item.status);
    const odontogramSymbol = item.odontogramSymbol?.trim() || null;
    const diagnosis = odontogramSymbol ?? notes ?? item.notes?.trim() ?? null;
    const current = await tx.toothProcedure.findUnique({
      where: { treatmentPlanItemId: item.id },
      include: { odontogramRecord: true }
    });

    const recordPayload = {
      patientId: plan.patientId,
      professionalId: plan.professionalId,
      toothNumber,
      surface,
      condition: "TOOTH_PROCEDURE",
      diagnosis,
      odontogramSymbol,
      procedureId: item.procedureId,
      status,
      notes: diagnosis
    };

    if (current) {
      if (current.odontogramRecordId) {
        await tx.odontogramRecord.update({
          where: { id: current.odontogramRecordId },
          data: recordPayload
        });
      } else {
        const record = await tx.odontogramRecord.create({ data: recordPayload });
        await tx.toothProcedure.update({
          where: { id: current.id },
          data: { odontogramRecordId: record.id }
        });
      }

      await tx.toothProcedure.update({
        where: { id: current.id },
        data: {
          patientId: plan.patientId,
          professionalId: plan.professionalId,
          procedureId: item.procedureId,
          treatmentPlanId: plan.id,
          treatmentPlanItemId: item.id,
          toothNumber,
          surface,
          diagnosis,
          odontogramSymbol,
          status,
          notes: diagnosis,
          completedAt: status === ToothProcedureStatus.COMPLETED ? (current.completedAt ?? new Date()) : null
        }
      });
      return;
    }

    const record = await tx.odontogramRecord.create({ data: recordPayload });
    await tx.toothProcedure.create({
      data: {
        patientId: plan.patientId,
        professionalId: plan.professionalId,
        procedureId: item.procedureId,
        treatmentPlanId: plan.id,
        treatmentPlanItemId: item.id,
        odontogramRecordId: record.id,
        toothNumber,
        surface,
        diagnosis,
        odontogramSymbol,
        status,
        notes: diagnosis,
        completedAt: status === ToothProcedureStatus.COMPLETED ? new Date() : null
      }
    });
  }

  private async syncTreatmentItemProcedureStatus(
    itemId: string,
    itemStatus: TreatmentPlanItemStatus,
    completionPercentage?: number
  ) {
    const status = this.mapItemProgressToToothProcedureStatus(itemStatus, completionPercentage);
    const current = await this.prisma.toothProcedure.findUnique({
      where: { treatmentPlanItemId: itemId },
      select: { id: true, odontogramRecordId: true, completedAt: true }
    });
    if (!current) return;

    const completedAt =
      status === ToothProcedureStatus.COMPLETED ? (current.completedAt ?? new Date()) : null;
    await this.prisma.$transaction(async (tx) => {
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
    });
  }

  private ensureTreatmentPlanCanMutate(plan: { status: TreatmentPlanStatus }, action = "modify") {
    if (CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status)) {
      throw new BadRequestException(`Cannot ${action} a cancelled or rejected treatment plan`);
    }
  }

  private canViewPrivateEvolutions(actor: AuthUser) {
    return (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("orthodontics.private_evolutions.view")
    );
  }

  private orthodonticEvolutionInclude() {
    return {
      fields: { orderBy: { sortOrder: "asc" as const } },
      materials: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } }
      },
      professional: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } }
    };
  }

  private mapOrthodonticSummary(plan: any, canViewPrivate: boolean) {
    const profile = plan.orthodonticProfile;
    const evolutions = plan.clinicalEvolutions ?? [];
    const now = new Date();
    const calendar = this.resolveOrthodonticCalendar(plan, now);
    const hygieneSeries = evolutions
      .map((evolution: any) => {
        const score = this.fieldInt(evolution, "higiene");
        if (!score || score < 1 || score > 7) return null;
        return {
          evolutionId: evolution.id,
          date: evolution.createdAt,
          score,
          professionalName: this.professionalName(evolution.professional),
          comment: this.plainEvolutionComment(evolution)
        };
      })
      .filter(Boolean)
      .reverse();
    const hygieneScores = hygieneSeries.map((item: any) => item.score);
    const latestHygiene = hygieneSeries[hygieneSeries.length - 1] ?? null;
    const latestEvolution = evolutions[0] ? this.mapOrthodonticEvolution(evolutions[0]) : null;
    const completedControls = evolutions.length;
    const plannedControls = profile?.estimatedControls ?? profile?.estimatedMonths ?? 0;
    const realPercentage = plannedControls ? Math.min(100, (completedControls / plannedControls) * 100) : 0;

    return {
      plan: {
        id: plan.id,
        patientId: plan.patientId,
        name: plan.name,
        status: calendar.status,
        rawStatus: plan.status,
        startedAt: profile?.startDate ?? null,
        completedAt: plan.completedAt,
        plannedDurationMonths: profile?.estimatedMonths ?? null,
        professional: {
          id: plan.professional.id,
          name: this.professionalName(plan.professional)
        },
        branch: plan.branch
      },
      calendarProgress: calendar,
      realProgress: {
        percentage: realPercentage,
        completedControls,
        plannedControls,
        status: this.resolveRealProgressStatus(realPercentage, calendar.percentage, plannedControls),
        label: this.resolveRealProgressLabel(realPercentage, calendar.percentage, plannedControls),
        calculationMethod: plannedControls ? "COMPLETED_CONTROLS" : "INSUFFICIENT_PLANNING"
      },
      planning: {
        plannedMonths: profile?.estimatedMonths ?? null,
        plannedControls: plannedControls || null,
        completedControls
      },
      currentClinicalState: this.resolveLatestOrthodonticClinicalState(evolutions),
      hygiene: {
        latestScore: latestHygiene?.score ?? null,
        maximumScore: 7,
        latestRecordedAt: latestHygiene?.date ?? null,
        average: hygieneScores.length
          ? Number((hygieneScores.reduce((sum: number, score: number) => sum + score, 0) / hygieneScores.length).toFixed(2))
          : null,
        trend: this.resolveHygieneTrend(hygieneScores),
        series: hygieneSeries
      },
      latestEvolution,
      recentEvolutions: evolutions.slice(0, 5).map((evolution: any) => this.mapOrthodonticEvolution(evolution)),
      capabilities: {
        canStart: !profile?.startDate && !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canPause: Boolean(profile?.startDate) && calendar.status === "ACTIVE",
        canResume: calendar.status === "PAUSED",
        canComplete: Boolean(profile?.startDate) && !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canEdit: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canCreateEvolution: !CLOSED_TREATMENT_PLAN_STATUSES.has(plan.status),
        canViewPrivateEvolutions: canViewPrivate
      }
    };
  }

  private resolveOrthodonticCalendar(plan: any, now: Date) {
    const profile = plan.orthodonticProfile;
    const startDate = profile?.startDate ?? null;
    const activePause = (plan.pauses ?? []).find((pause: any) => !pause.endDate);
    const estimatedMonths = profile?.estimatedMonths ?? null;

    if (!startDate) {
      return {
        percentage: 0,
        status: "NOT_STARTED",
        label: "Sin iniciar",
        startedAt: null,
        estimatedEndAt: null,
        activeDays: 0,
        pausedDays: 0,
        pauseStartDate: null
      };
    }

    let pausedDays = 0;
    for (const pause of plan.pauses ?? []) {
      const pauseEnd = pause.endDate ?? now;
      pausedDays += Math.max(0, Math.floor((pauseEnd.getTime() - pause.startDate.getTime()) / 86400000));
    }
    const activeDays = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000) - pausedDays);
    const totalPlannedDays = estimatedMonths ? estimatedMonths * 30.436875 : 0;
    const percentage = totalPlannedDays ? Math.min(100, (activeDays / totalPlannedDays) * 100) : 0;
    const estimatedEndAt = estimatedMonths ? new Date(startDate) : null;
    if (estimatedEndAt) estimatedEndAt.setMonth(estimatedEndAt.getMonth() + estimatedMonths);

    return {
      percentage,
      status:
        plan.status === TreatmentPlanStatus.COMPLETED
          ? "COMPLETED"
          : activePause
            ? "PAUSED"
            : "ACTIVE",
      label: activePause ? "Calendario detenido" : "Calendario corriendo",
      startedAt: startDate,
      estimatedEndAt,
      activeDays,
      pausedDays,
      pauseStartDate: activePause?.startDate ?? null
    };
  }

  private resolveLatestOrthodonticClinicalState(evolutions: any[]) {
    const source = (label: string) => this.latestFieldSource(evolutions, label);
    return {
      upperArchMaterial: source("arco superior material"),
      upperArchSize: source("arco superior tamano"),
      lowerArchMaterial: source("arco inferior material"),
      lowerArchSize: source("arco inferior tamano"),
      upperAligner: source("alineador superior"),
      lowerAligner: source("alineador inferior"),
      elasticType: source("tipo de elasticos"),
      elasticConfiguration: source("configuracion elasticos"),
      nextControl: source("proximo control"),
      alert: source("alerta"),
      nextSessionInstructions: source("indicaciones proxima sesion"),
      radiographicControl: source("control radiografico"),
      intraoralPhotos: source("fotografias intraorales"),
      extraoralPhotos: source("fotografias extraorales")
    };
  }

  private latestFieldSource(evolutions: any[], label: string) {
    for (const evolution of evolutions) {
      const field = this.findEvolutionField(evolution, label);
      if (field?.value?.trim()) {
        return {
          value: field.value,
          recordedAt: evolution.createdAt,
          evolutionId: evolution.id,
          professionalName: this.professionalName(evolution.professional)
        };
      }
    }
    return null;
  }

  private mapOrthodonticEvolution(evolution: any) {
    return {
      id: evolution.id,
      recordedAt: evolution.createdAt,
      professional: {
        id: evolution.professional?.id,
        name: this.professionalName(evolution.professional)
      },
      comment: this.plainEvolutionComment(evolution),
      isPrivate: evolution.isPrivate,
      orthodonticControl: {
        radiographicControl: this.fieldBoolean(evolution, "control radiografico"),
        intraoralPhotos: this.fieldBoolean(evolution, "fotografias intraorales"),
        extraoralPhotos: this.fieldBoolean(evolution, "fotografias extraorales"),
        upperArchMaterial: this.fieldValue(evolution, "arco superior material"),
        upperArchSize: this.fieldValue(evolution, "arco superior tamano"),
        lowerArchMaterial: this.fieldValue(evolution, "arco inferior material"),
        lowerArchSize: this.fieldValue(evolution, "arco inferior tamano"),
        upperAligner: this.fieldValue(evolution, "alineador superior"),
        lowerAligner: this.fieldValue(evolution, "alineador inferior"),
        elasticType: this.fieldValue(evolution, "tipo de elasticos"),
        elasticConfiguration: this.fieldValue(evolution, "configuracion elasticos"),
        nextControl: this.fieldValue(evolution, "proximo control"),
        alert: this.fieldValue(evolution, "alerta"),
        nextSessionInstructions: this.fieldValue(evolution, "indicaciones proxima sesion"),
        hygieneScore: this.fieldInt(evolution, "higiene")
      },
      materials: (evolution.materials ?? []).map((material: any) => ({
        productId: material.inventoryItemId,
        name: material.nameSnapshot || material.inventoryItem?.name || "Material clinico",
        quantity: Number(material.quantity),
        unit: material.unitSnapshot || material.inventoryItem?.unit || null
      })),
      createdBy: evolution.createdBy
        ? { id: evolution.createdBy.id, name: this.userName(evolution.createdBy) }
        : null
    };
  }

  private findEvolutionField(evolution: any, label: string) {
    const target = this.normalizeClinicalFieldLabel(label);
    return (evolution.fields ?? []).find((field: any) => this.normalizeClinicalFieldLabel(field.label).includes(target));
  }

  private fieldValue(evolution: any, label: string) {
    return this.findEvolutionField(evolution, label)?.value || null;
  }

  private fieldBoolean(evolution: any, label: string) {
    const value = this.fieldValue(evolution, label);
    if (!value) return false;
    return ["si", "sí", "true", "1"].includes(this.normalizeClinicalFieldLabel(value));
  }

  private fieldInt(evolution: any, label: string) {
    const value = this.fieldValue(evolution, label);
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private resolveHygieneTrend(scores: number[]) {
    if (scores.length < 2) return "INSUFFICIENT_DATA";
    const first = scores[0];
    const last = scores[scores.length - 1];
    if (last > first) return "IMPROVING";
    if (last < first) return "DECLINING";
    return "STABLE";
  }

  private resolveRealProgressStatus(realProgress: number, calendarProgress: number, plannedControls: number) {
    if (!plannedControls) return "INSUFFICIENT_PLANNING";
    if (realProgress === 0) return "NO_ACTIVITY";
    if (realProgress > calendarProgress + 15) return "AHEAD";
    if (realProgress < calendarProgress - 15) return "DELAYED";
    return "ON_TRACK";
  }

  private resolveRealProgressLabel(realProgress: number, calendarProgress: number, plannedControls: number) {
    const status = this.resolveRealProgressStatus(realProgress, calendarProgress, plannedControls);
    if (status === "INSUFFICIENT_PLANNING") return "Sin planificacion suficiente";
    if (status === "NO_ACTIVITY") return "Sin actividad";
    if (status === "AHEAD") return "Adelantado";
    if (status === "DELAYED") return "Atrasado";
    return "Evolucion al dia";
  }

  private plainEvolutionComment(evolution: any) {
    return [evolution.notes, evolution.assessment, evolution.objective, evolution.plan, evolution.subjective]
      .filter(Boolean)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  private professionalName(professional?: { firstName?: string | null; lastName?: string | null } | null) {
    return [professional?.firstName, professional?.lastName].filter(Boolean).join(" ") || "Sin profesional";
  }

  private userName(user?: { firstName?: string | null; lastName?: string | null } | null) {
    return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Usuario";
  }

  private normalizeClinicalFieldLabel(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .toLowerCase()
      .trim();
  }

  private async ensureTreatmentPlan(actor: AuthUser, treatmentPlanId: string) {
    const row = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: {
          include: { agreement: true }
        }
      }
    });
    if (!row) throw new NotFoundException("Treatment plan not found");
    return row;
  }

  private async ensureOrthodonticTreatmentPlan(actor: AuthUser, treatmentPlanId: string) {
    const row = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    if (row.kind !== TreatmentPlanKind.ORTHODONTICS) {
      throw new BadRequestException("Orthodontic data can only be updated on orthodontic treatment plans");
    }
    return row;
  }

  private withTreatmentPlanDerivedState<
    T extends {
      status: TreatmentPlanStatus;
      items?: Array<{ status: TreatmentPlanItemStatus; completionPercentage?: number | null }>;
      kind: TreatmentPlanKind;
      orthodonticProfile?: {
        startDate: Date | null;
        estimatedMonths: number | null;
        estimatedControls: number | null;
      } | null;
      clinicalEvolutions?: Array<{
        id: string;
        createdAt: Date;
        notes: string | null;
        objective: string | null;
        assessment: string | null;
        plan: string | null;
      }>;
      pauses?: Array<{ startDate: Date; endDate: Date | null }>;
    }
  >(plan: T, extra: Record<string, unknown> = {}) {
    const clinicalProgress = calculateTreatmentPlanClinicalProgress(plan.items ?? []);
    return {
      ...plan,
      ...extra,
      clinicalProgress,
      clinicalStatus: resolveTreatmentPlanClinicalStatus(plan.status, clinicalProgress),
      orthodonticSummary: this.buildOrthodonticSummary(plan)
    };
  }

  private async syncTreatmentPlanStatusFromItems(tx: Prisma.TransactionClient, treatmentPlanId: string) {
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { status: true }
    });
    if (!plan) return null;

    const items = await tx.treatmentPlanItem.findMany({
      where: { treatmentPlanId },
      select: { status: true, completionPercentage: true }
    });
    const clinicalProgress = calculateTreatmentPlanClinicalProgress(items);
    const nextStatus = resolveTreatmentPlanStatusFromClinicalProgress(plan.status, clinicalProgress);
    if (nextStatus !== plan.status) {
      await tx.treatmentPlan.update({
        where: { id: treatmentPlanId },
        data: { status: nextStatus }
      });
    }

    return { clinicalProgress, previousStatus: plan.status, status: nextStatus };
  }

  private buildOrthodonticSummary(plan: {
    kind: TreatmentPlanKind;
    orthodonticProfile?: {
      startDate: Date | null;
      estimatedMonths: number | null;
      estimatedControls: number | null;
    } | null;
    clinicalEvolutions?: Array<{
      id: string;
      createdAt: Date;
      notes: string | null;
      objective: string | null;
      assessment: string | null;
      plan: string | null;
    }>;
    pauses?: Array<{ startDate: Date; endDate: Date | null }>;
  }) {
    if (plan.kind !== TreatmentPlanKind.ORTHODONTICS) return null;

    const startDate = plan.orthodonticProfile?.startDate;
    const estimatedMonths = plan.orthodonticProfile?.estimatedMonths ?? 0;
    const estimatedControls = plan.orthodonticProfile?.estimatedControls ?? estimatedMonths;
    const pauses = plan.pauses ?? [];

    let calendarProgress = 0;
    let isPaused = false;
    let pauseStartDate: Date | null = null;
    let totalPauseDays = 0;

    const now = new Date();

    for (const pause of pauses) {
      if (!pause.endDate) {
        isPaused = true;
        pauseStartDate = pause.startDate;
        // Pause active, calculate days up to now
        const diffMs = now.getTime() - pause.startDate.getTime();
        totalPauseDays += Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      } else {
        const diffMs = pause.endDate.getTime() - pause.startDate.getTime();
        totalPauseDays += Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      }
    }

    if (startDate && estimatedMonths > 0) {
      // Calculate total elapsed days
      const totalElapsedMs = now.getTime() - startDate.getTime();
      const totalElapsedDays = Math.max(0, totalElapsedMs / (1000 * 60 * 60 * 24));

      const effectiveElapsedDays = Math.max(0, totalElapsedDays - totalPauseDays);
      const effectiveElapsedMonths = effectiveElapsedDays / 30.436875; // Average days in month

      calendarProgress = Math.min(100, (effectiveElapsedMonths / estimatedMonths) * 100);
    }

    const realControlsCount = plan.clinicalEvolutions?.length ?? 0;
    let realProgress = 0;
    if (estimatedControls > 0) {
      realProgress = Math.min(100, (realControlsCount / estimatedControls) * 100);
    }

    return {
      calendarProgress,
      realProgress,
      realControlsCount,
      estimatedControls,
      isPaused,
      pauseStartDate,
      latestEvolution: plan.clinicalEvolutions?.[0] ?? null
    };
  }

  private optionalDate(value?: string | null) {
    if (value === undefined) return undefined;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date");
    return date;
  }

  private optionalString(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const row = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });
    if (!row) throw new BadRequestException("Invalid branchId");
  }

  private async validatePatient(actor: AuthUser, patientId: string) {
    const row = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        deletedAt: null
      },
      include: { agreement: true }
    });
    if (!row) throw new BadRequestException("Invalid patientId");
    return row;
  }

  private async validateProfessional(actor: AuthUser, professionalId: string, branchId?: string) {
    const now = new Date();
    const row = await this.prisma.professional.findFirst({
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
    if (!row) throw new BadRequestException("Invalid professionalId");
  }

  private async validateProfessionalPlanSpecialty(
    actor: AuthUser,
    professionalId: string,
    branchId: string | undefined,
    requestedKind?: TreatmentPlanKind
  ): Promise<ProfessionalPlanSpecialty> {
    const now = new Date();
    const row = await this.prisma.professional.findFirst({
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
      },
      include: {
        specialties: {
          include: {
            specialty: { select: { id: true, name: true, isActive: true } }
          }
        }
      }
    });
    if (!row) throw new BadRequestException("Invalid professionalId");

    const options = row.specialties
      .map(({ specialty }) => this.mapSpecialtyToPlanKind(specialty))
      .filter((option): option is ProfessionalPlanSpecialty => Boolean(option));

    if (!options.length) {
      throw new BadRequestException(
        "El profesional seleccionado no tiene una especialidad valida para planes de tratamiento"
      );
    }

    if (requestedKind) {
      const match = options.find((option) => option.kind === requestedKind);
      if (!match)
        throw new BadRequestException(
          "El profesional seleccionado no tiene la especialidad requerida para este plan"
        );
      return match;
    }

    const uniqueKinds = [...new Set(options.map((option) => option.kind))];
    if (uniqueKinds.length > 1) {
      throw new BadRequestException("Selecciona si el plan es general u ortodoncia para este profesional");
    }

    return options[0];
  }

  private mapSpecialtyToPlanKind(specialty: {
    id: string;
    name: string;
    isActive?: boolean | null;
  }): ProfessionalPlanSpecialty | null {
    if (specialty.isActive === false) return null;
    const allowedName = resolveAllowedSpecialtyName(specialty.name);
    if (!allowedName) return null;
    const kind = allowedName === "Ortodoncia" ? TreatmentPlanKind.ORTHODONTICS : TreatmentPlanKind.GENERAL;
    return { id: specialty.id, name: allowedName, kind };
  }

  private async validateProcedure(actor: AuthUser, procedureId: string) {
    const row = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private async validateProcedureInTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    procedureId: string
  ) {
    const row = await tx.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private async validateSection(treatmentPlanId: string, sectionId: string) {
    const row = await this.prisma.treatmentPlanSection.findFirst({
      where: { id: sectionId, treatmentPlanId }
    });
    if (!row) throw new BadRequestException("Invalid sectionId for treatment plan");
  }

  private async validateSectionInTransaction(
    tx: Prisma.TransactionClient,
    treatmentPlanId: string,
    sectionId: string
  ) {
    const row = await tx.treatmentPlanSection.findFirst({
      where: { id: sectionId, treatmentPlanId }
    });
    if (!row) throw new BadRequestException("Invalid sectionId for treatment plan");
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

  async reactivateTreatmentPlan(actor: AuthUser, id: string, dto: ReactivateTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    if (plan.status !== "CANCELLED" && plan.status !== "REJECTED") {
      throw new BadRequestException("Only cancelled or rejected plans can be reactivated");
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        status: "DRAFT",
        description: dto.reason
          ? `${plan.description || ""}\nReactivated: ${dto.reason}`.trim()
          : plan.description
      }
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "reactivate",
      { status: plan.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async deactivateTreatmentPlan(actor: AuthUser, id: string, dto: DeactivateTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    if (plan.status === TreatmentPlanStatus.COMPLETED) {
      throw new BadRequestException("Completed treatment plans cannot be deactivated");
    }
    if (plan.status === TreatmentPlanStatus.CANCELLED) {
      return plan;
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        status: TreatmentPlanStatus.CANCELLED,
        description: dto.reason
          ? `${plan.description || ""}\nDeactivated: ${dto.reason}`.trim()
          : plan.description
      }
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "deactivate",
      { status: plan.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, id);
  }

  async duplicateTreatmentPlan(actor: AuthUser, id: string, dto: DuplicateTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    const branchId = dto.newBranchId || plan.branchId;
    const professionalId = dto.newProfessionalId || plan.professionalId;
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      professionalId,
      branchId,
      plan.kind
    );

    // Deep clone the plan, sections, and items
    return this.prisma.$transaction(async (tx) => {
      const newPlan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          patientId: plan.patientId,
          professionalId,
          kind: plan.kind,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name,
          name: `${plan.name} (Copy)`,
          description: dto.reason || plan.description,
          status: TreatmentPlanStatus.DRAFT
        }
      });

      if (plan.kind === TreatmentPlanKind.ORTHODONTICS) {
        await tx.orthodonticTreatmentProfile.create({
          data: plan.orthodonticProfile
            ? {
                treatmentPlanId: newPlan.id,
                startDate: plan.orthodonticProfile.startDate,
                estimatedMonths: plan.orthodonticProfile.estimatedMonths,
                lastUpperArch: plan.orthodonticProfile.lastUpperArch,
                lastLowerArch: plan.orthodonticProfile.lastLowerArch,
                nextControlAt: plan.orthodonticProfile.nextControlAt,
                nextRadiographyAt: plan.orthodonticProfile.nextRadiographyAt,
                hygieneStatus: plan.orthodonticProfile.hygieneStatus,
                alert: plan.orthodonticProfile.alert,
                indications: plan.orthodonticProfile.indications,
                elastics: plan.orthodonticProfile.elastics,
                diagnosis: plan.orthodonticProfile.diagnosis as Prisma.InputJsonValue,
                planNotes: plan.orthodonticProfile.planNotes
              }
            : { treatmentPlanId: newPlan.id }
        });
      }

      for (const section of plan.sections) {
        const newSection = await tx.treatmentPlanSection.create({
          data: {
            treatmentPlanId: newPlan.id,
            name: section.name,
            sortOrder: section.sortOrder
          }
        });

        const sectionItems = plan.items.filter((item) => item.sectionId === section.id);
        for (const item of sectionItems) {
          await tx.treatmentPlanItem.create({
            data: {
              treatmentPlanId: newPlan.id,
              sectionId: newSection.id,
              procedureId: item.procedureId,
              toothNumber: item.toothNumber,
              surface: item.surface,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
              notes: item.notes,
              status: TreatmentPlanItemStatus.PLANNED
            }
          });
        }
      }

      return newPlan;
    });
  }

  async referTreatmentPlan(actor: AuthUser, id: string, dto: ReferTreatmentPlanDto) {
    const plan = await this.getTreatmentPlan(actor, id);
    const targetProfessionalId = dto.toProfessionalId || plan.professionalId;
    const planSpecialty = await this.validateProfessionalPlanSpecialty(
      actor,
      targetProfessionalId,
      dto.toBranchId,
      plan.kind
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Create a referral record
      const referral = await tx.treatmentPlanReferral.create({
        data: {
          treatmentPlanId: id,
          organizationId: actor.organizationId,
          fromBranchId: plan.branchId,
          toBranchId: dto.toBranchId,
          fromProfessionalId: plan.professionalId,
          toProfessionalId: dto.toProfessionalId,
          reason: dto.reason,
          createdById: actor.id
        }
      });

      // 2. We can either transfer the current plan or duplicate it.
      // Usually "refer" implies transferring the plan, or duplicating it and cancelling the original.
      // We'll duplicate it and mark the original as cancelled for tracking.

      const newPlan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.toBranchId,
          patientId: plan.patientId,
          professionalId: targetProfessionalId,
          kind: plan.kind,
          specialtyId: planSpecialty.id,
          specialtySnapshotName: planSpecialty.name,
          name: `${plan.name} (Referred)`,
          description: dto.reason,
          status: TreatmentPlanStatus.DRAFT
        }
      });

      if (plan.kind === TreatmentPlanKind.ORTHODONTICS) {
        await tx.orthodonticTreatmentProfile.create({
          data: plan.orthodonticProfile
            ? {
                treatmentPlanId: newPlan.id,
                startDate: plan.orthodonticProfile.startDate,
                estimatedMonths: plan.orthodonticProfile.estimatedMonths,
                lastUpperArch: plan.orthodonticProfile.lastUpperArch,
                lastLowerArch: plan.orthodonticProfile.lastLowerArch,
                nextControlAt: plan.orthodonticProfile.nextControlAt,
                nextRadiographyAt: plan.orthodonticProfile.nextRadiographyAt,
                hygieneStatus: plan.orthodonticProfile.hygieneStatus,
                alert: plan.orthodonticProfile.alert,
                indications: plan.orthodonticProfile.indications,
                elastics: plan.orthodonticProfile.elastics,
                diagnosis: plan.orthodonticProfile.diagnosis as Prisma.InputJsonValue,
                planNotes: plan.orthodonticProfile.planNotes
              }
            : { treatmentPlanId: newPlan.id }
        });
      }

      for (const section of plan.sections) {
        const newSection = await tx.treatmentPlanSection.create({
          data: {
            treatmentPlanId: newPlan.id,
            name: section.name,
            sortOrder: section.sortOrder
          }
        });

        const sectionItems = plan.items.filter((item) => item.sectionId === section.id);
        for (const item of sectionItems) {
          if (item.status === "COMPLETED") continue; // only refer pending work

          await tx.treatmentPlanItem.create({
            data: {
              treatmentPlanId: newPlan.id,
              sectionId: newSection.id,
              procedureId: item.procedureId,
              toothNumber: item.toothNumber,
              surface: item.surface,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
              notes: item.notes,
              status: TreatmentPlanItemStatus.PLANNED
            }
          });
        }
      }

      // Mark original plan as CANCELLED (referred) if we don't want them doing work on it
      await tx.treatmentPlan.update({
        where: { id },
        data: { status: "CANCELLED" }
      });

      return referral;
    });
  }

  async pauseTreatment(actor: AuthUser, id: string, dto: { reason?: string }) {
    const plan = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "pause");

    // Check if already paused
    const activePause = await this.prisma.treatmentPlanPause.findFirst({
      where: { treatmentPlanId: plan.id, endDate: null }
    });

    if (activePause) {
      throw new BadRequestException("Treatment is already paused");
    }

    return this.prisma.treatmentPlanPause.create({
      data: {
        treatmentPlanId: plan.id,
        startDate: new Date(),
        reason: dto.reason,
        createdById: actor.id
      }
    });
  }

  async resumeTreatment(actor: AuthUser, id: string) {
    const plan = await this.ensureTreatmentPlan(actor, id);
    this.ensureTreatmentPlanCanMutate(plan, "resume");

    // Find active pause
    const activePause = await this.prisma.treatmentPlanPause.findFirst({
      where: { treatmentPlanId: plan.id, endDate: null }
    });

    if (!activePause) {
      throw new BadRequestException("Treatment is not currently paused");
    }

    return this.prisma.treatmentPlanPause.update({
      where: { id: activePause.id },
      data: { endDate: new Date() }
    });
  }
}
