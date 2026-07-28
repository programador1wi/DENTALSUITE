import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PatientSearchBox } from "../components/patient-search-box";
import { createMergePreview, executeMerge, type PatientMergePreview } from "../services/patient-identity.service";
import type { PatientListItem } from "../services/patients.service";

export function PatientMergePage() {
  const [targetSearch, setTargetSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [target, setTarget] = useState<PatientListItem | null>(null);
  const [source, setSource] = useState<PatientListItem | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PatientMergePreview | null>(null);

  const previewMutation = useMutation({
    mutationFn: createMergePreview,
    onSuccess: setPreview,
    onError: (error: Error) => toast.error(error.message)
  });
  const executeMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => executeMerge(id, version),
    onSuccess: () => {
      toast.success("Fusión completada y auditada");
      setPreview(null);
      setSource(null);
      setSourceSearch("");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const canPreview = Boolean(target && source && target.id !== source.id && reason.trim().length >= 5);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-semibold text-slate-900">Fusión auditada de fichas</h1>
              <p className="text-xs text-slate-500">Vista previa obligatoria, control de versión e historial de relaciones.</p>
            </div>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Teléfono compartido no es motivo de fusión.</p>
                <p className="mt-1 text-amber-800">Compara documento, nacimiento, historial clínico y financiero. Ficha secundaria queda como MERGED; no se elimina.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-start">
            <PatientSelection
              title="Ficha maestra"
              helper="Conservará identidad y datos preferidos"
              value={targetSearch}
              onValueChange={(value) => {
                setTargetSearch(value);
                setTarget(null);
                setPreview(null);
              }}
              onSelect={(patient) => {
                setTarget(patient);
                setTargetSearch(`${patient.firstName} ${patient.lastName}`);
                setPreview(null);
              }}
              selected={target}
            />
            <ArrowRight className="mx-auto mt-16 hidden h-5 w-5 text-slate-400 md:block" />
            <PatientSelection
              title="Ficha secundaria"
              helper="Sus relaciones pasarán a ficha maestra"
              value={sourceSearch}
              onValueChange={(value) => {
                setSourceSearch(value);
                setSource(null);
                setPreview(null);
              }}
              onSelect={(patient) => {
                setSource(patient);
                setSourceSearch(`${patient.firstName} ${patient.lastName}`);
                setPreview(null);
              }}
              selected={source}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800">Motivo obligatorio</label>
            <Textarea
              className="mt-2"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setPreview(null);
              }}
              placeholder="Explica evidencia revisada y por qué ambas fichas pertenecen a la misma persona."
              rows={3}
            />
          </div>

          {!preview ? (
            <div className="flex justify-end">
              <Button
                disabled={!canPreview || previewMutation.isPending}
                onClick={() => target && source && previewMutation.mutate({ targetPatientId: target.id, sourcePatientId: source.id, reason })}
              >
                {previewMutation.isPending ? "Calculando impacto..." : "Generar vista previa"}
              </Button>
            </div>
          ) : (
            <MergeImpact preview={preview} executing={executeMutation.isPending} onExecute={() => executeMutation.mutate({ id: preview.id, version: preview.version })} />
          )}
        </div>
      </div>
    </div>
  );
}

function PatientSelection({
  title,
  helper,
  value,
  onValueChange,
  onSelect,
  selected
}: {
  title: string;
  helper: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (patient: PatientListItem) => void;
  selected: PatientListItem | null;
}) {
  return (
    <Card className="min-h-44 shadow-none">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">{helper}</p>
      <PatientSearchBox value={value} onValueChange={onValueChange} onSelect={onSelect} placeholder="Buscar nombre, documento o teléfono" />
      {selected ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-emerald-950">{selected.firstName} {selected.lastName}</p>
          <p className="text-xs text-emerald-800">{selected.documentNumber || selected.email || selected.phone || selected.id}</p>
        </div>
      ) : null}
    </Card>
  );
}

const IMPACT_DICTIONARY: Record<string, string> = {
  appointments: "Citas",
  treatmentPlans: "Planes de tratamiento",
  payments: "Pagos",
  documents: "Documentos",
  communications: "Comunicaciones",
  contacts: "Contactos compartidos",
  memberships: "Membresías familiares",
  ledgers: "Estados de cuenta",
  coverages: "Seguros y coberturas"
};

function MergeImpact({ preview, executing, onExecute }: { preview: PatientMergePreview; executing: boolean; onExecute: () => void }) {
  const entries = Object.entries(preview.preview.counts).filter(([, count]) => count > 0);
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
      <div className="flex items-center gap-2 text-sky-950">
        <CheckCircle2 className="h-5 w-5" />
        <h3 className="font-semibold">Impacto calculado</h3>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {entries.length ? entries.map(([entity, count]) => (
          <div key={entity} className="rounded-lg border border-sky-100 bg-white px-3 py-2">
            <p className="text-xl font-semibold text-slate-900">{count}</p>
            <p className="text-xs text-slate-500">{IMPACT_DICTIONARY[entity] || entity}</p>
          </div>
        )) : <p className="text-sm text-slate-600">Ficha sin relaciones operativas.</p>}
      </div>
      {preview.preview.warnings.length ? (
        <ul className="mt-4 space-y-1 text-sm text-amber-800">
          {preview.preview.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
        </ul>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button variant="danger" onClick={onExecute} disabled={executing}>
          {executing ? "Fusionando con auditoría..." : "Confirmar fusión irreversible"}
        </Button>
      </div>
    </div>
  );
}
