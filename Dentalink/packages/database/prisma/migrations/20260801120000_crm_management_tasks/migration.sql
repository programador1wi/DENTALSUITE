ALTER TYPE "PatientTaskStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "CrmTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "CrmTaskOrigin" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "CrmTaskDelayUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

ALTER TABLE "PatientTask"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "priority" "CrmTaskPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "origin" "CrmTaskOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "trigger" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "PatientTask" task
SET
  "branchId" = patient."branchId",
  "title" = task."type"
FROM "Patient" patient
WHERE patient."id" = task."patientId";

ALTER TABLE "PatientTask"
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "title" SET NOT NULL;

CREATE TABLE "CrmTaskHistory" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmTaskHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmTaskConfiguration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "delayValue" INTEGER NOT NULL,
  "delayUnit" "CrmTaskDelayUnit" NOT NULL DEFAULT 'DAYS',
  "defaultAssignedToId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmTaskConfiguration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmTaskConfiguration_delayValue_check" CHECK ("delayValue" >= 0 AND "delayValue" <= 3650),
  CONSTRAINT "CrmTaskConfiguration_type_check" CHECK ("type" IN ('COBRANZA', 'CAPTURA', 'CONTROL', 'CITA'))
);

CREATE UNIQUE INDEX "PatientTask_organizationId_idempotencyKey_key"
  ON "PatientTask"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "PatientTask_organizationId_sourceType_sourceId_trigger_type_key"
  ON "PatientTask"("organizationId", "sourceType", "sourceId", "trigger", "type");
CREATE INDEX "PatientTask_organizationId_branchId_status_dueDate_idx"
  ON "PatientTask"("organizationId", "branchId", "status", "dueDate");
CREATE INDEX "PatientTask_organizationId_branchId_assignedToId_status_idx"
  ON "PatientTask"("organizationId", "branchId", "assignedToId", "status");
CREATE INDEX "PatientTask_organizationId_branchId_type_status_idx"
  ON "PatientTask"("organizationId", "branchId", "type", "status");
CREATE INDEX "CrmTaskHistory_taskId_createdAt_idx" ON "CrmTaskHistory"("taskId", "createdAt");
CREATE UNIQUE INDEX "CrmTaskConfiguration_organizationId_branchId_type_key"
  ON "CrmTaskConfiguration"("organizationId", "branchId", "type");
CREATE INDEX "CrmTaskConfiguration_organizationId_branchId_idx"
  ON "CrmTaskConfiguration"("organizationId", "branchId");

ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmTaskHistory" ADD CONSTRAINT "CrmTaskHistory_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "PatientTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmTaskHistory" ADD CONSTRAINT "CrmTaskHistory_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmTaskConfiguration" ADD CONSTRAINT "CrmTaskConfiguration_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmTaskConfiguration" ADD CONSTRAINT "CrmTaskConfiguration_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmTaskConfiguration" ADD CONSTRAINT "CrmTaskConfiguration_defaultAssignedToId_fkey"
  FOREIGN KEY ("defaultAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmTaskConfiguration" ADD CONSTRAINT "CrmTaskConfiguration_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmTaskConfiguration" ADD CONSTRAINT "CrmTaskConfiguration_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH permissions("key", "name", "description") AS (
  VALUES
    ('crm.tasks.read', 'View CRM tasks', 'View management tasks and history'),
    ('crm.tasks.create', 'Create CRM tasks', 'Create manual management tasks'),
    ('crm.tasks.update', 'Update CRM tasks', 'Edit and reassign management tasks'),
    ('crm.tasks.complete', 'Complete CRM tasks', 'Complete management tasks'),
    ('crm.tasks.reopen', 'Reopen CRM tasks', 'Reopen completed management tasks'),
    ('crm.tasks.cancel', 'Cancel CRM tasks', 'Cancel management tasks with a reason'),
    ('crm.tasks.statistics.read', 'View CRM task statistics', 'View aggregated management task statistics'),
    ('crm.tasks.configuration.read', 'View CRM task configuration', 'View automatic task deadlines'),
    ('crm.tasks.configuration.update', 'Update CRM task configuration', 'Update automatic task deadlines')
)
INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource",
  "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT
  md5("key"), "key", "name", "description", 'crm', "key",
  split_part("key", '.', 3), 'crm.tasks', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permissions
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
SELECT DISTINCT role_permission."roleId", crm_permission."id", CURRENT_TIMESTAMP
FROM "RolePermission" role_permission
JOIN "Permission" legacy_permission ON legacy_permission."id" = role_permission."permissionId"
JOIN "Permission" crm_permission ON crm_permission."key" = CASE
  WHEN legacy_permission."key" = 'patients.tasks.read' THEN 'crm.tasks.read'
  WHEN legacy_permission."key" = 'patients.tasks.create' THEN 'crm.tasks.create'
  WHEN legacy_permission."key" = 'patients.tasks.update' THEN 'crm.tasks.update'
  WHEN legacy_permission."key" = 'patients.tasks.complete' THEN 'crm.tasks.complete'
END
WHERE legacy_permission."key" IN (
  'patients.tasks.read', 'patients.tasks.create', 'patients.tasks.update', 'patients.tasks.complete'
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  AND permission."key" IN (
    'crm.tasks.reopen', 'crm.tasks.cancel', 'crm.tasks.statistics.read',
    'crm.tasks.configuration.read', 'crm.tasks.configuration.update'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
