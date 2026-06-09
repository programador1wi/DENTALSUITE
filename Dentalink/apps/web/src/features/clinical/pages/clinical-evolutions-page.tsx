import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalEvolutions, useClinicalMutations } from "../hooks/use-clinical";
import { HelpTooltip } from "@/components/ui/help-tooltip";

export function ClinicalEvolutionsPage() {
  const { id = "" } = useParams();
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const evolutions = useClinicalEvolutions(id);
  const mutations = useClinicalMutations(id);
  const [form, setForm] = useState({ professionalId: "", subjective: "", objective: "", assessment: "", plan: "", notes: "" });
  const [addendum, setAddendum] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!form.professionalId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === form.professionalId);
    if (!isVisible) setForm((prev) => ({ ...prev, professionalId: "" }));
  }, [form.professionalId, professionals.data]);

  return (
    <ClinicalShell patientId={id} title="Evoluciones clinicas" description="Notas SOAP, firma y adendas.">
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-1.5 w-full">
            <Select value={form.professionalId} onChange={(event) => setForm((prev) => ({ ...prev, professionalId: event.target.value }))} className="flex-1">
              <option value="">Profesional</option>
              {professionals.data?.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>
              ))}
            </Select>
            <HelpTooltip content="Profesional responsable de la evolución actual." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Textarea rows={2} placeholder="S - Subjetivo (Motivo de consulta y síntomas del paciente)" value={form.subjective} onChange={(event) => setForm((prev) => ({ ...prev, subjective: event.target.value }))} className="flex-1" />
            <HelpTooltip content="S - Subjetivo: Notas sobre el motivo de consulta, dolor o historial de síntomas descritos en las propias palabras del paciente." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Textarea rows={2} placeholder="O - Objetivo (Examen físico, sondaje, radiografías)" value={form.objective} onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))} className="flex-1" />
            <HelpTooltip content="O - Objetivo: Hallazgos clínicos del examen físico, sondaje, inspección de tejidos blandos o análisis de radiografías realizados hoy." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Textarea rows={2} placeholder="A - Evaluacion (Diagnósticos clínicos)" value={form.assessment} onChange={(event) => setForm((prev) => ({ ...prev, assessment: event.target.value }))} className="flex-1" />
            <HelpTooltip content="A - Evaluación: Diagnóstico clínico o evolución deducida a partir de la integración de los síntomas subjetivos y signos objetivos." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Textarea rows={2} placeholder="P - Plan (Tratamientos e indicaciones)" value={form.plan} onChange={(event) => setForm((prev) => ({ ...prev, plan: event.target.value }))} className="flex-1" />
            <HelpTooltip content="P - Plan: Plan de acción inmediato, indicaciones dadas al paciente o citaciones futuras del tratamiento." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Textarea rows={2} placeholder="Notas adicionales" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="flex-1" />
            <HelpTooltip content="Notas administrativas o comentarios de control interno adicionales." />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button disabled={!form.professionalId} onClick={() => void mutations.createEvolution.mutate(form)}>Crear evolucion</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {!evolutions.data?.length ? <EmptyState title="Sin evoluciones" description="No hay evoluciones clinicas registradas." /> : null}
        {evolutions.data?.map((evolution) => (
          <Card key={evolution.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{evolution.professional.firstName} {evolution.professional.lastName}</p>
                <p className="text-xs text-slate-500">{evolution.signedAt ? new Date(evolution.signedAt).toLocaleString() : "Sin firma"}</p>
              </div>
              <Badge value={evolution.signedAt ? "Firmada" : "Borrador"} tone={evolution.signedAt ? "success" : "warning"} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><strong>S:</strong> {evolution.subjective || "-"}</p>
              <p><strong>O:</strong> {evolution.objective || "-"}</p>
              <p><strong>A:</strong> {evolution.assessment || "-"}</p>
              <p><strong>P:</strong> {evolution.plan || "-"}</p>
            </div>
            <p className="mt-2 text-sm text-slate-700">{evolution.notes}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" disabled={Boolean(evolution.signedAt)} onClick={() => void mutations.signEvolution.mutate(evolution.id)}>Firmar</Button>
                <HelpTooltip content="Al firmar la evolución, esta se bloquea permanentemente por seguridad médico-legal de la ficha. Solo se le podrán agregar aclaraciones mediante 'Adendas' posteriores." />
              </div>
              {evolution.signedAt ? (
                <>
                  <Textarea rows={1} placeholder="Adenda" value={addendum[evolution.id] ?? ""} onChange={(event) => setAddendum((prev) => ({ ...prev, [evolution.id]: event.target.value }))} />

                  <Button
                    disabled={!addendum[evolution.id] || !form.professionalId}
                    onClick={() => void mutations.createAddendum.mutate({ evolutionId: evolution.id, professionalId: form.professionalId, notes: addendum[evolution.id] })}
                  >
                    Crear adenda
                  </Button>
                </>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </ClinicalShell>
  );
}
