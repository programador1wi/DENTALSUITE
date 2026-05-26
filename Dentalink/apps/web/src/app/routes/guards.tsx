import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";

export function RequireAuth() {
  const token = useAuthStore((state) => state.accessToken);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireGuest() {
  const token = useAuthStore((state) => state.accessToken);
  return token ? <Navigate to="/agenda/list" replace /> : <Outlet />;
}

export function RequirePermissions({ required }: { required: string[] }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const allowed = required.every((permission) => hasPermission(permission));
  return allowed ? <Outlet /> : <Navigate to="/agenda/list" replace />;
}
