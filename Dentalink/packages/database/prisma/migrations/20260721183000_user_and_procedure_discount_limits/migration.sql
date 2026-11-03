-- Discount authorization is additive. Existing eligible tariff items keep a 100% cap
-- until an administrator explicitly lowers it; non-eligible items are normalized to 0%.
CREATE TABLE "UserDiscountPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maximumDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDiscountPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserDiscountPolicy_maximumDiscountPercent_check"
      CHECK ("maximumDiscountPercent" >= 0 AND "maximumDiscountPercent" <= 100)
);

CREATE UNIQUE INDEX "UserDiscountPolicy_userId_key" ON "UserDiscountPolicy"("userId");
CREATE UNIQUE INDEX "UserDiscountPolicy_organizationId_userId_key"
  ON "UserDiscountPolicy"("organizationId", "userId");
CREATE INDEX "UserDiscountPolicy_organizationId_active_idx"
  ON "UserDiscountPolicy"("organizationId", "active");

ALTER TABLE "UserDiscountPolicy"
  ADD CONSTRAINT "UserDiscountPolicy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDiscountPolicy"
  ADD CONSTRAINT "UserDiscountPolicy_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceListItem"
  ADD COLUMN "maxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 100;
UPDATE "PriceListItem" SET "maxDiscountPercent" = 0 WHERE "allowsDiscount" = false;
ALTER TABLE "PriceListItem"
  ADD CONSTRAINT "PriceListItem_maxDiscountPercent_check"
  CHECK ("maxDiscountPercent" >= 0 AND "maxDiscountPercent" <= 100);

ALTER TABLE "TreatmentPlanItem"
  ADD COLUMN "maximumDiscountPercentSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN "appliedDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "userMaximumDiscountSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "effectiveMaximumDiscountSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 0;

UPDATE "TreatmentPlanItem"
SET "maximumDiscountPercentSnapshot" = 0
WHERE "allowsDiscountSnapshot" = false;

ALTER TABLE "TreatmentPlanItem"
  ADD CONSTRAINT "TreatmentPlanItem_discount_percent_snapshots_check"
  CHECK (
    "maximumDiscountPercentSnapshot" >= 0 AND "maximumDiscountPercentSnapshot" <= 100
    AND "appliedDiscountPercent" >= 0 AND "appliedDiscountPercent" <= 100
    AND "userMaximumDiscountSnapshot" >= 0 AND "userMaximumDiscountSnapshot" <= 100
    AND "effectiveMaximumDiscountSnapshot" >= 0 AND "effectiveMaximumDiscountSnapshot" <= 100
  );
