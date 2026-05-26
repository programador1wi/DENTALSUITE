import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Tabs } from "@/components/ui/tabs";
import {
  useProcedureCategories,
  useProcedureMutations,
  useProcedures
} from "@/features/settings/procedures/hooks/use-procedures";
import type {
  Procedure,
  ProcedureCategory
} from "@/features/settings/procedures/services/procedures.service";
import {
  useCreatePriceList,
  useDeactivatePriceList,
  usePriceLists,
  useUpdatePriceList
} from "../hooks/use-price-lists";
import type {
  PriceList,
  PriceListItem,
  PriceListPayload
} from "../services/price-lists.service";

type PriceSection = "list" | "clinical" | "lab";
type Currency = "MXN" | "USD" | "EUR";

type ListForm = {
  name: string;
  description: string;
  isDefault: boolean;
};

type PriceForm = {
  procedure: Procedure;
  price: string;
  currency: Currency;
};

type ProcedureForm = {
  code: string;
  name: string;
  description: string;
  defaultDuration: string;
  requiresTooth: boolean;
  requiresSurface: boolean;
  requiresLab: boolean;
  price: string;
  currency: Currency;
};

const emptyListForm: ListForm = {
  name: "",
  description: "",
  isDefault: false
};

const emptyProcedureForm: ProcedureForm = {
  code: "",
  name: "",
  description: "",
  defaultDuration: "30",
  requiresTooth: false,
  requiresSurface: false,
  requiresLab: false,
  price: "",
  currency: "MXN"
};

function normalizeItems(items: PriceListItem[]) {
  return items.map((item) => ({
    procedureId: item.procedureId,
    price: item.price,
    currency: item.currency
  }));
}

function replaceItem(list: PriceList, procedureId: string, price: string, currency: Currency) {
  const item = { procedureId, price, currency };
  const present = list.items.some((current) => current.procedureId === procedureId);
  if (!present) return [...normalizeItems(list.items), item];

  return normalizeItems(list.items).map((current) =>
    current.procedureId === procedureId ? item : current
  );
}

function removeItem(list: PriceList, procedureId: string) {
  return normalizeItems(list.items).filter((item) => item.procedureId !== procedureId);
}

function money(value?: string, currency: Currency = "MXN") {
  if (!value) return "Sin precio";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value));
}

function categoryMatchesSection(
  category: ProcedureCategory,
  procedures: Procedure[],
  section: PriceSection,
  search: string
) {
  const normalizedSearch = search.trim().toLowerCase();
  const sectionProcedures = procedures.filter((procedure) => {
    if (procedure.categoryId !== category.id) return false;
    if (section === "clinical") return !procedure.requiresLab;
    if (section === "lab") return procedure.requiresLab;
    return true;
  });

  if (!normalizedSearch) return section === "list" || sectionProcedures.length > 0;
  if (category.name.toLowerCase().includes(normalizedSearch)) return true;

  return sectionProcedures.some((procedure) =>
    [procedure.code, procedure.name, procedure.description ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  );
}

function isVisibleProcedure(procedure: Procedure, section: PriceSection) {
  if (section === "clinical") return !procedure.requiresLab;
  if (section === "lab") return procedure.requiresLab;
  return true;
}

function asDuration(value: string) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return 30;
  return Math.min(600, Math.max(5, Math.round(duration)));
}

export function PriceListsSettingsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<PriceSection>("list");
  const [selectedListId, setSelectedListId] = useState("");
  const [listForm, setListForm] = useState<ListForm>(emptyListForm);
  const [listModalMode, setListModalMode] = useState<"create" | "edit" | null>(null);
  const [priceForm, setPriceForm] = useState<PriceForm | null>(null);
  const [procedureForm, setProcedureForm] = useState<ProcedureForm>(emptyProcedureForm);
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProcedureCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [deactivateCategory, setDeactivateCategory] = useState<ProcedureCategory | null>(null);
  const [deactivateList, setDeactivateList] = useState<PriceList | null>(null);
  const [removePriceFor, setRemovePriceFor] = useState<Procedure | null>(null);

  const categoryId = params.get("category") ?? "";
  const lists = usePriceLists(undefined, "true");
  const categories = useProcedureCategories(undefined, "true");
  const catalogProcedures = useProcedures(search || undefined, "true");
  const categoryProcedures = useProcedures(search || undefined, "true", categoryId || undefined);
  const createList = useCreatePriceList();
  const updateList = useUpdatePriceList();
  const deactivatePriceList = useDeactivatePriceList();
  const procedureMutations = useProcedureMutations();

  useEffect(() => {
    if (!selectedListId && lists.data?.length) {
      const defaultList = lists.data.find((list) => list.isDefault) ?? lists.data[0];
      setSelectedListId(defaultList.id);
    }
  }, [lists.data, selectedListId]);

  const selectedList = lists.data?.find((list) => list.id === selectedListId) ?? null;
  const selectedCategory = categories.data?.find((category) => category.id === categoryId) ?? null;
  const sectionProcedures = (categoryProcedures.data ?? []).filter((procedure) =>
    isVisibleProcedure(procedure, section)
  );
  const filteredCategories = (categories.data ?? []).filter((category) =>
    categoryMatchesSection(category, catalogProcedures.data ?? [], section, search)
  );
  const priceByProcedureId = useMemo(
    () => new Map(selectedList?.items.map((item) => [item.procedureId, item]) ?? []),
    [selectedList]
  );

  const persistItems = async (items: PriceListPayload["items"]) => {
    if (!selectedList) return;
    await updateList.mutateAsync({
      id: selectedList.id,
      payload: { items }
    });
  };

  const openCategory = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("category", id);
    setParams(next);
  };

  const closeCategory = () => {
    const next = new URLSearchParams(params);
    next.delete("category");
    setParams(next);
  };

  const openCreateList = () => {
    setListForm(emptyListForm);
    setListModalMode("create");
  };

  const openEditList = () => {
    if (!selectedList) return;
    setListForm({
      name: selectedList.name,
      description: selectedList.description ?? "",
      isDefault: selectedList.isDefault
    });
    setListModalMode("edit");
  };

  const submitList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listForm.name.trim()) return;

    if (listModalMode === "create") {
      const created = await createList.mutateAsync({
        name: listForm.name.trim(),
        description: listForm.description.trim() || undefined,
        isDefault: listForm.isDefault,
        items: []
      });
      setSelectedListId(created.id);
    }

    if (listModalMode === "edit" && selectedList) {
      await updateList.mutateAsync({
        id: selectedList.id,
        payload: {
          name: listForm.name.trim(),
          description: listForm.description.trim() || undefined,
          isDefault: listForm.isDefault
        }
      });
    }

    setListModalMode(null);
  };

  const submitPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!priceForm || !selectedList || Number(priceForm.price) < 0) return;
    await persistItems(replaceItem(selectedList, priceForm.procedure.id, priceForm.price, priceForm.currency));
    setPriceForm(null);
  };

  const submitProcedure = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCategory || !procedureForm.code.trim() || !procedureForm.name.trim()) return;

    const created = await procedureMutations.createProcedure.mutateAsync({
      categoryId: selectedCategory.id,
      code: procedureForm.code.trim(),
      name: procedureForm.name.trim(),
      description: procedureForm.description.trim() || undefined,
      defaultDuration: asDuration(procedureForm.defaultDuration),
      requiresTooth: procedureForm.requiresTooth,
      requiresSurface: procedureForm.requiresSurface,
      requiresLab: procedureForm.requiresLab
    });

    if (selectedList && procedureForm.price.trim()) {
      await persistItems(replaceItem(selectedList, created.id, procedureForm.price, procedureForm.currency));
    }

    setProcedureForm(emptyProcedureForm);
    setProcedureModalOpen(false);
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCategory || !categoryName.trim()) return;
    await procedureMutations.updateCategory.mutateAsync({
      id: editingCategory.id,
      payload: { name: categoryName.trim() }
    });
    setEditingCategory(null);
  };

  if (lists.isError) return <ErrorState message={lists.error.message} />;
  if (categories.isError) return <ErrorState message={categories.error.message} />;
  if (catalogProcedures.isError) return <ErrorState message={catalogProcedures.error.message} />;
  if (categoryProcedures.isError) return <ErrorState message={categoryProcedures.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Listas de precios"
        description="Gestiona listados, categorias y precios de prestaciones desde un mismo flujo."
        helpText="Selecciona un listado, entra a una categoria y ajusta el precio de cada procedimiento sin usar identificadores tecnicos."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 pt-4">
          <Tabs
            active={section}
            onChange={(next) => setSection(next as PriceSection)}
            items={[
              { key: "list", label: "Listado de precios" },
              { key: "clinical", label: "Acciones clinicas" },
              { key: "lab", label: "Laboratorio" }
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreateList}>Nuevo listado</Button>
            <Link to="/settings/procedures">
              <Button variant="secondary">Catalogo</Button>
            </Link>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(240px,320px)_1fr_auto]">
            <label className="text-sm font-medium text-slate-700">
              Listado activo
              <Select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)} className="mt-1">
                {!lists.data?.length ? <option value="">Sin listados</option> : null}
                {lists.data?.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}{list.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </Select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Buscar prestacion, codigo o categoria
              <Input
                className="mt-1"
                placeholder="Ej. consulta, endodoncia o codigo interno"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <Button variant="secondary" onClick={openEditList} disabled={!selectedList}>
                Editar listado
              </Button>
              <Button variant="danger" onClick={() => setDeactivateList(selectedList)} disabled={!selectedList || !selectedList.isActive}>
                Desactivar
              </Button>
            </div>
          </div>

          {selectedList ? (
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              <Badge value={selectedList.isDefault ? "LISTA DEFAULT" : "LISTA ACTIVA"} tone={selectedList.isDefault ? "success" : "default"} />
              <span className="rounded-full bg-slate-100 px-3 py-1">{selectedList.items.length} precios configurados</span>
              {selectedList.description ? <span className="rounded-full bg-slate-100 px-3 py-1">{selectedList.description}</span> : null}
            </div>
          ) : null}
        </div>
      </Card>

      {lists.isLoading || categories.isLoading ? <LoadingState message="Cargando catalogo de precios..." /> : null}

      {!lists.isLoading && !selectedList ? (
        <EmptyState title="Sin listado activo" description="Crea un listado para configurar precios de prestaciones." />
      ) : selectedCategory ? (
        <CategoryDetail
          category={selectedCategory}
          list={selectedList}
          prices={priceByProcedureId}
          procedures={sectionProcedures}
          loading={categoryProcedures.isLoading}
          section={section}
          onBack={closeCategory}
          onNewProcedure={() => {
            setProcedureForm((current) => ({
              ...current,
              requiresLab: section === "lab"
            }));
            setProcedureModalOpen(true);
          }}
          onEditPrice={(procedure) => {
            const item = priceByProcedureId.get(procedure.id);
            setPriceForm({
              procedure,
              price: item?.price ?? "",
              currency: item?.currency ?? "MXN"
            });
          }}
          onRemovePrice={setRemovePriceFor}
        />
      ) : (
        <CategoryList
          categories={filteredCategories}
          procedures={catalogProcedures.data ?? []}
          loading={catalogProcedures.isLoading}
          section={section}
          onOpen={openCategory}
          onEdit={(category) => {
            setEditingCategory(category);
            setCategoryName(category.name);
          }}
          onDeactivate={setDeactivateCategory}
        />
      )}

      <Modal open={Boolean(listModalMode)} title={listModalMode === "edit" ? "Editar listado" : "Nuevo listado"} onClose={() => setListModalMode(null)}>
        <form className="space-y-3" onSubmit={submitList}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input value={listForm.name} onChange={(event) => setListForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Descripcion
            <Textarea rows={3} value={listForm.description} onChange={(event) => setListForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={listForm.isDefault}
              onChange={(event) => setListForm((current) => ({ ...current, isDefault: event.target.checked }))}
            />
            Usar como listado default
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setListModalMode(null)}>Cancelar</Button>
            <Button disabled={createList.isPending || updateList.isPending}>{listModalMode === "edit" ? "Actualizar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(priceForm)} title="Precio de prestacion" onClose={() => setPriceForm(null)}>
        {priceForm ? (
          <form className="space-y-3" onSubmit={submitPrice}>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{priceForm.procedure.code}</p>
              <p className="font-semibold text-slate-900">{priceForm.procedure.name}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <label className="text-sm font-medium text-slate-700">
                Precio final
                <Input type="number" min="0" step="0.01" value={priceForm.price} onChange={(event) => setPriceForm((current) => current ? ({ ...current, price: event.target.value }) : current)} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Moneda
                <Select value={priceForm.currency} onChange={(event) => setPriceForm((current) => current ? ({ ...current, currency: event.target.value as Currency }) : current)}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setPriceForm(null)}>Cancelar</Button>
              <Button disabled={!priceForm.price.trim() || updateList.isPending}>Guardar precio</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={procedureModalOpen} title="Nueva prestacion" onClose={() => setProcedureModalOpen(false)}>
        <form className="space-y-3" onSubmit={submitProcedure}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Codigo
              <Input value={procedureForm.code} onChange={(event) => setProcedureForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Duracion sugerida
              <Input type="number" min="5" max="600" value={procedureForm.defaultDuration} onChange={(event) => setProcedureForm((current) => ({ ...current, defaultDuration: event.target.value }))} />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input value={procedureForm.name} onChange={(event) => setProcedureForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Descripcion
            <Textarea rows={2} value={procedureForm.description} onChange={(event) => setProcedureForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="text-sm font-medium text-slate-700">
              Precio en este listado
              <Input type="number" min="0" step="0.01" value={procedureForm.price} onChange={(event) => setProcedureForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Moneda
              <Select value={procedureForm.currency} onChange={(event) => setProcedureForm((current) => ({ ...current, currency: event.target.value as Currency }))}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </label>
          </div>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
            <Checkbox label="Requiere diente" checked={procedureForm.requiresTooth} onChange={(requiresTooth) => setProcedureForm((current) => ({ ...current, requiresTooth }))} />
            <Checkbox label="Requiere superficie" checked={procedureForm.requiresSurface} onChange={(requiresSurface) => setProcedureForm((current) => ({ ...current, requiresSurface }))} />
            <Checkbox label="Requiere laboratorio" checked={procedureForm.requiresLab} onChange={(requiresLab) => setProcedureForm((current) => ({ ...current, requiresLab }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setProcedureModalOpen(false)}>Cancelar</Button>
            <Button disabled={procedureMutations.createProcedure.isPending}>Crear prestacion</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingCategory)} title="Editar categoria" onClose={() => setEditingCategory(null)}>
        <form className="space-y-3" onSubmit={submitCategory}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditingCategory(null)}>Cancelar</Button>
            <Button disabled={procedureMutations.updateCategory.isPending}>Actualizar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateCategory)}
        title="Desactivar categoria"
        description={deactivateCategory ? `Se desactivara la categoria ${deactivateCategory.name}.` : "Se desactivara la categoria."}
        confirmLabel={procedureMutations.deactivateCategory.isPending ? "Desactivando..." : "Desactivar"}
        onCancel={() => setDeactivateCategory(null)}
        onConfirm={() => {
          if (!deactivateCategory) return;
          void procedureMutations.deactivateCategory.mutateAsync(deactivateCategory.id).then(() => setDeactivateCategory(null));
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateList)}
        title="Desactivar listado"
        description={deactivateList ? `Se desactivara el listado ${deactivateList.name}.` : "Se desactivara el listado."}
        confirmLabel={deactivatePriceList.isPending ? "Desactivando..." : "Desactivar"}
        onCancel={() => setDeactivateList(null)}
        onConfirm={() => {
          if (!deactivateList) return;
          void deactivatePriceList.mutateAsync(deactivateList.id).then(() => {
            setSelectedListId("");
            setDeactivateList(null);
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(removePriceFor)}
        title="Quitar precio"
        description={removePriceFor ? `Se quitara el precio de ${removePriceFor.name} en el listado seleccionado.` : "Se quitara el precio."}
        confirmLabel={updateList.isPending ? "Quitando..." : "Quitar"}
        onCancel={() => setRemovePriceFor(null)}
        onConfirm={() => {
          if (!selectedList || !removePriceFor) return;
          void persistItems(removeItem(selectedList, removePriceFor.id)).then(() => setRemovePriceFor(null));
        }}
      />
    </div>
  );
}



function CategoryList({
  categories,
  procedures,
  loading,
  section,
  onOpen,
  onEdit,
  onDeactivate
}: {
  categories: ProcedureCategory[];
  procedures: Procedure[];
  loading: boolean;
  section: PriceSection;
  onOpen: (id: string) => void;
  onEdit: (category: ProcedureCategory) => void;
  onDeactivate: (category: ProcedureCategory) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Categorias de prestaciones</h2>
        <p className="text-sm text-slate-500">
          Entra a una categoria para ver sus prestaciones y ajustar precios del listado seleccionado.
        </p>
      </div>
      {loading ? (
        <div className="p-5"><LoadingState message="Buscando prestaciones..." /></div>
      ) : !categories.length ? (
        <div className="p-5"><EmptyState title="Sin categorias" description="No hay categorias que coincidan con la busqueda." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Tipo visible</th>
                <th className="px-5 py-3">Prestaciones</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const visibleProcedures = procedures.filter((procedure) =>
                  procedure.categoryId === category.id && isVisibleProcedure(procedure, section)
                );
                return (
                  <tr key={category.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => onOpen(category.id)}>
                        {category.name}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {section === "lab" ? "Laboratorio" : section === "clinical" ? "Accion clinica" : "Clinica y laboratorio"}
                    </td>
                    <td className="px-5 py-4">{visibleProcedures.length || "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => onOpen(category.id)}>Entrar</Button>
                        <Button variant="secondary" onClick={() => onEdit(category)}>Editar</Button>
                        <Button variant="danger" onClick={() => onDeactivate(category)}>Desactivar</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CategoryDetail({
  category,
  list,
  prices,
  procedures,
  loading,
  section,
  onBack,
  onNewProcedure,
  onEditPrice,
  onRemovePrice
}: {
  category: ProcedureCategory;
  list: PriceList | null;
  prices: Map<string, PriceListItem>;
  procedures: Procedure[];
  loading: boolean;
  section: PriceSection;
  onBack: () => void;
  onNewProcedure: () => void;
  onEditPrice: (procedure: Procedure) => void;
  onRemovePrice: (procedure: Procedure) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <button type="button" className="mb-2 text-sm font-semibold text-brand-700 hover:underline" onClick={onBack}>
            Volver a categorias
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {list?.name ?? "Listado"} / {category.name}
          </h2>
          <p className="text-sm text-slate-500">
            {section === "lab" ? "Prestaciones de laboratorio" : section === "clinical" ? "Acciones clinicas" : "Prestaciones del catalogo"}
          </p>
        </div>
        <Button onClick={onNewProcedure}>Nueva prestacion</Button>
      </div>

      {loading ? (
        <div className="p-5"><LoadingState message="Cargando prestaciones..." /></div>
      ) : !procedures.length ? (
        <div className="p-5"><EmptyState title="Sin prestaciones" description="Crea una prestacion o cambia el filtro visible." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Codigo</th>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Precio final</th>
                <th className="px-5 py-3">Laboratorio</th>
                <th className="px-5 py-3">Reglas clinicas</th>
                <th className="px-5 py-3 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map((procedure) => {
                const price = prices.get(procedure.id);
                return (
                  <tr key={procedure.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-medium text-slate-700">{procedure.code}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{procedure.name}</p>
                      {procedure.description ? <p className="text-xs text-slate-500">{procedure.description}</p> : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className={price ? "font-semibold text-slate-900" : "text-amber-700"}>
                        {money(price?.price, price?.currency)}
                      </span>
                    </td>
                    <td className="px-5 py-4">{procedure.requiresLab ? "Requiere" : "No"}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {procedure.requiresTooth ? <Badge value="DIENTE" tone="default" /> : null}
                        {procedure.requiresSurface ? <Badge value="SUPERFICIE" tone="default" /> : null}
                        {!procedure.requiresTooth && !procedure.requiresSurface ? <span className="text-slate-400">Sin regla dental</span> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => onEditPrice(procedure)}>{price ? "Editar precio" : "Asignar precio"}</Button>
                        <Button variant="secondary" onClick={() => onRemovePrice(procedure)} disabled={!price}>
                          Quitar precio
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
