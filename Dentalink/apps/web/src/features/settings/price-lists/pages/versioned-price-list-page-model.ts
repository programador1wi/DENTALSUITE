import type { Currency, PriceListStatus } from "../services/versioned-price-lists.service";

export const statusLabel: Record<PriceListStatus, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programado",
  ACTIVE: "Activo",
  SUPERSEDED: "Reemplazado",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado"
};

export function statusTone(status: PriceListStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "DRAFT" || status === "SCHEDULED") return "warning" as const;
  return "default" as const;
}

export function money(value: string, currency: Currency) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(
    Number(value)
  );
}

export function procedureDisplayId(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "-";
  return String(Number(value)).padStart(6, "0");
}

export function historyDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export const auditActionLabel: Record<string, string> = {
  "price_list.created": "Listado creado",
  "price_list.version_created": "Borrador creado",
  "price_list.version_superseded": "Versión reemplazada",
  "price_list.published": "Versión publicada",
  "price_list_item.deactivated": "Prestación desactivada",
  "price_import.applied": "Importación aplicada",
  "price_import.reverted": "Importación revertida",
  "treatment_plan.repriced": "Tratamiento recalculado"
};

export const fieldLabels: Record<string, string> = {
  versionNumber: "Número de versión",
  status: "Estado del listado",
  currency: "Moneda de cobro",
  changeSummary: "Resumen de cambios",
  itemCount: "Total de prestaciones",
  name: "Nombre del tarifario",
  code: "Código de referencia",
  description: "Descripción",
  basePrice: "Precio base",
  maxDiscountPercent: "% Descuento máx.",
  allowDiscount: "Permite descuento",
  laboratoryCost: "Costo laboratorio",
  internalCost: "Costo interno / insumos",
  branchIds: "Sucursales asignadas",
  branches: "Sucursales",
  type: "Tipo de arancel",
  isDefault: "Listado predeterminado"
};

const ignoredAuditKeys = new Set([
  "id",
  "checksum",
  "organizationId",
  "priceListId",
  "scopes",
  "replacedVersions",
  "previousVersionId",
  "updatedById",
  "validTo",
  "validFrom",
  "createdAt",
  "updatedAt",
  "sourceVersionId",
  "version",
  "rawPayload",
  "meta",
  "tenantId",
  "actorId",
  "userId",
  "correlationId",
  "entityId"
]);

export type AuditRecord = Record<string, unknown>;
export type PriceItemDiff = {
  code: string;
  name: string;
  type: "ADDED" | "REMOVED" | "MODIFIED";
  oldPrice?: number;
  newPrice?: number;
};

export function normalizeAuditRecord(value: unknown): AuditRecord {
  return typeof value === "object" && value !== null ? (value as AuditRecord) : {};
}

export function cleanAuditEntries(record: AuditRecord) {
  return Object.entries(record).filter(([key, value]) => {
    if (ignoredAuditKeys.has(key)) return false;
    if (/id$/i.test(key) || /_id$/i.test(key) || /hash$/i.test(key) || /checksum$/i.test(key)) return false;
    if (key === "items") return false;
    return value !== undefined;
  });
}

export function auditItems(record: AuditRecord): AuditRecord[] {
  return Array.isArray(record.items) ? record.items.map(normalizeAuditRecord) : [];
}

export function buildPriceItemDiffs(oldItems: AuditRecord[], newItems: AuditRecord[]): PriceItemDiff[] {
  const items = new Map<string, { oldItem?: AuditRecord; newItem?: AuditRecord }>();
  for (const item of oldItems) {
    const key = auditItemKey(item);
    if (key) items.set(key, { oldItem: item });
  }
  for (const item of newItems) {
    const key = auditItemKey(item);
    if (!key) continue;
    const existing = items.get(key);
    if (existing) existing.newItem = item;
    else items.set(key, { newItem: item });
  }

  const diffs: PriceItemDiff[] = [];
  for (const { oldItem, newItem } of items.values()) {
    const name = auditItemText(newItem, "name") || auditItemText(oldItem, "name") || "Prestación";
    const code = auditItemText(newItem, "code") || auditItemText(oldItem, "code");
    if (!oldItem && newItem) {
      diffs.push({ code, name, type: "ADDED", newPrice: Number(newItem.basePrice) });
    } else if (oldItem && !newItem) {
      diffs.push({ code, name, type: "REMOVED", oldPrice: Number(oldItem.basePrice) });
    } else if (oldItem && newItem) {
      const oldPrice = Number(oldItem.basePrice);
      const newPrice = Number(newItem.basePrice);
      if (oldPrice !== newPrice || oldItem.status !== newItem.status) {
        diffs.push({ code, name, type: "MODIFIED", oldPrice, newPrice });
      }
    }
  }
  return diffs;
}

function auditItemKey(item: AuditRecord) {
  const procedure = normalizeAuditRecord(item.procedure);
  const value = item.procedureId || item.id || procedure.code || procedure.name;
  return value ? String(value) : "";
}

function auditItemText(item: AuditRecord | undefined, key: "name" | "code") {
  if (!item) return "";
  const procedure = normalizeAuditRecord(item.procedure);
  const value = procedure[key] || item[key];
  return value ? String(value) : "";
}
