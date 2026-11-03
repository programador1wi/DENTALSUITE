import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, Clock3, Globe2, LayoutTemplate, Settings2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  archiveTemplate,
  createDomain,
  createTemplate,
  getMarketingSettings,
  getSenderConfiguration,
  listCampaigns,
  listTemplates,
  updateMarketingSettings,
  verifyDomain,
  type MarketingSettings,
  type SenderConfiguration
} from "../services/email-marketing.service";
import { MarketingReportsPanel } from "../components/marketing-reports-panel";

type TabKey = "reports" | "campaigns" | "templates" | "settings";

const tabs = [
  { key: "reports", label: "Reportes" },
  { key: "campaigns", label: "Campañas de Marketing" },
  { key: "templates", label: "Plantillas" },
  { key: "settings", label: "Configuración" }
];

export const emailMarketingPaths = {
  reports: "/crm/email-marketing/reports",
  campaigns: "/crm/email-marketing/campaigns",
  templates: "/crm/email-marketing/templates",
  settings: "/crm/email-marketing/settings"
} satisfies Record<TabKey, string>;

export function resolveEmailMarketingTab(pathname: string): TabKey {
  if (pathname.startsWith(emailMarketingPaths.campaigns)) return "campaigns";
  if (pathname.startsWith(emailMarketingPaths.templates)) return "templates";
  if (pathname.startsWith(emailMarketingPaths.settings)) return "settings";
  return "reports";
}

export function emailMarketingReportPath(reportCode: string, campaign = false) {
  const reportPath = `${emailMarketingPaths.reports}/${encodeURIComponent(reportCode)}`;
  return campaign ? `${reportPath}/campaign` : reportPath;
}

export function EmailMarketingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { reportCode } = useParams<{ reportCode?: string }>();
  const active = resolveEmailMarketingTab(location.pathname);
  const campaignOpen = Boolean(reportCode) && location.pathname.endsWith("/campaign");
  const sender = useQuery({ queryKey: ["email-marketing", "sender"], queryFn: getSenderConfiguration });

  return (
    <div className="space-y-[var(--space-5)]">
      <PageHeader
        title="Email Marketing"
        description="Segmenta pacientes, prepara campañas y controla entregabilidad sin mezclar comunicaciones clínicas con mensajes promocionales."
        helpText="Los reportes muestran coincidencias; la elegibilidad determina quién puede recibir una campaña."
      />
      <div className="overflow-x-auto pb-1">
        <Tabs items={tabs} active={active} onChange={(key) => navigate(emailMarketingPaths[key as TabKey])} />
      </div>
      {sender.isLoading && <LoadingState message="Cargando configuración del remitente..." />}
      {sender.isError && <ErrorState message={sender.error.message} />}
      {sender.data && active === "reports" && (
        <MarketingReportsPanel
          sender={sender.data}
          selectedReportCode={reportCode}
          campaignOpen={campaignOpen}
          onReportChange={(code) =>
            navigate(code ? emailMarketingReportPath(code) : emailMarketingPaths.reports)
          }
          onOpenCampaign={(code) => navigate(emailMarketingReportPath(code, true))}
          onCloseCampaign={(code) => navigate(emailMarketingReportPath(code), { replace: true })}
          onOpenSettings={() => navigate(emailMarketingPaths.settings)}
          onOpenCampaigns={() => navigate(emailMarketingPaths.campaigns)}
        />
      )}
      {active === "campaigns" && <CampaignsPanel />}
      {active === "templates" && <TemplatesPanel />}
      {sender.data && active === "settings" && <SettingsPanel sender={sender.data} />}
    </div>
  );
}

function CampaignsPanel() {
  const query = useQuery({
    queryKey: ["email-marketing", "campaigns"],
    queryFn: listCampaigns,
    refetchInterval: 10000
  });
  if (query.isLoading) return <LoadingState message="Cargando campañas..." />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  const campaigns = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Borradores"
          value={campaigns.filter((item) => item.status === "DRAFT").length}
          icon={<LayoutTemplate className="h-4 w-4" />}
        />
        <Metric
          label="Programadas"
          value={campaigns.filter((item) => item.status === "SCHEDULED").length}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <Metric
          label="Finalizadas"
          value={campaigns.filter((item) => ["SENT", "PARTIALLY_SENT"].includes(item.status)).length}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>
      <Card className="p-0 hover:translate-y-0">
        <div className="border-b border-[var(--border-default)] px-5 py-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Historial de campañas</h3>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Aceptación del proveedor, entrega y apertura son estados diferentes.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-5 py-3 font-medium">Campaña</th>
                <th className="px-4 py-3 font-medium">Segmento</th>
                <th className="px-4 py-3 font-medium">Destinatarios</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Programación</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-[var(--border-default)]">
                  <td className="px-5 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{campaign.name}</p>
                    <p className="text-[var(--text-secondary)]">{campaign.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {campaign.segment?.name ?? "Selección directa"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{campaign._count?.recipients ?? 0}</td>
                  <td className="px-4 py-3">
                    <CampaignStatus status={campaign.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString("es-MX") : "—"}
                  </td>
                </tr>
              ))}
              {!campaigns.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--text-secondary)]">
                    Aún no hay campañas. Genera un reporte y selecciona pacientes elegibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TemplatesPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["email-marketing", "templates"], queryFn: listTemplates });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "INFORMACION_GENERAL",
    subject: "",
    preheader: "",
    html: "<h1>Hola {{patient.firstName}}</h1>\n<p>Escribe aquí tu mensaje.</p>",
    text: "Hola {{patient.firstName}}, escribe aquí tu mensaje."
  });
  const create = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      toast.success("Plantilla creada");
      setShowForm(false);
      void client.invalidateQueries({ queryKey: ["email-marketing", "templates"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const archive = useMutation({
    mutationFn: archiveTemplate,
    onSuccess: () => {
      toast.success("Plantilla archivada");
      void client.invalidateQueries({ queryKey: ["email-marketing", "templates"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(form);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-0 hover:translate-y-0">
        <div className="flex min-w-0 flex-col items-start gap-3 border-b border-[var(--border-default)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--text-primary)]">Biblioteca de plantillas</h3>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Cada modificación crea una versión; las campañas enviadas conservan su copia.
            </p>
          </div>
          <Button onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Cancelar" : "Nueva plantilla"}
          </Button>
        </div>
        {query.isLoading ? (
          <div className="p-5">
            <LoadingState />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {(query.data ?? []).map((template) => (
              <div key={template.id} className="flex min-w-0 flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]" title={template.name}>{template.name}</p>
                    <Badge value={`v${template.version}`} tone="default" />
                    <Badge
                      value={template.status}
                      tone={template.status === "ACTIVE" ? "success" : "default"}
                    />
                  </div>
                  <p className="mt-1 truncate text-[13px] text-[var(--text-secondary)]">
                    {template.subject} · {template.category}
                  </p>
                </div>
                {template.status !== "ARCHIVED" && (
                  <Button variant="ghost" size="sm" onClick={() => archive.mutate(template.id)}>
                    <Archive className="h-4 w-4" />
                    Archivar
                  </Button>
                )}
              </div>
            ))}
            {!query.data?.length && (
              <p className="px-5 py-12 text-center text-[var(--text-secondary)]">
                No hay plantillas todavía.
              </p>
            )}
          </div>
        )}
      </Card>
      <Card className="h-fit bg-[var(--bg-subtle)] hover:translate-y-0">
        {showForm ? (
          <form className="space-y-3" onSubmit={submit}>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Crear plantilla</p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                HTML seguro, texto alternativo y baja obligatoria.
              </p>
            </div>
            <Field label="Nombre">
              <Input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Categoría">
              <Select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {[
                  "CUMPLEANOS",
                  "RECUPERACION",
                  "PROMOCIONES",
                  "PRESUPUESTOS",
                  "PREVENTIVO",
                  "INFORMACION_GENERAL",
                  "CONVENIO",
                  "PERSONALIZADA"
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Asunto">
              <Input
                required
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            </Field>
            <Field label="Preheader">
              <Input
                value={form.preheader}
                onChange={(event) => setForm({ ...form, preheader: event.target.value })}
              />
            </Field>
            <Field label="Contenido HTML">
              <Textarea
                className="min-h-40 font-mono text-[12px]"
                required
                value={form.html}
                onChange={(event) => setForm({ ...form, html: event.target.value })}
              />
            </Field>
            <Field label="Texto alternativo">
              <Textarea
                required
                value={form.text}
                onChange={(event) => setForm({ ...form, text: event.target.value })}
              />
            </Field>
            <Button className="w-full" disabled={create.isPending}>
              Guardar plantilla
            </Button>
          </form>
        ) : (
          <div className="py-10 text-center">
            <LayoutTemplate className="mx-auto h-9 w-9 text-[var(--text-brand)]" />
            <p className="mt-3 font-medium text-[var(--text-primary)]">Contenido reutilizable y versionado</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Usa variables como <code>{"{{patient.firstName}}"}</code> y <code>{"{{branch.name}}"}</code>.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function SettingsPanel({ sender }: { sender: SenderConfiguration }) {
  const client = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["email-marketing", "settings"],
    queryFn: getMarketingSettings
  });
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [domain, setDomain] = useState({
    domain: "",
    fromName: sender.organization.name,
    fromLocalPart: "notificaciones",
    replyTo: sender.organization.email ?? ""
  });
  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);
  const save = useMutation({
    mutationFn: updateMarketingSettings,
    onSuccess: (data) => {
      setSettings(data);
      toast.success("Políticas guardadas");
      void client.invalidateQueries({ queryKey: ["email-marketing", "settings"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const addDomain = useMutation({
    mutationFn: createDomain,
    onSuccess: () => {
      toast.success("Dominio registrado; agrega los registros DNS");
      void client.invalidateQueries({ queryKey: ["email-marketing", "sender"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const verify = useMutation({
    mutationFn: verifyDomain,
    onSuccess: () => {
      toast.success("Comprobación DNS finalizada");
      void client.invalidateQueries({ queryKey: ["email-marketing", "sender"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="hover:translate-y-0">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-[var(--bg-brand-light)] p-2 text-[var(--text-brand)]">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Políticas de envío</h3>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Límites configurables; nunca reglas comerciales hardcodeadas.
            </p>
          </div>
        </div>
        {settings ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberSetting
              label="Días de enfriamiento"
              value={settings.campaignCooldownDays}
              onChange={(value) => setSettings({ ...settings, campaignCooldownDays: value })}
            />
            <NumberSetting
              label="Máximo por campaña"
              value={settings.maxRecipientsPerCampaign}
              onChange={(value) => setSettings({ ...settings, maxRecipientsPerCampaign: value })}
            />
            <NumberSetting
              label="Campañas por mes"
              value={settings.maxCampaignsPerMonth}
              onChange={(value) => setSettings({ ...settings, maxCampaignsPerMonth: value })}
            />
            <NumberSetting
              label="Correos por día"
              value={settings.maxDailyEmails}
              onChange={(value) => setSettings({ ...settings, maxDailyEmails: value })}
            />
            <Field label="Ventana desde">
              <Input
                type="time"
                value={settings.sendWindowStart}
                onChange={(event) => setSettings({ ...settings, sendWindowStart: event.target.value })}
              />
            </Field>
            <Field label="Ventana hasta">
              <Input
                type="time"
                value={settings.sendWindowEnd}
                onChange={(event) => setSettings({ ...settings, sendWindowEnd: event.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={settings.requireMarketingConsent}
                onChange={(event) =>
                  setSettings({ ...settings, requireMarketingConsent: event.target.checked })
                }
              />
              Requerir consentimiento comercial
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={settings.requireVerifiedDomain}
                onChange={(event) =>
                  setSettings({ ...settings, requireVerifiedDomain: event.target.checked })
                }
              />
              Requerir dominio verificado
            </label>
            <div className="sm:col-span-2">
              <Button onClick={() => save.mutate(settings)} disabled={save.isPending}>
                Guardar políticas
              </Button>
            </div>
          </div>
        ) : (
          <LoadingState />
        )}
      </Card>
      <Card className="hover:translate-y-0">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-[var(--bg-brand-light)] p-2 text-[var(--text-brand)]">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Dominios remitentes</h3>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              SPF, DKIM, DMARC y propiedad deben verificarse antes de activarlo.
            </p>
          </div>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            addDomain.mutate(domain);
          }}
        >
          <Field label="Dominio">
            <Input
              required
              placeholder="clinica.example"
              value={domain.domain}
              onChange={(event) => setDomain({ ...domain, domain: event.target.value })}
            />
          </Field>
          <Field label="Nombre remitente">
            <Input
              required
              value={domain.fromName}
              onChange={(event) => setDomain({ ...domain, fromName: event.target.value })}
            />
          </Field>
          <Field label="Parte local">
            <Input
              value={domain.fromLocalPart}
              onChange={(event) => setDomain({ ...domain, fromLocalPart: event.target.value })}
            />
          </Field>
          <Field label="Responder a">
            <Input
              type="email"
              value={domain.replyTo}
              onChange={(event) => setDomain({ ...domain, replyTo: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button disabled={addDomain.isPending}>Registrar dominio</Button>
          </div>
        </form>
        <div className="mt-5 space-y-3">
          {sender.domains.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {item.fromLocalPart}@{item.domain}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    SPF {item.spfStatus} · DKIM {item.dkimStatus} · DMARC {item.dmarcStatus}
                  </p>
                </div>
                <Badge value={item.status} tone={item.status === "VERIFIED" ? "success" : "warning"} />
              </div>
              {item.status !== "VERIFIED" && (
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => verify.mutate(item.id)}
                    disabled={verify.isPending}
                  >
                    Comprobar DNS
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 py-4 hover:translate-y-0">
      <div className="rounded-lg bg-[var(--bg-brand-light)] p-2 text-[var(--text-brand)]">{icon}</div>
      <div>
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</p>
      </div>
    </Card>
  );
}

function CampaignStatus({ status }: { status: string }) {
  const tone =
    status === "SENT"
      ? "success"
      : status === "FAILED"
        ? "danger"
        : status === "SCHEDULED" || status === "QUEUED" || status === "SENDING"
          ? "warning"
          : "default";
  return <Badge value={status.replaceAll("_", " ")} tone={tone} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function NumberSetting({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}
