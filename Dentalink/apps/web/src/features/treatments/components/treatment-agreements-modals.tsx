import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useAgreements } from "@/features/settings/admin-workflows/hooks/use-admin-workflows";
import type { TreatmentPlanDetail } from "@/features/treatments/services/treatments.service";
import { numberValue } from "./treatment-modal-helpers";

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
      <span className="font-semibold text-slate-500">{label}:</span>{" "}
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}


export type PatientAgreementOption = {
  id: string;
  name: string;
  discountPercent?: string | number | null;
  payrollDiscount?: boolean;
  isActive?: boolean;
  status?: string | null;
  priceListId?: string | null;
  priceList?: { id: string; name: string; isDefault?: boolean | null } | null;
};

export function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function agreementSnapshotString(snapshot: unknown, key: string): string | null {
  const value = recordValue(snapshot)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function agreementFromSnapshot(snapshot: unknown): PatientAgreementOption | null {
  const agreementId = agreementSnapshotString(snapshot, "agreementId");
  if (!agreementId) return null;
  const priceListId = agreementSnapshotString(snapshot, "priceListId");
  const priceListName = agreementSnapshotString(snapshot, "priceListName");
  return {
    id: agreementId,
    name: agreementSnapshotString(snapshot, "agreementName") ?? "Convenio del plan",
    priceListId,
    priceList: priceListId
      ? { id: priceListId, name: priceListName ?? "Arancel del convenio", isDefault: false }
      : null
  };
}

export function treatmentPlanAgreementId(plan?: TreatmentPlanDetail | null): string | null | undefined {
  return (
    plan?.agreementId ??
    plan?.agreement?.id ??
    agreementSnapshotString(plan?.agreementSnapshot, "agreementId")
  );
}

export function resolveEffectiveTreatmentAgreement({
  plan,
  patientAgreement,
  agreements
}: {
  plan?: TreatmentPlanDetail | null;
  patientAgreement?: PatientAgreementOption | null;
  agreements: PatientAgreementOption[];
}) {
  const planAgreementId = treatmentPlanAgreementId(plan);
  const effectiveAgreementId = planAgreementId ?? patientAgreement?.id ?? null;
  const catalogAgreement = effectiveAgreementId
    ? (agreements.find((agreement) => agreement.id === effectiveAgreementId) ?? null)
    : null;
  const planAgreement =
    plan?.agreement && (!effectiveAgreementId || plan.agreement.id === effectiveAgreementId)
      ? plan.agreement
      : null;
  const snapshotAgreement =
    planAgreementId && planAgreementId === effectiveAgreementId
      ? agreementFromSnapshot(plan?.agreementSnapshot)
      : null;
  const patientCurrentAgreement =
    patientAgreement && (!effectiveAgreementId || patientAgreement.id === effectiveAgreementId)
      ? patientAgreement
      : null;
  const agreement = catalogAgreement ?? planAgreement ?? snapshotAgreement ?? patientCurrentAgreement ?? null;
  const source = catalogAgreement
    ? "catalog"
    : planAgreement
      ? "plan"
      : snapshotAgreement
        ? "snapshot"
        : patientCurrentAgreement
          ? "patient"
          : "none";
  const priceListId =
    agreement?.priceList?.id ??
    agreement?.priceListId ??
    (planAgreementId === effectiveAgreementId
      ? agreementSnapshotString(plan?.agreementSnapshot, "priceListId")
      : null);

  return {
    agreementId: effectiveAgreementId,
    agreement,
    source,
    priceListId: priceListId ?? ""
  };
}


export function AgreementSummary({ agreement }: { agreement: PatientAgreementOption }) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-3">
      <SummaryPill label="Convenio" value={agreement.name} />
      <SummaryPill label="Descuento" value={`${numberValue(agreement.discountPercent)}%`} />
      <SummaryPill label="Arancel" value={agreement.priceList?.name ?? "Sin lista asociada"} />
    </div>
  );
}

export function AgreementAssignmentModal({
  open,
  currentAgreementId,
  currentAgreement,
  plan,
  onClose,
  onAssign,
  saving
}: {
  open: boolean;
  currentAgreementId?: string | null;
  currentAgreement?: PatientAgreementOption | null;
  plan: TreatmentPlanDetail | null;
  onClose: () => void;
  onAssign: (agreementId: string) => Promise<void>;
  saving: boolean;
}) {
  const [search, setSearch] = useState("");
  const [agreementId, setAgreementId] = useState("");
  const agreements = useAgreements(search || undefined, "true");
  const agreementOptions: PatientAgreementOption[] = agreements.data ?? [];
  const selectableAgreements =
    currentAgreement && !agreementOptions.some((agreement) => agreement.id === currentAgreement.id)
      ? [currentAgreement, ...agreementOptions]
      : agreementOptions;
  const selectedAgreement =
    selectableAgreements.find((agreement) => agreement.id === agreementId) ?? null;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setAgreementId(currentAgreementId ?? "");
  }, [currentAgreementId, open]);

  return (
    <Modal open={open} title="Asignar convenio" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700">Buscar convenio</label>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_380px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar convenio..."
              />
            </div>
            <Select value={agreementId} onChange={(event) => setAgreementId(event.target.value)}>
              <option value="">Seleccionar convenio</option>
              {selectableAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name}
                  {agreement.priceList ? ` — ${agreement.priceList.name}` : " (Sin listado)"}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-sky-50 p-5 text-center text-sm text-sky-900">
          {!plan?.items.length ? (
            <>
              <p className="font-semibold">Plan de tratamiento sin prestaciónes</p>
              <p className="mt-2">
                Agrega prestaciónes al plan de tratamiento para ver los valores con el convenio seleccionado.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">{plan.items.length} prestaciónes en este plan</p>
              <p className="mt-2">
                El convenio se asignara al paciente. Los procedimientos existentes no se recalculan
                automaticamente.
              </p>
            </>
          )}
        </div>

        {selectedAgreement ? <AgreementSummary agreement={selectedAgreement} /> : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button disabled={!agreementId || saving} onClick={() => void onAssign(agreementId)}>
            Asignar convenio
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AgreementDetailModal({
  open,
  agreement,
  onClose
}: {
  open: boolean;
  agreement?: PatientAgreementOption | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Detalle del convenio" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{agreement?.name ?? "Sin convenio"}</h3>
          <p className="mt-1 text-sm text-slate-500">Asignado al paciente</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
          <SummaryPill
            label="Arancel del convenio"
            value={agreement?.priceList?.name ?? "Sin arancel asociado"}
          />
          <SummaryPill label="Descuento convenio" value={`${numberValue(agreement?.discountPercent)}%`} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Este convenio no se modifica desde este plan porque ya existen prestaciónes o presupuesto. Las
          prestaciónes existentes conservan sus valores.
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
