ALTER TABLE "Organization"
  ADD COLUMN "branchScopeVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
  ADD COLUMN "authorizationVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Session"
  ADD COLUMN "refreshVersion" INTEGER NOT NULL DEFAULT 0;

INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource",
  "isSystem", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'permission_organization_manage_all',
  'organization.manage_all',
  'Administrar toda la organización',
  'Permite administrar todas las sucursales y funciones dentro de la organización.',
  'organization',
  'organization.manage_all',
  'manage_all',
  'organization',
  TRUE,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "code" = EXCLUDED."code",
  "action" = EXCLUDED."action",
  "resource" = EXCLUDED."resource",
  "isSystem" = TRUE,
  "isActive" = TRUE,
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
CROSS JOIN "Permission" AS permission
WHERE permission."key" = 'organization.manage_all'
  AND (
    role."code" IN ('super_admin', 'super_administrador')
    OR role."name" IN ('SUPER_ADMIN', 'Super Administrador')
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

DELETE FROM "RolePermission"
WHERE "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "key" = 'system.manage_all'
);

DELETE FROM "UserPermission"
WHERE "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "key" = 'system.manage_all'
);

DELETE FROM "PermissionProfileEntry"
WHERE "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "key" = 'system.manage_all'
);

UPDATE "Permission"
SET "isActive" = FALSE,
    "deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'system.manage_all';

UPDATE "Session"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "revokedAt" IS NULL;
