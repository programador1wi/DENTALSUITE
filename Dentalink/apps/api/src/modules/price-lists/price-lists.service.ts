import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreatePriceListDto } from "./dto/create-price-list.dto";
import { UpdatePriceListDto } from "./dto/update-price-list.dto";

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.priceList.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {})
      },
      include: {
        items: { include: { procedure: true } }
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
        items: {
          include: { procedure: true },
          orderBy: { procedure: { code: "asc" } }
        }
      }
    });

    if (!row) throw new NotFoundException("Price list not found");
    return row;
  }

  async create(actor: AuthUser, dto: CreatePriceListDto) {
    await this.ensureSingleDefault(actor, dto.isDefault ?? false);
    if (dto.items?.length) await this.validateProcedures(actor, dto.items.map((item) => item.procedureId));

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
            procedureId: item.procedureId,
            price: new Prisma.Decimal(item.price),
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
      await this.validateProcedures(actor, dto.items.map((item) => item.procedureId));
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
              procedureId: item.procedureId,
              price: new Prisma.Decimal(item.price),
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
}
