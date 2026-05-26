import { FormEvent, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSectionPage } from "../components/patient-section-page";
import { useConsentPdf, useConsentTemplates, useDocumentsMutations, usePatientConsents } from "@/features/documents/hooks/use-documents";
import { Modal } from "@/components/ui/modal";
import { SignaturePad } from "@/components/ui/signature-pad";

export function PatientConsentsPage() {
  const { id = "" } = useParams();
  const [status, setStatus] = useState<"" | "DRAFT" | "SIGNED" | "CANCELLED">("");
  const [templateId, setTemplateId] = useState("");
  const [treatmentPlanId, setTreatmentPlanId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [selectedConsentId, setSelectedConsentId] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerType, setSignerType] = useState("PATIENT");
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const consents = usePatientConsents(id, status || undefined);
  const templates = useConsentTemplates(undefined, "true");
  const pdf = useConsentPdf(selectedConsentId);
  const mutations = useDocumentsMutations();

  const selectedConsent = useMemo(
    () => consents.data?.find((consent) => consent.id === selectedConsentId) ?? null,
    [consents.data, selectedConsentId]
  );

  const createConsent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !templateId) return;
    mutations.createPatientConsent.mutate({
      patientId: id,
      templateId,
      treatmentPlanId: treatmentPlanId || undefined,
      appointmentId: appointmentId || undefined
    });
  };

  const handleSignDocument = (base64Data: string) => {
    if (!selectedConsentId || !signerName.trim() || !signerType.trim()) return;
    mutations.signConsent.mutate({
      consentId: selectedConsentId,
      signerName: signerName.trim(),
      signerType: signerType.trim(),
      signatureData: base64Data
    }, {
      onSuccess: () => {
        setIsSignModalOpen(false);
      }
    });
  };

  if (consents.isLoading || templates.isLoading) return <LoadingState message="Cargando consentimientos..." />;
  if (consents.isError) return <ErrorState message={consents.error.message} />;
  if (templates.isError) return <ErrorState message={templates.error.message} />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Consentimientos" description="Consentimientos generados y firmables.">
      <Card>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={createConsent}>
          <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Plantilla</option>
            {templates.data?.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          <Input placeholder="treatmentPlanId (opcional)" value={treatmentPlanId} onChange={(event) => setTreatmentPlanId(event.target.value)} />
          <Input placeholder="appointmentId (opcional)" value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} />
          <Button type="submit" disabled={!templateId || mutations.createPatientConsent.isPending}>
            Generar consentimiento
          </Button>
        </form>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={status} onChange={(event) => setStatus((event.target.value as "" | "DRAFT" | "SIGNED" | "CANCELLED") || "")}>
            <option value="">Todos los estados</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SIGNED">SIGNED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
        </div>
      </Card>

      <DataTable
        rows={consents.data ?? []}
        empty={<EmptyState title="Sin consentimientos" description="No hay consentimientos para este paciente." />}
        columns={[
          { key: "createdAt", title: "Creado", render: (row) => new Date(row.createdAt).toLocaleString() },
          { key: "template", title: "Plantilla", render: (row) => row.template.name },
          { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={row.status === "SIGNED" ? "success" : "warning"} /> },
          { key: "signedAt", title: "Firmado", render: (row) => (row.signedAt ? new Date(row.signedAt).toLocaleString() : "-") },
          {
            key: "id",
            title: "Accion",
            render: (row) => (
              <Button variant="secondary" onClick={() => setSelectedConsentId(row.id)}>
                Ver/Firmar
              </Button>
            )
          }
        ]}
      />

      {selectedConsent ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Consentimiento {selectedConsent.id}</h3>
            <Badge value={selectedConsent.status} tone={selectedConsent.status === "SIGNED" ? "success" : "warning"} />
          </div>

          <Textarea value={selectedConsent.contentSnapshot} readOnly rows={8} />

          {selectedConsent.status !== "SIGNED" && (
            <Button onClick={() => setIsSignModalOpen(true)}>
              Firmar Documento
            </Button>
          )}

          <Modal open={isSignModalOpen} title="Firma de Consentimiento" onClose={() => setIsSignModalOpen(false)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Por favor ingrese el nombre de quien firma y dibuje la firma en el recuadro inferior.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Nombre firmante" value={signerName} onChange={(event) => setSignerName(event.target.value)} />
                <Select value={signerType} onChange={(event) => setSignerType(event.target.value)}>
                  <option value="PATIENT">Paciente</option>
                  <option value="TUTOR">Tutor Legal</option>
                </Select>
              </div>
              <SignaturePad onSave={handleSignDocument} />
            </div>
          </Modal>

          {pdf.data ? (
            <Card>
              <p className="text-xs uppercase text-slate-500">PDF simulado</p>
              <p className="text-sm text-slate-700">{pdf.data.fileName}</p>
              <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700">{pdf.data.printableContent}</pre>
            </Card>
          ) : null}
        </Card>
      ) : null}
    </PatientSectionPage>
  );
}
