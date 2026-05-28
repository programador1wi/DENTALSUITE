import { useQuery } from "@tanstack/react-query";
import { listPermissions, type PermissionListItem } from "../services/permissions.service";

export function usePermissionsQuery(search?: string, module?: string, active = "true") {
  return useQuery<PermissionListItem[], Error>({
    queryKey: ["settings", "permissions", search, module, active],
    queryFn: () => listPermissions({ search, module, active })
  });
}
