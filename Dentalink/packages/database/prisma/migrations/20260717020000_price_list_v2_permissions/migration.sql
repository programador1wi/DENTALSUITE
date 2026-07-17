WITH permission_seed("key", "name", "description", "module") AS (
  VALUES
    ('price_list.view', 'View versioned price lists', 'View price lists and published versions', 'price_lists'),
    ('price_list.create', 'Create versioned price lists', 'Create price list drafts', 'price_lists'),
    ('price_list.edit_draft', 'Edit price list drafts', 'Edit draft versions and price items', 'price_lists'),
    ('price_list.publish', 'Publish price lists', 'Publish immutable price list versions', 'price_lists'),
    ('price_list.schedule', 'Schedule price lists', 'Schedule future price list versions', 'price_lists'),
    ('price_list.deactivate', 'Deactivate versioned price lists', 'Deactivate price list versions', 'price_lists'),
    ('price_list.compare_versions', 'Compare price list versions', 'Compare price list version changes', 'price_lists'),
    ('price_list.import', 'Import price lists', 'Import price list items', 'price_lists'),
    ('price_list.export', 'Export price lists', 'Export price list items', 'price_lists'),
    ('procedure.view', 'View clinical catalog', 'View procedure definitions', 'procedures'),
    ('procedure.create', 'Create clinical catalog items', 'Create procedure definitions', 'procedures'),
    ('procedure.edit', 'Edit clinical catalog items', 'Edit procedure definitions', 'procedures'),
    ('procedure.deactivate', 'Deactivate clinical catalog items', 'Deactivate procedure definitions', 'procedures'),
    ('price_template.view', 'View price templates', 'View reusable price templates', 'price_lists'),
    ('price_template.manage', 'Manage price templates', 'Create and publish price templates', 'price_lists'),
    ('price_override.apply', 'Apply price overrides', 'Apply a reasoned manual price override', 'price_lists'),
    ('price_override.approve', 'Approve price overrides', 'Approve price overrides above policy thresholds', 'price_lists'),
    ('agreement.apply_to_plan', 'Apply agreements to plans', 'Apply agreement pricing to treatment plans', 'agreements'),
    ('laboratory_price.view', 'View laboratory pricing', 'View laboratory price and cost', 'laboratories'),
    ('laboratory_price.edit', 'Edit laboratory pricing', 'Edit laboratory price and cost', 'laboratories'),
    ('price_audit.view', 'View pricing audit', 'View price resolution and publication audit', 'price_lists')
)
INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource",
  "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT
  'perm_plv2_' || substr(md5(ps."key"), 1, 18),
  ps."key", ps."name", ps."description", ps."module", ps."key",
  split_part(ps."key", '.', 2), split_part(ps."key", '.', 1),
  true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permission_seed ps
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Administrators receive the complete pricing domain. Other clinical roles only receive read/apply capabilities.
INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."key" IN (
  'price_list.view', 'price_list.create', 'price_list.edit_draft', 'price_list.publish',
  'price_list.schedule', 'price_list.deactivate', 'price_list.compare_versions',
  'price_list.import', 'price_list.export', 'procedure.view', 'procedure.create',
  'procedure.edit', 'procedure.deactivate', 'price_template.view', 'price_template.manage',
  'price_override.apply', 'price_override.approve', 'agreement.apply_to_plan',
  'laboratory_price.view', 'laboratory_price.edit', 'price_audit.view'
)
WHERE r."isActive" AND upper(r."name") IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."key" IN (
  'price_list.view', 'procedure.view', 'price_template.view',
  'agreement.apply_to_plan', 'laboratory_price.view'
)
WHERE r."isActive" AND upper(r."name") IN ('DENTIST', 'ODONTOLOGIST', 'RECEPTIONIST', 'ASSISTANT')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

