import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Modal } from "@/components/ui/modal";

type FieldOption = {
  label: string;
  value: string;
};

type FieldConfig = {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "textarea" | "checkbox" | "select";
  required?: boolean;
  options?: FieldOption[];
};

type ColumnConfig<T> = {
  key: keyof T;
  title: string;
  render?: (row: T) => ReactNode;
};

type MutateFn = (payload: Record<string, unknown>) => Promise<unknown>;

type CrudActions<T> = {
  create: MutateFn;
  update: (id: string, payload: Record<string, unknown>) => Promise<unknown>;
  deactivate: (id: string) => Promise<unknown>;
  mapToForm: (row: T) => Record<string, unknown>;
  mapToPayload?: (form: Record<string, unknown>) => Record<string, unknown>;
  getId: (row: T) => string;
};

function normalizeInitial(fields: FieldConfig[]) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "checkbox") result[field.key] = false;
    else result[field.key] = "";
  }
  return result;
}

function fieldValueToRender(value: unknown) {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  return (value as string) ?? "";
}

function rowSearchLabel<T extends Record<string, unknown>>(row: T, columns: ColumnConfig<T>[]) {
  const first = columns[0] ? fieldValueToRender(row[columns[0].key]) : "";
  const second = columns[1] ? fieldValueToRender(row[columns[1].key]) : "";
  return [first, second].filter(Boolean).join(" · ") || "Registro";
}

export function SimpleCrudPage<T extends Record<string, unknown>>({
  title,
  description,
  helpText,
  showHeader = true,
  rows,
  loading,
  error,
  search,
  setSearch,
  active,
  setActive,
  fields,
  columns,
  actions,
  useModal = false
}: {
  title: string;
  description: string;
  helpText?: string;
  showHeader?: boolean;
  rows: T[] | undefined;
  loading: boolean;
  error?: string;
  search: string;
  setSearch: (value: string) => void;
  active: string;
  setActive: (value: string) => void;
  fields: FieldConfig[];
  columns: ColumnConfig<T>[];
  actions: CrudActions<T>;
  useModal?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(() => normalizeInitial(fields));
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mapToPayload = actions.mapToPayload ?? ((current) => current);

  const activeRow = useMemo(() => {
    if (!rows || !editingId) return null;
    return rows.find((row) => actions.getId(row) === editingId) ?? null;
  }, [rows, editingId, actions]);

  const onReset = () => {
    setEditingId(null);
    setForm(normalizeInitial(fields));
    setIsModalOpen(false);
  };

  const onEdit = (row: T) => {
    setEditingId(actions.getId(row));
    setForm(actions.mapToForm(row));
    setIsModalOpen(true);
  };

  const onNew = () => {
    setEditingId(null);
    setForm(normalizeInitial(fields));
    setIsModalOpen(true);
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = mapToPayload(form);
      if (editingId) {
        await actions.update(editingId, payload);
      } else {
        await actions.create(payload);
      }
      onReset();
    } finally {
      setSubmitting(false);
    }
  };

  const renderFields = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const isCheckbox = field.type === "checkbox";
        const gridClass = field.type === "textarea" ? "sm:col-span-2" : "";
        return (
          <div key={field.key} className={gridClass}>
            {isCheckbox ? (
              <label className="flex h-full cursor-pointer select-none items-center gap-2 text-sm font-medium text-slate-700 sm:pt-6">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  checked={Boolean(form[field.key])}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.checked }))}
                />
                <span>{field.label}</span>
              </label>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>{field.label}</span>
                {field.type === "textarea" ? (
                  <Textarea
                    value={String(form[field.key] ?? "")}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={String(form[field.key] ?? "")}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  >
                    <option value="">Selecciona</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={field.type}
                    value={fieldValueToRender(form[field.key])}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                )}
              </label>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {showHeader ? <PageHeader title={title} description={description} helpText={helpText} /> : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <EntitySearchBox
                placeholder="Buscar"
                value={search}
                onValueChange={setSearch}
                items={search.trim() ? rows ?? [] : []}
                onSelect={(row) => {
                  setSearch(rowSearchLabel(row, columns));
                  onEdit(row);
                }}
                getItemKey={(row) => actions.getId(row)}
                emptyMessage="Sin registros encontrados"
                renderItem={(row) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{rowSearchLabel(row, columns)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">Seleccionar para editar</p>
                  </div>
                )}
              />
            </div>
            <HelpTooltip content="Filtra la lista de registros en tiempo real buscando coincidencias por nombre o texto clave." />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={active} onChange={(event) => setActive(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </Select>
            </div>
            <HelpTooltip content="Filtra los registros por su estado de activación. Los elementos inactivos no estarán disponibles para nuevas operaciones." />
          </div>
          {useModal ? (
            <div className="flex items-center justify-end">
              <Button onClick={onNew}>Nuevo</Button>
            </div>
          ) : null}
        </div>
      </Card>

      {useModal ? (
        <Modal open={isModalOpen} title={editingId ? `Editar ${title}` : `Crear ${title}`} onClose={onReset} size="lg">
          <div className="space-y-4">
            {renderFields()}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={onReset} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : (
        <Card>
          <h3 className="mb-3 text-base font-semibold text-slate-900">{editingId ? "Editar" : "Crear"}</h3>
          {renderFields()}

          <div className="mt-4 flex gap-2">
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </Button>
            {editingId ? (
              <Button variant="secondary" onClick={onReset} disabled={submitting}>
                Cancelar edicion
              </Button>
            ) : null}
          </div>
        </Card>
      )}

      {loading ? <LoadingState message="Cargando registros..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {rows ? (
        <DataTable
          rows={rows}
          empty={<EmptyState title="Sin registros" description="No hay elementos para mostrar." />}
          columns={[
            ...columns,
            {
              key: columns[0].key,
              title: "Acciones",
              render: (row) => {
                const id = actions.getId(row);
                const canDeactivate = (row as { isActive?: boolean }).isActive !== false;

                return (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => onEdit(row)}>
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await actions.deactivate(id);
                        if (activeRow && actions.getId(activeRow) === id) onReset();
                      }}
                      disabled={!canDeactivate}
                    >
                      Desactivar
                    </Button>
                  </div>
                );
              }
            }
          ]}
        />
      ) : null}
    </div>
  );
}
