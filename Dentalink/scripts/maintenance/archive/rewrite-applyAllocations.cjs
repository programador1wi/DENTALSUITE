const fs = require('fs');

const file = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let code = fs.readFileSync(file, 'utf8');

const applyAllocationsNew = `private async applyAllocations(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    paymentId: string,
    allocations: AddPaymentAllocationsDto["allocations"]
  ) {
    if (!allocations.length) throw new BadRequestException("Allocations are required");

    const payment = await tx.payment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: { allocations: true }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.VOIDED || payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException("Voided or refunded payments cannot receive allocations");
    }

    const existingAllocated = sumDecimals(payment.allocations.map(a => a.amount));
    const requested = sumDecimals(allocations.map(a => a.amount));
    if (requested.lte(0)) throw new BadRequestException("Allocation amount must be greater than zero");
    
    if (existingAllocated.add(requested).gt(payment.amount)) {
      throw new BadRequestException("Allocations exceed payment amount");
    }

    const itemIds = [...new Set(allocations.map((allocation) => allocation.treatmentPlanItemId))];
    const items = await tx.treatmentPlanItem.findMany({
      where: {
        id: { in: itemIds },
        treatmentPlan: {
          organizationId: actor.organizationId,
          patientId: payment.patientId
        }
      },
      include: { treatmentPlan: true }
    });

    if (items.length !== itemIds.length) {
      throw new BadRequestException("One or more treatment plan items are invalid");
    }

    for (const item of items) {
      if (item.treatmentPlan.isAlternative) {
        throw new BadRequestException("Alternative treatment plan items cannot receive payments");
      }
      if (item.status === TreatmentPlanItemStatus.CANCELLED) {
        throw new BadRequestException("Cancelled treatment plan items cannot receive payments");
      }
    }

    const requestedByItem = allocations.reduce((totals, allocation) => {
      const current = totals[allocation.treatmentPlanItemId] ?? new Prisma.Decimal(0);
      totals[allocation.treatmentPlanItemId] = current.add(toDecimal(allocation.amount));
      return totals;
    }, {});
    
    const existingByItem = await tx.paymentAllocation.groupBy({
      by: ["treatmentPlanItemId"],
      _sum: { amount: true },
      where: {
        treatmentPlanItemId: { in: itemIds },
        payment: { status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] } }
      }
    });
    
    const existingByItemId = new Map(
      existingByItem.map((row) => [row.treatmentPlanItemId, toDecimal(row._sum.amount ?? 0)])
    );

    for (const item of items) {
      const allocated = existingByItemId.get(item.id) ?? new Prisma.Decimal(0);
      const requestedForItem = requestedByItem[item.id] ?? new Prisma.Decimal(0);
      if (allocated.add(requestedForItem).gt(item.total)) {
        throw new BadRequestException("Allocations exceed treatment plan item balance");
      }
    }

    for (const allocation of allocations) {
      if (toDecimal(allocation.amount).lte(0)) throw new BadRequestException("Allocation amount must be greater than zero");
      const current = await tx.paymentAllocation.findFirst({
        where: { paymentId, treatmentPlanItemId: allocation.treatmentPlanItemId }
      });

      if (current) {
        await tx.paymentAllocation.update({
          where: { id: current.id },
          data: { amount: current.amount.add(toDecimal(allocation.amount)) }
        });
      } else {
        await tx.paymentAllocation.create({
          data: {
            paymentId,
            treatmentPlanItemId: allocation.treatmentPlanItemId,
            amount: toDecimal(allocation.amount)
          }
        });
      }
    }

    const allocationsAfter = await tx.paymentAllocation.aggregate({
      _sum: { amount: true },
      where: { paymentId }
    });

    const allocatedAfter = toDecimal(allocationsAfter._sum.amount ?? 0);
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: allocatedAfter.gte(payment.amount) ? PaymentStatus.ALLOCATED : PaymentStatus.PARTIALLY_ALLOCATED
      }
    });

    for (const itemId of itemIds) {
      const item = await tx.treatmentPlanItem.findUnique({ where: { id: itemId } });
      if (!item) continue;
      const allocatedOnItem = await tx.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          treatmentPlanItemId: itemId,
          payment: { status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] } }
        }
      });
      const allocatedTotal = toDecimal(allocatedOnItem._sum.amount ?? 0);
      
      if (
        allocatedTotal.gte(item.total) &&
        (item.status === TreatmentPlanItemStatus.PLANNED || item.status === TreatmentPlanItemStatus.ACCEPTED)
      ) {
        const updated = await tx.treatmentPlanItem.updateMany({
          where: { id: item.id, version: item.version },
          data: { status: TreatmentPlanItemStatus.PAID, version: { increment: 1 } }
        });
        
        if (updated.count === 0) {
           throw new BadRequestException("Conflicto de concurrencia: el item del plan de tratamiento fue modificado simultáneamente. Reintente.");
        }
      }
    }
  }`;

const startIdx = code.indexOf('private async applyAllocations(');
const endIdx = code.indexOf('    return date;\n  }', startIdx); 

if (startIdx !== -1 && endIdx !== -1) {
  // we actually want to find the end of applyAllocations, which ends right before `private shiftDate`
  const nextMethodIdx = code.indexOf('private shiftDate(', startIdx);
  if (nextMethodIdx !== -1) {
     // the previous function ends before nextMethodIdx
     const endOfApplyAllocations = code.lastIndexOf('  }', nextMethodIdx) + 3;
     code = code.substring(0, startIdx) + applyAllocationsNew + '\n\n' + code.substring(nextMethodIdx - 2);
  }
}

fs.writeFileSync(file, code);
