import { useAuthStore } from "@/stores/auth.store";

export function isAuthenticated() {
  return Boolean(useAuthStore.getState().accessToken);
}

export function hasPermission(permission: string) {
  return useAuthStore.getState().hasPermission(permission);
}
