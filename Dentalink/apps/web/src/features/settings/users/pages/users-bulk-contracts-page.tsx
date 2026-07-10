import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ListChecks,
  Pencil,
  Tags,
  X
} from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import { usePriceLists } from "@/features/settings/price-lists/hooks/use-price-lists";
import type { PriceList, PriceListItem } from "@/features/settings/price-lists/services/price-lists.service";
import {
  useBulkProfessionalContractPreview,
  useBulkUpdateProfessionalContracts,
  useProfessionals
} from "@/features/settings/professionals/hooks/use-professionals";
import type {
  BulkProfessionalContractPayload,
  BulkProfessionalContractPreview,
  BulkProfessionalContractResult,
  Professional
} from "@/features/settings/professionals/services/professionals.service";
import { buildTreatmentBudgetCatalog } from "@/features/patients/utils/treatment-budget-catalog";
import { cn } from "@/lib/utils/cn";
import { useBranchStore } from "@/stores/branch.store";
import { UsersModuleNav } from "../components/users-module-nav";

type SelectionMap = Record<string, string[]>;
type FixedAmountMap = Record<string, string>;

type BulkContractForm = {
  commissionRate: string;
  commissionBase: BulkProfessionalContractPayload["commissionBase"];
  paymentDiscount: BulkProfessionalContractPayload["paymentDiscount"];
  paymentCondition: BulkProfessionalContractPayload["paymentCondition"];
  contractType: BulkProfessionalContractPayload["contractType"];
  priceListId: string;
  categoryRates: Record<string, string>;
  fixedAmounts: FixedAmountMap;
};

const STEPS = [
  { key: 1 as const, label: "Seleccion" },
  { key: 2 as const, label: "Contrato" },
  { key: 3 as const, label: "Montos fijos" },
  { key: 4 as const, label: "Porcentajes" },
  { key: 5 as const, label: "Resumen" }
];

type StepKey = (typeof STEPS)[number]["key"];

const ZONE_LABELS: Record<string, string> = {
  NORTE: "Norte",
  SUR: "Sur",
  DJWARNER: "DJWarner"
};

const OPERATIONAL_ZONES = ["NORTE", "SUR", "DJWARNER"] as const;

const EMPTY_FORM: BulkContractForm = {
  commissionRate: "",
  commissionBase: "clinical",
  paymentDiscount: "no",
  paymentCondition: "no_due_date",
  contractType: "performed_and_paid",
  priceListId: "",
  categoryRates: {},
  fixedAmounts: {}
};

const COMMISSION_BASE_LABELS: Record<BulkContractForm["commissionBase"], string> = {
  clinical: "Acciones clinicas",
  lab: "Laboratorio",
  all: "Todas las prestaciones"
};

const PAYMENT_DISCOUNT_LABELS: Record<BulkContractForm["paymentDiscount"], string> = {
  no: "No",
  yes: "Si",
  fixed: "Valor fijo"
};

const PAYMENT_CONDITION_LABELS: Record<BulkContractForm["paymentCondition"], string> = {
  no_due_date: "Sin importar fecha de vencimiento",
  on_due: "Al vencer plazo",
  thirty_days: "A los 30 dias"
};

const CONTRACT_TYPE_LABELS: Record<BulkContractForm["contractType"], string> = {
  performed_and_paid: "Prestacion realizada y pagada",
  performed: "Prestacion realizada"
};

function zoneCodeForBranch(branch: { name: string; zone?: { code: string } | null }) {
  const code = branch.zone?.code?.toUpperCase();
  if (code) return code;
  return branch.name.toLowerCase().includes("j.warner") || branch.name.toLowerCase().includes("jwarner")
    ? "DJWARNER"
    : "SIN_ZONA";
}

function branchIsOperable(branch: Pick<Branch, "status" | "isActive" | "dentalinkPlatformCode" | "dentalinkSucursalId" | "name">) {
  if (branch.dentalinkPlatformCode === "DJWARNER" && branch.dentalinkSucursalId === 22 && branch.name.trim() === ".") {
    return false;
  }
  return branch.status === "ACTIVE" && branch.isActive !== false;
}

function money(value: string | number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function professionalGroup(professional: Professional) {
  return professional.specialties.some((specialty) => specialty.name.toLowerCase().includes("ortodon"))
    ? "Ortodoncia"
    : "General";
}

function categoryRateRows(priceList: PriceList | null) {
  if (!priceList) return [];
  return priceList.categories
    .filter((category) => category.isActive && category.procedureCategoryId)
    .map((category) => ({
      id: category.procedureCategoryId ?? "",
      priceListCategoryId: category.id,
      name: category.name,
      itemCount: category.items.length
    }));
}

function activeRateCount(categoryRates: Record<string, string>) {
  return Object.values(categoryRates).filter((value) => {
    const parsed = numberOrNull(value);
    return parsed !== null && parsed > 0;
  }).length;
}

function Stepper({ current }: { current: StepKey }) {
  return (
    <ol className="grid gap-[var(--space-2)] border-b border-[var(--border-default)] pb-[var(--space-4)] md:grid-cols-5">
      {STEPS.map((step) => {
        const active = current === step.key;
        const done = current > step.key;
        return (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)]",
              active && "border-[var(--border-brand)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]",
              done && "border-[var(--border-brand-light)] bg-[var(--bg-surface)] text-[var(--text-brand)]",
              !active && !done && "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-full)] border text-[var(--text-xs)] font-semibold",
                active && "border-[var(--border-brand)] bg-[var(--action-brand)] text-[var(--text-inverse)]",
                done && "border-[var(--border-brand)] text-[var(--text-brand)]",
                !active && !done && "border-[var(--border-default)] text-[var(--text-secondary)]"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : step.key}
            </span>
            <span className="truncate font-medium">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StepFooter({
  step,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onSave,
  saving
}: {
  step: StepKey;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-t border-[var(--border-default)] pt-[var(--space-4)]">
      <Button variant="secondary" disabled={!canGoBack} onClick={onBack}>
        <ChevronLeft className="h-4 w-4" />
        Volver
      </Button>
      {step < 5 ? (
        <Button disabled={!canGoForward} onClick={onForward}>
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button disabled={!canGoForward || saving} onClick={onSave}>
          <Check className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar contratos"}
        </Button>
      )}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-[var(--space-1)]">
      <h2 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">{title}</h2>
      {description ? <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">{description}</p> : null}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-2)]">
      <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{label}</p>
      <p className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">{value}</p>
    </div>
  );
}

export function UsersBulkContractsPage() {
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const [step, setStep] = useState<StepKey>(1);
  const [selectedZone, setSelectedZone] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<SelectionMap>({});
  const [form, setForm] = useState<BulkContractForm>(EMPTY_FORM);
  const [removeOtherBranches, setRemoveOtherBranches] = useState(false);
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [applyError, setApplyError] = useState("");
  const [lastResult, setLastResult] = useState<BulkProfessionalContractResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const branches = useBranches();
  const professionals = useProfessionals(search || undefined, "true", { pageSize: 500 });
  const priceLists = usePriceLists(undefined, "true");
  const bulkContracts = useBulkUpdateProfessionalContracts();
  const previewContracts = useBulkProfessionalContractPreview();

  const activeBranch = branches.data?.find((branch) => branch.id === activeBranchId);
  const zoneOptions = useMemo(() => {
    const byCode = new Map<string, { code: string; label: string; count: number; active: number; inactive: number }>();
    for (const code of OPERATIONAL_ZONES) {
      byCode.set(code, { code, label: ZONE_LABELS[code], count: 0, active: 0, inactive: 0 });
    }
    for (const branch of branches.data ?? []) {
      const code = zoneCodeForBranch(branch);
      const current = byCode.get(code) ?? { code, label: ZONE_LABELS[code] ?? code, count: 0, active: 0, inactive: 0 };
      const active = branchIsOperable(branch);
      byCode.set(code, {
        ...current,
        count: current.count + 1,
        active: current.active + (active ? 1 : 0),
        inactive: current.inactive + (active ? 0 : 1)
      });
    }
    return [...byCode.values()].filter((zone) => zone.count > 0 || zone.code !== "SIN_ZONA");
  }, [branches.data]);

  useEffect(() => {
    if (selectedZone || !zoneOptions.length) return;
    const activeZone = activeBranch ? zoneCodeForBranch(activeBranch) : "";
    setSelectedZone(zoneOptions.some((zone) => zone.code === activeZone) ? activeZone : zoneOptions[0].code);
  }, [activeBranch, selectedZone, zoneOptions]);

  const zoneSections = useMemo(
    () =>
      OPERATIONAL_ZONES.map((code) => {
        const sectionBranches = (branches.data ?? []).filter((branch) => zoneCodeForBranch(branch) === code);
        return {
          code,
          label: ZONE_LABELS[code],
          branches: sectionBranches,
          active: sectionBranches.filter(branchIsOperable).length,
          inactive: sectionBranches.filter((branch) => !branchIsOperable(branch)).length
        };
      }),
    [branches.data]
  );
  const visibleBranches = useMemo(
    () => (branches.data ?? []).filter((branch) => zoneCodeForBranch(branch) === selectedZone && branchIsOperable(branch)),
    [branches.data, selectedZone]
  );
  const selectedPriceList = useMemo(
    () => priceLists.data?.find((priceList) => priceList.id === form.priceListId) ?? null,
    [form.priceListId, priceLists.data]
  );
  const zonePriceLists = useMemo(
    () =>
      (priceLists.data ?? []).filter((priceList) => {
        if (!selectedZone) return false;
        if (!priceList.branchAssignments.length) return priceList.isDefault;
        return priceList.branchAssignments.some((assignment) => assignment.branch?.zone?.code?.toUpperCase() === selectedZone);
      }),
    [priceLists.data, selectedZone]
  );
  const catalog = useMemo(() => buildTreatmentBudgetCatalog(selectedPriceList), [selectedPriceList]);
  const catalogItems = useMemo(() => catalog.flatMap((category) => category.items), [catalog]);
  const priceItemByProcedureId = useMemo(
    () => new Map(catalogItems.map((item) => [item.procedureId, item])),
    [catalogItems]
  );
  const rateRows = useMemo(() => categoryRateRows(selectedPriceList), [selectedPriceList]);

  const allProfessionalRows = useMemo(() => professionals.data ?? [], [professionals.data]);

  const selectedTargets = useMemo(
    () =>
      allProfessionalRows.flatMap((professional) =>
        (selection[professional.id] ?? []).map((branchId) => ({ branchId, professional }))
      ),
    [allProfessionalRows, selection]
  );
  const selectedProfessionals = useMemo(() => {
    const byId = new Map<string, Professional>();
    selectedTargets.forEach(({ professional }) => byId.set(professional.id, professional));
    return [...byId.values()];
  }, [selectedTargets]);

  useEffect(() => {
    setForm((current) => ({ ...current, priceListId: "", categoryRates: {}, fixedAmounts: {} }));
    setLastResult(null);
  }, [selectedZone]);

  useEffect(() => {
    setForm((current) => ({ ...current, categoryRates: {}, fixedAmounts: {} }));
    setLastResult(null);
  }, [form.priceListId]);

  const normalizedRate = Number(form.commissionRate);
  const rateValid =
    form.commissionRate !== "" &&
    Number.isFinite(normalizedRate) &&
    normalizedRate >= 0 &&
    normalizedRate <= 100;
  const fixedAmountEntries = Object.entries(form.fixedAmounts)
    .map(([procedureId, value]) => {
      const amount = numberOrNull(value);
      const item = priceItemByProcedureId.get(procedureId);
      return amount !== null && amount >= 0 && item
        ? { procedureId, amount, item }
        : null;
    })
    .filter(Boolean) as { procedureId: string; amount: number; item: PriceListItem }[];
  const selectedFixedAmountCount = fixedAmountEntries.length;
  const selectedCategoryRateCount = activeRateCount(form.categoryRates);
  const canSave = rateValid && selectedTargets.length > 0 && Boolean(selectedZone);

  const buildPayload = (): BulkProfessionalContractPayload => ({
    targets: selectedTargets.map(({ professional, branchId }) => ({
      professionalId: professional.id,
      branchIds: [branchId]
    })),
    commissionRate: normalizedRate,
    commissionBase: form.commissionBase,
    paymentDiscount: form.paymentDiscount,
    paymentCondition: form.paymentCondition,
    contractType: form.contractType,
    priceListId: form.priceListId || undefined,
    fixedAmounts: fixedAmountEntries.map(({ procedureId, amount, item }) => ({
      procedureId,
      priceListId: form.priceListId,
      amount,
      currency: item.currency
    })),
    categoryRates: Object.entries(form.categoryRates)
      .map(([procedureCategoryId, value]) => ({ procedureCategoryId, rate: Number(value) }))
      .filter((rate) => Number.isFinite(rate.rate) && rate.rate > 0),
    removeOtherBranches,
    keepPrevious
  });

  useEffect(() => {
    if (step !== 5 || !canSave) return;
    void previewContracts.mutateAsync(buildPayload()).catch(() => undefined);
  }, [step, selectedTargets.length, form, removeOtherBranches, keepPrevious, canSave]);

  const toggleTarget = (professional: Professional, branch: Branch) => {
    if (!branchIsOperable(branch)) return;
    if (!professional.branches.some((item) => item.id === branch.id)) return;
    const branchZone = zoneCodeForBranch(branch);
    setSelection((current) => {
      const base = selectedZone && selectedZone !== branchZone ? {} : current;
      const previous = base[professional.id] ?? [];
      const next = previous.includes(branch.id)
        ? previous.filter((id) => id !== branch.id)
        : [...previous, branch.id];
      const updated = { ...base };
      if (next.length) updated[professional.id] = next;
      else delete updated[professional.id];
      return updated;
    });
    if (selectedZone !== branchZone) {
      setSelectedZone(branchZone);
      setForm((current) => ({ ...current, priceListId: "", categoryRates: {}, fixedAmounts: {} }));
    }
  };

  const toggleProfessional = (professional: Professional, sectionBranches = visibleBranches) => {
    const branchIds = professional.branches
      .map((branch) => branch.id)
      .filter((id) => sectionBranches.some((branch) => branch.id === id && branchIsOperable(branch)));
    const sectionZone = sectionBranches[0] ? zoneCodeForBranch(sectionBranches[0]) : selectedZone;
    const allSelected = branchIds.every((branchId) => selection[professional.id]?.includes(branchId));
    setSelection((current) => {
      const base = selectedZone && selectedZone !== sectionZone ? {} : current;
      const updated = { ...base };
      if (allSelected) delete updated[professional.id];
      else updated[professional.id] = branchIds;
      return updated;
    });
    if (sectionZone && selectedZone !== sectionZone) {
      setSelectedZone(sectionZone);
      setForm((current) => ({ ...current, priceListId: "", categoryRates: {}, fixedAmounts: {} }));
    }
  };

  const toggleFixedAmount = (item: PriceListItem) => {
    setForm((current) => {
      const next = { ...current.fixedAmounts };
      if (next[item.procedureId] !== undefined) delete next[item.procedureId];
      else next[item.procedureId] = String(item.price);
      return { ...current, fixedAmounts: next };
    });
  };

  const applyContracts = async () => {
    if (!canSave) return;
    setApplyError("");
    setLastResult(null);
    try {
      const result = await bulkContracts.mutateAsync(buildPayload());
      setLastResult(result);
      setConfirmOpen(false);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "No se pudieron actualizar los contratos.");
    }
  };

  const preview = previewContracts.data as BulkProfessionalContractPreview | undefined;
  const rowsForBranches = (sectionBranches: Branch[]) => {
    const sectionBranchIds = new Set(sectionBranches.map((branch) => branch.id));
    return allProfessionalRows.filter((professional) =>
      professional.branches.some((branch) => sectionBranchIds.has(branch.id))
    );
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <UsersModuleNav>
        <div className="space-y-[var(--space-5)]">
          <PageHeader
            title="Edicion masiva de contratos"
            description="Aplica reglas economicas por zona, profesional, sucursal y arancel."
          />

          <Card className="space-y-[var(--space-4)]">
            <div className="grid gap-[var(--space-3)] lg:grid-cols-[1fr_220px]">
              <div className="grid gap-[var(--space-2)] md:grid-cols-3">
                {zoneOptions.map((zone) => (
                  <button
                    key={zone.code}
                    type="button"
                    onClick={() => {
                      setSelectedZone(zone.code);
                      setSelection({});
                    }}
                    className={cn(
                      "rounded-[var(--radius-md)] border px-[var(--space-4)] py-[var(--space-3)] text-left transition-[background-color,border-color,color] duration-[var(--duration-fast)]",
                      selectedZone === zone.code
                        ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
                        : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-brand-light)]"
                    )}
                  >
                    <span className="block text-[var(--text-sm)] font-semibold">{zone.label}</span>
                    <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                      {zone.active} activas / {zone.inactive} inactivas
                    </span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-[var(--space-2)]">
                <SummaryMetric label="Profesionales" value={selectedProfessionals.length} />
                <SummaryMetric label="Cruces" value={selectedTargets.length} />
              </div>
            </div>
            <Stepper current={step} />
          </Card>

          {(branches.isLoading || professionals.isLoading) && step === 1 ? (
            <LoadingState message="Cargando profesionales y sucursales..." />
          ) : null}
          {branches.isError ? <ErrorState message={branches.error.message} /> : null}
          {professionals.isError ? <ErrorState message={professionals.error.message} /> : null}

          {step === 1 ? (
            <section className="space-y-[var(--space-4)]">
              <SectionHeading
                title="Seleccionar profesionales y sucursales"
                description="Cada celda seleccionada representa un contrato profesional-sucursal."
              />
              <div className="flex flex-wrap items-end justify-between gap-[var(--space-3)]">
                <label className="grid min-w-[280px] gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Buscar profesional
                  <EntitySearchBox
                    placeholder="Nombre, correo o cedula"
                    value={search}
                    onValueChange={setSearch}
                    items={search.trim() ? allProfessionalRows : []}
                    onSelect={(professional) => {
                      setSearch(`${professional.firstName} ${professional.lastName}`.trim());
                      toggleProfessional(professional);
                    }}
                    getItemKey={(professional) => professional.id}
                    emptyMessage="Sin profesionales encontrados"
                    renderItem={(professional) => (
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
                          {professional.firstName} {professional.lastName}
                        </p>
                        <p className="truncate text-[var(--text-xs)] text-[var(--text-secondary)]">
                          {[professional.email, professional.licenseNumber].filter(Boolean).join(" - ") || "Sin contacto"}
                        </p>
                      </div>
                    )}
                  />
                </label>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  <Badge value={`${visibleBranches.length} sucursales`} tone="brand" />
                  <Badge value={`${rowsForBranches(visibleBranches).length} profesionales visibles`} tone="default" />
                </div>
              </div>

              <div className="space-y-[var(--space-4)]">
                {zoneSections.map((section) => {
                  const sectionRows = rowsForBranches(section.branches);
                  const groupedRows = {
                    General: sectionRows.filter((professional) => professionalGroup(professional) === "General"),
                    Ortodoncia: sectionRows.filter((professional) => professionalGroup(professional) === "Ortodoncia")
                  };
                  return (
                    <Card key={section.code} className="overflow-hidden p-0 border border-[var(--border-default)] shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
                        <div>
                          <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">{section.label}</h3>
                          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                            Plataforma {section.code}: {section.active} activas, {section.inactive} inactivas
                          </p>
                        </div>
                        <div className="flex gap-[var(--space-2)]">
                          <Badge value={`${section.branches.length} sucursales`} tone="default" />
                          <Badge value={`${sectionRows.length} profesionales`} tone={selectedZone === section.code ? "brand" : "default"} />
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px] border-collapse text-[var(--text-sm)]">
                          <thead className="bg-[var(--bg-surface)] text-left text-[var(--text-xs)] font-semibold uppercase text-[var(--text-brand)]">
                            <tr>
                              <th className="sticky left-0 z-10 w-[280px] bg-[var(--bg-surface)] px-[var(--space-4)] py-[var(--space-3)] border-r border-[var(--border-default)]">
                                Profesional
                              </th>
                              {section.branches.map((branch) => {
                                const active = branchIsOperable(branch);
                                return (
                                  <th key={branch.id} className="w-24 min-w-[96px] px-[var(--space-2)] py-[var(--space-3)] text-center border-b border-[var(--border-default)]">
                                    <span className={cn("inline-block max-w-24 whitespace-normal leading-tight font-bold text-[11px]", active ? "text-[var(--text-secondary)]" : "text-[var(--text-danger)]")}>
                                      {branch.name}
                                    </span>
                                    <span className="mt-1 block text-[10px] font-medium normal-case text-[var(--text-secondary)]">
                                      {active ? "Activa" : "Inactiva"}
                                    </span>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {(["General", "Ortodoncia"] as const).map((group) => (
                              <Fragment key={group}>
                                <tr>
                                  <td
                                    colSpan={section.branches.length + 1}
                                    className="border-t border-b border-[var(--border-default)] bg-[var(--bg-brand-light)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-xs)] font-semibold uppercase text-[var(--text-brand-strong)]"
                                  >
                                    {group}
                                  </td>
                                </tr>
                                {groupedRows[group].map((professional) => (
                                  <tr key={professional.id} className="group border-t border-[var(--border-default)] transition-colors duration-150 hover:bg-[var(--bg-subtle)]">
                                    <th className="sticky left-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-2)] text-left border-r border-[var(--border-default)] transition-colors duration-150">
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-[var(--space-2)] text-left text-[var(--text-primary)] hover:text-[var(--text-brand)]"
                                        onClick={() => toggleProfessional(professional, section.branches)}
                                      >
                                        <span className="min-w-0 truncate font-semibold">
                                          {professional.firstName} {professional.lastName}
                                        </span>
                                        <span className="rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                                          Fila
                                        </span>
                                      </button>
                                    </th>
                                    {section.branches.map((branch) => {
                                      const active = branchIsOperable(branch);
                                      const available = active && professional.branches.some((item) => item.id === branch.id);
                                      const selected = selection[professional.id]?.includes(branch.id) ?? false;
                                      return (
                                        <td
                                          key={`${professional.id}-${branch.id}`}
                                          className={cn(
                                            "h-12 px-[var(--space-2)] text-center border-b border-[var(--border-default)] transition-colors duration-150",
                                            selected && "bg-[var(--bg-brand-light)]"
                                          )}
                                        >
                                          {available ? (
                                            <button
                                              type="button"
                                              aria-label={`${selected ? "Quitar" : "Seleccionar"} ${professional.firstName} en ${branch.name}`}
                                              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-full)] text-[var(--text-brand)] hover:bg-[var(--bg-brand-light)] transition-all duration-150 active:scale-95"
                                              onClick={() => toggleTarget(professional, branch)}
                                            >
                                              {selected ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-4 w-4 text-[var(--text-secondary)]" />}
                                            </button>
                                          ) : (
                                            <X className={cn("mx-auto h-4 w-4", active ? "text-[var(--text-secondary)] opacity-30" : "text-[var(--text-danger)] opacity-60")} />
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <StepFooter
                step={1}
                canGoBack={false}
                canGoForward={selectedTargets.length > 0}
                onBack={() => undefined}
                onForward={() => setStep(2)}
              />
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-[var(--space-4)]">
              <SectionHeading title="Configurar contrato base" description="Esta regla se aplicara cuando no exista monto fijo ni porcentaje avanzado." />
              <Card className="grid gap-[var(--space-4)] md:grid-cols-2">
                <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Porcentaje acciones
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.commissionRate}
                      onChange={(event) => setForm((current) => ({ ...current, commissionRate: event.target.value }))}
                    />
                    <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">%</span>
                  </div>
                  {form.commissionRate !== "" && !rateValid ? (
                    <span className="text-[var(--text-xs)] text-[var(--text-danger)]">Debe estar entre 0 y 100.</span>
                  ) : null}
                </label>
                <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Porcentaje sobre
                  <Select
                    value={form.commissionBase}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, commissionBase: event.target.value as BulkContractForm["commissionBase"] }))
                    }
                  >
                    <option value="clinical">Acciones clinicas</option>
                    <option value="lab">Laboratorio</option>
                    <option value="all">Todas las prestaciones</option>
                  </Select>
                </label>
                <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Descto. medio de pago
                  <Select
                    value={form.paymentDiscount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, paymentDiscount: event.target.value as BulkContractForm["paymentDiscount"] }))
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Si</option>
                    <option value="fixed">Valor fijo</option>
                  </Select>
                </label>
                <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Condiciones de pago
                  <Select
                    value={form.paymentCondition}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, paymentCondition: event.target.value as BulkContractForm["paymentCondition"] }))
                    }
                  >
                    <option value="no_due_date">Sin importar fecha de vencimiento</option>
                    <option value="on_due">Se paga al vencer plazo</option>
                    <option value="thirty_days">Se paga a los 30 dias</option>
                  </Select>
                </label>
                <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)] md:col-span-2 md:max-w-md">
                  Tipo de contrato
                  <Select
                    value={form.contractType}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contractType: event.target.value as BulkContractForm["contractType"] }))
                    }
                  >
                    <option value="performed_and_paid">Prestacion realizada y pagada</option>
                    <option value="performed">Prestacion realizada</option>
                  </Select>
                </label>
              </Card>
              <StepFooter step={2} canGoBack canGoForward={rateValid} onBack={() => setStep(1)} onForward={() => setStep(3)} />
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-[var(--space-4)]">
              <SectionHeading title="Montos fijos por arancel" description="Activa solo las prestaciones que tendran pago fijo para el profesional." />
              {priceLists.isLoading ? <LoadingState message="Cargando aranceles..." /> : null}
              {priceLists.isError ? <ErrorState message={priceLists.error.message} /> : null}
              <Card className="space-y-[var(--space-4)]">
                <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Arancel de la zona
                  <Select
                    value={form.priceListId}
                    onChange={(event) => setForm((current) => ({ ...current, priceListId: event.target.value }))}
                  >
                    <option value="">Sin arancel</option>
                    {zonePriceLists.map((priceList) => (
                      <option key={priceList.id} value={priceList.id}>
                        {priceList.name}
                        {priceList.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </Select>
                </label>
                {selectedPriceList ? (
                  <div className="grid gap-[var(--space-3)] md:grid-cols-3">
                    <SummaryMetric label="Categorias" value={catalog.length} />
                    <SummaryMetric label="Prestaciones" value={catalogItems.length} />
                    <SummaryMetric label="Montos activos" value={selectedFixedAmountCount} />
                  </div>
                ) : (
                  <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Selecciona un arancel para capturar montos fijos.</p>
                )}
              </Card>
              {selectedPriceList ? (
                <div className="grid gap-[var(--space-3)]">
                  {catalog.map((category) => (
                    <Card key={category.id} className="overflow-hidden p-0">
                      <div className="flex items-center justify-between gap-[var(--space-3)] border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
                        <div>
                          <p className="font-semibold text-[var(--text-brand-strong)]">{category.name}</p>
                          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{category.items.length} prestaciones</p>
                        </div>
                        <Tags className="h-4 w-4 text-[var(--text-brand)]" />
                      </div>
                      <div className="divide-y divide-[var(--border-default)]">
                        {category.items.map((item) => {
                          const active = form.fixedAmounts[item.procedureId] !== undefined;
                          return (
                            <div
                              key={item.id}
                              className="grid gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] md:grid-cols-[1fr_160px_180px]"
                            >
                              <button
                                type="button"
                                onClick={() => toggleFixedAmount(item)}
                                className="flex min-w-0 items-center gap-[var(--space-2)] text-left"
                              >
                                {active ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--text-brand)]" />
                                ) : (
                                  <Circle className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                )}
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-[var(--text-primary)]">
                                    {item.procedure.code} - {item.procedure.name}
                                  </span>
                                  <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">Precio arancel {money(item.price, item.currency)}</span>
                                </span>
                              </button>
                              <div className="flex items-center text-[var(--text-sm)] text-[var(--text-secondary)]">
                                {item.procedure.type}
                              </div>
                              <div className="flex items-center gap-[var(--space-2)]">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  disabled={!active}
                                  value={form.fixedAmounts[item.procedureId] ?? ""}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      fixedAmounts: {
                                        ...current.fixedAmounts,
                                        [item.procedureId]: event.target.value
                                      }
                                    }))
                                  }
                                />
                                <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">{item.currency}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}
              <StepFooter step={3} canGoBack canGoForward onBack={() => setStep(2)} onForward={() => setStep(4)} />
            </section>
          ) : null}

          {step === 4 ? (
            <section className="space-y-[var(--space-4)]">
              <SectionHeading title="Porcentajes avanzados por categoria" description="Estas reglas reemplazan el porcentaje base cuando la prestacion pertenece a la categoria." />
              {!selectedPriceList ? (
                <Card>
                  <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Selecciona un arancel en el paso anterior para configurar categorias.</p>
                </Card>
              ) : (
                <Card className="overflow-hidden p-0">
                  <div className="divide-y divide-[var(--border-default)]">
                    {rateRows.map((category) => (
                      <div
                        key={category.priceListCategoryId}
                        className="grid gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] md:grid-cols-[1fr_160px]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">{category.name}</p>
                          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{category.itemCount} prestaciones en este arancel</p>
                        </div>
                        <div className="flex items-center gap-[var(--space-2)]">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={form.categoryRates[category.id] ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                categoryRates: { ...current.categoryRates, [category.id]: event.target.value }
                              }))
                            }
                          />
                          <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <StepFooter step={4} canGoBack canGoForward onBack={() => setStep(3)} onForward={() => setStep(5)} />
            </section>
          ) : null}

          {step === 5 ? (
            <section className="space-y-[var(--space-4)]">
              <SectionHeading title="Resumen y guardado" description="Revisa el alcance antes de escribir contratos masivos." />
              <div className="grid gap-[var(--space-3)] md:grid-cols-4">
                <SummaryMetric label="Zona" value={ZONE_LABELS[selectedZone] ?? selectedZone} />
                <SummaryMetric label="Profesionales" value={selectedProfessionals.length} />
                <SummaryMetric label="Sucursales" value={visibleBranches.filter((branch) => selectedTargets.some((target) => target.branchId === branch.id)).length} />
                <SummaryMetric label="Cruces" value={selectedTargets.length} />
              </div>
              <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
                <Card className="space-y-[var(--space-3)]">
                  <div className="flex items-center justify-between gap-[var(--space-2)]">
                    <h3 className="font-semibold text-[var(--text-brand-strong)]">Contrato base</h3>
                    <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                  <div className="grid gap-[var(--space-2)] text-[var(--text-sm)]">
                    <p><strong>{form.commissionRate || "0"}%</strong> sobre {COMMISSION_BASE_LABELS[form.commissionBase]}</p>
                    <p>{CONTRACT_TYPE_LABELS[form.contractType]}</p>
                    <p>{PAYMENT_DISCOUNT_LABELS[form.paymentDiscount]} descuento medio de pago</p>
                    <p>{PAYMENT_CONDITION_LABELS[form.paymentCondition]}</p>
                  </div>
                </Card>
                <Card className="space-y-[var(--space-3)]">
                  <div className="flex items-center justify-between gap-[var(--space-2)]">
                    <h3 className="font-semibold text-[var(--text-brand-strong)]">Arancel y excepciones</h3>
                    <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                  <div className="grid gap-[var(--space-2)] text-[var(--text-sm)] text-[var(--text-primary)]">
                    <p>{selectedPriceList?.name ?? "Sin arancel seleccionado"}</p>
                    <p>{selectedFixedAmountCount} montos fijos selectivos</p>
                    <p>{selectedCategoryRateCount} porcentajes avanzados</p>
                  </div>
                </Card>
              </div>
              <Card className="space-y-[var(--space-3)]">
                <div className="flex items-center gap-[var(--space-2)]">
                  <ListChecks className="h-4 w-4 text-[var(--text-brand)]" />
                  <h3 className="font-semibold text-[var(--text-brand-strong)]">Preview backend</h3>
                </div>
                {previewContracts.isPending ? <LoadingState message="Calculando impacto..." /> : null}
                {previewContracts.error ? <ErrorState message={previewContracts.error.message} /> : null}
                {preview ? (
                  <div className="grid gap-[var(--space-3)] md:grid-cols-4">
                    <SummaryMetric label="Contratos nuevos" value={preview.contractsToCreate} />
                    <SummaryMetric label="Contratos a cerrar" value={preview.currentContractsToClose + preview.otherContractsToClose} />
                    <SummaryMetric label="Montos fijos" value={preview.fixedAmounts} />
                    <SummaryMetric label="Porcentajes" value={preview.categoryRates} />
                  </div>
                ) : null}
                {preview?.warnings.length ? (
                  <div className="space-y-[var(--space-2)]">
                    {preview.warnings.map((warning) => (
                      <div key={warning} className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--status-warning-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--status-warning-text)]">
                        <AlertTriangle className="h-4 w-4" />
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
              <Card className="space-y-[var(--space-3)] bg-[var(--bg-subtle)]">
                <label className="flex items-center justify-between gap-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
                  <span>Eliminar contratos anteriores de sucursales no seleccionadas</span>
                  <input
                    type="checkbox"
                    checked={removeOtherBranches}
                    onChange={(event) => setRemoveOtherBranches(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
                  <span>Mantener montos fijos y porcentajes avanzados anteriores</span>
                  <input
                    type="checkbox"
                    checked={keepPrevious}
                    onChange={(event) => setKeepPrevious(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </Card>
              {applyError ? <ErrorState message={applyError} /> : null}
              {lastResult ? (
                <Card className="border-[var(--status-success-text)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
                  Se actualizaron {lastResult.updatedProfessionals} contratos, {lastResult.fixedAmounts} montos fijos y {lastResult.categoryRates} porcentajes.
                </Card>
              ) : null}
              <StepFooter
                step={5}
                canGoBack
                canGoForward={canSave}
                onBack={() => setStep(4)}
                onForward={() => undefined}
                onSave={() => (removeOtherBranches ? setConfirmOpen(true) : void applyContracts())}
                saving={bulkContracts.isPending}
              />
            </section>
          ) : null}
        </div>
      </UsersModuleNav>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar cierre de contratos"
        description="Esta accion cerrara contratos activos fuera de las sucursales seleccionadas. Confirma solo si el alcance de zona y sucursales ya fue revisado."
        confirmLabel={bulkContracts.isPending ? "Guardando..." : "Guardar"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void applyContracts()}
      />
    </div>
  );
}
