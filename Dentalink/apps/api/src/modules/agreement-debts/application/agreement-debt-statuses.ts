import { AgreementChargeStatus, CompanyPaymentStatus } from "@prisma/client";

export const ACTIVE_PAYMENT_STATUSES: CompanyPaymentStatus[] = [
  CompanyPaymentStatus.CONFIRMED,
  CompanyPaymentStatus.PARTIALLY_APPLIED,
  CompanyPaymentStatus.APPLIED
];

export const INVALID_CHARGE_STATUSES: AgreementChargeStatus[] = [
  AgreementChargeStatus.CANCELLED,
  AgreementChargeStatus.REVERSED
];
