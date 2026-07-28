import { useMemo, useState } from "react";
import {
  Banknote,
  Check,
  CircleDollarSign,
  CreditCard,
  Globe2,
  History,
  Landmark,
  PencilLine,
  Plus,
  Power,
  RotateCcw,
  Search,
  SlidersHorizontal,
  WalletCards,
  X
} from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { UserDiscountLimitsPanel } from "../components/user-discount-limits-panel";
import { CashDiscountsPanel } from "../components/cash-discounts-panel";
import {
  useCreatePaymentMethod,
  useDeactivatePaymentMethod,
  usePaymentMethodAudit,
  usePaymentMethods,
  useReactivatePaymentMethod,
  useUpdatePaymentMethod
} from "../hooks/use-payment-methods";
import type { PaymentMethod, PaymentMethodPayload } from "../services/payment-methods.service";

const methodTypes = {
  CASH: { label: "Efectivo", icon: Banknote },
  CARD: { label: "Tarjeta", icon: CreditCard },
  TRANSFER: { label: "Transferencia", icon: Landmark },
  DEPOSIT: { label: "Depósito", icon: WalletCards },
  ONLINE: { label: "Online", icon: Globe2 },
  CREDIT: { label: "Crédito", icon: CircleDollarSign },
  CHECK: { label: "Cheque", icon: WalletCards },
  BONUS: { label: "Bono", icon: CircleDollarSign },
  INSURANCE: { label: "Seguro", icon: Landmark },
  OTHER: { label: "Otro", icon: SlidersHorizontal }
} satisfies Record<PaymentMethod["type"], { label: string; icon: typeof Banknote }>;

const reportingRules: Array<{
  key: keyof Pick<
    PaymentMethodPayload,
    | "includeInCollectionReports"
    | "includeInPhysicalCashBalance"
    | "includeInCashFlowReports"
    | "includeInClosingSummary"
    | "includeInGraphicalReports"
  >;
  label: string;
  description: string;
}> = [
  {
    key: "includeInCollectionReports",
    label: "Incluir en recaudación",
    description: "Suma este medio a los totales recaudados del periodo."
  },
  {
    key: "includeInPhysicalCashBalance",
    label: "Afecta efectivo físico",
    description: "Modifica el dinero que debe encontrarse físicamente al cerrar caja."
  },
  {
    key: "includeInCashFlowReports",
    label: "Incluir en flujo de caja",
    description: "Muestra sus movimientos en el reporte de entradas y salidas."
  },
  {
    key: "includeInClosingSummary",
    label: "Incluir en resumen de cierre",
    description: "Muestra el medio en el desglose del cierre sin alterar la conciliación física."
  },
  {
    key: "includeInGraphicalReports",
    label: "Incluir en reportes gráficos",
    description: "Considera sus importes en indicadores y gráficas financieras."
  }
];

function newPaymentMethod(): PaymentMethodPayload {
  return {
    name: "",
    type: "CASH",
    retentionPercent: 0,
    allowsRefund: true,
    acceptsMultipleSettlements: false,
    requiresReference: false,
    requiresFinancialInstitution: false,
    fiscalCode: "",
    includeInCollectionReports: true,
    includeInPhysicalCashBalance: true,
    includeInCashFlowReports: true,
    includeInClosingSummary: true,
    includeInGraphicalReports: true
  };
}

function paymentMethodForm(method: PaymentMethod): PaymentMethodPayload {
  return {
    name: method.name,
    type: method.type,
    retentionPercent: Number(method.retentionPercent),
    allowsRefund: method.allowsRefund,
    acceptsMultipleSettlements: method.acceptsMultipleSettlements,
    requiresReference: method.requiresReference,
    requiresFinancialInstitution: method.requiresFinancialInstitution,
    fiscalCode: method.fiscalCode ?? "",
    includeInCollectionReports: method.includeInCollectionReports,
    includeInPhysicalCashBalance: method.includeInPhysicalCashBalance,
    includeInCashFlowReports: method.includeInCashFlowReports,
    includeInClosingSummary: method.includeInClosingSummary,
    includeInGraphicalReports: method.includeInGraphicalReports
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible completar la operación.";
}

function RuleState({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      aria-label={`${label}: ${enabled ? "sí" : "no"}`}
      title={`${label}: ${enabled ? "sí" : "no"}`}
      className={
        enabled
          ? "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-full)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
          : "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-full)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]"
      }
    >
      {enabled ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <X className="h-4 w-4" aria-hidden="true" />
      )}
    </span>
  );
}

export function PaymentMethodsSettingsPage() {
  const { hasPermission } = usePermissions();
  const canConfigureDiscounts =
    hasPermission("treatment_discount.configure_user_limits") || hasPermission("system.manage_all");
  const canViewCashDiscounts =
    hasPermission("payment_options.cash_discounts.view") || hasPermission("system.manage_all");
  const canCreateMethod = hasPermission("payment_methods.create") || hasPermission("system.manage_all");
  const canUpdateMethod = hasPermission("payment_methods.update") || hasPermission("system.manage_all");
  const canDeactivateMethod =
    hasPermission("payment_methods.deactivate") || hasPermission("system.manage_all");
  const canReactivateMethod =
    hasPermission("payment_methods.reactivate") || hasPermission("system.manage_all");
  const canViewAudit = hasPermission("payment_methods.view_audit") || hasPermission("system.manage_all");
  const [section, setSection] = useState<"methods" | "cash-discounts" | "user-discounts">("methods");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<"true" | "false">("true");
  const [typeFilter, setTypeFilter] = useState<"" | PaymentMethod["type"]>("");
  const [refundFilter, setRefundFilter] = useState("");
  const [settlementsFilter, setSettlementsFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<PaymentMethodPayload>(newPaymentMethod);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [methodToDeactivate, setMethodToDeactivate] = useState<PaymentMethod | null>(null);
  const [auditMethod, setAuditMethod] = useState<PaymentMethod | null>(null);

  const methods = usePaymentMethods(search.trim() || undefined, active, true, {
    type: typeFilter || undefined,
    allowsRefund: refundFilter || undefined,
    acceptsMultipleSettlements: settlementsFilter || undefined
  });
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deactivateMethod = useDeactivatePaymentMethod();
  const reactivateMutation = useReactivatePaymentMethod();
  const audit = usePaymentMethodAudit(auditMethod?.id, canViewAudit);
  const editorBusy = createMethod.isPending || updateMethod.isPending;

  const resultLabel = useMemo(() => {
    const count = methods.data?.length ?? 0;
    return `${count} ${count === 1 ? "medio" : "medios"}`;
  }, [methods.data]);

  const openNewMethod = () => {
    setEditingMethod(null);
    setForm(newPaymentMethod());
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditMethod = (method: PaymentMethod) => {
    setEditingMethod(method);
    setForm(paymentMethodForm(method));
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (editorBusy) return;
    setEditorOpen(false);
    setEditingMethod(null);
    setFormError(null);
  };

  const submitMethod = async () => {
    const name = form.name.trim();
    if (!name) {
      setFormError("Escribe un nombre para el medio de pago.");
      return;
    }

    setFormError(null);
    try {
      const payload = { ...form, name };
      if (editingMethod) {
        await updateMethod.mutateAsync({
          id: editingMethod.id,
          payload: { ...payload, expectedVersion: editingMethod.version }
        });
      } else {
        await createMethod.mutateAsync(payload);
      }
      closeEditor();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const confirmDeactivation = async () => {
    if (!methodToDeactivate) return;
    setActionError(null);
    try {
      await deactivateMethod.mutateAsync({
        id: methodToDeactivate.id,
        expectedVersion: methodToDeactivate.version
      });
      setMethodToDeactivate(null);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const reactivateMethod = async (method: PaymentMethod) => {
    setActionError(null);
    try {
      await reactivateMutation.mutateAsync({ id: method.id, expectedVersion: method.version });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const optionTabs = [
    { key: "methods", label: "Medios de pago" },
    ...(canViewCashDiscounts ? [{ key: "cash-discounts", label: "Descuentos por caja" }] : []),
    ...(canConfigureDiscounts ? [{ key: "user-discounts", label: "Descuentos por usuario" }] : [])
  ];

  if (section === "cash-discounts" && canViewCashDiscounts) {
    return (
      <div className="space-y-[var(--space-6)]">
        <PageHeader
          title="Opciones de pago"
          description="Configura medios de cobro y promociones comerciales aplicables durante la recaudación."
        />
        <Tabs active={section} onChange={(value) => setSection(value as typeof section)} items={optionTabs} />
        <CashDiscountsPanel />
      </div>
    );
  }

  if (section === "user-discounts" && canConfigureDiscounts) {
    return (
      <div className="space-y-[var(--space-6)]">
        <PageHeader
          title="Opciones de pago"
          description="Configura medios de cobro y autorizaciones comerciales relacionadas con tratamientos."
        />
        <Tabs active={section} onChange={(value) => setSection(value as typeof section)} items={optionTabs} />
        <UserDiscountLimitsPanel />
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-6)]">
      <PageHeader
        title="Opciones de pago"
        description="Configura los medios habilitados para cobrar y su impacto en caja y reportes."
        helpText="La recaudación registra lo cobrado; el efectivo físico representa únicamente dinero disponible dentro de la caja."
      />

      <Tabs active={section} onChange={(value) => setSection(value as typeof section)} items={optionTabs} />

      <Card className="space-y-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-4)] xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-[var(--space-2)]">
              <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-primary)]">
                Configuración de medios de pago {active === "true" ? "habilitados" : "deshabilitados"}
              </h3>
              <Badge value={resultLabel} tone="brand" />
            </div>
            <p className="mt-[var(--space-1)] text-[var(--text-sm)] text-[var(--text-secondary)]">
              Estos medios se comparten entre todas las sucursales de la organización.
            </p>
          </div>

          <div className="flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-center">
            <Tabs
              active={active}
              onChange={(value) => setActive(value as "true" | "false")}
              items={[
                { key: "true", label: "Habilitados" },
                { key: "false", label: "Deshabilitados" }
              ]}
            />
            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar medio de pago"
                aria-label="Buscar medio de pago"
                className="pl-[var(--space-10)]"
              />
            </div>
            {canCreateMethod ? (
              <Button onClick={openNewMethod} className="whitespace-nowrap">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nuevo medio
              </Button>
            ) : null}
          </div>

          <div className="grid w-full gap-[var(--space-3)] border-t border-[var(--border-default)] pt-[var(--space-4)] sm:grid-cols-3">
            <label className="block">
              <span className="mb-[var(--space-1)] block text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">
                Tipo
              </span>
              <Select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "" | PaymentMethod["type"])}
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos los tipos</option>
                {Object.entries(methodTypes).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-[var(--space-1)] block text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">
                Devoluciones
              </span>
              <Select
                value={refundFilter}
                onChange={(event) => setRefundFilter(event.target.value)}
                aria-label="Filtrar por devoluciones"
              >
                <option value="">Cualquier política</option>
                <option value="true">Permite devolución</option>
                <option value="false">No permite devolución</option>
              </Select>
            </label>
            <label className="block">
              <span className="mb-[var(--space-1)] block text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">
                Recepciones programadas
              </span>
              <Select
                value={settlementsFilter}
                onChange={(event) => setSettlementsFilter(event.target.value)}
                aria-label="Filtrar por recepciones programadas"
              >
                <option value="">Cualquier configuración</option>
                <option value="true">Acepta múltiples recepciones</option>
                <option value="false">Recepción única</option>
              </Select>
            </label>
          </div>
        </div>
      </Card>

      {actionError ? <ErrorState message={actionError} /> : null}
      {methods.isLoading ? <LoadingState message="Cargando medios de pago..." /> : null}
      {methods.isError ? <ErrorState message={methods.error.message} /> : null}

      {!methods.isLoading && methods.data ? (
        methods.data.length ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1450px] border-collapse text-[var(--text-sm)]">
                <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">Medio de pago</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">Tipo</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Retención</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Devolución</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Recepciones</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Recaudación</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Efectivo físico</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Flujo de caja</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Cierre</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-center">Gráficos</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">Estado</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.data.map((method) => {
                    const meta = methodTypes[method.type];
                    const MethodIcon = meta.icon;
                    return (
                      <tr
                        key={method.id}
                        className="border-t border-[var(--border-default)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--bg-subtle)]"
                      >
                        <td className="px-[var(--space-4)] py-[var(--space-3)]">
                          <div className="flex items-center gap-[var(--space-3)]">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
                              <MethodIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span>
                              <span className="block font-semibold text-[var(--text-primary)]">
                                {method.name}
                              </span>
                              <span className="block text-[var(--text-xs)] text-[var(--text-secondary)]">
                                {method.publicCode} ·{" "}
                                {method.source === "SYSTEM" ? "Sistema" : "Personalizado"}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-secondary)]">
                          {meta.label}
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center font-medium">
                          {Number(method.retentionPercent).toFixed(2)}%
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState enabled={method.allowsRefund} label="Permite devolución" />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState
                            enabled={method.acceptsMultipleSettlements}
                            label="Múltiples recepciones"
                          />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState enabled={method.includeInCollectionReports} label="Recaudación" />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState enabled={method.includeInPhysicalCashBalance} label="Efectivo físico" />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState enabled={method.includeInCashFlowReports} label="Flujo de caja" />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState enabled={method.includeInClosingSummary} label="Resumen de cierre" />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)] text-center">
                          <RuleState enabled={method.includeInGraphicalReports} label="Reportes gráficos" />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)]">
                          <Badge
                            value={method.isActive ? "Habilitado" : "Deshabilitado"}
                            tone={method.isActive ? "success" : "warning"}
                          />
                        </td>
                        <td className="px-[var(--space-4)] py-[var(--space-3)]">
                          <div className="flex justify-end gap-[var(--space-2)]">
                            {canViewAudit ? (
                              <Button variant="ghost" size="sm" onClick={() => setAuditMethod(method)}>
                                <History className="h-4 w-4" aria-hidden="true" />
                                Historial
                              </Button>
                            ) : null}
                            {canUpdateMethod ? (
                              <Button variant="secondary" size="sm" onClick={() => openEditMethod(method)}>
                                <PencilLine className="h-4 w-4" aria-hidden="true" />
                                Editar
                              </Button>
                            ) : null}
                            {method.isActive && canDeactivateMethod ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--text-danger)] hover:text-[var(--text-danger)]"
                                onClick={() => {
                                  setActionError(null);
                                  setMethodToDeactivate(method);
                                }}
                              >
                                <Power className="h-4 w-4" aria-hidden="true" />
                                Deshabilitar
                              </Button>
                            ) : !method.isActive && canReactivateMethod ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={reactivateMutation.isPending}
                                onClick={() => reactivateMethod(method)}
                              >
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                Reactivar
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <EmptyState
            title={active === "true" ? "Sin medios habilitados" : "Sin medios deshabilitados"}
            description={
              search ? "No hay resultados para la búsqueda actual." : "No hay registros en este estado."
            }
          />
        )
      ) : null}

      <Modal
        open={editorOpen}
        title={editingMethod ? "Editar medio de pago" : "Nuevo medio de pago"}
        onClose={closeEditor}
        size="lg"
      >
        <div className="space-y-[var(--space-6)]">
          <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
            <label className="block">
              <span className="mb-[var(--space-1)] block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                Nombre
              </span>
              <Input
                autoFocus
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ej. Tarjeta de débito"
                maxLength={80}
              />
            </label>
            <label className="block">
              <span className="mb-[var(--space-1)] block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                Tipo
              </span>
              <Select
                value={form.type}
                disabled={editingMethod?.source === "SYSTEM"}
                onChange={(event) => {
                  const type = event.target.value as PaymentMethod["type"];
                  setForm((current) => ({
                    ...current,
                    type,
                    includeInPhysicalCashBalance: type === "CASH"
                  }));
                }}
              >
                {Object.entries(methodTypes).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <section className="space-y-[var(--space-3)]" aria-labelledby="commercial-rules-title">
            <div>
              <h4 id="commercial-rules-title" className="font-semibold text-[var(--text-primary)]">
                Reglas del medio
              </h4>
              <p className="mt-[var(--space-1)] text-[var(--text-sm)] text-[var(--text-secondary)]">
                Estas reglas se validan en servidor al cobrar, recibir vencimientos y devolver dinero.
              </p>
            </div>

            <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
              <label className="block">
                <span className="mb-[var(--space-1)] block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Retención
                </span>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.retentionPercent}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, retentionPercent: Number(event.target.value) }))
                    }
                    className="pr-10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                    %
                  </span>
                </div>
              </label>
              <label className="block">
                <span className="mb-[var(--space-1)] block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Código fiscal
                </span>
                <Input
                  value={form.fiscalCode ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, fiscalCode: event.target.value }))}
                  placeholder="Opcional"
                  maxLength={40}
                />
              </label>
            </div>

            <div className="grid gap-[var(--space-2)] sm:grid-cols-2">
              {[
                {
                  key: "allowsRefund" as const,
                  label: "Permite devolución",
                  description: "Puede elegirse como vía de salida al devolver un pago."
                },
                {
                  key: "requiresReference" as const,
                  label: "Exige referencia",
                  description: "Caja no podrá confirmar el cobro sin folio o referencia."
                },
                {
                  key: "requiresFinancialInstitution" as const,
                  label: "Exige institución financiera",
                  description: "Caja deberá seleccionar banco, aseguradora o institución."
                },
                {
                  key: "acceptsMultipleSettlements" as const,
                  label: "Acepta múltiples recepciones",
                  description: "Un solo medio genera varios vencimientos bancarios con fechas distintas."
                }
              ].map((rule) => (
                <label
                  key={rule.key}
                  className="flex cursor-pointer gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-3)]"
                >
                  <input
                    type="checkbox"
                    checked={form[rule.key]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [rule.key]: event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-brand)]"
                  />
                  <span>
                    <span className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                      {rule.label}
                    </span>
                    <span className="mt-1 block text-[var(--text-xs)] leading-4 text-[var(--text-secondary)]">
                      {rule.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {form.acceptsMultipleSettlements ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] p-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
                <strong>No significa combinar medios.</strong> Efectivo + tarjeta ya se registra como
                divisiones de un mismo pago. Esta opción sirve para tarjeta en cuotas, cheque u otro medio que
                la clínica recibe en varias fechas.
              </div>
            ) : null}
          </section>

          <section aria-labelledby="reporting-rules-title">
            <div className="mb-[var(--space-3)]">
              <h4 id="reporting-rules-title" className="font-semibold text-[var(--text-primary)]">
                Comportamiento en caja y reportes
              </h4>
              <p className="mt-[var(--space-1)] text-[var(--text-sm)] text-[var(--text-secondary)]">
                Activa únicamente los destinos donde este medio debe contabilizarse.
              </p>
            </div>
            <div className="grid gap-[var(--space-2)] sm:grid-cols-2">
              {reportingRules.map((rule) => (
                <label
                  key={rule.key}
                  className="flex cursor-pointer gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-3)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--border-brand-light)] hover:bg-[var(--bg-subtle)]"
                >
                  <input
                    type="checkbox"
                    checked={form[rule.key]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [rule.key]: event.target.checked }))
                    }
                    className="mt-[var(--space-1)] h-4 w-4 shrink-0 accent-[var(--action-brand)]"
                  />
                  <span>
                    <span className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                      {rule.label}
                    </span>
                    <span className="mt-[var(--space-1)] block text-[var(--text-xs)] leading-4 text-[var(--text-secondary)]">
                      {rule.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {formError ? <ErrorState message={formError} /> : null}

          <div className="flex justify-end gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-4)]">
            <Button variant="secondary" onClick={closeEditor} disabled={editorBusy}>
              Cancelar
            </Button>
            <Button onClick={submitMethod} disabled={editorBusy}>
              {editorBusy ? "Guardando..." : editingMethod ? "Guardar cambios" : "Crear medio"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(methodToDeactivate)}
        title="Deshabilitar medio"
        onClose={() => {
          if (!deactivateMethod.isPending) setMethodToDeactivate(null);
        }}
      >
        <p className="text-[var(--text-base)] text-[var(--text-primary)]">
          {methodToDeactivate
            ? `“${methodToDeactivate.name}” dejará de estar disponible para nuevos cobros. Su historial se conservará.`
            : null}
        </p>
        {actionError ? (
          <div className="mt-[var(--space-4)]">
            <ErrorState message={actionError} />
          </div>
        ) : null}
        <div className="mt-[var(--space-6)] flex justify-end gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-4)]">
          <Button
            variant="secondary"
            onClick={() => setMethodToDeactivate(null)}
            disabled={deactivateMethod.isPending}
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmDeactivation} disabled={deactivateMethod.isPending}>
            {deactivateMethod.isPending ? "Deshabilitando..." : "Deshabilitar"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(auditMethod)}
        title={`Historial · ${auditMethod?.name ?? ""}`}
        onClose={() => setAuditMethod(null)}
        size="lg"
      >
        {audit.isLoading ? <LoadingState message="Cargando historial..." /> : null}
        {audit.isError ? <ErrorState message={audit.error.message} /> : null}
        {audit.data?.length ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {audit.data.map((entry) => (
              <article
                key={entry.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border-default)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--text-primary)]">{entry.action}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {new Date(entry.createdAt).toLocaleString("es-MX")}
                  </span>
                </div>
                {entry.reason ? (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">Motivo: {entry.reason}</p>
                ) : null}
                <details className="mt-2 text-xs text-[var(--text-secondary)]">
                  <summary className="cursor-pointer font-semibold">Ver cambio técnico</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-[var(--bg-subtle)] p-2">
                    {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        ) : !audit.isLoading && !audit.isError ? (
          <EmptyState title="Sin cambios" description="Este medio todavía no tiene historial registrado." />
        ) : null}
      </Modal>
    </div>
  );
}
