import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import {
  useInventoryItems,
  useInventoryMovements,
  useInventoryWarehouses,
  useLabsInventoryMutations,
  useMinStockAlerts,
  useSuppliers
} from "../hooks/use-labs-inventory";
import { downloadInventoryReport, type InventoryItem, type InventoryMovementType, type InventoryWarehouse } from "../services/labs-inventory.service";

type InventoryView = "inventory" | "products" | "movements" | "safety" | "warehouses";
type OperationType = "IN" | "OUT" | "ADJUSTMENT" | "SALE";

const movementTypes: InventoryMovementType[] = ["IN", "OUT", "ADJUSTMENT"];

function asInventoryView(value: string | null): InventoryView {
  if (value === "products" || value === "movements" || value === "safety" || value === "warehouses") return value;
  return "inventory";
}

function movementLabel(type: InventoryMovementType | OperationType) {
  if (type === "IN") return "Entrada";
  if (type === "OUT") return "Salida";
  if (type === "SALE") return "Venta";
  return "Ajuste";
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number.isFinite(parsed) ? parsed : 0);
}

function stockFor(item: InventoryItem, warehouseId?: string) {
  const rows = item.stocks ?? [];
  if (warehouseId) return rows.find((row) => row.warehouseId === warehouseId) ?? null;
  return rows.find((row) => row.warehouse?.isDefault) ?? rows[0] ?? null;
}

function stockTone(item: InventoryItem, warehouseId?: string) {
  const stock = stockFor(item, warehouseId);
  if (!stock) return "warning";
  if (Number(stock.stock) === 0) return "danger";
  if (Number(stock.stock) <= Number(stock.minStock)) return "warning";
  return "success";
}

export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const view = asInventoryView(params.get("view"));
  const { branchId, setBranchId } = useActiveBranchFilter();
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierActive, setSupplierActive] = useState("");
  const [warehouseActive, setWarehouseActive] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryMovementType | "">("");
  const [movementItemFilter, setMovementItemFilter] = useState("");
  const [movementSupplierFilter, setMovementSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("IN");
  const [movementForm, setMovementForm] = useState({
    inventoryItemId: "",
    quantity: "",
    unitCost: "",
    unitPrice: "",
    reason: ""
  });

  const branches = useBranches(undefined, "ACTIVE");
  const warehouses = useInventoryWarehouses({ branchId: branchId || undefined, active: warehouseActive || undefined });
  const activeWarehouses = useInventoryWarehouses({ branchId: branchId || undefined, active: "true" });
  const suppliers = useSuppliers(undefined, "true");
  const supplierRows = useSuppliers(supplierSearch || undefined, supplierActive || undefined);
  const items = useInventoryItems({
    search: search || undefined,
    active: active || undefined,
    branchId: branchId || undefined,
    warehouseId: warehouseId || undefined,
    stock: stockFilter || undefined
  });
  const activeItems = useInventoryItems({ active: "true", branchId: branchId || undefined, warehouseId: warehouseId || undefined });
  const minStock = useMinStockAlerts(branchId || undefined, warehouseId || undefined);
  const movements = useInventoryMovements({
    type: movementTypeFilter || undefined,
    inventoryItemId: movementItemFilter || undefined,
    branchId: branchId || undefined,
    warehouseId: warehouseId || undefined,
    supplierId: movementSupplierFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });
  const mutations = useLabsInventoryMutations();

  const branchOptions = useMemo(
    () => branches.data?.map((branch) => ({ label: branch.name, value: branch.id })) ?? [],
    [branches.data]
  );
  const warehouseOptions = useMemo(
    () => activeWarehouses.data?.map((warehouse) => ({ label: warehouse.name, value: warehouse.id })) ?? [],
    [activeWarehouses.data]
  );
  const supplierOptions = useMemo(
    () => suppliers.data?.map((supplier) => ({ label: supplier.name, value: supplier.id })) ?? [],
    [suppliers.data]
  );
  const selectedMovementItem = activeItems.data?.find((item) => item.id === movementForm.inventoryItemId) ?? null;
  const selectedWarehouse = activeWarehouses.data?.find((warehouse) => warehouse.id === warehouseId) ?? activeWarehouses.data?.[0] ?? null;

  useEffect(() => {
    if (warehouseId && activeWarehouses.data && !activeWarehouses.data.some((warehouse) => warehouse.id === warehouseId)) {
      setWarehouseId("");
    }
  }, [activeWarehouses.data, warehouseId]);

  const setView = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === "inventory") nextParams.delete("view");
    else nextParams.set("view", next);
    setParams(nextParams);
  };

  const openOperation = (nextType: OperationType, item?: InventoryItem) => {
    setOperationType(nextType);
    setMovementForm({
      inventoryItemId: item?.id ?? "",
      quantity: "",
      unitCost: "",
      unitPrice: item?.salePrice ? String(item.salePrice) : "",
      reason: ""
    });
    setOperationOpen(true);
  };

  const closeOperation = () => {
    setOperationOpen(false);
    setMovementForm({ inventoryItemId: "", quantity: "", unitCost: "", unitPrice: "", reason: "" });
  };

  const submitOperation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMovementItem || !selectedWarehouse) return;
    const quantity = numberValue(movementForm.quantity);
    if (quantity <= 0) return;

    if (operationType === "SALE") {
      await mutations.createInventoryProductSale.mutateAsync({
        inventoryItemId: selectedMovementItem.id,
        branchId: selectedMovementItem.branchId,
        warehouseId: selectedWarehouse.id,
        quantity,
        unitPrice: numberValue(movementForm.unitPrice || selectedMovementItem.salePrice),
        reason: movementForm.reason.trim() || undefined
      });
      closeOperation();
      return;
    }

    await mutations.createInventoryMovement.mutateAsync({
      inventoryItemId: selectedMovementItem.id,
      branchId: selectedMovementItem.branchId,
      warehouseId: selectedWarehouse.id,
      type: operationType,
      quantity,
      unitCost: movementForm.unitCost ? numberValue(movementForm.unitCost) : undefined,
      reason: movementForm.reason.trim() || undefined
    });
    closeOperation();
  };

  const saveReport = async (kind: "current" | "movements", filename: string, params: Record<string, string | undefined>) => {
    const blob = await downloadInventoryReport(kind, params);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCurrent = () => {
    void saveReport("current", "inventario.csv", {
      branchId: branchId || undefined,
      warehouseId: warehouseId || undefined,
      search: search || undefined
    });
  };

  const exportMovements = () => {
    void saveReport("movements", "movimientos-inventario.csv", {
      branchId: branchId || undefined,
      warehouseId: warehouseId || undefined,
      inventoryItemId: movementItemFilter || undefined,
      supplierId: movementSupplierFilter || undefined,
      type: movementTypeFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        description="Control operativo de productos, bodegas, movimientos, stock critico y ventas de insumos."
        helpText="El stock se controla por sucursal y bodega. Todo cambio operativo genera movimiento auditable."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <Tabs
            active={view}
            onChange={setView}
            items={[
              { key: "inventory", label: "Inventario" },
              { key: "products", label: "Productos" },
              { key: "movements", label: "Movimientos" },
              { key: "safety", label: "Stock de seguridad" },
              { key: "warehouses", label: "Bodegas" }
            ]}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:w-[520px]">
            <label className="text-sm text-slate-700">
              Sucursal
              <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">Sucursal activa</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Bodega
              <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">Bodega default</option>
                {activeWarehouses.data?.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </Card>

      {view === "inventory" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="Buscar producto, SKU, categoria o proveedor" value={search} onChange={(event) => setSearch(event.target.value)} />
              <Select value={active} onChange={(event) => setActive(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </Select>
              <Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                <option value="">Todos los stocks</option>
                <option value="low">Stock bajo</option>
                <option value="zero">Stock cero</option>
              </Select>
              <div className="flex gap-2">
                <Button onClick={() => openOperation("IN")}>Ingresar productos</Button>
                <Button variant="secondary" onClick={exportCurrent}>Exportar</Button>
              </div>
            </div>
          </Card>
          {items.isLoading ? <LoadingState message="Cargando inventario..." /> : null}
          {items.isError ? <ErrorState message={items.error.message} /> : null}
          {items.data ? (
            <DataTable
              rows={items.data}
              empty={<EmptyState title="Sin inventario" description="No hay productos para los filtros seleccionados." />}
              columns={[
                { key: "name", title: "Producto" },
                { key: "sku", title: "SKU" },
                { key: "category", title: "Categoria" },
                { key: "stock", title: "Stock", render: (row) => {
                  const stock = stockFor(row, warehouseId);
                  return <Badge value={stock ? String(stock.stock) : "0"} tone={stockTone(row, warehouseId)} />;
                } },
                { key: "minStock", title: "Seguridad", render: (row) => stockFor(row, warehouseId)?.minStock ?? row.minStock },
                { key: "salePrice", title: "Precio venta", render: (row) => row.salePrice ? money(row.salePrice) : "-" },
                { key: "supplier", title: "Proveedor", render: (row) => row.supplier?.name ?? "-" },
                { key: "isActive", title: "Acciones", render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openOperation("IN", row)}>Ingresar</Button>
                    <Button variant="secondary" onClick={() => openOperation("OUT", row)}>Sacar</Button>
                    <Button variant="secondary" onClick={() => openOperation("ADJUSTMENT", row)}>Ajustar</Button>
                    {row.isSellable ? <Button onClick={() => openOperation("SALE", row)}>Vender</Button> : null}
                  </div>
                ) }
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {view === "products" ? (
        <div className="space-y-6">
          <SimpleCrudPage
            useModal={true}
            title="Productos de inventario"
            description="Catalogo maestro de insumos clinicos y administrativos."
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
              { key: "averageCost", label: "Costo promedio inicial", type: "number" },
              { key: "salePrice", label: "Precio venta", type: "number" },
              { key: "isSellable", label: "Vendible en caja", type: "checkbox" },
              { key: "branchId", label: "Sucursal", type: "select", options: branchOptions },
              { key: "warehouseId", label: "Bodega inicial", type: "select", options: warehouseOptions },
              { key: "supplierId", label: "Proveedor", type: "select", options: supplierOptions }
            ]}
            columns={[
              { key: "name", title: "Nombre" },
              { key: "sku", title: "SKU" },
              { key: "category", title: "Categoria" },
              { key: "stock", title: "Stock total" },
              { key: "salePrice", title: "Precio venta", render: (row) => row.salePrice ? money(row.salePrice) : "-" },
              { key: "supplier", title: "Proveedor", render: (row) => row.supplier?.name ?? "-" },
              { key: "isSellable", title: "Venta", render: (row) => <Badge value={row.isSellable ? "VENDIBLE" : "INTERNO"} tone={row.isSellable ? "success" : "default"} /> }
            ]}
            actions={{
              create: async (payload) =>
                mutations.createInventoryItem.mutateAsync({
                  ...payload,
                  stock: Number(payload.stock || 0),
                  minStock: Number(payload.minStock || 0),
                  averageCost: Number(payload.averageCost || 0),
                  salePrice: Number(payload.salePrice || 0),
                  isSellable: Boolean(payload.isSellable)
                } as never),
              update: async (id, payload) =>
                mutations.updateInventoryItem.mutateAsync({
                  id,
                  payload: {
                    ...payload,
                    ...(payload.minStock !== undefined ? { minStock: Number(payload.minStock) } : {}),
                    ...(payload.salePrice !== undefined ? { salePrice: Number(payload.salePrice || 0) } : {}),
                    isSellable: Boolean(payload.isSellable)
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
                averageCost: stockFor(row, warehouseId)?.averageCost ?? "",
                salePrice: row.salePrice ?? "",
                isSellable: row.isSellable,
                branchId: row.branchId,
                warehouseId: stockFor(row, warehouseId)?.warehouseId ?? warehouseId,
                supplierId: row.supplierId ?? ""
              }),
              mapToPayload: (form) => ({
                name: String(form.name || ""),
                sku: String(form.sku || ""),
                category: String(form.category || ""),
                unit: String(form.unit || ""),
                stock: Number(form.stock || 0),
                minStock: Number(form.minStock || 0),
                averageCost: Number(form.averageCost || 0),
                salePrice: Number(form.salePrice || 0),
                isSellable: Boolean(form.isSellable),
                branchId: String(form.branchId || branchId),
                warehouseId: form.warehouseId ? String(form.warehouseId) : warehouseId || undefined,
                supplierId: form.supplierId ? String(form.supplierId) : undefined
              }),
              getId: (row) => row.id
            }}
          />

          <SimpleCrudPage
            useModal={true}
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
              { key: "isActive", title: "Estado", render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} /> }
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
          <Card>
            <div className="grid gap-3 md:grid-cols-4">
              <Select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter((event.target.value as InventoryMovementType) || "")}>
                <option value="">Todas las operaciones</option>
                {movementTypes.map((type) => <option key={type} value={type}>{movementLabel(type)}</option>)}
              </Select>
              <Select value={movementItemFilter} onChange={(event) => setMovementItemFilter(event.target.value)}>
                <option value="">Todos los productos</option>
                {activeItems.data?.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
              </Select>
              <Select value={movementSupplierFilter} onChange={(event) => setMovementSupplierFilter(event.target.value)}>
                <option value="">Todos los proveedores</option>
                {suppliers.data?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                <Button variant="secondary" onClick={exportMovements}>Exportar</Button>
              </div>
            </div>
          </Card>
          {movements.isLoading ? <LoadingState message="Cargando movimientos..." /> : null}
          {movements.isError ? <ErrorState message={movements.error.message} /> : null}
          {movements.data ? (
            <DataTable
              rows={movements.data}
              empty={<EmptyState title="Sin movimientos" description="No hay movimientos para los filtros seleccionados." />}
              columns={[
                { key: "type", title: "Operacion", render: (row) => <Badge value={movementLabel(row.type)} tone={row.type === "IN" ? "success" : row.type === "OUT" ? "warning" : "default"} /> },
                { key: "createdAt", title: "Fecha", render: (row) => new Date(row.createdAt).toLocaleString() },
                { key: "inventoryItem", title: "Producto", render: (row) => row.inventoryItem ? `${row.inventoryItem.name} (${row.inventoryItem.sku})` : row.inventoryItemId },
                { key: "warehouse", title: "Bodega", render: (row) => row.warehouse?.name ?? "-" },
                { key: "quantity", title: "Cantidad" },
                { key: "unitCost", title: "Costo", render: (row) => row.unitCost ? money(row.unitCost) : "-" },
                { key: "stockBefore", title: "Antes", render: (row) => row.stockBefore ?? "-" },
                { key: "stockAfter", title: "Despues", render: (row) => row.stockAfter ?? "-" },
                { key: "reason", title: "Detalle", render: (row) => row.reason || "-" },
                { key: "createdBy", title: "Responsable", render: (row) => row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : "-" }
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {view === "safety" ? (
        <div className="space-y-4">
          <Card className="rounded-lg border-amber-200 bg-amber-50 text-sm text-amber-900">
            Stock de seguridad muestra productos cuyo stock actual esta igual o por debajo del minimo configurado por bodega.
          </Card>
          {minStock.isLoading ? <LoadingState message="Cargando stock de seguridad..." /> : null}
          {minStock.isError ? <ErrorState message={minStock.error.message} /> : null}
          {minStock.data ? (
            <DataTable
              rows={minStock.data}
              empty={<EmptyState title="Sin alertas" description="No hay productos bajo su stock minimo." />}
              columns={[
                { key: "inventoryItem", title: "Producto", render: (row) => row.inventoryItem?.name ?? "-" },
                { key: "warehouse", title: "Bodega", render: (row) => row.warehouse?.name ?? "-" },
                { key: "stock", title: "Stock actual" },
                { key: "minStock", title: "Stock de seguridad" },
                { key: "averageCost", title: "Costo promedio", render: (row) => money(row.averageCost) }
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {view === "warehouses" ? (
        <SimpleCrudPage
          useModal={true}
          title="Bodegas"
          description="Almacenes fisicos o logicos donde se controla el stock por sucursal."
          rows={warehouses.data}
          loading={warehouses.isLoading}
          error={warehouses.isError ? warehouses.error.message : undefined}
          search={search}
          setSearch={setSearch}
          active={warehouseActive}
          setActive={setWarehouseActive}
          fields={[
            { key: "name", label: "Nombre", type: "text" },
            { key: "description", label: "Descripcion", type: "textarea" },
            { key: "branchId", label: "Sucursal", type: "select", options: branchOptions },
            { key: "isDefault", label: "Bodega default", type: "checkbox" }
          ]}
          columns={[
            { key: "name", title: "Nombre" },
            { key: "branch", title: "Sucursal", render: (row: InventoryWarehouse) => row.branch?.name ?? "-" },
            { key: "isDefault", title: "Default", render: (row: InventoryWarehouse) => <Badge value={row.isDefault ? "SI" : "NO"} tone={row.isDefault ? "success" : "default"} /> },
            { key: "isActive", title: "Estado", render: (row: InventoryWarehouse) => <Badge value={row.isActive ? "ACTIVA" : "INACTIVA"} tone={row.isActive ? "success" : "warning"} /> }
          ]}
          actions={{
            create: async (payload) => mutations.createInventoryWarehouse.mutateAsync(payload as never),
            update: async (id, payload) => mutations.updateInventoryWarehouse.mutateAsync({ id, payload: payload as never }),
            deactivate: async (id) => mutations.updateInventoryWarehouse.mutateAsync({ id, payload: { isActive: false } }),
            mapToForm: (row) => ({
              name: row.name,
              description: row.description ?? "",
              branchId: row.branchId,
              isDefault: row.isDefault
            }),
            mapToPayload: (form) => ({
              name: String(form.name || ""),
              description: String(form.description || ""),
              branchId: String(form.branchId || branchId),
              isDefault: Boolean(form.isDefault)
            }),
            getId: (row) => row.id
          }}
        />
      ) : null}

      <Modal open={operationOpen} title={movementLabel(operationType)} onClose={closeOperation}>
        <form className="space-y-4" onSubmit={submitOperation}>
          <label className="block text-sm text-slate-700">
            Producto
            <Select required value={movementForm.inventoryItemId} onChange={(event) => setMovementForm((current) => ({ ...current, inventoryItemId: event.target.value }))}>
              <option value="">Selecciona</option>
              {activeItems.data?.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
              ))}
            </Select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Bodega
              <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">Bodega default</option>
                {activeWarehouses.data?.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Cantidad
              <Input required min={0.01} step="0.01" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} />
            </label>
          </div>
          {operationType === "IN" ? (
            <label className="block text-sm text-slate-700">
              Costo unitario
              <Input min={0} step="0.01" type="number" value={movementForm.unitCost} onChange={(event) => setMovementForm((current) => ({ ...current, unitCost: event.target.value }))} />
            </label>
          ) : null}
          {operationType === "SALE" ? (
            <label className="block text-sm text-slate-700">
              Precio unitario
              <Input required min={0} step="0.01" type="number" value={movementForm.unitPrice} onChange={(event) => setMovementForm((current) => ({ ...current, unitPrice: event.target.value }))} />
            </label>
          ) : null}
          <label className="block text-sm text-slate-700">
            Detalle
            <Input required={operationType === "ADJUSTMENT"} placeholder="Motivo o detalle del movimiento" value={movementForm.reason} onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeOperation}>Cancelar</Button>
            <Button type="submit" disabled={mutations.createInventoryMovement.isPending || mutations.createInventoryProductSale.isPending}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
