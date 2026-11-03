import { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS } from "@dentalwarner/shared";
import type { PermissionListItem } from "./services/permissions.service";

export { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS };

export function getPermissionLabel(permission: PermissionListItem) {
  return PERMISSION_LABELS[permission.key] ?? permission.name ?? permission.key ?? permission.code ?? permission.action;
}

export function getPermissionDescription(permission: PermissionListItem) {
  return PERMISSION_DESCRIPTIONS[permission.key] ?? permission.description;
}
