import { applyDecorators, SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";
export const PERMISSIONS_MODE_KEY = "permissions_mode";
export const RequirePermissions = (...permissions: string[]) => applyDecorators(
  SetMetadata(PERMISSIONS_KEY, permissions),
  SetMetadata(PERMISSIONS_MODE_KEY, "all")
);
export const RequireAnyPermission = (...permissions: string[]) => applyDecorators(
  SetMetadata(PERMISSIONS_KEY, permissions),
  SetMetadata(PERMISSIONS_MODE_KEY, "any")
);

// Backward compatibility alias.
export const Permissions = RequirePermissions;
