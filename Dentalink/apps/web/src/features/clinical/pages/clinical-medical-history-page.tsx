import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CircleSlash, ClipboardList, HeartPulse, Pill, Plus } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { cn } from "@/lib/utils/cn";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalMutations, useClinicalSummary } from "../hooks/use-clinical";

const NOTE_SCHEMA = "dentalink.medical-history.v1";

type FieldState = {
  enabled: boolean;
  notApplicable: boolean;
  details: string;
};

type MedicalHistoryForm = {
  bloodType: string;
  generalNotes: string;
  fields: Record<string, FieldState>;
};

type Section = {
  key: string;
  title: string;
  subtitle: string;
  icon: "alert" | "heart" | "pill" | "list";
  fields: Array<{ key: string; label: string }>;
};

const sections: Section[] = [
  {
    key: "general",
    title: "Generales",
    subtitle: "Alertas, enfermedades, medicamentos, habitos y diagnostico inicial.",
    icon: "alert",
    fields: [
      { key: "medicalAlerts", label: "Alertas medicas" },
      { key: "diseases", label: "Enfermedades" },
      { key: "medications", label: "Medicamentos" },
      { key: "habits", label: "Habitos" },
      { key: "allergies", label: "Alergias" },
      { key: "diagnosis", label: "Diagnostico" },
      { key: "prognosis", label: "Pronostico" }
    ]
  },
  {
    key: "family",
    title: "Antecedentes heredofamiliares",
    subtitle: "Condiciones relevantes en familiares directos.",
    icon: "heart",
    fields: [
      { key: "familyDiabetes", label: "Diabetes" },
      { key: "familyHypertension", label: "Hipertension arterial" },
      { key: "familyHeartDisease", label: "Cardiopatias" },
      { key: "familyCancer", label: "Neoplasias" },
      { key: "familyEpilepsy", label: "Epilepsia" },
      { key: "familyMalformations", label: "Malformaciones" },
      { key: "familyHiv", label: "VIH" },
      { key: "familyKidney", label: "Enfermedades renales" },
      { key: "familyHepatitis", label: "Hepatitis" },
      { key: "familyArthritis", label: "Artritis" },
      { key: "familyOther", label: "Otros" },
      { key: "familyHealthy", label: "Aparentemente sano" }
    ]
  },
  {
    key: "pathological",
    title: "Antecedentes personales patologicos",
    subtitle: "Enfermedades previas, sistemicas, quirurgicas y transmisibles.",
    icon: "heart",
    fields: [
      { key: "chickenpox", label: "Varicela" },
      { key: "rubella", label: "Rubeola" },
      { key: "measles", label: "Sarampion" },
      { key: "mumps", label: "Parotiditis" },
      { key: "whoopingCough", label: "Tosferina" },
      { key: "scarletFever", label: "Escarlatina" },
      { key: "parasitosis", label: "Parasitosis" },
      { key: "hepatitis", label: "Hepatitis" },
      { key: "hiv", label: "VIH" },
      { key: "asthma", label: "Asma" },
      { key: "endocrine", label: "Disfunciones endocrinas" },
      { key: "hypertension", label: "Hipertension" },
      { key: "cancer", label: "Cancer" },
      { key: "std", label: "Enfermedades de transmision sexual" },
      { key: "epilepsy", label: "Epilepsia" },
      { key: "tonsillitis", label: "Amigdalitis de repeticion" },
      { key: "tuberculosis", label: "Tuberculosis" },
      { key: "rheumaticFever", label: "Fiebre reumatica" },
      { key: "diabetes", label: "Diabetes" },
      { key: "cardiovascular", label: "Enfermedades cardiovasculares" },
      { key: "arthritis", label: "Artritis" },
      { key: "trauma", label: "Traumatismos con secuelas" },
      { key: "surgery", label: "Intervenciones quirurgicas" },
      { key: "transfusions", label: "Transfusiones sanguineas" }
    ]
  },
  {
    key: "nonPathological",
    title: "Antecedentes personales no patologicos",
    subtitle: "Consumo y exposiciones que pueden cambiar el plan odontologico.",
    icon: "pill",
    fields: [
      { key: "tobacco", label: "Tabaco" },
      { key: "alcohol", label: "Alcohol" },
      { key: "drugs", label: "Drogas" },
      { key: "psychoactive", label: "Farmacodependencias o sustancias psicoactivas" }
    ]
  },
  {
    key: "dental",
    title: "Antecedentes odontologicos",
    subtitle: "Higiene, fluoruro y otras rutinas preventivas.",
    icon: "list",
    fields: [
      { key: "brushingFrequency", label: "Frecuencia del cepillado" },
      { key: "dentalFloss", label: "Usa hilo dental" },
      { key: "topicalFluoride", label: "Aplicacion topica de fluoruros" },
      { key: "fluorideRinse", label: "Enjuagues con fluoruro" },
      { key: "selfFluoride", label: "Autoaplicacion de fluoruro" },
      { key: "dentalOther", label: "Otros" }
    ]
  },
  {
    key: "systems",
    title: "Interrogatorio por aparatos y sistemas",
    subtitle: "Revision clinica general para detectar riesgos antes del tratamiento.",
    icon: "list",
    fields: [
      { key: "cardiovascularSystem", label: "Sistema cardiovascular" },
      { key: "respiratorySystem", label: "Sistema respiratorio" },
      { key: "gastrointestinalSystem", label: "Sistema gastrointestinal" },
      { key: "genitourinarySystem", label: "Sistema genitourinario" },
      { key: "pregnancies", label: "Embarazos" },
      { key: "abortions", label: "Abortos" },
      { key: "musculoskeletalSystem", label: "Sistema musculoesqueletico" },
      { key: "neurologicalSystem", label: "Sistema neurologico" }
    ]
  },
  {
    key: "headNeck",
    title: "Exploracion de cabeza y cuello",
    subtitle: "Hallazgos visibles y funcionales relevantes para la atencion dental.",
    icon: "list",
    fields: [
      { key: "headShape", label: "Forma de cabeza" },
      { key: "profile", label: "Perfil" },
      { key: "lipColor", label: "Color de labios" },
      { key: "lipAspect", label: "Aspecto de labios" },
      { key: "lipLesions", label: "Presencia de lesiones en labios" },
      { key: "neckExploration", label: "Exploracion de cuello" },
      { key: "rightLaterality", label: "Lateralidad derecha" },
      { key: "leftLaterality", label: "Lateralidad izquierda" },
      { key: "tmj", label: "Articulacion temporomandibular" }
    ]
  }
];

const allFields = sections.flatMap((section) => section.fields);

export function ClinicalMedicalHistoryPage() {
  const { id = "" } = useParams();
  const summary = useClinicalSummary(id);
  const mutations = useClinicalMutations(id);
  const [form, setForm] = useState<MedicalHistoryForm>(() => emptyForm());
  const [allergy, setAllergy] = useState({ name: "", reaction: "", severity: "", notes: "" });
  const [medication, setMedication] = useState({ name: "", dosage: "", frequency: "", notes: "" });
  const [condition, setCondition] = useState({ name: "", notes: "" });

  useEffect(() => {
    const history = summary.data?.history;
    if (!history) return;
    const parsed = parseHistoryNotes(history.notes);
    setForm({
      bloodType: history.bloodType ?? "",
      generalNotes: parsed.generalNotes,
      fields: mergeKnownFlags(parsed.fields, {
        diabetes: history.hasDiabetes,
        hypertension: history.hasHypertension,
        cardiovascular: history.hasHeartDisease,
        pregnancies: history.isPregnant,
        tobacco: history.smokes,
        alcohol: history.drinksAlcohol
      })
    });
  }, [summary.data?.history]);

  const stats = useMemo(() => {
    const values = Object.values(form.fields);
    return {
      present: values.filter((field) => field.enabled).length,
      notApplicable: values.filter((field) => field.notApplicable).length,
      pending: values.filter((field) => !field.enabled && !field.notApplicable).length
    };
  }, [form.fields]);

  const save = () => {
    const fields = form.fields;
    void mutations.upsertHistory.mutate({
      bloodType: form.bloodType,
      hasDiabetes: fields.diabetes.enabled,
      hasHypertension: fields.hypertension.enabled,
      hasHeartDisease: fields.cardiovascular.enabled,
      isPregnant: fields.pregnancies.enabled,
      smokes: fields.tobacco.enabled,
      drinksAlcohol: fields.alcohol.enabled,
      notes: serializeHistoryNotes(form)
    });
  };

  return (
    <ClinicalShell patientId={id} title="Antecedentes medicos" description="Historia clinica general y factores de riesgo.">
      <section className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Antecedentes medicos</h2>
                <p className="mt-1 text-sm text-slate-500">Registra riesgos, enfermedades, habitos, medicamentos y exploracion inicial.</p>
              </div>
              <Button onClick={save} disabled={mutations.upsertHistory.isPending}>
                {mutations.upsertHistory.isPending ? "Guardando..." : "Guardar antecedentes"}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">Tipo de sangre</span>
                <Input placeholder="Ej. O+" value={form.bloodType} onChange={(event) => setForm((current) => ({ ...current, bloodType: event.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">Comentarios generales</span>
                <Textarea rows={2} placeholder="Observaciones generales de la historia clinica." value={form.generalNotes} onChange={(event) => setForm((current) => ({ ...current, generalNotes: event.target.value }))} />
              </label>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#08736f]" />
              <h3 className="text-sm font-semibold text-slate-950">Resumen</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Presentes" value={stats.present} tone="text-red-600" />
              <Metric label="No aplica" value={stats.notApplicable} tone="text-emerald-600" />
              <Metric label="Pendientes" value={stats.pending} tone="text-slate-500" />
            </div>
            <p className="text-xs leading-5 text-slate-500">Los campos marcados como presentes alimentan el resumen clinico. Los detalles quedan guardados en el expediente del paciente.</p>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            {sections.map((section) => (
              <MedicalSection key={section.key} section={section} values={form.fields} onChange={(key, value) => setForm((current) => ({ ...current, fields: { ...current.fields, [key]: value } }))} />
            ))}
          </div>

          <aside className="space-y-4">
            <QuickAddCard
              title="Alergias"
              help="Agrega alergias formales al encabezado clinico del paciente."
              values={[
                { placeholder: "Nombre", value: allergy.name, onChange: (value) => setAllergy((current) => ({ ...current, name: value })) },
                { placeholder: "Reaccion", value: allergy.reaction, onChange: (value) => setAllergy((current) => ({ ...current, reaction: value })) },
                { placeholder: "Severidad", value: allergy.severity, onChange: (value) => setAllergy((current) => ({ ...current, severity: value })) }
              ]}
              disabled={!allergy.name}
              onSubmit={() => {
                void mutations.createAllergy.mutate(allergy);
                setAllergy({ name: "", reaction: "", severity: "", notes: "" });
              }}
            />

            <QuickAddCard
              title="Medicamentos"
              help="Registra medicamentos activos para revisar interacciones."
              values={[
                { placeholder: "Nombre", value: medication.name, onChange: (value) => setMedication((current) => ({ ...current, name: value })) },
                { placeholder: "Dosis", value: medication.dosage, onChange: (value) => setMedication((current) => ({ ...current, dosage: value })) },
                { placeholder: "Frecuencia", value: medication.frequency, onChange: (value) => setMedication((current) => ({ ...current, frequency: value })) }
              ]}
              disabled={!medication.name}
              onSubmit={() => {
                void mutations.createMedication.mutate(medication);
                setMedication({ name: "", dosage: "", frequency: "", notes: "" });
              }}
            />

            <QuickAddCard
              title="Condiciones"
              help="Registra condiciones medicas adicionales no clasificadas."
              values={[{ placeholder: "Condicion", value: condition.name, onChange: (value) => setCondition((current) => ({ ...current, name: value })) }]}
              details={{ value: condition.notes, onChange: (value) => setCondition((current) => ({ ...current, notes: value })) }}
              disabled={!condition.name}
              onSubmit={() => {
                void mutations.createCondition.mutate(condition);
                setCondition({ name: "", notes: "" });
              }}
            />
          </aside>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <DataTable
            rows={summary.data?.allergies ?? []}
            empty={<EmptyState title="Sin alergias" description="No hay alergias registradas." />}
            columns={[
              { key: "name", title: "Alergia" },
              { key: "severity", title: "Severidad" }
            ]}
          />
          <DataTable
            rows={summary.data?.medications ?? []}
            empty={<EmptyState title="Sin medicamentos" description="No hay medicamentos activos." />}
            columns={[
              { key: "name", title: "Medicamento" },
              { key: "dosage", title: "Dosis" }
            ]}
          />
          <DataTable
            rows={summary.data?.conditions ?? []}
            empty={<EmptyState title="Sin condiciones" description="No hay condiciones registradas." />}
            columns={[
              { key: "name", title: "Condicion" },
              { key: "notes", title: "Notas" }
            ]}
          />
        </div>
      </section>
    </ClinicalShell>
  );
}

function MedicalSection({
  section,
  values,
  onChange
}: {
  section: Section;
  values: Record<string, FieldState>;
  onChange: (key: string, value: FieldState) => void;
}) {
  const present = section.fields.filter((field) => values[field.key]?.enabled).length;
  const Icon = section.icon === "alert" ? AlertTriangle : section.icon === "heart" ? HeartPulse : section.icon === "pill" ? Pill : ClipboardList;

  return (
    <Card className="overflow-hidden p-0">
      <details open={section.key === "general"} className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 marker:hidden">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded bg-[#08736f]/10 text-[#08736f]">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">{section.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{section.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{present} presentes</span>
            <span className="text-xs font-semibold text-slate-400 group-open:hidden">Abrir</span>
            <span className="hidden text-xs font-semibold text-slate-400 group-open:inline">Cerrar</span>
          </div>
        </summary>
        <div className="divide-y divide-slate-100">
          {section.fields.map((field) => (
            <MedicalField key={field.key} label={field.label} value={values[field.key] ?? emptyField()} onChange={(value) => onChange(field.key, value)} />
          ))}
        </div>
      </details>
    </Card>
  );
}

function MedicalField({ label, value, onChange }: { label: string; value: FieldState; onChange: (value: FieldState) => void }) {
  return (
    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[240px_220px_1fr] lg:items-center">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-400">Selecciona estado y agrega detalles si aplica.</p>
      </div>
      <div className="inline-grid grid-cols-2 rounded border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          className={cn("inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-semibold text-slate-500", value.notApplicable && "bg-white text-emerald-700 shadow-sm")}
          onClick={() => onChange({ ...value, enabled: false, notApplicable: !value.notApplicable })}
        >
          <CircleSlash className="h-3.5 w-3.5" />
          No aplica
        </button>
        <button
          type="button"
          className={cn("inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-semibold text-slate-500", value.enabled && "bg-white text-red-700 shadow-sm")}
          onClick={() => onChange({ ...value, enabled: !value.enabled, notApplicable: false })}
        >
          <Check className="h-3.5 w-3.5" />
          Presente
        </button>
      </div>
      <Input placeholder="Detalles" value={value.details} onChange={(event) => onChange({ ...value, details: event.target.value })} />
    </div>
  );
}

function QuickAddCard({
  title,
  help,
  values,
  details,
  disabled,
  onSubmit
}: {
  title: string;
  help: string;
  values: Array<{ placeholder: string; value: string; onChange: (value: string) => void }>;
  details?: { value: string; onChange: (value: string) => void };
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <HelpTooltip content={help} />
      </div>
      <div className="space-y-2">
        {values.map((item) => (
          <Input key={item.placeholder} placeholder={item.placeholder} value={item.value} onChange={(event) => item.onChange(event.target.value)} />
        ))}
        {details ? <Textarea rows={2} placeholder="Notas" value={details.value} onChange={(event) => details.onChange(event.target.value)} /> : null}
      </div>
      <Button className="w-full" variant="secondary" disabled={disabled} onClick={onSubmit}>
        <Plus className="mr-1.5 h-4 w-4" />
        Agregar
      </Button>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-3">
      <p className={cn("text-lg font-semibold", tone)}>{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function emptyForm(): MedicalHistoryForm {
  return {
    bloodType: "",
    generalNotes: "",
    fields: Object.fromEntries(allFields.map((field) => [field.key, emptyField()]))
  };
}

function emptyField(): FieldState {
  return { enabled: false, notApplicable: false, details: "" };
}

function parseHistoryNotes(notes?: string | null): Pick<MedicalHistoryForm, "generalNotes" | "fields"> {
  const fallback = { generalNotes: notes ?? "", fields: emptyForm().fields };
  if (!notes) return fallback;

  try {
    const parsed = JSON.parse(notes) as { schema?: string; generalNotes?: string; fields?: Record<string, Partial<FieldState>> };
    if (parsed.schema !== NOTE_SCHEMA) return fallback;

    return {
      generalNotes: parsed.generalNotes ?? "",
      fields: Object.fromEntries(
        allFields.map((field) => {
          const item = parsed.fields?.[field.key];
          return [
            field.key,
            {
              enabled: Boolean(item?.enabled),
              notApplicable: Boolean(item?.notApplicable),
              details: typeof item?.details === "string" ? item.details : ""
            }
          ];
        })
      )
    };
  } catch {
    return fallback;
  }
}

function serializeHistoryNotes(form: MedicalHistoryForm) {
  return JSON.stringify({
    schema: NOTE_SCHEMA,
    generalNotes: form.generalNotes,
    fields: form.fields
  });
}

function mergeKnownFlags(fields: Record<string, FieldState>, flags: Record<string, boolean>) {
  const merged = { ...fields };
  for (const [key, enabled] of Object.entries(flags)) {
    merged[key] = {
      ...(merged[key] ?? emptyField()),
      enabled,
      notApplicable: enabled ? false : (merged[key]?.notApplicable ?? false)
    };
  }
  return merged;
}
