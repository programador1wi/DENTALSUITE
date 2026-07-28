import { useMemo, useState } from "react";
import {
  CalendarRange,
  Copy,
  Eye,
  FileClock,
  PencilLine,
  Percent,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useCashDiscountAudit,
  useCashDiscountConfigurationOptions,
  useCashDiscountMutations,
  useCashDiscounts
} from "../hooks/use-cash-discounts";
import type {
  CashDiscountPayload,
  CashDiscountRule,
  CashDiscountStatus
} from "../services/cash-discounts.service";

type FormState = Omit<CashDiscountPayload, "discountPercent"> & { discountPercent: string };

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    campaign: "",
    discountPercent: "",
    appliesToClinicalActions: true,
    appliesToLaboratoryActions: false,
    availableToAllUsers: true,
    userIds: [],
    availableToAllBranches: true,
    branchIds: [],
    stackableWithAgreements: false,
    stackableWithOtherDiscounts: false,
    startsAt: "",
    endsAt: "",
    status: "ENABLED"
  };
}

function formFromRule(rule: CashDiscountRule): FormState {
  return {
    name: rule.name,
    description: rule.description ?? "",
    campaign: rule.campaign ?? "",
    discountPercent: String(rule.discountPercent),
    appliesToClinicalActions: rule.appliesToClinicalActions,
    appliesToLaboratoryActions: rule.appliesToLaboratoryActions,
    availableToAllUsers: rule.availableToAllUsers,
    userIds: rule.users.map((entry) => entry.userId),
    availableToAllBranches: rule.availableToAllBranches,
    branchIds: rule.branches.map((entry) => entry.branchId),
    stackableWithAgreements: rule.stackableWithAgreements,
    stackableWithOtherDiscounts: rule.stackableWithOtherDiscounts,
    startsAt: dateInput(rule.startsAt),
    endsAt: dateInput(rule.endsAt),
    status: rule.status === "DISABLED" ? "DRAFT" : rule.status,
    expectedVersion: rule.version
  };
}

export function CashDiscountsPanel() {
  const { hasPermission } = usePermissions();
  const [view, setView] = useState<"enabled" | "disabled">("enabled");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState("");
  const [validity, setValidity] = useState("ALL");
  const [editing, setEditing] = useState<CashDiscountRule | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<CashDiscountRule | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [auditTarget, setAuditTarget] = useState<CashDiscountRule | null>(null);
  const options = useCashDiscountConfigurationOptions();
  const rules = useCashDiscounts({
    search: search.trim() || undefined,
    status: view === "enabled" ? "ENABLED" : undefined,
    branchId: branchId || undefined,
    type: type || undefined,
    validity
  });
  const audit = useCashDiscountAudit(auditTarget?.id);
  const mutations = useCashDiscountMutations();
  const canCreate =
    hasPermission("payment_options.cash_discounts.create") || hasPermission("system.manage_all");
  const canUpdate =
    hasPermission("payment_options.cash_discounts.update") || hasPermission("system.manage_all");
  const canDisable =
    hasPermission("payment_options.cash_discounts.disable") || hasPermission("system.manage_all");
  const canReactivate =
    hasPermission("payment_options.cash_discounts.reactivate") || hasPermission("system.manage_all");
  const visibleRules = useMemo(
    () =>
      (rules.data ?? []).filter((rule) =>
        view === "enabled" ? rule.status === "ENABLED" : rule.status !== "ENABLED"
      ),
    [rules.data, view]
  );

  const openCreate = () => {
    setEditing(null);
    setEditorReadOnly(false);
    setForm(emptyForm());
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: CashDiscountRule, readOnly = false) => {
    setEditing(rule);
    setEditorReadOnly(readOnly);
    setForm(formFromRule(rule));
    setFormError(null);
    setEditorOpen(true);
  };

  const submit = async () => {
    if (editorReadOnly) return;
    const percent = Number(form.discountPercent);
    if (!form.name.trim()) return setFormError("Escribe un nombre para el descuento.");
    if (!(percent > 0 && percent <= 100))
      return setFormError("El porcentaje debe ser mayor a 0 y menor o igual a 100.");
    if (!form.appliesToClinicalActions && !form.appliesToLaboratoryActions)
      return setFormError("Selecciona al menos un tipo de prestación.");
    if (!form.availableToAllUsers && !form.userIds?.length)
      return setFormError("Selecciona al menos un usuario autorizado.");
    if (!form.availableToAllBranches && !form.branchIds?.length)
      return setFormError("Selecciona al menos una sucursal.");
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt))
      return setFormError("La fecha final debe ser posterior a la inicial.");
    const payload: CashDiscountPayload = {
      ...form,
      name: form.name.trim(),
      discountPercent: percent,
      description: form.description?.trim() || undefined,
      campaign: form.campaign?.trim() || undefined,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined
    };
    try {
      if (editing) await mutations.update.mutateAsync({ id: editing.id, payload });
      else await mutations.create.mutateAsync(payload);
      toast.success(editing ? "Descuento actualizado" : "Descuento creado");
      setEditorOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No fue posible guardar el descuento.");
    }
  };

  const toggleId = (field: "userIds" | "branchIds", id: string) => {
    setForm((current) => {
      const ids = current[field] ?? [];
      return { ...current, [field]: ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id] };
    });
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <Card className="space-y-[var(--space-4)] border-[var(--border-brand-light)] bg-[var(--bg-brand-light)]/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--action-primary)] text-white">
              <Percent className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">
                Promociones aplicables al liquidar prestaciones
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                No modifican apertura ni cierre de caja. Solo descuentan al confirmar un pago total
                autorizado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge value={`${visibleRules.length} resultados`} tone="brand" />
            {canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nuevo descuento
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            active={view}
            onChange={(value) => setView(value as typeof view)}
            items={[
              { key: "enabled", label: "Habilitados" },
              { key: "disabled", label: "Deshabilitados" }
            ]}
          />
          <div className="grid flex-1 gap-2.5 sm:grid-cols-2 xl:max-w-5xl xl:grid-cols-[1.4fr_1.3fr_1fr_1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nombre, código o campaña"
              />
            </div>
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Todas las sucursales</option>
              {options.data?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="CLINICAL">Clínicas</option>
              <option value="LABORATORY">Laboratorio</option>
              <option value="BOTH">Clínicas y laboratorio</option>
            </Select>
            <Select value={validity} onChange={(event) => setValidity(event.target.value)}>
              <option value="ALL">Toda vigencia</option>
              <option value="CURRENT">Vigentes</option>
              <option value="UPCOMING">Próximos</option>
              <option value="EXPIRED">Vencidos</option>
            </Select>
          </div>
        </div>
      </Card>

      {rules.isLoading || options.isLoading ? (
        <LoadingState message="Cargando descuentos por caja..." />
      ) : null}
      {rules.isError ? <ErrorState message={rules.error.message} /> : null}
      {!rules.isLoading && visibleRules.length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-collapse text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left text-xs font-medium uppercase text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Descuento</th>
                  <th className="px-4 py-3">Porcentaje</th>
                  <th className="px-4 py-3">Alcance</th>
                  <th className="px-4 py-3">Usuarios</th>
                  <th className="px-4 py-3">Sucursales</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último cambio</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-t border-[var(--border-default)] align-top hover:bg-[var(--bg-subtle)]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[var(--text-primary)]">{rule.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {rule.publicCode}
                        {rule.campaign ? ` · ${rule.campaign}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-lg font-semibold text-[var(--text-brand)]">
                        {Number(rule.discountPercent).toFixed(2)} %
                      </span>
                    </td>
                    <td className="px-4 py-4">{scopeLabel(rule)}</td>
                    <td className="px-4 py-4">
                      {rule.availableToAllUsers
                        ? "Todos los autorizados"
                        : `${rule.users.length} seleccionados`}
                    </td>
                    <td className="px-4 py-4">
                      {rule.availableToAllBranches
                        ? "Todas"
                        : rule.branches.map((entry) => entry.branch.name).join(", ")}
                    </td>
                    <td className="px-4 py-4">{validityLabel(rule)}</td>
                    <td className="px-4 py-4">
                      <Badge
                        value={statusLabel(rule.status)}
                        tone={
                          rule.status === "ENABLED"
                            ? "success"
                            : rule.status === "DRAFT"
                              ? "warning"
                              : "default"
                        }
                      />
                    </td>
                    <td className="px-4 py-4">{new Date(rule.updatedAt).toLocaleString("es-MX")}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Ver" onClick={() => openEdit(rule, true)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canUpdate && rule.status !== "DISABLED" ? (
                          <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(rule)}>
                            <PencilLine className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canCreate ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Duplicar"
                            onClick={() =>
                              void mutations.duplicate
                                .mutateAsync(rule.id)
                                .then(() => toast.success("Copia creada como borrador"))
                                .catch((error) => toast.error(actionError(error)))
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Auditoría"
                          onClick={() => setAuditTarget(rule)}
                        >
                          <FileClock className="h-4 w-4" />
                        </Button>
                        {rule.status === "ENABLED" && canDisable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Deshabilitar"
                            className="text-[var(--text-danger)]"
                            onClick={() => setDisableTarget(rule)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        ) : rule.status === "DISABLED" && canReactivate ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Reactivar"
                            onClick={() =>
                              void mutations.reactivate
                                .mutateAsync({ id: rule.id, expectedVersion: rule.version })
                                .then(() => toast.success("Descuento reactivado"))
                                .catch((error) => toast.error(actionError(error)))
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : !rules.isLoading ? (
        <EmptyState
          title={view === "enabled" ? "Sin descuentos habilitados" : "Sin descuentos deshabilitados"}
          description="Cambia los filtros o crea una nueva promoción comercial."
        />
      ) : null}

      <Modal
        open={editorOpen}
        title={editorReadOnly ? "Detalle del descuento por caja" : editing ? "Editar descuento por caja" : "Nuevo descuento por caja"}
        onClose={() => setEditorOpen(false)}
        size="xl"
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={120}
              />
            </Field>
            <Field label="Campaña o motivo">
              <Input
                value={form.campaign}
                onChange={(event) => setForm({ ...form, campaign: event.target.value })}
              />
            </Field>
            <Field label="Porcentaje">
              <div className="relative">
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={form.discountPercent}
                  onChange={(event) => setForm({ ...form, discountPercent: event.target.value })}
                />
                <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              </div>
            </Field>
            <Field label="Estado inicial">
              <Select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as CashDiscountStatus })}
              >
                <option value="ENABLED">Habilitado</option>
                <option value="DRAFT">Borrador</option>
              </Select>
            </Field>
          </div>
          <Field label="Descripción">
            <textarea
              className="min-h-20 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard icon={<ShieldCheck className="h-4 w-4" />} title="Prestaciones aplicables">
              <Check
                label="Acciones clínicas"
                checked={form.appliesToClinicalActions}
                onChange={(checked) => setForm({ ...form, appliesToClinicalActions: checked })}
              />
              <Check
                label="Acciones de laboratorio"
                checked={form.appliesToLaboratoryActions}
                onChange={(checked) => setForm({ ...form, appliesToLaboratoryActions: checked })}
              />
            </ChoiceCard>
            <ChoiceCard icon={<CalendarRange className="h-4 w-4" />} title="Vigencia">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Inicia">
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                  />
                </Field>
                <Field label="Termina">
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                  />
                </Field>
              </div>
            </ChoiceCard>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard title="Usuarios autorizados">
              <Check
                label="Todos los usuarios con permiso y límite vigente"
                checked={form.availableToAllUsers}
                onChange={(checked) =>
                  setForm({ ...form, availableToAllUsers: checked, userIds: checked ? [] : form.userIds })
                }
              />
              {!form.availableToAllUsers ? (
                <SelectionList
                  rows={(options.data?.users ?? []).map((user) => ({
                    id: user.id,
                    label: user.name,
                    meta: `${user.email} · Máx. ${Number(user.maximumDiscountPercent).toFixed(2)} %`
                  }))}
                  selected={form.userIds ?? []}
                  onToggle={(id) => toggleId("userIds", id)}
                />
              ) : null}
            </ChoiceCard>
            <ChoiceCard title="Sucursales">
              <Check
                label="Todas las sucursales"
                checked={form.availableToAllBranches}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    availableToAllBranches: checked,
                    branchIds: checked ? [] : form.branchIds
                  })
                }
              />
              {!form.availableToAllBranches ? (
                <SelectionList
                  rows={(options.data?.branches ?? []).map((branch) => ({
                    id: branch.id,
                    label: branch.name
                  }))}
                  selected={form.branchIds ?? []}
                  onToggle={(id) => toggleId("branchIds", id)}
                />
              ) : null}
            </ChoiceCard>
          </div>
          <ChoiceCard title="Compatibilidad">
            <Check
              label="Compatible con convenios"
              checked={form.stackableWithAgreements}
              onChange={(checked) => setForm({ ...form, stackableWithAgreements: checked })}
            />
            <Check
              label="Compatible con otros descuentos comerciales"
              checked={form.stackableWithOtherDiscounts}
              onChange={(checked) => setForm({ ...form, stackableWithOtherDiscounts: checked })}
            />
            <p className="text-xs text-[var(--text-secondary)]">
              Desactivadas por defecto. La combinación nunca puede superar los límites del usuario o
              procedimiento.
            </p>
          </ChoiceCard>
          {formError ? <ErrorState message={formError} /> : null}
          <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            {!editorReadOnly ? (
              <Button
                onClick={() => void submit()}
                disabled={mutations.create.isPending || mutations.update.isPending}
              >
                {editing ? "Guardar cambios" : "Crear descuento"}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(disableTarget)}
        title="Deshabilitar descuento"
        onClose={() => setDisableTarget(null)}
      >
        <p className="text-sm text-[var(--text-primary)]">
          El descuento dejará de aparecer en nuevas recaudaciones. Los pagos históricos conservarán su
          información.
        </p>
        <Field label="Motivo">
          <Input
            value={disableReason}
            onChange={(event) => setDisableReason(event.target.value)}
            placeholder="Opcional"
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDisableTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              disableTarget &&
              void mutations.disable
                .mutateAsync({
                  id: disableTarget.id,
                  expectedVersion: disableTarget.version,
                  reason: disableReason
                })
                .then(() => {
                  toast.success("Descuento deshabilitado");
                  setDisableTarget(null);
                  setDisableReason("");
                })
                .catch((error) => toast.error(actionError(error)))
            }
          >
            Deshabilitar
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(auditTarget)}
        title={`Auditoría · ${auditTarget?.name ?? ""}`}
        onClose={() => setAuditTarget(null)}
        size="lg"
      >
        {audit.isLoading ? (
          <LoadingState message="Cargando auditoría..." />
        ) : audit.data?.length ? (
          <div className="max-h-[480px] space-y-3 overflow-y-auto">
            {audit.data.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[var(--radius-md)] border border-[var(--border-muted)] p-3"
              >
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-[var(--text-primary)]">{auditLabel(entry.action)}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {new Date(entry.createdAt).toLocaleString("es-MX")}
                  </span>
                </div>
                {entry.reason ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.reason}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin eventos" description="Todavía no hay eventos auditables para esta regla." />
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
function ChoiceCard({
  icon,
  title,
  children
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
      <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
function Check({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--action-brand)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function SelectionList({
  rows,
  selected,
  onToggle
}: {
  rows: Array<{ id: string; label: string; meta?: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-h-44 space-y-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-muted)] bg-[var(--bg-surface)] p-2">
      {rows.map((row) => (
        <label
          key={row.id}
          className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-[var(--bg-subtle)]"
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={selected.includes(row.id)}
            onChange={() => onToggle(row.id)}
          />
          <span className="text-sm">
            <span className="block font-medium">{row.label}</span>
            {row.meta ? <span className="block text-xs text-[var(--text-secondary)]">{row.meta}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
function scopeLabel(rule: CashDiscountRule) {
  return rule.appliesToClinicalActions && rule.appliesToLaboratoryActions
    ? "Clínicas y laboratorio"
    : rule.appliesToLaboratoryActions
      ? "Laboratorio"
      : "Clínicas";
}
function validityLabel(rule: CashDiscountRule) {
  if (!rule.startsAt && !rule.endsAt) return "Sin término";
  return `${rule.startsAt ? new Date(rule.startsAt).toLocaleDateString("es-MX") : "Ahora"} – ${rule.endsAt ? new Date(rule.endsAt).toLocaleDateString("es-MX") : "Sin término"}`;
}
function statusLabel(status: CashDiscountStatus) {
  return status === "ENABLED" ? "Habilitado" : status === "DRAFT" ? "Borrador" : "Deshabilitado";
}
function dateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function auditLabel(action: string) {
  return (
    (
      {
        "cash_discount.created": "Creación",
        "cash_discount.updated": "Edición",
        "cash_discount.disabled": "Deshabilitación",
        "cash_discount.reactivated": "Reactivación",
        "cash_discount.previewed": "Previsualización",
        "cash_discount.preview_rejected": "Previsualización rechazada",
        "cash_discount.applied": "Aplicación",
        "cash_discount.voided": "Anulación",
        "cash_discount.refund_recorded": "Devolución"
      } as Record<string, string>
    )[action] ?? action
  );
}

function actionError(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible completar la acción.";
}
