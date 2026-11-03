ALTER TABLE "Refund"
  ADD COLUMN "originalPaymentMethodId" TEXT,
  ADD COLUMN "originalPaymentMethodSnapshot" JSONB,
  ADD COLUMN "refundPaymentMethodSnapshot" JSONB;

ALTER TABLE "CashMovement"
  ADD COLUMN "paymentMethodNameSnapshot" TEXT,
  ADD COLUMN "paymentMethodTypeSnapshot" "PaymentMethodType",
  ADD COLUMN "includeInCollectionReportsSnapshot" BOOLEAN,
  ADD COLUMN "includeInPhysicalCashBalanceSnapshot" BOOLEAN,
  ADD COLUMN "includeInCashFlowReportsSnapshot" BOOLEAN,
  ADD COLUMN "includeInClosingSummarySnapshot" BOOLEAN,
  ADD COLUMN "includeInGraphicalReportsSnapshot" BOOLEAN;

UPDATE "CashMovement" movement
SET
  "paymentMethodNameSnapshot" = method."name",
  "paymentMethodTypeSnapshot" = method."type",
  "includeInCollectionReportsSnapshot" = method."includeInCollectionReports",
  "includeInPhysicalCashBalanceSnapshot" = method."includeInPhysicalCashBalance",
  "includeInCashFlowReportsSnapshot" = method."includeInCashFlowReports",
  "includeInClosingSummarySnapshot" = method."includeInClosingSummary",
  "includeInGraphicalReportsSnapshot" = method."includeInGraphicalReports"
FROM "PaymentMethod" method
WHERE movement."paymentMethodId" = method."id";

UPDATE "Refund" refund
SET
  "originalPaymentMethodId" = payment."paymentMethodId",
  "originalPaymentMethodSnapshot" = payment."paymentMethodSnapshot",
  "refundPaymentMethodSnapshot" = (
    SELECT jsonb_build_object(
      'id', method."id",
      'publicCode', method."publicCode",
      'name', method."name",
      'type', method."type",
      'retentionPercent', method."retentionPercent",
      'allowsRefund', method."allowsRefund",
      'acceptsMultipleSettlements', method."acceptsMultipleSettlements",
      'requiresReference', method."requiresReference",
      'requiresFinancialInstitution', method."requiresFinancialInstitution",
      'fiscalCode', method."fiscalCode",
      'version', method."version"
    )
    FROM "PaymentMethod" method
    WHERE method."id" = refund."paymentMethodId"
  )
FROM "Payment" payment
WHERE refund."paymentId" = payment."id";
