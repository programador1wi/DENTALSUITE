export const ROLE_CODES = {
  SUPER_ADMIN: "super_admin",
  CORPORATE_ADMIN: "corporate_admin",
  BRANCH_ADMIN: "branch_admin",
  RECEPTIONIST: "receptionist",
  CASHIER: "cashier",
  DOCTOR: "doctor",
  SPECIALIST: "specialist",
  ASSISTANT: "assistant",
  COLLECTIONS: "collections",
  MARKETING: "marketing"
} as const;

export const PERMISSIONS = {
  ORGANIZATION_MANAGE_ALL: "organization.manage_all",
  DASHBOARD_READ: "dashboard.read",
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DEACTIVATE: "users.deactivate",
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DEACTIVATE: "roles.deactivate",
  PERMISSIONS_READ: "permissions.read",
  PERMISSIONS_CREATE: "permissions.create",
  PERMISSIONS_UPDATE: "permissions.update",
  PERMISSIONS_DEACTIVATE: "permissions.deactivate",
  BRANCHES_READ: "branches.read",
  BRANCHES_CREATE: "branches.create",
  BRANCHES_UPDATE: "branches.update",
  BRANCHES_DEACTIVATE: "branches.deactivate",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update"
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export * from "./access-control";
export * from "./developer-api";
export * from "./html-policy";
