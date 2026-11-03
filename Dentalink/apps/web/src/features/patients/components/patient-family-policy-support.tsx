import { useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTreatmentPlan, useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import { usePolicyCoverageMutations } from "../hooks/use-family-policies";
import type { FamilyPolicyDetail, PolicyStatus } from "../services/family-policies.service";

export function UseInTreatmentPanel({ patientId, policy }: { patientId: string; policy: FamilyPolicyDetail }) {
  const plans = useTreatmentPlans({ patientId }, true);
  const [planId, setPlanId] = useState("");
  const [itemId, setItemId] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const plan = useTreatmentPlan(planId);
  const coverage = usePolicyCoverageMutations(patientId, policy.policyNumber);
  const simulation = coverage.simulate.data;
  const selectPlan = (value: string) => {
    setPlanId(value);
    setItemId("");
    coverage.simulate.reset();
  };
  const selectItem = (value: string) => {
    setItemId(value);
    coverage.simulate.reset();
  };
  return (
    <Section title="Usar en tratamiento" icon={<CalendarDays className="h-4 w-4" />}>
      <p className="mb-3 text-sm text-slate-500">
        La simulación no consume límites. La aplicación confirmada registra el consumo y su copago en la prestación.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={planId} onChange={(event) => selectPlan(event.target.value)}>
          <option value="">Seleccionar plan</option>
          {plans.data
            ?.filter((candidate) => !["CANCELLED", "COMPLETED", "REJECTED"].includes(candidate.status))
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.branch.name}
              </option>
            ))}
        </Select>
        <Select
          value={itemId}
          onChange={(event) => selectItem(event.target.value)}
          disabled={!planId || plan.isLoading}
        >
          <option value="">Seleccionar prestación</option>
          {plan.data?.items
            ?.filter((item) => !["CANCELLED", "COMPLETED"].includes(item.status))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.procedure?.name ?? "Prestación"} ·{" "}
                {money(item.finalPrice ?? item.total, item.priceCurrency ?? policy.financial.currency)}
              </option>
            ))}
        </Select>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          disabled={!itemId || coverage.simulate.isPending}
          onClick={() => coverage.simulate.mutate(itemId)}
        >
          Simular cobertura
        </Button>
      </div>
      {simulation ? (
        <div
          className={`mt-4 rounded-xl border p-4 ${simulation.canApply ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}
        >
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <Fact label="Valor normal" value={money(simulation.normalAmount, simulation.currency)} />
            <Fact label="Cubierto" value={money(simulation.coveredAmount, simulation.currency)} />
            <Fact label="Copago" value={money(simulation.copayAmount, simulation.currency)} />
          </div>
          {simulation.blockingReasons.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-amber-800">
              {simulation.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {simulation.requiresAuthorization ? (
            <Input
              className="mt-3"
              value={authorizationCode}
              onChange={(event) => setAuthorizationCode(event.target.value)}
              placeholder="Código de autorización requerido"
            />
          ) : null}
          {simulation.canApply ? (
            <div className="mt-3 flex justify-end">
              <Button
                disabled={coverage.apply.isPending || (simulation.requiresAuthorization && !authorizationCode.trim())}
                onClick={() =>
                  coverage.apply.mutate({
                    treatmentPlanItemId: itemId,
                    authorizationCode: authorizationCode || undefined
                  })
                }
              >
                Confirmar aplicación
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

export function PolicySkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-label="Cargando pólizas">
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

export function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DarkFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function Fact({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 truncate font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export function Metric({ label, value, warning = false }: { label: string; value: ReactNode; warning?: boolean }) {
  return (
    <div className="min-w-0 px-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-xs font-semibold ${warning ? "text-amber-700" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

export function statusTone(status: PolicyStatus): "default" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (["DRAFT", "PENDING_PAYMENT", "PAID_PENDING_ACTIVATION", "WAITING_PERIOD"].includes(status)) return "warning";
  if (["CANCELLED", "EXPIRED"].includes(status)) return "danger";
  return "default";
}

export function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function coverageLabel(coverage: FamilyPolicyDetail["coverages"][number]) {
  if (coverage.type === "FULL") return "100 %";
  if (coverage.type === "PERCENTAGE") return `${Number(coverage.value)} %`;
  return `Hasta ${Number(coverage.value).toLocaleString("es-MX")}`;
}

export function auditLabel(action: string) {
  return (
    {
      create_draft: "Póliza creada",
      pay_and_activate: "Pago y activación",
      register_partial_payment: "Pago parcial",
      apply_coverage: "Cobertura aplicada",
      reverse_coverage: "Cobertura revertida",
      cancel: "Póliza cancelada"
    }[action] ?? action.replaceAll("_", " ")
  );
}
