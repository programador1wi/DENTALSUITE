CREATE TYPE "AppointmentReminderStage" AS ENUM ('FIRST_48H', 'FINAL_24H');

ALTER TABLE "AppointmentReminder"
  ADD COLUMN "automationStage" "AppointmentReminderStage",
  ADD COLUMN "appointmentStartAt" TIMESTAMP(3),
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3);

UPDATE "AppointmentReminder" reminder
SET "automationStage" = CASE
      WHEN reminder."channel" = 'EMAIL_CONFIRMATION_48H' THEN 'FIRST_48H'::"AppointmentReminderStage"
      WHEN reminder."channel" = 'EMAIL_CONFIRMATION_24H' THEN 'FINAL_24H'::"AppointmentReminderStage"
    END,
    "appointmentStartAt" = appointment."startAt",
    "attempts" = CASE WHEN reminder."status" IN ('SENT', 'FAILED') THEN 1 ELSE 0 END
FROM "Appointment" appointment
WHERE appointment.id = reminder."appointmentId"
  AND reminder."channel" IN ('EMAIL_CONFIRMATION_48H', 'EMAIL_CONFIRMATION_24H');

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "appointmentId", "automationStage", "appointmentStartAt"
           ORDER BY CASE WHEN status = 'SENT' THEN 0 ELSE 1 END, "createdAt" ASC, id ASC
         ) AS position
  FROM "AppointmentReminder"
  WHERE "automationStage" IS NOT NULL AND "appointmentStartAt" IS NOT NULL
)
UPDATE "AppointmentReminder" reminder
SET status = 'CANCELLED',
    "failureCode" = 'DUPLICATE_BACKFILL',
    "errorMessage" = 'Duplicado histórico cancelado durante migración',
    "automationStage" = NULL,
    "appointmentStartAt" = NULL
FROM ranked
WHERE reminder.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_automationStage_appointmentStartAt_key"
  ON "AppointmentReminder"("appointmentId", "automationStage", "appointmentStartAt");
CREATE INDEX "AppointmentReminder_status_nextAttemptAt_leaseExpiresAt_idx"
  ON "AppointmentReminder"("status", "nextAttemptAt", "leaseExpiresAt");

CREATE TABLE "AppointmentReminderPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "firstOffsetHours" INTEGER NOT NULL DEFAULT 48,
  "finalOffsetHours" INTEGER NOT NULL DEFAULT 24,
  "sendWindowStartMinutes" INTEGER NOT NULL DEFAULT 480,
  "sendWindowEndMinutes" INTEGER NOT NULL DEFAULT 1200,
  "retryDelaysMinutes" INTEGER[] NOT NULL DEFAULT ARRAY[15, 60, 240],
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentReminderPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentReminderPolicy_organizationId_key"
  ON "AppointmentReminderPolicy"("organizationId");
ALTER TABLE "AppointmentReminderPolicy"
  ADD CONSTRAINT "AppointmentReminderPolicy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AppointmentReminderPolicy" (
  id, "organizationId", enabled, "firstOffsetHours", "finalOffsetHours",
  "sendWindowStartMinutes", "sendWindowEndMinutes", "retryDelaysMinutes",
  "maxAttempts", "createdAt", "updatedAt"
)
SELECT
  'reminder_policy_' || md5(organization.id), organization.id, false, 48, 24,
  480, 1200, ARRAY[15, 60, 240], 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" organization
ON CONFLICT ("organizationId") DO NOTHING;

CREATE TABLE "AppointmentReminderBranchPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "firstOffsetHours" INTEGER,
  "finalOffsetHours" INTEGER,
  "sendWindowStartMinutes" INTEGER,
  "sendWindowEndMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentReminderBranchPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentReminderBranchPolicy_branchId_key"
  ON "AppointmentReminderBranchPolicy"("branchId");
CREATE INDEX "AppointmentReminderBranchPolicy_organizationId_idx"
  ON "AppointmentReminderBranchPolicy"("organizationId");
ALTER TABLE "AppointmentReminderBranchPolicy"
  ADD CONSTRAINT "AppointmentReminderBranchPolicy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminderBranchPolicy"
  ADD CONSTRAINT "AppointmentReminderBranchPolicy_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentReminderPolicy"
  ADD CONSTRAINT "AppointmentReminderPolicy_offsets_check"
  CHECK ("firstOffsetHours" > "finalOffsetHours" AND "finalOffsetHours" > 0);
ALTER TABLE "AppointmentReminderPolicy"
  ADD CONSTRAINT "AppointmentReminderPolicy_window_check"
  CHECK ("sendWindowStartMinutes" >= 0 AND "sendWindowEndMinutes" <= 1440 AND "sendWindowStartMinutes" < "sendWindowEndMinutes");
ALTER TABLE "AppointmentReminderPolicy"
  ADD CONSTRAINT "AppointmentReminderPolicy_attempts_check"
  CHECK ("maxAttempts" BETWEEN 1 AND 10);
ALTER TABLE "AppointmentReminderBranchPolicy"
  ADD CONSTRAINT "AppointmentReminderBranchPolicy_offsets_check"
  CHECK ("firstOffsetHours" IS NULL OR "finalOffsetHours" IS NULL OR "firstOffsetHours" > "finalOffsetHours");
ALTER TABLE "AppointmentReminderBranchPolicy"
  ADD CONSTRAINT "AppointmentReminderBranchPolicy_window_check"
  CHECK ("sendWindowStartMinutes" IS NULL OR "sendWindowEndMinutes" IS NULL OR "sendWindowStartMinutes" < "sendWindowEndMinutes");

INSERT INTO "Permission" (id, key, name, description, module, "isSystem", "isActive", "createdAt", "updatedAt")
VALUES (
  'perm_appointment_reminders_manage',
  'appointments.reminders.manage',
  'Administrar recordatorios automáticos',
  'Permite configurar, reintentar y resolver recordatorios automáticos de citas.',
  'agenda',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  "isActive" = true,
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role.id, permission.id, CURRENT_TIMESTAMP
FROM "Role" role
JOIN "Permission" permission ON permission.key = 'appointments.reminders.manage'
WHERE LOWER(role.code) IN ('owner', 'super_admin', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
