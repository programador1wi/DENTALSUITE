import { FormEvent, useState } from "react";
import {
  Bot,
  CheckCircle,
  ClipboardCheck,
  Mail,
  MessageSquare,
  Play,
  Send,
  Upload,
  Video,
  Webhook
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  useAiRequests,
  useChatMessages,
  useCommunicationJobs,
  useDocumentRequirements,
  useImportJobs,
  useIntegrationMutations,
  usePaymentWebhookEvents,
  useSurveys,
  useTelemedicineSessions
} from "../hooks/use-integrations";
import type {
  AiRequest,
  AiRequestStatus,
  AiUseCase,
  ChatMessage,
  CommunicationChannel,
  CommunicationJob,
  CommunicationJobStatus,
  DocumentRequirement,
  DocumentRequirementScope,
  DocumentRequirementStatus,
  ImportJob,
  ImportJobStatus,
  ImportJobType,
  PaymentWebhookEvent,
  Survey,
  SurveyStatus,
  SurveyType,
  TelemedicineSession,
  TelemedicineSessionStatus
} from "../services/integrations.service";

type TabKey =
  | "communications"
  | "surveys"
  | "documents"
  | "imports"
  | "telemedicine"
  | "chat"
  | "webhooks"
  | "ai";

const TABS = [
  { key: "communications", label: "Comunicaciones" },
  { key: "surveys", label: "Encuestas" },
  { key: "documents", label: "Requisitos" },
  { key: "imports", label: "Importaciones" },
  { key: "telemedicine", label: "Telemedicina" },
  { key: "chat", label: "Chat" },
  { key: "webhooks", label: "Webhooks" },
  { key: "ai", label: "IA" }
];

const CHANNEL_OPTIONS: CommunicationChannel[] = ["EMAIL", "WHATSAPP", "SMS", "PHONE", "INTERNAL"];
const COMMUNICATION_STATUS_OPTIONS: CommunicationJobStatus[] = ["PENDING", "QUEUED", "SENT", "FAILED", "CANCELLED"];
const SURVEY_TYPES: SurveyType[] = ["SATISFACTION", "NPS", "CUSTOM"];
const SURVEY_STATUSES: SurveyStatus[] = ["DRAFT", "SCHEDULED", "SENT", "COMPLETED", "CANCELLED"];
const REQUIREMENT_SCOPES: DocumentRequirementScope[] = ["PATIENT", "TREATMENT_PLAN", "PROCEDURE"];
const REQUIREMENT_STATUSES: DocumentRequirementStatus[] = ["PENDING", "SATISFIED", "WAIVED", "CANCELLED"];
const IMPORT_TYPES: ImportJobType[] = ["PATIENTS", "PROCEDURES", "INVENTORY", "PAYMENTS", "CUSTOM"];
const IMPORT_STATUSES: ImportJobStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];
const TELEMEDICINE_STATUSES: TelemedicineSessionStatus[] = ["SCHEDULED", "STARTED", "COMPLETED", "CANCELLED"];
const AI_USE_CASES: AiUseCase[] = ["RADIOGRAPHY", "CLINICAL_NOTE", "REPORT", "CRM", "CONTROL", "SMILE_SIMULATOR"];
const AI_STATUSES: AiRequestStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];

export function IntegrationsPage({ initialTab = "communications" }: { initialTab?: TabKey }) {
  const [active, setActive] = useState<TabKey>(initialTab);

  return (
    <div className="space-y-4">
      <PageHeader title="CRM operativo" description="Comunicaciones, documentos, importaciones, telemedicina, webhooks e IA." />
      <div className="overflow-x-auto pb-1">
        <Tabs items={TABS} active={active} onChange={(key) => setActive(key as TabKey)} />
      </div>
      {active === "communications" && <CommunicationsPanel />}
      {active === "surveys" && <SurveysPanel />}
      {active === "documents" && <DocumentRequirementsPanel />}
      {active === "imports" && <ImportsPanel />}
      {active === "telemedicine" && <TelemedicinePanel />}
      {active === "chat" && <ChatPanel />}
      {active === "webhooks" && <WebhooksPanel />}
      {active === "ai" && <AiPanel />}
    </div>
  );
}

function CommunicationsPanel() {
  const [status, setStatus] = useState<CommunicationJobStatus | "">("");
  const [channelFilter, setChannelFilter] = useState<CommunicationChannel | "">("");
  const [form, setForm] = useState({
    channel: "EMAIL" as CommunicationChannel,
    recipient: "",
    subject: "",
    body: "",
    patientId: "",
    appointmentId: "",
    paymentId: "",
    scheduledAt: ""
  });
  const query = useCommunicationJobs({
    status: status || undefined,
    channel: channelFilter || undefined
  });
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.recipient.trim() || !form.body.trim()) return;
    mutations.createCommunicationJob.mutate({
      channel: form.channel,
      recipient: form.recipient.trim(),
      subject: form.subject.trim() || undefined,
      body: form.body.trim(),
      patientId: form.patientId.trim() || undefined,
      appointmentId: form.appointmentId.trim() || undefined,
      paymentId: form.paymentId.trim() || undefined,
      scheduledAt: form.scheduledAt || undefined
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Mail className="h-4 w-4" />} title="Cola multicanal" />
      <Card>
        <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
          <Select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as CommunicationChannel })}>
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} placeholder="destino" />
          <Input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="asunto" />
          <Input value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} placeholder="patientId" />
          <Input value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} type="datetime-local" />
          <Button type="submit" disabled={mutations.createCommunicationJob.isPending}>
            <Send className="h-4 w-4" />
            Crear
          </Button>
          <Input value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })} placeholder="appointmentId" />
          <Input value={form.paymentId} onChange={(event) => setForm({ ...form, paymentId: event.target.value })} placeholder="paymentId" />
          <Textarea
            className="lg:col-span-4"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            placeholder="mensaje"
          />
        </form>
      </Card>
      <FilterBar>
        <Select value={status} onChange={(event) => setStatus((event.target.value as CommunicationJobStatus) || "")}>
          <option value="">Todos los estados</option>
          {COMMUNICATION_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Select value={channelFilter} onChange={(event) => setChannelFilter((event.target.value as CommunicationChannel) || "")}>
          <option value="">Todos los canales</option>
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin comunicaciones"
        emptyDescription="No hay jobs para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "channel", title: "Canal", render: (row: CommunicationJob) => <Badge value={row.channel} tone="brand" /> },
          { key: "status", title: "Estado", render: (row: CommunicationJob) => <StatusBadge value={row.status} /> },
          { key: "recipient", title: "Destino", render: (row: CommunicationJob) => row.recipient, wrap: true },
          { key: "patient", title: "Paciente", render: (row: CommunicationJob) => patientName(row.patient) },
          { key: "createdAt", title: "Creado", render: (row: CommunicationJob) => formatDate(row.createdAt) },
          {
            key: "id",
            title: "Acciones",
            render: (row: CommunicationJob) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  disabled={row.status !== "PENDING" && row.status !== "FAILED"}
                  onClick={() => mutations.queueCommunicationJob.mutate(row.id)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Encolar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={row.status === "SENT"}
                  onClick={() => mutations.recordMessageDelivery.mutate({ id: row.id, status: "DELIVERED" })}
                >
                  Entregado
                </Button>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}

function SurveysPanel() {
  const [status, setStatus] = useState<SurveyStatus | "">("");
  const [type, setType] = useState<SurveyType | "">("");
  const [form, setForm] = useState({
    type: "NPS" as SurveyType,
    channel: "EMAIL" as CommunicationChannel,
    title: "",
    patientId: "",
    appointmentId: "",
    scheduledAt: ""
  });
  const query = useSurveys({ status: status || undefined, type: type || undefined });
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    mutations.createSurvey.mutate({
      type: form.type,
      channel: form.channel,
      title: form.title.trim(),
      patientId: form.patientId.trim() || undefined,
      appointmentId: form.appointmentId.trim() || undefined,
      scheduledAt: form.scheduledAt || undefined
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<ClipboardCheck className="h-4 w-4" />} title="Encuestas y NPS" />
      <Card>
        <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SurveyType })}>
            {SURVEY_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as CommunicationChannel })}>
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="titulo" />
          <Input value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} placeholder="patientId" />
          <Input value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })} placeholder="appointmentId" />
          <Button type="submit" disabled={mutations.createSurvey.isPending}>
            Crear
          </Button>
          <Input
            className="lg:col-span-2"
            value={form.scheduledAt}
            onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
            type="datetime-local"
          />
        </form>
      </Card>
      <FilterBar>
        <Select value={status} onChange={(event) => setStatus((event.target.value as SurveyStatus) || "")}>
          <option value="">Todos los estados</option>
          {SURVEY_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(event) => setType((event.target.value as SurveyType) || "")}>
          <option value="">Todos los tipos</option>
          {SURVEY_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin encuestas"
        emptyDescription="No hay encuestas para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "type", title: "Tipo", render: (row: Survey) => <Badge value={row.type} tone="brand" /> },
          { key: "status", title: "Estado", render: (row: Survey) => <StatusBadge value={row.status} /> },
          { key: "title", title: "Titulo", render: (row: Survey) => row.title, wrap: true },
          { key: "patient", title: "Paciente", render: (row: Survey) => patientName(row.patient) },
          { key: "score", title: "Score", render: (row: Survey) => String(row.score ?? "-") },
          {
            key: "id",
            title: "Acciones",
            render: (row: Survey) => (
              <Button size="sm" variant="secondary" type="button" onClick={() => mutations.sendSurvey.mutate(row.id)}>
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
            )
          }
        ]}
      />
    </div>
  );
}

function DocumentRequirementsPanel() {
  const [status, setStatus] = useState<DocumentRequirementStatus | "">("");
  const [form, setForm] = useState({
    name: "",
    scope: "PATIENT" as DocumentRequirementScope,
    patientId: "",
    treatmentPlanId: "",
    procedureId: "",
    requiredBefore: "",
    dueAt: ""
  });
  const [action, setAction] = useState({ id: "", evidenceKind: "fileAttachmentId", evidenceId: "", reason: "" });
  const query = useDocumentRequirements({ status: status || undefined });
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    mutations.createDocumentRequirement.mutate({
      name: form.name.trim(),
      scope: form.scope,
      patientId: form.patientId.trim() || undefined,
      treatmentPlanId: form.treatmentPlanId.trim() || undefined,
      procedureId: form.procedureId.trim() || undefined,
      requiredBefore: form.requiredBefore.trim() || undefined,
      dueAt: form.dueAt || undefined
    });
  };

  const satisfy = () => {
    if (!action.id || !action.evidenceId.trim()) return;
    mutations.satisfyDocumentRequirement.mutate({
      id: action.id,
      payload: { [action.evidenceKind]: action.evidenceId.trim() }
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<CheckCircle className="h-4 w-4" />} title="Requisitos documentales" />
      <Card>
        <form className="grid gap-3 lg:grid-cols-7" onSubmit={submit}>
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="nombre" />
          <Select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as DocumentRequirementScope })}>
            {REQUIREMENT_SCOPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} placeholder="patientId" />
          <Input value={form.treatmentPlanId} onChange={(event) => setForm({ ...form, treatmentPlanId: event.target.value })} placeholder="treatmentPlanId" />
          <Input value={form.procedureId} onChange={(event) => setForm({ ...form, procedureId: event.target.value })} placeholder="procedureId" />
          <Input value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} type="datetime-local" />
          <Button type="submit" disabled={mutations.createDocumentRequirement.isPending}>
            Crear
          </Button>
          <Input
            className="lg:col-span-2"
            value={form.requiredBefore}
            onChange={(event) => setForm({ ...form, requiredBefore: event.target.value })}
            placeholder="requiredBefore"
          />
        </form>
      </Card>
      <FilterBar>
        <Select value={status} onChange={(event) => setStatus((event.target.value as DocumentRequirementStatus) || "")}>
          <option value="">Todos los estados</option>
          {REQUIREMENT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Input value={action.id} onChange={(event) => setAction({ ...action, id: event.target.value })} placeholder="requirementId" />
        <Select value={action.evidenceKind} onChange={(event) => setAction({ ...action, evidenceKind: event.target.value })}>
          <option value="fileAttachmentId">fileAttachmentId</option>
          <option value="clinicalDocumentId">clinicalDocumentId</option>
          <option value="consentId">consentId</option>
        </Select>
        <Input value={action.evidenceId} onChange={(event) => setAction({ ...action, evidenceId: event.target.value })} placeholder="evidenceId" />
        <Button type="button" variant="secondary" onClick={satisfy}>
          Satisfacer
        </Button>
        <Input value={action.reason} onChange={(event) => setAction({ ...action, reason: event.target.value })} placeholder="motivo dispensa" />
        <Button type="button" variant="ghost" onClick={() => action.id && mutations.waiveDocumentRequirement.mutate({ id: action.id, reason: action.reason })}>
          Dispensar
        </Button>
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin requisitos"
        emptyDescription="No hay requisitos para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "name", title: "Nombre", render: (row: DocumentRequirement) => row.name, wrap: true },
          { key: "scope", title: "Alcance", render: (row: DocumentRequirement) => <Badge value={row.scope} tone="brand" /> },
          { key: "status", title: "Estado", render: (row: DocumentRequirement) => <StatusBadge value={row.status} /> },
          { key: "patient", title: "Paciente", render: (row: DocumentRequirement) => patientName(row.patient) },
          { key: "dueAt", title: "Vence", render: (row: DocumentRequirement) => formatDate(row.dueAt) },
          {
            key: "id",
            title: "ID",
            render: (row: DocumentRequirement) => (
              <button className="text-[12px] text-[var(--text-brand)]" type="button" onClick={() => setAction({ ...action, id: row.id })}>
                {shortId(row.id)}
              </button>
            )
          }
        ]}
      />
    </div>
  );
}

function ImportsPanel() {
  const [status, setStatus] = useState<ImportJobStatus | "">("");
  const [type, setType] = useState<ImportJobType | "">("");
  const [form, setForm] = useState({ type: "PATIENTS" as ImportJobType, fileName: "" });
  const query = useImportJobs({ status: status || undefined, type: type || undefined });
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutations.createImportJob.mutate({ type: form.type, fileName: form.fileName.trim() || undefined });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Upload className="h-4 w-4" />} title="Importaciones" />
      <Card>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ImportJobType })}>
            {IMPORT_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} placeholder="archivo" />
          <Button type="submit" disabled={mutations.createImportJob.isPending}>
            Crear job
          </Button>
        </form>
      </Card>
      <FilterBar>
        <Select value={status} onChange={(event) => setStatus((event.target.value as ImportJobStatus) || "")}>
          <option value="">Todos los estados</option>
          {IMPORT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(event) => setType((event.target.value as ImportJobType) || "")}>
          <option value="">Todos los tipos</option>
          {IMPORT_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin importaciones"
        emptyDescription="No hay jobs para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "type", title: "Tipo", render: (row: ImportJob) => <Badge value={row.type} tone="brand" /> },
          { key: "status", title: "Estado", render: (row: ImportJob) => <StatusBadge value={row.status} /> },
          { key: "fileName", title: "Archivo", render: (row: ImportJob) => row.fileName ?? "-" },
          { key: "totalRows", title: "Filas", render: (row: ImportJob) => `${row.successRows}/${row.totalRows}` },
          {
            key: "id",
            title: "Acciones",
            render: (row: ImportJob) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => mutations.updateImportJob.mutate({ id: row.id, payload: { status: "PROCESSING" } })}>
                  Procesar
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => mutations.updateImportJob.mutate({ id: row.id, payload: { status: "COMPLETED" } })}>
                  Completar
                </Button>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}

function TelemedicinePanel() {
  const [status, setStatus] = useState<TelemedicineSessionStatus | "">("");
  const [form, setForm] = useState({
    patientId: "",
    appointmentId: "",
    professionalId: "",
    startsAt: "",
    provider: "manual",
    joinUrl: ""
  });
  const query = useTelemedicineSessions({ status: status || undefined });
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.patientId.trim() || !form.startsAt) return;
    mutations.createTelemedicineSession.mutate({
      patientId: form.patientId.trim(),
      appointmentId: form.appointmentId.trim() || undefined,
      professionalId: form.professionalId.trim() || undefined,
      startsAt: form.startsAt,
      provider: form.provider.trim() || undefined,
      joinUrl: form.joinUrl.trim() || undefined
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Video className="h-4 w-4" />} title="Telemedicina" />
      <Card>
        <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
          <Input value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} placeholder="patientId" />
          <Input value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })} placeholder="appointmentId" />
          <Input value={form.professionalId} onChange={(event) => setForm({ ...form, professionalId: event.target.value })} placeholder="professionalId" />
          <Input value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} type="datetime-local" />
          <Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} placeholder="provider" />
          <Button type="submit" disabled={mutations.createTelemedicineSession.isPending}>
            Crear
          </Button>
          <Input className="lg:col-span-3" value={form.joinUrl} onChange={(event) => setForm({ ...form, joinUrl: event.target.value })} placeholder="joinUrl" />
        </form>
      </Card>
      <FilterBar>
        <Select value={status} onChange={(event) => setStatus((event.target.value as TelemedicineSessionStatus) || "")}>
          <option value="">Todos los estados</option>
          {TELEMEDICINE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin sesiones"
        emptyDescription="No hay sesiones para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "status", title: "Estado", render: (row: TelemedicineSession) => <StatusBadge value={row.status} /> },
          { key: "patient", title: "Paciente", render: (row: TelemedicineSession) => patientName(row.patient) },
          { key: "provider", title: "Provider", render: (row: TelemedicineSession) => row.provider },
          { key: "startsAt", title: "Inicio", render: (row: TelemedicineSession) => formatDate(row.startsAt) },
          {
            key: "id",
            title: "Acciones",
            render: (row: TelemedicineSession) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => mutations.updateTelemedicineStatus.mutate({ id: row.id, status: "STARTED" })}>
                  Iniciar
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => mutations.updateTelemedicineStatus.mutate({ id: row.id, status: "COMPLETED" })}>
                  Cerrar
                </Button>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}

function ChatPanel() {
  const [form, setForm] = useState({ body: "", patientId: "", threadKey: "" });
  const query = useChatMessages();
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.body.trim()) return;
    mutations.createChatMessage.mutate({
      body: form.body.trim(),
      patientId: form.patientId.trim() || undefined,
      threadKey: form.threadKey.trim() || undefined
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<MessageSquare className="h-4 w-4" />} title="Chat interno" />
      <Card>
        <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
          <Input value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} placeholder="patientId" />
          <Input value={form.threadKey} onChange={(event) => setForm({ ...form, threadKey: event.target.value })} placeholder="threadKey" />
          <Textarea className="lg:col-span-3" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="mensaje" />
          <Button type="submit" disabled={mutations.createChatMessage.isPending}>
            Enviar
          </Button>
        </form>
      </Card>
      <QueryTable
        query={query}
        emptyTitle="Sin mensajes"
        emptyDescription="No hay mensajes internos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "threadKey", title: "Thread", render: (row: ChatMessage) => row.threadKey ?? "-" },
          { key: "body", title: "Mensaje", render: (row: ChatMessage) => row.body, wrap: true },
          { key: "patient", title: "Paciente", render: (row: ChatMessage) => patientName(row.patient) },
          { key: "senderUser", title: "Usuario", render: (row: ChatMessage) => `${row.senderUser.firstName} ${row.senderUser.lastName}` },
          { key: "createdAt", title: "Fecha", render: (row: ChatMessage) => formatDate(row.createdAt) }
        ]}
      />
    </div>
  );
}

function WebhooksPanel() {
  const [provider, setProvider] = useState("");
  const [paymentLinkId, setPaymentLinkId] = useState("");
  const query = usePaymentWebhookEvents({ provider: provider || undefined, paymentLinkId: paymentLinkId || undefined });

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Webhook className="h-4 w-4" />} title="Webhooks de pago" />
      <FilterBar>
        <Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="provider" />
        <Input value={paymentLinkId} onChange={(event) => setPaymentLinkId(event.target.value)} placeholder="paymentLinkId" />
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin webhooks"
        emptyDescription="No hay eventos para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "provider", title: "Provider", render: (row: PaymentWebhookEvent) => row.provider },
          { key: "eventType", title: "Evento", render: (row: PaymentWebhookEvent) => row.eventType },
          { key: "status", title: "Estado", render: (row: PaymentWebhookEvent) => <StatusBadge value={row.status} /> },
          { key: "idempotencyKey", title: "Idempotencia", render: (row: PaymentWebhookEvent) => row.idempotencyKey, wrap: true },
          { key: "receivedAt", title: "Recibido", render: (row: PaymentWebhookEvent) => formatDate(row.receivedAt) }
        ]}
      />
    </div>
  );
}

function AiPanel() {
  const [status, setStatus] = useState<AiRequestStatus | "">("");
  const [useCase, setUseCase] = useState<AiUseCase | "">("");
  const [form, setForm] = useState({ useCase: "CLINICAL_NOTE" as AiUseCase, provider: "manual", patientId: "", prompt: "" });
  const query = useAiRequests({ status: status || undefined, useCase: useCase || undefined });
  const mutations = useIntegrationMutations();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutations.createAiRequest.mutate({
      useCase: form.useCase,
      provider: form.provider.trim() || undefined,
      patientId: form.patientId.trim() || undefined,
      prompt: form.prompt.trim() || undefined
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={<Bot className="h-4 w-4" />} title="Solicitudes IA" />
      <Card>
        <form className="grid gap-3 lg:grid-cols-6" onSubmit={submit}>
          <Select value={form.useCase} onChange={(event) => setForm({ ...form, useCase: event.target.value as AiUseCase })}>
            {AI_USE_CASES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} placeholder="provider" />
          <Input value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} placeholder="patientId" />
          <Textarea className="lg:col-span-2" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="prompt" />
          <Button type="submit" disabled={mutations.createAiRequest.isPending}>
            Solicitar
          </Button>
        </form>
      </Card>
      <FilterBar>
        <Select value={status} onChange={(event) => setStatus((event.target.value as AiRequestStatus) || "")}>
          <option value="">Todos los estados</option>
          {AI_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Select value={useCase} onChange={(event) => setUseCase((event.target.value as AiUseCase) || "")}>
          <option value="">Todos los casos</option>
          {AI_USE_CASES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FilterBar>
      <QueryTable
        query={query}
        emptyTitle="Sin solicitudes IA"
        emptyDescription="No hay solicitudes para los filtros activos."
        rows={query.data?.items ?? []}
        columns={[
          { key: "useCase", title: "Caso", render: (row: AiRequest) => <Badge value={row.useCase} tone="brand" /> },
          { key: "status", title: "Estado", render: (row: AiRequest) => <StatusBadge value={row.status} /> },
          { key: "provider", title: "Provider", render: (row: AiRequest) => row.provider },
          { key: "patient", title: "Paciente", render: (row: AiRequest) => patientName(row.patient) },
          { key: "createdAt", title: "Fecha", render: (row: AiRequest) => formatDate(row.createdAt) }
        ]}
      />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-brand)]">
        {icon}
      </span>
      {title}
    </div>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 md:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

function QueryTable<T extends Record<string, unknown>>({
  query,
  rows,
  columns,
  emptyTitle,
  emptyDescription
}: {
  query: { isLoading: boolean; isError: boolean; error: Error | null };
  rows: T[];
  columns: Parameters<typeof DataTable<T>>[0]["columns"];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (query.isLoading) return <LoadingState message="Cargando..." />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "Error inesperado"} />;
  return <DataTable rows={rows} columns={columns} empty={<EmptyState title={emptyTitle} description={emptyDescription} />} />;
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "COMPLETED" || value === "SENT" || value === "DELIVERED" || value === "SATISFIED" || value === "PROCESSED"
      ? "success"
      : value === "FAILED" || value === "CANCELLED"
        ? "danger"
        : value === "PENDING" || value === "QUEUED" || value === "PROCESSING" || value === "SCHEDULED"
          ? "warning"
          : "default";
  return <Badge value={value} tone={tone} />;
}

function patientName(patient?: { firstName: string; lastName: string } | null) {
  return patient ? `${patient.firstName} ${patient.lastName}` : "-";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
