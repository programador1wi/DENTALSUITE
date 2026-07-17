WITH permissions("key", "name", "description") AS (
  VALUES
    ('photographic_templates.view', 'View photographic templates', 'View orthodontic photographic sessions'),
    ('photographic_templates.create', 'Create photographic templates', 'Create orthodontic photographic sessions'),
    ('photographic_templates.edit', 'Edit photographic templates', 'Edit and complete photographic sessions'),
    ('photographic_templates.void', 'Void photographic templates', 'Void photographic sessions with a reason'),
    ('photographic_templates.link', 'Link photographic templates', 'Link sessions to appointments, controls and evolutions'),
    ('photographic_templates.mobile_upload', 'Create mobile photo uploads', 'Create secure short-lived mobile upload invitations'),
    ('photographic_templates.compare', 'Compare photographic templates', 'Compare equivalent photographic positions'),
    ('photographic_templates.view_voided', 'View voided photographic templates', 'View voided photographic clinical records'),
    ('photographic_templates.configure_frequency', 'Configure photographic frequency', 'Configure photographic reminder policy'),
    ('photographic_templates.configure_slots', 'Configure photographic positions', 'Configure photographic slot catalog'),
    ('photographic_photos.upload', 'Upload orthodontic photos', 'Upload photos into clinical positions'),
    ('photographic_photos.edit', 'Edit orthodontic photos', 'Apply non-destructive clinical image transformations'),
    ('photographic_photos.replace', 'Replace orthodontic photos', 'Replace a photo while preserving its history'),
    ('photographic_photos.void', 'Void orthodontic photos', 'Void a clinical photo with a reason')
)
INSERT INTO "Permission" ("id", "key", "name", "description", "module", "code", "action", "resource", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT md5("key"), "key", "name", "description", 'clinical', "key", split_part("key", '.', 2), split_part("key", '.', 1), true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
WHERE role."name" IN ('SUPER_ADMIN', 'ADMIN')
  AND split_part(permission."key", '.', 1) IN ('photographic_templates', 'photographic_photos')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'DENTIST'
  AND permission."key" IN (
    'photographic_templates.view',
    'photographic_templates.create',
    'photographic_templates.edit',
    'photographic_templates.void',
    'photographic_templates.link',
    'photographic_templates.mobile_upload',
    'photographic_templates.compare',
    'photographic_templates.view_voided',
    'photographic_photos.upload',
    'photographic_photos.edit',
    'photographic_photos.replace',
    'photographic_photos.void'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" = 'RECEPTIONIST'
  AND permission."key" IN (
    'photographic_templates.view',
    'photographic_templates.create',
    'photographic_templates.mobile_upload',
    'photographic_templates.compare',
    'photographic_photos.upload'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
