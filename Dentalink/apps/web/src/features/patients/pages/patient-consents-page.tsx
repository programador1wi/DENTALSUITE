import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileSignature,
  Fingerprint,
  History,
  PenLine,
  Plus,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SafeHtml } from "@/components/ui/safe-html";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Textarea } from "@/components/ui/textarea";
import {
  useConsentAudit,
  useConsentEvidence,
  useConsentTemplates,
  useDocumentsMutations,
  usePatientConsents
} from "@/features/documents/hooks/use-documents";
import { prepareConsentSignature, type Consent } from "@/features/documents/services/documents.service";
import { ClinicalShell } from "@/features/clinical/components/clinical-shell";

type SignerType = "PATIENT" | "PROFESSIONAL" | "REPRESENTATIVE";

const STATUS_LABELS: Record<Consent["status"], string> = {
  DRAFT: "Borrador",
  READY_FOR_SIGNATURE: "Pendiente de firma",
  PARTIALLY_SIGNED: "Firma parcial",
  SIGNED: "Completado",
  VOIDED: "Anulado",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado"
};

export function PatientConsentsPage() {
  const { id = "" } = useParams();
  const [status, setStatus] = useState<"" | Consent["status"]>("");
  const [templateId, setTemplateId] = useState("");
  const [treatmentPlanId, setTreatmentPlanId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [signerType, setSignerType] = useState<SignerType>("PATIENT");
  const [signerName, setSignerName] = useState("");
  const [acceptanceChecked, setAcceptanceChecked] = useState(false);
  const [signaturePreparation, setSignaturePreparation] = useState<Awaited<ReturnType<typeof prepareConsentSignature>> | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidPassword, setVoidPassword] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const consents = usePatientConsents(id, status || undefined);
  const templates = useConsentTemplates({ status: "PUBLISHED" });
  const mutations = useDocumentsMutations();
  const selected = useMemo(
    () => consents.data?.find((consent) => consent.id === selectedId) ?? null,
    [consents.data, selectedId]
  );
  const evidence = useConsentEvidence(showEvidence ? selectedId : "");
  const audit = useConsentAudit(showAudit ? selectedId : "");

  useEffect(() => {
    if (!selected) return;
    const editableKeys = new Set(selected.manualFields.map((field) => field.key));
    setFieldValues(
      Object.fromEntries(
        Object.entries(selected.mergedValuesJson ?? {}).filter(([key]) => editableKeys.has(key) || key.startsWith("representative."))
      )
    );
  }, [selected?.id, selected?.version]);

  const generate = () => {
    if (!templateId) return;
    mutations.createPatientConsent.mutate(
      {
        patientId: id,
        templateId,
        treatmentPlanId: treatmentPlanId || undefined,
        appointmentId: appointmentId || undefined
      },
      {
        onSuccess: (created) => {
          setSelectedId(created.id);
          setTemplateId("");
          setTreatmentPlanId("");
          setAppointmentId("");
        }
      }
    );
  };

  const openSignature = async (type: SignerType) => {
    if (!selected) return;
    const prepared = await prepareConsentSignature(selected.id);
    setSignerType(type);
    setSignerName("");
    setAcceptanceChecked(false);
    setSignaturePreparation(prepared);
  };

  const saveSignature = (signatureDataUrl: string) => {
    if (!selected || !signaturePreparation || !acceptanceChecked || signerName.trim().length < 2) return;
    mutations.addConsentSignature.mutate(
      {
        consentId: selected.id,
        payload: {
          signerType,
          signerName: signerName.trim(),
          signatureMethod: "DRAWN",
          signatureDataUrl,
          documentHash: signaturePreparation.documentHash,
          acceptanceText: signaturePreparation.acceptanceText,
          acceptanceTextVersion: signaturePreparation.acceptanceTextVersion,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      },
      { onSuccess: () => setSignaturePreparation(null) }
    );
  };

  if (consents.isLoading || templates.isLoading) return <LoadingState message="Cargando consentimientos…" />;
  if (consents.isError) return <ErrorState message={consents.error.message} />;
  if (templates.isError) return <ErrorState message={templates.error.message} />;

  return (
    <ClinicalShell
      patientId={id}
      title="Consentimientos informados"
      description="Generación, firma y evidencia inmutable del expediente clínico."
    >
      <Card className="space-y-[var(--space-4)]">
        <div className="flex items-start gap-[var(--space-3)]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
            <FilePlus2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-[var(--text-brand-strong)]">Generar consentimiento</h3>
            <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Se utilizará una versión publicada específica; los datos quedan congelados al firmar.</p>
          </div>
        </div>
        <div className="grid gap-[var(--space-3)] lg:grid-cols-[minmax(280px,1fr)_220px_220px_auto]">
          <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)} aria-label="Plantilla publicada">
            <option value="">Selecciona plantilla publicada</option>
            {templates.data?.items.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · v{template.currentPublishedVersion?.versionNumber}
              </option>
            ))}
          </Select>
          <Input
            placeholder="ID tratamiento (opcional)"
            value={treatmentPlanId}
            onChange={(event) => setTreatmentPlanId(event.target.value)}
            aria-label="ID de tratamiento"
          />
          <Input
            placeholder="ID cita (opcional)"
            value={appointmentId}
            onChange={(event) => setAppointmentId(event.target.value)}
            aria-label="ID de cita"
          />
          <Button disabled={!templateId || mutations.createPatientConsent.isPending} onClick={generate}>
            <Plus className="h-4 w-4" />
            Generar
          </Button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-[var(--space-3)] md:grid-cols-[280px_1fr]">
          <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <p className="self-center text-[var(--text-sm)] text-[var(--text-secondary)]">{consents.data?.length ?? 0} documentos en el historial</p>
        </div>
      </Card>

      {!consents.data?.length ? (
        <EmptyState title="Sin consentimientos" description="Todavía no hay consentimientos clínicos para este paciente." />
      ) : (
        <div className="grid gap-[var(--space-3)] xl:grid-cols-[minmax(360px,0.8fr)_minmax(560px,1.2fr)]">
          <Card className="space-y-[var(--space-2)]">
            {consents.data.map((consent) => (
              <button
                key={consent.id}
                type="button"
                onClick={() => setSelectedId(consent.id)}
                className={`w-full rounded-[var(--radius-md)] border p-[var(--space-3)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  selectedId === consent.id
                    ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)]"
                    : "border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <div className="flex items-start justify-between gap-[var(--space-2)]">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{consent.template.name}</p>
                    <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">
                      v{consent.templateVersion.versionNumber} · {new Date(consent.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={consent.status} />
                </div>
                <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
                  <Fingerprint className="h-3.5 w-3.5" />
                  <span className="truncate">{consent.documentHash}</span>
                </div>
              </button>
            ))}
          </Card>

          {selected ? (
            <ConsentDetail
              consent={selected}
              fieldValues={fieldValues}
              setFieldValues={setFieldValues}
              onSaveFields={() =>
                mutations.updateConsentFields.mutate({
                  consentId: selected.id,
                  values: fieldValues,
                  expectedVersion: selected.version
                })
              }
              onSign={openSignature}
              onFinalize={() =>
                mutations.finalizeConsent.mutate({
                  consentId: selected.id,
                  expectedVersion: selected.version,
                  documentHash: selected.documentHash
                })
              }
              onDownload={() =>
                mutations.downloadConsentPdf.mutate({
                  consentId: selected.id,
                  fileName: `consentimiento-${selected.id}.pdf`
                })
              }
              onEvidence={() => setShowEvidence(true)}
              onAudit={() => setShowAudit(true)}
              onVoid={() => setVoidReason("El consentimiento contiene información que requiere corrección: ")}
              onCorrection={() =>
                mutations.createPatientConsent.mutate({
                  patientId: id,
                  templateId: selected.templateId,
                  treatmentPlanId: selected.treatmentPlanId ?? undefined,
                  appointmentId: selected.appointmentId ?? undefined,
                  supersedesConsentId: selected.id
                })
              }
            />
          ) : (
            <EmptyState title="Selecciona un consentimiento" description="Consulta el documento, sus firmas y la evidencia clínica." />
          )}
        </div>
      )}

      <Modal open={Boolean(signaturePreparation)} title={`Firma · ${signerLabel(signerType)}`} size="lg" onClose={() => setSignaturePreparation(null)}>
        <div className="space-y-[var(--space-4)]">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] p-[var(--space-3)]">
            <p className="text-[var(--text-sm)] text-[var(--text-brand-strong)]">La firma se vinculará al hash:</p>
            <code className="mt-1 block break-all text-[var(--text-xs)] text-[var(--text-primary)]">{signaturePreparation?.documentHash}</code>
          </div>
          <label className="space-y-[var(--space-1)]">
            <span className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Nombre mostrado al firmar</span>
            <Input value={signerName} onChange={(event) => setSignerName(event.target.value)} maxLength={150} />
          </label>
          <label className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)]">
            <input
              type="checkbox"
              checked={acceptanceChecked}
              onChange={(event) => setAcceptanceChecked(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--action-brand)]"
            />
            <span className="text-[var(--text-sm)] text-[var(--text-primary)]">{signaturePreparation?.acceptanceText}</span>
          </label>
          <div className={!acceptanceChecked || signerName.trim().length < 2 ? "pointer-events-none opacity-40" : ""}>
            <SignaturePad onSave={saveSignature} />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(voidReason)}
        title="Anular consentimiento"
        onClose={() => {
          setVoidReason("");
          setVoidPassword("");
        }}
      >
        <div className="space-y-[var(--space-4)]">
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">El documento y sus firmas no se eliminan. Se registrará motivo, actor, fecha y correlación.</p>
          <Textarea rows={5} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña actual para confirmar"
            value={voidPassword}
            onChange={(event) => setVoidPassword(event.target.value)}
          />
          <div className="flex justify-end gap-[var(--space-2)]">
            <Button
              variant="ghost"
              onClick={() => {
                setVoidReason("");
                setVoidPassword("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!selected || voidReason.trim().length < 10 || voidPassword.length < 8}
              onClick={() => {
                if (!selected) return;
                mutations.voidConsent.mutate(
                  {
                    consentId: selected.id,
                    expectedVersion: selected.version,
                    reason: voidReason.trim(),
                    currentPassword: voidPassword
                  },
                  {
                    onSuccess: () => {
                      setVoidReason("");
                      setVoidPassword("");
                    }
                  }
                );
              }}
            >
              <Ban className="h-4 w-4" />
              Anular
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showEvidence} title="Evidencia del consentimiento" size="lg" onClose={() => setShowEvidence(false)}>
        {evidence.isLoading ? <LoadingState message="Cargando evidencia…" /> : null}
        {evidence.data ? (
          <div className="space-y-[var(--space-4)]">
            <EvidenceRow label="Hash del documento" value={evidence.data.documentHash} mono />
            <EvidenceRow label="Versión de plantilla" value={`v${evidence.data.templateVersionNumber}`} />
            <EvidenceRow label="Checksum PDF" value={evidence.data.pdfChecksum ?? "Pendiente"} mono />
            <div>
              <p className="mb-[var(--space-2)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Firmas</p>
              <pre className="max-h-80 overflow-auto rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-[var(--space-3)] text-[var(--text-xs)] text-[var(--text-primary)]">
                {JSON.stringify(evidence.data.signatures, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={showAudit} title="Trazabilidad del consentimiento" size="lg" onClose={() => setShowAudit(false)}>
        {audit.isLoading ? <LoadingState message="Cargando trazabilidad…" /> : null}
        <div className="space-y-[var(--space-2)]">
          {audit.data?.map((entry) => (
            <div key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)]">
              <div className="flex justify-between gap-[var(--space-3)]">
                <p className="font-medium text-[var(--text-primary)]">{entry.action}</p>
                <time className="text-[var(--text-xs)] text-[var(--text-secondary)]">{new Date(entry.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">Actor: {entry.actorUserId ?? "Sistema"} · Sucursal: {entry.branchId ?? "—"}</p>
              {entry.reason ? <p className="mt-2 text-[var(--text-sm)] text-[var(--text-primary)]">{entry.reason}</p> : null}
            </div>
          ))}
        </div>
      </Modal>
    </ClinicalShell>
  );
}

function ConsentDetail({
  consent,
  fieldValues,
  setFieldValues,
  onSaveFields,
  onSign,
  onFinalize,
  onDownload,
  onEvidence,
  onAudit,
  onVoid,
  onCorrection
}: {
  consent: Consent;
  fieldValues: Record<string, unknown>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onSaveFields: () => void;
  onSign: (type: SignerType) => void;
  onFinalize: () => void;
  onDownload: () => void;
  onEvidence: () => void;
  onAudit: () => void;
  onVoid: () => void;
  onCorrection: () => void;
}) {
  const immutable = ["SIGNED", "VOIDED", "EXPIRED", "CANCELLED"].includes(consent.status) || consent.signatures.length > 0;
  const signedTypes = new Set(consent.signatures.map((signature) => signature.signerType));
  const enabledTypes: SignerType[] = [
    consent.requiredSigners.patient.enabled ? "PATIENT" : null,
    consent.requiredSigners.professional.enabled ? "PROFESSIONAL" : null,
    consent.requiredSigners.representative.enabled ? "REPRESENTATIVE" : null
  ].filter(Boolean) as SignerType[];

  return (
    <Card className="space-y-[var(--space-5)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div>
          <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">{consent.template.name}</h3>
          <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">Versión inmutable v{consent.templateVersion.versionNumber} · ID {consent.id}</p>
        </div>
        <StatusBadge status={consent.status} />
      </div>

      {consent.manualFields.length ? (
        <section className="space-y-[var(--space-3)]">
          <div>
            <h4 className="font-medium text-[var(--text-primary)]">Datos de esta instancia</h4>
            <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{immutable ? "Bloqueados por firma o estado final." : "Estos cambios no modifican la plantilla original."}</p>
          </div>
          <div className="grid gap-[var(--space-3)] md:grid-cols-2">
            {consent.manualFields.map((field) => (
              <label key={field.key} className={field.config.multiline ? "md:col-span-2" : ""}>
                <span className="mb-1 block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  {field.label}{field.required ? " *" : ""}
                </span>
                {field.config.multiline ? (
                  <Textarea
                    rows={3}
                    disabled={immutable || field.config.editable === false}
                    value={String(fieldValues[field.key] ?? field.config.defaultValue ?? "")}
                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    maxLength={Number(field.config.maxLength) || undefined}
                  />
                ) : (
                  <Input
                    type={field.kind === "DATE" ? "date" : "text"}
                    disabled={immutable || field.config.editable === false}
                    value={String(fieldValues[field.key] ?? field.config.defaultValue ?? "")}
                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    maxLength={Number(field.config.maxLength) || undefined}
                  />
                )}
                {field.config.helpText ? <span className="mt-1 block text-[var(--text-xs)] text-[var(--text-secondary)]">{String(field.config.helpText)}</span> : null}
              </label>
            ))}
          </div>
          {!immutable ? <Button variant="secondary" onClick={onSaveFields}>Guardar datos</Button> : null}
        </section>
      ) : null}

      <section>
        <div className="mb-[var(--space-2)] flex items-center justify-between">
          <h4 className="font-medium text-[var(--text-primary)]">Documento congelado</h4>
          <span className="flex items-center gap-1 text-[var(--text-xs)] text-[var(--text-secondary)]"><Fingerprint className="h-3.5 w-3.5" /> SHA-256</span>
        </div>
        <div className="max-h-[640px] overflow-auto rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] p-[var(--space-3)]">
          <SafeHtml html={consent.renderedHtmlSnapshot} />
        </div>
        <code className="mt-[var(--space-2)] block break-all rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">{consent.documentHash}</code>
      </section>

      <section className="space-y-[var(--space-3)]">
        <h4 className="font-medium text-[var(--text-primary)]">Firmas</h4>
        <div className="grid gap-[var(--space-2)] sm:grid-cols-2 lg:grid-cols-3">
          {enabledTypes.map((type) => (
            <div key={type} className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">{signerLabel(type)}</p>
                {signedTypes.has(type) ? <CheckCircle2 className="h-4 w-4 text-[var(--text-success)]" /> : <PenLine className="h-4 w-4 text-[var(--text-secondary)]" />}
              </div>
              {signedTypes.has(type) ? (
                <p className="mt-2 text-[var(--text-xs)] text-[var(--text-secondary)]">
                  {new Date(consent.signatures.find((signature) => signature.signerType === type)!.signedAt).toLocaleString()}
                </p>
              ) : !["SIGNED", "VOIDED", "EXPIRED", "CANCELLED"].includes(consent.status) ? (
                <Button size="sm" variant="secondary" className="mt-[var(--space-3)] w-full" onClick={() => onSign(type)}>
                  Firmar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-4)]">
        {consent.missingRequiredSigners.length === 0 && consent.status === "PARTIALLY_SIGNED" ? (
          <Button onClick={onFinalize}><FileCheck2 className="h-4 w-4" /> Finalizar y generar PDF</Button>
        ) : null}
        {consent.status === "SIGNED" ? <Button onClick={onDownload}><Download className="h-4 w-4" /> Descargar PDF</Button> : null}
        <Button variant="secondary" onClick={onEvidence}><ShieldCheck className="h-4 w-4" /> Ver evidencia</Button>
        <Button variant="secondary" onClick={onAudit}><History className="h-4 w-4" /> Auditoría</Button>
        {!["VOIDED", "EXPIRED", "CANCELLED"].includes(consent.status) ? <Button variant="danger" onClick={onVoid}><Ban className="h-4 w-4" /> Anular</Button> : null}
        {consent.status === "VOIDED" || consent.status === "SIGNED" ? <Button variant="secondary" onClick={onCorrection}><FilePlus2 className="h-4 w-4" /> Crear corrección</Button> : null}
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: Consent["status"] }) {
  const tone = status === "SIGNED" ? "success" : status === "VOIDED" || status === "CANCELLED" ? "danger" : status === "PARTIALLY_SIGNED" ? "brand" : "warning";
  return <Badge value={STATUS_LABELS[status]} tone={tone} />;
}

function signerLabel(type: SignerType) {
  return type === "PATIENT" ? "Paciente" : type === "PROFESSIONAL" ? "Profesional" : "Representante";
}

function EvidenceRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-1 break-all text-[var(--text-sm)] text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
