import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, LabOrderStatus, Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CreateInventoryItemDto,
  CreateInventoryMovementDto,
  CreateLabOrderDto,
  CreateLabOrderFromTreatmentDto,
  CreateLabProviderDto,
  CreateSupplierDto,
  ListInventoryItemsQueryDto,
  ListInventoryMovementsQueryDto,
  ListLabOrdersQueryDto,
  ListLabProvidersQueryDto,
  ListSuppliersQueryDto,
  UpdateInventoryItemDto,
  UpdateLabOrderCostDto,
  UpdateLabOrderStatusDto,
  UpdateLabProviderDto,
  UpdateSupplierDto
} from "./dto/labs-inventory.dto";

@Injectable()
export class LabsInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listLabProviders(actor: AuthUser, query: ListLabProvidersQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.labProvider.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(query.active === "false" ? { isActive: false } : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createLabProvider(actor: AuthUser, dto: CreateLabProviderDto) {
    const duplicate = await this.prisma.labProvider.findFirst({
      where: {
        organizationId: actor.organizationId,
        name: dto.name.trim()
      }
    });
    if (duplicate) throw new ConflictException("Lab provider with this name already exists");

    const created = await this.prisma.labProvider.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address?.trim()
      }
    });

    await this.audit(actor, {
      entity: "LabProvider",
      entityId: created.id,
      action: "create",
      after: { name: created.name, email: created.email }
    });

    return created;
  }

  async updateLabProvider(actor: AuthUser, id: string, dto: UpdateLabProviderDto) {
    const current = await this.ensureLabProvider(actor, id);

    if (dto.name && dto.name.trim() !== current.name) {
      const duplicate = await this.prisma.labProvider.findFirst({
        where: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          id: { not: id }
        }
      });
      if (duplicate) throw new ConflictException("Lab provider with this name already exists");
    }

    const updated = await this.prisma.labProvider.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address?.trim(),
        ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {})
      }
    });

    await this.audit(actor, {
      entity: "LabProvider",
      entityId: id,
      action: "update",
      before: { name: current.name, isActive: current.isActive },
      after: { name: updated.name, isActive: updated.isActive }
    });

    return updated;
  }

  async deactivateLabProvider(actor: AuthUser, id: string) {
    await this.ensureLabProvider(actor, id);
    const updated = await this.prisma.labProvider.update({
      where: { id },
      data: { isActive: false }
    });
    await this.audit(actor, {
      entity: "LabProvider",
      entityId: id,
      action: "deactivate",
      after: { isActive: false }
    });
    return updated;
  }

  async listLabOrders(actor: AuthUser, query: ListLabOrdersQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.labOrder.findMany({
      where: {
        organizationId: actor.organizationId,
        patient: { branchId: branchScope(actor) },
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.professionalId ? { professionalId: query.professionalId } : {}),
        ...(query.labProviderId ? { labProviderId: query.labProviderId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        labProvider: { select: { id: true, name: true } },
        treatmentPlan: { select: { id: true, name: true, status: true } },
        items: true
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async getLabOrder(actor: AuthUser, id: string) {
    const row = await this.prisma.labOrder.findFirst({
      where: { id, organizationId: actor.organizationId, patient: { branchId: branchScope(actor) } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        labProvider: { select: { id: true, name: true, phone: true, email: true } },
        treatmentPlan: { select: { id: true, name: true, status: true } },
        items: true
      }
    });
    if (!row) throw new NotFoundException("Lab order not found");
    return row;
  }

  async createLabOrder(actor: AuthUser, dto: CreateLabOrderDto) {
    await this.ensurePatient(actor, dto.patientId);
    await this.ensureProfessional(actor, dto.professionalId);
    await this.ensureLabProvider(actor, dto.labProviderId);

    if (dto.treatmentPlanId) {
      await this.ensureTreatmentPlan(actor, dto.treatmentPlanId, dto.patientId);
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.labOrder.create({
        data: {
          organizationId: actor.organizationId,
          patientId: dto.patientId,
          treatmentPlanId: dto.treatmentPlanId,
          professionalId: dto.professionalId,
          labProviderId: dto.labProviderId,
          status: dto.status ?? LabOrderStatus.REQUESTED,
          sentAt: dto.sentAt ? new Date(dto.sentAt) : null,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : null,
          cost: dto.cost !== undefined ? this.toDecimal(dto.cost) : null,
          notes: dto.notes?.trim()
        }
      });

      if (dto.items?.length) {
        for (const item of dto.items) {
          await tx.labOrderItem.create({
            data: {
              labOrderId: created.id,
              description: item.description.trim(),
              quantity: this.toDecimal(item.quantity),
              unitCost: item.unitCost !== undefined ? this.toDecimal(item.unitCost) : null,
              toothNumber: item.toothNumber?.trim(),
              notes: item.notes?.trim()
            }
          });
        }
      }

      await this.auditTx(tx, actor, {
        entity: "LabOrder",
        entityId: created.id,
        action: "create",
        after: {
          patientId: created.patientId,
          treatmentPlanId: created.treatmentPlanId,
          status: created.status
        }
      });

      return created.id;
    });

    return this.getLabOrder(actor, createdId);
  }

  async createLabOrderFromTreatment(actor: AuthUser, treatmentPlanId: string, dto: CreateLabOrderFromTreatmentDto) {
    const treatmentPlan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        items: {
          include: {
            procedure: { select: { id: true, name: true, requiresLab: true } }
          }
        }
      }
    });
    if (!treatmentPlan) throw new NotFoundException("Treatment plan not found");

    await this.ensureProfessional(actor, dto.professionalId);
    await this.ensureLabProvider(actor, dto.labProviderId);

    const labItems = treatmentPlan.items.filter((item) => item.procedure.requiresLab && item.status !== "CANCELLED");
    if (!labItems.length) {
      throw new BadRequestException("Treatment plan has no laboratory-required procedures");
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.create({
        data: {
          organizationId: actor.organizationId,
          patientId: treatmentPlan.patientId,
          treatmentPlanId: treatmentPlan.id,
          professionalId: dto.professionalId,
          labProviderId: dto.labProviderId,
          status: LabOrderStatus.REQUESTED,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          cost: dto.cost !== undefined ? this.toDecimal(dto.cost) : null,
          notes: dto.notes?.trim()
        }
      });

      for (const item of labItems) {
        await tx.labOrderItem.create({
          data: {
            labOrderId: order.id,
            description: item.procedure.name,
            quantity: this.toDecimal(Number(item.quantity)),
            unitCost: this.toDecimal(Number(item.unitPrice)),
            toothNumber: item.toothNumber,
            notes: item.surface ? `Surface: ${item.surface}` : null
          }
        });
      }

      await this.auditTx(tx, actor, {
        entity: "LabOrder",
        entityId: order.id,
        action: "create_from_treatment_plan",
        after: {
          treatmentPlanId: treatmentPlan.id,
          itemCount: labItems.length
        }
      });

      return order.id;
    });

    return this.getLabOrder(actor, createdId);
  }

  async updateLabOrderStatus(actor: AuthUser, id: string, dto: UpdateLabOrderStatusDto) {
    const current = await this.ensureLabOrder(actor, id);

    const updated = await this.prisma.labOrder.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === LabOrderStatus.SENT && !current.sentAt ? { sentAt: new Date() } : {}),
        ...(dto.status === LabOrderStatus.RECEIVED && !current.receivedAt ? { receivedAt: new Date() } : {})
      }
    });

    await this.audit(actor, {
      entity: "LabOrder",
      entityId: id,
      action: "update_status",
      before: { status: current.status },
      after: { status: updated.status }
    });

    return updated;
  }

  async updateLabOrderCost(actor: AuthUser, id: string, dto: UpdateLabOrderCostDto) {
    const current = await this.ensureLabOrder(actor, id);
    const updated = await this.prisma.labOrder.update({
      where: { id },
      data: { cost: this.toDecimal(dto.cost) }
    });

    await this.audit(actor, {
      entity: "LabOrder",
      entityId: id,
      action: "update_cost",
      before: { cost: Number(current.cost ?? 0) },
      after: { cost: dto.cost }
    });

    return updated;
  }

  async getTreatmentLabProfitability(actor: AuthUser, treatmentPlanId?: string) {
    if (!treatmentPlanId) throw new BadRequestException("treatmentPlanId is required");

    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        items: { where: { status: { not: "CANCELLED" } }, select: { total: true } },
        labOrders: { select: { id: true, status: true, cost: true } }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");

    const treatmentRevenue = plan.items.reduce((sum, item) => sum + Number(item.total), 0);
    const labCost = plan.labOrders.reduce((sum, order) => sum + Number(order.cost ?? 0), 0);
    const grossMargin = this.roundMoney(treatmentRevenue - labCost);
    const marginRate = treatmentRevenue > 0 ? this.roundMoney((grossMargin / treatmentRevenue) * 100) : 0;

    return {
      treatmentPlanId: plan.id,
      patient: plan.patient,
      treatmentRevenue: this.roundMoney(treatmentRevenue),
      labCost: this.roundMoney(labCost),
      grossMargin,
      marginRate,
      labOrders: plan.labOrders
    };
  }

  async listSuppliers(actor: AuthUser, query: ListSuppliersQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.supplier.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(query.active === "false" ? { isActive: false } : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createSupplier(actor: AuthUser, dto: CreateSupplierDto) {
    const duplicate = await this.prisma.supplier.findFirst({
      where: {
        organizationId: actor.organizationId,
        name: dto.name.trim()
      }
    });
    if (duplicate) throw new ConflictException("Supplier with this name already exists");

    const created = await this.prisma.supplier.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address?.trim()
      }
    });

    await this.audit(actor, {
      entity: "Supplier",
      entityId: created.id,
      action: "create",
      after: { name: created.name }
    });

    return created;
  }

  async updateSupplier(actor: AuthUser, id: string, dto: UpdateSupplierDto) {
    const current = await this.ensureSupplier(actor, id);

    if (dto.name && dto.name.trim() !== current.name) {
      const duplicate = await this.prisma.supplier.findFirst({
        where: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          id: { not: id }
        }
      });
      if (duplicate) throw new ConflictException("Supplier with this name already exists");
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address?.trim(),
        ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {})
      }
    });

    await this.audit(actor, {
      entity: "Supplier",
      entityId: id,
      action: "update",
      before: { name: current.name, isActive: current.isActive },
      after: { name: updated.name, isActive: updated.isActive }
    });

    return updated;
  }

  async deactivateSupplier(actor: AuthUser, id: string) {
    await this.ensureSupplier(actor, id);
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false }
    });
    await this.audit(actor, {
      entity: "Supplier",
      entityId: id,
      action: "deactivate",
      after: { isActive: false }
    });
    return updated;
  }

  async listInventoryItems(actor: AuthUser, query: ListInventoryItemsQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.inventoryItem.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { sku: { contains: query.search, mode: "insensitive" } },
                { category: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.category ? { category: query.category } : {}),
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(query.active === "false" ? { isActive: false } : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      },
      skip,
      take,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }]
    });
  }

  async createInventoryItem(actor: AuthUser, dto: CreateInventoryItemDto) {
    await this.ensureBranch(actor, dto.branchId);
    if (dto.supplierId) await this.ensureSupplier(actor, dto.supplierId);

    const duplicate = await this.prisma.inventoryItem.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: dto.branchId,
        sku: dto.sku.trim()
      }
    });
    if (duplicate) throw new ConflictException("Inventory SKU already exists in this branch");

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          sku: dto.sku.trim(),
          category: dto.category.trim(),
          unit: dto.unit.trim(),
          stock: this.toDecimal(dto.stock),
          minStock: this.toDecimal(dto.minStock),
          branchId: dto.branchId,
          supplierId: dto.supplierId ?? null
        }
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          branchId: item.branchId,
          type: InventoryMovementType.IN,
          quantity: this.toDecimal(dto.stock),
          reason: "Initial stock",
          createdById: actor.id
        }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryItem",
        entityId: item.id,
        action: "create",
        after: {
          sku: item.sku,
          stock: dto.stock,
          branchId: item.branchId
        }
      });

      return item.id;
    });

    return this.prisma.inventoryItem.findUnique({
      where: { id: created },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      }
    });
  }

  async updateInventoryItem(actor: AuthUser, id: string, dto: UpdateInventoryItemDto) {
    const current = await this.ensureInventoryItem(actor, id);
    if (dto.supplierId) await this.ensureSupplier(actor, dto.supplierId);

    if (dto.sku && dto.sku.trim() !== current.sku) {
      const duplicate = await this.prisma.inventoryItem.findFirst({
        where: {
          organizationId: actor.organizationId,
          branchId: current.branchId,
          sku: dto.sku.trim(),
          id: { not: id }
        }
      });
      if (duplicate) throw new ConflictException("Inventory SKU already exists in this branch");
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        sku: dto.sku?.trim(),
        category: dto.category?.trim(),
        unit: dto.unit?.trim(),
        ...(dto.minStock !== undefined ? { minStock: this.toDecimal(dto.minStock) } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId || null } : {}),
        ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      }
    });

    await this.audit(actor, {
      entity: "InventoryItem",
      entityId: id,
      action: "update",
      before: {
        name: current.name,
        sku: current.sku,
        minStock: Number(current.minStock),
        isActive: current.isActive
      },
      after: {
        name: updated.name,
        sku: updated.sku,
        minStock: Number(updated.minStock),
        isActive: updated.isActive
      }
    });

    return updated;
  }

  async deactivateInventoryItem(actor: AuthUser, id: string) {
    await this.ensureInventoryItem(actor, id);
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false }
    });
    await this.audit(actor, {
      entity: "InventoryItem",
      entityId: id,
      action: "deactivate",
      after: { isActive: false }
    });
    return updated;
  }

  async listInventoryMovements(actor: AuthUser, query: ListInventoryMovementsQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.inventoryMovement.findMany({
      where: {
        inventoryItem: { organizationId: actor.organizationId },
        ...(query.inventoryItemId ? { inventoryItemId: query.inventoryItemId } : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.type ? { type: query.type } : {})
      },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async createInventoryMovement(actor: AuthUser, dto: CreateInventoryMovementDto) {
    const item = await this.ensureInventoryItem(actor, dto.inventoryItemId);
    if (item.branchId !== dto.branchId) {
      throw new BadRequestException("Inventory movement branch must match inventory item branch");
    }

    const quantity = this.roundMoney(dto.quantity);
    if (quantity <= 0) throw new BadRequestException("Quantity must be greater than zero");

    const created = await this.prisma.$transaction(async (tx) => {
      const currentStock = Number(item.stock);
      const nextStock =
        dto.type === InventoryMovementType.OUT ? this.roundMoney(currentStock - quantity) : this.roundMoney(currentStock + quantity);

      if (dto.type === InventoryMovementType.OUT && nextStock < 0) {
        throw new BadRequestException("Insufficient stock for OUT movement");
      }

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { stock: this.toDecimal(nextStock) }
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          branchId: dto.branchId,
          type: dto.type,
          quantity: this.toDecimal(quantity),
          reason: dto.reason?.trim(),
          createdById: actor.id
        }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryMovement",
        entityId: movement.id,
        action: "create",
        before: { stock: currentStock },
        after: { stock: nextStock, type: dto.type, quantity }
      });

      return movement.id;
    });

    return this.prisma.inventoryMovement.findUnique({
      where: { id: created },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true, stock: true, minStock: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  async listMinStockAlerts(actor: AuthUser, branchId?: string) {
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        branchId: branchScope(actor, branchId)
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      },
      orderBy: [{ branch: { name: "asc" } }, { stock: "asc" }]
    });
    return rows.filter((row) => Number(row.stock) <= Number(row.minStock));
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async ensureProfessional(actor: AuthUser, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: actor.organizationId, isActive: true }
    });
    if (!professional) throw new NotFoundException("Professional not found");
    return professional;
  }

  private async ensureLabProvider(actor: AuthUser, providerId: string) {
    const provider = await this.prisma.labProvider.findFirst({
      where: { id: providerId, organizationId: actor.organizationId }
    });
    if (!provider) throw new NotFoundException("Lab provider not found");
    return provider;
  }

  private async ensureLabOrder(actor: AuthUser, id: string) {
    const row = await this.prisma.labOrder.findFirst({
      where: { id, organizationId: actor.organizationId, patient: { branchId: branchScope(actor) } }
    });
    if (!row) throw new NotFoundException("Lab order not found");
    return row;
  }

  private async ensureSupplier(actor: AuthUser, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: actor.organizationId }
    });
    if (!supplier) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  private async ensureBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchScope(actor, branchId), organizationId: actor.organizationId, deletedAt: null }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async ensureInventoryItem(actor: AuthUser, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) }
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }

  private async ensureTreatmentPlan(actor: AuthUser, treatmentPlanId: string, patientId?: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: {
        id: treatmentPlanId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        ...(patientId ? { patientId } : {})
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    return plan;
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(this.roundMoney(value));
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async audit(
    actor: AuthUser,
    payload: {
      entity: string;
      entityId?: string;
      action: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        before: payload.before,
        after: payload.after
      }
    });
  }

  private async auditTx(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    payload: {
      entity: string;
      entityId?: string;
      action: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        before: payload.before,
        after: payload.after
      }
    });
  }
}
