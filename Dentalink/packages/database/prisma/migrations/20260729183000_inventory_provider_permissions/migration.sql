WITH permissions("key", "name", "description") AS (
  VALUES
    ('inventory.products.view', 'View inventory products', 'View inventory product catalog and details'),
    ('inventory.products.create', 'Create inventory products', 'Create inventory products and catalog records'),
    ('inventory.products.update', 'Update inventory products', 'Update inventory products and catalog records'),
    ('inventory.products.reactivate', 'Reactivate inventory products', 'Reactivate inventory products'),
    ('inventory.entries.create', 'Create inventory entries', 'Post stock entries'),
    ('inventory.exits.create', 'Create inventory exits', 'Post stock exits'),
    ('inventory.transfers.create', 'Create inventory transfers', 'Transfer stock between warehouses'),
    ('inventory.waste.create', 'Create inventory waste', 'Post waste and loss movements'),
    ('inventory.movements.compensate', 'Compensate inventory movements', 'Create auditable compensating movements'),
    ('inventory.safety_stock.update', 'Update safety stock', 'Update minimum stock by product and warehouse'),
    ('inventory.reports.export', 'Export inventory reports', 'Export inventory and movement reports'),
    ('inventory.audit.view', 'View inventory audit', 'View inventory audit history'),
    ('inventory.costs.view', 'View inventory costs', 'View average costs and valuation'),
    ('inventory.stock_counts.create', 'Create inventory stock counts', 'Create physical inventory counts'),
    ('inventory.stock_counts.reconcile', 'Reconcile inventory stock counts', 'Reconcile physical counts against stock')
)
INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource",
  "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT
  md5("key"), "key", "name", "description", 'inventory', "key",
  split_part("key", '.', 2), split_part("key", '.', 1),
  true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEYE')
  AND permission."key" IN (
    'inventory.products.view',
    'inventory.products.create',
    'inventory.products.update',
    'inventory.products.reactivate',
    'inventory.entries.create',
    'inventory.exits.create',
    'inventory.transfers.create',
    'inventory.waste.create',
    'inventory.movements.compensate',
    'inventory.safety_stock.update',
    'inventory.reports.export',
    'inventory.audit.view',
    'inventory.costs.view',
    'inventory.stock_counts.create',
    'inventory.stock_counts.reconcile'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
