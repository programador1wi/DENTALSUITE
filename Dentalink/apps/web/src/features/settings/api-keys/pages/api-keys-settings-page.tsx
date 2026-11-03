import { useEffect, useMemo, useState } from "react";
import { ExternalLink, KeyRound, Pencil, Plus, RefreshCw, Search, ShieldX, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionGate } from "@/components/layout/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TableActionGroup, TableResultCount, TableToolbar } from "@/components/ui/table-toolbar";
import { APP_ROUTES } from "@/lib/routes";
import { CredentialSecretDialog } from "../components/credential-secret-dialog";
import { useApiKeys, useRevokeApiKey, useRotateApiKey } from "../hooks/use-api-keys";
import type { ApiKey, ApiKeyStatus, SecretResponse } from "../services/api-keys.service";

const STATUS_LABELS: Record<ApiKeyStatus, string> = {
  ACTIVE: "Activa",
  EXPIRING: "Por vencer",
  ROTATING: "En rotacion",
  EXPIRED: "Expirada",
  REVOKED: "Revocada"
};

function statusTone(status: ApiKeyStatus): "success" | "warning" | "danger" | "brand" {
  if (status === "ACTIVE") return "success";
  if (status === "ROTATING") return "brand";
  if (status === "EXPIRING") return "warning";
  return "danger";
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Nunca";
}

export function ApiKeysSettingsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") || "") as ApiKeyStatus | "";
  const page = Math.max(Number(params.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(params.get("pageSize") || 20), 10), 100);
  const committedSearch = params.get("search") || "";
  const [searchValue, setSearchValue] = useState(committedSearch);
  const [composing, setComposing] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiKey | null>(null);
  const [secret, setSecret] = useState<SecretResponse | null>(null);

  useEffect(() => setSearchValue(committedSearch), [committedSearch]);
  useEffect(() => {
    if (composing || searchValue === committedSearch) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (searchValue.trim()) next.set("search", searchValue.trim());
      else next.delete("search");
      next.set("page", "1");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [committedSearch, composing, params, searchValue, setParams]);

  const query = useApiKeys({ status: status || undefined, search: committedSearch || undefined, page, pageSize });
  const revoke = useRevokeApiKey();
  const rotate = useRotateApiKey();
  const rows = query.data?.items ?? [];

  const columns = useMemo(() => [
    {
      key: "name" as const,
      title: "Credencial",
      primary: true,
      wrap: true,
      render: (row: ApiKey) => (
        <div className="min-w-44">
          <p className="font-semibold text-[var(--text-brand-strong)]">{row.name}</p>
          <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">{row.keyPrefix ?? "Sin secreto vigente"}</p>
        </div>
      )
    },
    { key: "status" as const, title: "Estado", render: (row: ApiKey) => <Badge value={STATUS_LABELS[row.status]} tone={statusTone(row.status)} dot /> },
    { key: "scopes" as const, title: "Capacidades", render: (row: ApiKey) => <span className="text-xs">{row.scopes.length} autorizadas</span> },
    { key: "branchScope" as const, title: "Sucursales", render: (row: ApiKey) => <span className="text-xs">{row.branchScope === "ALL" ? "Todas" : `${row.branchIds.length} seleccionadas`}</span> },
    { key: "lastUsedAt" as const, title: "Ultimo uso", priority: "P3" as const, render: (row: ApiKey) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(row.lastUsedAt)}</span> },
    { key: "expiresAt" as const, title: "Vencimiento", render: (row: ApiKey) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(row.expiresAt)}</span> },
    {
      key: "id" as const,
      title: "Acciones",
      actions: true,
      render: (row: ApiKey) => (
        <TableActionGroup>
          <PermissionGate permission="developer_api.credentials.manage">
            {row.status !== "REVOKED" && row.status !== "EXPIRED" ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate(APP_ROUTES.settings.apiKeyEdit(row.id))}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setRotateTarget(row)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Rotar
                </Button>
                <Button variant="danger" size="sm" onClick={() => setRevokeTarget(row)}>
                  <ShieldX className="h-3.5 w-3.5" /> Revocar
                </Button>
              </>
            ) : null}
          </PermissionGate>
        </TableActionGroup>
      )
    }
  ], [navigate]);

  const updateParam = (name: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.set("page", "1");
    setParams(next);
  };

  return (
    <div>
      <PageHeader
        title="Integraciones API"
        description="Credenciales de acceso para sistemas externos. El secreto solo se muestra al crear o rotar."
        helpText="Cada solicitud valida credencial, organizacion, sucursal, IP, scope y cuota."
        secondaryActions={
          <Button variant="secondary" onClick={() => window.open("/api/docs/developer", "_blank", "noopener,noreferrer")}>
            <ExternalLink className="h-4 w-4" />Ver documentacion
          </Button>
        }
        primaryAction={
          <PermissionGate permission="developer_api.credentials.manage">
            <Button onClick={() => navigate(APP_ROUTES.settings.apiKeyNew)}><Plus className="h-4 w-4" />Nueva credencial</Button>
          </PermissionGate>
        }
      />

      <TableToolbar
        leading={<TableResultCount>{query.data?.pagination.total ?? 0} credenciales</TableResultCount>}
        search={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
            <Input
              aria-label="Buscar credenciales"
              placeholder="Buscar por nombre"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              className="pl-9 pr-10"
            />
            {searchValue ? (
              <button
                type="button"
                aria-label="Limpiar busqueda"
                onClick={() => setSearchValue("")}
                className="absolute right-1 top-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        }
        filters={
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Filtrar por estado" value={status} onChange={(event) => updateParam("status", event.target.value || undefined)}>
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select aria-label="Credenciales por pagina" value={String(pageSize)} onChange={(event) => updateParam("pageSize", event.target.value)}>
              <option value="10">10 por pagina</option>
              <option value="20">20 por pagina</option>
              <option value="50">50 por pagina</option>
              <option value="100">100 por pagina</option>
            </Select>
          </div>
        }
      />

      <div className="mt-[var(--space-4)]">
        {query.isLoading ? <LoadingState message="Cargando credenciales..." /> : null}
        {query.isError ? <ErrorState message={query.error.message} /> : null}
        {query.isSuccess ? (
          <DataTable
            rows={rows}
            columns={columns}
            mobileView="list"
            getRowKey={(row) => row.id}
            empty={<EmptyState title={committedSearch || status ? "Sin resultados" : "Aun no hay credenciales"} description={committedSearch || status ? "Ajusta busqueda o estado." : "Crea una credencial para conectar el primer sistema externo."} icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} />}
          />
        ) : null}
      </div>

      {query.data && query.data.pagination.totalPages > 1 ? (
        <nav aria-label="Paginacion" className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-secondary)]">Pagina {page} de {query.data.pagination.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={page >= query.data.pagination.totalPages} onClick={() => updateParam("page", String(page + 1))}>Siguiente</Button>
          </div>
        </nav>
      ) : null}

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        title="Rotar credencial"
        description={`Se generara un secreto nuevo para ${rotateTarget?.name ?? "esta credencial"}. El anterior funcionara durante 24 horas.`}
        confirmLabel={rotate.isPending ? "Rotando..." : "Rotar secreto"}
        variant="warning"
        isLoading={rotate.isPending}
        onCancel={() => { if (!rotate.isPending) setRotateTarget(null); }}
        onConfirm={async () => {
          if (!rotateTarget) return;
          try {
            setSecret(await rotate.mutateAsync(rotateTarget.id));
            setRotateTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No fue posible rotar la credencial");
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revocar credencial"
        description={`El acceso de ${revokeTarget?.name ?? "esta credencial"} se bloqueara inmediatamente y no podra reactivarse.`}
        confirmLabel={revoke.isPending ? "Revocando..." : "Revocar credencial"}
        isLoading={revoke.isPending}
        onCancel={() => { if (!revoke.isPending) setRevokeTarget(null); }}
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revoke.mutateAsync(revokeTarget.id);
            toast.success("Credencial revocada");
            setRevokeTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No fue posible revocar la credencial");
          }
        }}
      />
      <CredentialSecretDialog value={secret} onDone={() => setSecret(null)} />
    </div>
  );
}
