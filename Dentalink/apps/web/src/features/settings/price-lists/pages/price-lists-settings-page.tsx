import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, MapPin, Pencil, Save, Settings, Tags, Trash2, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
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
import { useProcedureMutations } from "@/features/settings/procedures/hooks/use-procedures";
import { useUpdateBranch } from "@/features/settings/branches/hooks/use-branches";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";
import {
  useCreatePriceList,
  useDeactivatePriceList,
  usePriceListAvailabilityMatrix,
  usePriceListCategoryMutations,
  usePriceLists,
  useUpdatePriceListBranchAssignments,
  useUpdatePriceList
} from "../hooks/use-price-lists";
import type {
  BranchPriceListAssignmentPayload,
  PriceList,
  PriceListAvailabilityMatrix,
  PriceListCategory,
  PriceListItem,
  PriceListPayload,
  PriceListScopeType
} from "../services/price-lists.service";

type PriceSection = "clinical" | "availability";
type Currency = "MXN" | "USD" | "EUR";

type ListForm = {
  name: string;
  description: string;
  isDefault: boolean;
};

type PriceProcedure = Pick<
  Procedure,
  | "id"
  | "categoryId"
  | "displayId"
  | "code"
  | "name"
  | "description"
  | "defaultDuration"
  | "requiresTooth"
  | "requiresSurface"
  | "requiresLab"
  | "isActive"
>;

type CategoryForm = {
  name: string;
  description: string;
  sortOrder: string;
};

type ProductRowForm = {
  code: string;
  name: string;
  allowsDiscount: boolean;
  price: string;
  labCost: string;
};

const emptyListForm: ListForm = {
  name: "",
  description: "",
  isDefault: false
};

const emptyProductRowForm: ProductRowForm = {
  code: "",
  name: "",
  allowsDiscount: false,
  price: "",
  labCost: "0"
};

const emptyCategoryForm: CategoryForm = {
  name: "",
  description: "",
  sortOrder: "0"
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

function replaceItem(
  list: PriceList,
  priceListCategoryId: string,
  procedureId: string,
  price: string,
  labCost: string,
  allowsDiscount: boolean,
  currency: Currency = "MXN"
) {
  const item = { procedureId, priceListCategoryId, price, labCost, allowsDiscount, currency };
  const present = list.items.some((current) => current.procedureId === procedureId);
  if (!present) return [...normalizeItems(list.items), item];

  return normalizeItems(list.items).map((current) => (current.procedureId === procedureId ? item : current));
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

function procedureMatchesSearch(procedure: PriceProcedure, normalizedSearch: string) {
  if (!normalizedSearch) return true;
  return [procedure.code, procedure.name, procedure.description ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

function proceduresForPriceCategory(category: PriceListCategory) {
  const byId = new Map<string, PriceProcedure>();
  category.items.forEach((item) => byId.set(item.procedureId, item.procedure));
  return [...byId.values()];
}

function categoryMatchesSearch(category: PriceListCategory, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const procedures = proceduresForPriceCategory(category);

  if (!normalizedSearch) return true;
  if (category.name.toLowerCase().includes(normalizedSearch)) return true;

  return procedures.some((procedure) => procedureMatchesSearch(procedure, normalizedSearch));
}

function asSortOrder(value: string) {
  const sortOrder = Number(value);
  if (!Number.isFinite(sortOrder)) return 0;
  return Math.max(0, Math.round(sortOrder));
}

function decimalInput(value: string, fallback = "0") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return fallback;
  return amount.toFixed(2);
}

export function PriceListsSettingsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<PriceSection>("clinical");
  const [selectedListId, setSelectedListId] = useState("");
  const [listForm, setListForm] = useState<ListForm>(emptyListForm);
  const [listModalMode, setListModalMode] = useState<"create" | "edit" | null>(null);
  const [productForm, setProductForm] = useState<ProductRowForm>(emptyProductRowForm);
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingProcedureId, setEditingProcedureId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [categoryModalMode, setCategoryModalMode] = useState<"create" | "edit" | null>(null);
  const [editingCategory, setEditingCategory] = useState<PriceListCategory | null>(null);
  const [deactivateCategory, setDeactivateCategory] = useState<PriceListCategory | null>(null);
  const [deactivateList, setDeactivateList] = useState<PriceList | null>(null);
  const [removePriceFor, setRemovePriceFor] = useState<PriceProcedure | null>(null);

  const categoryId = params.get("category") ?? "";
  const lists = usePriceLists(undefined, "true");
  const availabilityMatrix = usePriceListAvailabilityMatrix();
  const selectedList = lists.data?.find((list) => list.id === selectedListId) ?? null;
  const selectedCategory = selectedList?.categories.find((category) => category.id === categoryId) ?? null;
  const createList = useCreatePriceList();
  const updateList = useUpdatePriceList();
  const updateBranch = useUpdateBranch();
  const updateBranchAssignments = useUpdatePriceListBranchAssignments();
  const deactivatePriceList = useDeactivatePriceList();
  const categoryMutations = usePriceListCategoryMutations();
  const procedureMutations = useProcedureMutations();

  useEffect(() => {
    if (!selectedListId && lists.data?.length) {
      const defaultList = lists.data.find((list) => list.isDefault) ?? lists.data[0];
      setSelectedListId(defaultList.id);
    }
  }, [lists.data, selectedListId]);

  useEffect(() => {
    if (!categoryId || !selectedList || selectedCategory) return;
    const next = new URLSearchParams(params);
    next.delete("category");
    setParams(next);
  }, [categoryId, params, selectedCategory, selectedList, setParams]);

  const normalizedSearch = search.trim().toLowerCase();
  const sectionProcedures = selectedCategory
    ? proceduresForPriceCategory(selectedCategory)
        .filter((procedure) => procedureMatchesSearch(procedure, normalizedSearch))
    : [];
  const filteredCategories = (selectedList?.categories ?? []).filter((category) => categoryMatchesSearch(category, search));
  const priceSearchSuggestions = useMemo(
    () =>
      (selectedList?.categories ?? []).flatMap((category) => [
        { id: `category:${category.id}`, type: "category" as const, label: category.name, category },
        ...proceduresForPriceCategory(category).map((procedure) => ({
          id: `procedure:${procedure.id}`,
          type: "procedure" as const,
          label: procedure.name,
          code: procedure.code,
          category
        }))
      ]).filter((item) => {
        const query = search.trim().toLowerCase();
        if (!query) return false;
        return [item.label, "code" in item ? item.code : "", item.category.name]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [search, selectedList]
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

  const openCreateCategory = () => {
    if (!selectedList) return;
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryModalMode("create");
  };

  const openEditCategory = (category: PriceListCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder)
    });
    setCategoryModalMode("edit");
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

  const cancelProductEdit = () => {
    setAddingProduct(false);
    setEditingProcedureId(null);
    setProductForm(emptyProductRowForm);
  };

  const openAddProduct = () => {
    setEditingProcedureId(null);
    setProductForm(emptyProductRowForm);
    setAddingProduct(true);
  };

  const openEditProduct = (procedure: PriceProcedure) => {
    const item = priceByProcedureId.get(procedure.id);
    setAddingProduct(false);
    setEditingProcedureId(procedure.id);
    setProductForm({
      code: procedure.code,
      name: procedure.name,
      allowsDiscount: item?.allowsDiscount ?? false,
      price: item?.price ?? "0",
      labCost: item?.labCost ?? "0"
    });
  };

  const saveProduct = async () => {
    if (!selectedList || !selectedCategory?.procedureCategoryId) return;
    if (!productForm.code.trim() || !productForm.name.trim()) return;

    const payload = {
      categoryId: selectedCategory.procedureCategoryId,
      code: productForm.code.trim(),
      name: productForm.name.trim(),
      defaultDuration: 30,
      requiresTooth: false,
      requiresSurface: false,
      requiresLab: Number(productForm.labCost) > 0
    };

    const procedure = editingProcedureId
      ? await procedureMutations.updateProcedure.mutateAsync({ id: editingProcedureId, payload })
      : await procedureMutations.createProcedure.mutateAsync(payload);

    const current = priceByProcedureId.get(procedure.id);
    await persistItems(
      replaceItem(
        selectedList,
        selectedCategory.id,
        procedure.id,
        decimalInput(productForm.price),
        decimalInput(productForm.labCost),
        productForm.allowsDiscount,
        current?.currency ?? "MXN"
      )
    );

    cancelProductEdit();
  };

  const updateBranchScope = async (branchId: string, payload: { brandId?: string | null; zoneId?: string | null }) => {
    await updateBranch.mutateAsync({ id: branchId, payload });
    await availabilityMatrix.refetch();
  };

  const saveBranchAvailability = async (assignments: BranchPriceListAssignmentPayload[]) => {
    if (!selectedList) return;
    await updateBranchAssignments.mutateAsync({ id: selectedList.id, assignments });
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedList || !categoryForm.name.trim()) return;

    const payload = {
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim() || undefined,
      sortOrder: asSortOrder(categoryForm.sortOrder)
    };

    if (categoryModalMode === "create") {
      await categoryMutations.createCategory.mutateAsync({
        priceListId: selectedList.id,
        payload
      });
    }

    if (categoryModalMode === "edit" && editingCategory) {
      await categoryMutations.updateCategory.mutateAsync({
        priceListId: selectedList.id,
        categoryId: editingCategory.id,
        payload
      });
    }

    setCategoryModalMode(null);
    setEditingCategory(null);
  };

  if (lists.isError) return <ErrorState message={lists.error.message} />;

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
            onChange={(next) => {
              if (next === "lab") {
                navigate("/labs");
                return;
              }
              setSection(next as PriceSection);
            }}
            items={[
              { key: "clinical", label: "Acciones clinicas" },
              { key: "lab", label: "Laboratorio" },
              { key: "availability", label: "Sucursales" }
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
              <Select
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                className="mt-1"
              >
                {!lists.data?.length ? <option value="">Sin listados</option> : null}
                {lists.data?.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                    {list.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </Select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Buscar prestacion, codigo o categoria
              <EntitySearchBox
                className="mt-1"
                placeholder="Ej. consulta, endodoncia o codigo interno"
                value={search}
                onValueChange={setSearch}
                items={priceSearchSuggestions}
                onSelect={(item) => {
                  setSearch(item.label);
                  openCategory(item.category.id);
                }}
                getItemKey={(item) => item.id}
                emptyMessage="Sin prestaciones encontradas"
                renderItem={(item) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {item.type === "procedure" ? `${item.code} · ${item.category.name}` : "Categoria"}
                    </p>
                  </div>
                )}
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <Button variant="secondary" onClick={openEditList} disabled={!selectedList}>
                Editar listado
              </Button>
              <Button
                variant="danger"
                onClick={() => setDeactivateList(selectedList)}
                disabled={!selectedList || !selectedList.isActive}
              >
                Desactivar
              </Button>
            </div>
          </div>

          {selectedList ? (
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              <Badge
                value={selectedList.isDefault ? "LISTA DEFAULT" : "LISTA ACTIVA"}
                tone={selectedList.isDefault ? "success" : "default"}
              />
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {selectedList.items.length} precios configurados
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {selectedList.categories.length} categorias del arancel
              </span>
              {selectedList.description ? (
                <span className="rounded-full bg-slate-100 px-3 py-1">{selectedList.description}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {lists.isLoading ? <LoadingState message="Cargando catalogo de precios..." /> : null}

      {section === "availability" ? (
        <PriceListAvailability
          selectedList={selectedList}
          matrix={availabilityMatrix.data}
          loading={availabilityMatrix.isLoading}
          saving={updateBranchAssignments.isPending || updateBranch.isPending}
          onSave={saveBranchAvailability}
          onBranchScopeChange={updateBranchScope}
        />
      ) : !lists.isLoading && !selectedList ? (
        <EmptyState
          title="Sin listado activo"
          description="Crea un listado para configurar precios de prestaciones."
        />
      ) : selectedCategory ? (
        <CategoryDetail
          category={selectedCategory}
          list={selectedList}
          prices={priceByProcedureId}
          procedures={sectionProcedures}
          loading={false}
          onBack={closeCategory}
          productForm={productForm}
          addingProduct={addingProduct}
          editingProcedureId={editingProcedureId}
          savingProduct={
            procedureMutations.createProcedure.isPending ||
            procedureMutations.updateProcedure.isPending ||
            updateList.isPending
          }
          onAddProduct={openAddProduct}
          onEditProduct={openEditProduct}
          onCancelProduct={cancelProductEdit}
          onSaveProduct={saveProduct}
          onProductFormChange={setProductForm}
          onRemovePrice={setRemovePriceFor}
        />
      ) : (
        <CategoryList
          categories={filteredCategories}
          loading={false}
          onCreate={openCreateCategory}
          onOpen={openCategory}
          onEdit={openEditCategory}
          onDeactivate={setDeactivateCategory}
        />
      )}

      <Modal
        open={Boolean(listModalMode)}
        title={listModalMode === "edit" ? "Editar listado" : "Nuevo listado"}
        onClose={() => setListModalMode(null)}
      >
        <form className="space-y-3" onSubmit={submitList}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input
              value={listForm.name}
              onChange={(event) => setListForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Descripcion
            <Textarea
              rows={3}
              value={listForm.description}
              onChange={(event) =>
                setListForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={listForm.isDefault}
              onChange={(event) =>
                setListForm((current) => ({ ...current, isDefault: event.target.checked }))
              }
            />
            Usar como listado default
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setListModalMode(null)}>
              Cancelar
            </Button>
            <Button disabled={createList.isPending || updateList.isPending}>
              {listModalMode === "edit" ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(categoryModalMode)}
        title={categoryModalMode === "edit" ? "Editar categoria del arancel" : "Crear categoria"}
        onClose={() => {
          setCategoryModalMode(null);
          setEditingCategory(null);
        }}
      >
        <form className="space-y-3" onSubmit={submitCategory}>
          <label className="block text-sm font-medium text-slate-700">
            Nombre
            <Input
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Descripcion
            <Textarea
              rows={3}
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Orden
            <Input
              type="number"
              min="0"
              value={categoryForm.sortOrder}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setCategoryModalMode(null);
                setEditingCategory(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={
                categoryMutations.createCategory.isPending || categoryMutations.updateCategory.isPending
              }
            >
              {categoryModalMode === "edit" ? "Actualizar" : "Crear categoria"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateCategory)}
        title="Desactivar categoria"
        description={
          deactivateCategory
            ? `Se desactivara la categoria ${deactivateCategory.name}.`
            : "Se desactivara la categoria."
        }
        confirmLabel={categoryMutations.deactivateCategory.isPending ? "Desactivando..." : "Desactivar"}
        onCancel={() => setDeactivateCategory(null)}
        onConfirm={() => {
          if (!selectedList || !deactivateCategory) return;
          void categoryMutations.deactivateCategory
            .mutateAsync({
              priceListId: selectedList.id,
              categoryId: deactivateCategory.id
            })
            .then(() => {
              if (categoryId === deactivateCategory.id) closeCategory();
              setDeactivateCategory(null);
            });
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateList)}
        title="Desactivar listado"
        description={
          deactivateList ? `Se desactivara el listado ${deactivateList.name}.` : "Se desactivara el listado."
        }
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
        title="Eliminar producto"
        description={
          removePriceFor
            ? `Se eliminara ${removePriceFor.name} de la categoria del arancel seleccionado.`
            : "Se eliminara el producto."
        }
        confirmLabel={updateList.isPending ? "Eliminando..." : "Eliminar"}
        onCancel={() => setRemovePriceFor(null)}
        onConfirm={() => {
          if (!selectedList || !removePriceFor) return;
          void persistItems(removeItem(selectedList, removePriceFor.id)).then(() => setRemovePriceFor(null));
        }}
      />
    </div>
  );
}

function PriceListAvailability({
  selectedList,
  matrix,
  loading,
  saving,
  onSave,
  onBranchScopeChange
}: {
  selectedList: PriceList | null;
  matrix?: PriceListAvailabilityMatrix;
  loading: boolean;
  saving: boolean;
  onSave: (assignments: BranchPriceListAssignmentPayload[]) => Promise<void>;
  onBranchScopeChange: (branchId: string, payload: { brandId?: string | null; zoneId?: string | null }) => Promise<void>;
}) {
  const [brandId, setBrandId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Record<string, { enabled: boolean; type: PriceListScopeType; isDefault: boolean }>>({});

  useEffect(() => {
    if (!selectedList || !matrix?.branches) {
      setRows({});
      return;
    }

    setRows(
      Object.fromEntries(
        matrix.branches.map((branch) => {
          const assignment = branch.priceLists.find((item) => item.priceListId === selectedList.id);
          return [
            branch.id,
            {
              enabled: Boolean(assignment?.isActive),
              type: assignment?.type ?? inferScopeType(selectedList.name),
              isDefault: assignment?.isDefault ?? false
            }
          ];
        })
      )
    );
  }, [matrix?.branches, selectedList]);

  if (loading) return <LoadingState message="Cargando sucursales y aranceles..." />;

  if (!selectedList) {
    return (
      <EmptyState
        title="Selecciona un arancel"
        description="Elige un listado de precios para configurar en que sucursales estara disponible."
      />
    );
  }

  const branches = matrix?.branches ?? [];
  const filteredBranches = branches.filter((branch) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesBrand = !brandId || branch.brandId === brandId;
    const matchesZone = !zoneId || branch.zoneId === zoneId;
    const matchesSearch =
      !normalizedSearch ||
      [branch.name, branch.code, branch.brand?.name ?? "", branch.zone?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    return matchesBrand && matchesZone && matchesSearch;
  });
  const enabledCount = branches.filter((branch) => rows[branch.id]?.enabled).length;
  const defaultCount = branches.filter((branch) => rows[branch.id]?.isDefault).length;

  const updateRow = (branchId: string, next: Partial<{ enabled: boolean; type: PriceListScopeType; isDefault: boolean }>) => {
    setRows((current) => {
      const previous = current[branchId] ?? { enabled: false, type: inferScopeType(selectedList.name), isDefault: false };
      const merged = { ...previous, ...next };
      if (!merged.enabled) merged.isDefault = false;
      if (merged.isDefault) merged.enabled = true;
      return { ...current, [branchId]: merged };
    });
  };

  const submit = async () => {
    await onSave(
      branches.map((branch) => ({
        branchId: branch.id,
        enabled: rows[branch.id]?.enabled ?? false,
        type: rows[branch.id]?.type ?? inferScopeType(selectedList.name),
        isDefault: rows[branch.id]?.isDefault ?? false
      }))
    );
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700">
              <Tags className="h-4 w-4" />
              Disponibilidad por sucursal
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{selectedList.name}</h2>
            <p className="text-sm text-slate-500">
              Habilita este arancel solo en las sucursales que deben tomar precios desde este listado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
              {enabledCount} sucursales habilitadas
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
              {defaultCount} default
            </span>
            <Button onClick={() => void submit()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Marca
            <Select className="mt-1" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
              <option value="">Todas las marcas</option>
              {(matrix?.brands ?? []).map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Zona
            <Select className="mt-1" value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
              <option value="">Todas las zonas</option>
              {(matrix?.zones ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Buscar
            <EntitySearchBox
              className="mt-1"
              placeholder="Sucursal, codigo, marca o zona"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? filteredBranches : []}
              onSelect={(branch) => setSearch(branch.name)}
              getItemKey={(branch) => branch.id}
              emptyMessage="Sin sucursales encontradas"
              renderItem={(branch) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{branch.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[branch.code, branch.brand?.name, branch.zone?.name].filter(Boolean).join(" · ") || "Sin clasificacion"}
                  </p>
                </div>
              )}
            />
          </label>
        </div>
      </div>

      {!filteredBranches.length ? (
        <div className="p-5">
          <EmptyState title="Sin sucursales" description="Ajusta los filtros para ver sucursales disponibles." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="min-w-[260px] px-4 py-3">Sucursal</th>
                <th className="w-[210px] px-4 py-3">Marca</th>
                <th className="w-[170px] px-4 py-3">Zona</th>
                <th className="w-[120px] px-4 py-3">Disponible</th>
                <th className="w-[150px] px-4 py-3">Tipo</th>
                <th className="w-[110px] px-4 py-3">Default</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.map((branch) => {
                const row = rows[branch.id] ?? { enabled: false, type: inferScopeType(selectedList.name), isDefault: false };
                return (
                  <tr key={branch.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-900">{branch.name}</p>
                          <p className="text-xs text-slate-500">{branch.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={branch.brandId ?? ""}
                        onChange={(event) => void onBranchScopeChange(branch.id, { brandId: event.target.value || null })}
                      >
                        <option value="">Sin marca</option>
                        {(matrix?.brands ?? []).map((brand) => (
                          <option key={brand.id} value={brand.id}>{brand.name}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={branch.zoneId ?? ""}
                        onChange={(event) => void onBranchScopeChange(branch.id, { zoneId: event.target.value || null })}
                      >
                        <option value="">Sin zona</option>
                        {(matrix?.zones ?? []).map((zone) => (
                          <option key={zone.id} value={zone.id}>{zone.name}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) => updateRow(branch.id, { enabled: event.target.checked })}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={row.type}
                        disabled={!row.enabled}
                        onChange={(event) => updateRow(branch.id, { type: event.target.value as PriceListScopeType })}
                      >
                        <option value="BASE">Base</option>
                        <option value="POLIZA">Poliza</option>
                        <option value="ADICIONAL">Adicional</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={row.isDefault}
                        disabled={!row.enabled}
                        onChange={(event) => updateRow(branch.id, { isDefault: event.target.checked })}
                        className="h-4 w-4"
                      />
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

function inferScopeType(name: string): PriceListScopeType {
  const normalized = name.toUpperCase();
  if (normalized.includes("POLIZA")) return "POLIZA";
  if (normalized.includes("BASE")) return "BASE";
  return "ADICIONAL";
}

function CategoryList({
  categories,
  loading,
  onCreate,
  onOpen,
  onEdit,
  onDeactivate
}: {
  categories: PriceListCategory[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onEdit: (category: PriceListCategory) => void;
  onDeactivate: (category: PriceListCategory) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Categorias del arancel</h2>
          <p className="text-sm text-slate-500">Estas categorias pertenecen solo al listado seleccionado.</p>
        </div>
        <Button onClick={onCreate}>Crear categoria</Button>
      </div>
      {loading ? (
        <div className="p-5">
          <LoadingState message="Buscando prestaciones..." />
        </div>
      ) : !categories.length ? (
        <div className="p-5">
          <EmptyState
            title="Sin categorias"
            description="Crea una categoria para este arancel o ajusta la busqueda."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Prestaciones</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const visibleProcedures = proceduresForPriceCategory(category);
                return (
                  <tr key={category.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="font-semibold text-brand-700 hover:underline"
                        onClick={() => onOpen(category.id)}
                      >
                        {category.name}
                      </button>
                      {category.description ? (
                        <p className="mt-1 text-xs text-slate-500">{category.description}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{visibleProcedures.length || "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => onOpen(category.id)}>Entrar</Button>
                        <Button variant="secondary" onClick={() => onEdit(category)}>
                          Editar
                        </Button>
                        <Button variant="danger" onClick={() => onDeactivate(category)}>
                          Desactivar
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

function CategoryDetail({
  category,
  list,
  prices,
  procedures,
  loading,
  onBack,
  productForm,
  addingProduct,
  editingProcedureId,
  savingProduct,
  onAddProduct,
  onEditProduct,
  onCancelProduct,
  onSaveProduct,
  onProductFormChange,
  onRemovePrice
}: {
  category: PriceListCategory;
  list: PriceList | null;
  prices: Map<string, PriceListItem>;
  procedures: PriceProcedure[];
  loading: boolean;
  onBack: () => void;
  productForm: ProductRowForm;
  addingProduct: boolean;
  editingProcedureId: string | null;
  savingProduct: boolean;
  onAddProduct: () => void;
  onEditProduct: (procedure: PriceProcedure) => void;
  onCancelProduct: () => void;
  onSaveProduct: () => void;
  onProductFormChange: (value: ProductRowForm) => void;
  onRemovePrice: (procedure: PriceProcedure) => void;
}) {
  const editing = Boolean(addingProduct || editingProcedureId);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <button
            type="button"
            className="mb-2 text-sm font-semibold text-brand-700 hover:underline"
            onClick={onBack}
          >
            Volver a categorias
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {list?.name ?? "Listado"} / {category.name}
          </h2>
          <p className="text-sm text-slate-500">Acciones clinicas</p>
        </div>
        <Button onClick={onAddProduct} disabled={!category.procedureCategoryId || editing}>
          Agregar producto
        </Button>
      </div>

      {loading ? (
        <div className="p-5">
          <LoadingState message="Cargando prestaciones..." />
        </div>
      ) : !procedures.length && !addingProduct ? (
        <div className="p-5">
          <EmptyState
            title="Sin productos"
            description="Agrega un producto para este arancel o ajusta la busqueda."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-[120px] px-4 py-3">ID</th>
                <th className="w-[120px] px-4 py-3">Codigo</th>
                <th className="min-w-[260px] px-4 py-3">Nombre</th>
                <th className="w-[150px] px-4 py-3">Permite descuento</th>
                <th className="w-[150px] px-4 py-3">Precio final</th>
                <th className="w-[160px] px-4 py-3">Costo Laboratorio</th>
                <th className="px-5 py-3 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map((procedure) => {
                const price = prices.get(procedure.id);
                if (editingProcedureId === procedure.id) {
                  return (
                    <ProductEditRow
                      key={procedure.id}
                      idLabel={String(procedure.displayId)}
                      form={productForm}
                      saving={savingProduct}
                      onChange={onProductFormChange}
                      onSave={onSaveProduct}
                      onCancel={onCancelProduct}
                    />
                  );
                }

                return (
                  <tr key={procedure.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{procedure.displayId}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{procedure.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{procedure.name}</td>
                    <td className="px-4 py-3">{price?.allowsDiscount ? "Si" : "No"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {money(price?.price, price?.currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {money(price?.labCost, price?.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 w-8 px-0"
                          title="Editar producto"
                          onClick={() => onEditProduct(procedure)}
                          disabled={editing}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="h-8 w-8 px-0"
                          title="Eliminar producto"
                          onClick={() => onRemovePrice(procedure)}
                          disabled={!price}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Link to="/settings/procedures" title="Configurar en catalogo">
                          <Button variant="secondary" size="sm" className="h-8 w-8 px-0">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {addingProduct ? (
                <ProductEditRow
                  idLabel="-"
                  form={productForm}
                  saving={savingProduct}
                  onChange={onProductFormChange}
                  onSave={onSaveProduct}
                  onCancel={onCancelProduct}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ProductEditRow({
  idLabel,
  form,
  saving,
  onChange,
  onSave,
  onCancel
}: {
  idLabel: string;
  form: ProductRowForm;
  saving: boolean;
  onChange: (value: ProductRowForm) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="border-t border-brand-200 bg-emerald-50/40">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{idLabel}</td>
      <td className="px-4 py-3">
        <Input
          value={form.code}
          onChange={(event) => onChange({ ...form, code: event.target.value })}
          className="h-8"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          className="h-8"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={form.allowsDiscount}
          onChange={(event) => onChange({ ...form, allowsDiscount: event.target.checked })}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={(event) => onChange({ ...form, price: event.target.value })}
          className="h-8"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.labCost}
          onChange={(event) => onChange({ ...form, labCost: event.target.value })}
          className="h-8"
        />
      </td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            className="h-8 w-8 px-0"
            title="Guardar producto"
            onClick={onSave}
            disabled={saving || !form.code.trim() || !form.name.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 px-0"
            title="Cancelar"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
