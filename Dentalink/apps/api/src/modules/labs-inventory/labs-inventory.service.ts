import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, LabOrderStatus, Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CreateInventoryItemDto,
  CreateInventoryMovementDto,
  CreateInventoryProductSaleDto,
  CreateInventoryWarehouseDto,
  CreateLabOrderDto,
  CreateLabOrderFromTreatmentDto,
  CreateLabProviderDto,
  CreateSupplierDto,
  ListInventoryItemsQueryDto,
  ListInventoryMovementsQueryDto,
  ListInventoryWarehousesQueryDto,
  ListLabOrdersQueryDto,
  ListLabProvidersQueryDto,
  ListSuppliersQueryDto,
  UpdateInventoryItemDto,
  UpdateInventoryStockDto,
  UpdateInventoryWarehouseDto,
  UpdateLabProcedureAssignmentsDto,
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
        address: dto.address?.trim(),
        details: dto.details?.trim()
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
        details: dto.details?.trim(),
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

  async listLabProcedureAssignments(actor: AuthUser) {
    return this.prisma.labProcedureAssignment.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        labProvider: { select: { id: true, name: true, isActive: true } },
        procedure: { select: { id: true, code: true, name: true, requiresLab: true, isActive: true } }
      },
      orderBy: [{ procedure: { code: "asc" } }, { labProvider: { name: "asc" } }]
    });
  }

  async updateLabProcedureAssignments(actor: AuthUser, procedureId: string, dto: UpdateLabProcedureAssignmentsDto) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!procedure) throw new NotFoundException("Procedure not found");
    if (!procedure.requiresLab) throw new BadRequestException("Procedure does not require laboratory");

    const labProviderIds = [...new Set(dto.assignments.map((assignment) => assignment.labProviderId))];
    if (labProviderIds.length) {
      const validCount = await this.prisma.labProvider.count({
        where: { id: { in: labProviderIds }, organizationId: actor.organizationId }
      });
      if (validCount !== labProviderIds.length) throw new BadRequestException("One or more lab providers are invalid");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const assignment of dto.assignments) {
        if (!assignment.isAssigned) {
          await tx.labProcedureAssignment.updateMany({
            where: {
              organizationId: actor.organizationId,
              procedureId,
              labProviderId: assignment.labProviderId
            },
            data: { isActive: false }
          });
          continue;
        }

        await tx.labProcedureAssignment.upsert({
          where: {
            procedureId_labProviderId: {
              procedureId,
              labProviderId: assignment.labProviderId
            }
          },
          create: {
            organizationId: actor.organizationId,
            procedureId,
            labProviderId: assignment.labProviderId,
            patientPrice: this.toNullableDecimal(assignment.patientPrice),
            currency: assignment.currency ?? "MXN",
            isActive: true
          },
          update: {
            patientPrice: this.toNullableDecimal(assignment.patientPrice),
            currency: assignment.currency ?? "MXN",
            isActive: true
          }
        });
      }

      await this.auditTx(tx, actor, {
        entity: "LabProcedureAssignment",
        entityId: procedureId,
        action: "bulk_update",
        after: {
          procedureId,
          assignmentCount: dto.assignments.filter((assignment) => assignment.isAssigned).length
        }
      });
    });

    return this.listLabProcedureAssignments(actor);
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
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { sku: { contains: query.search, mode: "insensitive" } },
                { category: { contains: query.search, mode: "insensitive" } },
                { supplier: { name: { contains: query.search, mode: "insensitive" } } }
              ]
            }
          : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.warehouseId ? { stocks: { some: { warehouseId: query.warehouseId } } } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(query.active === "false" ? { isActive: false } : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: {
          where: query.warehouseId ? { warehouseId: query.warehouseId } : undefined,
          include: { warehouse: { select: { id: true, name: true, branchId: true, isDefault: true } } },
          orderBy: [{ warehouse: { isDefault: "desc" } }, { warehouse: { name: "asc" } }]
        }
      },
      skip,
      take,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }]
    });

    if (query.stock === "low") {
      return rows.filter((row) => this.stockRows(row).some((stock) => Number(stock.stock) <= Number(stock.minStock)));
    }
    if (query.stock === "zero") {
      return rows.filter((row) => this.stockRows(row).some((stock) => Number(stock.stock) === 0));
    }
    return rows;
  }

  async listInventoryWarehouses(actor: AuthUser, query: ListInventoryWarehousesQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.inventoryWarehouse.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, query.branchId),
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(query.active === "false" ? { isActive: false } : {})
      },
      include: { branch: { select: { id: true, name: true } } },
      skip,
      take,
      orderBy: [{ branch: { name: "asc" } }, { isDefault: "desc" }, { name: "asc" }]
    });
  }

  async createInventoryWarehouse(actor: AuthUser, dto: CreateInventoryWarehouseDto) {
    await this.ensureBranch(actor, dto.branchId);
    const duplicate = await this.prisma.inventoryWarehouse.findFirst({
      where: { organizationId: actor.organizationId, branchId: dto.branchId, name: dto.name.trim() }
    });
    if (duplicate) throw new ConflictException("Warehouse already exists in this branch");

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.inventoryWarehouse.updateMany({
          where: { organizationId: actor.organizationId, branchId: dto.branchId, isDefault: true },
          data: { isDefault: false }
        });
      }

      const warehouse = await tx.inventoryWarehouse.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isDefault: dto.isDefault ?? false
        }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryWarehouse",
        entityId: warehouse.id,
        action: "create",
        after: { branchId: warehouse.branchId, name: warehouse.name, isDefault: warehouse.isDefault }
      });

      return warehouse.id;
    });

    return this.prisma.inventoryWarehouse.findUnique({
      where: { id: created },
      include: { branch: { select: { id: true, name: true } } }
    });
  }

  async updateInventoryWarehouse(actor: AuthUser, id: string, dto: UpdateInventoryWarehouseDto) {
    const current = await this.ensureWarehouse(actor, id);
    if (dto.name && dto.name.trim() !== current.name) {
      const duplicate = await this.prisma.inventoryWarehouse.findFirst({
        where: { organizationId: actor.organizationId, branchId: current.branchId, name: dto.name.trim(), id: { not: id } }
      });
      if (duplicate) throw new ConflictException("Warehouse already exists in this branch");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.inventoryWarehouse.updateMany({
          where: { organizationId: actor.organizationId, branchId: current.branchId, isDefault: true, id: { not: id } },
          data: { isDefault: false }
        });
      }

      const warehouse = await tx.inventoryWarehouse.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description === null ? null : dto.description?.trim(),
          ...(typeof dto.isDefault === "boolean" ? { isDefault: dto.isDefault } : {}),
          ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {})
        },
        include: { branch: { select: { id: true, name: true } } }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryWarehouse",
        entityId: id,
        action: "update",
        before: { name: current.name, isDefault: current.isDefault, isActive: current.isActive },
        after: { name: warehouse.name, isDefault: warehouse.isDefault, isActive: warehouse.isActive }
      });

      return warehouse;
    });

    return updated;
  }

  async createInventoryItem(actor: AuthUser, dto: CreateInventoryItemDto) {
    await this.ensureBranch(actor, dto.branchId);
    if (dto.supplierId) await this.ensureSupplier(actor, dto.supplierId);
    const warehouse = dto.warehouseId
      ? await this.ensureWarehouse(actor, dto.warehouseId, dto.branchId)
      : await this.ensureDefaultWarehouse(actor, dto.branchId);

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
          salePrice: dto.salePrice !== undefined ? this.toDecimal(dto.salePrice) : null,
          isSellable: dto.isSellable ?? false,
          branchId: dto.branchId,
          supplierId: dto.supplierId ?? null
        }
      });

      await tx.inventoryStock.create({
        data: {
          organizationId: actor.organizationId,
          inventoryItemId: item.id,
          warehouseId: warehouse.id,
          stock: this.toDecimal(dto.stock),
          minStock: this.toDecimal(dto.minStock),
          averageCost: this.toDecimal(dto.averageCost ?? 0)
        }
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          branchId: item.branchId,
          warehouseId: warehouse.id,
          type: InventoryMovementType.IN,
          quantity: this.toDecimal(dto.stock),
          unitCost: dto.averageCost !== undefined ? this.toDecimal(dto.averageCost) : null,
          reason: "Initial stock",
          source: "INITIAL",
          stockBefore: this.toDecimal(0),
          stockAfter: this.toDecimal(dto.stock),
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
          branchId: item.branchId,
          warehouseId: warehouse.id,
          movementId: movement.id
        }
      });

      return item.id;
    });

    return this.prisma.inventoryItem.findUnique({
      where: { id: created },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: { include: { warehouse: { select: { id: true, name: true, branchId: true, isDefault: true } } } }
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
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice === null ? null : this.toDecimal(dto.salePrice) } : {}),
        ...(typeof dto.isSellable === "boolean" ? { isSellable: dto.isSellable } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId || null } : {}),
        ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: { include: { warehouse: { select: { id: true, name: true, branchId: true, isDefault: true } } } }
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
        salePrice: current.salePrice ? Number(current.salePrice) : null,
        isSellable: current.isSellable,
        isActive: current.isActive
      },
      after: {
        name: updated.name,
        sku: updated.sku,
        minStock: Number(updated.minStock),
        salePrice: updated.salePrice ? Number(updated.salePrice) : null,
        isSellable: updated.isSellable,
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
    const createdAt = this.dateRange(query.dateFrom, query.dateTo);
    return this.prisma.inventoryMovement.findMany({
      where: {
        inventoryItem: {
          organizationId: actor.organizationId,
          ...(query.supplierId ? { supplierId: query.supplierId } : {})
        },
        ...(query.inventoryItemId ? { inventoryItemId: query.inventoryItemId } : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(query.type ? { type: query.type } : {})
      },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true, supplier: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
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
    const warehouse = dto.warehouseId
      ? await this.ensureWarehouse(actor, dto.warehouseId, dto.branchId)
      : await this.ensureDefaultWarehouse(actor, dto.branchId);

    const quantity = this.roundMoney(dto.quantity);
    if (quantity <= 0) throw new BadRequestException("Quantity must be greater than zero");
    if (dto.type === InventoryMovementType.ADJUSTMENT && !dto.reason?.trim()) {
      throw new BadRequestException("Adjustment reason is required");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const stockRow = await this.ensureStockTx(tx, actor, item, warehouse.id);
      const currentStock = Number(stockRow.stock);
      const nextStock =
        dto.type === InventoryMovementType.OUT ? this.roundMoney(currentStock - quantity) : this.roundMoney(currentStock + quantity);

      if (dto.type === InventoryMovementType.OUT && nextStock < 0) {
        throw new BadRequestException("Insufficient stock for OUT movement");
      }

      await this.updateStockTx(tx, item.id, stockRow.id, nextStock, dto.type === InventoryMovementType.IN ? dto.unitCost : undefined, quantity);

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          type: dto.type,
          quantity: this.toDecimal(quantity),
          unitCost: dto.unitCost !== undefined ? this.toDecimal(dto.unitCost) : null,
          reason: dto.reason?.trim(),
          source: "MANUAL",
          stockBefore: this.toDecimal(currentStock),
          stockAfter: this.toDecimal(nextStock),
          createdById: actor.id
        }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryMovement",
        entityId: movement.id,
        action: "create",
        before: { stock: currentStock },
        after: { stock: nextStock, type: dto.type, quantity, warehouseId: warehouse.id }
      });

      return movement.id;
    });

    return this.prisma.inventoryMovement.findUnique({
      where: { id: created },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true, stock: true, minStock: true } },
        branch: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  async updateInventoryStock(actor: AuthUser, inventoryItemId: string, warehouseId: string, dto: UpdateInventoryStockDto) {
    const item = await this.ensureInventoryItem(actor, inventoryItemId);
    const warehouse = await this.ensureWarehouse(actor, warehouseId, item.branchId);
    const stock = await this.prisma.inventoryStock.upsert({
      where: { inventoryItemId_warehouseId: { inventoryItemId: item.id, warehouseId: warehouse.id } },
      create: {
        organizationId: actor.organizationId,
        inventoryItemId: item.id,
        warehouseId: warehouse.id,
        stock: this.toDecimal(0),
        minStock: this.toDecimal(dto.minStock),
        averageCost: this.toDecimal(dto.averageCost ?? 0)
      },
      update: {
        minStock: this.toDecimal(dto.minStock),
        ...(dto.averageCost !== undefined ? { averageCost: this.toDecimal(dto.averageCost) } : {})
      },
      include: { warehouse: { select: { id: true, name: true, branchId: true, isDefault: true } } }
    });
    await this.syncLegacyItemStock(item.id);
    await this.audit(actor, {
      entity: "InventoryStock",
      entityId: stock.id,
      action: "update_threshold",
      after: { inventoryItemId, warehouseId, minStock: dto.minStock, averageCost: dto.averageCost }
    });
    return stock;
  }

  async createInventoryProductSale(actor: AuthUser, dto: CreateInventoryProductSaleDto) {
    const item = await this.ensureInventoryItem(actor, dto.inventoryItemId);
    if (!item.isSellable) throw new BadRequestException("Inventory item is not sellable");
    if (item.branchId !== dto.branchId) throw new BadRequestException("Sale branch must match inventory item branch");
    const warehouse = dto.warehouseId
      ? await this.ensureWarehouse(actor, dto.warehouseId, dto.branchId)
      : await this.ensureDefaultWarehouse(actor, dto.branchId);
    const quantity = this.roundMoney(dto.quantity);
    const unitPrice = this.roundMoney(dto.unitPrice);
    const total = this.roundMoney(quantity * unitPrice);

    const created = await this.prisma.$transaction(async (tx) => {
      const stockRow = await this.ensureStockTx(tx, actor, item, warehouse.id);
      const currentStock = Number(stockRow.stock);
      const nextStock = this.roundMoney(currentStock - quantity);
      if (nextStock < 0) throw new BadRequestException("Insufficient stock for product sale");
      await this.updateStockTx(tx, item.id, stockRow.id, nextStock);

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          branchId: item.branchId,
          warehouseId: warehouse.id,
          type: InventoryMovementType.OUT,
          quantity: this.toDecimal(quantity),
          unitCost: item.salePrice ?? this.toDecimal(unitPrice),
          reason: dto.reason?.trim() || "Venta de producto",
          source: "SALE",
          stockBefore: this.toDecimal(currentStock),
          stockAfter: this.toDecimal(nextStock),
          patientId: dto.patientId ?? null,
          createdById: actor.id
        }
      });

      const sale = await tx.inventoryProductSale.create({
        data: {
          organizationId: actor.organizationId,
          inventoryItemId: item.id,
          branchId: item.branchId,
          warehouseId: warehouse.id,
          patientId: dto.patientId ?? null,
          quantity: this.toDecimal(quantity),
          unitPrice: this.toDecimal(unitPrice),
          total: this.toDecimal(total),
          reason: dto.reason?.trim(),
          inventoryMovementId: movement.id,
          createdById: actor.id
        }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryProductSale",
        entityId: sale.id,
        action: "create",
        before: { stock: currentStock },
        after: { stock: nextStock, total, movementId: movement.id }
      });
      return sale.id;
    });

    return this.prisma.inventoryProductSale.findUnique({
      where: { id: created },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        inventoryMovement: true
      }
    });
  }

  async listMinStockAlerts(actor: AuthUser, branchId?: string, warehouseId?: string) {
    const rows = await this.prisma.inventoryStock.findMany({
      where: {
        organizationId: actor.organizationId,
        warehouse: {
          branchId: branchScope(actor, branchId),
          ...(warehouseId ? { id: warehouseId } : {}),
          isActive: true
        },
        inventoryItem: { isActive: true }
      },
      include: {
        warehouse: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
        inventoryItem: { include: { supplier: { select: { id: true, name: true } } } }
      },
      orderBy: [{ warehouse: { branch: { name: "asc" } } }, { stock: "asc" }]
    });
    return rows.filter((row) => Number(row.stock) <= Number(row.minStock));
  }

  async getInventoryKardex(actor: AuthUser, inventoryItemId: string, warehouseId?: string) {
    await this.ensureInventoryItem(actor, inventoryItemId);
    return this.prisma.inventoryMovement.findMany({
      where: {
        inventoryItemId,
        inventoryItem: { organizationId: actor.organizationId },
        ...(warehouseId ? { warehouseId } : {})
      },
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async exportInventoryCsv(actor: AuthUser, query: ListInventoryItemsQueryDto) {
    const rows = await this.listInventoryItems(actor, query);
    const header = ["Producto", "SKU", "Categoria", "Sucursal", "Bodega", "Stock", "Minimo", "Costo promedio", "Precio venta", "Proveedor"];
    const body = rows.flatMap((row: any) =>
      this.stockRows(row).map((stock) => [
        row.name,
        row.sku,
        row.category,
        row.branch?.name ?? "",
        stock.warehouse?.name ?? "",
        Number(stock.stock),
        Number(stock.minStock),
        Number(stock.averageCost),
        row.salePrice ? Number(row.salePrice) : "",
        row.supplier?.name ?? ""
      ])
    );
    return this.toCsv([header, ...body]);
  }

  async exportInventoryMovementsCsv(actor: AuthUser, query: ListInventoryMovementsQueryDto) {
    const rows = await this.listInventoryMovements(actor, query);
    const header = ["Fecha", "Operacion", "Producto", "SKU", "Sucursal", "Bodega", "Cantidad", "Costo", "Stock antes", "Stock despues", "Detalle", "Responsable"];
    const body = rows.map((row: any) => [
      row.createdAt.toISOString(),
      row.type,
      row.inventoryItem?.name ?? "",
      row.inventoryItem?.sku ?? "",
      row.branch?.name ?? "",
      row.warehouse?.name ?? "",
      Number(row.quantity),
      row.unitCost ? Number(row.unitCost) : "",
      row.stockBefore ? Number(row.stockBefore) : "",
      row.stockAfter ? Number(row.stockAfter) : "",
      row.reason ?? "",
      row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : ""
    ]);
    return this.toCsv([header, ...body]);
  }

  private stockRows(row: { stocks?: Array<any> }) {
    return row.stocks?.length ? row.stocks : [{ stock: new Prisma.Decimal(0), minStock: new Prisma.Decimal(0), averageCost: new Prisma.Decimal(0) }];
  }

  private async ensureDefaultWarehouse(actor: AuthUser, branchId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await this.ensureBranch(actor, branchId);
    const existing = await client.inventoryWarehouse.findFirst({
      where: { organizationId: actor.organizationId, branchId, isDefault: true }
    });
    if (existing) return existing;

    const fallback = await client.inventoryWarehouse.findFirst({
      where: { organizationId: actor.organizationId, branchId },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }]
    });
    if (fallback) return fallback;

    return client.inventoryWarehouse.create({
      data: {
        organizationId: actor.organizationId,
        branchId,
        name: "Bodega central",
        description: "Bodega creada automaticamente para migrar inventario existente.",
        isDefault: true
      }
    });
  }

  private async ensureWarehouse(actor: AuthUser, warehouseId: string, branchId?: string) {
    const warehouse = await this.prisma.inventoryWarehouse.findFirst({
      where: {
        id: warehouseId,
        organizationId: actor.organizationId,
        branchId: branchId ? branchScope(actor, branchId) : branchScope(actor)
      }
    });
    if (!warehouse) throw new NotFoundException("Inventory warehouse not found");
    return warehouse;
  }

  private async ensureStockTx(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    item: { id: string; stock: Prisma.Decimal; minStock: Prisma.Decimal },
    warehouseId: string
  ) {
    const current = await tx.inventoryStock.findUnique({
      where: { inventoryItemId_warehouseId: { inventoryItemId: item.id, warehouseId } }
    });
    if (current) return current;
    return tx.inventoryStock.create({
      data: {
        organizationId: actor.organizationId,
        inventoryItemId: item.id,
        warehouseId,
        stock: item.stock,
        minStock: item.minStock,
        averageCost: this.toDecimal(0)
      }
    });
  }

  private async updateStockTx(
    tx: Prisma.TransactionClient,
    inventoryItemId: string,
    stockId: string,
    nextStock: number,
    incomingUnitCost?: number,
    incomingQuantity?: number
  ) {
    const current = await tx.inventoryStock.findUnique({ where: { id: stockId } });
    if (!current) throw new NotFoundException("Inventory stock not found");
    const data: Prisma.InventoryStockUpdateInput = { stock: this.toDecimal(nextStock) };
    if (incomingUnitCost !== undefined && incomingQuantity !== undefined) {
      const currentStock = Number(current.stock);
      const currentCost = Number(current.averageCost);
      const totalQuantity = currentStock + incomingQuantity;
      const nextAverageCost = totalQuantity > 0 ? ((currentStock * currentCost) + (incomingQuantity * incomingUnitCost)) / totalQuantity : incomingUnitCost;
      data.averageCost = this.toDecimal(nextAverageCost);
    }
    await tx.inventoryStock.update({ where: { id: stockId }, data });
    await this.syncLegacyItemStock(inventoryItemId, tx);
  }

  private async syncLegacyItemStock(inventoryItemId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const rows = await client.inventoryStock.findMany({ where: { inventoryItemId } });
    const totalStock = rows.reduce((sum, row) => sum + Number(row.stock), 0);
    const minStock = rows.reduce((sum, row) => sum + Number(row.minStock), 0);
    await client.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { stock: this.toDecimal(totalStock), minStock: this.toDecimal(minStock) }
    });
  }

  private dateRange(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return undefined;
    return {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {})
    };
  }

  private toCsv(rows: Array<Array<string | number>>) {
    return rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(",")
      )
      .join("\r\n");
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

  private toNullableDecimal(value?: string) {
    if (!value?.trim()) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException("Patient price must be zero or greater");
    return new Prisma.Decimal(this.roundMoney(parsed));
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
