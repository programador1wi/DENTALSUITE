import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CashMovementDirection,
  CashMovementType,
  CashRegisterStatus,
  Prisma
} from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { resolvePagination } from "../../common/utils/pagination.util";
import { createXlsxWorkbook } from "../../common/utils/xlsx.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CloseCashRegisterDto,
  ListCashRegistersQueryDto,
  OpenCashRegisterDto
} from "./dto/payments.dto";

@Injectable()
export class PaymentCashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private displayName(user?: { firstName?: string; lastName?: string } | null): string {
    if (!user) return "-";
    return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "-";
  }

  private formatCurrency(value?: number | null, currency = "MXN"): string {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value ?? 0);
  }

  private csvCell(value: unknown): string {
    if (value === null || value === undefined) return '""';
    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
  }

  private parseCashRegisterNumber(value: string): number | null {
    const raw = value.trim().replace(/^CAJ-/i, "");
    return /^\d{1,6}$/.test(raw) ? Number(raw) : null;
  }

  private resolveOptionalDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return range;
  }

  private async audit(
    prisma: PrismaService,
    actor: AuthUser,
    data: { entity: string; entityId: string; action: string; before?: unknown; after?: unknown }
  ) {
    await prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: data.entity,
        entityId: data.entityId,
        action: data.action,
        before: (data.before as Prisma.InputJsonValue) ?? {},
        after: (data.after as Prisma.InputJsonValue) ?? {}
      }
    });
  }

  private hasAnyPermission(actor: AuthUser, permissions: string[]): boolean {
    return permissions.some((p) => actor.permissions.includes(p));
  }

  private async ensureBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: actor.organizationId }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async ensureCashResponsible(actor: AuthUser, branchId: string, responsibleUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: responsibleUserId,
        organizationId: actor.organizationId,
        isActive: true,
        branches: { some: { branchId } }
      }
    });
    if (!user) {
      throw new BadRequestException("El usuario responsable no pertenece a esta sucursal o no está activo");
    }
    return user;
  }

  async getLatestClosingCarryover(actor: AuthUser, branchId: string): Promise<number> {
    const lastClosed = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        status: CashRegisterStatus.CLOSED
      },
      orderBy: { closedAt: "desc" }
    });
    return Number(lastClosed?.closingCarryover ?? lastClosed?.closingAmount ?? 0);
  }

  async openCashRegisterInternal(
    actor: AuthUser,
    input: {
      branchId: string;
      responsibleUserId: string;
      previousBalance: number;
      initialDeposit: number;
      notes?: string;
    }
  ) {
    const openingAmount = this.roundMoney(input.previousBalance + input.initialDeposit);
    const count = await this.prisma.cashRegister.count({
      where: { organizationId: actor.organizationId }
    });
    const publicNumber = count + 1;

    const created = await this.prisma.cashRegister.create({
      data: {
        organizationId: actor.organizationId,
        branchId: input.branchId,
        responsibleUserId: input.responsibleUserId,
        openedById: actor.id,
        publicNumber,
        previousClosingBalance: input.previousBalance,
        initialDeposit: input.initialDeposit,
        openingAmount,
        notes: input.notes?.trim() || null,
        status: CashRegisterStatus.OPEN
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: created.id,
      action: "open",
      after: { publicNumber, openingAmount }
    });

    return created.id;
  }

  async getCashRegister(actor: AuthUser, registerId: string) {
    return this.getCashRegisterDetail(actor, registerId);
  }

  async openCashRegister(actor: AuthUser, dto: OpenCashRegisterDto) {
    await this.ensureBranch(actor, dto.branchId);
    const responsibleUserId = dto.responsibleUserId?.trim() || actor.id;
    await this.ensureCashResponsible(actor, dto.branchId, responsibleUserId);

    const existing = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: dto.branchId,
        responsibleUserId,
        status: CashRegisterStatus.OPEN
      }
    });

    if (existing) {
      throw new BadRequestException("You already have an open cash register in this branch");
    }

    const previousBalance = await this.getLatestClosingCarryover(actor, dto.branchId);
    const created = await this.openCashRegisterInternal(actor, {
      branchId: dto.branchId,
      responsibleUserId,
      previousBalance,
      initialDeposit: dto.openingAmount,
      notes: dto.notes
    });

    return this.getCashRegister(actor, created);
  }

  async getCurrentCashRegister(actor: AuthUser, branchId: string) {
    await this.ensureBranch(actor, branchId);

    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        responsibleUserId: actor.id,
        status: CashRegisterStatus.OPEN
      },
      select: { id: true }
    });

    if (!register) return null;
    return this.getCashRegister(actor, register.id);
  }

  async listCashRegisters(actor: AuthUser, query: ListCashRegistersQueryDto) {
    const { skip, take } = resolvePagination(query);
    const search = query.search?.trim();
    const publicNumber = search?.replace(/^CAJ-/i, "");
    const parsedPublicNumber = publicNumber && /^\d{1,6}$/.test(publicNumber) ? Number(publicNumber) : null;
    const openedAt = this.resolveOptionalDateRange(query.openedFrom, query.openedTo);
    const closedAt = this.resolveOptionalDateRange(query.closedFrom, query.closedTo);
    const registers = await this.prisma.cashRegister.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, query.branchId),
        ...(query.status ? { status: query.status as CashRegisterStatus } : {}),
        ...(query.responsibleUserId ? { responsibleUserId: query.responsibleUserId } : {}),
        ...(openedAt ? { openedAt } : {}),
        ...(closedAt ? { closedAt } : {}),
        ...(query.withDifference === "true" ? { differenceAmount: { not: 0 } } : {}),
        ...(search
          ? {
              OR: [
                ...(parsedPublicNumber !== null ? [{ publicNumber: parsedPublicNumber }] : []),
                { branch: { name: { contains: search, mode: "insensitive" } } },
                { responsibleUser: { firstName: { contains: search, mode: "insensitive" } } },
                { responsibleUser: { lastName: { contains: search, mode: "insensitive" } } },
                { openedBy: { firstName: { contains: search, mode: "insensitive" } } },
                { openedBy: { lastName: { contains: search, mode: "insensitive" } } },
                { closedBy: { firstName: { contains: search, mode: "insensitive" } } },
                { closedBy: { lastName: { contains: search, mode: "insensitive" } } },
                { movements: { some: { reference: { contains: search, mode: "insensitive" } } } },
                {
                  movements: {
                    some: { payment: { patient: { firstName: { contains: search, mode: "insensitive" } } } }
                  }
                },
                {
                  movements: {
                    some: { payment: { patient: { lastName: { contains: search, mode: "insensitive" } } } }
                  }
                }
              ]
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: {
          include: {
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                includeInPhysicalCashBalance: true,
                includeInClosingSummary: true
              }
            },
            payment: {
              select: {
                paymentMethod: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    includeInPhysicalCashBalance: true,
                    includeInClosingSummary: true
                  }
                }
              }
            }
          }
        }
      },
      skip,
      take,
      orderBy: { openedAt: "desc" }
    });

    return Promise.all(registers.map((register) => this.enrichCashRegister(actor, register)));
  }

  async getCashRegisterDetail(actor: AuthUser, registerId: string) {
    const publicNumber = this.parseCashRegisterNumber(registerId);
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: registerId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: {
          orderBy: { createdAt: "asc" },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                includeInPhysicalCashBalance: true,
                includeInClosingSummary: true
              }
            },
            expense: {
              select: {
                id: true,
                publicNumber: true,
                description: true,
                total: true,
                paidAt: true,
                status: true,
                category: { select: { id: true, name: true } }
              }
            },
            refund: { select: { id: true, amount: true, reason: true, status: true, processedAt: true } },
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                amount: true,
                reference: true,
                paidAt: true,
                status: true,
                voidReason: true,
                voidedAt: true,
                voidedBy: { select: { id: true, firstName: true, lastName: true } },
                patient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    documentNumber: true,
                    agreement: { select: { id: true, name: true } }
                  }
                },
                paymentMethod: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    includeInPhysicalCashBalance: true,
                    includeInClosingSummary: true
                  }
                },
                financialInstitution: { select: { id: true, name: true } },
                allocations: {
                  select: {
                    amount: true,
                    treatmentPlanItem: {
                      select: {
                        agreement: { select: { id: true, name: true } },
                        treatmentPlan: { select: { id: true, name: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!register) throw new NotFoundException("Cash register not found");
    return this.enrichCashRegister(actor, register);
  }

  async generatePdfFromRegister(actor: AuthUser, register: any) {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    let page = document.addPage([595.28, 841.89]);
    let y = 800;
    const line = (label: string, value?: unknown, strong = false) => {
      if (y < 58) {
        page = document.addPage([595.28, 841.89]);
        y = 800;
      }
      page.drawText(value === undefined ? label : `${label}: ${String(value)}`, {
        x: margin,
        y,
        size: strong ? 12 : 9,
        font: strong ? bold : regular,
        color: rgb(0.12, 0.18, 0.25)
      });
      y -= strong ? 19 : 14;
    };
    const number = `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
    line(`${register.branch?.name ?? "Sucursal"} | ${number}`, undefined, true);
    line("Estado", register.status);
    line("Responsable", this.displayName(register.responsibleUser));
    line("Apertura", register.openedAt?.toISOString?.() ?? register.openedAt ?? "-");
    line("Cierre", register.closedAt?.toISOString?.() ?? register.closedAt ?? "-");
    y -= 6;
    line("CONCILIACION", undefined, true);
    line("Saldo anterior", this.formatCurrency(register.previousClosingBalance));
    line("Abono inicial", this.formatCurrency(register.initialDeposit));
    line("Saldo inicial", this.formatCurrency(register.openingAmount));
    line("Total recaudado", this.formatCurrency(register.incomeTotal));
    line("Gastos", this.formatCurrency(register.expenseTotal));
    line("Devoluciones", this.formatCurrency(register.refundTotal));
    line("Pagos anulados", this.formatCurrency(register.voidTotal));
    line("Efectivo esperado", this.formatCurrency(register.expectedCashBalance ?? register.expectedClosing));
    line("Efectivo declarado", this.formatCurrency(register.declaredCashBalance ?? 0));
    line(
      "Saldo dejado en caja",
      this.formatCurrency(register.closingCarryover ?? register.closingAmount ?? 0)
    );
    line("Monto retirado", this.formatCurrency(register.withdrawnAmount ?? 0));
    line("Diferencia", this.formatCurrency(register.differenceAmount ?? 0));
    y -= 6;
    line("MOVIMIENTOS", undefined, true);
    for (const movement of register.movements ?? []) {
      const paymentNumber = movement.payment?.paymentNumber
        ? String(movement.payment.paymentNumber).padStart(6, "0")
        : "-";
      const method = movement.paymentMethod?.name ?? movement.payment?.paymentMethod?.name ?? "-";
      const signedAmount =
        movement.direction === CashMovementDirection.OUT
          ? Number(movement.amount) * -1
          : Number(movement.amount);
      const voidDetails =
        movement.type === CashMovementType.PAYMENT_VOID
          ? ` | Motivo: ${movement.payment?.voidReason ?? movement.voidReason ?? "-"} | Anulado por: ${
              movement.payment?.voidedBy
                ? this.displayName(movement.payment.voidedBy)
                : this.displayName(movement.createdBy)
            }`
          : "";
      line(
        `${new Date(movement.createdAt).toLocaleString("es-MX")} | ${movement.type} | Pago ${paymentNumber} | ${method} | ${this.formatCurrency(signedAmount)}${voidDetails}`
      );
    }
    const bytes = await document.save();
    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: register.id,
      action: "export_pdf",
      after: { publicNumber: register.publicNumber }
    });
    return { fileNumber: number, bytes };
  }

  async getCashRegisterReportPdf(actor: AuthUser, registerId: string) {
    const register = await this.getCashRegisterDetail(actor, registerId);
    return this.generatePdfFromRegister(actor, register);
  }

  async generateCsvFromRegister(actor: AuthUser, register: any) {
    const headers = [
      "Caja",
      "Fecha",
      "Tipo",
      "Direccion",
      "Pago",
      "Paciente",
      "Medio",
      "Referencia",
      "Importe",
      "Estado",
      "Fecha anulacion",
      "Anulado por",
      "Motivo anulacion"
    ];
    const number = `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
    const rows = (register.movements ?? []).map((movement: any) => {
      const patient = movement.payment?.patient ? this.displayName(movement.payment.patient) : "";
      const isPaymentVoid = movement.type === CashMovementType.PAYMENT_VOID;
      return [
        number,
        new Date(movement.createdAt).toISOString(),
        movement.type,
        movement.direction,
        movement.payment?.paymentNumber ? String(movement.payment.paymentNumber).padStart(6, "0") : "",
        patient,
        movement.paymentMethod?.name ?? movement.payment?.paymentMethod?.name ?? "",
        movement.reference ?? movement.payment?.reference ?? "",
        movement.direction === CashMovementDirection.OUT
          ? Number(movement.amount) * -1
          : Number(movement.amount),
        movement.voidedAt ? "MOVEMENT_VOIDED" : isPaymentVoid ? "PAYMENT_VOIDED" : "ACTIVE",
        isPaymentVoid ? new Date(movement.payment?.voidedAt ?? movement.createdAt).toISOString() : "",
        isPaymentVoid
          ? movement.payment?.voidedBy
            ? this.displayName(movement.payment.voidedBy)
            : this.displayName(movement.createdBy)
          : "",
        isPaymentVoid ? (movement.payment?.voidReason ?? movement.voidReason ?? "") : ""
      ]
        .map((value) => this.csvCell(value))
        .join(",");
    });
    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: register.id,
      action: "export_csv",
      after: { publicNumber: register.publicNumber, movementCount: (register.movements ?? []).length }
    });
    return { fileNumber: number, content: [headers.join(","), ...rows].join("\r\n") };
  }

  async getCashRegisterReportCsv(actor: AuthUser, registerId: string) {
    const register = await this.getCashRegisterDetail(actor, registerId);
    return this.generateCsvFromRegister(actor, register);
  }

  async generateXlsxFromRegister(actor: AuthUser, register: any) {
    const number = `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
    const summaryRows = [
      { concept: "Caja", value: number },
      { concept: "Estado", value: register.status },
      { concept: "Sucursal", value: register.branch?.name ?? "Sucursal" },
      { concept: "Responsable", value: this.displayName(register.responsibleUser) },
      { concept: "Apertura", value: new Date(register.openedAt) },
      { concept: "Cierre", value: register.closedAt ? new Date(register.closedAt) : "" },
      { concept: "Moneda", value: register.currency ?? "MXN" },
      { concept: "Saldo anterior", value: Number(register.previousClosingBalance ?? 0) },
      { concept: "Abono inicial", value: Number(register.initialDeposit ?? 0) },
      { concept: "Saldo inicial", value: Number(register.openingAmount ?? 0) },
      { concept: "Total recaudado", value: Number(register.incomeTotal ?? 0) },
      { concept: "Gastos", value: Number(register.expenseTotal ?? 0) },
      { concept: "Devoluciones", value: Number(register.refundTotal ?? 0) },
      { concept: "Pagos anulados", value: Number(register.voidTotal ?? 0) },
      { concept: "Efectivo esperado", value: Number(register.expectedCashBalance ?? register.expectedClosing ?? 0) },
      { concept: "Efectivo declarado", value: Number(register.declaredCashBalance ?? 0) },
      { concept: "Saldo dejado en caja", value: Number(register.closingCarryover ?? register.closingAmount ?? 0) },
      { concept: "Monto retirado", value: Number(register.withdrawnAmount ?? 0) },
      { concept: "Diferencia", value: Number(register.differenceAmount ?? 0) }
    ];

    const movementRows = (register.movements ?? []).map((movement: any) => {
      const isPaymentVoid = movement.type === CashMovementType.PAYMENT_VOID;
      return {
        caja: number,
        fecha: new Date(movement.createdAt),
        tipo: movement.type,
        direccion: movement.direction,
        pago: movement.payment?.paymentNumber ? `PAG-${String(movement.payment.paymentNumber).padStart(6, "0")}` : "-",
        paciente: movement.payment?.patient ? this.displayName(movement.payment.patient) : "-",
        medioPago: movement.paymentMethod?.name ?? movement.payment?.paymentMethod?.name ?? "-",
        referencia: movement.reference ?? movement.payment?.reference ?? "-",
        importe:
          movement.direction === CashMovementDirection.OUT
            ? Number(movement.amount) * -1
            : Number(movement.amount),
        estado: movement.voidedAt ? "ANULADO" : isPaymentVoid ? "PAGO_ANULADO" : "ACTIVO",
        anuladoEl: isPaymentVoid ? new Date(movement.payment?.voidedAt ?? movement.createdAt) : "",
        anuladoPor: isPaymentVoid
          ? movement.payment?.voidedBy
            ? this.displayName(movement.payment.voidedBy)
            : this.displayName(movement.createdBy)
          : "-",
        motivoAnulacion: isPaymentVoid ? movement.payment?.voidReason ?? movement.voidReason ?? "-" : "-"
      };
    });

    const buffer = createXlsxWorkbook([
      { name: "Resumen", rows: summaryRows },
      { name: "Movimientos", rows: movementRows }
    ]);

    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: register.id,
      action: "export_xlsx",
      after: { publicNumber: register.publicNumber, movementCount: (register.movements ?? []).length }
    });

    return { fileNumber: number, bytes: buffer };
  }

  async getCashRegisterReportXlsx(actor: AuthUser, registerId: string) {
    const register = await this.getCashRegisterDetail(actor, registerId);
    return this.generateXlsxFromRegister(actor, register);
  }

  private enrichCashRegister(actor: AuthUser, register: any) {
    const movements = register.movements ?? [];
    let incomeTotal = 0;
    let expenseTotal = 0;
    let refundTotal = 0;
    let voidTotal = 0;
    let cashIncome = 0;
    let cashExpense = 0;

    for (const m of movements) {
      const amt = Number(m.amount);
      const method = m.paymentMethod ?? m.payment?.paymentMethod;
      const isPhysicalCash = method?.type === "CASH" || method?.includeInPhysicalCashBalance;

      if (m.type === CashMovementType.INCOME || m.type === CashMovementType.MANUAL_INCOME) {
        incomeTotal += amt;
        if (isPhysicalCash) cashIncome += amt;
      } else if (m.type === CashMovementType.EXPENSE || m.type === CashMovementType.MANUAL_EXPENSE) {
        expenseTotal += amt;
        if (isPhysicalCash) cashExpense += amt;
      } else if (m.type === CashMovementType.REFUND) {
        refundTotal += amt;
        if (isPhysicalCash) cashExpense += amt;
      } else if (m.type === CashMovementType.PAYMENT_VOID) {
        voidTotal += amt;
        if (isPhysicalCash) cashExpense += amt;
      }
    }

    const opening = Number(register.openingAmount ?? 0);
    const expectedClosing = this.roundMoney(opening + incomeTotal - expenseTotal - refundTotal - voidTotal);
    const expectedCashBalance = this.roundMoney(opening + cashIncome - cashExpense);

    return {
      ...register,
      incomeTotal: this.roundMoney(incomeTotal),
      expenseTotal: this.roundMoney(expenseTotal),
      refundTotal: this.roundMoney(refundTotal),
      voidTotal: this.roundMoney(voidTotal),
      expectedClosing,
      expectedCashBalance
    };
  }
}
