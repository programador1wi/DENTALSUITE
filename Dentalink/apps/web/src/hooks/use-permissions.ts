import { useAuthStore } from "@/stores/auth.store";

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return {
    user,
    hasPermission,
    can: hasPermission
  };
}
