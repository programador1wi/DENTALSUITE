import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, KeyRound, Network, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APP_ROUTES } from "@/lib/routes";
import { CredentialSecretDialog } from "../components/credential-secret-dialog";
import { DeveloperApiScopeChecklist } from "../components/developer-api-scope-checklist";
import { useApiKey, useApiKeyOptions, useCreateApiKey, useUpdateApiKey } from "../hooks/use-api-keys";
import type { CreateApiKeyPayload, DeveloperApiScope, SecretResponse } from "../services/api-keys.service";

const scopeValues = [
  "patients:read",
  "patients:write",
  "appointments:read",
  "appointments:write",
  "budgets:read",
  "pricing:read"
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre reconocible").max(120),
  scopes: z.array(z.enum(scopeValues)).min(1, "Selecciona al menos una capacidad"),
  branchScope: z.enum(["ALL", "SELECTED"]),
  branchIds: z.array(z.string()),
  networkScope: z.enum(["ANY", "ALLOWLIST"]),
  allowedIpsText: z.string(),
  expiresInDays: z.enum(["30", "60", "90"])
}).superRefine((value, context) => {
  if (value.branchScope === "SELECTED" && value.branchIds.length === 0) {
    context.addIssue({ code: "custom", path: ["branchIds"], message: "Selecciona al menos una sucursal" });
  }
  const ips = value.allowedIpsText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  if (value.networkScope === "ALLOWLIST" && ips.length === 0) {
    context.addIssue({ code: "custom", path: ["allowedIpsText"], message: "Agrega al menos una IPv4 o IPv6" });
  }
  if (ips.some((ip) => ip.includes("/") || !/^[0-9a-f:.]+$/i.test(ip))) {
    context.addIssue({ code: "custom", path: ["allowedIpsText"], message: "Usa IPv4 o IPv6 exactas; CIDR no esta permitido" });
  }
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  name: "",
  scopes: [],
  branchScope: "ALL",
  branchIds: [],
  networkScope: "ANY",
  allowedIpsText: "",
  expiresInDays: "90"
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-medium text-red-700" role="alert">{message}</p> : null;
}

export function ApiKeyFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const options = useApiKeyOptions();
  const detail = useApiKey(id, isEditing);
  const create = useCreateApiKey();
  const update = useUpdateApiKey();
  const [secret, setSecret] = useState<SecretResponse | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, shouldFocusError: true });
  const branchScope = form.watch("branchScope");
  const networkScope = form.watch("networkScope");
  const selectedScopes = form.watch("scopes");
  const selectedBranches = form.watch("branchIds");
  const pending = create.isPending || update.isPending;
  const blocker = useBlocker(form.formState.isDirty && !saved && !secret);

  useEffect(() => {
    if (!form.formState.isDirty || saved || secret) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty, saved, secret]);

  useEffect(() => {
    if (!detail.data) return;
    form.reset({
      name: detail.data.name,
      scopes: detail.data.scopes,
      branchScope: detail.data.branchScope,
      branchIds: detail.data.branchIds,
      networkScope: detail.data.networkScope,
      allowedIpsText: detail.data.allowedIps.join("\n"),
      expiresInDays: "90"
    });
  }, [detail.data, form]);

  const scopeMap = useMemo(() => new Map(options.data?.scopes.map((scope) => [scope.value, scope]) ?? []), [options.data]);
  const summary = [
    `${selectedScopes.length} capacidades`,
    branchScope === "ALL" ? "todas las sucursales" : `${selectedBranches.length} sucursales`,
    networkScope === "ANY" ? "cualquier IP" : "IP restringida"
  ].join(" · ");

  const onSubmit = form.handleSubmit(async (values) => {
    const allowedIps = values.allowedIpsText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    const payload = {
      name: values.name.trim(),
      scopes: values.scopes,
      branchScope: values.branchScope,
      branchIds: values.branchScope === "ALL" ? [] : values.branchIds,
      networkScope: values.networkScope,
      allowedIps: values.networkScope === "ANY" ? [] : allowedIps
    };
    try {
      if (id) {
        await update.mutateAsync({ id, payload });
        setSaved(true);
        toast.success("Cambios guardados");
        navigate(APP_ROUTES.settings.apiKeys);
      } else {
        const response = await create.mutateAsync({ ...payload, expiresInDays: Number(values.expiresInDays) as CreateApiKeyPayload["expiresInDays"] });
        setSaved(true);
        setSecret(response);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la credencial");
    }
  });

  if (options.isLoading || (isEditing && detail.isLoading)) return <LoadingState message="Cargando configuracion..." />;
  if (options.isError) return <ErrorState message={options.error.message} />;
  if (detail.isError) return <ErrorState message={detail.error.message} />;

  return (
    <div>
      <PageHeader
        title={isEditing ? "Editar credencial" : "Nueva credencial"}
        description="Define exactamente que puede consultar o crear el sistema externo."
        secondaryActions={<Button variant="ghost" onClick={() => navigate(APP_ROUTES.settings.apiKeys)}><ArrowLeft className="h-4 w-4" />Volver</Button>}
      />

      <form noValidate onSubmit={onSubmit} className="space-y-[var(--space-5)]">
        <Card className="overflow-hidden p-0">
          <section className="border-b border-[var(--border-default)] p-[var(--space-5)]">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-[var(--text-brand)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-[var(--text-brand-strong)]">Identidad y vigencia</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Usa un nombre que permita reconocer al responsable y sistema.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                  <div>
                    <label htmlFor="api-key-name" className="mb-1.5 block text-sm font-medium">Nombre</label>
                    <Input id="api-key-name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} placeholder="Ej. Agenda sitio corporativo" />
                    <FieldError message={form.formState.errors.name?.message} />
                  </div>
                  {!isEditing ? (
                    <div>
                      <label htmlFor="api-key-expiry" className="mb-1.5 block text-sm font-medium">Vigencia</label>
                      <Select id="api-key-expiry" {...form.register("expiresInDays")}>
                        <option value="30">30 dias</option>
                        <option value="60">60 dias</option>
                        <option value="90">90 dias</option>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <fieldset className="border-b border-[var(--border-default)] p-[var(--space-5)]">
            <legend className="sr-only">Permisos del token</legend>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--text-brand)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-[var(--text-brand-strong)]">Permisos del token</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Autoriza cada permiso externo por separado. Estos permisos no dan acceso al panel de Dentalink.
                </p>
                <Controller
                  control={form.control}
                  name="scopes"
                  render={({ field }) => (
                    <DeveloperApiScopeChecklist
                      options={options.data?.scopes ?? []}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(form.formState.errors.scopes)}
                    />
                  )}
                />
                <FieldError message={form.formState.errors.scopes?.message} />
              </div>
            </div>
          </fieldset>

          <fieldset className="border-b border-[var(--border-default)] p-[var(--space-5)]">
            <legend className="sr-only">Alcance de sucursales</legend>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--text-brand)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-[var(--text-brand-strong)]">Sucursales autorizadas</h2>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" value="ALL" {...form.register("branchScope")} />Todas</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" value="SELECTED" {...form.register("branchScope")} />Seleccionadas</label>
                </div>
                {branchScope === "SELECTED" ? (
                  <Controller
                    control={form.control}
                    name="branchIds"
                    render={({ field }) => (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(options.data?.branches ?? []).map((branch) => {
                          const checked = field.value.includes(branch.id);
                          return <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-full)] border border-[var(--border-default)] px-3 py-2 text-sm hover:bg-[var(--bg-subtle)]"><input type="checkbox" checked={checked} onChange={() => field.onChange(checked ? field.value.filter((value) => value !== branch.id) : [...field.value, branch.id])} />{branch.name}</label>;
                        })}
                      </div>
                    )}
                  />
                ) : null}
                <FieldError message={form.formState.errors.branchIds?.message} />
              </div>
            </div>
          </fieldset>

          <fieldset className="p-[var(--space-5)]">
            <legend className="sr-only">Restriccion de red</legend>
            <div className="flex items-start gap-3">
              <Network className="mt-0.5 h-5 w-5 text-[var(--text-brand)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-[var(--text-brand-strong)]">Origen de red</h2>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" value="ANY" {...form.register("networkScope")} />Cualquier IP</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" value="ALLOWLIST" {...form.register("networkScope")} />Lista permitida</label>
                </div>
                {networkScope === "ALLOWLIST" ? (
                  <div className="mt-4 max-w-2xl">
                    <label htmlFor="allowed-ips" className="mb-1.5 block text-sm font-medium">IPv4 o IPv6, una por linea</label>
                    <Textarea id="allowed-ips" className="resize-none font-mono text-xs" rows={5} aria-invalid={Boolean(form.formState.errors.allowedIpsText)} {...form.register("allowedIpsText")} placeholder={"201.140.22.5\n2001:db8::1"} />
                    <FieldError message={form.formState.errors.allowedIpsText?.message} />
                  </div>
                ) : null}
              </div>
            </div>
          </fieldset>
        </Card>

        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-brand-strong)]">Resumen de alcance</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{summary}</p>
            {selectedScopes.length ? <p className="mt-1 font-mono text-[11px] text-[var(--text-brand)]">{selectedScopes.map((scope) => scopeMap.get(scope as DeveloperApiScope)?.value ?? scope).join(", ")}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(APP_ROUTES.settings.apiKeys)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando..." : isEditing ? "Guardar cambios" : "Generar credencial"}</Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Descartar cambios"
        description="Hay cambios sin guardar. Si sales ahora, se perderan."
        confirmLabel="Descartar cambios"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
      <CredentialSecretDialog value={secret} onDone={() => navigate(APP_ROUTES.settings.apiKeys)} />
    </div>
  );
}
