import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  InventoryMovementStatus,
  InventoryMovementType,
  InventoryStockCountStatus,
  LabOrderStatus,
  Prisma
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CreateInventoryItemDto,
  CreateInventoryCategoryDto,
  CreateInventoryMovementDto,
  CreateInventoryProductSaleDto,
  CreateInventoryStockCountDto,
  CreateInventoryUnitDto,
  CreateInventoryWarehouseDto,
  CompensateInventoryMovementDto,
  CreateLabOrderDto,
  CreateLabOrderFromTreatmentDto,
  CreateLabProviderDto,
  CreateSupplierDto,
  ListInventoryCatalogQueryDto,
  ListInventoryItemsQueryDto,
  ListInventoryMovementsQueryDto,
  ListInventoryWarehousesQueryDto,
  ListLabOrdersQueryDto,
  ListLabProvidersQueryDto,
  ListSuppliersQueryDto,
  PostInventoryMovementDto,
  ReconcileInventoryStockCountDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryItemDto,
  UpdateInventoryStockDto,
  UpdateInventoryUnitDto,
  UpdateInventoryWarehouseDto,
  UpdateLabProcedureAssignmentsDto,
  UpdateLabOrderCostDto,
  UpdateLabOrderStatusDto,
  UpdateLabProviderDto,
  UpdateSupplierDto
} from "./dto/labs-inventory.dto";
import type {
  InventoryCommandContext,
  InventoryProviderPort
} from "./inventory/inventory-provider.port";

@Injectable()
export class LabsInventoryService implements InventoryProviderPort {
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
          code: dto.code?.trim().toUpperCase() || this.inventoryCode(dto.name),
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
    if (dto.tracksExpiration && !dto.tracksLots) {
      throw new BadRequestException("Expiration tracking requires lot tracking");
    }
    if (dto.categoryId) {
      const category = await this.prisma.inventoryCategory.findFirst({
        where: { id: dto.categoryId, organizationId: actor.organizationId, isActive: true },
        select: { id: true }
      });
      if (!category) throw new BadRequestException("Inventory category is not active or does not belong to the organization");
    }
    if (dto.unitId) {
      const unit = await this.prisma.inventoryUnit.findFirst({
        where: { id: dto.unitId, organizationId: actor.organizationId, isActive: true },
        select: { id: true }
      });
      if (!unit) throw new BadRequestException("Inventory unit is not active or does not belong to the organization");
    }
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
          barcode: dto.barcode?.trim() || null,
          category: dto.category.trim(),
          categoryId: dto.categoryId ?? null,
          unit: dto.unit.trim(),
          unitId: dto.unitId ?? null,
          description: dto.description?.trim() || null,
          presentation: dto.presentation?.trim() || null,
          brand: dto.brand?.trim() || null,
          manufacturer: dto.manufacturer?.trim() || null,
          stock: this.toDecimal(dto.stock),
          minStock: this.toDecimal(dto.minStock),
          salePrice: dto.salePrice !== undefined ? this.toDecimal(dto.salePrice) : null,
          isSellable: dto.isSellable ?? false,
          tracksLots: dto.tracksLots ?? false,
          tracksExpiration: dto.tracksExpiration ?? false,
          allowFractionalQuantity: dto.allowFractionalQuantity ?? false,
          branchId: dto.branchId,
          supplierId: dto.supplierId ?? null,
          createdById: actor.id,
          updatedById: actor.id
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
          organizationId: actor.organizationId,
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
          occurredAt: new Date(),
          postedAt: new Date(),
          createdById: actor.id
        }
      });

      await tx.inventoryMovementLine.create({
        data: {
          movementId: movement.id,
          inventoryItemId: item.id,
          quantity: this.toDecimal(dto.stock),
          unitCost: this.toDecimal(dto.averageCost ?? 0),
          totalCost: this.toDecimal(dto.stock * (dto.averageCost ?? 0)),
          stockBefore: this.toDecimal(0),
          stockAfter: this.toDecimal(dto.stock),
          averageCostBefore: this.toDecimal(0),
          averageCostAfter: this.toDecimal(dto.averageCost ?? 0),
          notes: "Initial stock"
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
    if (dto.version !== undefined && dto.version !== current.version) {
      throw new ConflictException("Inventory item was modified by another user");
    }
    const resultingTracksLots = dto.tracksLots ?? current.tracksLots;
    const resultingTracksExpiration = dto.tracksExpiration ?? current.tracksExpiration;
    if (resultingTracksExpiration && !resultingTracksLots) {
      throw new BadRequestException("Expiration tracking requires lot tracking");
    }
    if (dto.categoryId) {
      const category = await this.prisma.inventoryCategory.findFirst({
        where: { id: dto.categoryId, organizationId: actor.organizationId, isActive: true },
        select: { id: true }
      });
      if (!category) throw new BadRequestException("Inventory category is not active or does not belong to the organization");
    }
    if (dto.unitId) {
      const unit = await this.prisma.inventoryUnit.findFirst({
        where: { id: dto.unitId, organizationId: actor.organizationId, isActive: true },
        select: { id: true }
      });
      if (!unit) throw new BadRequestException("Inventory unit is not active or does not belong to the organization");
    }

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
      where: { id, ...(dto.version !== undefined ? { version: dto.version } : {}) },
      data: {
        name: dto.name?.trim(),
        sku: dto.sku?.trim(),
        category: dto.category?.trim(),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        unit: dto.unit?.trim(),
        ...(dto.unitId !== undefined ? { unitId: dto.unitId || null } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.presentation !== undefined ? { presentation: dto.presentation?.trim() || null } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand?.trim() || null } : {}),
        ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer?.trim() || null } : {}),
        ...(dto.minStock !== undefined ? { minStock: this.toDecimal(dto.minStock) } : {}),
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice === null ? null : this.toDecimal(dto.salePrice) } : {}),
        ...(typeof dto.isSellable === "boolean" ? { isSellable: dto.isSellable } : {}),
        ...(typeof dto.tracksLots === "boolean" ? { tracksLots: dto.tracksLots } : {}),
        ...(typeof dto.tracksExpiration === "boolean" ? { tracksExpiration: dto.tracksExpiration } : {}),
        ...(typeof dto.allowFractionalQuantity === "boolean"
          ? { allowFractionalQuantity: dto.allowFractionalQuantity }
          : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId || null } : {}),
        ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {}),
        updatedById: actor.id,
        version: { increment: 1 }
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
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: actor.id,
        updatedById: actor.id,
        version: { increment: 1 }
      }
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
      await this.lockStockTx(tx, actor.organizationId, warehouse.id, item.id);
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
          organizationId: actor.organizationId,
          inventoryItemId: item.id,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          type: dto.type,
          quantity: this.toDecimal(quantity),
          unitCost: dto.unitCost !== undefined ? this.toDecimal(dto.unitCost) : null,
          reason: dto.reason?.trim(),
          source: "MANUAL",
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          postedAt: new Date(),
          sourceWarehouseId: dto.type === InventoryMovementType.OUT ? warehouse.id : null,
          destinationWarehouseId: dto.type === InventoryMovementType.OUT ? null : warehouse.id,
          stockBefore: this.toDecimal(currentStock),
          stockAfter: this.toDecimal(nextStock),
          createdById: actor.id
        }
      });

      const updatedStock = await tx.inventoryStock.findUniqueOrThrow({ where: { id: stockRow.id } });
      await tx.inventoryMovementLine.create({
        data: {
          movementId: movement.id,
          inventoryItemId: item.id,
          quantity: this.toDecimal(quantity),
          unitCost: this.toDecimal(dto.unitCost ?? Number(stockRow.averageCost)),
          totalCost: this.toDecimal(quantity * (dto.unitCost ?? Number(stockRow.averageCost))),
          stockBefore: this.toDecimal(currentStock),
          stockAfter: this.toDecimal(nextStock),
          averageCostBefore: stockRow.averageCost,
          averageCostAfter: updatedStock.averageCost,
          notes: dto.reason?.trim()
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
      await this.lockStockTx(tx, actor.organizationId, warehouse.id, item.id);
      const stockRow = await this.ensureStockTx(tx, actor, item, warehouse.id);
      const currentStock = Number(stockRow.stock);
      const nextStock = this.roundMoney(currentStock - quantity);
      if (nextStock < 0) throw new BadRequestException("Insufficient stock for product sale");
      await this.updateStockTx(tx, item.id, stockRow.id, nextStock);

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: actor.organizationId,
          inventoryItemId: item.id,
          branchId: item.branchId,
          warehouseId: warehouse.id,
          type: InventoryMovementType.OUT,
          quantity: this.toDecimal(quantity),
          unitCost: item.salePrice ?? this.toDecimal(unitPrice),
          reason: dto.reason?.trim() || "Venta de producto",
          source: "SALE",
          occurredAt: new Date(),
          postedAt: new Date(),
          sourceWarehouseId: warehouse.id,
          stockBefore: this.toDecimal(currentStock),
          stockAfter: this.toDecimal(nextStock),
          patientId: dto.patientId ?? null,
          createdById: actor.id
        }
      });

      await tx.inventoryMovementLine.create({
        data: {
          movementId: movement.id,
          inventoryItemId: item.id,
          quantity: this.toDecimal(quantity),
          unitCost: stockRow.averageCost,
          salePriceSnapshot: this.toDecimal(unitPrice),
          totalCost: this.toDecimal(quantity * Number(stockRow.averageCost)),
          stockBefore: this.toDecimal(currentStock),
          stockAfter: this.toDecimal(nextStock),
          averageCostBefore: stockRow.averageCost,
          averageCostAfter: stockRow.averageCost,
          notes: dto.reason?.trim()
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
    const body = rows.flatMap((row) =>
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
    const body = rows.map((row) => [
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

  async getInventoryProductDetails(actor: AuthUser, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        categoryRef: true,
        unitRef: true,
        stocks: {
          include: { warehouse: { select: { id: true, code: true, name: true, branchId: true } } },
          orderBy: { warehouse: { name: "asc" } }
        },
        lots: {
          include: { warehouse: { select: { id: true, name: true } } },
          orderBy: [{ expirationDate: "asc" }, { receivedAt: "asc" }]
        },
        movements: {
          include: {
            warehouse: { select: { id: true, name: true } },
            sourceWarehouse: { select: { id: true, name: true } },
            destinationWarehouse: { select: { id: true, name: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            lines: true
          },
          orderBy: { occurredAt: "desc" },
          take: 100
        }
      }
    });
    if (!item) throw new NotFoundException({ code: "INVENTORY_PRODUCT_NOT_FOUND", message: "Inventory product not found" });
    const audit = await this.prisma.auditLog.findMany({
      where: { organizationId: actor.organizationId, entityId: id, entity: { in: ["InventoryItem", "InventoryStock"] } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return { ...item, audit };
  }

  async listInventoryCategories(actor: AuthUser, query: ListInventoryCatalogQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.inventoryCategory.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
        ...(query.active === "true" ? { isActive: true } : {}),
        ...(query.active === "false" ? { isActive: false } : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createInventoryCategory(actor: AuthUser, dto: CreateInventoryCategoryDto) {
    const duplicate = await this.prisma.inventoryCategory.findFirst({
      where: { organizationId: actor.organizationId, name: { equals: dto.name.trim(), mode: "insensitive" } }
    });
    if (duplicate) {
      throw new ConflictException({ code: "INVENTORY_DUPLICATE_CATEGORY", message: "Inventory category already exists", field: "name" });
    }
    const category = await this.prisma.inventoryCategory.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        createdById: actor.id,
        updatedById: actor.id
      }
    });
    await this.audit(actor, {
      entity: "InventoryCategory",
      entityId: category.id,
      action: "create",
      after: { name: category.name }
    });
    return category;
  }

  async updateInventoryCategory(actor: AuthUser, id: string, dto: UpdateInventoryCategoryDto) {
    const current = await this.prisma.inventoryCategory.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException({ code: "INVENTORY_CATEGORY_NOT_FOUND", message: "Inventory category not found" });
    const updated = await this.prisma.inventoryCategory.updateMany({
      where: { id, organizationId: actor.organizationId, version: dto.version },
      data: {
        name: dto.name?.trim(),
        description: dto.description === null ? null : dto.description?.trim(),
        ...(typeof dto.isActive === "boolean" ? { isActive: dto.isActive } : {}),
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    if (updated.count !== 1) {
      throw new ConflictException({ code: "INVENTORY_CONCURRENCY_CONFLICT", message: "Category was changed by another user" });
    }
    const result = await this.prisma.inventoryCategory.findUniqueOrThrow({ where: { id } });
    await this.audit(actor, {
      entity: "InventoryCategory",
      entityId: id,
      action: "update",
      before: { name: current.name, isActive: current.isActive, version: current.version },
      after: { name: result.name, isActive: result.isActive, version: result.version }
    });
    return result;
  }

  async listInventoryUnits(actor: AuthUser, query: ListInventoryCatalogQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.inventoryUnit.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
                { abbreviation: { contains: query.search, mode: "insensitive" } }
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

  async createInventoryUnit(actor: AuthUser, dto: CreateInventoryUnitDto) {
    const duplicate = await this.prisma.inventoryUnit.findFirst({
      where: {
        organizationId: actor.organizationId,
        OR: [
          { code: { equals: dto.code.trim(), mode: "insensitive" } },
          { name: { equals: dto.name.trim(), mode: "insensitive" } }
        ]
      }
    });
    if (duplicate) {
      throw new ConflictException({ code: "INVENTORY_DUPLICATE_UNIT", message: "Inventory unit already exists" });
    }
    const unit = await this.prisma.inventoryUnit.create({
      data: {
        organizationId: actor.organizationId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        abbreviation: dto.abbreviation.trim(),
        decimalAllowed: dto.decimalAllowed ?? false,
        precision: dto.precision ?? 0
      }
    });
    await this.audit(actor, {
      entity: "InventoryUnit",
      entityId: unit.id,
      action: "create",
      after: { code: unit.code, name: unit.name }
    });
    return unit;
  }

  async updateInventoryUnit(actor: AuthUser, id: string, dto: UpdateInventoryUnitDto) {
    const current = await this.prisma.inventoryUnit.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Inventory unit not found");
    if (current.version !== dto.version) {
      throw new ConflictException("Inventory unit was modified by another user");
    }
    if (dto.code && dto.code.trim().toUpperCase() !== current.code) {
      const duplicate = await this.prisma.inventoryUnit.findFirst({
        where: {
          organizationId: actor.organizationId,
          code: dto.code.trim().toUpperCase(),
          id: { not: id }
        },
        select: { id: true }
      });
      if (duplicate) throw new ConflictException("Inventory unit code already exists");
    }
    return this.prisma.inventoryUnit.update({
      where: { id, version: dto.version },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.abbreviation !== undefined ? { abbreviation: dto.abbreviation.trim() } : {}),
        ...(dto.decimalAllowed !== undefined ? { decimalAllowed: dto.decimalAllowed } : {}),
        ...(dto.precision !== undefined ? { precision: dto.precision } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        version: { increment: 1 },
        updatedById: actor.id
      }
    });
  }

  async reactivateInventoryItem(actor: AuthUser, id: string) {
    const current = await this.ensureInventoryItem(actor, id);
    if (current.isActive) return current;
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivatedById: null,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(actor, {
      entity: "InventoryItem",
      entityId: id,
      action: "reactivate",
      before: { isActive: false },
      after: { isActive: true }
    });
    return updated;
  }

  async postInventoryMovement(
    actor: AuthUser,
    type: InventoryMovementType,
    dto: PostInventoryMovementDto,
    context: InventoryCommandContext
  ) {
    const inboundTypes = new Set<InventoryMovementType>([
      InventoryMovementType.IN,
      InventoryMovementType.ENTRY,
      InventoryMovementType.RETURN_IN,
      InventoryMovementType.INITIAL_BALANCE,
      InventoryMovementType.POSITIVE_ADJUSTMENT
    ]);
    const outboundTypes = new Set<InventoryMovementType>([
      InventoryMovementType.OUT,
      InventoryMovementType.EXIT,
      InventoryMovementType.WASTE,
      InventoryMovementType.SUPPLIER_RETURN,
      InventoryMovementType.NEGATIVE_ADJUSTMENT
    ]);
    const isTransfer = type === InventoryMovementType.TRANSFER;
    if (!inboundTypes.has(type) && !outboundTypes.has(type) && !isTransfer) {
      throw new BadRequestException({ code: "INVENTORY_INVALID_MOVEMENT_TYPE", message: "Movement type is not supported by this command" });
    }
    if (!dto.lines.length) {
      throw new BadRequestException({ code: "INVENTORY_MOVEMENT_LINES_REQUIRED", message: "At least one movement line is required" });
    }

    await this.ensureBranch(actor, dto.branchId);
    const sourceWarehouse =
      outboundTypes.has(type) || isTransfer
        ? await this.ensureWarehouseRequired(actor, dto.sourceWarehouseId, dto.branchId, "sourceWarehouseId")
        : null;
    const destinationWarehouse =
      inboundTypes.has(type) || isTransfer
        ? await this.ensureWarehouseRequired(actor, dto.destinationWarehouseId, dto.branchId, "destinationWarehouseId")
        : null;
    if (isTransfer && sourceWarehouse?.id === destinationWarehouse?.id) {
      throw new BadRequestException({ code: "INVENTORY_TRANSFER_SAME_WAREHOUSE", message: "Source and destination warehouses must be different" });
    }
    if (dto.supplierId) await this.ensureSupplier(actor, dto.supplierId);

    const itemIds = [...new Set(dto.lines.map((line) => line.inventoryItemId))];
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        id: { in: itemIds },
        organizationId: actor.organizationId,
        branchId: branchScope(actor, dto.branchId),
        isActive: true
      }
    });
    if (items.length !== itemIds.length) {
      throw new BadRequestException({ code: "INVENTORY_PRODUCT_INACTIVE", message: "One or more products are unavailable in this branch" });
    }
    const itemMap = new Map(items.map((item) => [item.id, item]));
    for (const line of dto.lines) {
      const item = itemMap.get(line.inventoryItemId)!;
      if (!item.allowFractionalQuantity && !Number.isInteger(line.quantity)) {
        throw new BadRequestException({
          code: "INVENTORY_INVALID_QUANTITY",
          message: `${item.name} does not allow fractional quantities`,
          field: "quantity"
        });
      }
      if (item.tracksLots && !line.lotNumber && inboundTypes.has(type)) {
        throw new BadRequestException({ code: "INVENTORY_LOT_REQUIRED", message: `Lot is required for ${item.name}` });
      }
      if (item.tracksExpiration && !line.expirationDate && inboundTypes.has(type)) {
        throw new BadRequestException({ code: "INVENTORY_EXPIRATION_REQUIRED", message: `Expiration date is required for ${item.name}` });
      }
    }

    const idempotencyKey = context.idempotencyKey?.trim();
    const correlationId = context.correlationId?.trim() || randomUUID();
    const movementId = await this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.organizationId}:inventory:${idempotencyKey}`}))`;
        const existing = await tx.inventoryMovement.findFirst({
          where: { organizationId: actor.organizationId, idempotencyKey }
        });
        if (existing) return existing.id;
      }

      const lockKeys = dto.lines.flatMap((line) => [
        ...(sourceWarehouse ? [`${sourceWarehouse.id}:${line.inventoryItemId}`] : []),
        ...(destinationWarehouse ? [`${destinationWarehouse.id}:${line.inventoryItemId}`] : [])
      ]);
      for (const key of [...new Set(lockKeys)].sort()) {
        const [warehouseId, inventoryItemId] = key.split(":");
        await this.lockStockTx(tx, actor.organizationId, warehouseId, inventoryItemId);
      }

      const lineRecords: Prisma.InventoryMovementLineCreateWithoutMovementInput[] = [];
      for (const input of dto.lines) {
        const item = itemMap.get(input.inventoryItemId)!;
        const quantity = this.roundQuantity(input.quantity);
        const sourceStock = sourceWarehouse
          ? await this.ensureStockTx(tx, actor, item, sourceWarehouse.id)
          : null;
        const destinationStock = destinationWarehouse
          ? await this.ensureStockTx(tx, actor, item, destinationWarehouse.id)
          : null;
        const sourceBefore = sourceStock ? Number(sourceStock.stock) : 0;
        const destinationBefore = destinationStock ? Number(destinationStock.stock) : 0;
        const available = sourceStock ? sourceBefore - Number(sourceStock.reservedStock) : 0;
        if (sourceStock && available < quantity) {
          throw new BadRequestException({
            code: "INVENTORY_INSUFFICIENT_STOCK",
            message: `Insufficient available stock for ${item.name}`,
            details: { available, requested: quantity }
          });
        }

        const unitCost =
          input.unitCost !== undefined
            ? this.roundMoney(input.unitCost)
            : Number(sourceStock?.averageCost ?? destinationStock?.averageCost ?? 0);
        const sourceAfter = sourceStock ? this.roundQuantity(sourceBefore - quantity) : 0;
        const destinationAfter = destinationStock ? this.roundQuantity(destinationBefore + quantity) : 0;
        if (sourceStock) {
          await this.updateStockTx(tx, item.id, sourceStock.id, sourceAfter);
        }
        if (destinationStock) {
          await this.updateStockTx(tx, item.id, destinationStock.id, destinationAfter, unitCost, quantity);
        }

        const lotSegments = item.tracksLots
          ? await this.applyLotMovementTx(
              tx,
              actor,
              item,
              sourceWarehouse?.id,
              destinationWarehouse?.id,
              input,
              quantity,
              unitCost
            )
          : [{ sourceLotId: null, destinationLotId: null, lotNumber: null, expirationDate: null, quantity }];

        for (const segment of lotSegments) {
          lineRecords.push({
            inventoryItem: { connect: { id: item.id } },
            sourceLot: segment.sourceLotId ? { connect: { id: segment.sourceLotId } } : undefined,
            destinationLot: segment.destinationLotId ? { connect: { id: segment.destinationLotId } } : undefined,
            lotNumberSnapshot: segment.lotNumber,
            expirationSnapshot: segment.expirationDate,
            quantity: this.toDecimal(segment.quantity),
            unitCost: this.toDecimal(unitCost),
            salePriceSnapshot: item.salePrice,
            totalCost: this.toDecimal(segment.quantity * unitCost),
            stockBefore: this.toDecimal(sourceStock ? sourceBefore : destinationBefore),
            stockAfter: this.toDecimal(sourceStock ? sourceAfter : destinationAfter),
            averageCostBefore: sourceStock?.averageCost ?? destinationStock?.averageCost ?? this.toDecimal(0),
            averageCostAfter: destinationStock
              ? (await tx.inventoryStock.findUniqueOrThrow({ where: { id: destinationStock.id } })).averageCost
              : sourceStock?.averageCost ?? this.toDecimal(0),
            notes: input.notes?.trim()
          });
        }
      }

      const firstItem = items.find((item) => item.id === dto.lines[0].inventoryItemId)!;
      const totalQuantity = dto.lines.reduce((sum, line) => sum + line.quantity, 0);
      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: actor.organizationId,
          inventoryItemId: firstItem.id,
          branchId: dto.branchId,
          warehouseId: sourceWarehouse?.id ?? destinationWarehouse?.id,
          sourceWarehouseId: sourceWarehouse?.id,
          destinationWarehouseId: destinationWarehouse?.id,
          type,
          status: InventoryMovementStatus.POSTED,
          quantity: this.toDecimal(totalQuantity),
          unitCost: dto.lines.length === 1 ? this.toDecimal(dto.lines[0].unitCost ?? 0) : null,
          source: "MANUAL",
          reason: dto.reason.trim(),
          notes: dto.notes?.trim(),
          supplierId: dto.supplierId,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          documentDate: dto.documentDate ? new Date(dto.documentDate) : null,
          documentType: dto.documentType?.trim(),
          documentNumber: dto.documentNumber?.trim(),
          reference: dto.reference?.trim(),
          idempotencyKey,
          correlationId,
          postedAt: new Date(),
          createdById: actor.id,
          lines: { create: lineRecords }
        }
      });

      await this.auditTx(tx, actor, {
        entity: "InventoryMovement",
        entityId: movement.id,
        action: "post",
        after: {
          type,
          branchId: dto.branchId,
          sourceWarehouseId: sourceWarehouse?.id,
          destinationWarehouseId: destinationWarehouse?.id,
          lineCount: lineRecords.length,
          correlationId
        }
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: actor.organizationId,
          aggregateType: "InventoryMovement",
          aggregateId: movement.id,
          eventType: type === InventoryMovementType.TRANSFER ? "inventory.transfer.completed" : "inventory.movement.posted",
          payload: {
            movementId: movement.id,
            type,
            branchId: dto.branchId,
            sourceWarehouseId: sourceWarehouse?.id ?? null,
            destinationWarehouseId: destinationWarehouse?.id ?? null
          },
          correlationId,
          idempotencyKey: idempotencyKey ? `inventory:${idempotencyKey}` : undefined
        }
      });
      return movement.id;
    });

    return this.prisma.inventoryMovement.findUnique({
      where: { id: movementId },
      include: {
        lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } },
        sourceWarehouse: { select: { id: true, name: true } },
        destinationWarehouse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  async compensateInventoryMovement(
    actor: AuthUser,
    id: string,
    dto: CompensateInventoryMovementDto,
    context: InventoryCommandContext
  ) {
    const original = await this.prisma.inventoryMovement.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor), status: InventoryMovementStatus.POSTED },
      include: { lines: true }
    });
    if (!original) {
      throw new NotFoundException({ code: "INVENTORY_MOVEMENT_NOT_FOUND", message: "Posted inventory movement not found" });
    }
    const priorCompensation = await this.prisma.inventoryMovement.findFirst({
      where: { reversalOfMovementId: id, status: InventoryMovementStatus.POSTED }
    });
    if (priorCompensation) {
      throw new ConflictException({ code: "INVENTORY_MOVEMENT_ALREADY_COMPENSATED", message: "Movement already has a compensation" });
    }

    const inbound = new Set<InventoryMovementType>([
      InventoryMovementType.IN,
      InventoryMovementType.ENTRY,
      InventoryMovementType.RETURN_IN,
      InventoryMovementType.INITIAL_BALANCE,
      InventoryMovementType.POSITIVE_ADJUSTMENT
    ]);
    const compensationType =
      original.type === InventoryMovementType.TRANSFER
        ? InventoryMovementType.TRANSFER
        : inbound.has(original.type)
          ? InventoryMovementType.EXIT
          : InventoryMovementType.RETURN_IN;
    const compensated = await this.postInventoryMovement(
      actor,
      compensationType,
      {
        branchId: original.branchId,
        sourceWarehouseId:
          original.type === InventoryMovementType.TRANSFER
            ? original.destinationWarehouseId ?? undefined
            : inbound.has(original.type)
              ? original.destinationWarehouseId ?? original.warehouseId ?? undefined
              : undefined,
        destinationWarehouseId:
          original.type === InventoryMovementType.TRANSFER
            ? original.sourceWarehouseId ?? undefined
            : inbound.has(original.type)
              ? undefined
              : original.sourceWarehouseId ?? original.warehouseId ?? undefined,
        reason: dto.reason,
        reference: `Compensation of ${original.id}`,
        lines: original.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          lotNumber: line.lotNumberSnapshot ?? undefined,
          expirationDate: line.expirationSnapshot?.toISOString()
        }))
      },
      context
    );
    if (compensated && typeof compensated === "object" && "id" in compensated) {
      await this.prisma.inventoryMovement.update({
        where: { id: String(compensated.id) },
        data: { reversalOfMovementId: original.id, type: InventoryMovementType.COMPENSATION }
      });
    }
    return compensated;
  }

  async createInventoryStockCount(actor: AuthUser, dto: CreateInventoryStockCountDto) {
    const warehouse = await this.ensureWarehouse(actor, dto.warehouseId, dto.branchId);
    const itemIds = [...new Set(dto.lines.map((line) => line.inventoryItemId))];
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, organizationId: actor.organizationId, branchId: branchScope(actor, dto.branchId) }
    });
    if (items.length !== itemIds.length) {
      throw new BadRequestException({ code: "INVENTORY_PRODUCT_NOT_FOUND", message: "One or more count products were not found" });
    }
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.inventoryStockCount.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          notes: dto.notes?.trim(),
          createdById: actor.id
        }
      });
      for (const line of dto.lines) {
        const item = items.find((candidate) => candidate.id === line.inventoryItemId)!;
        const stock = await this.ensureStockTx(tx, actor, item, warehouse.id);
        const counted = line.countedQuantity;
        await tx.inventoryStockCountLine.create({
          data: {
            stockCountId: count.id,
            inventoryItemId: item.id,
            systemQuantity: stock.stock,
            countedQuantity: counted !== undefined ? this.toDecimal(counted) : null,
            difference: counted !== undefined ? this.toDecimal(counted - Number(stock.stock)) : null,
            notes: line.notes?.trim()
          }
        });
      }
      await this.auditTx(tx, actor, {
        entity: "InventoryStockCount",
        entityId: count.id,
        action: "create",
        after: { branchId: dto.branchId, warehouseId: warehouse.id, lineCount: dto.lines.length }
      });
      return tx.inventoryStockCount.findUniqueOrThrow({ where: { id: count.id }, include: { lines: true } });
    });
  }

  async reconcileInventoryStockCount(
    actor: AuthUser,
    id: string,
    dto: ReconcileInventoryStockCountDto,
    context: InventoryCommandContext
  ) {
    const count = await this.prisma.inventoryStockCount.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: { lines: { include: { inventoryItem: true } } }
    });
    if (!count) throw new NotFoundException({ code: "INVENTORY_STOCK_COUNT_NOT_FOUND", message: "Stock count not found" });
    if (count.status === InventoryStockCountStatus.RECONCILED) {
      throw new ConflictException({ code: "INVENTORY_STOCK_COUNT_RECONCILED", message: "Stock count is already reconciled" });
    }
    const overrides = new Map(dto.lines?.map((line) => [line.inventoryItemId, line]) ?? []);
    const correlationId = context.correlationId?.trim() || randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.inventoryStockCount.updateMany({
        where: { id, version: dto.version, status: { in: [InventoryStockCountStatus.DRAFT, InventoryStockCountStatus.COUNTED] } },
        data: { status: InventoryStockCountStatus.COUNTED, version: { increment: 1 } }
      });
      if (locked.count !== 1) {
        throw new ConflictException({ code: "INVENTORY_CONCURRENCY_CONFLICT", message: "Stock count was changed by another user" });
      }

      for (const line of count.lines) {
        const override = overrides.get(line.inventoryItemId);
        const counted = override?.countedQuantity ?? (line.countedQuantity === null ? undefined : Number(line.countedQuantity));
        if (counted === undefined) {
          throw new BadRequestException({ code: "INVENTORY_COUNT_INCOMPLETE", message: `Missing count for ${line.inventoryItem.name}` });
        }
        await this.lockStockTx(tx, actor.organizationId, count.warehouseId, line.inventoryItemId);
        const stock = await this.ensureStockTx(tx, actor, line.inventoryItem, count.warehouseId);
        const before = Number(stock.stock);
        const difference = this.roundQuantity(counted - before);
        let resultingMovementId: string | null = null;
        if (difference !== 0) {
          await this.updateStockTx(tx, line.inventoryItemId, stock.id, counted);
          const movement = await tx.inventoryMovement.create({
            data: {
              organizationId: actor.organizationId,
              inventoryItemId: line.inventoryItemId,
              branchId: count.branchId,
              warehouseId: count.warehouseId,
              sourceWarehouseId: difference < 0 ? count.warehouseId : null,
              destinationWarehouseId: difference > 0 ? count.warehouseId : null,
              type: InventoryMovementType.PHYSICAL_COUNT_ADJUSTMENT,
              status: InventoryMovementStatus.POSTED,
              quantity: this.toDecimal(Math.abs(difference)),
              reason: `Conciliacion de conteo fisico ${count.id}`,
              source: "PHYSICAL_COUNT",
              occurredAt: new Date(),
              postedAt: new Date(),
              correlationId,
              idempotencyKey: context.idempotencyKey ? `${context.idempotencyKey}:${line.inventoryItemId}` : null,
              stockBefore: this.toDecimal(before),
              stockAfter: this.toDecimal(counted),
              createdById: actor.id,
              lines: {
                create: {
                  inventoryItemId: line.inventoryItemId,
                  quantity: this.toDecimal(Math.abs(difference)),
                  unitCost: stock.averageCost,
                  totalCost: this.toDecimal(Math.abs(difference) * Number(stock.averageCost)),
                  stockBefore: this.toDecimal(before),
                  stockAfter: this.toDecimal(counted),
                  averageCostBefore: stock.averageCost,
                  averageCostAfter: stock.averageCost
                }
              }
            }
          });
          resultingMovementId = movement.id;
        }
        await tx.inventoryStockCountLine.update({
          where: { id: line.id },
          data: {
            countedQuantity: this.toDecimal(counted),
            difference: this.toDecimal(difference),
            resultingMovementId,
            notes: override?.notes?.trim() ?? line.notes
          }
        });
      }

      const reconciled = await tx.inventoryStockCount.update({
        where: { id },
        data: {
          status: InventoryStockCountStatus.RECONCILED,
          countedAt: new Date(),
          approvedAt: new Date(),
          approvedById: actor.id,
          version: { increment: 1 }
        },
        include: { lines: true }
      });
      await this.auditTx(tx, actor, {
        entity: "InventoryStockCount",
        entityId: id,
        action: "reconcile",
        after: { warehouseId: count.warehouseId, lineCount: count.lines.length, correlationId }
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: actor.organizationId,
          aggregateType: "InventoryStockCount",
          aggregateId: id,
          eventType: "inventory.stock_count.reconciled",
          payload: { stockCountId: id, warehouseId: count.warehouseId },
          correlationId,
          idempotencyKey: context.idempotencyKey ? `inventory-count:${context.idempotencyKey}` : undefined
        }
      });
      return reconciled;
    });
  }

  async exportInventorySpecialReport(
    actor: AuthUser,
    kind: "critical" | "valuation" | "waste" | "expiring",
    query: ListInventoryItemsQueryDto
  ) {
    if (kind === "critical") {
      const rows = await this.listMinStockAlerts(actor, query.branchId, query.warehouseId);
      return this.toCsv([
        ["Producto", "SKU", "Sucursal", "Bodega", "Stock actual", "Stock seguridad", "Diferencia", "Estado"],
        ...rows.map((row) => {
          const current = Number(row.stock);
          const safety = Number(row.minStock);
          return [
            row.inventoryItem.name,
            row.inventoryItem.sku,
            row.warehouse.branch.name,
            row.warehouse.name,
            current,
            safety,
            current - safety,
            current <= 0 ? "AGOTADO" : "CRITICO"
          ];
        })
      ]);
    }
    if (kind === "valuation") {
      const rows = await this.listInventoryItems(actor, query);
      return this.toCsv([
        ["Producto", "SKU", "Bodega", "Cantidad", "Costo promedio", "Valor"],
        ...rows.flatMap((row) =>
          this.stockRows(row).map((stock) => [
            row.name,
            row.sku,
            stock.warehouse?.name ?? "",
            Number(stock.stock),
            Number(stock.averageCost),
            this.roundMoney(Number(stock.stock) * Number(stock.averageCost))
          ])
        )
      ]);
    }
    if (kind === "waste") {
      const rows = await this.prisma.inventoryMovement.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: branchScope(actor, query.branchId),
          type: InventoryMovementType.WASTE,
          ...(query.warehouseId ? { sourceWarehouseId: query.warehouseId } : {})
        },
        include: { lines: { include: { inventoryItem: true } }, sourceWarehouse: true },
        orderBy: { occurredAt: "desc" }
      });
      return this.toCsv([
        ["Fecha", "Producto", "SKU", "Bodega", "Cantidad", "Costo", "Motivo"],
        ...rows.flatMap((movement) =>
          movement.lines.map((line) => [
            movement.occurredAt.toISOString(),
            line.inventoryItem.name,
            line.inventoryItem.sku,
            movement.sourceWarehouse?.name ?? "",
            Number(line.quantity),
            Number(line.totalCost),
            movement.reason ?? ""
          ])
        )
      ]);
    }
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        organizationId: actor.organizationId,
        warehouse: { branchId: branchScope(actor, query.branchId) },
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        expirationDate: { not: null }
      },
      include: { inventoryItem: true, warehouse: { include: { branch: true } } },
      orderBy: { expirationDate: "asc" }
    });
    return this.toCsv([
      ["Producto", "SKU", "Sucursal", "Bodega", "Lote", "Caducidad", "Existencia", "Estado"],
      ...lots.map((lot) => [
        lot.inventoryItem.name,
        lot.inventoryItem.sku,
        lot.warehouse.branch.name,
        lot.warehouse.name,
        lot.lotNumber,
        lot.expirationDate?.toISOString().slice(0, 10) ?? "",
        Number(lot.stock),
        lot.status
      ])
    ]);
  }

  private async ensureWarehouseRequired(
    actor: AuthUser,
    warehouseId: string | undefined,
    branchId: string,
    field: string
  ) {
    if (!warehouseId) {
      throw new BadRequestException({
        code: "INVENTORY_WAREHOUSE_REQUIRED",
        message: "Warehouse is required for this movement",
        field
      });
    }
    return this.ensureWarehouse(actor, warehouseId, branchId);
  }

  private async applyLotMovementTx(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    item: {
      id: string;
      name: string;
      tracksExpiration: boolean;
    },
    sourceWarehouseId: string | undefined,
    destinationWarehouseId: string | undefined,
    input: PostInventoryMovementDto["lines"][number],
    quantity: number,
    unitCost: number
  ) {
    type LotSegment = {
      sourceLotId: string | null;
      destinationLotId: string | null;
      lotNumber: string | null;
      expirationDate: Date | null;
      quantity: number;
    };
    const segments: LotSegment[] = [];

    if (!sourceWarehouseId) {
      if (!input.lotNumber) {
        throw new BadRequestException({ code: "INVENTORY_LOT_REQUIRED", message: `Lot is required for ${item.name}` });
      }
      const expirationDate = input.expirationDate ? new Date(input.expirationDate) : null;
      if (item.tracksExpiration && !expirationDate) {
        throw new BadRequestException({ code: "INVENTORY_EXPIRATION_REQUIRED", message: `Expiration date is required for ${item.name}` });
      }
      const existing = await tx.inventoryLot.findUnique({
        where: {
          warehouseId_inventoryItemId_lotNumber: {
            warehouseId: destinationWarehouseId!,
            inventoryItemId: item.id,
            lotNumber: input.lotNumber.trim()
          }
        }
      });
      const currentQuantity = Number(existing?.stock ?? 0);
      const currentCost = Number(existing?.averageCost ?? 0);
      const nextAverageCost =
        currentQuantity + quantity > 0
          ? (currentQuantity * currentCost + quantity * unitCost) / (currentQuantity + quantity)
          : unitCost;
      const destinationLot = await tx.inventoryLot.upsert({
        where: {
          warehouseId_inventoryItemId_lotNumber: {
            warehouseId: destinationWarehouseId!,
            inventoryItemId: item.id,
            lotNumber: input.lotNumber.trim()
          }
        },
        create: {
          organizationId: actor.organizationId,
          warehouseId: destinationWarehouseId!,
          inventoryItemId: item.id,
          lotNumber: input.lotNumber.trim(),
          expirationDate,
          stock: this.toDecimal(quantity),
          averageCost: this.toDecimal(unitCost)
        },
        update: {
          stock: { increment: this.toDecimal(quantity) },
          averageCost: this.toDecimal(nextAverageCost),
          expirationDate: expirationDate ?? undefined,
          status: "ACTIVE",
          version: { increment: 1 }
        }
      });
      return [
        {
          sourceLotId: null,
          destinationLotId: destinationLot.id,
          lotNumber: destinationLot.lotNumber,
          expirationDate: destinationLot.expirationDate,
          quantity
        }
      ];
    }

    const sourceLots = await tx.inventoryLot.findMany({
      where: {
        organizationId: actor.organizationId,
        warehouseId: sourceWarehouseId,
        inventoryItemId: item.id,
        stock: { gt: 0 },
        status: "ACTIVE",
        ...(input.lotNumber ? { lotNumber: input.lotNumber.trim() } : {})
      },
      orderBy: [{ expirationDate: "asc" }, { receivedAt: "asc" }]
    });
    let remaining = quantity;
    for (const lot of sourceLots) {
      if (remaining <= 0) break;
      if (lot.expirationDate && lot.expirationDate.getTime() < Date.now()) {
        if (input.lotNumber) {
          throw new BadRequestException({ code: "INVENTORY_LOT_EXPIRED", message: `Lot ${lot.lotNumber} is expired` });
        }
        continue;
      }
      const consumed = Math.min(remaining, Number(lot.stock));
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          stock: { decrement: this.toDecimal(consumed) },
          status: Number(lot.stock) - consumed <= 0 ? "DEPLETED" : "ACTIVE",
          version: { increment: 1 }
        }
      });

      let destinationLotId: string | null = null;
      if (destinationWarehouseId) {
        const destinationLot = await tx.inventoryLot.upsert({
          where: {
            warehouseId_inventoryItemId_lotNumber: {
              warehouseId: destinationWarehouseId,
              inventoryItemId: item.id,
              lotNumber: lot.lotNumber
            }
          },
          create: {
            organizationId: actor.organizationId,
            warehouseId: destinationWarehouseId,
            inventoryItemId: item.id,
            lotNumber: lot.lotNumber,
            expirationDate: lot.expirationDate,
            stock: this.toDecimal(consumed),
            averageCost: this.toDecimal(unitCost)
          },
          update: {
            stock: { increment: this.toDecimal(consumed) },
            expirationDate: lot.expirationDate,
            status: "ACTIVE",
            version: { increment: 1 }
          }
        });
        destinationLotId = destinationLot.id;
      }
      segments.push({
        sourceLotId: lot.id,
        destinationLotId,
        lotNumber: lot.lotNumber,
        expirationDate: lot.expirationDate,
        quantity: consumed
      });
      remaining = this.roundQuantity(remaining - consumed);
    }
    if (remaining > 0) {
      throw new BadRequestException({
        code: "INVENTORY_INSUFFICIENT_LOT_STOCK",
        message: `Insufficient non-expired lot stock for ${item.name}`,
        details: { requested: quantity, allocated: quantity - remaining }
      });
    }
    return segments;
  }

  private stockRows(row: {
    stocks?: Array<{
      stock: Prisma.Decimal;
      minStock: Prisma.Decimal;
      averageCost: Prisma.Decimal;
      warehouse?: { name: string } | null;
    }>;
  }) {
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
        code: this.inventoryCode("Bodega central"),
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
    const data: Prisma.InventoryStockUpdateInput = {
      stock: this.toDecimal(nextStock),
      lastMovementAt: new Date(),
      version: { increment: 1 }
    };
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

  private async lockStockTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    warehouseId: string,
    inventoryItemId: string
  ) {
    const key = `${organizationId}:${warehouseId}:${inventoryItemId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
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

  private inventoryCode(value: string) {
    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);
    return `${normalized || "WH"}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private roundQuantity(value: number) {
    return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
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
