import type { PropsWithChildren, ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export interface PermissionGateProps {
  permission: string | string[];
  mode?: "all" | "any";
  fallback?: ReactNode;
}

export function PermissionGate({
  permission,
  mode = "all",
  fallback = null,
  children
}: PropsWithChildren<PermissionGateProps>) {
  const { hasPermission } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];

  const allowed =
    mode === "any"
      ? permissions.some((p) => hasPermission(p))
      : permissions.every((p) => hasPermission(p));

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
