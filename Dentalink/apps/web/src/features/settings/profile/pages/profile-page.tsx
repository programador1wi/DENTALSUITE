import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useMeQuery } from "@/features/auth/hooks/use-me";

export function ProfilePage() {
  const me = useMeQuery(true);

  if (me.isLoading) return <LoadingState message="Cargando perfil..." />;
  if (me.isError) return <ErrorState message={me.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Perfil" description="Informaci�n del usuario autenticado" />
      <Card>
        <dl className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">Nombre</dt>
            <dd>{me.data?.firstName} {me.data?.lastName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Correo</dt>
            <dd>{me.data?.email}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Roles</dt>
            <dd>{me.data?.roleNames.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Organizaci�n</dt>
            <dd>{me.data?.organizationId}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
