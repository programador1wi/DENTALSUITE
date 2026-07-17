import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarClock, FileCheck2, FolderOpen, Plus, ShieldCheck, ShieldQuestion, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { useAgreements } from "@/features/settings/admin-workflows/hooks/use-admin-workflows";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import {
  usePatientBenefitsCoverageMutations,
  usePatientBenefitsCoverages
} from "../hooks/use-patients";
import type {
  PatientBenefitCoverage,
  PatientBenefitCoveragePayload,
  PatientBenefitCoverageStatus,
  PatientBenefitCoverageType,
  PatientDetail,
  ValidateInsurancePayload
} from "../services/patients.service";

const BENEFIT_COVERAGE_ENABLED = import.meta.env.VITE_PATIENT_BENEFITS_COVERAGES !== "false";

const coverageTypeLabels: Record<PatientBenefitCoverageType, string> = {
  INSURANCE: "Seguro",
  AGREEMENT: "Convenio",
  PAYROLL_BENEFIT: "Descuento por planilla",
  CORPORATE_BENEFIT: "Beneficio corporativo",
  MEMBERSHIP: "Membresia",
  OTHER: "Otro"
};

const coverageStatusLabels: Record<PatientBenefitCoverageStatus, string> = {
  DRAFT: "Borrador",
  PENDING_VALIDATION: "Pendiente validacion",
  VALIDATING: "Validando",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  SUSPENDED: "Suspendido",
  EXPIRED: "Vencido",
  REJECTED: "Rechazado",
  REQUIRES_DOCUMENTS: "Requiere documentos",
  INTEGRATION_ERROR: "Error integracion",
  CANCELLED: "Cancelado"
};

type BenefitForm = {
  type: PatientBenefitCoverageType;
  providerName: string;
  branchId: string;
  agreementId: string;
  planName: string;
  policyNumber: string;
  affiliateNumber: string;
  certificateNumber: string;
  employeeNumber: string;
  holderName: string;
  holderDocument: string;
  relationshipToPatient: string;
  startsAt: string;
  endsAt: string;
  coveragePercent: string;
  copayAmount: string;
  deductibleAmount: string;
  annualLimitAmount: string;
  requiresAuthorization: boolean;
  notes: string;
};

type ValidationForm = {
  coverageId: string;
  mode: ValidateInsurancePayload["mode"];
  status: PatientBenefitCoverageStatus;
  externalIdentifier: string;
  coveragePercent: string;
  copayAmount: string;
  deductibleAmount: string;
  annualLimitAmount: string;
  requiresAuthorization: boolean;
  validUntil: string;
  errorMessage: string;
};

function initialBenefitForm(patient: PatientDetail): BenefitForm {
  return {
    type: "AGREEMENT",
    providerName: patient.agreement?.name ?? "",
    branchId: patient.branchId,
    agreementId: patient.agreement?.id ?? "",
    planName: patient.agreement?.priceList?.name ?? "",
    policyNumber: "",
    affiliateNumber: "",
    certificateNumber: "",
    employeeNumber: "",
    holderName: `${patient.firstName} ${patient.lastName}`.trim(),
    holderDocument: patient.documentNumber ?? "",
    relationshipToPatient: "Titular",
    startsAt: "",
    endsAt: "",
    coveragePercent: patient.agreement ? String(Number(patient.agreement.discountPercent ?? 0)) : "",
    copayAmount: "",
    deductibleAmount: "",
    annualLimitAmount: "",
    requiresAuthorization: false,
    notes: ""
  };
}

function initialValidationForm(coverageId = ""): ValidationForm {
  return {
    coverageId,
    mode: "MANUAL",
    status: "ACTIVE",
    externalIdentifier: "",
    coveragePercent: "",
    copayAmount: "",
    deductibleAmount: "",
    annualLimitAmount: "",
    requiresAuthorization: false,
    validUntil: "",
    errorMessage: ""
  };
}

export function PatientBenefitsCoverageView({ patientId, patient }: { patientId: string; patient: PatientDetail }) {
  const query = usePatientBenefitsCoverages(patientId);
  const mutations = usePatientBenefitsCoverageMutations();
  const { hasPermission } = usePermissions();
  const [addOpen, setAddOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [detailCoverage, setDetailCoverage] = useState<PatientBenefitCoverage | null>(null);
  const [validationCoverageId, setValidationCoverageId] = useState("");
  const canWrite = hasPermission("patients.update") || hasPermission("system.manage_all");

  if (!BENEFIT_COVERAGE_ENABLED) {
    return (
      <EmptyState
        title="Beneficios y coberturas deshabilitado"
        description="La funcionalidad esta protegida por feature flag y no esta activa en este entorno."
      />
    );
  }

  if (query.isLoading) return <LoadingState message="Cargando beneficios y coberturas..." />;
  if (query.isError) return <ErrorState message={query.error.message} />;

  const response = query.data;
  const coverages = response?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Beneficios y coberturas</h2>
          <p className="text-sm text-slate-500">
            Perfil de elegibilidad del paciente; no reemplaza las coberturas operativas de facturacion.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setValidateOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              Validar seguro
            </Button>
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Agregar beneficio
            </Button>
          </div>
        ) : null}
      </div>

      <BenefitsCoverageSummary response={response} />

      {!coverages.length ? (
        <Card className="min-h-[220px]">
          <EmptyState
            title="Beneficios y coberturas"
            description="El paciente no tiene beneficios ni coberturas registrados. Registra un convenio, beneficio corporativo o seguro para consultar su vigencia y utilizarlo en planes de tratamiento."
          />
          {canWrite ? (
            <div className="mt-4 flex justify-center gap-2">
              <Button type="button" onClick={() => setAddOpen(true)}>
                Agregar beneficio
              </Button>
              <Button type="button" variant="secondary" onClick={() => setValidateOpen(true)}>
                Validar seguro
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <PatientCoverageList
          coverages={coverages}
          canWrite={canWrite}
          changing={mutations.changeStatus.isPending}
          onOpen={(coverage) => setDetailCoverage(coverage)}
          onValidate={(coverage) => {
            setValidationCoverageId(coverage.id);
            setValidateOpen(true);
          }}
          onStatus={(coverage, action) =>
            mutations.changeStatus.mutate({
              id: patientId,
              coverageId: coverage.id,
              action,
              reason: action === "cancel" ? "Cancelado desde ficha del paciente" : undefined
            })
          }
        />
      )}

      <AddBenefitModal
        open={addOpen}
        patient={patient}
        saving={mutations.createCoverage.isPending || mutations.validateInsurance.isPending}
        onClose={() => setAddOpen(false)}
        onSubmit={async (payload, action) => {
          const coverage = await mutations.createCoverage.mutateAsync({
            id: patientId,
            payload,
            idempotencyKey: createIdempotencyKey()
          });
          if (action === "validate") {
            await mutations.validateInsurance.mutateAsync({
              id: patientId,
              payload: {
                coverageId: coverage.id,
                mode: "MANUAL",
                status: "ACTIVE",
                providerName: coverage.providerName,
                normalizedResult: {
                  active: true,
                  holderName: coverage.holderName ?? undefined,
                  coveragePercent: coverage.coveragePercent ?? undefined,
                  copayAmount: coverage.copayAmount ?? undefined,
                  deductibleAmount: coverage.deductibleAmount ?? undefined,
                  annualLimitAmount: coverage.annualLimitAmount ?? undefined,
                  requiresAuthorization: coverage.requiresAuthorization,
                  validUntil: coverage.endsAt ?? undefined
                }
              }
            });
          }
          setAddOpen(false);
        }}
      />

      <ValidateInsuranceModal
        open={validateOpen}
        coverages={coverages}
        initialCoverageId={validationCoverageId}
        saving={mutations.validateInsurance.isPending}
        onClose={() => {
          setValidateOpen(false);
          setValidationCoverageId("");
        }}
        onSubmit={async (payload) => {
          await mutations.validateInsurance.mutateAsync({ id: patientId, payload });
          setValidateOpen(false);
          setValidationCoverageId("");
        }}
      />

      <CoverageDetailDrawer
        coverage={detailCoverage}
        onClose={() => setDetailCoverage(null)}
      />
    </section>
  );
}

function BenefitsCoverageSummary({ response }: { response?: ReturnType<typeof usePatientBenefitsCoverages>["data"] }) {
  const summary = response?.summary;
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SummaryTile icon={<ShieldCheck className="h-4 w-4" />} label="Activos" value={summary?.active ?? 0} tone="success" />
      <SummaryTile icon={<ShieldQuestion className="h-4 w-4" />} label="Por validar" value={summary?.pendingValidation ?? 0} tone="warning" />
      <SummaryTile icon={<FileCheck2 className="h-4 w-4" />} label="Documentos" value={summary?.documents ?? 0} />
      <SummaryTile
        icon={<CalendarClock className="h-4 w-4" />}
        label="Proximo vencimiento"
        value={summary?.nextExpiration ? dateOnly(summary.nextExpiration.endsAt) : "Sin fecha"}
      />
    </div>
  );
}

function SummaryTile({ icon, label, value, tone = "default" }: { icon: ReactNode; label: string; value: ReactNode; tone?: "default" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-slate-900";
  return (
    <Card className="flex min-h-[92px] items-center justify-between gap-3 p-4">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <p className={`mt-2 text-2xl font-semibold leading-none ${toneClass}`}>{value}</p>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-[#0879d5]">{icon}</span>
    </Card>
  );
}

function PatientCoverageList({
  coverages,
  canWrite,
  changing,
  onOpen,
  onValidate,
  onStatus
}: {
  coverages: PatientBenefitCoverage[];
  canWrite: boolean;
  changing: boolean;
  onOpen: (coverage: PatientBenefitCoverage) => void;
  onValidate: (coverage: PatientBenefitCoverage) => void;
  onStatus: (coverage: PatientBenefitCoverage, action: "activate" | "deactivate" | "cancel") => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {coverages.map((coverage) => (
        <PatientCoverageCard
          key={coverage.id}
          coverage={coverage}
          canWrite={canWrite}
          changing={changing}
          onOpen={() => onOpen(coverage)}
          onValidate={() => onValidate(coverage)}
          onStatus={(action) => onStatus(coverage, action)}
        />
      ))}
    </div>
  );
}

function PatientCoverageCard({
  coverage,
  canWrite,
  changing,
  onOpen,
  onValidate,
  onStatus
}: {
  coverage: PatientBenefitCoverage;
  canWrite: boolean;
  changing: boolean;
  onOpen: () => void;
  onValidate: () => void;
  onStatus: (action: "activate" | "deactivate" | "cancel") => void;
}) {
  const expiresSoon = isExpiringSoon(coverage.endsAt);
  return (
    <Card className="p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">{coverage.providerName}</p>
            <p className="text-sm text-slate-500">{coverageTypeLabels[coverage.type]}</p>
          </div>
          <Badge value={coverageStatusLabels[coverage.status]} tone={coverageStatusTone(coverage.status)} />
        </div>
      </div>
      <div className="grid gap-3 px-4 py-4 text-sm md:grid-cols-2">
        <Fact label="Convenio" value={coverage.agreement?.name ?? "Sin convenio"} />
        <Fact label="Plan o producto" value={coverage.planName ?? "Sin producto"} />
        <Fact label="Poliza" value={coverage.policyNumber ?? "-"} />
        <Fact label="Afiliado" value={coverage.affiliateNumber ?? "-"} />
        <Fact label="Titular" value={coverage.holderName ?? "-"} />
        <Fact label="Vigencia" value={coverage.endsAt ? dateOnly(coverage.endsAt) : "Sin termino"} highlight={expiresSoon} />
        <Fact label="Cobertura" value={coverage.coveragePercent == null ? "Configurable" : `${coverage.coveragePercent}%`} />
        <Fact label="Copago" value={coverage.copayAmount == null ? "No definido" : money(coverage.copayAmount)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <button type="button" className="text-sm font-semibold text-[#0879d5]" onClick={onOpen}>
          Ver detalle
        </button>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onValidate}>
              Validar
            </Button>
            {coverage.status === "ACTIVE" ? (
              <Button type="button" size="sm" variant="ghost" disabled={changing} onClick={() => onStatus("deactivate")}>
                Desactivar
              </Button>
            ) : coverage.status !== "CANCELLED" ? (
              <Button type="button" size="sm" variant="ghost" disabled={changing} onClick={() => onStatus("activate")}>
                Activar
              </Button>
            ) : null}
            {coverage.status !== "CANCELLED" ? (
              <Button type="button" size="sm" variant="ghost" disabled={changing} onClick={() => onStatus("cancel")}>
                Cancelar
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Fact({ label, value, highlight = false }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-1 font-medium ${highlight ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function AddBenefitModal({
  open,
  patient,
  saving,
  onClose,
  onSubmit
}: {
  open: boolean;
  patient: PatientDetail;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: PatientBenefitCoveragePayload, action: "draft" | "active" | "validate") => Promise<void>;
}) {
  const [form, setForm] = useState<BenefitForm>(() => initialBenefitForm(patient));
  const agreements = useAgreements(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");

  const selectedAgreement = useMemo(
    () => agreements.data?.find((agreement) => agreement.id === form.agreementId) ?? null,
    [agreements.data, form.agreementId]
  );

  const set = <K extends keyof BenefitForm>(key: K, value: BenefitForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (action: "draft" | "active" | "validate") => {
    const status = action === "draft" ? "DRAFT" : action === "active" ? "ACTIVE" : "PENDING_VALIDATION";
    await onSubmit(
      {
        type: form.type,
        providerName: form.providerName.trim(),
        branchId: form.branchId,
        agreementId: form.agreementId || null,
        planName: form.planName.trim() || undefined,
        policyNumber: form.policyNumber.trim() || undefined,
        affiliateNumber: form.affiliateNumber.trim() || undefined,
        certificateNumber: form.certificateNumber.trim() || undefined,
        employeeNumber: form.employeeNumber.trim() || undefined,
        holderName: form.holderName.trim() || undefined,
        holderDocument: form.holderDocument.trim() || undefined,
        relationshipToPatient: form.relationshipToPatient.trim() || undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        coveragePercent: numeric(form.coveragePercent),
        copayAmount: numeric(form.copayAmount),
        deductibleAmount: numeric(form.deductibleAmount),
        annualLimitAmount: numeric(form.annualLimitAmount),
        requiresAuthorization: form.requiresAuthorization,
        notes: form.notes.trim() || undefined,
        status
      },
      action
    );
    setForm(initialBenefitForm(patient));
  };

  return (
    <Modal open={open} title="Agregar beneficio" onClose={onClose} size="xl">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("active");
        }}
      >
        <FormSection title="Proveedor y producto">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Tipo">
              <Select value={form.type} onChange={(event) => set("type", event.target.value as PatientBenefitCoverageType)}>
                {Object.entries(coverageTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Convenio">
              <Select
                value={form.agreementId}
                onChange={(event) => {
                  const agreementId = event.target.value;
                  const agreement = agreements.data?.find((item) => item.id === agreementId);
                  setForm((current) => ({
                    ...current,
                    agreementId,
                    providerName: agreement?.name ?? current.providerName,
                    planName: agreement?.priceList?.name ?? current.planName,
                    coveragePercent: agreement ? String(Number(agreement.discountPercent ?? 0)) : current.coveragePercent
                  }));
                }}
              >
                <option value="">Sin convenio administrativo</option>
                {agreements.data?.map((agreement) => (
                  <option key={agreement.id} value={agreement.id}>{agreement.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Proveedor">
              <Input value={form.providerName} onChange={(event) => set("providerName", event.target.value)} required />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Plan o producto">
              <Input value={form.planName} onChange={(event) => set("planName", event.target.value)} />
            </Field>
            <Field label="Sucursal">
              <Select value={form.branchId} onChange={(event) => set("branchId", event.target.value)}>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Descuento convenio">
              <Input value={selectedAgreement ? `${Number(selectedAgreement.discountPercent)}%` : "No asociado"} readOnly />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Poliza, titular y vigencia">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Numero de poliza"><Input value={form.policyNumber} onChange={(event) => set("policyNumber", event.target.value)} /></Field>
            <Field label="Numero de afiliado"><Input value={form.affiliateNumber} onChange={(event) => set("affiliateNumber", event.target.value)} /></Field>
            <Field label="Certificado"><Input value={form.certificateNumber} onChange={(event) => set("certificateNumber", event.target.value)} /></Field>
            <Field label="Numero empleado"><Input value={form.employeeNumber} onChange={(event) => set("employeeNumber", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Titular"><Input value={form.holderName} onChange={(event) => set("holderName", event.target.value)} /></Field>
            <Field label="Documento titular"><Input value={form.holderDocument} onChange={(event) => set("holderDocument", event.target.value)} /></Field>
            <Field label="Relacion"><Input value={form.relationshipToPatient} onChange={(event) => set("relationshipToPatient", event.target.value)} /></Field>
            <Field label="Fecha termino"><Input type="date" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Fecha inicio"><Input type="date" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} /></Field>
            <Field label="% cobertura"><Input type="number" min="0" max="100" value={form.coveragePercent} onChange={(event) => set("coveragePercent", event.target.value)} /></Field>
            <Field label="Copago"><Input type="number" min="0" value={form.copayAmount} onChange={(event) => set("copayAmount", event.target.value)} /></Field>
            <Field label="Deducible"><Input type="number" min="0" value={form.deductibleAmount} onChange={(event) => set("deductibleAmount", event.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Reglas y observaciones">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <Textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Observaciones internas" />
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.requiresAuthorization} onChange={(event) => set("requiresAuthorization", event.target.checked)} />
              Requiere autorizacion
            </label>
          </div>
        </FormSection>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="secondary" disabled={saving || !form.providerName.trim()} onClick={() => void submit("draft")}>Guardar borrador</Button>
          <Button type="submit" disabled={saving || !form.providerName.trim()}>Guardar y activar</Button>
          <Button type="button" disabled={saving || !form.providerName.trim()} onClick={() => void submit("validate")}>Guardar y validar</Button>
        </div>
      </form>
    </Modal>
  );
}

function ValidateInsuranceModal({
  open,
  coverages,
  initialCoverageId,
  saving,
  onClose,
  onSubmit
}: {
  open: boolean;
  coverages: PatientBenefitCoverage[];
  initialCoverageId: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ValidateInsurancePayload) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ValidationForm>(() => initialValidationForm(initialCoverageId));
  const selectedCoverage = coverages.find((coverage) => coverage.id === form.coverageId) ?? null;
  const set = <K extends keyof ValidationForm>(key: K, value: ValidationForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setForm(initialValidationForm(initialCoverageId));
    setStep(1);
  }, [initialCoverageId, open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      coverageId: form.coverageId,
      mode: form.mode,
      status: form.status,
      providerName: selectedCoverage?.providerName,
      externalIdentifier: form.externalIdentifier || undefined,
      normalizedResult: {
        active: form.status === "ACTIVE",
        holderName: selectedCoverage?.holderName ?? undefined,
        coveragePercent: numeric(form.coveragePercent),
        copayAmount: numeric(form.copayAmount),
        deductibleAmount: numeric(form.deductibleAmount),
        annualLimitAmount: numeric(form.annualLimitAmount),
        requiresAuthorization: form.requiresAuthorization,
        validUntil: form.validUntil || undefined
      },
      errorMessage: form.errorMessage || undefined
    });
    setForm(initialValidationForm());
    setStep(1);
  };

  return (
    <Modal open={open} title="Validar seguro" onClose={onClose} size="lg">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-6 gap-1">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <span key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-[#0879d5]" : "bg-slate-200"}`} />
          ))}
        </div>

        {step === 1 ? (
          <FormSection title="Paso 1: proveedor y producto">
            <Field label="Cobertura">
              <Select value={form.coverageId} onChange={(event) => set("coverageId", event.target.value)} required>
                <option value="">Selecciona una cobertura</option>
                {coverages.map((coverage) => (
                  <option key={coverage.id} value={coverage.id}>{coverage.providerName} - {coverageTypeLabels[coverage.type]}</option>
                ))}
              </Select>
            </Field>
            {!coverages.length ? <p className="text-sm text-amber-700">Primero registra un beneficio o cobertura.</p> : null}
          </FormSection>
        ) : null}
        {step === 2 ? (
          <FormSection title="Paso 2: poliza y afiliacion">
            <div className="grid gap-3 md:grid-cols-2">
              <Fact label="Poliza" value={selectedCoverage?.policyNumber ?? "-"} />
              <Fact label="Afiliado" value={selectedCoverage?.affiliateNumber ?? "-"} />
            </div>
            <Field label="Identificador externo">
              <Input value={form.externalIdentifier} onChange={(event) => set("externalIdentifier", event.target.value)} />
            </Field>
          </FormSection>
        ) : null}
        {step === 3 ? (
          <FormSection title="Paso 3: titular y beneficiario">
            <div className="grid gap-3 md:grid-cols-2">
              <Fact label="Titular" value={selectedCoverage?.holderName ?? "-"} />
              <Fact label="Relacion" value={selectedCoverage?.relationshipToPatient ?? "-"} />
            </div>
          </FormSection>
        ) : null}
        {step === 4 ? (
          <FormSection title="Paso 4: vigencia">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Vigente hasta"><Input type="date" value={form.validUntil} onChange={(event) => set("validUntil", event.target.value)} /></Field>
              <Field label="Estado resultado">
                <Select value={form.status} onChange={(event) => set("status", event.target.value as PatientBenefitCoverageStatus)}>
                  {Object.entries(coverageStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </FormSection>
        ) : null}
        {step === 5 ? (
          <FormSection title="Paso 5: documentos">
            <p className="text-sm text-slate-600">Los documentos se vinculan desde Archivos del paciente. Esta validacion no bloquea el guardado principal.</p>
          </FormSection>
        ) : null}
        {step === 6 ? (
          <FormSection title="Paso 6: validacion">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Modo">
                <Select value={form.mode} onChange={(event) => set("mode", event.target.value as ValidationForm["mode"])}>
                  <option value="MANUAL">Manual</option>
                  <option value="AUTOMATIC">Automatica</option>
                  <option value="DOCUMENTAL">Documental</option>
                  <option value="MIXED">Mixta</option>
                </Select>
              </Field>
              <Field label="% cobertura"><Input type="number" min="0" max="100" value={form.coveragePercent} onChange={(event) => set("coveragePercent", event.target.value)} /></Field>
              <Field label="Copago"><Input type="number" min="0" value={form.copayAmount} onChange={(event) => set("copayAmount", event.target.value)} /></Field>
              <Field label="Deducible"><Input type="number" min="0" value={form.deductibleAmount} onChange={(event) => set("deductibleAmount", event.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={form.requiresAuthorization} onChange={(event) => set("requiresAuthorization", event.target.checked)} />
              Requiere autorizacion previa
            </label>
            <Field label="Error o comentario de validacion">
              <Textarea value={form.errorMessage} onChange={(event) => set("errorMessage", event.target.value)} />
            </Field>
          </FormSection>
        ) : null}

        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
            Anterior
          </Button>
          {step < 6 ? (
            <Button type="button" disabled={step === 1 && !form.coverageId} onClick={() => setStep((current) => Math.min(6, current + 1))}>
              Siguiente
            </Button>
          ) : (
            <Button type="submit" disabled={saving || !form.coverageId}>
              Registrar validacion
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function CoverageDetailDrawer({ coverage, onClose }: { coverage: PatientBenefitCoverage | null; onClose: () => void }) {
  if (!coverage) return null;
  return (
    <Modal open={Boolean(coverage)} title={coverage.providerName} onClose={onClose} size="xl">
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Fact label="Estado" value={<Badge value={coverageStatusLabels[coverage.status]} tone={coverageStatusTone(coverage.status)} />} />
          <Fact label="Tipo" value={coverageTypeLabels[coverage.type]} />
          <Fact label="Version" value={coverage.version} />
        </div>
        <Panel title="Historial de validacion" icon={<ShieldCheck className="h-4 w-4" />}>
          {!coverage.validations.length ? (
            <p className="text-sm text-slate-500">Sin validaciones registradas.</p>
          ) : (
            <div className="space-y-2">
              {coverage.validations.map((validation) => (
                <div key={validation.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{validation.mode}</span>
                    <Badge value={coverageStatusLabels[validation.status]} tone={coverageStatusTone(validation.status)} />
                  </div>
                  <p className="mt-1 text-slate-500">{validation.errorMessage || validation.externalIdentifier || "Resultado normalizado registrado"}</p>
                  <p className="mt-1 text-xs text-slate-400">{dateTime(validation.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Documentos" icon={<FolderOpen className="h-4 w-4" />}>
          {!coverage.documents.length ? (
            <p className="text-sm text-slate-500">Sin documentos vinculados.</p>
          ) : (
            <div className="space-y-2">
              {coverage.documents.map((document) => (
                <a key={document.id} className="block rounded-md border border-slate-200 px-3 py-2 text-sm text-[#0879d5]" href={document.fileAttachment.url} target="_blank" rel="noreferrer">
                  {document.fileAttachment.originalName}
                </a>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Auditoria" icon={<Stethoscope className="h-4 w-4" />}>
          {!coverage.audits.length ? (
            <p className="text-sm text-slate-500">Sin auditoria registrada.</p>
          ) : (
            <div className="space-y-2">
              {coverage.audits.map((audit) => (
                <div key={audit.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">{audit.action}</span>
                  <span className="text-xs text-slate-500">{dateTime(audit.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Modal>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function coverageStatusTone(status: PatientBenefitCoverageStatus) {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING_VALIDATION" || status === "VALIDATING" || status === "REQUIRES_DOCUMENTS") return "warning";
  if (status === "REJECTED" || status === "INTEGRATION_ERROR" || status === "CANCELLED" || status === "EXPIRED") return "danger";
  return "default";
}

function numeric(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(value);
}

function dateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX", { dateStyle: "medium" });
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function isExpiringSoon(value?: string | null) {
  if (!value) return false;
  const date = new Date(value).getTime();
  const now = Date.now();
  return date >= now && date - now <= 30 * 24 * 60 * 60 * 1000;
}

function createIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
