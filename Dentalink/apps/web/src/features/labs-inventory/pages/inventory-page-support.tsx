import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRightLeft, MinusCircle, MoreVertical, PlusCircle, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem, InventoryMovementType } from "../services/labs-inventory.service";

export type InventoryView = "inventory" | "products" | "catalogs" | "movements" | "safety" | "warehouses";
export type OperationType =
  | "ENTRY"
  | "EXIT"
  | "TRANSFER"
  | "POSITIVE_ADJUSTMENT"
  | "NEGATIVE_ADJUSTMENT"
  | "WASTE"
  | "SALE";

export const movementTypes: InventoryMovementType[] = [
  "ENTRY",
  "EXIT",
  "TRANSFER",
  "POSITIVE_ADJUSTMENT",
  "NEGATIVE_ADJUSTMENT",
  "WASTE",
  "SUPPLIER_RETURN",
  "RETURN_IN",
  "PHYSICAL_COUNT_ADJUSTMENT",
  "COMPENSATION",
  "IN",
  "OUT",
  "ADJUSTMENT"
];

export function asInventoryView(value: string | null): InventoryView {
  if (value === "products" || value === "catalogs" || value === "movements" || value === "safety" || value === "warehouses") {
    return value;
  }
  return "inventory";
}

export function movementLabel(type: InventoryMovementType | OperationType) {
  if (type === "IN" || type === "ENTRY" || type === "RETURN_IN") return "Entrada";
  if (type === "OUT" || type === "EXIT") return "Salida";
  if (type === "SALE") return "Venta";
  if (type === "TRANSFER") return "Transferencia";
  if (type === "WASTE") return "Merma";
  if (type === "SUPPLIER_RETURN") return "Devolución a proveedor";
  if (type === "POSITIVE_ADJUSTMENT") return "Ajuste positivo";
  if (type === "NEGATIVE_ADJUSTMENT") return "Ajuste negativo";
  if (type === "PHYSICAL_COUNT_ADJUSTMENT") return "Ajuste por conteo";
  if (type === "COMPENSATION") return "Compensación";
  return "Ajuste heredado";
}

export function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number.isFinite(parsed) ? parsed : 0
  );
}

export function stockFor(item: InventoryItem, warehouseId?: string) {
  const rows = item.stocks ?? [];
  if (warehouseId) return rows.find((row) => row.warehouseId === warehouseId) ?? null;
  return rows.find((row) => row.warehouse?.isDefault) ?? rows[0] ?? null;
}

export function stockTone(item: InventoryItem, warehouseId?: string) {
  const stock = stockFor(item, warehouseId);
  if (!stock) return "warning";
  if (Number(stock.stock) === 0) return "danger";
  if (Number(stock.stock) <= Number(stock.minStock)) return "warning";
  return "success";
}

export function StockLevelBar({ item, warehouseId }: { item: InventoryItem; warehouseId?: string }) {
  const stock = stockFor(item, warehouseId);
  const stockQty = numberValue(stock?.stock);
  const minQty = numberValue(stock?.minStock ?? item.minStock);
  let barColor = "bg-emerald-500";
  let barBg = "bg-emerald-100";
  let statusLabel = "Óptimo";
  let badgeTone: "success" | "warning" | "danger" = "success";

  if (stockQty === 0) {
    badgeTone = "danger";
    barColor = "bg-rose-500";
    barBg = "bg-rose-100";
    statusLabel = "Agotado";
  } else if (stockQty <= minQty) {
    badgeTone = "warning";
    barColor = "bg-amber-500";
    barBg = "bg-amber-100";
    statusLabel = "Bajo";
  }

  const maxRef = Math.max(minQty * 2, 40);
  const percentage = stockQty === 0 ? 100 : Math.min(100, Math.max(8, Math.round((stockQty / maxRef) * 100)));

  return (
    <div className="flex flex-col gap-1 w-36 py-0.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900">
          {stockQty} <span className="text-[10px] text-slate-400 font-normal">/ mín {minQty}</span>
        </span>
        <Badge value={statusLabel} tone={badgeTone} />
      </div>
      <div className={`h-1.5 w-full rounded-full ${barBg} overflow-hidden`}>
        <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function RowActionsMenu({
  row,
  onOpenOperation
}: {
  row: InventoryItem;
  onOpenOperation: (type: OperationType, item: InventoryItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const action = (
    type: OperationType,
    label: string,
    Icon: typeof PlusCircle,
    className: string,
    iconClassName: string
  ) => (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors ${className}`}
      onClick={() => {
        setOpen(false);
        onOpenOperation(type, row);
      }}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all shadow-xs"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title="Acciones de producto"
      >
        <MoreVertical className="h-4 w-4 shrink-0" />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-48 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 slide-in-from-top-1"
          onClick={(event) => event.stopPropagation()}
        >
          {action("ENTRY", "Ingresar Stock", PlusCircle, "hover:bg-emerald-50 hover:text-emerald-700", "text-emerald-600")}
          {action("EXIT", "Sacar Stock", MinusCircle, "hover:bg-amber-50 hover:text-amber-700", "text-amber-600")}
          {action("TRANSFER", "Transferir", ArrowRightLeft, "hover:bg-blue-50 hover:text-blue-700", "text-blue-600")}
          {action("WASTE", "Registrar Merma", AlertTriangle, "hover:bg-rose-50 hover:text-rose-700", "text-rose-600")}
          {row.isSellable
            ? action(
                "SALE",
                "Vender en Caja",
                ShoppingCart,
                "hover:bg-purple-50 hover:text-purple-700 border-t border-slate-100 mt-1 pt-2",
                "text-purple-600"
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}
