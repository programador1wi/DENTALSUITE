import { useEffect, useMemo, useState } from "react";
import type { PatientFormValues } from "@/lib/validations/patient";

export type PatientFieldContext = "newPatient" | "appointment" | "onlineAgenda" | "checkIn";
export type PatientFieldPermission = {
  present: boolean;
  required: boolean;
};
export type PatientFieldSettings = Record<PatientFieldContext, Record<string, PatientFieldPermission>>;

type PatientFormField = keyof PatientFormValues;

export type PatientFieldDefinition = {
  defaultByContext?: Partial<Record<PatientFieldContext, PatientFieldPermission>>;
  description: string;
  formFields?: PatientFormField[];
  id: string;
  isSystemRequired?: boolean;
  label: string;
};

export const PATIENT_FIELD_CONTEXTS: Array<{ id: PatientFieldContext; label: string; description: string }> = [
  {
    id: "newPatient",
    label: "En seccion de nuevo paciente",
    description: "Controla los campos visibles y obligatorios al registrar un paciente desde Pacientes > Nuevo paciente."
  },
  {
    id: "appointment",
    label: "Al crear paciente agendando",
    description: "Define los datos que se solicitaran al crear un paciente rapido durante el agendamiento."
  },
  {
    id: "onlineAgenda",
    label: "En seccion de agenda online",
    description: "Define los datos que el paciente debera completar desde la agenda online."
  },
  {
    id: "checkIn",
    label: "Al enviar check in",
    description: "Controla los datos que se muestran y validan cuando se envia un formulario de check-in."
  }
];

export const PATIENT_FIELD_DEFINITIONS: PatientFieldDefinition[] = [
  {
    id: "legalName",
    label: "Nombre legal",
    description: "Nombre oficial con el que la persona sera identificada en el expediente, comprobantes y documentos clinicos.",
    formFields: ["firstName"],
    isSystemRequired: true,
    defaultByContext: {
      newPatient: { present: true, required: true },
      appointment: { present: true, required: true },
      onlineAgenda: { present: true, required: true },
      checkIn: { present: true, required: true }
    }
  },
  {
    id: "socialName",
    label: "Nombre social",
    description: "Nombre por el cual la persona se siente identificada y quiere ser llamada durante la atencion."
  },
  {
    id: "lastName",
    label: "Apellidos",
    description: "Apellidos legales del paciente. Se usan para busqueda, ficha clinica y documentos administrativos.",
    formFields: ["lastName"],
    isSystemRequired: true,
    defaultByContext: {
      newPatient: { present: true, required: true },
      appointment: { present: true, required: true },
      onlineAgenda: { present: true, required: true },
      checkIn: { present: true, required: true }
    }
  },
  {
    id: "curp",
    label: "CURP/RFC",
    description: "Identificador fiscal o civil del paciente. Permite evitar duplicados y completar documentos administrativos.",
    formFields: ["documentType", "documentNumber"],
    defaultByContext: { checkIn: { present: true, required: true } }
  },
  {
    id: "email",
    label: "Email",
    description: "Correo usado para comunicaciones, recordatorios, comprobantes y acceso a canales digitales.",
    formFields: ["email"],
    defaultByContext: {
      appointment: { present: true, required: true },
      onlineAgenda: { present: true, required: true },
      checkIn: { present: true, required: true }
    }
  },
  {
    id: "agreement",
    label: "Convenio",
    description: "Convenio comercial o aseguradora asociada al paciente para aplicar condiciones administrativas."
  },
  {
    id: "internalNumber",
    label: "Numero interno",
    description: "Codigo interno de la clinica para identificar expedientes o migraciones desde otros sistemas."
  },
  {
    id: "sex",
    label: "Sexo",
    description: "Dato biologico utilizado cuando aplica para anamnesis, estadistica o documentos clinicos."
  },
  {
    id: "gender",
    label: "Genero",
    description: "Identidad de genero declarada por el paciente para una atencion respetuosa y consistente.",
    formFields: ["gender"]
  },
  {
    id: "birthDate",
    label: "Fecha nacimiento",
    description: "Fecha de nacimiento del paciente. Ayuda a calcular edad y validar atenciones segun etapa de vida.",
    formFields: ["birthDate"],
    defaultByContext: { checkIn: { present: true, required: true } }
  },
  {
    id: "city",
    label: "Ciudad",
    description: "Ciudad de residencia del paciente para segmentacion, contacto y gestion administrativa.",
    formFields: ["addressCity"]
  },
  {
    id: "delegation",
    label: "Delegacion",
    description: "Municipio, comuna o delegacion de residencia para complementar la direccion del paciente.",
    formFields: ["addressState"]
  },
  {
    id: "address",
    label: "Direccion",
    description: "Domicilio principal del paciente para documentos, contacto y registro administrativo.",
    formFields: ["addressStreet"]
  },
  {
    id: "fixedPhone",
    label: "Telefono fijo",
    description: "Numero alternativo de contacto del paciente o su domicilio.",
    formFields: ["alternatePhone"]
  },
  {
    id: "mobilePhone",
    label: "Telefono movil",
    description: "Numero principal para llamadas, WhatsApp, recordatorios y seguimiento de agenda.",
    formFields: ["phone"],
    defaultByContext: {
      newPatient: { present: true, required: true },
      appointment: { present: true, required: true },
      onlineAgenda: { present: true, required: true },
      checkIn: { present: true, required: true }
    }
  },
  {
    id: "profession",
    label: "Actividad o profesion",
    description: "Actividad laboral o profesion del paciente, util para contexto clinico y administrativo.",
    formFields: ["occupation"]
  },
  {
    id: "employer",
    label: "Empleador",
    description: "Entidad empleadora del paciente cuando es relevante para convenios o facturacion."
  },
  {
    id: "observations",
    label: "Observaciones",
    description: "Notas administrativas generales visibles para recepcion o equipos de gestion."
  },
  {
    id: "guardian",
    label: "Apoderado",
    description: "Persona responsable o contacto principal cuando el paciente requiere tutor o representante.",
    formFields: ["emergencyName", "emergencyRelationship", "emergencyPhone", "emergencyEmail"]
  },
  {
    id: "reference",
    label: "Referencia",
    description: "Origen o persona que refirio al paciente a la clinica.",
    formFields: ["referredBy"]
  },
  {
    id: "type",
    label: "Tipo",
    description: "Clasificacion administrativa inicial del paciente dentro del flujo de atencion.",
    formFields: ["status"],
    defaultByContext: {
      newPatient: { present: true, required: false },
      appointment: { present: true, required: false }
    }
  },
  {
    id: "guardianCurp",
    label: "CURP/RFC Tutor legal",
    description: "Identificador del tutor legal o representante del paciente cuando corresponde."
  },
  {
    id: "socialNameSecondary",
    label: "Nombre social tutor",
    description: "Nombre social del tutor o representante legal, si la clinica decide registrarlo."
  },
  {
    id: "genderSecondary",
    label: "Genero tutor",
    description: "Genero declarado del tutor o representante legal, cuando sea necesario para el registro."
  }
];

export const PATIENT_FIELD_SETTINGS_KEY = "dentalwarner-patient-field-settings";

function emptyPermission(): PatientFieldPermission {
  return { present: false, required: false };
}

export function createDefaultPatientFieldSettings(): PatientFieldSettings {
  return Object.fromEntries(
    PATIENT_FIELD_CONTEXTS.map((context) => [
      context.id,
      Object.fromEntries(
        PATIENT_FIELD_DEFINITIONS.map((field) => {
          const configured = field.defaultByContext?.[context.id];
          return [field.id, configured ?? emptyPermission()];
        })
      )
    ])
  ) as PatientFieldSettings;
}

export function normalizePatientFieldSettings(value?: Partial<PatientFieldSettings> | null): PatientFieldSettings {
  const defaults = createDefaultPatientFieldSettings();

  for (const context of PATIENT_FIELD_CONTEXTS) {
    for (const field of PATIENT_FIELD_DEFINITIONS) {
      const stored = value?.[context.id]?.[field.id];
      const next = stored ? { present: Boolean(stored.present), required: Boolean(stored.required) } : defaults[context.id][field.id];

      if (next.required) next.present = true;
      if (field.isSystemRequired) {
        next.present = true;
        next.required = true;
      }

      defaults[context.id][field.id] = next;
    }
  }

  return defaults;
}

export function readPatientFieldSettings() {
  if (typeof window === "undefined") return createDefaultPatientFieldSettings();

  const stored = window.localStorage.getItem(PATIENT_FIELD_SETTINGS_KEY);
  if (!stored) return createDefaultPatientFieldSettings();

  try {
    return normalizePatientFieldSettings(JSON.parse(stored) as Partial<PatientFieldSettings>);
  } catch {
    return createDefaultPatientFieldSettings();
  }
}

export function writePatientFieldSettings(settings: PatientFieldSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PATIENT_FIELD_SETTINGS_KEY, JSON.stringify(normalizePatientFieldSettings(settings)));
  window.dispatchEvent(new Event("patient-field-settings-change"));
}

export function usePatientFieldSettings() {
  const [settings, setSettings] = useState<PatientFieldSettings>(() => readPatientFieldSettings());

  useEffect(() => {
    const sync = () => setSettings(readPatientFieldSettings());
    window.addEventListener("storage", sync);
    window.addEventListener("patient-field-settings-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("patient-field-settings-change", sync);
    };
  }, []);

  const updateSettings = (next: PatientFieldSettings) => {
    const normalized = normalizePatientFieldSettings(next);
    setSettings(normalized);
    writePatientFieldSettings(normalized);
  };

  return [settings, updateSettings] as const;
}

export function usePatientFieldContext(context: PatientFieldContext) {
  const [settings] = usePatientFieldSettings();
  return useMemo(() => settings[context], [context, settings]);
}

export function getVisibleFormFields(contextSettings: Record<string, PatientFieldPermission>) {
  const visible = new Set<PatientFormField>();

  for (const field of PATIENT_FIELD_DEFINITIONS) {
    if (field.isSystemRequired || contextSettings[field.id]?.present) {
      field.formFields?.forEach((formField) => visible.add(formField));
    }
  }

  return visible;
}

export function getRequiredFormFields(contextSettings: Record<string, PatientFieldPermission>) {
  const required = new Set<PatientFormField>();

  for (const field of PATIENT_FIELD_DEFINITIONS) {
    if (field.isSystemRequired || contextSettings[field.id]?.required) {
      field.formFields?.forEach((formField) => required.add(formField));
    }
  }

  return required;
}
