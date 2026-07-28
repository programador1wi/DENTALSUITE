import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  CurrencyCode,
  PriceImportStatus,
  PriceListItemStatus,
  PriceListScopeType,
  PriceListStatus,
  PriceTemplateStatus,
  Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CreatePriceListVersionDto,
  ApplyPriceTemplatePreviewDto,
  CopyPriceItemsDto,
  CreatePriceImportDto,
  CreatePriceTemplateDto,
  CreateVersionedPriceListDto,
  PublishPriceListVersionDto,
  ResolvePriceDto,
  SchedulePriceListVersionDto,
  UpdateVersionedPriceListDto,
  UpsertVersionItemDto
} from "./dto/pricing.dto";

type Tx = Prisma.TransactionClient;

type PriceCatalogContext = {
  branchId: string;
  patientId?: string;
  planId?: string;
  agreementId?: string;
  clinicalDate?: string;
  currency?: CurrencyCode;
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private assertEnabled() {
    if (process.env.PRICE_LISTS_V2_ENABLED !== "true") {
      throw new ServiceUnavailableException("Versioned price lists are disabled by feature flag");
    }
  }

  private assertBranch(actor: AuthUser, branchId: string) {
    if (!actor.branchIds.includes(branchId) && !actor.permissions.includes("system.manage_all")) {
      throw new ForbiddenException("Branch is outside the authenticated scope");
    }
  }

  private date(value?: string | Date | null) {
    return value ? new Date(value) : null;
  }

  private validateDates(validFrom?: string | Date | null, validTo?: string | Date | null) {
    const start = this.date(validFrom);
    const end = this.date(validTo);
    if (start && end && start >= end) throw new BadRequestException("validTo must be after validFrom");
    return { start, end };
  }

  async list(actor: AuthUser, search?: string, includeInactive = false) {
    this.assertEnabled();
    return this.prisma.priceList.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(includeInactive ? {} : { status: { notIn: [PriceListStatus.ARCHIVED] } }),
        ...(search
          ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] }
          : {})
      },
      include: {
        versionsV2: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { scopes: true, _count: { select: { items: true, treatmentItems: true } } }
        }
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { name: "asc" }]
    });
  }

  async getList(actor: AuthUser, id: string) {
    this.assertEnabled();
    const list = await this.prisma.priceList.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        versionsV2: {
          orderBy: { versionNumber: "desc" },
          include: { scopes: true, _count: { select: { items: true, treatmentItems: true } } }
        }
      }
    });
    if (!list) throw new NotFoundException("Price list not found");
    return list;
  }

  async history(actor: AuthUser, priceListId: string, page = 1, pageSize = 50, action?: string) {
    this.assertEnabled();
    const list = await this.getList(actor, priceListId);
    const safePage = Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1);
    const safePageSize = Math.min(100, Math.max(1, Number.isFinite(pageSize) ? Math.trunc(pageSize) : 50));
    const versionIds = list.versionsV2.map((version) => version.id);
    const [versionItems, imports, latestNewItemsCount] = await Promise.all([
      this.prisma.priceListVersionItem.findMany({
        where: { organizationId: actor.organizationId, priceListVersionId: { in: versionIds } },
        select: { id: true }
      }),
      this.prisma.priceImportJob.findMany({
        where: { organizationId: actor.organizationId, priceListId },
        select: { id: true }
      }),
      list.versionsV2[0]
        ? this.prisma.priceListVersionItem.count({
            where: {
              organizationId: actor.organizationId,
              priceListVersionId: list.versionsV2[0].id,
              sourceItemId: null
            }
          })
        : Promise.resolve(0)
    ]);
    const related = [
      { entity: "PriceList", entityId: priceListId },
      ...(versionIds.length ? [{ entity: "PriceListVersion", entityId: { in: versionIds } }] : []),
      ...(versionItems.length
        ? [{ entity: "PriceListVersionItem", entityId: { in: versionItems.map((item) => item.id) } }]
        : []),
      ...(imports.length ? [{ entity: "PriceImportJob", entityId: { in: imports.map((job) => job.id) } }] : []),
      {
        action: "treatment_plan.repriced",
        metadata: { path: ["priceListIds"], array_contains: [priceListId] }
      }
    ] as Prisma.PricingAuditEventWhereInput[];
    const where: Prisma.PricingAuditEventWhereInput = {
      organizationId: actor.organizationId,
      OR: related,
      ...(action?.trim() ? { action: action.trim() } : {})
    };
    const [total, events] = await Promise.all([
      this.prisma.pricingAuditEvent.count({ where }),
      this.prisma.pricingAuditEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize
      })
    ]);
    const userIds = [
      ...new Set([
        ...(events.map((event) => event.actorUserId).filter(Boolean) as string[]),
        ...(list.versionsV2.map((version) => version.publishedById).filter(Boolean) as string[])
      ])
    ];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId: actor.organizationId, id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, email: true }
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const versions = list.versionsV2.map((version) => ({
      ...version,
      isLatest: version.id === list.versionsV2[0]?.id,
      isActive: version.status === PriceListStatus.ACTIVE,
      publishedBy: version.publishedById ? usersById.get(version.publishedById) ?? null : null
    }));
    return {
      priceList: { id: list.id, code: list.code, name: list.name },
      latestVersion: versions.find((version) => version.isLatest) ?? null,
      activeVersion: versions.find((version) => version.isActive) ?? null,
      publicationPreview: { newItemsCount: latestNewItemsCount },
      versions,
      events: events.map((event) => ({
        ...event,
        actor: event.actorUserId ? usersById.get(event.actorUserId) ?? null : null
      })),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.ceil(total / safePageSize)
      }
    };
  }

  async createList(actor: AuthUser, dto: CreateVersionedPriceListDto) {
    this.assertEnabled();
    const { start, end } = this.validateDates(dto.validFrom, dto.validTo);
    await this.validateScopes(actor, dto.scopes);
    const created = await this.prisma.$transaction(async (tx) => {
      const list = await tx.priceList.create({
        data: {
          organizationId: actor.organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          currency: dto.currency,
          basePriceListId: dto.basePriceListId,
          validFrom: start,
          validTo: end,
          priority: dto.priority ?? 0,
          status: PriceListStatus.DRAFT,
          currentVersion: 1,
          isActive: false
        }
      });
      const version = await tx.priceListVersion.create({
        data: {
          organizationId: actor.organizationId,
          priceListId: list.id,
          versionNumber: 1,
          status: PriceListStatus.DRAFT,
          validFrom: start,
          validTo: end,
          currency: dto.currency,
          changeSummary: "Initial draft",
          scopes: {
            create: dto.scopes.map((scope) => ({
              organizationId: actor.organizationId,
              scopeType: scope.scopeType,
              scopeKey: scope.scopeKey,
              priority: scope.priority ?? 0
            }))
          }
        }
      });
      await this.record(tx, actor, "PriceList", list.id, "price_list.created", null, {
        code: list.code,
        versionId: version.id
      });
      return { ...list, latestVersion: version };
    });
    return this.getList(actor, created.id);
  }

  async updateList(actor: AuthUser, id: string, dto: UpdateVersionedPriceListDto) {
    this.assertEnabled();
    const current = await this.getList(actor, id);
    if (current.version !== dto.expectedVersion) throw new ConflictException("Price list was modified by another user");
    const result = await this.prisma.priceList.updateMany({
      where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        priority: dto.priority,
        version: { increment: 1 }
      }
    });
    if (result.count !== 1) throw new ConflictException("Price list was modified by another user");
    return this.getList(actor, id);
  }

  async createVersion(actor: AuthUser, priceListId: string, dto: CreatePriceListVersionDto) {
    this.assertEnabled();
    const list = await this.getList(actor, priceListId);
    if (list.version !== dto.expectedVersion) throw new ConflictException("Price list was modified by another user");
    const source = dto.copyFromVersionId
      ? list.versionsV2.find((row) => row.id === dto.copyFromVersionId)
      : list.versionsV2[0];
    if (!source) throw new BadRequestException("A source version is required");
    const { start, end } = this.validateDates(dto.validFrom ?? source.validFrom, dto.validTo ?? source.validTo);

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.priceListVersion.create({
        data: {
          organizationId: actor.organizationId,
          priceListId,
          versionNumber: list.versionsV2[0].versionNumber + 1,
          status: PriceListStatus.DRAFT,
          validFrom: start,
          validTo: end,
          currency: dto.currency ?? source.currency,
          previousVersionId: source.id,
          changeSummary: dto.changeSummary?.trim(),
          scopes: {
            create: source.scopes.map((scope) => ({
              organizationId: actor.organizationId,
              scopeType: scope.scopeType,
              scopeKey: scope.scopeKey,
              priority: scope.priority,
              isActive: scope.isActive
            }))
          }
        }
      });
      const sourceItems = await tx.priceListVersionItem.findMany({ where: { priceListVersionId: source.id } });
      if (sourceItems.length) {
        await tx.priceListVersionItem.createMany({
          data: sourceItems.map((item) => ({
            organizationId: actor.organizationId,
            priceListVersionId: version.id,
            procedureId: item.procedureId,
            procedureVariantId: item.procedureVariantId,
            displayCategoryId: item.displayCategoryId,
            basePrice: item.basePrice,
            laboratoryCost: item.laboratoryCost,
            internalCost: item.internalCost,
            allowDiscount: item.allowDiscount,
            maxDiscountPercent: item.maxDiscountPercent,
            authorizationThresholdPercent: item.authorizationThresholdPercent,
            quantityRule: item.quantityRule ?? Prisma.JsonNull,
            taxCategory: item.taxCategory,
            status: item.status,
            sourceItemId: item.id
          }))
        });
      }
      await tx.priceList.update({ where: { id: priceListId }, data: { currentVersion: version.versionNumber, version: { increment: 1 } } });
      await this.record(tx, actor, "PriceListVersion", version.id, "price_list.version_created", null, {
        versionNumber: version.versionNumber,
        sourceVersionId: source.id
      });
      return version;
    });
  }

  async getVersionItems(actor: AuthUser, versionId: string) {
    const version = await this.version(actor, versionId);
    return this.prisma.priceListVersionItem.findMany({
      where: { priceListVersionId: version.id, organizationId: actor.organizationId },
      include: { procedure: { include: { category: true } }, procedureVariant: true, displayCategory: true },
      orderBy: [{ displayCategory: { name: "asc" } }, { procedure: { name: "asc" } }]
    });
  }

  async upsertVersionItem(actor: AuthUser, versionId: string, dto: UpsertVersionItemDto) {
    this.assertEnabled();
    const version = await this.version(actor, versionId);
    if (version.status !== PriceListStatus.DRAFT) throw new ConflictException("Published versions are immutable");
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: dto.procedureId, organizationId: actor.organizationId, isActive: true },
      include: { category: true }
    });
    if (!procedure) throw new BadRequestException("Invalid or inactive procedureId");
    const values = this.itemValues(dto);
    const current = await this.prisma.priceListVersionItem.findFirst({
      where: {
        priceListVersionId: versionId,
        procedureId: dto.procedureId,
        procedureVariantId: dto.procedureVariantId ?? null
      }
    });
    if (
      !current ||
      current.allowDiscount !== values.allowDiscount ||
      !current.maxDiscountPercent.eq(values.maxDiscountPercent)
    ) {
      this.ensureCanConfigureDiscountLimits(actor);
    }
    if (current && dto.expectedVersion !== current.version) throw new ConflictException("Price item was modified by another user");
    return this.prisma.$transaction(async (tx) => {
      const item = current
        ? await tx.priceListVersionItem.update({
            where: { id: current.id },
            data: { ...values, displayCategoryId: dto.displayCategoryId, version: { increment: 1 } }
          })
        : await tx.priceListVersionItem.create({
            data: {
              organizationId: actor.organizationId,
              priceListVersionId: version.id,
              procedureId: dto.procedureId,
              procedureVariantId: dto.procedureVariantId,
              displayCategoryId: dto.displayCategoryId,
              ...values
            }
          });
      await this.record(tx, actor, "PriceListVersionItem", item.id, "price_list_item.updated", current, item);
      return item;
    });
  }

  async deactivateVersionItem(actor: AuthUser, itemId: string, expectedVersion: number) {
    this.assertEnabled();
    const current = await this.prisma.priceListVersionItem.findFirst({
      where: { id: itemId, organizationId: actor.organizationId },
      include: { priceListVersion: true }
    });
    if (!current) throw new NotFoundException("Price item not found");
    if (current.priceListVersion.status !== PriceListStatus.DRAFT) throw new ConflictException("Published versions are immutable");
    if (current.version !== expectedVersion) throw new ConflictException("Price item was modified by another user");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.priceListVersionItem.update({
        where: { id: itemId },
        data: { status: PriceListItemStatus.INACTIVE, version: { increment: 1 } }
      });
      await this.record(
        tx,
        actor,
        "PriceListVersionItem",
        itemId,
        "price_list_item.deactivated",
        current,
        updated,
        undefined,
        undefined,
        { priceListId: current.priceListVersion.priceListId, versionId: current.priceListVersionId }
      );
      return updated;
    });
  }

  async updateVersionItem(actor: AuthUser, itemId: string, dto: UpsertVersionItemDto) {
    const item = await this.prisma.priceListVersionItem.findFirst({
      where: { id: itemId, organizationId: actor.organizationId }
    });
    if (!item) throw new NotFoundException("Price item not found");
    if (item.procedureId !== dto.procedureId || (item.procedureVariantId ?? undefined) !== dto.procedureVariantId) {
      throw new BadRequestException("Procedure identity cannot be changed; deactivate it and create another item");
    }
    return this.upsertVersionItem(actor, item.priceListVersionId, dto);
  }

  async validateVersion(actor: AuthUser, versionId: string) {
    this.assertEnabled();
    const version = await this.version(actor, versionId, true);
    const errors: Array<{ code: string; message: string }> = [];
    const warnings: Array<{ code: string; message: string }> = [];
    if (!version.scopes.length) errors.push({ code: "NO_SCOPE", message: "At least one scope is required" });
    if (!version.items.length) errors.push({ code: "NO_ITEMS", message: "At least one active price item is required" });
    if (version.validFrom && version.validTo && version.validFrom >= version.validTo)
      errors.push({ code: "INVALID_VALIDITY", message: "validTo must be after validFrom" });
    for (const item of version.items) {
      if (!item.procedure.isActive) errors.push({ code: "INACTIVE_PROCEDURE", message: `${item.procedure.code} is inactive` });
      if (item.procedure.requiresLab && item.laboratoryCost.lte(0))
        warnings.push({
          code: "LAB_COST_MISSING",
          message: `Esta prestacion requiere laboratorio y no tiene costo configurado: ${item.procedure.code}`
        });
      if (item.maxDiscountPercent.lt(0) || item.maxDiscountPercent.gt(100))
        errors.push({ code: "INVALID_DISCOUNT", message: `${item.procedure.code} has an invalid maximum discount` });
      if (item.allowDiscount && item.maxDiscountPercent.lte(0))
        errors.push({
          code: "DISCOUNT_LIMIT_REQUIRED",
          message: `${item.procedure.code} permite descuento pero no tiene un máximo mayor a 0 %`
        });
    }
    const overlap = await this.findOverlap(version);
    if (overlap) errors.push({ code: "OVERLAPPING_SCOPE", message: `Conflicts with ${overlap.priceList.name} v${overlap.versionNumber}` });
    const result = { valid: errors.length === 0, errors, warnings, checkedAt: new Date() };
    if (result.valid) {
      await this.prisma.$transaction((tx) =>
        this.record(tx, actor, "PriceListVersion", version.id, "price_list.validated", null, result)
      );
    }
    return result;
  }

  async publishVersion(actor: AuthUser, versionId: string, dto: PublishPriceListVersionDto) {
    this.assertEnabled();
    const version = await this.version(actor, versionId, true);
    if (version.status !== PriceListStatus.DRAFT) throw new ConflictException("Only draft versions can be published");
    if (version.version !== dto.expectedVersion) throw new ConflictException("Version was modified by another user");
    const validation = await this.validateVersion(actor, versionId);
    if (!validation.valid) throw new BadRequestException({ message: "Price list validation failed", ...validation });
    const now = new Date();
    const nextStatus = version.validFrom && version.validFrom > now ? PriceListStatus.SCHEDULED : PriceListStatus.ACTIVE;
    return this.activate(actor, version, nextStatus, dto.changeSummary, dto.correlationId);
  }

  async scheduleVersion(actor: AuthUser, versionId: string, dto: SchedulePriceListVersionDto) {
    this.assertEnabled();
    const startsAt = new Date(dto.validFrom);
    if (startsAt <= new Date()) throw new BadRequestException("Scheduled validFrom must be in the future");
    await this.prisma.priceListVersion.update({ where: { id: versionId }, data: { validFrom: startsAt, version: { increment: 1 } } });
    return this.publishVersion(actor, versionId, { ...dto, expectedVersion: dto.expectedVersion + 1 });
  }

  async deactivateVersion(actor: AuthUser, versionId: string, expectedVersion: number, reason?: string) {
    this.assertEnabled();
    const version = await this.version(actor, versionId);
    if (version.version !== expectedVersion) throw new ConflictException("Version was modified by another user");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.priceListVersion.update({
        where: { id: versionId },
        data: { status: PriceListStatus.INACTIVE, version: { increment: 1 } }
      });
      await tx.priceList.update({ where: { id: version.priceListId }, data: { status: PriceListStatus.INACTIVE, isActive: false } });
      await this.record(tx, actor, "PriceListVersion", versionId, "price_list.deactivated", version, updated, reason);
      return updated;
    });
  }

  async resolve(actor: AuthUser, dto: ResolvePriceDto) {
    this.assertEnabled();
    this.assertBranch(actor, dto.branchId);
    const at = dto.clinicalDate ? new Date(dto.clinicalDate) : new Date();
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: dto.procedureId, organizationId: actor.organizationId, isActive: true },
      include: { category: true }
    });
    if (!procedure) throw new BadRequestException("Invalid or inactive procedureId");
    const agreement = await this.resolveAgreement(actor, dto, at);
    const item = await this.resolveVersionItem(actor, dto, at, agreement?.version.priceListId ?? null);
    if (!item) throw new BadRequestException("No active price exists for this procedure, branch, date and currency");

    const base = item.basePrice;
    let applied = base;
    let discountPercent = new Prisma.Decimal(0);
    let coveragePercent = new Prisma.Decimal(0);
    let copay = new Prisma.Decimal(0);
    let coverageLimit: Prisma.Decimal | null = null;
    const procedureRule = agreement?.version.procedureRules[0];
    const categoryRule = agreement?.version.categoryRules.find(
      (row) => row.procedureCategoryId === procedure.categoryId
    );
    const rule = procedureRule ?? categoryRule;
    if (agreement) {
      if (agreement.version.categoryRules.length && !categoryRule && !procedureRule)
        throw new BadRequestException("Procedure category is not eligible for this agreement");
      if (rule && !rule.isEligible) throw new BadRequestException("Procedure is not eligible for this agreement");
      if (rule?.preferredPrice !== null && rule?.preferredPrice !== undefined) applied = rule.preferredPrice;
      discountPercent = rule?.discountPercent ?? agreement.version.discountPercent;
      coveragePercent = rule?.coveragePercent ?? agreement.version.coveragePercent;
      copay = rule?.copayAmount ?? agreement.version.copayAmount;
      coverageLimit = rule?.coverageLimitAmount ?? agreement.version.coverageLimitAmount;
    }
    if (item.allowDiscount === false) {
      discountPercent = new Prisma.Decimal(0);
      coveragePercent = new Prisma.Decimal(0);
      coverageLimit = null;
    }
    if (dto.manualPrice !== undefined) {
      const canOverride = actor.permissions.some((permission) =>
        ["system.manage_all", "price_override.apply", "price_lists.override_manual"].includes(permission)
      );
      if (!canOverride) throw new ForbiddenException("Manual price override permission is required");
      if (!dto.manualReason?.trim()) throw new BadRequestException("manualReason is required for manual price overrides");
      applied = new Prisma.Decimal(dto.manualPrice);
    }
    const discountAmount = applied.mul(discountPercent).div(100).toDecimalPlaces(2);
    const afterDiscount = applied.sub(discountAmount).toDecimalPlaces(2);
    let coverageAmount = afterDiscount.mul(coveragePercent).div(100).toDecimalPlaces(2);
    if (coverageLimit && coverageAmount.gt(coverageLimit)) coverageAmount = coverageLimit;
    let finalPrice = afterDiscount.sub(coverageAmount).add(copay).toDecimalPlaces(2);
    if (finalPrice.lt(0)) finalPrice = new Prisma.Decimal(0);
    const source = dto.manualPrice !== undefined ? "MANUAL" : agreement ? "AGREEMENT" : item.priceListVersion.scopes.some((s) => s.scopeType === PriceListScopeType.BRANCH) ? "BRANCH" : "ORGANIZATION";
    return {
      procedure: { id: procedure.id, code: procedure.code, name: procedure.name, category: procedure.category.name },
      priceList: { id: item.priceListVersion.priceList.id, code: item.priceListVersion.priceList.code, name: item.priceListVersion.priceList.name },
      version: { id: item.priceListVersion.id, number: item.priceListVersion.versionNumber, itemId: item.id },
      agreement: agreement ? { id: agreement.id, versionId: agreement.version.id, version: agreement.version.version } : null,
      rule: { source, agreementRuleId: rule?.id ?? null, manualReason: dto.manualReason ?? null },
      basePrice: base.toFixed(2),
      appliedPrice: applied.toFixed(2),
      discountPercent: discountPercent.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      coverageAmount: coverageAmount.toFixed(2),
      copayAmount: copay.toFixed(2),
      finalPrice: finalPrice.toFixed(2),
      allowDiscount: item.allowDiscount ?? true,
      maxDiscountPercent: (item.maxDiscountPercent ?? new Prisma.Decimal(100)).toFixed(2),
      currency: item.priceListVersion.currency,
      laboratoryCost: item.laboratoryCost.toFixed(2),
      internalCost: item.internalCost.toFixed(2),
      trace: { branchId: dto.branchId, clinicalDate: at, scopeIds: item.priceListVersion.scopes.map((s) => s.id), correlationId: dto.correlationId ?? null },
      pricedAt: new Date(),
      pricedById: actor.id
    };
  }

  async catalog(actor: AuthUser, dto: PriceCatalogContext) {
    this.assertEnabled();
    this.assertBranch(actor, dto.branchId);
    const at = dto.clinicalDate ? new Date(dto.clinicalDate) : new Date();
    if (Number.isNaN(at.getTime())) throw new BadRequestException("Invalid clinicalDate");
    const currency = dto.currency ?? CurrencyCode.MXN;
    const candidates = await this.prisma.priceListVersionItem.findMany({
      where: {
        organizationId: actor.organizationId,
        status: PriceListItemStatus.ACTIVE,
        priceListVersion: {
          organizationId: actor.organizationId,
          currency,
          status: PriceListStatus.ACTIVE,
          OR: [{ validFrom: null }, { validFrom: { lte: at } }],
          AND: [{ OR: [{ validTo: null }, { validTo: { gt: at } }] }]
        },
        procedure: { isActive: true }
      },
      include: {
        procedure: { include: { category: true } },
        procedureVariant: true
      },
      orderBy: [{ procedure: { category: { sortOrder: "asc" } } }, { procedure: { name: "asc" } }]
    });
    const procedures = new Map<string, (typeof candidates)[number]>();
    for (const candidate of candidates) {
      if (!procedures.has(candidate.procedureId)) procedures.set(candidate.procedureId, candidate);
    }
    const resolvedRows = await Promise.all(
      [...procedures.values()].map(async (candidate) => {
        try {
          const resolved = await this.resolve(actor, {
            branchId: dto.branchId,
            procedureId: candidate.procedureId,
            patientId: dto.patientId,
            planId: dto.planId,
            agreementId: dto.agreementId,
            clinicalDate: dto.clinicalDate,
            currency
          });
          return {
            id: resolved.version.itemId,
            procedureId: candidate.procedureId,
            priceListCategoryId: candidate.procedure.category.id,
            price: resolved.finalPrice,
            basePrice: resolved.basePrice,
            appliedPrice: resolved.appliedPrice,
            labCost: resolved.laboratoryCost,
            internalCost: resolved.internalCost,
            allowsDiscount: resolved.allowDiscount,
            currency: resolved.currency,
            priceList: resolved.priceList,
            version: resolved.version,
            procedure: {
              id: candidate.procedure.id,
              categoryId: candidate.procedure.categoryId,
              displayId: candidate.procedure.displayId,
              code: candidate.procedure.code,
              name: candidate.procedure.name,
              description: candidate.procedure.description,
              type: candidate.procedure.type,
              defaultDuration: candidate.procedure.defaultDuration,
              requiresTooth: candidate.procedure.requiresTooth,
              requiresSurface: candidate.procedure.requiresSurface,
              requiresLab: candidate.procedure.requiresLab,
              requiresOdontogramSymbol: candidate.procedure.requiresOdontogramSymbol,
              defaultOdontogramSymbol: candidate.procedure.defaultOdontogramSymbol,
              isActive: candidate.procedure.isActive
            },
            category: {
              id: candidate.procedure.category.id,
              name: candidate.procedure.category.name,
              description: candidate.procedure.category.description,
              sortOrder: candidate.procedure.category.sortOrder
            }
          };
        } catch (error) {
          if (error instanceof BadRequestException) return null;
          throw error;
        }
      })
    );
    const items = resolvedRows.filter((row): row is NonNullable<typeof row> => Boolean(row));
    const categories = [...new Map(items.map((item) => [item.category.id, item.category])).values()]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
      .map((category) => ({
        ...category,
        isActive: true,
        items: items.filter((item) => item.category.id === category.id)
      }));
    const primary = items[0] ?? null;
    return {
      context: {
        branchId: dto.branchId,
        agreementId: dto.agreementId ?? null,
        clinicalDate: at,
        pricedAt: new Date()
      },
      id: primary?.priceList.id ?? `catalog:${dto.planId ?? dto.branchId}`,
      name: primary?.priceList.name ?? "Tarifario vigente",
      activeVersion: primary
        ? { id: primary.version.id, number: primary.version.number, currency: primary.currency }
        : null,
      categories,
      items
    };
  }

  async copyPreview(actor: AuthUser, dto: CopyPriceItemsDto) {
    this.assertEnabled();
    const [source, target] = await Promise.all([
      this.version(actor, dto.sourceVersionId, true),
      this.version(actor, dto.targetVersionId, true)
    ]);
    if (target.status !== PriceListStatus.DRAFT) throw new ConflictException("Copy target must be a draft version");
    const targetByKey = new Map(
      target.items.map((item) => [`${item.procedureId}:${item.procedureVariantId ?? ""}`, item])
    );
    const result = { new: [] as string[], existing: [] as string[], different: [] as string[], conflicts: [] as string[], inactive: [] as string[] };
    for (const item of source.items) {
      const key = `${item.procedureId}:${item.procedureVariantId ?? ""}`;
      const current = targetByKey.get(key);
      if (item.status === PriceListItemStatus.INACTIVE) result.inactive.push(item.id);
      else if (!current) result.new.push(item.id);
      else if (
        current.basePrice.eq(item.basePrice) &&
        current.laboratoryCost.eq(item.laboratoryCost) &&
        current.internalCost.eq(item.internalCost)
      ) result.existing.push(item.id);
      else if (current.version > 1) result.conflicts.push(item.id);
      else result.different.push(item.id);
    }
    return {
      source: { id: source.id, version: source.versionNumber },
      target: { id: target.id, version: target.versionNumber },
      counts: Object.fromEntries(Object.entries(result).map(([key, values]) => [key, values.length])),
      items: result
    };
  }

  async copyApply(actor: AuthUser, dto: CopyPriceItemsDto, idempotencyKey: string) {
    this.assertEnabled();
    if (!idempotencyKey?.trim()) throw new BadRequestException("idempotency-key header is required");
    const prior = await this.prisma.outboxEvent.findFirst({
      where: { organizationId: actor.organizationId, idempotencyKey }
    });
    if (prior) return { repeated: true, eventId: prior.id, ...(prior.payload as object) };
    const preview = await this.copyPreview(actor, dto);
    const sourceItems = await this.prisma.priceListVersionItem.findMany({
      where: {
        priceListVersionId: dto.sourceVersionId,
        ...(dto.copyInactive ? {} : { status: PriceListItemStatus.ACTIVE })
      }
    });
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const source of sourceItems) {
      const current = await this.prisma.priceListVersionItem.findFirst({
        where: {
          priceListVersionId: dto.targetVersionId,
          procedureId: source.procedureId,
          procedureVariantId: source.procedureVariantId
        }
      });
      if (current && !dto.updatePrices) {
        skipped += 1;
        continue;
      }
      const copied = await this.upsertVersionItem(actor, dto.targetVersionId, {
        procedureId: source.procedureId,
        procedureVariantId: source.procedureVariantId ?? undefined,
        displayCategoryId: source.displayCategoryId ?? undefined,
        basePrice: current && !dto.updatePrices ? current.basePrice.toFixed(2) : source.basePrice.toFixed(2),
        laboratoryCost: dto.copyCosts === false && current ? current.laboratoryCost.toFixed(2) : source.laboratoryCost.toFixed(2),
        internalCost: dto.copyCosts === false && current ? current.internalCost.toFixed(2) : source.internalCost.toFixed(2),
        allowDiscount: dto.copyDiscounts === false && current ? current.allowDiscount : source.allowDiscount,
        maxDiscountPercent: dto.copyDiscounts === false && current ? current.maxDiscountPercent.toFixed(2) : source.maxDiscountPercent.toFixed(2),
        expectedVersion: current?.version
      });
      if (!copied.sourceItemId) {
        await this.prisma.priceListVersionItem.update({
          where: { id: copied.id },
          data: { sourceItemId: source.id }
        });
      }
      if (current) updated += 1;
      else created += 1;
    }
    const summary = { repeated: false, created, updated, skipped, preview: preview.counts };
    await this.prisma.outboxEvent.create({
      data: {
        organizationId: actor.organizationId,
        aggregateType: "PriceListVersion",
        aggregateId: dto.targetVersionId,
        eventType: "price_list.copy_applied",
        payload: summary,
        idempotencyKey
      }
    });
    return summary;
  }

  async listTemplates(actor: AuthUser) {
    this.assertEnabled();
    return this.prisma.priceTemplate.findMany({
      where: { organizationId: actor.organizationId, status: { not: PriceTemplateStatus.ARCHIVED } },
      include: { sections: { include: { items: { include: { procedure: true } } }, orderBy: { sortOrder: "asc" } } },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });
  }

  async createTemplate(actor: AuthUser, dto: CreatePriceTemplateDto) {
    this.assertEnabled();
    if (dto.branchIds?.some((id) => !actor.branchIds.includes(id)) && !actor.permissions.includes("system.manage_all"))
      throw new ForbiddenException("One or more template branches are outside the authenticated scope");
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.priceTemplate.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          specialtyId: dto.specialtyId,
          basePriceListId: dto.basePriceListId,
          branchIds: dto.branchIds ?? [],
          status: PriceTemplateStatus.DRAFT,
          createdById: actor.id,
          sections: {
            create: dto.sections.map((section, sectionIndex) => ({
              organizationId: actor.organizationId,
              name: section.name.trim(),
              description: section.description?.trim(),
              sortOrder: section.sortOrder ?? sectionIndex,
              items: {
                create: section.items.map((item, itemIndex) => ({
                  organizationId: actor.organizationId,
                  procedureId: item.procedureId,
                  procedureVariantId: item.procedureVariantId,
                  quantity: new Prisma.Decimal(item.quantity ?? "1"),
                  sortOrder: itemIndex
                }))
              }
            }))
          }
        },
        include: { sections: { include: { items: true } } }
      });
      await this.record(tx, actor, "PriceTemplate", template.id, "price_template.created", null, template);
      return template;
    });
  }

  async applyTemplatePreview(actor: AuthUser, templateId: string, dto: ApplyPriceTemplatePreviewDto) {
    this.assertEnabled();
    this.assertBranch(actor, dto.branchId);
    const template = await this.prisma.priceTemplate.findFirst({
      where: { id: templateId, organizationId: actor.organizationId, status: { not: PriceTemplateStatus.ARCHIVED } },
      include: { sections: { include: { items: { include: { procedure: true } } }, orderBy: { sortOrder: "asc" } } }
    });
    if (!template) throw new NotFoundException("Price template not found");
    if (template.branchIds.length && !template.branchIds.includes(dto.branchId))
      throw new BadRequestException("Template is not available for this branch");
    const sections = [];
    for (const section of template.sections) {
      const resolvedItems = [];
      for (const item of section.items) {
        try {
          const price = await this.resolve(actor, { ...dto, procedureId: item.procedureId });
          resolvedItems.push({ templateItemId: item.id, procedure: price.procedure, quantity: item.quantity.toFixed(2), price, error: null });
        } catch (error) {
          resolvedItems.push({
            templateItemId: item.id,
            procedure: { id: item.procedure.id, code: item.procedure.code, name: item.procedure.name },
            quantity: item.quantity.toFixed(2),
            price: null,
            error: error instanceof Error ? error.message : "Price resolution failed"
          });
        }
      }
      sections.push({ id: section.id, name: section.name, sortOrder: section.sortOrder, items: resolvedItems });
    }
    return { template: { id: template.id, name: template.name, version: template.version }, sections, canApply: sections.every((section) => section.items.every((item) => !item.error)) };
  }

  async createImport(actor: AuthUser, dto: CreatePriceImportDto) {
    this.assertEnabled();
    const version = await this.version(actor, dto.priceListVersionId);
    if (version.priceListId !== dto.priceListId || version.status !== PriceListStatus.DRAFT)
      throw new ConflictException("Imports can only target a draft version of the selected list");
    const duplicateCodes = new Set<string>();
    const seen = new Set<string>();
    for (const row of dto.rows) {
      const code = row.code.trim().toUpperCase();
      if (seen.has(code)) duplicateCodes.add(code);
      seen.add(code);
    }
    const procedures = await this.prisma.procedure.findMany({
      where: { organizationId: actor.organizationId, code: { in: [...seen] }, isActive: true },
      select: { id: true, code: true }
    });
    const procedureByCode = new Map(procedures.map((procedure) => [procedure.code.toUpperCase(), procedure]));
    const errors = dto.rows.flatMap((row, index) => {
      const code = row.code.trim().toUpperCase();
      const messages = [];
      if (duplicateCodes.has(code)) messages.push({ rowNumber: index + 2, field: "code", code: "DUPLICATE_CODE", message: `Duplicate code ${code}` });
      if (!procedureByCode.has(code)) messages.push({ rowNumber: index + 2, field: "code", code: "UNKNOWN_CODE", message: `Unknown or inactive code ${code}` });
      if (new Prisma.Decimal(row.price).lt(0)) messages.push({ rowNumber: index + 2, field: "price", code: "NEGATIVE_PRICE", message: "Price cannot be negative" });
      return messages;
    });
    const checksum = createHash("sha256").update(JSON.stringify(dto.rows)).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.priceImportJob.upsert({
        where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: dto.idempotencyKey } },
        update: {},
        create: {
          organizationId: actor.organizationId,
          priceListId: dto.priceListId,
          priceListVersionId: dto.priceListVersionId,
          fileName: dto.fileName,
          checksum,
          idempotencyKey: dto.idempotencyKey,
          status: errors.length ? PriceImportStatus.WITH_ERRORS : PriceImportStatus.READY,
          createdById: actor.id,
          summary: { total: dto.rows.length, errors: errors.length },
          rows: {
            create: dto.rows.map((row, index) => ({
              organizationId: actor.organizationId,
              rowNumber: index + 2,
              rawData: row as unknown as Prisma.InputJsonValue,
              normalizedData: {
                ...row,
                code: row.code.trim().toUpperCase(),
                procedureId: procedureByCode.get(row.code.trim().toUpperCase())?.id ?? null
              },
              status: errors.some((error) => error.rowNumber === index + 2) ? PriceImportStatus.WITH_ERRORS : PriceImportStatus.READY
            }))
          }
        }
      });
      if (errors.length) {
        const rows = await tx.priceImportRow.findMany({ where: { importJobId: job.id } });
        await tx.priceImportError.createMany({
          data: errors.map((error) => ({
            organizationId: actor.organizationId,
            importJobId: job.id,
            importRowId: rows.find((row) => row.rowNumber === error.rowNumber)?.id,
            field: error.field,
            code: error.code,
            message: error.message
          }))
        });
      }
      await this.record(tx, actor, "PriceImportJob", job.id, "price_import.validated", null, { status: job.status, errors: errors.length });
      return tx.priceImportJob.findUnique({ where: { id: job.id }, include: { rows: true, errors: true } });
    });
  }

  async getImport(actor: AuthUser, id: string) {
    this.assertEnabled();
    const job = await this.prisma.priceImportJob.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { rows: { orderBy: { rowNumber: "asc" } }, errors: true }
    });
    if (!job) throw new NotFoundException("Price import not found");
    return job;
  }

  async applyImport(actor: AuthUser, id: string) {
    const job = await this.getImport(actor, id);
    if (job.status === PriceImportStatus.APPLIED) return job;
    if (job.status !== PriceImportStatus.READY) throw new ConflictException("Import is not ready to apply");
    await this.prisma.priceImportJob.update({ where: { id }, data: { status: PriceImportStatus.APPLYING } });
    let applied = 0;
    try {
      for (const row of job.rows) {
        const normalized = row.normalizedData as Record<string, unknown>;
        const previous = await this.prisma.priceListVersionItem.findFirst({
          where: {
            priceListVersionId: job.priceListVersionId!,
            procedureId: String(normalized.procedureId),
            procedureVariantId: null
          }
        });
        await this.prisma.priceImportRow.update({
          where: { id: row.id },
          data: {
            normalizedData: {
              ...normalized,
              previous: previous
                ? {
                    id: previous.id,
                    basePrice: previous.basePrice.toFixed(2),
                    laboratoryCost: previous.laboratoryCost.toFixed(2),
                    internalCost: previous.internalCost.toFixed(2),
                    allowDiscount: previous.allowDiscount,
                    maxDiscountPercent: previous.maxDiscountPercent.toFixed(2),
                    status: previous.status,
                    version: previous.version
                  }
                : null
            } as Prisma.InputJsonValue
          }
        });
        const item = await this.upsertVersionItem(actor, job.priceListVersionId!, {
          procedureId: String(normalized.procedureId),
          basePrice: String(normalized.price),
          laboratoryCost: String(normalized.laboratoryCost ?? "0"),
          internalCost: String(normalized.internalCost ?? "0"),
          allowDiscount: Boolean(normalized.allowDiscount),
          maxDiscountPercent: String(normalized.maxDiscountPercent ?? "0")
        });
        applied += 1;
        await this.prisma.priceImportRow.update({ where: { id: row.id }, data: { appliedItemId: item.id, status: PriceImportStatus.APPLIED } });
      }
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.priceImportJob.update({
          where: { id },
          data: {
            status: PriceImportStatus.APPLIED,
            appliedAt: new Date(),
            summary: { total: job.rows.length, applied }
          }
        });
        await this.record(
          tx,
          actor,
          "PriceImportJob",
          id,
          "price_import.applied",
          { status: job.status, summary: job.summary },
          { status: updated.status, summary: updated.summary, appliedAt: updated.appliedAt },
          undefined,
          undefined,
          { priceListId: job.priceListId, versionId: job.priceListVersionId }
        );
        return updated;
      });
    } catch (error) {
      await this.prisma.priceImportJob.update({ where: { id }, data: { status: applied ? PriceImportStatus.PARTIALLY_APPLIED : PriceImportStatus.FAILED, summary: { total: job.rows.length, applied, error: error instanceof Error ? error.message : "Import failed" } } });
      throw error;
    }
  }

  async revertImport(actor: AuthUser, id: string) {
    const job = await this.getImport(actor, id);
    if (job.status !== PriceImportStatus.APPLIED && job.status !== PriceImportStatus.PARTIALLY_APPLIED)
      throw new ConflictException("Only an applied import can be reverted");
    const version = await this.version(actor, job.priceListVersionId!);
    if (version.status !== PriceListStatus.DRAFT)
      throw new ConflictException("An import cannot be reverted after its version was published");
    const appliedIds = job.rows.map((row) => row.appliedItemId).filter(Boolean) as string[];
    const dependencies = await this.prisma.treatmentPlanItem.count({
      where: { priceListVersionItemId: { in: appliedIds } }
    });
    if (dependencies) throw new ConflictException("Import items are already referenced by treatment plans");
    for (const row of [...job.rows].reverse()) {
      if (!row.appliedItemId) continue;
      const normalized = row.normalizedData as Record<string, unknown>;
      const previous = normalized.previous as Record<string, unknown> | null;
      if (previous) {
        await this.prisma.priceListVersionItem.update({
          where: { id: row.appliedItemId },
          data: {
            basePrice: new Prisma.Decimal(String(previous.basePrice)),
            laboratoryCost: new Prisma.Decimal(String(previous.laboratoryCost)),
            internalCost: new Prisma.Decimal(String(previous.internalCost)),
            allowDiscount: Boolean(previous.allowDiscount),
            maxDiscountPercent: new Prisma.Decimal(String(previous.maxDiscountPercent)),
            status: previous.status as PriceListItemStatus,
            version: { increment: 1 }
          }
        });
      } else {
        await this.prisma.priceListVersionItem.update({
          where: { id: row.appliedItemId },
          data: { status: PriceListItemStatus.INACTIVE, version: { increment: 1 } }
        });
      }
      await this.prisma.priceImportRow.update({
        where: { id: row.id },
        data: { status: PriceImportStatus.REVERTED }
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.priceImportJob.update({
        where: { id },
        data: { status: PriceImportStatus.REVERTED, revertedAt: new Date() }
      });
      await this.record(
        tx,
        actor,
        "PriceImportJob",
        id,
        "price_import.reverted",
        { status: job.status, summary: job.summary },
        { status: updated.status, summary: updated.summary, revertedAt: updated.revertedAt },
        undefined,
        undefined,
        { priceListId: job.priceListId, versionId: job.priceListVersionId }
      );
      return updated;
    });
  }

  private itemValues(dto: UpsertVersionItemDto) {
    const basePrice = new Prisma.Decimal(dto.basePrice);
    const laboratoryCost = new Prisma.Decimal(dto.laboratoryCost ?? "0");
    const internalCost = new Prisma.Decimal(dto.internalCost ?? "0");
    const allowDiscount = dto.allowDiscount ?? true;
    const maxDiscountPercent = allowDiscount
      ? new Prisma.Decimal(dto.maxDiscountPercent ?? "100")
      : new Prisma.Decimal(0);
    if ([basePrice, laboratoryCost, internalCost, maxDiscountPercent].some((value) => value.lt(0)))
      throw new BadRequestException("Prices, costs and discounts cannot be negative");
    if (maxDiscountPercent.gt(100)) throw new BadRequestException("maxDiscountPercent cannot exceed 100");
    if (allowDiscount && maxDiscountPercent.lte(0)) {
      throw new BadRequestException("Discount-enabled procedures require maxDiscountPercent greater than 0");
    }
    return {
      basePrice,
      laboratoryCost,
      internalCost,
      allowDiscount,
      maxDiscountPercent,
      authorizationThresholdPercent: dto.authorizationThresholdPercent
        ? new Prisma.Decimal(dto.authorizationThresholdPercent)
        : null
    };
  }

  private ensureCanConfigureDiscountLimits(actor: AuthUser) {
    if (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("price_lists.configure_discount_limits")
    ) {
      return;
    }
    throw new ForbiddenException("Insufficient permissions to configure procedure discount limits");
  }

  private async version(actor: AuthUser, id: string, _details = false) {
    const row = await this.prisma.priceListVersion.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        priceList: true,
        scopes: true,
        items: { where: { status: PriceListItemStatus.ACTIVE }, include: { procedure: true } }
      }
    });
    if (!row) throw new NotFoundException("Price list version not found");
    return row;
  }

  private async validateScopes(actor: AuthUser, scopes: Array<{ scopeType: PriceListScopeType; scopeKey: string }>) {
    if (!scopes.length) throw new BadRequestException("At least one scope is required");
    const branchIds = scopes.filter((scope) => scope.scopeType === PriceListScopeType.BRANCH).map((scope) => scope.scopeKey);
    if (branchIds.some((id) => !actor.branchIds.includes(id)) && !actor.permissions.includes("system.manage_all"))
      throw new ForbiddenException("One or more branch scopes are not allowed");
    if (scopes.some((scope) => scope.scopeType === PriceListScopeType.ORGANIZATION && scope.scopeKey !== actor.organizationId))
      throw new ForbiddenException("Organization scope does not match the authenticated tenant");
  }

  private async findOverlap(version: Awaited<ReturnType<PricingService["version"]>>) {
    if (!version.validFrom) return null;
    const keys = version.scopes.filter((scope) => scope.isActive).map((scope) => ({ scopeType: scope.scopeType, scopeKey: scope.scopeKey }));
    if (!keys.length) return null;
    const candidates = await this.prisma.priceListVersion.findMany({
      where: {
        id: { not: version.id },
        organizationId: version.organizationId,
        currency: version.currency,
        status: { in: [PriceListStatus.ACTIVE, PriceListStatus.SCHEDULED] },
        scopes: { some: { isActive: true, OR: keys } },
        AND: [
          { OR: [{ validTo: null }, { validTo: { gt: version.validFrom } }] },
          { OR: [{ validFrom: null }, { validFrom: { lt: version.validTo ?? new Date("9999-12-31") } }] }
        ]
      },
      include: { priceList: true, scopes: { where: { isActive: true } } }
    });
    const effectivePriority = (row: {
      priceList: { priority: number };
      scopes: Array<{ scopeType: PriceListScopeType; scopeKey: string; priority: number }>;
    }) =>
      row.priceList.priority +
      Math.max(
        0,
        ...row.scopes
          .filter((scope) =>
            keys.some((key) => key.scopeType === scope.scopeType && key.scopeKey === scope.scopeKey)
          )
          .map((scope) => scope.priority)
      );
    const currentPriority = effectivePriority(version);
    return candidates.find((candidate) => effectivePriority(candidate) === currentPriority) ?? null;
  }

  private async activate(
    actor: AuthUser,
    version: Awaited<ReturnType<PricingService["version"]>>,
    status: PriceListStatus,
    changeSummary?: string,
    correlationId?: string
  ) {
    const items = await this.prisma.priceListVersionItem.findMany({ where: { priceListVersionId: version.id }, orderBy: { id: "asc" } });
    const activeVersions =
      status === PriceListStatus.ACTIVE
        ? await this.prisma.priceListVersion.findMany({
            where: {
              priceListId: version.priceListId,
              status: PriceListStatus.ACTIVE,
              id: { not: version.id }
            },
            include: { _count: { select: { items: true, treatmentItems: true } } }
          })
        : [];
    const checksum = createHash("sha256")
      .update(items.map((item) => `${item.procedureId}:${item.procedureVariantId ?? ""}:${item.basePrice}:${item.status}`).join("|"))
      .digest("hex");
    return this.prisma.$transaction(async (tx) => {
      if (status === PriceListStatus.ACTIVE) {
        await tx.priceListVersion.updateMany({
          where: { priceListId: version.priceListId, status: PriceListStatus.ACTIVE, id: { not: version.id } },
          data: { status: PriceListStatus.SUPERSEDED }
        });
        for (const previous of activeVersions) {
          await this.record(
            tx,
            actor,
            "PriceListVersion",
            previous.id,
            "price_list.version_superseded",
            previous,
            { ...previous, status: PriceListStatus.SUPERSEDED, supersededByVersionId: version.id },
            changeSummary,
            correlationId,
            {
              priceListId: version.priceListId,
              versionNumber: previous.versionNumber,
              supersededByVersionId: version.id,
              treatmentItems: previous._count.treatmentItems
            }
          );
        }
      }
      const updated = await tx.priceListVersion.update({
        where: { id: version.id },
        data: {
          status,
          publishedById: actor.id,
          publishedAt: new Date(),
          changeSummary: changeSummary?.trim() ?? version.changeSummary,
          checksum,
          version: { increment: 1 }
        }
      });
      await tx.priceList.update({
        where: { id: version.priceListId },
        data: {
          status,
          currency: version.currency,
          validFrom: version.validFrom,
          validTo: version.validTo,
          currentVersion: version.versionNumber,
          isActive: status === PriceListStatus.ACTIVE,
          version: { increment: 1 }
        }
      });
      await this.record(
        tx,
        actor,
        "PriceListVersion",
        version.id,
        status === PriceListStatus.ACTIVE ? "price_list.published" : "price_list.scheduled",
        version,
        {
          ...updated,
          replacedVersions: activeVersions.map((previous) => ({
            id: previous.id,
            versionNumber: previous.versionNumber,
            treatmentItems: previous._count.treatmentItems
          })),
          itemCount: items.length
        },
        changeSummary,
        correlationId,
        {
          priceListId: version.priceListId,
          versionNumber: version.versionNumber,
          previousVersionId: version.previousVersionId,
          itemCount: items.length
        }
      );
      return updated;
    });
  }

  private async resolveAgreement(actor: AuthUser, dto: ResolvePriceDto, at: Date) {
    let agreementId = dto.agreementId;
    if (!agreementId && dto.planId) {
      const plan = await this.prisma.treatmentPlan.findFirst({ where: { id: dto.planId, organizationId: actor.organizationId }, select: { agreementId: true } });
      agreementId = plan?.agreementId ?? undefined;
    }
    if (!agreementId && dto.patientId) {
      const assignment = await this.prisma.agreementPatientAssignment.findFirst({
        where: { organizationId: actor.organizationId, patientId: dto.patientId, revokedAt: null },
        orderBy: { assignedAt: "desc" }
      });
      agreementId = assignment?.agreementId;
    }
    if (!agreementId) return null;
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId: actor.organizationId, isActive: true, status: "ACTIVE" },
      include: {
        versions: {
          where: { OR: [{ startsAt: null }, { startsAt: { lte: at } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: at } }] }] },
          orderBy: { version: "desc" },
          take: 1,
          include: {
            branches: true,
            categoryRules: true,
            procedureRules: { where: { procedureId: dto.procedureId } }
          }
        }
      }
    });
    if (!agreement?.versions[0]) throw new BadRequestException("Agreement has no active version for the clinical date");
    if (!agreement.versions[0].branches.some((branch) => branch.branchId === dto.branchId))
      throw new BadRequestException("Agreement is not valid for this branch");
    return { ...agreement, version: agreement.versions[0] };
  }

  private async resolveVersionItem(actor: AuthUser, dto: ResolvePriceDto, at: Date, agreementPriceListId: string | null) {
    const currency = dto.currency ?? CurrencyCode.MXN;
    const rows = await this.prisma.priceListVersionItem.findMany({
      where: {
        organizationId: actor.organizationId,
        procedureId: dto.procedureId,
        status: PriceListItemStatus.ACTIVE,
        priceListVersion: {
          organizationId: actor.organizationId,
          currency,
          status: PriceListStatus.ACTIVE,
          OR: [{ validFrom: null }, { validFrom: { lte: at } }],
          AND: [{ OR: [{ validTo: null }, { validTo: { gt: at } }] }],
          ...(agreementPriceListId
            ? { priceListId: agreementPriceListId }
            : {
                scopes: {
                  some: {
                    isActive: true,
                    OR: [
                      { scopeType: PriceListScopeType.BRANCH, scopeKey: dto.branchId },
                      { scopeType: PriceListScopeType.ORGANIZATION, scopeKey: actor.organizationId }
                    ]
                  }
                }
              })
        }
      },
      include: { priceListVersion: { include: { priceList: true, scopes: { where: { isActive: true } } } } }
    });
    return rows.sort((a, b) => {
      const branchA = a.priceListVersion.scopes.some((scope) => scope.scopeType === PriceListScopeType.BRANCH && scope.scopeKey === dto.branchId) ? 1 : 0;
      const branchB = b.priceListVersion.scopes.some((scope) => scope.scopeType === PriceListScopeType.BRANCH && scope.scopeKey === dto.branchId) ? 1 : 0;
      const scopePriorityA = Math.max(0, ...a.priceListVersion.scopes.map((scope) => scope.priority));
      const scopePriorityB = Math.max(0, ...b.priceListVersion.scopes.map((scope) => scope.priority));
      return branchB - branchA || scopePriorityB - scopePriorityA || b.priceListVersion.priceList.priority - a.priceListVersion.priceList.priority || b.priceListVersion.versionNumber - a.priceListVersion.versionNumber || a.id.localeCompare(b.id);
    })[0] ?? null;
  }

  private async record(
    tx: Tx,
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
    reason?: string,
    correlationId?: string,
    metadata?: unknown
  ) {
    const safe = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
    await tx.pricingAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity,
        entityId,
        action,
        oldValue: safe(oldValue),
        newValue: safe(newValue),
        reason,
        correlationId,
        metadata: metadata === undefined ? undefined : safe(metadata)
      }
    });
    await tx.outboxEvent.create({
      data: { organizationId: actor.organizationId, aggregateType: entity, aggregateId: entityId, eventType: action, payload: safe(newValue), correlationId }
    });
  }
}
