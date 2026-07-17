-- Scope price lists by brand, zone and branch.
CREATE TYPE "BranchPriceListType" AS ENUM ('BASE', 'POLIZA', 'ADICIONAL');

CREATE TABLE "BranchBrand" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BranchBrand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchZone" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BranchZone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Branch" ADD COLUMN "brandId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "zoneId" TEXT;

CREATE TABLE "BranchPriceList" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "type" "BranchPriceListType" NOT NULL DEFAULT 'BASE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BranchPriceList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchBrand_organizationId_code_key" ON "BranchBrand"("organizationId", "code");
CREATE UNIQUE INDEX "BranchBrand_organizationId_name_key" ON "BranchBrand"("organizationId", "name");
CREATE INDEX "BranchBrand_organizationId_isActive_idx" ON "BranchBrand"("organizationId", "isActive");

CREATE UNIQUE INDEX "BranchZone_organizationId_code_key" ON "BranchZone"("organizationId", "code");
CREATE UNIQUE INDEX "BranchZone_organizationId_name_key" ON "BranchZone"("organizationId", "name");
CREATE INDEX "BranchZone_organizationId_isActive_idx" ON "BranchZone"("organizationId", "isActive");

CREATE INDEX "Branch_brandId_idx" ON "Branch"("brandId");
CREATE INDEX "Branch_zoneId_idx" ON "Branch"("zoneId");

CREATE UNIQUE INDEX "BranchPriceList_branchId_priceListId_key" ON "BranchPriceList"("branchId", "priceListId");
CREATE INDEX "BranchPriceList_organizationId_isActive_idx" ON "BranchPriceList"("organizationId", "isActive");
CREATE INDEX "BranchPriceList_priceListId_isActive_idx" ON "BranchPriceList"("priceListId", "isActive");
CREATE INDEX "BranchPriceList_branchId_isActive_isDefault_idx" ON "BranchPriceList"("branchId", "isActive", "isDefault");

ALTER TABLE "BranchBrand" ADD CONSTRAINT "BranchBrand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchZone" ADD CONSTRAINT "BranchZone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BranchBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "BranchZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BranchPriceList" ADD CONSTRAINT "BranchPriceList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchPriceList" ADD CONSTRAINT "BranchPriceList_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchPriceList" ADD CONSTRAINT "BranchPriceList_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
