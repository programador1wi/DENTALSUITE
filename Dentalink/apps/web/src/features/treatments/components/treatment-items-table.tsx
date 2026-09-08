import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  DollarSign,
  FolderOpen,
  GripVertical,
  Link2Off,
  Plus,
  RotateCcw,
  ShoppingCart,
  Stethoscope,
  Trash2,
  UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BulkDiscountModal,
  isBulkDiscountEligible,
  itemDiscountBase,
  itemPaidAmount
} from "./bulk-discount-modal";
import {
  fdiLabel,
  finiteNumberValue,
  money,
  numberValue,
  surfaceLabel
} from "./treatment-modal-helpers";
import type {
  TreatmentPlanDetail,
  TreatmentPlanItem,
  TreatmentPlanItemStatus,
  TreatmentPlanProceduresResult
} from "@/features/treatments/services/treatments.service";

export const ITEM_STATUS_LABELS: Record<TreatmentPlanItemStatus, string> = {
  PLANNED: "Planificado",
  ACCEPTED: "Aceptado",
  PAID: "Pagado",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado"
};

export const PRICE_SOURCE_LABELS = {
  PRICE_LIST: "Arancel",
  MANUAL: "Manual",
  UNPRICED: "Sin precio"
} as const;

export function planClinicalProgressPercentage(plan: {
  clinicalProgress?: { displayPercentage?: number; percentage?: number } | null;
  items?: Array<{ status: TreatmentPlanItemStatus; completionPercentage?: number | null }>;
}): number {
  const explicit = finiteNumberValue(
    plan.clinicalProgress?.displayPercentage ?? plan.clinicalProgress?.percentage,
    NaN
  );
  if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, Math.round(explicit)));

  const activeItems = (plan.items ?? []).filter((item) => item.status !== "CANCELLED");
  if (!activeItems.length) return 0;
  const average =
    activeItems.reduce((sum, item) => {
      if (Number.isFinite(Number(item.completionPercentage))) return sum + Number(item.completionPercentage);
      if (item.status === "COMPLETED") return sum + 100;
      if (item.status === "IN_PROGRESS") return sum + 25;
      return sum;
    }, 0) / activeItems.length;
  return Math.min(100, Math.max(0, Math.round(average)));
}

function itemStatusDotClass(status: TreatmentPlanItemStatus): string {
  if (status === "COMPLETED" || status === "PAID") return "bg-green-600";
  if (status === "CANCELLED") return "bg-slate-400";
  if (status === "IN_PROGRESS") return "bg-sky-600";
  return "bg-red-600";
}

function itemCompletionPercentage(item: TreatmentPlanItem): number {
  if (typeof item.completionPercentage === "number") {
    return Number.isFinite(item.completionPercentage)
      ? Math.min(100, Math.max(0, item.completionPercentage))
      : 0;
  }
  if (item.status === "COMPLETED") return 100;
  if (item.status === "IN_PROGRESS") return 25;
  return 0;
}

function itemDiscountPercent(item: TreatmentPlanItem): number {
  const base = itemDiscountBase(item);
  if (!base) return 0;
  return Math.round((numberValue(item.discount) / base) * 100);
}

function ProgressRing({ percentage, active }: { percentage: number; active?: boolean }) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0;
  const offset = circumference - (safePercentage / 100) * circumference;

  return (
    <svg className="h-8 w-8" viewBox="0 0 32 32" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="white"
        stroke={active ? "#38bdf8" : "#cbd5e1"}
        strokeWidth="4"
      />
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        stroke="#2563eb"
        strokeLinecap="round"
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 16 16)"
      />
      <text x="16" y="19" textAnchor="middle" className="fill-slate-700 text-[8px] font-bold">
        {Math.round(safePercentage)}
      </text>
    </svg>
  );
}

export function TreatmentItemsTable({
  plan,
  activePriceVersionNumber,
  proceduresData,
  loadingProcedures,
  onAssignPiece,
  onMarkFuture,
  onUnrealize,
  onUnlinkPayment,
  onPay,
  onCreateSection,
  onOpenProcedureCatalog,
  onSelectPiece,
  onEvolveItem,
  canApplyTreatmentDiscount,
  onApplyBulkDiscount,
  onDelete
}: {
  plan: TreatmentPlanDetail;
  activePriceVersionNumber?: number | null;
  proceduresData: TreatmentPlanProceduresResult | null;
  loadingProcedures: boolean;
  onAssignPiece: (item: TreatmentPlanItem) => void;
  onMarkFuture: (item: TreatmentPlanItem) => void;
  onUnrealize: (item: TreatmentPlanItem) => void;
  onUnlinkPayment: (item: TreatmentPlanItem) => void;
  onPay: (item: TreatmentPlanItem) => void;
  onCreateSection: () => void;
  onOpenProcedureCatalog: () => void;
  onSelectPiece: (item: TreatmentPlanItem) => void;
  onEvolveItem: (item: TreatmentPlanItem) => void;
  canApplyTreatmentDiscount: boolean;
  onApplyBulkDiscount: (payload: {
    itemIds: string[];
    discountType: "PERCENTAGE" | "AMOUNT";
    value: number;
    discountReason?: string;
  }) => Promise<unknown>;
  onDelete: (itemId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [bulkDiscountOpen, setBulkDiscountOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const proceduresCount = proceduresData?.summary.proceduresCount ?? plan.items.length;
  const sectionsCount = proceduresData?.summary.sectionsCount ?? plan.sections.length;
  const completedCount =
    proceduresData?.summary.completedCount ?? plan.items.filter((item) => item.status === "COMPLETED").length;
  const clinicalProgress =
    proceduresData?.summary.clinicalProgress?.displayPercentage ?? planClinicalProgressPercentage(plan);
  const withDebtCount =
    proceduresData?.summary.withDebtCount ??
    plan.items.filter((item) => Math.max(numberValue(item.total) - itemPaidAmount(item), 0) > 0).length;
  const procedureRows = [
    ...(proceduresData?.sections.flatMap((section) => section.procedures) ?? []),
    ...(proceduresData?.unsectionedProcedures ?? [])
  ];
  const discountLimitsByItemId = new Map(procedureRows.map((item) => [item.id, item.pricing] as const));
  const eligibleDiscountItems = canApplyTreatmentDiscount
    ? plan.items.filter(
        (item) =>
          isBulkDiscountEligible(item) &&
          Number(discountLimitsByItemId.get(item.id)?.effectiveMaximumDiscountPercent ?? 0) > 0
      )
    : [];

  useEffect(() => {
    if (!actionsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionsOpen]);

  useEffect(() => {
    setSelectedItemIds((current) => current.filter((id) => plan.items.some((item) => item.id === id)));
  }, [plan.items]);

  const toggleItem = (itemId: string) => {
    setExpandedItemId((current) => (current === itemId ? "" : itemId));
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Procedimientos del plan</h2>
            <p className="text-xs text-slate-500">
              Procedimientos asociados al odontograma, presupuesto y seguimiento clinico.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              <span>
                {proceduresCount} {proceduresCount === 1 ? "procedimiento" : "procedimientos"}
              </span>
              <span>
                {sectionsCount} {sectionsCount === 1 ? "seccion" : "secciones"}
              </span>
              <span>{clinicalProgress}% avance clinico</span>
              <span>{completedCount} realizados</span>
              <span>{withDebtCount} con deuda</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCreateSection}>
              <Plus className="mr-1 h-4 w-4" />
              Seccion
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenProcedureCatalog}>
              <Plus className="mr-1 h-4 w-4" />
              Procedimiento
            </Button>
            <div className="relative" ref={actionsRef}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!proceduresCount}
                title={
                  !proceduresCount ? "Agrega procedimientos para habilitar las acciones masivas." : undefined
                }
                aria-label="Acciones masivas de procedimientos"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setActionsOpen(false);
                }}
                onClick={() => setActionsOpen((current) => !current)}
              >
                Acciones
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
              {actionsOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                    disabled={!eligibleDiscountItems.length}
                    title={
                      !canApplyTreatmentDiscount
                        ? "No tienes permiso para aplicar descuentos."
                        : !eligibleDiscountItems.length
                          ? "No hay prestaciones descontables disponibles."
                          : undefined
                    }
                    onClick={() => {
                      if (!eligibleDiscountItems.length) return;
                      setActionsOpen(false);
                      setBulkDiscountOpen(true);
                    }}
                  >
                    Establecer descuentos multiples
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {loadingProcedures ? (
            <span className="text-xs text-slate-400">Actualizando procedimientos...</span>
          ) : null}
          <div className="hidden min-w-[500px] grid-cols-[1fr_72px_84px_90px_72px_72px] gap-3 text-right text-[11px] font-bold uppercase text-slate-500 md:grid">
            <span className="text-left">Pieza</span>
            <span>Dscto</span>
            <span>Precio</span>
            <span>Pago</span>
            <span>Futuro</span>
            <span>Estado</span>
          </div>
        </div>
      </div>

      {plan.items.length ? (
        <div className="overflow-x-auto bg-slate-50/70 p-3">
          <div className="min-w-[760px] space-y-3">
            {plan.items.map((item) => {
              const expanded = expandedItemId === item.id;
              const paid = itemPaidAmount(item);
              const pending = Math.max(numberValue(item.total) - paid, 0);
              const markedForFuture = Boolean(item.plannedAt);
              const completionPercentage = itemCompletionPercentage(item);
              const procedureLabel = item.procedure
                ? `[${item.procedure.code}] ${item.procedure.name}`
                : item.procedureId;
              const toothLabel = item.toothNumber ? fdiLabel(item.toothNumber) : "";
              const surfaces = surfaceLabel(item.surface);
              const surfaceDetail = surfaces === "Pieza completa" ? "Completa" : surfaces;
              const selectAndToggle = () => {
                onSelectPiece(item);
                toggleItem(item.id);
              };

              return (
                <article
                  key={item.id}
                  className={`border bg-white shadow-sm transition ${expanded ? "border-sky-100 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="grid w-full grid-cols-[74px_minmax(180px,1fr)_80px_70px_88px_82px_44px_38px] items-center gap-3 px-4 py-3 text-left"
                    onClick={selectAndToggle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") selectAndToggle();
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${procedureLabel}`}
                        checked={selectedItemIds.includes(item.id)}
                        disabled={!canApplyTreatmentDiscount || !isBulkDiscountEligible(item)}
                        title={
                          item.allowsDiscountSnapshot === false
                            ? "Esta prestación no permite descuentos según la configuración del arancel"
                            : undefined
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedItemIds((current) =>
                            checked
                              ? [...new Set([...current, item.id])]
                              : current.filter((id) => id !== item.id)
                          );
                        }}
                      />
                      {completionPercentage === 100 ? (
                        <span
                          className="relative grid h-8 w-8 place-items-center rounded-full text-slate-500"
                          title="Prestación realizada"
                        >
                          <CheckCircle2 className="h-7 w-7 text-green-600" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="relative grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-sky-50 hover:text-sky-700"
                          aria-label={`Evolucionar prestacion al ${completionPercentage}%`}
                          title={`Avance ${completionPercentage}%`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onEvolveItem(item);
                          }}
                        >
                          <ProgressRing percentage={completionPercentage} active={expanded} />
                        </button>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-xs font-semibold uppercase leading-snug text-slate-900">
                        {procedureLabel}
                      </span>
                      {item.section?.name ? (
                        <span className="mt-1 block text-[11px] text-slate-500">{item.section.name}</span>
                      ) : null}
                      <span className="mt-1 block truncate text-[11px] text-slate-500">
                        {PRICE_SOURCE_LABELS[item.priceSource ?? "MANUAL"]}
                        {item.priceSnapshotName ? ` - ${item.priceSnapshotName}` : ""}
                        {item.priceListVersionNumber ? ` · v${item.priceListVersionNumber}` : ""}
                        {item.priceListVersionNumber &&
                        activePriceVersionNumber &&
                        item.priceListVersionNumber !== activePriceVersionNumber
                          ? " · precio histórico"
                          : ""}
                      </span>
                    </span>

                    <span className="flex justify-center">
                      <button
                        type="button"
                        aria-label="Asignar pieza dental"
                        className="group inline-flex h-10 min-w-14 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAssignPiece(item);
                        }}
                      >
                        <img
                          src="/logo-2.png"
                          alt=""
                          className="h-5 w-5 object-contain opacity-75 group-hover:opacity-100"
                        />
                        <span className="flex flex-col items-start leading-none">
                          <span>{toothLabel || "+"}</span>
                          {surfaceDetail ? (
                            <span className="mt-0.5 text-[9px] font-medium">{surfaceDetail}</span>
                          ) : null}
                        </span>
                      </button>
                    </span>

                    <span className="text-center text-sm font-medium text-slate-900">
                      {item.allowsDiscountSnapshot === false ? (
                        <span
                          className="inline-flex rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500"
                          title="Esta prestación no permite descuentos según la configuración del arancel"
                        >
                          No desc.
                        </span>
                      ) : (
                        `${itemDiscountPercent(item)}%`
                      )}
                    </span>
                    <span className="text-right text-sm font-semibold text-slate-900">
                      {money(numberValue(item.total))}
                    </span>
                    <span className="text-right text-xs font-medium text-slate-600">
                      {paid ? money(paid) : "-"}
                    </span>
                    <span className="flex justify-center">
                      <button
                        type="button"
                        aria-label={
                          markedForFuture ? "Desmarcar futura realizacion" : "Marcar futura realizacion"
                        }
                        title={
                          markedForFuture
                            ? "Prestación marcada para futura realizacion"
                            : "Prestación desmarcada para futura realizacion"
                        }
                        className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-green-50 ${markedForFuture ? "text-green-600" : "text-slate-300"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onMarkFuture(item);
                        }}
                      >
                        <ShoppingCart className="h-5 w-5" />
                      </button>
                    </span>
                    <span className="flex justify-end">
                      <span
                        className={`h-4 w-4 rounded-full ${itemStatusDotClass(item.status)}`}
                        title={ITEM_STATUS_LABELS[item.status]}
                      />
                    </span>
                  </div>

                  {expanded ? (
                    <div className="border-t border-sky-100 bg-sky-50 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-5 text-xs">
                        <button
                          type="button"
                          disabled={item.status === "COMPLETED"}
                          className="inline-flex items-center gap-1 font-medium text-[#0b8bd8] hover:text-[#0b8bd8]/80 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => {
                            onEvolveItem(item);
                          }}
                        >
                          <Stethoscope className="h-4 w-4" />
                          Evoluciónar / Realizar
                        </button>
                        <button
                          type="button"
                          disabled={item.status === "PLANNED"}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onUnrealize(item)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Desrealizar
                        </button>
                        <button
                          type="button"
                          disabled={!item.paymentAllocations?.length}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onUnlinkPayment(item)}
                        >
                          <Link2Off className="h-4 w-4" />
                          Desasociar pago
                        </button>
                        <button
                          type="button"
                          disabled={pending <= 0}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onPay(item)}
                        >
                          <DollarSign className="h-4 w-4" />
                          Abonar
                        </button>
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={item.status === "PAID"}
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 border-l-4 border-slate-200 pl-5 text-sm md:grid-cols-[220px_1fr_1fr]">
                        <div className="flex gap-3">
                          <GripVertical className="mt-1 h-5 w-5 text-slate-300" />
                          <UserCircle className="mt-1 h-9 w-9 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">Creado por</p>
                          <p className="font-semibold text-slate-900">Sistema</p>
                          <p className="text-xs text-slate-500">Plan actual</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">Realizado por</p>
                          <p className="italic text-slate-500">
                            {item.status === "COMPLETED"
                              ? "Prestación marcada como realizada"
                              : "Esta prestación aun no ha sido realizada"}
                          </p>
                          {toothLabel ? (
                            <p className="mt-2 text-xs text-slate-600">
                              Pieza {toothLabel}
                              {surfaces ? ` · ${surfaces}` : ""}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-slate-600">
                            Origen precio: {PRICE_SOURCE_LABELS[item.priceSource ?? "MANUAL"]}
                            {item.priceSnapshotName ? ` - ${item.priceSnapshotName}` : ""}
                            {item.priceSnapshotCategory ? ` - ${item.priceSnapshotCategory}` : ""}
                            {item.priceListVersionNumber ? ` · v${item.priceListVersionNumber}` : ""}
                            {item.priceListVersionNumber &&
                            activePriceVersionNumber &&
                            item.priceListVersionNumber !== activePriceVersionNumber
                              ? " · precio histórico"
                              : ""}
                          </p>
                          <p
                            className={`mt-2 text-xs font-semibold ${
                              item.allowsDiscountSnapshot === false ? "text-slate-500" : "text-emerald-700"
                            }`}
                            title={
                              item.allowsDiscountSnapshot === false
                                ? "Esta prestación no permite descuentos según la configuración del arancel"
                                : undefined
                            }
                          >
                            {item.allowsDiscountSnapshot === false
                              ? "No permite descuento"
                              : "Permite descuento"}
                          </p>
                          {item.notes ? <p className="mt-2 text-xs text-slate-600">{item.notes}</p> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 py-10">
          <div className="mx-auto max-w-xl rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              Este plan todavia no tiene procedimientos.
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Agrega una seccion para organizar el tratamiento o anade directamente un procedimiento.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={onCreateSection}>
                <Plus className="mr-1 h-4 w-4" />
                Crear primera seccion
              </Button>
              <Button onClick={onOpenProcedureCatalog}>
                <Plus className="mr-1 h-4 w-4" />
                Agregar procedimiento
              </Button>
            </div>
          </div>
        </div>
      )}
      <BulkDiscountModal
        open={bulkDiscountOpen}
        plan={plan}
        selectedItemIds={selectedItemIds}
        eligibleItems={eligibleDiscountItems}
        discountLimitsByItemId={discountLimitsByItemId}
        onSelectedItemIdsChange={setSelectedItemIds}
        onClose={() => setBulkDiscountOpen(false)}
        onApply={async (payload) => {
          await onApplyBulkDiscount(payload);
          setBulkDiscountOpen(false);
          setSelectedItemIds([]);
          toast.success("Los descuentos fueron actualizados correctamente.");
        }}
      />
    </section>
  );
}
