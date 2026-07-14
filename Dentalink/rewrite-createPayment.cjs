const fs = require('fs');

const file = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { toDecimal, sumDecimals, isDecimalEqual }')) {
  code = code.replace(/import { Prisma } from "@prisma\/client";/, 'import { Prisma } from "@prisma/client";\nimport { toDecimal, sumDecimals, isDecimalEqual } from "./utils/monetary.util";');
}

if (!code.includes("import * as crypto from 'crypto';")) {
  code = code.replace(/import { Injectable, NotFoundException, BadRequestException } from "@nestjs\/common";/, "import { Injectable, NotFoundException, BadRequestException } from \"@nestjs/common\";\nimport * as crypto from 'crypto';");
}

const createPaymentNew = `async createPayment(actor: AuthUser, dto: CreatePaymentDto) {
    await this.ensureBranch(actor, dto.branchId);
    await this.ensurePatient(actor, dto.patientId);

    const requestHash = crypto.createHash('sha256').update(JSON.stringify(dto)).digest('hex');

    const splits = dto.splits?.length
      ? dto.splits
      : [{
          paymentMethodId: dto.paymentMethodId!,
          amount: dto.amount || 0,
          financialInstitutionId: dto.financialInstitutionId,
          reference: dto.reference
        }];

    if (!splits.length) throw new BadRequestException("At least one payment method is required");

    const totalAmount = sumDecimals(splits.map(s => s.amount));
    const dtoAmount = dto.amount ? toDecimal(dto.amount) : totalAmount;

    if (!isDecimalEqual(totalAmount, dtoAmount)) {
      throw new BadRequestException("Payment splits sum must match total amount");
    }
    if (totalAmount.lte(0)) {
      throw new BadRequestException("Payment amount must be greater than zero");
    }

    for (const split of splits) {
      if (toDecimal(split.amount).lte(0)) throw new BadRequestException("Split amounts must be greater than zero");
      await this.ensurePaymentMethod(actor, split.paymentMethodId);
      if (split.financialInstitutionId) await this.ensureFinancialInstitution(actor, split.financialInstitutionId);
    }

    const openRegister = await this.ensureOpenCashRegister(actor, dto.branchId);

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          if (dto.idempotencyKey) {
            const existing = await tx.paymentIdempotency.findUnique({
              where: {
                organizationId_idempotencyKey: {
                  organizationId: actor.organizationId,
                  idempotencyKey: dto.idempotencyKey
                }
              }
            });
            if (existing) {
              if (existing.requestHash !== requestHash) {
                throw new BadRequestException("Conflicto de idempotencia: Payload modificado");
              }
              if (existing.paymentId) return existing.paymentId;
            } else {
              await tx.paymentIdempotency.create({
                data: {
                  organizationId: actor.organizationId,
                  idempotencyKey: dto.idempotencyKey,
                  requestHash,
                  status: "PROCESSING",
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
              });
            }
          }

          const payment = await tx.payment.create({
            data: {
              organizationId: actor.organizationId,
              branchId: dto.branchId,
              patientId: dto.patientId,
              receivedById: actor.id,
              amount: totalAmount,
              currency: dto.currency ?? "MXN",
              status: PaymentStatus.RECEIVED,
              paymentMethodId: dto.paymentMethodId || splits[0].paymentMethodId,
              financialInstitutionId: dto.financialInstitutionId || splits[0].financialInstitutionId,
              reference: dto.reference?.trim() || splits[0].reference?.trim(),
              notes: dto.notes?.trim(),
              paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
              idempotencyKey: dto.idempotencyKey,
              splits: {
                create: splits.map(s => ({
                  paymentMethodId: s.paymentMethodId,
                  amount: toDecimal(s.amount),
                  financialInstitutionId: s.financialInstitutionId,
                  reference: s.reference?.trim()
                }))
              }
            }
          });

          if (dto.idempotencyKey) {
            await tx.paymentIdempotency.update({
              where: {
                organizationId_idempotencyKey: {
                  organizationId: actor.organizationId,
                  idempotencyKey: dto.idempotencyKey
                }
              },
              data: { paymentId: payment.id, status: "COMPLETED" }
            });
          }

          if (openRegister) {
            for (const split of splits) {
              await tx.cashMovement.create({
                data: {
                  cashRegisterId: openRegister.id,
                  type: CashMovementType.INCOME,
                  amount: toDecimal(split.amount),
                  paymentId: payment.id,
                  description: \`Ingreso por pago \${payment.id} (Método \${split.paymentMethodId})\`.trim(),
                  createdById: actor.id
                }
              });
            }
          }

          if (dto.allocations?.length) {
            await this.applyAllocations(tx, actor, payment.id, dto.allocations);
          }

          await this.audit(tx, actor, {
            entity: "Payment",
            entityId: payment.id,
            action: "create",
            after: {
              patientId: payment.patientId,
              amount: totalAmount,
              currency: payment.currency,
              paidAt: payment.paidAt
            }
          });

          return payment.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000
        }
      );

      return this.getPayment(actor, created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new BadRequestException("Transacción fallida por concurrencia. Reintente.");
      }
      throw error;
    }
  }`;

const startIdx = code.indexOf('async createPayment(actor: AuthUser, dto: CreatePaymentDto) {');
const endIdx = code.indexOf('return this.getPayment(actor, created);\n  }', startIdx) + 43;

if (startIdx !== -1 && endIdx > startIdx) {
  code = code.substring(0, startIdx) + createPaymentNew + code.substring(endIdx);
}

fs.writeFileSync(file, code);
