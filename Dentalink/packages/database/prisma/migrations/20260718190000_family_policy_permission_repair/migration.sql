-- Repair environments where the family-policy schema was created before the
-- corresponding Prisma migration was registered. The statements are
-- intentionally idempotent and are a no-op on clean installations.
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
