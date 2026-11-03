ALTER TABLE "PriceListItem"
  ALTER COLUMN "allowsDiscount" SET DEFAULT true;

ALTER TABLE "PriceListVersionItem"
  ALTER COLUMN "allowDiscount" SET DEFAULT true;

ALTER TABLE "TreatmentPlanItem"
  ADD COLUMN "originalPrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "allowsDiscountSnapshot" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "discountType" TEXT,
  ADD COLUMN "discountValue" DECIMAL(10, 2),
  ADD COLUMN "discountAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "finalPrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "discountAuthorizedBy" TEXT,
  ADD COLUMN "discountedAt" TIMESTAMP(3);

UPDATE "TreatmentPlanItem"
SET
  "originalPrice" = ("quantity" * "unitPrice"),
  "discountAmount" = "discount",
  "finalPrice" = "total",
  "discountType" = CASE WHEN "discount" > 0 THEN 'AMOUNT' ELSE NULL END,
  "discountValue" = CASE WHEN "discount" > 0 THEN "discount" ELSE NULL END,
  "discountedAt" = CASE WHEN "discount" > 0 THEN COALESCE("updatedAt", "createdAt") ELSE NULL END;

UPDATE "TreatmentPlanItem" tpi
SET "allowsDiscountSnapshot" = pli."allowsDiscount"
FROM "PriceListItem" pli
WHERE tpi."priceListItemId" = pli."id";

UPDATE "TreatmentPlanItem" tpi
SET "allowsDiscountSnapshot" = plvi."allowDiscount"
FROM "PriceListVersionItem" plvi
WHERE tpi."priceListVersionItemId" = plvi."id";
