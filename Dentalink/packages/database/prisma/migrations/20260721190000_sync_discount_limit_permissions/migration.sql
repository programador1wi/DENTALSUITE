INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "isSystem", "isActive", "createdAt", "updatedAt"
)
VALUES
  (
    'perm_' || md5('treatment_discount.configure_user_limits'),
    'treatment_discount.configure_user_limits',
    'Configure user discount limits',
    'Configure the maximum treatment discount authorized for each user',
    'treatment_plans', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'perm_' || md5('price_lists.configure_discount_limits'),
    'price_lists.configure_discount_limits',
    'Configure procedure discount limits',
    'Configure discount eligibility and maximum percentage by tariff item',
    'price_lists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  AND role."deletedAt" IS NULL
  AND permission."key" IN (
    'treatment_discount.configure_user_limits',
    'price_lists.configure_discount_limits'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
