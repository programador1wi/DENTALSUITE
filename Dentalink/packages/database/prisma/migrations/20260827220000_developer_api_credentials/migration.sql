DO $$ BEGIN
  CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeveloperApiPlan" AS ENUM ('STANDARD', 'PRO', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApiKeyBranchScope" AS ENUM ('ALL', 'SELECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApiKeyNetworkScope" AS ENUM ('ANY', 'ALLOWLIST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApiIdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "developerApiPlan" "DeveloperApiPlan" NOT NULL DEFAULT 'STANDARD';

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
  "branchScope" "ApiKeyBranchScope" NOT NULL DEFAULT 'ALL',
  "branchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "networkScope" "ApiKeyNetworkScope" NOT NULL DEFAULT 'ANY',
  "allowedIps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastUsedAt" TIMESTAMP(3),
  "lastUsedIp" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApiKey"
  ADD COLUMN IF NOT EXISTS "branchScope" "ApiKeyBranchScope" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "networkScope" "ApiKeyNetworkScope" NOT NULL DEFAULT 'ANY',
  ADD COLUMN IF NOT EXISTS "lastUsedIp" TEXT,
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedById" TEXT;

UPDATE "ApiKey"
SET "status" = 'REVOKED', "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP)
WHERE "status"::TEXT = 'EXPIRED';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum value
    JOIN pg_type type ON type.oid = value.enumtypid
    WHERE type.typname = 'ApiKeyStatus' AND value.enumlabel = 'EXPIRED'
  ) THEN
    ALTER TABLE "ApiKey" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "ApiKey" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
    DROP TYPE "ApiKeyStatus";
    CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');
    ALTER TABLE "ApiKey" ALTER COLUMN "status" TYPE "ApiKeyStatus" USING "status"::"ApiKeyStatus";
    ALTER TABLE "ApiKey" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'ApiKey' AND column_name = 'isTestMode'
  ) THEN
    EXECUTE 'UPDATE "ApiKey" SET "status" = ''REVOKED'', "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP) WHERE "isTestMode" = TRUE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApiKeySecret" (
  "id" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKeySecret_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'ApiKey' AND column_name = 'keyHash'
  ) THEN
    EXECUTE $migration$
      INSERT INTO "ApiKeySecret" (
        "id", "apiKeyId", "keyPrefix", "keyHash", "activeFrom", "expiresAt", "revokedAt", "createdAt"
      )
      SELECT
        'migrated_' || "id",
        "id",
        "keyPrefix",
        "keyHash",
        "createdAt",
        COALESCE("expiresAt", CURRENT_TIMESTAMP + INTERVAL '90 days'),
        CASE WHEN "status"::TEXT = 'REVOKED' THEN COALESCE("revokedAt", CURRENT_TIMESTAMP) ELSE NULL END,
        "createdAt"
      FROM "ApiKey"
      WHERE "keyHash" IS NOT NULL
      ON CONFLICT ("id") DO NOTHING
    $migration$;
  END IF;
END $$;

ALTER TABLE "ApiKey"
  DROP COLUMN IF EXISTS "keyPrefix",
  DROP COLUMN IF EXISTS "keyHash",
  DROP COLUMN IF EXISTS "isTestMode",
  DROP COLUMN IF EXISTS "tier",
  DROP COLUMN IF EXISTS "expiresAt";

CREATE TABLE IF NOT EXISTS "ApiIdempotencyRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "ApiIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment"
  ALTER COLUMN "createdById" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "createdByApiKeyId" TEXT;

ALTER TABLE "AppointmentStatusHistory"
  ALTER COLUMN "changedById" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "changedByApiKeyId" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "actorApiKeyId" TEXT;

ALTER TABLE "Appointment"
  DROP CONSTRAINT IF EXISTS "Appointment_actor_exactly_one_check",
  ADD CONSTRAINT "Appointment_actor_exactly_one_check"
    CHECK (num_nonnulls("createdById", "createdByApiKeyId") = 1);

ALTER TABLE "AppointmentStatusHistory"
  DROP CONSTRAINT IF EXISTS "AppointmentStatusHistory_actor_exactly_one_check",
  ADD CONSTRAINT "AppointmentStatusHistory_actor_exactly_one_check"
    CHECK (num_nonnulls("changedById", "changedByApiKeyId") = 1);

ALTER TABLE "AuditLog"
  DROP CONSTRAINT IF EXISTS "AuditLog_actor_at_most_one_check",
  ADD CONSTRAINT "AuditLog_actor_at_most_one_check"
    CHECK (num_nonnulls("userId", "actorApiKeyId") <= 1);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKeySecret_keyHash_key" ON "ApiKeySecret"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKeySecret_apiKeyId_activeFrom_expiresAt_idx" ON "ApiKeySecret"("apiKeyId", "activeFrom", "expiresAt");
CREATE INDEX IF NOT EXISTS "ApiKeySecret_keyPrefix_idx" ON "ApiKeySecret"("keyPrefix");
CREATE INDEX IF NOT EXISTS "ApiKey_organizationId_status_idx" ON "ApiKey"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ApiKey_revokedById_idx" ON "ApiKey"("revokedById");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiIdempotencyRecord_apiKeyId_operation_idempotencyKey_key" ON "ApiIdempotencyRecord"("apiKeyId", "operation", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ApiIdempotencyRecord_organizationId_expiresAt_idx" ON "ApiIdempotencyRecord"("organizationId", "expiresAt");
CREATE INDEX IF NOT EXISTS "ApiIdempotencyRecord_status_lockedUntil_idx" ON "ApiIdempotencyRecord"("status", "lockedUntil");
CREATE INDEX IF NOT EXISTS "AppointmentStatusHistory_changedByApiKeyId_createdAt_idx" ON "AppointmentStatusHistory"("changedByApiKeyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorApiKeyId_idx" ON "AuditLog"("actorApiKeyId");

ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_organizationId_fkey";
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_createdById_fkey";
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_revokedById_fkey";
ALTER TABLE "ApiKeySecret" DROP CONSTRAINT IF EXISTS "ApiKeySecret_apiKeyId_fkey";
ALTER TABLE "ApiIdempotencyRecord" DROP CONSTRAINT IF EXISTS "ApiIdempotencyRecord_organizationId_fkey";
ALTER TABLE "ApiIdempotencyRecord" DROP CONSTRAINT IF EXISTS "ApiIdempotencyRecord_apiKeyId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_createdByApiKeyId_fkey";
ALTER TABLE "AppointmentStatusHistory" DROP CONSTRAINT IF EXISTS "AppointmentStatusHistory_changedByApiKeyId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorApiKeyId_fkey";

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiKeySecret" ADD CONSTRAINT "ApiKeySecret_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByApiKeyId_fkey" FOREIGN KEY ("createdByApiKeyId") REFERENCES "ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_changedByApiKeyId_fkey" FOREIGN KEY ("changedByApiKeyId") REFERENCES "ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorApiKeyId_fkey" FOREIGN KEY ("actorApiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE IF EXISTS "ApiKeyTier";
