import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type {
  TreatmentPlanDetail,
  TreatmentPlanPrintOption
} from "@/features/treatments/services/treatments.service";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function PrintCenterModal({
  open,
  option,
  plan,
  patientName,
  logoLabel,
  saving,
  onClose,
  onPreview,
  onGenerate
}: {
  open: boolean;
  option: TreatmentPlanPrintOption | null;
  plan: TreatmentPlanDetail | null;
  patientName: string;
  logoLabel: string;
  saving: boolean;
  onClose: () => void;
  onPreview: () => void;
  onGenerate: () => void;
}) {
  if (!option || !plan) return null;
  const professionalName = `${plan.professional.firstName} ${plan.professional.lastName}`.trim();

  return (
    <Modal open={open} title="Generar documento" onClose={onClose} size="2xl">
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Tipo de documento</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{option.label}</h3>
          <p className="mt-1 text-sm text-slate-600">{option.description}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryPill label="Paciente" value={patientName || "Sin paciente"} />
          <SummaryPill label="Plan" value={plan.name} />
          <SummaryPill label="Sucursal" value={plan.branch.name} />
          <SummaryPill label="Logotipo" value={logoLabel} />
          <SummaryPill label="Fecha del documento" value={formatDate(new Date().toISOString())} />
          <SummaryPill label="Profesional" value={professionalName || "-"} />
          <SummaryPill label="Formato" value="PDF A4" />
          <SummaryPill label="Orientacion" value="Vertical" />
        </div>

        {option.document_type === "SECTIONS" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            La seleccion granular de secciones aun no existe en el payload del backend. Esta version imprime
            todas las secciones con estados y valores segun la plantilla actual.
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          La vista previa y el PDF final usan el mismo renderer del backend. No se descarga nada al abrir este
          modal.
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" disabled={saving || !option.enabled} onClick={onPreview}>
            Vista previa
          </Button>
          <Button disabled={saving || !option.enabled} onClick={onGenerate}>
            {saving ? "Generando..." : "Generar PDF"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
