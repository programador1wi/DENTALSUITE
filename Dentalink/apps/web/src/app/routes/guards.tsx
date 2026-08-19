import { Navigate, Outlet } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionDeniedState } from "@/components/feedback/permission-denied-state";
import { firstAuthorizedPath, hasRequiredPermissions, type PermissionMode } from "@/components/layout/navigation";
import { useMeQuery } from "@/features/auth/hooks/use-me";
import { useAuthStore } from "@/stores/auth.store";
import { APP_ROUTES } from "@/lib/routes";

export function RequireAuth() {
  const token = useAuthStore((state) => state.accessToken);
  const session = useMeQuery(Boolean(token));

  if (!token) return <Navigate to={APP_ROUTES.auth.login} replace />;

  if (session.isLoading || !session.data) {
    if (session.isError) {
      return (
        <div className="p-5">
          <ErrorState message={session.error.message} />
        </div>
      );
    }
    return (
      <div className="p-5">
        <LoadingState message="Validando sesión..." />
      </div>
    );
  }

  return <Outlet />;
}

export function RequireGuest() {
  const token = useAuthStore((state) => state.accessToken);
  return token ? <Navigate to="/" replace /> : <Outlet />;
}

export function RequirePermissions({ required }: { required: string[] }) {
  return <PermissionBoundary required={required} mode="all" />;
}

export function RequireAnyPermission({ required }: { required: string[] }) {
  return <PermissionBoundary required={required} mode="any" />;
}

function PermissionBoundary({ required, mode }: { required: string[]; mode: PermissionMode }) {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const allowed = hasRequiredPermissions(permissions, required, mode);
  return allowed ? <Outlet /> : <PermissionDeniedState variant="page" />;
}

export function AuthorizedHomeRedirect() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  return <Navigate to={firstAuthorizedPath(permissions)} replace />;
}
