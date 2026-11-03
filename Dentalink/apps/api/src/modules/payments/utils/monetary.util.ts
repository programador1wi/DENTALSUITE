import { Prisma } from '@prisma/client';

export function toDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value.toString());
}

export function sumDecimals(values: (string | number | Prisma.Decimal)[]): Prisma.Decimal {
  return values.reduce(
    (acc: Prisma.Decimal, val) => acc.add(toDecimal(val)),
    new Prisma.Decimal(0)
  );
}

export function isDecimalEqual(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.equals(b);
}
