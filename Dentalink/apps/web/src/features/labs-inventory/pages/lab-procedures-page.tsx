import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TableActionGroup, TableToolbar } from "@/components/ui/table-toolbar";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePriceLists, useUpdatePriceList } from "@/features/settings/price-lists/hooks/use-price-lists";
import type { PriceList, PriceListItem } from "@/features/settings/price-lists/services/price-lists.service";
import {
  useProcedureCategories,
  useProcedureMutations,
  useProcedures
} from "@/features/settings/procedures/hooks/use-procedures";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";
import { LabInfoBanner, LabsPrimaryAction, LabsWorkspace } from "../components/labs-workspace";
import type { LabProcedureAssignment } from "../services/labs-inventory.service";
import { useLabProcedureAssignments, useLabProviders, useLabsInventoryMutations } from "../hooks/use-labs-inventory";

type Currency = "MXN" | "USD" | "EUR";

type LabAssignmentDraft = {
  enabled: boolean;
  patientPrice: string;
  currency: Currency;
};

type LabProcedureForm = {
  categoryId: string;
  code: string;
  name: string;
  description: string;
  defaultDuration: string;
  price: string;
  currency: Currency;
  requiresTooth: boolean;
  requiresSurface: boolean;
  labAssignments: Record<string, LabAssignmentDraft>;
};

const emptyForm: LabProcedureForm = {
  categoryId: "",
  code: "",
  name: "",
  description: "",
  defaultDuration: "30",
  price: "",
  currency: "MXN",
  requiresTooth: false,
  requiresSurface: false,
  labAssignments: {}
};

function normalizeItems(items: PriceListItem[]) {
  return items.map((item) => ({
    procedureId: item.procedureId,
    priceListCategoryId: item.priceListCategoryId ?? undefined,
    price: item.price,
    labCost: item.labCost,
    allowsDiscount: item.allowsDiscount,
    currency: item.currency
  }));
}

function replacePrice(list: PriceList, procedureId: string, price: string, currency: Currency) {
  const current = normalizeItems(list.items);
  const existing = current.find((item) => item.procedureId === procedureId);
  const next = {
    procedureId,
    priceListCategoryId: existing?.priceListCategoryId,
    price,
    labCost: existing?.labCost,
    allowsDiscount: existing?.allowsDiscount,
    currency
  };
  return current.some((item) => item.procedureId === procedureId)
    ? current.map((item) => (item.procedureId === procedureId ? next : item))
    : [...current, next];
}

function formatMoney(value: string | number, currency: Currency) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value));
}

function money(item?: PriceListItem) {
  if (!item) return "Sin precio";
  return formatMoney(item.price, item.currency);
}

function duration(value: string) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 30;
  return Math.max(5, Math.min(600, Math.round(next)));
}

export function LabProceduresPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LabProcedureForm>(emptyForm);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [deactivating, setDeactivating] = useState<Procedure | null>(null);

  const procedures = useProcedures(search || undefined, "true");
  const categories = useProcedureCategories(undefined, "true");
  const lists = usePriceLists(undefined, "true");
  const providers = useLabProviders(undefined, "true");
  const labAssignments = useLabProcedureAssignments();
  const updateList = useUpdatePriceList();
  const procedureMutations = useProcedureMutations();
  const labMutations = useLabsInventoryMutations();

  const genericList = lists.data?.find((list) => list.isDefault) ?? lists.data?.[0] ?? null;
  const labProcedures = (procedures.data ?? []).filter((procedure) => procedure.requiresLab);
  const priceByProcedureId = useMemo(
    () => new Map(genericList?.items.map((item) => [item.procedureId, item]) ?? []),
    [genericList]
  );
  const labAssignmentsByProcedureId = useMemo(() => {
    const grouped = new Map<string, Map<string, LabProcedureAssignment>>();
    for (const assignment of labAssignments.data ?? []) {
      const procedureAssignments = grouped.get(assignment.procedureId) ?? new Map<string, LabProcedureAssignment>();
      procedureAssignments.set(assignment.labProviderId, assignment);
      grouped.set(assignment.procedureId, procedureAssignments);
    }
    return grouped;
  }, [labAssignments.data]);

  const buildLabAssignments = (procedureId?: string): Record<string, LabAssignmentDraft> => {
    const procedureAssignments = procedureId ? labAssignmentsByProcedureId.get(procedureId) : undefined;
    return Object.fromEntries(
      (providers.data ?? []).map((provider) => {
        const assignment = procedureAssignments?.get(provider.id);
        return [
          provider.id,
          {
            enabled: assignment?.isActive ?? false,
            patientPrice: assignment?.patientPrice ?? "",
            currency: assignment?.currency ?? "MXN"
          }
        ];
      })
    );
  };

  const assignedLabsFor = (procedureId: string) =>
    Array.from(labAssignmentsByProcedureId.get(procedureId)?.values() ?? []).filter((assignment) => assignment.isActive);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: categories.data?.[0]?.id ?? "",
      labAssignments: buildLabAssignments()
    });
    setFormOpen(true);
  };

  const openEdit = (procedure: Procedure) => {
    const item = priceByProcedureId.get(procedure.id);
    setEditing(procedure);
    setForm({
      categoryId: procedure.categoryId,
      code: procedure.code,
      name: procedure.name,
      description: procedure.description ?? "",
      defaultDuration: String(procedure.defaultDuration),
      price: item?.price ?? "",
      currency: item?.currency ?? "MXN",
      requiresTooth: procedure.requiresTooth,
      requiresSurface: procedure.requiresSurface,
      labAssignments: buildLabAssignments(procedure.id)
    });
    setFormOpen(true);
  };

  const persistPrice = async (procedureId: string, price: string, currency: Currency) => {
    if (!genericList || !price.trim()) return;
    await updateList.mutateAsync({
      id: genericList.id,
      payload: { items: replacePrice(genericList, procedureId, price, currency) }
    });
  };

  const submitProcedure = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.categoryId || !form.code.trim() || !form.name.trim()) return;

    const payload = {
      categoryId: form.categoryId,
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      defaultDuration: duration(form.defaultDuration),
      requiresTooth: form.requiresTooth,
      requiresSurface: form.requiresSurface,
      requiresLab: true
    };

    const procedure = editing
      ? await procedureMutations.updateProcedure.mutateAsync({ id: editing.id, payload })
      : await procedureMutations.createProcedure.mutateAsync(payload);

    await persistPrice(procedure.id, form.price, form.currency);
    await labMutations.updateLabProcedureAssignments.mutateAsync({
      procedureId: procedure.id,
      assignments: (providers.data ?? []).map((provider) => {
        const assignment = form.labAssignments[provider.id];
        return {
          labProviderId: provider.id,
          isAssigned: assignment?.enabled ?? false,
          patientPrice: assignment?.patientPrice.trim() || undefined,
          currency: assignment?.currency ?? form.currency
        };
      })
    });
    setFormOpen(false);
  };

  if (procedures.isError) return <ErrorState message={procedures.error.message} />;
  if (categories.isError) return <ErrorState message={categories.error.message} />;
  if (lists.isError) return <ErrorState message={lists.error.message} />;
  if (providers.isError) return <ErrorState message={providers.error.message} />;
  if (labAssignments.isError) return <ErrorState message={labAssignments.error.message} />;

  return (
    <LabsWorkspace
      title="Procedimientos de laboratorio"
      description="Prestaciones que se cobran al paciente y requieren trabajo de laboratorio."
      action={<LabsPrimaryAction onClick={openCreate}>Nuevo procedimiento</LabsPrimaryAction>}
    >
      <div className="space-y-4">
        <LabInfoBanner>
          Estos precios son los que se cobraran al paciente desde el listado generico
          {genericList ? <strong> {genericList.name}</strong> : null}.
        </LabInfoBanner>

        <TableToolbar
          search={
            <EntitySearchBox
              placeholder="Buscar procedimiento por codigo o nombre"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? labProcedures : []}
              onSelect={(procedure) => {
                setSearch(procedure.name);
                openEdit(procedure);
              }}
              getItemKey={(procedure) => procedure.id}
              emptyMessage="Sin procedimientos encontrados"
              renderItem={(procedure) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{procedure.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{procedure.code} · {procedure.category.name}</p>
                </div>
              )}
            />
          }
          filters={
            <div className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)]">
              <span className="font-semibold">Listado generico:</span>
              {genericList ? genericList.name : "No hay listado activo"}
            </div>
          }
        />

        {procedures.isLoading || lists.isLoading || providers.isLoading || labAssignments.isLoading ? (
          <LoadingState message="Cargando procedimientos de laboratorio..." />
        ) : !labProcedures.length ? (
          <EmptyState
            title="Sin procedimientos"
            description="Crea un procedimiento de laboratorio para comenzar."
          />
        ) : (
          <DataTable
            rows={labProcedures}
            getRowKey={(procedure) => procedure.id}
            empty={<EmptyState title="Sin procedimientos" description="Crea un procedimiento de laboratorio para comenzar." />}
            columns={[
              { key: "code", title: "Codigo", mobileLabel: "Codigo", cellClassName: "font-medium" },
              {
                key: "name",
                title: "Nombre",
                primary: true,
                wrap: true,
                render: (procedure) => (
                  <div className="min-w-56">
                    <p className="font-semibold text-[var(--text-brand-strong)]">{procedure.name}</p>
                    {procedure.description ? <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{procedure.description}</p> : null}
                  </div>
                )
              },
              { key: "category", title: "Categoria", render: (procedure) => procedure.category.name },
              { key: "defaultDuration", title: "Precio paciente generico", cellClassName: "font-semibold", render: (procedure) => money(priceByProcedureId.get(procedure.id)) },
              {
                key: "description",
                title: "Laboratorios",
                wrap: true,
                render: (procedure) => assignedLabsFor(procedure.id).length ? (
                  <div className="min-w-52 space-y-1">
                    {assignedLabsFor(procedure.id).map((assignment) => (
                      <p key={assignment.id} className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                        <span className="font-semibold">{assignment.labProvider?.name ?? "Laboratorio"}</span>
                        {" - "}
                        {assignment.patientPrice ? formatMoney(assignment.patientPrice, assignment.currency) : "Precio generico"}
                      </p>
                    ))}
                  </div>
                ) : <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">Sin laboratorios asignados</span>
              },
              { key: "isActive", title: "Estado", render: () => <Badge value="HABILITADO" tone="success" dot /> },
              {
                key: "id",
                title: "Opciones",
                actions: true,
                headerClassName: "text-right",
                render: (procedure) => (
                  <TableActionGroup>
                    <Button variant="secondary" onClick={() => openEdit(procedure)}>Editar</Button>
                    <Button variant="danger" onClick={() => setDeactivating(procedure)}>Deshabilitar</Button>
                  </TableActionGroup>
                )
              }
            ]}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? "Editar procedimiento" : "Nuevo procedimiento de laboratorio"}
        onClose={() => setFormOpen(false)}
      >
        <form className="space-y-3" onSubmit={submitProcedure}>
          <label className="block text-sm font-medium text-slate-700">
            Categoria
            <Select
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">Selecciona categoria</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Codigo
              <Input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Duracion sugerida
              <Input
                type="number"
                min="5"
                max="600"
                value={form.defaultDuration}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultDuration: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Descripcion
            <Textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="text-sm font-medium text-slate-700">
              Precio paciente generico
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Moneda
              <Select
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value as Currency }))
                }
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </label>
          </div>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <Flag
              label="Requiere diente"
              checked={form.requiresTooth}
              onChange={(requiresTooth) => setForm((current) => ({ ...current, requiresTooth }))}
            />
            <Flag
              label="Requiere superficie"
              checked={form.requiresSurface}
              onChange={(requiresSurface) => setForm((current) => ({ ...current, requiresSurface }))}
            />
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Laboratorios asignados</p>
              <p className="text-xs text-slate-500">
                Marca los laboratorios que prestan este procedimiento. Si el precio queda vacio, se usara el
                precio paciente generico.
              </p>
            </div>
            {providers.data?.length ? (
              <div className="space-y-2">
                {providers.data.map((provider) => {
                  const assignment = form.labAssignments[provider.id] ?? {
                    enabled: false,
                    patientPrice: "",
                    currency: form.currency
                  };
                  return (
                    <div
                      key={provider.id}
                      className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_150px_110px]"
                    >
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={assignment.enabled}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              labAssignments: {
                                ...current.labAssignments,
                                [provider.id]: {
                                  ...(current.labAssignments[provider.id] ?? {
                                    patientPrice: "",
                                    currency: current.currency
                                  }),
                                  enabled: event.target.checked
                                }
                              }
                            }))
                          }
                        />
                        {provider.name}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Precio paciente"
                        disabled={!assignment.enabled}
                        value={assignment.patientPrice}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            labAssignments: {
                              ...current.labAssignments,
                              [provider.id]: {
                                ...(current.labAssignments[provider.id] ?? {
                                  enabled: true,
                                  currency: current.currency
                                }),
                                patientPrice: event.target.value
                              }
                            }
                          }))
                        }
                      />
                      <Select
                        value={assignment.currency}
                        disabled={!assignment.enabled}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            labAssignments: {
                              ...current.labAssignments,
                              [provider.id]: {
                                ...(current.labAssignments[provider.id] ?? {
                                  enabled: true,
                                  patientPrice: ""
                                }),
                                currency: event.target.value as Currency
                              }
                            }
                          }))
                        }
                      >
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </Select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-amber-700">
                Necesitas al menos un laboratorio habilitado para asignar este procedimiento.
              </p>
            )}
          </div>
          {!genericList ? (
            <p className="text-sm text-amber-700">
              Se creara el procedimiento, pero necesitas una lista de precios activa para guardar el precio
              generico.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                procedureMutations.createProcedure.isPending ||
                procedureMutations.updateProcedure.isPending ||
                updateList.isPending ||
                labMutations.updateLabProcedureAssignments.isPending
              }
            >
              {editing ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deshabilitar procedimiento"
        description={
          deactivating
            ? `Se deshabilitara ${deactivating.name} para nuevos tratamientos.`
            : "Se deshabilitara el procedimiento."
        }
        confirmLabel={procedureMutations.deactivateProcedure.isPending ? "Deshabilitando..." : "Deshabilitar"}
        onCancel={() => setDeactivating(null)}
        onConfirm={() => {
          if (!deactivating) return;
          void procedureMutations.deactivateProcedure
            .mutateAsync(deactivating.id)
            .then(() => setDeactivating(null));
        }}
      />
    </LabsWorkspace>
  );
}

function Flag({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
