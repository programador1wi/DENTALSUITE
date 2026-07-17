CREATE SEQUENCE "family_code_sequence" START 1;
CREATE SEQUENCE "policy_number_sequence" START 1;

CREATE OR REPLACE FUNCTION next_family_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  serial_value BIGINT;
BEGIN
  serial_value := nextval('family_code_sequence');
  IF serial_value > 9999999 THEN
    RAISE EXCEPTION 'Se agotó la secuencia visible de familias';
  END IF;
  RETURN 'FAM-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(serial_value::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_policy_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  serial_value BIGINT;
BEGIN
  serial_value := nextval('policy_number_sequence');
  IF serial_value > 9999999 THEN
    RAISE EXCEPTION 'Se agotó la secuencia visible de pólizas';
  END IF;
  RETURN 'POL-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(serial_value::TEXT, 6, '0');
END;
$$;

ALTER TABLE "FamilyGroup"
  ADD COLUMN "familyCode" TEXT,
  ADD COLUMN "holderPatientId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

WITH unique_owners AS (
  SELECT "familyGroupId", MIN("patientId") AS "patientId"
  FROM "FamilyGroupMember"
  WHERE "role" = 'GROUP_OWNER'
    AND "validUntil" IS NULL
  GROUP BY "familyGroupId"
  HAVING COUNT(*) = 1
)
UPDATE "FamilyGroup" AS family
SET
  "familyCode" = next_family_code(),
  "holderPatientId" = unique_owner."patientId",
  "branchId" = owner_patient."branchId"
FROM unique_owners AS unique_owner
JOIN "Patient" AS owner_patient ON owner_patient."id" = unique_owner."patientId"
WHERE unique_owner."familyGroupId" = family."id";

UPDATE "FamilyGroup"
SET "familyCode" = next_family_code()
WHERE "familyCode" IS NULL;

ALTER TABLE "FamilyGroup"
  ALTER COLUMN "familyCode" SET NOT NULL,
  ALTER COLUMN "familyCode" SET DEFAULT next_family_code();

CREATE UNIQUE INDEX "FamilyGroup_familyCode_key" ON "FamilyGroup"("familyCode");
CREATE INDEX "FamilyGroup_organizationId_familyCode_idx" ON "FamilyGroup"("organizationId", "familyCode");
CREATE INDEX "FamilyGroup_holderPatientId_idx" ON "FamilyGroup"("holderPatientId");
CREATE INDEX "FamilyGroup_branchId_idx" ON "FamilyGroup"("branchId");

ALTER TABLE "FamilyGroup"
  ADD CONSTRAINT "FamilyGroup_holderPatientId_fkey"
  FOREIGN KEY ("holderPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyGroup_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "PolicyModality" AS ENUM ('INDIVIDUAL', 'DUAL', 'FAMILY');
CREATE TYPE "FamilyPolicyStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "FamilyPolicyPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');

CREATE TABLE "PolicyProduct" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "modality" "PolicyModality" NOT NULL,
  "minimumMembers" INTEGER NOT NULL,
  "maximumMembers" INTEGER NOT NULL,
  "durationMonths" INTEGER NOT NULL DEFAULT 12,
  "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
  "activationRules" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyProduct_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyProduct_member_limits_check" CHECK ("minimumMembers" >= 1 AND "maximumMembers" >= "minimumMembers" AND "maximumMembers" <= 4),
  CONSTRAINT "PolicyProduct_duration_check" CHECK ("durationMonths" > 0)
);

CREATE TABLE "FamilyPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyNumber" TEXT NOT NULL DEFAULT next_policy_number(),
  "policyProductId" TEXT NOT NULL,
  "familyGroupId" TEXT,
  "holderPatientId" TEXT NOT NULL,
  "status" "FamilyPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveUntil" TIMESTAMP(3) NOT NULL,
  "contractedPrice" DECIMAL(10,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
  "paymentStatus" "FamilyPolicyPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "branchId" TEXT NOT NULL,
  "soldByUserId" TEXT NOT NULL,
  "renewedFromPolicyId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FamilyPolicy_dates_check" CHECK ("effectiveUntil" > "effectiveFrom"),
  CONSTRAINT "FamilyPolicy_price_check" CHECK ("contractedPrice" > 0)
);

CREATE TABLE "FamilyPolicyMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "familyGroupMemberId" TEXT,
  "memberRole" TEXT NOT NULL,
  "relationshipSnapshot" TEXT,
  "coverageStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "coverageStart" TIMESTAMP(3),
  "coverageEnd" TIMESTAMP(3),
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "removalReason" TEXT,
  CONSTRAINT "FamilyPolicyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyPolicyPayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "cashRegisterId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "receivedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyPolicyPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FamilyPolicyPayment_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "PolicyProduct_organizationId_productCode_key" ON "PolicyProduct"("organizationId", "productCode");
CREATE INDEX "PolicyProduct_organizationId_status_idx" ON "PolicyProduct"("organizationId", "status");
CREATE UNIQUE INDEX "FamilyPolicy_policyNumber_key" ON "FamilyPolicy"("policyNumber");
CREATE INDEX "FamilyPolicy_organizationId_status_effectiveUntil_idx" ON "FamilyPolicy"("organizationId", "status", "effectiveUntil");
CREATE INDEX "FamilyPolicy_familyGroupId_createdAt_idx" ON "FamilyPolicy"("familyGroupId", "createdAt");
CREATE INDEX "FamilyPolicy_holderPatientId_createdAt_idx" ON "FamilyPolicy"("holderPatientId", "createdAt");
CREATE INDEX "FamilyPolicy_branchId_createdAt_idx" ON "FamilyPolicy"("branchId", "createdAt");
CREATE UNIQUE INDEX "FamilyPolicyMember_policyId_patientId_key" ON "FamilyPolicyMember"("policyId", "patientId");
CREATE INDEX "FamilyPolicyMember_organizationId_patientId_coverageStatus_idx" ON "FamilyPolicyMember"("organizationId", "patientId", "coverageStatus");
CREATE INDEX "FamilyPolicyMember_familyGroupMemberId_idx" ON "FamilyPolicyMember"("familyGroupMemberId");
CREATE UNIQUE INDEX "FamilyPolicyPayment_paymentId_key" ON "FamilyPolicyPayment"("paymentId");
CREATE INDEX "FamilyPolicyPayment_policyId_paidAt_idx" ON "FamilyPolicyPayment"("policyId", "paidAt");
CREATE INDEX "FamilyPolicyPayment_organizationId_branchId_paidAt_idx" ON "FamilyPolicyPayment"("organizationId", "branchId", "paidAt");

ALTER TABLE "PolicyProduct"
  ADD CONSTRAINT "PolicyProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicy"
  ADD CONSTRAINT "FamilyPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicy_policyProductId_fkey" FOREIGN KEY ("policyProductId") REFERENCES "PolicyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicy_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicy_holderPatientId_fkey" FOREIGN KEY ("holderPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicy_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicy_renewedFromPolicyId_fkey" FOREIGN KEY ("renewedFromPolicyId") REFERENCES "FamilyPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicyMember"
  ADD CONSTRAINT "FamilyPolicyMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyMember_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "FamilyPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyMember_familyGroupMemberId_fkey" FOREIGN KEY ("familyGroupMemberId") REFERENCES "FamilyGroupMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicyPayment"
  ADD CONSTRAINT "FamilyPolicyPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyPayment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "FamilyPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyPayment_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource", "isSystem", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('perm-family-policies-read', 'family_policies.read', 'Read family policies', 'View family policy contracts', 'patients', 'family_policies.read', 'read', 'family_policies', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-family-policies-create', 'family_policies.create', 'Create family policies', 'Create family policy drafts', 'patients', 'family_policies.create', 'create', 'family_policies', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-family-policies-manage', 'family_policies.manage', 'Manage family policies', 'Manage policy members and cancellations', 'patients', 'family_policies.manage', 'manage', 'family_policies', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-family-policies-activate', 'family_policies.activate', 'Activate family policies', 'Register policy payments and activate coverage', 'patients', 'family_policies.activate', 'activate', 'family_policies', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "code" = EXCLUDED."code",
  "action" = EXCLUDED."action",
  "resource" = EXCLUDED."resource",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
CROSS JOIN "Permission" AS permission
WHERE (role."code" IN ('super_admin', 'admin', 'receptionist') OR role."name" IN ('SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'))
  AND permission."key" IN ('family_policies.read', 'family_policies.create', 'family_policies.manage', 'family_policies.activate')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
