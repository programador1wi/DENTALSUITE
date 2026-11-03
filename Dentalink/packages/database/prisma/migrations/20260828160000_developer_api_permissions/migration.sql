WITH permission_seed("key", "name", "description", "module", "action", "resource") AS (
  VALUES
    (
      'developer_api.credentials.read',
      'Ver credenciales de API',
      'Permite consultar credenciales y consumo de integraciones externas sin revelar secretos.',
      'developer_api',
      'read',
      'developer_api.credentials'
    ),
    (
      'developer_api.credentials.manage',
      'Administrar credenciales de API',
      'Permite crear, editar, rotar y revocar credenciales de integraciones externas.',
      'developer_api',
      'manage',
      'developer_api.credentials'
    )
)
INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource",
  "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT
  'perm_devapi_' || substr(md5(ps."key"), 1, 18),
  ps."key", ps."name", ps."description", ps."module", ps."key", ps."action", ps."resource",
  true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permission_seed ps
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "code" = EXCLUDED."code",
  "action" = EXCLUDED."action",
  "resource" = EXCLUDED."resource",
  "isSystem" = true,
  "isActive" = true,
  "deletedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
JOIN "Permission" permission
  ON permission."key" IN ('developer_api.credentials.read', 'developer_api.credentials.manage')
WHERE
  role."isActive"
  AND (
    lower(COALESCE(role."code", '')) IN ('super_admin', 'admin')
    OR upper(role."name") IN ('SUPER_ADMIN', 'ADMIN', 'SUPER ADMINISTRADOR', 'ADMINISTRADOR')
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
