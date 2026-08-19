import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { TableActionGroup, TableToolbar } from "@/components/ui/table-toolbar";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { LabInfoBanner, LabsPrimaryAction, LabsWorkspace } from "../components/labs-workspace";
import { useLabProviders, useLabsInventoryMutations } from "../hooks/use-labs-inventory";
import type { LabProvider } from "../services/labs-inventory.service";

type ProviderForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  details: string;
};

const emptyProvider: ProviderForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  details: ""
};

export function LabsPage({ enabledOnly = false }: { enabledOnly?: boolean }) {
  const [search, setSearch] = useState("");
  const [providerForm, setProviderForm] = useState<ProviderForm>(emptyProvider);
  const [editing, setEditing] = useState<LabProvider | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<LabProvider | null>(null);
  const providers = useLabProviders(search || undefined, enabledOnly ? "true" : undefined);
  const mutations = useLabsInventoryMutations();

  const openCreate = () => {
    setEditing(null);
    setProviderForm(emptyProvider);
    setFormOpen(true);
  };

  const openEdit = (provider: LabProvider) => {
    setEditing(provider);
    setProviderForm({
      name: provider.name,
      phone: provider.phone ?? "",
      email: provider.email ?? "",
      address: provider.address ?? "",
      details: provider.details ?? ""
    });
    setFormOpen(true);
  };

  const submitProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!providerForm.name.trim()) return;

    const payload = {
      name: providerForm.name.trim(),
      phone: providerForm.phone.trim() || undefined,
      email: providerForm.email.trim() || undefined,
      address: providerForm.address.trim() || undefined,
      details: providerForm.details.trim() || undefined
    };

    if (editing) {
      await mutations.updateLabProvider.mutateAsync({ id: editing.id, payload });
    } else {
      await mutations.createLabProvider.mutateAsync(payload);
    }

    setFormOpen(false);
  };

  if (providers.isError) return <ErrorState message={providers.error.message} />;

  return (
    <LabsWorkspace
      title={enabledOnly ? "Laboratorios habilitados" : "Laboratorios"}
      description={enabledOnly ? "Laboratorios activos disponibles para solicitudes." : "Proveedores de laboratorio para trabajos clinicos."}
      action={<LabsPrimaryAction onClick={openCreate}>Nuevo laboratorio</LabsPrimaryAction>}
    >
      <div className="space-y-4">
        <LabInfoBanner>
          Los laboratorios habilitados son los proveedores que pueden recibir solicitudes de trabajos clinicos.
        </LabInfoBanner>

        <TableToolbar
          search={
            <EntitySearchBox
              placeholder="Buscar laboratorio por nombre, telefono o email"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? providers.data ?? [] : []}
              onSelect={(provider) => {
                setSearch(provider.name);
                openEdit(provider);
              }}
              getItemKey={(provider) => provider.id}
              emptyMessage="Sin laboratorios encontrados"
              renderItem={(provider) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{provider.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[provider.phone, provider.email].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                </div>
              )}
            />
          }
        />

        {providers.isLoading ? (
          <LoadingState message="Cargando laboratorios..." />
        ) : !providers.data?.length ? (
          <EmptyState title="Sin laboratorios" description="No hay laboratorios para los filtros seleccionados." />
        ) : (
          <DataTable
            rows={providers.data}
            getRowKey={(provider) => provider.id}
            empty={<EmptyState title="Sin laboratorios" description="No hay laboratorios para los filtros seleccionados." />}
            columns={[
              {
                key: "name",
                title: "Laboratorio",
                primary: true,
                wrap: true,
                render: (provider) => (
                  <div className="min-w-56">
                    <p className="font-semibold text-[var(--text-brand-strong)]">{provider.name}</p>
                    {provider.address ? <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{provider.address}</p> : null}
                    {provider.details ? <p className="mt-1 max-w-xl text-[var(--text-xs)] text-[var(--text-secondary)]">{provider.details}</p> : null}
                  </div>
                )
              },
              { key: "phone", title: "Telefono", render: (provider) => provider.phone || "-" },
              { key: "email", title: "Email", wrap: true, render: (provider) => provider.email || "-" },
              {
                key: "isActive",
                title: "Estado",
                render: (provider) => <Badge value={provider.isActive ? "HABILITADO" : "DESHABILITADO"} tone={provider.isActive ? "success" : "warning"} dot />
              },
              {
                key: "id",
                title: "Opciones",
                actions: true,
                headerClassName: "text-right",
                render: (provider) => (
                  <TableActionGroup>
                    <Button variant="secondary" onClick={() => openEdit(provider)}>Editar</Button>
                    <Button variant="danger" onClick={() => setDeactivating(provider)} disabled={!provider.isActive}>Deshabilitar</Button>
                  </TableActionGroup>
                )
              }
            ]}
          />
        )}
      </div>

      <Modal open={formOpen} title={editing ? "Editar laboratorio" : "Nuevo laboratorio"} onClose={() => setFormOpen(false)}>
        <form className="space-y-3" onSubmit={submitProvider}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input value={providerForm.name} onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Telefono
              <Input value={providerForm.phone} onChange={(event) => setProviderForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Email
              <Input type="email" value={providerForm.email} onChange={(event) => setProviderForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Direccion
            <Textarea
              className="min-h-12"
              rows={2}
              value={providerForm.address}
              onChange={(event) => setProviderForm((current) => ({ ...current, address: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Detalles
            <Textarea
              className="min-h-20"
              rows={3}
              value={providerForm.details}
              onChange={(event) => setProviderForm((current) => ({ ...current, details: event.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button disabled={mutations.createLabProvider.isPending || mutations.updateLabProvider.isPending}>
              {editing ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deshabilitar laboratorio"
        description={deactivating ? `Se deshabilitara ${deactivating.name} para nuevas solicitudes.` : "Se deshabilitara el laboratorio."}
        confirmLabel={mutations.deactivateLabProvider.isPending ? "Deshabilitando..." : "Deshabilitar"}
        onCancel={() => setDeactivating(null)}
        onConfirm={() => {
          if (!deactivating) return;
          void mutations.deactivateLabProvider.mutateAsync(deactivating.id).then(() => setDeactivating(null));
        }}
      />
    </LabsWorkspace>
  );
}
