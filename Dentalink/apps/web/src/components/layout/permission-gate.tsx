import type { PropsWithChildren } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export function PermissionGate({ permission, children }: PropsWithChildren<{ permission: string }>) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}
