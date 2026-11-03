import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileClock,
  Mail,
  MoreVertical,
  Plus,
  Power,
  Search,
  Settings2
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useSpecialties } from "@/features/settings/specialties/hooks/use-specialties";
import { SurveyEditorPage } from "./survey-editor-page";
import {
  activateSurveyDefinition,
  archiveSurveyDefinition,
  createSurveyDefinition,
  deactivateSurveyDefinition,
  duplicateSurveyDefinition,
  exportSurveyResults,
  getSurveyResults,
  listSurveyDefinitions,
  listSurveySendConfigurations,
  updateSurveySendConfiguration,
  type SurveyDefinitionListItem,
  type SurveyDefinitionStatus,
  type SurveyResultsFilters,
  type SurveySendConfiguration,
  type SurveyType
} from "../services/surveys.service";

type TabKey = "list" | "send-config" | "results";

export const surveyPaths = {
  list: "/crm/surveys/list",
  sendConfig: "/crm/surveys/send-config",
  results: "/crm/surveys/results",
  edit: (id: string) => `/crm/surveys/${encodeURIComponent(id)}/edit`
};

const tabs = [
  { key: "list", label: "Encuestas" },
  { key: "send-config", label: "Configuración de envío" },
  { key: "results", label: "Resultados" }
];

function resolveTab(pathname: string): TabKey {
  if (pathname.startsWith(surveyPaths.sendConfig)) return "send-config";
  if (pathname.startsWith(surveyPaths.results)) return "results";
  return "list";
}

export function SurveyManagementPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId?: string }>();
  const active = resolveTab(location.pathname);
  const isEditor = Boolean(surveyId) && location.pathname.endsWith("/edit");

  return (
    <div className="space-y-[var(--space-5)]">
      <PageHeader
        title="Encuestas de satisfacción"
        description="Diseña encuestas versionadas, automatiza invitaciones posteriores a la atención y analiza respuestas reales."
        helpText="Enviado, entregado y respondido son estados independientes. Una versión publicada conserva siempre su contenido histórico."
      />
      <div className="overflow-x-auto pb-1">
        <Tabs
          items={tabs}
          active={active}
          onChange={(key) => {
            if (key === "send-config") navigate(surveyPaths.sendConfig);
            else if (key === "results") navigate(surveyPaths.results);
            else navigate(surveyPaths.list);
          }}
        />
      </div>
      {isEditor && surveyId ? (
        <SurveyEditorPage surveyId={surveyId} />
      ) : active === "send-config" ? (
        <SurveySendConfigurationPanel />
      ) : active === "results" ? (
        <SurveyResultsPanel />
      ) : (
        <SurveyListPanel />
      )}
    </div>
  );
}

function SurveyListPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SurveyDefinitionStatus | "">("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<SurveyDefinitionListItem | null>(null);
  const [history, setHistory] = useState<SurveyDefinitionListItem | null>(null);
  const [npsModal, setNpsModal] = useState(false);
  const query = useQuery({
    queryKey: ["crm-surveys", "list", search, status, page],
    queryFn: () => listSurveyDefinitions({ search: search || undefined, status: status || undefined, page, pageSize: 20 })
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["crm-surveys"] });
  const mutation = useMutation({
    mutationFn: ({ action, id }: { action: "duplicate" | "activate" | "deactivate" | "archive"; id: string }) => {
      if (action === "duplicate") return duplicateSurveyDefinition(id);
      if (action === "activate") return activateSurveyDefinition(id);
      if (action === "deactivate") return deactivateSurveyDefinition(id);
      return archiveSurveyDefinition(id);
    },
    onSuccess: (survey, variables) => {
      invalidate();
      toast.success(
        variables.action === "duplicate"
          ? "Encuesta duplicada"
          : variables.action === "activate"
            ? "Encuesta activada"
            : variables.action === "deactivate"
              ? "Encuesta desactivada"
              : "Encuesta archivada"
      );
      if (variables.action === "duplicate") navigate(surveyPaths.edit(survey.id));
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const createMutation = useMutation({
    mutationFn: ({ type }: { type: SurveyType }) => createSurveyDefinition(type),
    onSuccess: (survey) => {
      invalidate();
      navigate(surveyPaths.edit(survey.id));
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const switchToNps = async () => {
    try {
      const existing = await listSurveyDefinitions({ type: "NPS", pageSize: 100 });
      const target = existing.items.find((item) => item.status !== "ARCHIVED");
      setNpsModal(false);
      if (target) navigate(surveyPaths.edit(target.id));
      else createMutation.mutate({ type: "NPS" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible buscar la encuesta NPS");
    }
  };

  return (
    <>
      <Card className="p-0 hover:translate-y-0">
        <div className="flex flex-col gap-[var(--space-4)] border-b border-[var(--border-default)] p-[var(--space-5)] lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <div className="inline-flex h-[38px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)]">
              <Mail className="h-4 w-4 text-[var(--text-brand)]" />
              Medio activo: <strong className="font-semibold text-[var(--text-primary)]">Email</strong>
            </div>
            <Button variant="secondary" onClick={() => setNpsModal(true)}>
              Cambiar a encuesta NPS
            </Button>
            <Button onClick={() => createMutation.mutate({ type: "SATISFACTION" })} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" /> Nueva encuesta
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-[var(--space-5)] py-[var(--space-3)]">
          <span className="text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Estado</span>
          <Select value={status} onChange={(event) => { setStatus(event.target.value as SurveyDefinitionStatus | ""); setPage(1); }} containerClassName="max-w-[220px]">
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activa</option>
            <option value="INACTIVE">Inactiva</option>
            <option value="ARCHIVED">Archivada</option>
          </Select>
        </div>
        <div className="p-[var(--space-5)]">
          {query.isLoading && <LoadingState message="Cargando encuestas..." />}
          {query.isError && <ErrorState message={query.error.message} />}
          {query.data && query.data.items.length === 0 && (
            <EmptyState title="Sin encuestas" description="Crea un borrador para comenzar a diseñar la experiencia de respuesta." />
          )}
          {query.data && query.data.items.length > 0 && (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Nombre</TableHeader>
                    <TableHeader>Creada por</TableHeader>
                    <TableHeader>Última edición</TableHeader>
                    <TableHeader className="text-right">Invitaciones</TableHeader>
                    <TableHeader>Canal</TableHeader>
                    <TableHeader className="text-right">Respuestas</TableHeader>
                    <TableHeader>Estado</TableHeader>
                    <TableHeader className="text-right">Acciones</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data.items.map((survey) => (
                    <TableRow key={survey.id}>
                      <TableCell wrap>
                        <button type="button" data-allow-multiline className="text-left font-semibold text-[var(--text-brand)] hover:underline" onClick={() => navigate(surveyPaths.edit(survey.id))}>
                          {survey.name}
                        </button>
                        <p className="mt-0.5 text-[var(--text-xs)] text-[var(--text-secondary)]">{survey.type === "NPS" ? "NPS" : survey.type === "CUSTOM" ? "Personalizada" : "Satisfacción"}</p>
                      </TableCell>
                      <TableCell>{survey.createdByName}</TableCell>
                      <TableCell>{formatDateTime(survey.updatedAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">{survey.invitationCount}</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell className="text-right tabular-nums">{survey.responseCount}</TableCell>
                      <TableCell><SurveyStatusBadge status={survey.status} /></TableCell>
                      <TableCell className="text-right">
                        <details className="group relative inline-block text-left">
                          <summary className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]" aria-label={`Acciones de ${survey.name}`}>
                            <MoreVertical className="h-4 w-4" />
                          </summary>
                          <div className="absolute right-0 z-30 mt-1 hidden w-52 max-w-[calc(100vw-24px)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-modal)] group-open:block">
                            <ActionButton icon={ClipboardList} label="Editar" onClick={() => navigate(surveyPaths.edit(survey.id))} />
                            <ActionButton icon={Eye} label="Vista previa" onClick={() => setPreview(survey)} />
                            <ActionButton icon={Copy} label="Duplicar" onClick={() => mutation.mutate({ action: "duplicate", id: survey.id })} />
                            {survey.status === "ACTIVE" ? (
                              <ActionButton icon={Power} label="Desactivar" onClick={() => mutation.mutate({ action: "deactivate", id: survey.id })} />
                            ) : survey.status !== "ARCHIVED" ? (
                              <ActionButton icon={CheckCircle2} label="Activar" onClick={() => mutation.mutate({ action: "activate", id: survey.id })} />
                            ) : null}
                            <ActionButton icon={BarChart3} label="Ver resultados" onClick={() => navigate(`${surveyPaths.results}?surveyId=${encodeURIComponent(survey.id)}`)} />
                            <ActionButton icon={FileClock} label="Historial" onClick={() => setHistory(survey)} />
                            {survey.status !== "ACTIVE" && survey.status !== "ARCHIVED" && (
                              <ActionButton icon={Archive} label="Archivar" danger onClick={() => mutation.mutate({ action: "archive", id: survey.id })} />
                            )}
                          </div>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-[var(--space-4)] flex flex-col gap-3 text-[var(--text-sm)] text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
                <span>{query.data.total} encuestas · página {query.data.page}</span>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button className="min-w-0 flex-1 sm:flex-none" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /> Anterior</Button>
                  <Button className="min-w-0 flex-1 sm:flex-none" variant="secondary" size="sm" disabled={page * query.data.pageSize >= query.data.total} onClick={() => setPage((value) => value + 1)}>Siguiente <ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Modal open={npsModal} title="Cambiar la encuesta activa a NPS" onClose={() => setNpsModal(false)}>
        <div className="space-y-[var(--space-4)] text-[var(--text-sm)] text-[var(--text-secondary)]">
          <p>La encuesta actual no se transformará ni perderá resultados. Se abrirá una encuesta NPS existente o se creará un borrador nuevo.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNpsModal(false)}>Cancelar</Button>
            <Button onClick={switchToNps}>Continuar con NPS</Button>
          </div>
        </div>
      </Modal>
      <Modal open={Boolean(preview)} title="Vista previa de la encuesta" onClose={() => setPreview(null)} size="lg">
        {preview && <SurveyPreview survey={preview} />}
      </Modal>
      <Modal open={Boolean(history)} title="Historial de versiones" onClose={() => setHistory(null)}>
        {history && (
          <div className="space-y-3">
            {history.versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] p-3">
                <div><p className="font-semibold text-[var(--text-primary)]">Versión {version.version}</p><p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{version.publishedAt ? formatDateTime(version.publishedAt) : "Sin publicar"}</p></div>
                <Badge value={version.status === "PUBLISHED" ? "Publicada" : version.status === "SUPERSEDED" ? "Reemplazada" : "Borrador"} tone={version.status === "PUBLISHED" ? "success" : "default"} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function SurveySendConfigurationPanel() {
  const queryClient = useQueryClient();
  const surveys = useQuery({ queryKey: ["crm-surveys", "active-options"], queryFn: () => listSurveyDefinitions({ pageSize: 100 }) });
  const configurations = useQuery({ queryKey: ["crm-surveys", "send-config"], queryFn: listSurveySendConfigurations });
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", { pageSize: 500 });
  const specialties = useSpecialties(undefined, "true");
  const [surveyId, setSurveyId] = useState("");
  const selectedConfig = configurations.data?.find((item) => item.surveyId === surveyId);
  const [form, setForm] = useState<SurveyConfigForm>(defaultConfigForm());

  useEffect(() => {
    if (!surveyId && surveys.data?.items.length) setSurveyId(surveys.data.items[0].id);
  }, [surveyId, surveys.data]);
  useEffect(() => {
    setForm(selectedConfig ? configToForm(selectedConfig) : defaultConfigForm());
  }, [selectedConfig, surveyId]);

  const save = useMutation({
    mutationFn: () => updateSurveySendConfiguration({
      surveyId,
      branchIds: form.branchIds,
      professionalIds: form.professionalIds,
      specialtyIds: form.specialtyIds,
      appointmentTypes: form.appointmentTypes,
      channel: "EMAIL",
      triggerEvent: "APPOINTMENT_COMPLETED",
      delayMinutes: form.delayMinutes,
      minimumFrequencyDays: form.minimumFrequencyDays,
      sendWindowStart: form.sendWindowStart,
      sendWindowEnd: form.sendWindowEnd,
      maxRetries: form.maxRetries,
      reminderEnabled: form.reminderEnabled,
      reminderDelayMinutes: form.reminderEnabled ? form.reminderDelayMinutes : null,
      requireConsent: form.requireConsent,
      isActive: form.isActive
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-surveys", "send-config"] });
      toast.success("Configuración de envío guardada");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (surveys.isLoading || configurations.isLoading) return <LoadingState message="Cargando configuración de envío..." />;
  if (surveys.isError) return <ErrorState message={surveys.error.message} />;
  if (configurations.isError) return <ErrorState message={configurations.error.message} />;
  if (!surveys.data?.items.length) return <EmptyState title="Sin encuestas" description="Crea y activa una encuesta antes de configurar su automatización." />;

  return (
    <div className="grid gap-[var(--space-5)] xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="space-y-[var(--space-6)] hover:translate-y-0">
        <div className="flex items-start gap-3 border-b border-[var(--border-default)] pb-[var(--space-4)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]"><Settings2 className="h-4 w-4" /></span>
          <div><h3 className="font-semibold text-[var(--text-primary)]">Regla posterior a la atención</h3><p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">La cita debe quedar en estado Atendida (`COMPLETED`) antes de generar una invitación.</p></div>
        </div>
        <Field label="Encuesta activa">
          <Select value={surveyId} onChange={(event) => setSurveyId(event.target.value)}>
            {surveys.data.items.map((survey) => <option key={survey.id} value={survey.id}>{survey.name} · {statusLabel(survey.status)}</option>)}
          </Select>
        </Field>
        <div className="grid gap-[var(--space-4)] md:grid-cols-2 lg:grid-cols-3">
          <Field label="Evento disparador"><Input value="Cita marcada como atendida" disabled /></Field>
          <Field label="Espera después de atender (minutos)"><Input type="number" min={0} value={form.delayMinutes} onChange={(event) => setForm({ ...form, delayMinutes: Number(event.target.value) })} /></Field>
          <Field label="Frecuencia mínima por paciente (días)"><Input type="number" min={0} value={form.minimumFrequencyDays} onChange={(event) => setForm({ ...form, minimumFrequencyDays: Number(event.target.value) })} /></Field>
          <Field label="Horario desde"><Input type="time" value={form.sendWindowStart} onChange={(event) => setForm({ ...form, sendWindowStart: event.target.value })} /></Field>
          <Field label="Horario hasta"><Input type="time" value={form.sendWindowEnd} onChange={(event) => setForm({ ...form, sendWindowEnd: event.target.value })} /></Field>
          <Field label="Máximo de intentos"><Input type="number" min={0} max={10} value={form.maxRetries} onChange={(event) => setForm({ ...form, maxRetries: Number(event.target.value) })} /></Field>
        </div>
        <div className="grid gap-[var(--space-4)] lg:grid-cols-3">
          <FilterChecklist title="Sucursales" items={(branches.data ?? []).map((branch) => ({ id: branch.id, label: branch.name }))} selected={form.branchIds} onChange={(branchIds) => setForm({ ...form, branchIds })} emptyLabel="Todas las autorizadas" />
          <FilterChecklist title="Profesionales" items={(professionals.data ?? []).map((professional) => ({ id: professional.id, label: `${professional.firstName} ${professional.lastName}` }))} selected={form.professionalIds} onChange={(professionalIds) => setForm({ ...form, professionalIds })} emptyLabel="Todos los profesionales" />
          <FilterChecklist title="Especialidades" items={(specialties.data ?? []).map((specialty) => ({ id: specialty.id, label: specialty.name }))} selected={form.specialtyIds} onChange={(specialtyIds) => setForm({ ...form, specialtyIds })} emptyLabel="Todas las especialidades" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow checked={form.requireConsent} onChange={(requireConsent) => setForm({ ...form, requireConsent })} title="Requerir consentimiento" description="Exige consentimiento de marketing GRANTED antes de generar la invitación." />
          <ToggleRow checked={form.reminderEnabled} onChange={(reminderEnabled) => setForm({ ...form, reminderEnabled })} title="Recordatorio" description="Reserva la configuración para un recordatorio posterior si no hay respuesta." />
        </div>
        {form.reminderEnabled && <Field label="Enviar recordatorio después de (minutos)"><Input type="number" min={1} value={form.reminderDelayMinutes} onChange={(event) => setForm({ ...form, reminderDelayMinutes: Number(event.target.value) })} /></Field>}
      </Card>
      <Card className="h-fit space-y-[var(--space-4)] hover:translate-y-0 xl:sticky xl:top-[var(--space-5)]">
        <div><p className="text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-brand)]">Automatización</p><h3 className="mt-1 text-[var(--text-lg)] font-semibold text-[var(--text-primary)]">Control de la regla</h3></div>
        <ToggleRow checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} title={form.isActive ? "Regla activa" : "Regla desactivada"} description="Al activarla sólo se crearán invitaciones para futuras citas atendidas." />
        <div className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3 text-[var(--text-sm)] text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">Protecciones aplicadas</p>
          <ul className="mt-2 list-disc space-y-1 pl-5"><li>Idempotencia por cita, versión y canal.</li><li>Correo obligatorio y token con hash.</li><li>Frecuencia por paciente.</li><li>Envío fuera de la transacción clínica.</li></ul>
        </div>
        <Button className="w-full" onClick={() => save.mutate()} disabled={!surveyId || save.isPending}>{save.isPending ? "Guardando..." : "Guardar configuración"}</Button>
      </Card>
    </div>
  );
}

function SurveyResultsPanel() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [filters, setFilters] = useState<SurveyResultsFilters>({ surveyId: params.get("surveyId") || undefined });
  const surveys = useQuery({ queryKey: ["crm-surveys", "result-options"], queryFn: () => listSurveyDefinitions({ pageSize: 100 }) });
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", { pageSize: 500 });
  const query = useQuery({ queryKey: ["crm-surveys", "results", filters], queryFn: () => getSurveyResults(filters) });
  const exportMutation = useMutation({ mutationFn: () => exportSurveyResults(filters), onSuccess: () => toast.success("Reporte CSV descargado"), onError: (error: Error) => toast.error(error.message) });

  return (
    <div className="space-y-[var(--space-5)]">
      <Card className="hover:translate-y-0">
        <div className="flex flex-col gap-[var(--space-4)] xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Encuesta"><Select value={filters.surveyId ?? ""} onChange={(event) => setFilters({ ...filters, surveyId: event.target.value || undefined, versionId: undefined })}><option value="">Todas las encuestas</option>{surveys.data?.items.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</Select></Field>
            <Field label="Sucursal"><Select value={filters.branchId ?? ""} onChange={(event) => setFilters({ ...filters, branchId: event.target.value || undefined })}><option value="">Todas las autorizadas</option>{branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>
            <Field label="Profesional"><Select value={filters.professionalId ?? ""} onChange={(event) => setFilters({ ...filters, professionalId: event.target.value || undefined })}><option value="">Todos</option>{professionals.data?.map((professional) => <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>)}</Select></Field>
            <Field label="Desde"><Input type="date" value={filters.from?.slice(0, 10) ?? ""} onChange={(event) => setFilters({ ...filters, from: event.target.value || undefined })} /></Field>
            <Field label="Hasta"><Input type="date" value={filters.to?.slice(0, 10) ?? ""} onChange={(event) => setFilters({ ...filters, to: event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined })} /></Field>
          </div>
          <Button variant="secondary" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}><Download className="h-4 w-4" /> Exportar CSV</Button>
        </div>
      </Card>
      {query.isLoading && <LoadingState message="Calculando resultados..." />}
      {query.isError && <ErrorState message={query.error.message} />}
      {query.data && (
        <>
          <div className="grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <MetricCard label="Generadas" value={query.data.metrics.generated} hint="Invitaciones creadas" />
            <MetricCard label="Enviadas" value={query.data.metrics.sent} hint="Aceptadas por SMTP" />
            <MetricCard label="Entregadas" value={query.data.metrics.delivered} hint="Confirmadas por proveedor" />
            <MetricCard label="Respondidas" value={query.data.metrics.responded} hint={`${query.data.metrics.responseRate}% de tasa`} strong />
            <MetricCard label="Promedio" value={query.data.metrics.average ?? "—"} hint="Respuestas numéricas" />
            <MetricCard label="NPS" value={query.data.metrics.nps ?? "—"} hint={`${query.data.metrics.promoters} promotores`} />
          </div>
          <Card className="hover:translate-y-0">
            <div className="mb-[var(--space-4)] flex items-center justify-between"><div><h3 className="font-semibold text-[var(--text-primary)]">Embudo de invitaciones</h3><p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Cada indicador conserva su semántica; no se infiere entrega desde un envío.</p></div><BarChart3 className="h-5 w-5 text-[var(--text-brand)]" /></div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><FunnelStep label="En cola" value={query.data.metrics.queued} /><FunnelStep label="Enviadas" value={query.data.metrics.sent} /><FunnelStep label="Entregadas" value={query.data.metrics.delivered} /><FunnelStep label="Abiertas" value={query.data.metrics.opened} /><FunnelStep label="Iniciadas" value={query.data.metrics.started} /><FunnelStep label="Respondidas" value={query.data.metrics.responded} /></div>
            <div className="mt-3 flex flex-wrap gap-2"><Badge value={`${query.data.metrics.expired} expiradas`} /><Badge value={`${query.data.metrics.bounced} rebotes`} tone={query.data.metrics.bounced ? "warning" : "default"} /><Badge value={`${query.data.metrics.failed} errores`} tone={query.data.metrics.failed ? "danger" : "default"} /></div>
          </Card>
          <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
            {query.data.questions.map((question) => (
              <Card key={question.id} className="hover:translate-y-0">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[var(--text-primary)]">{question.text}</p><p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{question.answerCount} respuestas · {question.type}</p></div>{question.average !== null && question.average !== undefined && <Badge value={`Promedio ${question.average}`} tone="brand" />}</div>
                {question.distribution.length > 0 && <div className="mt-4 space-y-3">{question.distribution.map((option) => <div key={option.optionId}><div className="mb-1 flex justify-between text-[var(--text-xs)] text-[var(--text-secondary)]"><span>{option.label}</span><span>{option.count} · {option.percentage}%</span></div><div className="h-2 overflow-hidden rounded-[var(--radius-full)] bg-[var(--bg-subtle)]"><div className="h-full rounded-[var(--radius-full)] bg-[var(--action-brand)]" style={{ width: `${Math.min(100, option.percentage)}%` }} /></div></div>)}</div>}
                {question.textResponses.length > 0 && <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">{question.textResponses.map((text, index) => <blockquote key={`${question.id}-${index}`} className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3 text-[var(--text-sm)] text-[var(--text-primary)]">{text}</blockquote>)}</div>}
              </Card>
            ))}
          </div>
          {!query.data.questions.length && <EmptyState title="Sin respuestas por pregunta" description="Las métricas aparecerán cuando pacientes finalicen una encuesta." />}
        </>
      )}
    </div>
  );
}

type SurveyConfigForm = {
  branchIds: string[];
  professionalIds: string[];
  specialtyIds: string[];
  appointmentTypes: string[];
  delayMinutes: number;
  minimumFrequencyDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  maxRetries: number;
  reminderEnabled: boolean;
  reminderDelayMinutes: number;
  requireConsent: boolean;
  isActive: boolean;
};

function defaultConfigForm(): SurveyConfigForm {
  return { branchIds: [], professionalIds: [], specialtyIds: [], appointmentTypes: [], delayMinutes: 120, minimumFrequencyDays: 30, sendWindowStart: "08:00", sendWindowEnd: "20:00", maxRetries: 3, reminderEnabled: false, reminderDelayMinutes: 1440, requireConsent: true, isActive: false };
}

function configToForm(config: SurveySendConfiguration): SurveyConfigForm {
  return { branchIds: config.branchIds ?? [], professionalIds: config.professionalIds ?? [], specialtyIds: config.specialtyIds ?? [], appointmentTypes: config.appointmentTypes ?? [], delayMinutes: config.delayMinutes, minimumFrequencyDays: config.minimumFrequencyDays, sendWindowStart: config.sendWindowStart, sendWindowEnd: config.sendWindowEnd, maxRetries: config.maxRetries, reminderEnabled: config.reminderEnabled, reminderDelayMinutes: config.reminderDelayMinutes ?? 1440, requireConsent: config.requireConsent, isActive: config.isActive };
}

function FilterChecklist({ title, items, selected, onChange, emptyLabel }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void; emptyLabel: string }) {
  return <fieldset className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-default)] p-3"><legend className="max-w-full truncate px-1 text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{title}</legend><p className="mb-2 truncate text-[var(--text-xs)] text-[var(--text-secondary)]" title={selected.length ? `${selected.length} seleccionados` : emptyLabel}>{selected.length ? `${selected.length} seleccionados` : emptyLabel}</p><div className="max-h-44 min-w-0 space-y-1 overflow-y-auto">{items.map((item) => <label key={item.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--text-sm)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} className="h-4 w-4 shrink-0 accent-[var(--action-brand)]" /><span className="min-w-0 truncate" title={item.label}>{item.label}</span></label>)}</div>{selected.length > 0 && <button type="button" className="mt-2 shrink-0 whitespace-nowrap text-[var(--text-xs)] font-semibold text-[var(--text-brand)] hover:underline" onClick={() => onChange([])}>Aplicar a todos</button>}</fieldset>;
}

function ToggleRow({ checked, onChange, title, description }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string }) {
  return <label className="flex min-w-0 cursor-pointer items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] p-3"><div className="min-w-0"><p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{title}</p><p className="mt-1 text-[var(--text-xs)] leading-5 text-[var(--text-secondary)]">{description}</p></div><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--action-primary)]" /></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">{label}</span>{children}</label>;
}

function SurveyStatusBadge({ status }: { status: SurveyDefinitionStatus }) {
  const tone = status === "ACTIVE" ? "success" : status === "INACTIVE" ? "warning" : "default";
  return <Badge value={statusLabel(status)} tone={tone} />;
}

function statusLabel(status: SurveyDefinitionStatus) {
  return status === "ACTIVE" ? "Activa" : status === "INACTIVE" ? "Inactiva" : status === "ARCHIVED" ? "Archivada" : "Borrador";
}

function ActionButton({ icon: Icon, label, onClick, danger = false }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--text-sm)] hover:bg-[var(--bg-subtle)] ${danger ? "text-[var(--text-danger)]" : "text-[var(--text-primary)]"}`}><Icon className="h-4 w-4" /> {label}</button>;
}

function SurveyPreview({ survey }: { survey: SurveyDefinitionListItem }) {
  const version = survey.versions[0];
  return <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-5)]"><div className="mx-auto max-w-xl rounded-[var(--radius-lg)] bg-[var(--bg-surface)] p-[var(--space-6)] shadow-[var(--shadow-card)]"><div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4"><div><p className="text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-brand)]">Vista previa estructural</p><h3 className="mt-1 text-[var(--text-xl)] font-semibold text-[var(--text-primary)]">{survey.name}</h3></div><Mail className="h-5 w-5 text-[var(--text-brand)]" /></div><p className="mt-5 text-[var(--text-sm)] leading-6 text-[var(--text-secondary)]">Abre el editor para revisar asunto, encabezado, secciones, preguntas y pie completos.</p><div className="mt-4 rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] p-3 text-[var(--text-sm)] text-[var(--text-brand-strong)]">Versión {version?.version ?? 1} · {version?.status === "PUBLISHED" ? "publicada" : "borrador"}</div></div></div>;
}

function MetricCard({ label, value, hint, strong = false }: { label: string; value: number | string; hint: string; strong?: boolean }) {
  return <Card className={strong ? "border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] hover:translate-y-0" : "hover:translate-y-0"}><p className="text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p><p className="mt-2 text-[var(--text-3xl)] font-semibold tabular-nums text-[var(--text-primary)]">{value}</p><p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{hint}</p></Card>;
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3 text-center"><p className="text-[var(--text-xl)] font-semibold tabular-nums text-[var(--text-primary)]">{value}</p><p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{label}</p></div>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
