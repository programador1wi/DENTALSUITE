type MonetaryValue = { toString(): string };

export function cents(value: number) {
  return Math.round(value * 100);
}

export function money(value: number) {
  return cents(value) / 100;
}

export function dueDateAllocations(
  charges: Array<{ id: string; outstandingAmount: MonetaryValue }>,
  amount: number
) {
  let remaining = cents(amount);
  return charges.map((charge) => {
    const allocated = Math.min(remaining, cents(Number(charge.outstandingAmount.toString())));
    remaining -= allocated;
    return { chargeId: charge.id, amount: allocated / 100 };
  });
}

export function proportionalAllocations(
  charges: Array<{ id: string; outstandingAmount: MonetaryValue }>,
  amount: number,
  totalDebt: number
) {
  const target = cents(amount);
  const total = cents(totalDebt);
  let assigned = 0;
  return charges.map((charge, index) => {
    const capacity = cents(Number(charge.outstandingAmount.toString()));
    const share =
      index === charges.length - 1 ? target - assigned : Math.min(capacity, Math.floor((target * capacity) / total));
    assigned += share;
    return { chargeId: charge.id, amount: share / 100 };
  });
}

export function splitMoney(amount: number, count: number) {
  const totalCents = cents(amount);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function installmentDueDate(first: Date, frequency: string, index: number) {
  const date = new Date(first);
  if (frequency === "WEEKLY") date.setUTCDate(date.getUTCDate() + index * 7);
  if (frequency === "BIWEEKLY") date.setUTCDate(date.getUTCDate() + index * 14);
  if (frequency === "MONTHLY") date.setUTCMonth(date.getUTCMonth() + index);
  return date;
}

export function appliedAmount(allocations: Array<{ allocatedAmount: MonetaryValue }>) {
  return money(allocations.reduce((sum, allocation) => sum + Number(allocation.allocatedAmount.toString()), 0));
}

export function chargeState(status: string, dueDate: Date, paid: number, outstanding: number) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "REVERSED") return "REVERSED";
  if (outstanding <= 0) return "PAID";
  if (paid > 0) return dueDate < new Date() ? "OVERDUE" : "PARTIALLY_PAID";
  return dueDate < new Date() ? "OVERDUE" : dueDate > new Date() ? "SCHEDULED" : "PENDING";
}

export function persistedChargeStatus(dueDate: Date, paid: number, outstanding: number) {
  if (outstanding <= 0) return "PAID" as const;
  if (paid > 0) return "PARTIALLY_PAID" as const;
  return dueDate < new Date() ? ("OVERDUE" as const) : ("PENDING" as const);
}

export function summaryState(generated: number, paid: number, debt: number) {
  if (generated <= 0) return "NO_CHARGES";
  if (debt <= 0 && paid >= generated) return "PAID";
  if (debt <= 0) return "ADJUSTED_ZERO";
  return "OUTSTANDING";
}

export function startOfDay(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function endOfDay(value: string) {
  return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
}

export function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function clean(value?: string) {
  const text = value?.trim();
  return text || null;
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
