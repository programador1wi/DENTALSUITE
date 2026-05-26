import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Circle, Pencil } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePriceLists } from "@/features/settings/price-lists/hooks/use-price-lists";
import { useProcedureCategories } from "@/features/settings/procedures/hooks/use-procedures";
import { useProfessionals, useUpdateProfessional } from "@/features/settings/professionals/hooks/use-professionals";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { UsersModuleNav } from "../components/users-module-nav";

// ─── Types ──────────────────────────────────────────────────────────────────

type SelectionMap = Record<string, string[]>;

type BulkContractForm = {
  // Paso 2 — Configurar contrato
  commissionRate: string;
  commissionBase: string;
  paymentDiscount: string;
  paymentCondition: string;
  contractType: string;
  // Paso 3 — Montos fijos
  priceListId: string;
  // Paso 4 — Porcentajes avanzados
  categoryRates: Record<string, string>;
};

const EMPTY_FORM: BulkContractForm = {
  commissionRate: "",
  commissionBase: "clinical",
  paymentDiscount: "no",
  paymentCondition: "no_due_date",
  contractType: "performed_and_paid",
  priceListId: "",
  categoryRates: {},
};

// ─── Step descriptor ────────────────────────────────────────────────────────

const STEPS = [
  { key: 1 as const, label: "Seleccionar\nprofesionales" },
  { key: 2 as const, label: "Configurar\ncontrato" },
  { key: 3 as const, label: "Montos\nfijos" },
  { key: 4 as const, label: "Porcentajes\navanzados" },
  { key: 5 as const, label: "Resumen" },
];

type StepKey = (typeof STEPS)[number]["key"];

// ─── Option maps ────────────────────────────────────────────────────────────

const COMMISSION_BASE_LABELS: Record<string, string> = {
  clinical: "Acciones clínicas",
  lab: "Laboratorio",
  all: "Todas las prestaciones",
};

const PAYMENT_DISCOUNT_LABELS: Record<string, string> = {
  no: "No",
  yes: "Sí",
  fixed: "Valor fijo",
};

const PAYMENT_CONDITION_LABELS: Record<string, string> = {
  no_due_date: "Se le pagarán al Dr. sin importar la fecha de vencimiento",
  on_due: "Se le paga al vencer el plazo",
  thirty_days: "Se le paga a los 30 días",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  performed_and_paid: "Por prestación realizada y pagada",
  performed: "Por prestación realizada",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function hasCategoryRates(categoryRates: Record<string, string>) {
  return Object.values(categoryRates).some((v) => v !== "" && Number(v) > 0);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Stepper({ current }: { current: StepKey }) {
  return (
    <ol className="flex w-full items-start border-b border-slate-200">
      {STEPS.map((step, idx) => {
        const done = current > step.key;
        const active = current === step.key;
        return (
          <li
            key={step.key}
            className={`relative flex flex-1 flex-col items-center gap-1.5 border-b-2 pb-3 pt-4 text-center transition-all ${
              active
                ? "border-[#0784d8] text-[#0679c8]"
                : done
                  ? "border-sky-300 text-slate-500"
                  : "border-transparent text-slate-400"
            }`}
          >
            {/* connector line between steps */}
            {idx > 0 && (
              <span
                className={`absolute left-0 top-[28px] -translate-x-1/2 h-px w-full ${done ? "bg-sky-300" : "bg-slate-200"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                active
                  ? "border-[#0784d8] bg-[#0784d8] text-white"
                  : done
                    ? "border-sky-300 bg-sky-50 text-sky-600"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : step.key}
            </span>
            <span className="whitespace-pre-line text-[10px] font-semibold leading-tight">
              {step.label}
            </span>
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
  saving,
  forwardLabel,
}: {
  step: StepKey;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onSave?: () => void;
  saving?: boolean;
  forwardLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
      <Button variant="secondary" disabled={!canGoBack} onClick={onBack}>
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        Volver al paso anterior
      </Button>
      {step < 5 ? (
        <Button disabled={!canGoForward} onClick={onForward}>
          {forwardLabel ?? "Siguiente paso"}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700/20"
          disabled={saving || !canGoForward}
          onClick={onSave}
        >
          <Check className="mr-1.5 h-4 w-4" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-[#0679c8] mb-4">
      {children}
    </p>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function UsersBulkContractsPage() {
  const [step, setStep] = useState<StepKey>(1);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<SelectionMap>({});
  const [form, setForm] = useState<BulkContractForm>(EMPTY_FORM);
  const [removeOtherBranches, setRemoveOtherBranches] = useState(false);
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);

  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(search || undefined, "true");
  const priceLists = usePriceLists(undefined, "true");
  const categories = useProcedureCategories(undefined, "true");
  const updateProfessional = useUpdateProfessional();

  const rows = professionals.data ?? [];

  // ── Selection helpers ────────────────────────────────────────────────────

  const selectedTargets = useMemo(
    () =>
      rows.flatMap((p) =>
        (selection[p.id] ?? []).map((branchId) => ({ branchId, professional: p }))
      ),
    [rows, selection]
  );

  const selectedProfessionals = useMemo(() => {
    const byId = new Map<string, Professional>();
    selectedTargets.forEach(({ professional }) => byId.set(professional.id, professional));
    return [...byId.values()];
  }, [selectedTargets]);

  const toggleTarget = (professional: Professional, branchId: string) => {
    if (!professional.branches.some((b) => b.id === branchId)) return;
    setSelection((cur) => {
      const prev = cur[professional.id] ?? [];
      const next = prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId];
      const updated = { ...cur };
      if (next.length) updated[professional.id] = next;
      else delete updated[professional.id];
      return updated;
    });
  };

  const toggleProfessional = (professional: Professional) => {
    const allIds = professional.branches.map((b) => b.id);
    const allSelected = allIds.every((id) => selection[professional.id]?.includes(id));
    setSelection((cur) => {
      const updated = { ...cur };
      if (allSelected) delete updated[professional.id];
      else updated[professional.id] = allIds;
      return updated;
    });
  };

  // ── Form field helper ────────────────────────────────────────────────────

  const setField = <K extends keyof BulkContractForm>(key: K, value: BulkContractForm[K]) => {
    setForm((cur) => ({ ...cur, [key]: value }));
  };

  const setCategoryRate = (categoryId: string, rate: string) => {
    setForm((cur) => ({
      ...cur,
      categoryRates: { ...cur.categoryRates, [categoryId]: rate },
    }));
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const normalizedRate = Number(form.commissionRate);
  const rateValid =
    form.commissionRate !== "" &&
    Number.isFinite(normalizedRate) &&
    normalizedRate >= 0 &&
    normalizedRate <= 100;

  // ── Apply ────────────────────────────────────────────────────────────────

  const applyContracts = async () => {
    if (!rateValid || !selectedProfessionals.length) return;
    setApplying(true);
    setApplyError("");
    setUpdatedCount(null);
    try {
      await Promise.all(
        selectedProfessionals.map((p) =>
          updateProfessional.mutateAsync({
            id: p.id,
            payload: { commissionRate: normalizedRate },
          })
        )
      );
      setUpdatedCount(selectedProfessionals.length);
    } catch (err) {
      setApplyError(
        err instanceof Error ? err.message : "No se pudieron actualizar los contratos."
      );
    } finally {
      setApplying(false);
    }
  };

  // ── Derived display values ───────────────────────────────────────────────

  const selectedPriceList = priceLists.data?.find((pl) => pl.id === form.priceListId);
  const activeCategoryRates = Object.entries(form.categoryRates).filter(
    ([, v]) => v !== "" && Number(v) > 0
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        <div className="space-y-0">
          {/* ── Header ── */}
          <div className="pb-4">
            <PageHeader
              title="Edicion masiva de contratos"
              description="Configura y aplica contratos a varios profesionales desde un mismo flujo de 5 pasos."
            />
          </div>

          {/* ── Stepper ── */}
          <Stepper current={step} />

          {/* ── Loading/Error states ── */}
          {(branches.isLoading || professionals.isLoading) && step === 1 ? (
            <div className="pt-6">
              <LoadingState message="Cargando profesionales y sucursales..." />
            </div>
          ) : null}
          {branches.isError ? <ErrorState message={branches.error.message} /> : null}
          {professionals.isError ? <ErrorState message={professionals.error.message} /> : null}

          <div className="pt-5">
            {/* ════════════════════════════════════════════════════════════
                PASO 1 — Seleccionar profesionales
            ════════════════════════════════════════════════════════════ */}
            {step === 1 ? (
              <section className="space-y-4">
                <SectionTitle>Seleccionar profesionales</SectionTitle>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="grid gap-1 text-sm text-slate-700">
                    Buscar profesional
                    <Input
                      placeholder="Nombre, correo o cédula"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="sm:w-80"
                    />
                  </label>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {selectedProfessionals.length}
                    </span>{" "}
                    profesionales · {selectedTargets.length} alcances seleccionados
                  </p>
                </div>

                <Card className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-sm">
                      <thead className="bg-white text-xs font-semibold text-[#0679c8]">
                        <tr>
                          <th className="sticky left-0 z-10 w-[290px] border-b border-slate-200 bg-white px-4 py-3 text-left">
                            Profesional
                          </th>
                          {(branches.data ?? []).map((branch) => (
                            <th
                              key={branch.id}
                              className="w-24 border-b border-slate-200 px-2 py-3 text-center align-bottom"
                            >
                              <span className="inline-block max-w-24 break-words leading-4">
                                {branch.name}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((professional) => (
                          <tr key={professional.id} className="border-t border-slate-100">
                            <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium text-slate-700">
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 text-left hover:text-[#0679c8]"
                                onClick={() => toggleProfessional(professional)}
                              >
                                <span>
                                  {professional.firstName} {professional.lastName}
                                </span>
                                <span className="text-xs text-slate-400">Todos</span>
                              </button>
                            </th>
                            {(branches.data ?? []).map((branch) => {
                              const available = professional.branches.some(
                                (b) => b.id === branch.id
                              );
                              const selected =
                                selection[professional.id]?.includes(branch.id) ?? false;
                              return (
                                <td
                                  key={`${professional.id}-${branch.id}`}
                                  className={`h-12 px-2 text-center transition-colors ${selected ? "bg-sky-50" : ""}`}
                                >
                                  {available ? (
                                    <button
                                      type="button"
                                      aria-label={`${selected ? "Quitar" : "Seleccionar"} ${professional.firstName} en ${branch.name}`}
                                      className="inline-flex h-8 w-8 items-center justify-center text-[#0679c8]"
                                      onClick={() => toggleTarget(professional, branch.id)}
                                    >
                                      {selected ? (
                                        <Check className="h-5 w-5" />
                                      ) : (
                                        <Circle className="h-4 w-4" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <StepFooter
                  step={1}
                  canGoBack={false}
                  canGoForward={selectedProfessionals.length > 0}
                  onBack={() => {}}
                  onForward={() => setStep(2)}
                />
              </section>
            ) : null}

            {/* ════════════════════════════════════════════════════════════
                PASO 2 — Configurar contrato
            ════════════════════════════════════════════════════════════ */}
            {step === 2 ? (
              <section className="space-y-4">
                <SectionTitle>Detalles del contrato</SectionTitle>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Porcentaje acciones */}
                  <label className="grid gap-1 text-sm text-slate-700">
                    Porcentaje acciones
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="0"
                        value={form.commissionRate}
                        onChange={(e) => setField("commissionRate", e.target.value)}
                      />
                      <span className="shrink-0 text-sm text-slate-500">%</span>
                    </div>
                    {form.commissionRate !== "" && !rateValid ? (
                      <p className="text-xs text-red-600">Debe ser un valor entre 0 y 100.</p>
                    ) : null}
                  </label>

                  {/* Descto. medio de pago */}
                  <label className="grid gap-1 text-sm text-slate-700">
                    Descto. medio de pago
                    <Select
                      value={form.paymentDiscount}
                      onChange={(e) => setField("paymentDiscount", e.target.value)}
                    >
                      <option value="no">No</option>
                      <option value="yes">Sí</option>
                      <option value="fixed">Valor fijo</option>
                    </Select>
                  </label>

                  {/* Porcentaje sobre */}
                  <label className="grid gap-1 text-sm text-slate-700">
                    Porcentaje sobre
                    <Select
                      value={form.commissionBase}
                      onChange={(e) => setField("commissionBase", e.target.value)}
                    >
                      <option value="clinical">Acciones clínicas</option>
                      <option value="lab">Laboratorio</option>
                      <option value="all">Todas las prestaciones</option>
                    </Select>
                  </label>

                  {/* Condiciones de pago */}
                  <label className="grid gap-1 text-sm text-slate-700">
                    Condiciones de pago
                    <Select
                      value={form.paymentCondition}
                      onChange={(e) => setField("paymentCondition", e.target.value)}
                    >
                      <option value="no_due_date">
                        Se le pagarán al Dr. sin importar la fecha de vencimiento
                      </option>
                      <option value="on_due">Se le paga al vencer el plazo</option>
                      <option value="thirty_days">Se le paga a los 30 días</option>
                    </Select>
                  </label>

                  {/* Tipo de contrato */}
                  <label className="grid gap-1 text-sm text-slate-700 sm:col-span-2 sm:max-w-sm">
                    Tipo de contrato
                    <Select
                      value={form.contractType}
                      onChange={(e) => setField("contractType", e.target.value)}
                    >
                      <option value="performed_and_paid">
                        Por prestación realizada y pagada
                      </option>
                      <option value="performed">Por prestación realizada</option>
                    </Select>
                  </label>
                </div>

                <StepFooter
                  step={2}
                  canGoBack={true}
                  canGoForward={rateValid}
                  onBack={() => setStep(1)}
                  onForward={() => setStep(3)}
                />
              </section>
            ) : null}

            {/* ════════════════════════════════════════════════════════════
                PASO 3 — Montos fijos
            ════════════════════════════════════════════════════════════ */}
            {step === 3 ? (
              <section className="space-y-4">
                <SectionTitle>Definir montos fijos</SectionTitle>

                {priceLists.isLoading ? (
                  <LoadingState message="Cargando aranceles..." />
                ) : priceLists.isError ? (
                  <ErrorState message={priceLists.error.message} />
                ) : (
                  <label className="grid gap-1 text-sm text-slate-700">
                    Seleccione un arancel:
                    <Select
                      value={form.priceListId}
                      onChange={(e) => setField("priceListId", e.target.value)}
                      className="py-2.5"
                    >
                      <option value="">-- Sin arancel (no se aplican montos fijos) --</option>
                      {priceLists.data?.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                          {pl.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}

                {form.priceListId && selectedPriceList ? (
                  <Card className="bg-sky-50/60 border-sky-200">
                    <p className="text-xs font-semibold uppercase text-sky-700">
                      Arancel seleccionado
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedPriceList.name}</p>
                    <p className="text-xs text-slate-500">
                      {selectedPriceList.items.length} precios configurados
                    </p>
                  </Card>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No se han definido montos fijos.
                  </p>
                )}

                <StepFooter
                  step={3}
                  canGoBack={true}
                  canGoForward={true}
                  onBack={() => setStep(2)}
                  onForward={() => setStep(4)}
                />
              </section>
            ) : null}

            {/* ════════════════════════════════════════════════════════════
                PASO 4 — Porcentajes avanzados
            ════════════════════════════════════════════════════════════ */}
            {step === 4 ? (
              <section className="space-y-4">
                <SectionTitle>Definir porcentajes avanzados por categoría</SectionTitle>

                {categories.isLoading ? (
                  <LoadingState message="Cargando categorías..." />
                ) : categories.isError ? (
                  <ErrorState message={categories.error.message} />
                ) : (
                  <Card className="overflow-hidden p-0">
                    <div className="divide-y divide-slate-100">
                      {(categories.data ?? []).map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-slate-50"
                        >
                          <span className="flex-1 text-sm font-medium text-slate-700">
                            {cat.name}
                          </span>
                          <div className="flex w-32 shrink-0 items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              placeholder="00,00"
                              value={form.categoryRates[cat.id] ?? ""}
                              onChange={(e) => setCategoryRate(cat.id, e.target.value)}
                              className="text-right"
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <StepFooter
                  step={4}
                  canGoBack={true}
                  canGoForward={true}
                  onBack={() => setStep(3)}
                  onForward={() => setStep(5)}
                />
              </section>
            ) : null}

            {/* ════════════════════════════════════════════════════════════
                PASO 5 — Resumen
            ════════════════════════════════════════════════════════════ */}
            {step === 5 ? (
              <section className="space-y-4">
                <SectionTitle>Resumen del contrato a modificar</SectionTitle>

                {/* Configuración del contrato */}
                <Card className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Configuración del contrato</p>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#0679c8] hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs text-slate-500">Porcentaje de acciones</p>
                      <p className="font-semibold text-slate-900">{form.commissionRate || "0"}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Porcentaje sobre</p>
                      <p className="font-semibold text-slate-900">
                        {COMMISSION_BASE_LABELS[form.commissionBase]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Descto. medio de pago</p>
                      <p className="font-semibold text-slate-900">
                        {PAYMENT_DISCOUNT_LABELS[form.paymentDiscount]}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500">Condiciones de pago</p>
                      <p className="font-semibold text-slate-900">
                        {PAYMENT_CONDITION_LABELS[form.paymentCondition]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tipo de contrato</p>
                      <p className="font-semibold text-slate-900">
                        {CONTRACT_TYPE_LABELS[form.contractType]}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Profesionales + Montos fijos */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Profesionales */}
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">Profesionales</p>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#0679c8] hover:underline"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                    </div>
                    {selectedProfessionals.length ? (
                      <ul className="space-y-1 border-t border-slate-100 pt-3">
                        {selectedProfessionals.map((p) => (
                          <li key={p.id} className="text-sm text-slate-700">
                            <span className="font-medium">
                              {p.firstName} {p.lastName}
                            </span>
                            <span className="text-xs text-slate-400 ml-2">
                              {p.branches
                                .filter((b) => selection[p.id]?.includes(b.id))
                                .map((b) => b.name)
                                .join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Sin profesionales seleccionados.</p>
                    )}
                  </Card>

                  {/* Montos fijos */}
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">Montos fijos</p>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#0679c8] hover:underline"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      {selectedPriceList ? (
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedPriceList.name}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">
                          No se han definido montos fijos.
                        </p>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Porcentajes avanzados */}
                <Card className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Porcentajes avanzados</p>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#0679c8] hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    {hasCategoryRates(form.categoryRates) ? (
                      <ul className="space-y-1">
                        {activeCategoryRates.map(([catId, rate]) => {
                          const cat = categories.data?.find((c) => c.id === catId);
                          return (
                            <li
                              key={catId}
                              className="flex items-center justify-between text-sm text-slate-700"
                            >
                              <span>{cat?.name ?? catId}</span>
                              <span className="font-semibold">{Number(rate).toFixed(2)}%</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        No se han definido porcentajes avanzados.
                      </p>
                    )}
                  </div>
                </Card>

                {/* Toggles */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span className="text-sm text-slate-700">
                      Eliminar contratos anteriores de las sucursales no seleccionadas
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={removeOtherBranches}
                      onClick={() => setRemoveOtherBranches((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        removeOtherBranches ? "bg-[#0784d8]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
                          removeOtherBranches ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span className="text-sm text-slate-700">
                      Mantener montos fijos y porcentajes avanzados anteriores
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keepPrevious}
                      onClick={() => setKeepPrevious((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        keepPrevious ? "bg-[#0784d8]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
                          keepPrevious ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </label>
                </div>

                {/* Feedback de guardado */}
                {applyError ? <ErrorState message={applyError} /> : null}
                {updatedCount !== null ? (
                  <Card className="border-emerald-200 bg-emerald-50/60 text-sm text-emerald-800">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      Se actualizaron correctamente{" "}
                      <span className="font-bold">{updatedCount}</span> contratos profesionales.
                    </div>
                  </Card>
                ) : null}

                <StepFooter
                  step={5}
                  canGoBack={true}
                  canGoForward={rateValid && selectedProfessionals.length > 0}
                  onBack={() => setStep(4)}
                  onForward={() => {}}
                  onSave={() => void applyContracts()}
                  saving={applying}
                />
              </section>
            ) : null}
          </div>
        </div>
      </UsersModuleNav>
    </div>
  );
}
