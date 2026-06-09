import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalMutations, useClinicalPrescriptions } from "../hooks/use-clinical";
import { HelpTooltip } from "@/components/ui/help-tooltip";

export function ClinicalPrescriptionsPage() {
  const { id = "" } = useParams();
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const prescriptions = useClinicalPrescriptions(id);
  const mutations = useClinicalMutations(id);
  const [form, setForm] = useState({
    professionalId: "",
    diagnosis: "",
    notes: "",
    medication: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: ""
  });
  const [printText, setPrintText] = useState("");

  useEffect(() => {
    if (!form.professionalId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === form.professionalId);
    if (!isVisible) setForm((prev) => ({ ...prev, professionalId: "" }));
  }, [form.professionalId, professionals.data]);

  const create = async () => {
    await mutations.createPrescription.mutateAsync({
      professionalId: form.professionalId,
      diagnosis: form.diagnosis,
      notes: form.notes,
      items: [{ medication: form.medication, dosage: form.dosage, frequency: form.frequency, duration: form.duration, instructions: form.instructions }]
    });
  };

  return (
    <ClinicalShell patientId={id} title="Recetas" description="Prescripciones e impresion de receta.">
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-1.5 w-full">
            <Select value={form.professionalId} onChange={(event) => setForm((prev) => ({ ...prev, professionalId: event.target.value }))} className="flex-1">
              <option value="">Profesional</option>
              {professionals.data?.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>
              ))}
            </Select>
            <HelpTooltip content="Profesional firmante de la receta." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Input placeholder="Diagnostico" value={form.diagnosis} onChange={(event) => setForm((prev) => ({ ...prev, diagnosis: event.target.value }))} className="flex-1" />
            <HelpTooltip content="Diagnóstico asociado a la prescripción farmacológica para justificar su indicación médica." />
          </div>
          <Input placeholder="Medicamento" value={form.medication} onChange={(event) => setForm((prev) => ({ ...prev, medication: event.target.value }))} />
          <Input placeholder="Dosis" value={form.dosage} onChange={(event) => setForm((prev) => ({ ...prev, dosage: event.target.value }))} />
          <Input placeholder="Frecuencia" value={form.frequency} onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value }))} />
          <Input placeholder="Duracion" value={form.duration} onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))} />
          <div className="flex items-center gap-1.5 w-full">
            <Textarea rows={2} placeholder="Indicaciones para el paciente" value={form.instructions} onChange={(event) => setForm((prev) => ({ ...prev, instructions: event.target.value }))} className="flex-1" />
            <HelpTooltip content="Instrucciones de dosificación detalladas para el paciente (ej. 1 comprimido cada 8 horas por 5 días)." />
          </div>
          <Textarea rows={2} placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button disabled={!form.professionalId || !form.medication} onClick={() => void create()}>Crear receta</Button>
        </div>
      </Card>

      {printText ? <Card><pre className="whitespace-pre-wrap text-sm">{printText}</pre></Card> : null}

      <div className="space-y-3">
        {!prescriptions.data?.length ? <EmptyState title="Sin recetas" description="No hay recetas registradas." /> : null}
        {prescriptions.data?.map((prescription) => (
          <Card key={prescription.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{prescription.diagnosis || "Receta"}</p>
                <p className="text-xs text-slate-500">{prescription.professional.firstName} {prescription.professional.lastName}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  onClick={() => void mutations.printPrescription.mutateAsync(prescription.id).then((result) => setPrintText(result.printableText ?? ""))}
                >
                  Imprimir
                </Button>
                <HelpTooltip content="Genera una receta clínica formal con membrete profesional apta para impresión física o envío en formato digital." />
              </div>
            </div>
            <ul className="mt-2 text-sm text-slate-700">
              {prescription.items.map((item) => (
                <li key={item.id}>{item.medication} {item.dosage ?? ""} {item.frequency ?? ""}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

    </ClinicalShell>
  );
}
