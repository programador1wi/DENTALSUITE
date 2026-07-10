import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProcedureType } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { UpdateBranchPriceListsDto } from "./dto/branch-price-list.dto";
import { CreatePriceListDto } from "./dto/create-price-list.dto";
import { CreatePriceListCategoryDto, UpdatePriceListCategoryDto } from "./dto/price-list-category.dto";
import { UpdatePriceListDto } from "./dto/update-price-list.dto";

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number, branchId?: string) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const branchScoped = branchId ? await this.branchHasScopedPriceLists(actor, branchId) : false;
    return this.prisma.priceList.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(branchId && branchScoped
          ? {
              branchAssignments: {
                some: { branchId, isActive: true }
              }
            }
          : {})
      },
      include: {
        branchAssignments: {
          where: { isActive: true },
          include: { branch: { include: { brand: true, zone: true } } },
          orderBy: [{ branch: { name: "asc" } }]
        },
        categories: {
          where: { isActive: true },
          include: {
            procedureCategory: true,
            items: { include: { procedure: true } }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        },
        items: {
          include: {
            priceListCategory: true,
            procedure: true
          }
        }
      },
      skip,
      take,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.priceList.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        branchAssignments: {
          where: { isActive: true },
          include: { branch: { include: { brand: true, zone: true } } },
          orderBy: [{ branch: { name: "asc" } }]
        },
        categories: {
          where: { isActive: true },
          include: {
            procedureCategory: true,
            items: {
              include: { procedure: true },
              orderBy: { procedure: { code: "asc" } }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        },
        items: {
          include: {
            priceListCategory: true,
            procedure: true
          },
          orderBy: { procedure: { code: "asc" } }
        }
      }
    });

    if (!row) throw new NotFoundException("Price list not found");
    return row;
  }

  async availabilityMatrix(actor: AuthUser) {
    await this.ensureDefaultBranchScopeCatalogs(actor);

    const [brands, zones, branches, priceLists] = await Promise.all([
      this.prisma.branchBrand.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.branchZone.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.branch.findMany({
        where: {
          organizationId: actor.organizationId,
          deletedAt: null,
          id: { in: actor.branchIds },
          status: "ACTIVE"
        },
        include: {
          brand: true,
          zone: true,
          priceLists: {
            where: { isActive: true },
            include: { priceList: true }
          }
        },
        orderBy: { name: "asc" }
      }),
      this.prisma.priceList.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        include: {
          branchAssignments: {
            where: { isActive: true },
            include: { branch: { include: { brand: true, zone: true } } }
          }
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }]
      })
    ]);

    return { brands, zones, branches, priceLists };
  }

  async create(actor: AuthUser, dto: CreatePriceListDto) {
    await this.ensureSingleDefault(actor, dto.isDefault ?? false);
    if (dto.items?.length)
      await this.validateProcedures(
        actor,
        dto.items.map((item) => item.procedureId)
      );
    if (dto.items?.some((item) => item.priceListCategoryId)) {
      throw new BadRequestException("Price list categories can only be assigned after the list exists");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const list = await tx.priceList.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isDefault: dto.isDefault ?? false
        }
      });

      if (dto.items?.length) {
        await tx.priceListItem.createMany({
          data: dto.items.map((item) => ({
            priceListId: list.id,
            priceListCategoryId: item.priceListCategoryId,
            procedureId: item.procedureId,
            price: new Prisma.Decimal(item.price),
            labCost: new Prisma.Decimal(item.labCost ?? "0"),
            allowsDiscount: item.allowsDiscount ?? false,
            currency: item.currency ?? "MXN"
          })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PriceList",
          entityId: list.id,
          action: "create",
          after: { name: list.name, isDefault: list.isDefault }
        }
      });

      return list;
    });

    return this.findOne(actor, created.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdatePriceListDto) {
    await this.findOne(actor, id);
    await this.ensureSingleDefault(actor, dto.isDefault ?? false, id);

    if (dto.items) {
      await this.validateProcedures(
        actor,
        dto.items.map((item) => item.procedureId)
      );
      await this.validatePriceListCategories(
        actor,
        id,
        dto.items.map((item) => item.priceListCategoryId).filter(Boolean) as string[]
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.priceList.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          isDefault: dto.isDefault,
          isActive: dto.isActive
        }
      });

      if (dto.items) {
        await tx.priceListItem.deleteMany({ where: { priceListId: id } });
        if (dto.items.length) {
          await tx.priceListItem.createMany({
            data: dto.items.map((item) => ({
              priceListId: id,
              priceListCategoryId: item.priceListCategoryId,
              procedureId: item.procedureId,
              price: new Prisma.Decimal(item.price),
              labCost: new Prisma.Decimal(item.labCost ?? "0"),
              allowsDiscount: item.allowsDiscount ?? false,
              currency: item.currency ?? "MXN"
            })),
            skipDuplicates: true
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PriceList",
          entityId: id,
          action: "update",
          after: {
            name: dto.name,
            isDefault: dto.isDefault,
            isActive: dto.isActive,
            itemCount: dto.items?.length
          }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  async updateBranchAssignments(actor: AuthUser, priceListId: string, dto: UpdateBranchPriceListsDto) {
    await this.ensurePriceList(actor, priceListId);
    const branchIds = [...new Set(dto.assignments.map((assignment) => assignment.branchId))];
    await this.validateBranches(actor, branchIds);

    await this.prisma.$transaction(async (tx) => {
      for (const assignment of dto.assignments) {
        if (!assignment.enabled) {
          await tx.branchPriceList.updateMany({
            where: { branchId: assignment.branchId, priceListId },
            data: { isActive: false, isDefault: false }
          });
          continue;
        }

        if (assignment.isDefault) {
          await tx.branchPriceList.updateMany({
            where: { branchId: assignment.branchId, isActive: true },
            data: { isDefault: false }
          });
        }

        await tx.branchPriceList.upsert({
          where: { branchId_priceListId: { branchId: assignment.branchId, priceListId } },
          create: {
            organizationId: actor.organizationId,
            branchId: assignment.branchId,
            priceListId,
            type: assignment.type ?? "BASE",
            isDefault: assignment.isDefault ?? false
          },
          update: {
            type: assignment.type ?? "BASE",
            isDefault: assignment.isDefault ?? false,
            isActive: true
          }
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PriceList",
          entityId: priceListId,
          action: "update_branch_availability",
          after: {
            assignmentCount: dto.assignments.length,
            enabledCount: dto.assignments.filter((assignment) => assignment.enabled).length
          } as Prisma.InputJsonValue
        }
      });
    });

    return this.findOne(actor, priceListId);
  }

  async createCategory(actor: AuthUser, priceListId: string, dto: CreatePriceListCategoryDto) {
    const list = await this.ensurePriceList(actor, priceListId);
    const name = this.normalizeName(dto.name);
    await this.ensureUniquePriceListCategory(priceListId, name);

    const procedureCategory = await this.resolveProcedureCategory(
      actor,
      name,
      dto.description,
      dto.sortOrder,
      dto.type
    );
    const row = await this.prisma.priceListCategory.create({
      data: {
        organizationId: list.organizationId,
        priceListId,
        procedureCategoryId: procedureCategory.id,
        name,
        description: dto.description?.trim(),
        sortOrder: dto.sortOrder ?? 0
      }
    });

    await this.audit(actor, "PriceListCategory", row.id, "create", {
      priceListId,
      name: row.name
    });

    return this.findCategory(actor, priceListId, row.id);
  }

  async updateCategory(
    actor: AuthUser,
    priceListId: string,
    categoryId: string,
    dto: UpdatePriceListCategoryDto
  ) {
    await this.ensurePriceList(actor, priceListId);
    const currentCategory = await this.findCategory(actor, priceListId, categoryId);

    let procedureCategoryId: string | undefined;
    let name: string | undefined;
    if (dto.name !== undefined || dto.type !== undefined) {
      name = dto.name !== undefined ? this.normalizeName(dto.name) : undefined;
      const targetName = name ?? currentCategory.name;
      if (name !== undefined) await this.ensureUniquePriceListCategory(priceListId, name, categoryId);
      const procedureCategory = await this.resolveProcedureCategory(
        actor,
        targetName,
        dto.description ?? currentCategory.description ?? undefined,
        dto.sortOrder ?? currentCategory.sortOrder,
        dto.type
      );
      procedureCategoryId = procedureCategory.id;
    }

    await this.prisma.priceListCategory.update({
      where: { id: categoryId },
      data: {
        procedureCategoryId,
        name,
        description: dto.description?.trim(),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "PriceListCategory", categoryId, "update", {
      priceListId,
      name,
      isActive: dto.isActive
    });

    return this.findCategory(actor, priceListId, categoryId);
  }

  async deactivateCategory(actor: AuthUser, priceListId: string, categoryId: string) {
    return this.updateCategory(actor, priceListId, categoryId, { isActive: false });
  }

  private async ensureSingleDefault(actor: AuthUser, isDefault: boolean, excludeId?: string) {
    if (!isDefault) return;

    const existing = await this.prisma.priceList.findFirst({
      where: {
        organizationId: actor.organizationId,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    if (existing) {
      throw new BadRequestException("Only one default price list is allowed per organization");
    }
  }

  private async validateProcedures(actor: AuthUser, procedureIds: string[]) {
    const unique = [...new Set(procedureIds)];
    const count = await this.prisma.procedure.count({
      where: {
        organizationId: actor.organizationId,
        id: { in: unique }
      }
    });

    if (count !== unique.length) {
      throw new BadRequestException("One or more procedures are invalid");
    }
  }

  private async validateBranches(actor: AuthUser, branchIds: string[]) {
    if (!branchIds.length) return;
    const count = await this.prisma.branch.count({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        id: { in: branchIds.filter((branchId) => actor.branchIds.includes(branchId)) }
      }
    });

    if (count !== branchIds.length) {
      throw new BadRequestException("One or more branches are invalid");
    }
  }

  private async branchHasScopedPriceLists(actor: AuthUser, branchId: string) {
    if (!actor.branchIds.includes(branchId)) throw new BadRequestException("Invalid branchId");
    const count = await this.prisma.branchPriceList.count({
      where: {
        organizationId: actor.organizationId,
        branchId,
        isActive: true,
        priceList: { isActive: true }
      }
    });
    return count > 0;
  }

  private async ensureDefaultBranchScopeCatalogs(actor: AuthUser) {
    const brands = [
      { code: "DENTAL_PLUS", name: "Dental+" },
      { code: "DX_RAY", name: "Dx-Ray" },
      { code: "DENTAL_JWARNER", name: "Dental J.Warner" }
    ];
    const zones = [
      { code: "NORTE", name: "Norte" },
      { code: "SUR", name: "Sur" },
      { code: "DJWARNER", name: "DJWarner" }
    ];

    await Promise.all([
      ...brands.map((brand) =>
        this.prisma.branchBrand.upsert({
          where: { organizationId_code: { organizationId: actor.organizationId, code: brand.code } },
          create: { organizationId: actor.organizationId, ...brand },
          update: { name: brand.name, isActive: true }
        })
      ),
      ...zones.map((zone) =>
        this.prisma.branchZone.upsert({
          where: { organizationId_code: { organizationId: actor.organizationId, code: zone.code } },
          create: { organizationId: actor.organizationId, ...zone },
          update: { name: zone.name, isActive: true }
        })
      )
    ]);
  }

  private async validatePriceListCategories(actor: AuthUser, priceListId: string, categoryIds: string[]) {
    const unique = [...new Set(categoryIds)];
    if (!unique.length) return;

    const count = await this.prisma.priceListCategory.count({
      where: {
        organizationId: actor.organizationId,
        priceListId,
        id: { in: unique },
        isActive: true
      }
    });

    if (count !== unique.length) {
      throw new BadRequestException("One or more price list categories are invalid");
    }
  }

  private async ensurePriceList(actor: AuthUser, id: string) {
    const list = await this.prisma.priceList.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!list) throw new NotFoundException("Price list not found");
    return list;
  }

  private async findCategory(actor: AuthUser, priceListId: string, categoryId: string) {
    const row = await this.prisma.priceListCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: actor.organizationId,
        priceListId
      },
      include: {
        procedureCategory: true,
        items: {
          include: { procedure: true },
          orderBy: { procedure: { code: "asc" } }
        }
      }
    });

    if (!row) throw new NotFoundException("Price list category not found");
    return row;
  }

  private async ensureUniquePriceListCategory(priceListId: string, name: string, excludeId?: string) {
    const existing = await this.prisma.priceListCategory.findFirst({
      where: {
        priceListId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    if (existing) {
      throw new BadRequestException("Price list category already exists in this price list");
    }
  }

  private async resolveProcedureCategory(
    actor: AuthUser,
    name: string,
    description?: string,
    sortOrder?: number,
    type?: ProcedureType
  ) {
    const existing = await this.prisma.procedureCategory.findFirst({
      where: {
        organizationId: actor.organizationId,
        name
      }
    });

    if (existing) {
      if (type !== undefined && existing.type !== type) {
        return this.prisma.procedureCategory.update({
          where: { id: existing.id },
          data: { type }
        });
      }
      return existing;
    }

    return this.prisma.procedureCategory.create({
      data: {
        organizationId: actor.organizationId,
        name,
        description: description?.trim(),
        sortOrder: sortOrder ?? 0,
        type
      }
    });
  }

  private normalizeName(name: string) {
    const normalized = name.trim();
    if (!normalized) throw new BadRequestException("Category name is required");
    return normalized;
  }

  private audit(actor: AuthUser, entity: string, entityId: string, action: string, payload: unknown) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity,
        entityId,
        action,
        after: payload as Prisma.InputJsonValue
      }
    });
  }
}
