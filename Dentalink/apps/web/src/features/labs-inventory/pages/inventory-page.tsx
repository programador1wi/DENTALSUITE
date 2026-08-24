import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  AlertTriangle,
  ShoppingCart,
  Package,
  DollarSign,
  AlertCircle,
  Plus,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
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
  useInventoryCategories,
  useInventoryMovements,
  useInventoryUnits,
  useInventoryWarehouses,
  useLabsInventoryMutations,
  useMinStockAlerts,
  useSuppliers
} from "../hooks/use-labs-inventory";
import {
  downloadInventoryReport,
  type InventoryItem,
  type InventoryMovementType,
  type InventoryWarehouse
} from "../services/labs-inventory.service";
import {
  RowActionsMenu,
  StockLevelBar,
  asInventoryView,
  money,
  movementLabel,
  movementTypes,
  numberValue,
  stockFor,
  stockTone,
  type OperationType
} from "./inventory-page-support";

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
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryActive, setCategoryActive] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitActive, setUnitActive] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryMovementType | "">("");
  const [movementItemFilter, setMovementItemFilter] = useState("");
  const [movementSupplierFilter, setMovementSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [operationOpen, setOperationOpen] = useState(false);
  const [safetyStock, setSafetyStock] = useState<{ inventoryItemId: string; warehouseId: string; product: string; minStock: string } | null>(null);
  const [operationType, setOperationType] = useState<OperationType>("ENTRY");
  const [movementForm, setMovementForm] = useState({
    inventoryItemId: "",
    destinationWarehouseId: "",
    quantity: "",
    unitCost: "",
    unitPrice: "",
    lotNumber: "",
    expirationDate: "",
    reason: ""
  });

  const branches = useBranches(undefined, "ACTIVE");
  const warehouses = useInventoryWarehouses({ branchId: branchId || undefined, active: warehouseActive || undefined });
  const activeWarehouses = useInventoryWarehouses({ branchId: branchId || undefined, active: "true" });
  const suppliers = useSuppliers(undefined, "true");
  const categories = useInventoryCategories(categorySearch || undefined, categoryActive || undefined);
  const units = useInventoryUnits(unitSearch || undefined, unitActive || undefined);
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
  const categoryOptions = useMemo(
    () => categories.data?.map((category) => ({ label: category.name, value: category.id })) ?? [],
    [categories.data]
  );
  const stats = useMemo(() => {
    const data = items.data ?? [];
    const totalItems = data.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;

    data.forEach((item) => {
      const stock = stockFor(item, warehouseId);
      const stockQty = numberValue(stock?.stock);
      const minQty = numberValue(stock?.minStock ?? item.minStock);
      const cost = numberValue(stock?.averageCost);

      totalValuation += stockQty * cost;
      if (stockQty === 0) outOfStockCount++;
      else if (stockQty <= minQty) lowStockCount++;
    });

    return { totalItems, lowStockCount, outOfStockCount, totalValuation };
  }, [items.data, warehouseId]);
  const unitOptions = useMemo(
    () => units.data?.map((unit) => ({ label: `${unit.name} (${unit.abbreviation})`, value: unit.id })) ?? [],
    [units.data]
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
      destinationWarehouseId: "",
      quantity: "",
      unitCost: "",
      unitPrice: item?.salePrice ? String(item.salePrice) : "",
      lotNumber: "",
      expirationDate: "",
      reason: ""
    });
    setOperationOpen(true);
  };

  const closeOperation = () => {
    setOperationOpen(false);
    setMovementForm({
      inventoryItemId: "",
      destinationWarehouseId: "",
      quantity: "",
      unitCost: "",
      unitPrice: "",
      lotNumber: "",
      expirationDate: "",
      reason: ""
    });
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

    const kindByOperation = {
      ENTRY: "entries",
      EXIT: "exits",
      TRANSFER: "transfers",
      POSITIVE_ADJUSTMENT: "adjustments/positive",
      NEGATIVE_ADJUSTMENT: "adjustments/negative",
      WASTE: "waste"
    } as const;
    await mutations.postInventoryMovement.mutateAsync({
      kind: kindByOperation[operationType],
      payload: {
      branchId: selectedMovementItem.branchId,
        sourceWarehouseId: operationType === "ENTRY" || operationType === "POSITIVE_ADJUSTMENT"
          ? undefined
          : selectedWarehouse.id,
        destinationWarehouseId: operationType === "ENTRY" || operationType === "POSITIVE_ADJUSTMENT"
          ? selectedWarehouse.id
          : operationType === "TRANSFER"
            ? movementForm.destinationWarehouseId
            : undefined,
        reason: movementForm.reason.trim() || movementLabel(operationType),
        lines: [{
          inventoryItemId: selectedMovementItem.id,
          quantity,
          unitCost: movementForm.unitCost ? numberValue(movementForm.unitCost) : undefined,
          lotNumber: movementForm.lotNumber.trim() || undefined,
          expirationDate: movementForm.expirationDate || undefined
        }]
      }
    });
    closeOperation();
  };

  const saveReport = async (
    kind: "current" | "movements" | "critical" | "valuation" | "waste" | "expiring",
    filename: string,
    reportParams: Record<string, string | undefined>
  ) => {
    const blob = await downloadInventoryReport(kind, reportParams);
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

      <Card className="p-4 space-y-3">
        <Tabs
          active={view}
          onChange={setView}
          items={[
            { key: "inventory", label: "Inventario" },
            { key: "products", label: "Productos" },
            { key: "catalogs", label: "Categorías y unidades" },
            { key: "movements", label: "Movimientos" },
            { key: "safety", label: "Stock de seguridad" },
            { key: "warehouses", label: "Bodegas" }
          ]}
        />
        <div className="grid min-w-0 gap-3 border-t border-slate-100 pt-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <div className="min-w-0 lg:max-w-xs lg:flex-1">
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-0 lg:max-w-xs lg:flex-1">
            <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">Bodega default</option>
              {activeWarehouses.data?.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {view === "inventory" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Productos</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalItems}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Package className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valoración Est.</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{money(stats.totalValuation)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Crítico</p>
                <p className={cn("text-2xl font-bold mt-1", stats.lowStockCount > 0 ? "text-amber-600" : "text-slate-900")}>
                  {stats.lowStockCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sin Stock (Cero)</p>
                <p className={cn("text-2xl font-bold mt-1", stats.outOfStockCount > 0 ? "text-rose-600" : "text-slate-900")}>
                  {stats.outOfStockCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <Card className="p-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem] md:items-center">
                <div className="min-w-0">
                  <Input placeholder="Buscar producto, SKU, categoría o proveedor..." value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="min-w-0">
                  <Select value={active} onChange={(event) => setActive(event.target.value)}>
                    <option value="">Todos los estados</option>
                    <option value="true">Activos</option>
                    <option value="false">Inactivos</option>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                    <option value="">Todos los stocks</option>
                    <option value="low">Stock bajo</option>
                    <option value="zero">Stock cero</option>
                  </Select>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 pt-2 xl:shrink-0 xl:pt-0">
                <Button className="flex items-center gap-1.5" onClick={() => openOperation("ENTRY")}>
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Ingresar</span>
                </Button>
                <Button variant="secondary" className="flex items-center gap-1.5" onClick={() => openOperation("TRANSFER")}>
                  <ArrowRightLeft className="h-4 w-4 shrink-0" />
                  <span>Transferir</span>
                </Button>
                <Button variant="secondary" className="flex items-center gap-1.5" onClick={exportCurrent}>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Exportar</span>
                </Button>
              </div>
            </div>
          </Card>

          {items.isLoading ? <LoadingState message="Cargando inventario..." /> : null}
          {items.isError ? <ErrorState message={items.error.message} /> : null}
          {items.data ? (
            <DataTable
              rows={items.data}
              responsiveCards={true}
              stickyFirstColumn={true}
              stickyLastColumn={true}
              empty={<EmptyState title="Sin inventario" description="No hay productos para los filtros seleccionados." />}
              columns={[
                { key: "name", title: "Producto", render: (row) => <span className="font-semibold text-slate-800 text-sm">{row.name}</span> },
                { key: "sku", title: "SKU", render: (row) => <span className="font-mono text-xs text-slate-500 font-medium">{row.sku}</span> },
                { key: "category", title: "Categoría", render: (row) => <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>{row.category}</span> },
                { key: "stock", title: "Nivel de Stock", render: (row) => (
                  <StockLevelBar item={row} warehouseId={warehouseId} />
                ) },
                { key: "minStock", title: "Seguridad", render: (row) => <span className="text-xs font-mono text-slate-600">{stockFor(row, warehouseId)?.minStock ?? row.minStock}</span> },
                { key: "salePrice", title: "Precio venta", render: (row) => <span className="text-xs font-medium text-slate-700">{row.salePrice ? money(row.salePrice) : "-"}</span> },
                { key: "supplier", title: "Proveedor", render: (row) => <span className="text-xs text-slate-600">{row.supplier?.name ?? "-"}</span> },
                { key: "isActive", title: "", render: (row) => (
                  <RowActionsMenu row={row} onOpenOperation={openOperation} />
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
              { key: "barcode", label: "Código de barras", type: "text" },
              { key: "categoryId", label: "Categoría normalizada", type: "select", options: categoryOptions },
              { key: "category", label: "Categoria", type: "text" },
              { key: "unitId", label: "Unidad normalizada", type: "select", options: unitOptions },
              { key: "unit", label: "Unidad", type: "text" },
              { key: "presentation", label: "Presentación", type: "text" },
              { key: "brand", label: "Marca", type: "text" },
              { key: "stock", label: "Stock inicial", type: "number" },
              { key: "minStock", label: "Stock minimo", type: "number" },
              { key: "averageCost", label: "Costo promedio inicial", type: "number" },
              { key: "salePrice", label: "Precio venta", type: "number" },
              { key: "isSellable", label: "Vendible en caja", type: "checkbox" },
              { key: "tracksLots", label: "Controlar lotes", type: "checkbox" },
              { key: "tracksExpiration", label: "Controlar vencimiento", type: "checkbox" },
              { key: "allowFractionalQuantity", label: "Permitir fracciones", type: "checkbox" },
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
                  isSellable: Boolean(payload.isSellable),
                  tracksLots: Boolean(payload.tracksLots),
                  tracksExpiration: Boolean(payload.tracksExpiration),
                  allowFractionalQuantity: Boolean(payload.allowFractionalQuantity)
                } as never),
              update: async (id, payload) =>
                mutations.updateInventoryItem.mutateAsync({
                  id,
                  payload: {
                    ...payload,
                    ...(payload.minStock !== undefined ? { minStock: Number(payload.minStock) } : {}),
                    ...(payload.salePrice !== undefined ? { salePrice: Number(payload.salePrice || 0) } : {}),
                    isSellable: Boolean(payload.isSellable),
                    tracksLots: Boolean(payload.tracksLots),
                    tracksExpiration: Boolean(payload.tracksExpiration),
                    allowFractionalQuantity: Boolean(payload.allowFractionalQuantity)
                  }
                }),
              deactivate: async (id) => mutations.deactivateInventoryItem.mutateAsync(id),
              mapToForm: (row) => ({
                name: row.name,
                sku: row.sku,
                barcode: row.barcode ?? "",
                categoryId: row.categoryId ?? "",
                category: row.category,
                unitId: row.unitId ?? "",
                unit: row.unit,
                presentation: row.presentation ?? "",
                brand: row.brand ?? "",
                stock: row.stock,
                minStock: row.minStock,
                averageCost: stockFor(row, warehouseId)?.averageCost ?? "",
                salePrice: row.salePrice ?? "",
                isSellable: row.isSellable,
                tracksLots: row.tracksLots,
                tracksExpiration: row.tracksExpiration,
                allowFractionalQuantity: row.allowFractionalQuantity,
                version: row.version,
                branchId: row.branchId,
                warehouseId: stockFor(row, warehouseId)?.warehouseId ?? warehouseId,
                supplierId: row.supplierId ?? ""
              }),
              mapToPayload: (form) => ({
                name: String(form.name || ""),
                sku: String(form.sku || ""),
                barcode: form.barcode ? String(form.barcode) : undefined,
                categoryId: form.categoryId ? String(form.categoryId) : undefined,
                category: String(form.category || ""),
                unitId: form.unitId ? String(form.unitId) : undefined,
                unit: String(form.unit || ""),
                presentation: form.presentation ? String(form.presentation) : undefined,
                brand: form.brand ? String(form.brand) : undefined,
                stock: Number(form.stock || 0),
                minStock: Number(form.minStock || 0),
                averageCost: Number(form.averageCost || 0),
                salePrice: Number(form.salePrice || 0),
                isSellable: Boolean(form.isSellable),
                tracksLots: Boolean(form.tracksLots),
                tracksExpiration: Boolean(form.tracksExpiration),
                allowFractionalQuantity: Boolean(form.allowFractionalQuantity),
                ...(form.version ? { version: Number(form.version) } : {}),
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

      {view === "catalogs" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SimpleCrudPage
            useModal={true}
            showHeader={false}
            title="Categorías"
            description="Clasificación normalizada del catálogo de productos."
            rows={categories.data}
            loading={categories.isLoading}
            error={categories.isError ? categories.error.message : undefined}
            search={categorySearch}
            setSearch={setCategorySearch}
            active={categoryActive}
            setActive={setCategoryActive}
            fields={[
              { key: "name", label: "Nombre", type: "text", required: true },
              { key: "description", label: "Descripción", type: "textarea" }
            ]}
            columns={[
              { key: "name", title: "Categoría" },
              { key: "isActive", title: "Estado", render: (row) => <Badge value={row.isActive ? "ACTIVA" : "INACTIVA"} tone={row.isActive ? "success" : "warning"} /> }
            ]}
            actions={{
              create: async (payload) => mutations.createInventoryCategory.mutateAsync({
                name: String(payload.name || ""),
                description: payload.description ? String(payload.description) : undefined
              }),
              update: async (id, payload) => mutations.updateInventoryCategory.mutateAsync({
                id,
                payload: {
                  name: String(payload.name || ""),
                  description: String(payload.description || ""),
                  version: Number(payload.version)
                }
              }),
              deactivate: async (id) => {
                const row = categories.data?.find((category) => category.id === id);
                if (row) await mutations.updateInventoryCategory.mutateAsync({ id, payload: { isActive: false, version: row.version } });
              },
              mapToForm: (row) => ({ name: row.name, description: row.description ?? "", version: row.version }),
              getId: (row) => row.id
            }}
          />
          <SimpleCrudPage
            useModal={true}
            showHeader={false}
            title="Unidades"
            description="Unidades y precisión permitida para cantidades."
            rows={units.data}
            loading={units.isLoading}
            error={units.isError ? units.error.message : undefined}
            search={unitSearch}
            setSearch={setUnitSearch}
            active={unitActive}
            setActive={setUnitActive}
            fields={[
              { key: "code", label: "Código", type: "text", required: true },
              { key: "name", label: "Nombre", type: "text", required: true },
              { key: "abbreviation", label: "Abreviatura", type: "text", required: true },
              { key: "decimalAllowed", label: "Permitir decimales", type: "checkbox" },
              { key: "precision", label: "Precisión decimal", type: "number" }
            ]}
            columns={[
              { key: "code", title: "Código" },
              { key: "name", title: "Unidad" },
              { key: "abbreviation", title: "Abrev." },
              { key: "isActive", title: "Estado", render: (row) => <Badge value={row.isActive ? "ACTIVA" : "INACTIVA"} tone={row.isActive ? "success" : "warning"} /> }
            ]}
            actions={{
              create: async (payload) => mutations.createInventoryUnit.mutateAsync({
                code: String(payload.code || ""),
                name: String(payload.name || ""),
                abbreviation: String(payload.abbreviation || ""),
                decimalAllowed: Boolean(payload.decimalAllowed),
                precision: Number(payload.precision || 0)
              }),
              update: async (id, payload) => mutations.updateInventoryUnit.mutateAsync({
                id,
                payload: {
                  code: String(payload.code || ""),
                  name: String(payload.name || ""),
                  abbreviation: String(payload.abbreviation || ""),
                  decimalAllowed: Boolean(payload.decimalAllowed),
                  precision: Number(payload.precision || 0),
                  version: Number(payload.version)
                }
              }),
              deactivate: async (id) => {
                const row = units.data?.find((unit) => unit.id === id);
                if (row) await mutations.updateInventoryUnit.mutateAsync({ id, payload: { isActive: false, version: row.version } });
              },
              mapToForm: (row) => ({
                code: row.code,
                name: row.name,
                abbreviation: row.abbreviation,
                decimalAllowed: row.decimalAllowed,
                precision: row.precision,
                version: row.version
              }),
              getId: (row) => row.id
            }}
          />
        </div>
      ) : null}

      {view === "movements" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-6">
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
              <Input aria-label="Fecha inicial" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input aria-label="Fecha final" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              <Button variant="secondary" onClick={exportMovements}>Exportar</Button>
            </div>
          </Card>
          {movements.isLoading ? <LoadingState message="Cargando movimientos..." /> : null}
          {movements.isError ? <ErrorState message={movements.error.message} /> : null}
          {movements.data ? (
            <DataTable
              rows={movements.data}
              responsiveCards={true}
              stickyFirstColumn={true}
              empty={<EmptyState title="Sin movimientos" description="No hay movimientos para los filtros seleccionados." />}
              columns={[
                { key: "type", title: "Operación", render: (row) => <Badge value={movementLabel(row.type)} tone={row.type === "IN" || row.type === "ENTRY" || row.type === "RETURN_IN" ? "success" : row.type === "OUT" || row.type === "EXIT" || row.type === "WASTE" ? "warning" : "default"} /> },
                { key: "createdAt", title: "Fecha", render: (row) => new Date(row.occurredAt ?? row.createdAt).toLocaleString() },
                { key: "inventoryItem", title: "Producto", render: (row) => row.inventoryItem ? `${row.inventoryItem.name} (${row.inventoryItem.sku})` : row.inventoryItemId },
                { key: "warehouse", title: "Origen / destino", render: (row) => {
                  const source = row.sourceWarehouse?.name ?? row.warehouse?.name;
                  const destination = row.destinationWarehouse?.name;
                  return [source, destination].filter(Boolean).join(" → ") || "-";
                } },
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
          <Card className="rounded-lg border-amber-200 bg-amber-50">
            <div className="flex flex-col gap-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
              <span>Productos cuyo stock disponible está igual o por debajo del mínimo configurado por bodega.</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void saveReport("critical", "stock-critico.csv", { branchId: branchId || undefined, warehouseId: warehouseId || undefined })}>Críticos</Button>
                <Button variant="secondary" onClick={() => void saveReport("valuation", "valor-inventario.csv", { branchId: branchId || undefined, warehouseId: warehouseId || undefined })}>Valorización</Button>
                <Button variant="secondary" onClick={() => void saveReport("expiring", "lotes-por-vencer.csv", { branchId: branchId || undefined, warehouseId: warehouseId || undefined })}>Vencimientos</Button>
              </div>
            </div>
          </Card>
          {minStock.isLoading ? <LoadingState message="Cargando stock de seguridad..." /> : null}
          {minStock.isError ? <ErrorState message={minStock.error.message} /> : null}
          {minStock.data ? (
            <DataTable
              rows={minStock.data}
              responsiveCards={true}
              stickyFirstColumn={true}
              stickyLastColumn={true}
              empty={<EmptyState title="Sin alertas" description="No hay productos bajo su stock minimo." />}
              columns={[
                { key: "inventoryItem", title: "Producto", render: (row) => row.inventoryItem?.name ?? "-" },
                { key: "warehouse", title: "Bodega", render: (row) => row.warehouse?.name ?? "-" },
                { key: "stock", title: "Stock actual" },
                { key: "minStock", title: "Stock de seguridad" },
                { key: "averageCost", title: "Costo promedio", render: (row) => money(row.averageCost) },
                { key: "id", title: "Acciones", render: (row) => (
                  <Button
                    variant="secondary"
                    onClick={() => setSafetyStock({
                      inventoryItemId: row.inventoryItemId,
                      warehouseId: row.warehouseId,
                      product: row.inventoryItem?.name ?? "Producto",
                      minStock: String(row.minStock)
                    })}
                  >
                    Configurar
                  </Button>
                ) }
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
            { key: "code", label: "Código", type: "text" },
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
              code: row.code,
              name: row.name,
              description: row.description ?? "",
              branchId: row.branchId,
              isDefault: row.isDefault
            }),
            mapToPayload: (form) => ({
              code: String(form.code || ""),
              name: String(form.name || ""),
              description: String(form.description || ""),
              branchId: String(form.branchId || branchId),
              isDefault: Boolean(form.isDefault)
            }),
            getId: (row) => row.id
          }}
        />
      ) : null}

      <Modal open={operationOpen} title={`Movimiento de Stock — ${movementLabel(operationType)}`} onClose={closeOperation}>
        <div className="flex rounded-lg border border-[var(--border-default)] p-1 bg-slate-100 mb-4 gap-1 overflow-x-auto">
          {[
            { type: "ENTRY", label: "Ingreso", icon: PlusCircle },
            { type: "EXIT", label: "Salida", icon: MinusCircle },
            { type: "TRANSFER", label: "Transferencia", icon: ArrowRightLeft },
            { type: "WASTE", label: "Merma", icon: AlertTriangle },
            ...(selectedMovementItem?.isSellable ? [{ type: "SALE", label: "Venta", icon: ShoppingCart }] : [])
          ].map((op) => {
            const Icon = op.icon;
            const isSelected = operationType === op.type;
            return (
              <button
                key={op.type}
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                  isSelected
                    ? "bg-white text-[var(--text-brand-strong)] shadow-sm font-semibold border border-[var(--border-default)]"
                    : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setOperationType(op.type as OperationType)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{op.label}</span>
              </button>
            );
          })}
        </div>
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
              {operationType === "TRANSFER" ? "Bodega origen" : "Bodega"}
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
          {operationType === "TRANSFER" ? (
            <label className="block text-sm text-slate-700">
              Bodega destino
              <Select
                required
                value={movementForm.destinationWarehouseId}
                onChange={(event) => setMovementForm((current) => ({ ...current, destinationWarehouseId: event.target.value }))}
              >
                <option value="">Selecciona</option>
                {activeWarehouses.data
                  ?.filter((warehouse) => warehouse.id !== selectedWarehouse?.id)
                  .map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </Select>
            </label>
          ) : null}
          {operationType === "ENTRY" ? (
            <label className="block text-sm text-slate-700">
              Costo unitario
              <Input min={0} step="0.01" type="number" value={movementForm.unitCost} onChange={(event) => setMovementForm((current) => ({ ...current, unitCost: event.target.value }))} />
            </label>
          ) : null}
          {selectedMovementItem?.tracksLots ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Lote
                <Input
                  required={operationType === "ENTRY"}
                  value={movementForm.lotNumber}
                  onChange={(event) => setMovementForm((current) => ({ ...current, lotNumber: event.target.value }))}
                />
              </label>
              {selectedMovementItem.tracksExpiration ? (
                <label className="text-sm text-slate-700">
                  Vencimiento
                  <Input
                    required={operationType === "ENTRY"}
                    type="date"
                    value={movementForm.expirationDate}
                    onChange={(event) => setMovementForm((current) => ({ ...current, expirationDate: event.target.value }))}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {operationType === "SALE" ? (
            <label className="block text-sm text-slate-700">
              Precio unitario
              <Input required min={0} step="0.01" type="number" value={movementForm.unitPrice} onChange={(event) => setMovementForm((current) => ({ ...current, unitPrice: event.target.value }))} />
            </label>
          ) : null}
          <label className="block text-sm text-slate-700">
            Detalle
            <Input required={operationType !== "ENTRY"} placeholder="Motivo o detalle del movimiento" value={movementForm.reason} onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeOperation}>Cancelar</Button>
            <Button type="submit" disabled={mutations.postInventoryMovement.isPending || mutations.createInventoryProductSale.isPending}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(safetyStock)} title="Configurar stock de seguridad" onClose={() => setSafetyStock(null)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!safetyStock) return;
            void mutations.updateInventoryStock.mutateAsync({
              inventoryItemId: safetyStock.inventoryItemId,
              warehouseId: safetyStock.warehouseId,
              payload: { minStock: numberValue(safetyStock.minStock) }
            }).then(() => setSafetyStock(null));
          }}
        >
          <p className="text-sm text-slate-600">{safetyStock?.product}</p>
          <label className="block text-sm text-slate-700">
            Stock mínimo
            <Input
              required
              min={0}
              step="0.01"
              type="number"
              value={safetyStock?.minStock ?? ""}
              onChange={(event) => setSafetyStock((current) => current ? { ...current, minStock: event.target.value } : current)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSafetyStock(null)}>Cancelar</Button>
            <Button type="submit" disabled={mutations.updateInventoryStock.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
