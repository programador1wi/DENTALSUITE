import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.paymentMethod.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.paymentMethod.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!row) throw new NotFoundException("Payment method not found");
    return row;
  }

  async create(actor: AuthUser, dto: CreatePaymentMethodDto) {
    const row = await this.prisma.paymentMethod.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        type: dto.type
      }
    });

    await this.audit(actor, "create", row.id, { name: row.name, type: row.type });
    return row;
  }

  async update(actor: AuthUser, id: string, dto: UpdatePaymentMethodDto) {
    await this.findOne(actor, id);
    const row = await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update", id, {
      name: dto.name,
      type: dto.type,
      isActive: dto.isActive
    });

    return row;
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  private audit(actor: AuthUser, action: string, entityId: string, payload: unknown) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PaymentMethod",
        entityId,
        action,
        after: payload as Prisma.InputJsonValue
      }
    });
  }
}
