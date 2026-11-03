import type { ReactNode } from "react";
import { Building2, CheckCircle2, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CollaboratorFormOverviewProps = {
  accessLabel: string;
  primaryBranchLabel: string;
  roleLabel: string;
  clinicalBranchLabel: string;
  clinical: boolean;
  editing: boolean;
  canCreateProfessional: boolean;
  onSelectAdministrative: () => void;
  onSelectClinical: () => void;
};

export function CollaboratorFormOverview({
  accessLabel,
  primaryBranchLabel,
  roleLabel,
  clinicalBranchLabel,
  clinical,
  editing,
  canCreateProfessional,
  onSelectAdministrative,
  onSelectClinical
}: CollaboratorFormOverviewProps) {
  return (
    <>
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem icon={<Mail className="h-4 w-4" />} label="Acceso" value={accessLabel} />
        <SummaryItem icon={<Building2 className="h-4 w-4" />} label="Sucursal principal" value={primaryBranchLabel} />
        <SummaryItem icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value={roleLabel} />
        <SummaryItem
          icon={clinical ? <CheckCircle2 className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
          label="Perfil clinico"
          value={clinical ? clinicalBranchLabel : "Sin agenda clinica"}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Tipo de usuario</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TypeButton
            active={clinical}
            disabled={editing || !canCreateProfessional}
            icon={<Stethoscope className="h-5 w-5" />}
            title="Usuario Clinico"
            description="Doctores, ortodoncistas y especialistas con agenda de atencion a pacientes."
            onClick={onSelectClinical}
          />
          <TypeButton
            active={!clinical}
            disabled={editing}
            icon={<Building2 className="h-5 w-5" />}
            title="Usuario Administrativo"
            description="Recepcionistas, asistentes, personal de CEYE, caja y administracion."
            onClick={onSelectAdministrative}
          />
        </div>
        {editing ? (
          <p className="text-xs text-slate-500">
            El tipo de colaborador se conserva al editar para no alterar acceso y atencion clinica de forma implicita.
          </p>
        ) : null}
        {!editing && !canCreateProfessional ? (
          <p className="text-xs text-slate-500">Tu perfil permite crear usuarios administrativos, pero no perfiles clinicos.</p>
        ) : null}
      </div>
    </>
  );
}

function TypeButton({
  active,
  description,
  disabled,
  icon,
  onClick,
  title
}: {
  active: boolean;
  description: string;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55",
        active
          ? "border-[var(--text-brand-strong)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)] ring-2 ring-[var(--text-brand-strong)]/20"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-[var(--text-brand-strong)] text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={value}>{value}</p>
    </div>
  );
}
