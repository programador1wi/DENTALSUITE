import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Bot, ContactRound, Link2, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { getPatientIdentityDataQuality, updatePatientIdentityConfig, type PatientIdentityConfig } from "../services/patient-identity.service";
import { useAuthStore } from "@/stores/auth.store";

const FLAGS: Array<{ key: keyof PatientIdentityConfig; title: string; description: string }> = [
  { key: "shadowMode", title: "Modo observación", description: "Clasifica sin cambiar decisiones externas." },
  { key: "adminResolutionEnabled", title: "Resolución administrativa", description: "Activa preflight y vínculos desde Pacientes." },
  { key: "publicBookingResolutionEnabled", title: "Agenda Online segura", description: "Exige sesión y selección explícita." },
  { key: "whatsappResolutionEnabled", title: "Bot WhatsApp seguro", description: "Habilita contrato externo por organización." },
  { key: "familyGroupsEnabled", title: "Grupos familiares", description: "Permite miembros y autorizaciones de agenda." },
  { key: "safeMergeEnabled", title: "Fusión auditada", description: "Habilita preview, versión y trazabilidad." }
];

export function PatientIdentityQualityPage() {
  const canManageConfig = useAuthStore((state) => state.hasPermission("patient_identity.config.manage"));
  const queryClient = useQueryClient();
  const quality = useQuery({ queryKey: ["patient-identity-data-quality"], queryFn: getPatientIdentityDataQuality });
  const update = useMutation({
    mutationFn: updatePatientIdentityConfig,
    onSuccess: () => {
      toast.success("Política actualizada");
      void queryClient.invalidateQueries({ queryKey: ["patient-identity-data-quality"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-identity-config"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (quality.isLoading) return <LoadingState message="Auditando identidad y contactos..." />;
  if (quality.isError || !quality.data) return <ErrorState message={quality.error?.message ?? "No fue posible cargar calidad de datos"} />;

  const data = quality.data;
  const metrics = [
    { label: "Vínculos activos", value: data.summary.activeLinks, icon: Link2, tone: "text-sky-700 bg-sky-50" },
    { label: "Contactos compartidos", value: data.summary.sharedContactPoints, icon: ContactRound, tone: "text-amber-700 bg-amber-50" },
    { label: "Grupos familiares", value: data.summary.familyGroups, icon: UsersRound, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Incidencias de identidad", value: data.summary.openIdentityIncidents, icon: Bot, tone: "text-violet-700 bg-violet-50" }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Identidad y calidad de pacientes" description="Control de contactos compartidos, ambigüedad y despliegue gradual." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{metric.value}</p>
            </div>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="h-5 w-5" /></span>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Teléfonos heredados por corregir</h2>
              <p className="mt-1 text-sm text-slate-500">No pudieron normalizarse a E.164. No participan en resolución automática.</p>
            </div>
            <Badge value={String(data.summary.invalidLegacyPhones)} tone={data.summary.invalidLegacyPhones ? "warning" : "success"} />
          </div>
          {data.invalidLegacyPhones.length ? (
            <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {data.invalidLegacyPhones.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {patient.branch.name} · {patient.phone ?? patient.alternatePhone ?? "Sin valor legible"}
                      {patient.validationFailure?.field ? ` · ${patient.validationFailure.field}` : ""}
                    </p>
                  </div>
                  <Link to={`/patients/${patient.id}/profile`} className="shrink-0 text-sm font-semibold text-[var(--text-brand)] hover:underline">Corregir</Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Todos los teléfonos activos tienen vínculo normalizado.</div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Activación por organización</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Activa canal cuando datos y pruebas estén listos.</p>
          <div className="mt-4 space-y-2">
            {FLAGS.map((flag) => {
              const enabled = Boolean(data.config[flag.key]);
              return (
                <button
                  key={flag.key}
                  type="button"
                  onClick={() => canManageConfig && update.mutate({ [flag.key]: !enabled })}
                  disabled={update.isPending || !canManageConfig}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{flag.title}</span>
                    <span className="block text-xs text-slate-500">{flag.description}</span>
                  </span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
                  </span>
                </button>
              );
            })}
          </div>
          {data.summary.invalidLegacyPhones ? (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Corrige teléfonos heredados antes de desactivar lectura legacy.
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
