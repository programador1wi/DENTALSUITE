import { type FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import {
  useInventoryItems,
  useInventoryMovements,
  useLabsInventoryMutations,
  useMinStockAlerts,
  useSuppliers
} from "../hooks/use-labs-inventory";
import type { InventoryMovementType } from "../services/labs-inventory.service";

type InventoryView = "products" | "movements" | "safety";

const movementTypes: InventoryMovementType[] = ["IN", "OUT", "ADJUSTMENT"];

function asInventoryView(value: string | null): InventoryView {
  if (value === "movements" || value === "safety") return value;
  return "products";
}

function movementLabel(type: InventoryMovementType) {
  if (type === "IN") return "Entrada";
  if (type === "OUT") return "Salida";
  return "Ajuste";
}

export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const view = asInventoryView(params.get("view"));
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [branchId, setBranchId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierActive, setSupplierActive] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryMovementType | "">("");
  const [movementItemFilter, setMovementItemFilter] = useState("");
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementForm, setMovementForm] = useState({
    inventoryItemId: "",
    type: "IN" as InventoryMovementType,
    quantity: "",
    reason: ""
  });

  const branches = useBranches(undefined, "ACTIVE");
  const suppliers = useSuppliers(undefined, "true");
  const items = useInventoryItems({
    search: search || undefined,
    active: active || undefined,
    branchId: branchId || undefined
  });
  const activeItems = useInventoryItems({ active: "true", branchId: branchId || undefined });
  const minStock = useMinStockAlerts(branchId || undefined);
  const movements = useInventoryMovements({
    type: movementTypeFilter || undefined,
    inventoryItemId: movementItemFilter || undefined,
    branchId: branchId || undefined
  });
  const supplierRows = useSuppliers(supplierSearch || undefined, supplierActive || undefined);
  const mutations = useLabsInventoryMutations();

  const branchOptions = useMemo(
    () => branches.data?.map((branch) => ({ label: branch.name, value: branch.id })) ?? [],
    [branches.data]
  );
  const supplierOptions = useMemo(
    () => suppliers.data?.map((supplier) => ({ label: supplier.name, value: supplier.id })) ?? [],
    [suppliers.data]
  );
  const selectedMovementItem = activeItems.data?.find((item) => item.id === movementForm.inventoryItemId) ?? null;

  const setView = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === "products") nextParams.delete("view");
    else nextParams.set("view", next);
    setParams(nextParams);
  };

  const closeMovementModal = () => {
    setMovementModalOpen(false);
    setMovementForm({
      inventoryItemId: "",
      type: "IN",
      quantity: "",
      reason: ""
    });
  };

  const submitMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMovementItem) return;
    const quantity = Number(movementForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    await mutations.createInventoryMovement.mutateAsync({
      inventoryItemId: selectedMovementItem.id,
      branchId: selectedMovementItem.branchId,
      type: movementForm.type,
      quantity,
      reason: movementForm.reason.trim() || undefined
    });
    closeMovementModal();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        description="Productos, movimientos y stock de seguridad por sucursal."
        helpText="La pestaña de movimientos registra entradas, salidas y ajustes. Stock de seguridad muestra productos bajo su mínimo configurado."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <Tabs
            active={view}
            onChange={setView}
            items={[
              { key: "products", label: "Productos" },
              { key: "movements", label: "Movimientos" },
              { key: "safety", label: "Stock de seguridad" }
            ]}
          />
          <label className="text-sm text-slate-700 xl:w-72">
            Sucursal
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {view === "products" ? (
        <div className="space-y-6">
          <SimpleCrudPage
            title="Productos de inventario"
            description="Control de insumos clinicos y administrativos por sucursal."
            rows={items.data}
            loading={items.isLoading}
            error={items.isError ? items.error.message : undefined}
            search={search}
            setSearch={setSearch}
            active={active}
            setActive={setActive}
            fields={[
              { key: "name", label: "Nombre", type: "text" },
              { key: "sku", label: "SKU", type: "text" },
              { key: "category", label: "Categoria", type: "text" },
              { key: "unit", label: "Unidad", type: "text" },
              { key: "stock", label: "Stock inicial", type: "number" },
              { key: "minStock", label: "Stock minimo", type: "number" },
              { key: "branchId", label: "Sucursal", type: "select", options: branchOptions },
              { key: "supplierId", label: "Proveedor", type: "select", options: supplierOptions }
            ]}
            columns={[
              { key: "name", title: "Nombre" },
              { key: "sku", title: "SKU" },
              { key: "category", title: "Categoria" },
              { key: "stock", title: "Stock" },
              { key: "minStock", title: "Stock minimo" },
              { key: "branch", title: "Sucursal", render: (row) => row.branch?.name ?? "-" },
              { key: "supplier", title: "Proveedor", render: (row) => row.supplier?.name ?? "-" },
              {
                key: "isActive",
                title: "Estado",
                render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
              }
            ]}
            actions={{
              create: async (payload) =>
                mutations.createInventoryItem.mutateAsync({
                  ...payload,
                  stock: Number(payload.stock),
                  minStock: Number(payload.minStock)
                } as never),
              update: async (id, payload) =>
                mutations.updateInventoryItem.mutateAsync({
                  id,
                  payload: {
                    ...payload,
                    ...(payload.minStock !== undefined ? { minStock: Number(payload.minStock) } : {})
                  }
                }),
              deactivate: async (id) => mutations.deactivateInventoryItem.mutateAsync(id),
              mapToForm: (row) => ({
                name: row.name,
                sku: row.sku,
                category: row.category,
                unit: row.unit,
                stock: row.stock,
                minStock: row.minStock,
                branchId: row.branchId,
                supplierId: row.supplierId ?? ""
              }),
              mapToPayload: (form) => ({
                name: String(form.name || ""),
                sku: String(form.sku || ""),
                category: String(form.category || ""),
                unit: String(form.unit || ""),
                stock: Number(form.stock || 0),
                minStock: Number(form.minStock || 0),
                branchId: String(form.branchId || ""),
                supplierId: form.supplierId ? String(form.supplierId) : undefined
              }),
              getId: (row) => row.id
            }}
          />

          <SimpleCrudPage
            title="Proveedores de inventario"
            description="Catalogo de proveedores para compras y abastecimiento."
            rows={supplierRows.data}
            loading={supplierRows.isLoading}
            error={supplierRows.isError ? supplierRows.error.message : undefined}
            search={supplierSearch}
            setSearch={setSupplierSearch}
            active={supplierActive}
            setActive={setSupplierActive}
            fields={[
              { key: "name", label: "Nombre", type: "text" },
              { key: "phone", label: "Telefono", type: "text" },
              { key: "email", label: "Email", type: "email" },
              { key: "address", label: "Direccion", type: "textarea" }
            ]}
            columns={[
              { key: "name", title: "Nombre" },
              { key: "phone", title: "Telefono" },
              { key: "email", title: "Email" },
              {
                key: "isActive",
                title: "Estado",
                render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
              }
            ]}
            actions={{
              create: async (payload) => mutations.createSupplier.mutateAsync(payload as never),
              update: async (id, payload) => mutations.updateSupplier.mutateAsync({ id, payload: payload as never }),
              deactivate: async (id) => mutations.deactivateSupplier.mutateAsync(id),
              mapToForm: (row) => ({ name: row.name, phone: row.phone ?? "", email: row.email ?? "", address: row.address ?? "" }),
              getId: (row) => row.id
            }}
          />
        </div>
      ) : null}

      {view === "movements" ? (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Operacion
                  <Select
                    value={movementTypeFilter}
                    onChange={(event) => setMovementTypeFilter((event.target.value as InventoryMovementType) || "")}
                  >
                    <option value="">Todas las operaciones</option>
                    {movementTypes.map((type) => (
                      <option key={type} value={type}>
                        {movementLabel(type)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-sm text-slate-700">
                  Producto
                  <Select value={movementItemFilter} onChange={(event) => setMovementItemFilter(event.target.value)}>
                    <option value="">Todos los productos</option>
                    {activeItems.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <Button onClick={() => setMovementModalOpen(true)}>Nuevo movimiento</Button>
            </div>
          </Card>

          {movements.isLoading || activeItems.isLoading ? <LoadingState message="Cargando movimientos..." /> : null}
          {movements.isError ? <ErrorState message={movements.error.message} /> : null}
          {activeItems.isError ? <ErrorState message={activeItems.error.message} /> : null}

          {movements.data ? (
            <DataTable
              rows={movements.data}
              empty={<EmptyState title="Sin movimientos" description="No hay movimientos para los filtros seleccionados." />}
              columns={[
                {
                  key: "type",
                  title: "Operacion",
                  render: (row) => (
                    <Badge
                      value={movementLabel(row.type)}
                      tone={row.type === "IN" ? "success" : row.type === "OUT" ? "warning" : "default"}
                    />
                  )
                },
                { key: "createdAt", title: "Fecha", render: (row) => new Date(row.createdAt).toLocaleString() },
                { key: "branch", title: "Sucursal", render: (row) => row.branch?.name ?? "-" },
                {
                  key: "inventoryItem",
                  title: "Producto",
                  render: (row) => (row.inventoryItem ? `${row.inventoryItem.name} (${row.inventoryItem.sku})` : row.inventoryItemId)
                },
                { key: "quantity", title: "Cantidad" },
                { key: "reason", title: "Detalle", render: (row) => row.reason || "-" },
                {
                  key: "createdBy",
                  title: "Responsable",
                  render: (row) => row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : "-"
                }
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {view === "safety" ? (
        <div className="space-y-4">
          <Card className="rounded-lg border-amber-200 bg-amber-50 text-sm text-amber-900">
            Stock de seguridad muestra los productos cuyo stock actual esta igual o por debajo del minimo configurado.
          </Card>
          {minStock.isLoading ? <LoadingState message="Cargando stock de seguridad..." /> : null}
          {minStock.isError ? <ErrorState message={minStock.error.message} /> : null}
          {minStock.data ? (
            <DataTable
              rows={minStock.data}
              empty={<EmptyState title="Sin alertas" description="No hay productos bajo su stock minimo." />}
              columns={[
                { key: "name", title: "Producto" },
                { key: "sku", title: "SKU" },
                { key: "stock", title: "Stock actual" },
                { key: "minStock", title: "Stock de seguridad" },
                { key: "branch", title: "Sucursal", render: (row) => row.branch?.name ?? "-" },
                { key: "supplier", title: "Proveedor", render: (row) => row.supplier?.name ?? "-" }
              ]}
            />
          ) : null}
        </div>
      ) : null}

      <Modal open={movementModalOpen} title="Nuevo movimiento" onClose={closeMovementModal}>
        <form className="space-y-4" onSubmit={submitMovement}>
          <label className="block text-sm text-slate-700">
            Producto
            <Select
              required
              value={movementForm.inventoryItemId}
              onChange={(event) => setMovementForm((current) => ({ ...current, inventoryItemId: event.target.value }))}
            >
              <option value="">Selecciona</option>
              {activeItems.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku}) - {item.branch?.name ?? "Sucursal"}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Operacion
              <Select
                value={movementForm.type}
                onChange={(event) => setMovementForm((current) => ({ ...current, type: event.target.value as InventoryMovementType }))}
              >
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {movementLabel(type)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Cantidad
              <Input
                required
                min={0.01}
                step="0.01"
                type="number"
                value={movementForm.quantity}
                onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm text-slate-700">
            Detalle
            <Input
              placeholder="Motivo o detalle del movimiento"
              value={movementForm.reason}
              onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeMovementModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutations.createInventoryMovement.isPending}>
              Registrar movimiento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
