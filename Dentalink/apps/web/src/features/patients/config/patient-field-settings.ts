import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PatientFormValues } from "@/lib/validations/patient";
import {
  getPatientFieldConfig,
  updatePatientFieldConfig,
  type PatientFieldConfigRecord
} from "../services/patient-field-config.service";

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
  lockedContexts?: PatientFieldContext[];
  label: string;
};

export const PATIENT_FIELD_CONTEXTS: Array<{ id: PatientFieldContext; label: string; description: string }> =
  [
    {
      id: "newPatient",
      label: "En seccion de nuevo paciente",
      description:
        "Controla los campos visibles y obligatorios al registrar un paciente desde Pacientes > Nuevo paciente."
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
    description:
      "Nombre oficial con el que la persona sera identificada en el expediente, comprobantes y documentos clinicos.",
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
    description: "Nombre elegido por el paciente para su trato cotidiano y comunicaciones no legales.",
    formFields: ["socialName"]
  },
  {
    id: "lastName",
    label: "Apellidos",
    description:
      "Apellidos legales del paciente. Se usan para busqueda, ficha clinica y documentos administrativos.",
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
    description:
      "Identificador fiscal o civil del paciente. Permite evitar duplicados y completar documentos administrativos.",
    formFields: ["documentNumber", "documentType"],
    defaultByContext: { checkIn: { present: true, required: true } }
  },
  {
    id: "email",
    label: "Email",
    description:
      "Correo usado para comunicaciones, recordatorios, comprobantes y acceso a canales digitales.",
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
    description: "Convenio vigente asociado al paciente para beneficios y reglas de precios.",
    formFields: ["agreementId"]
  },
  {
    id: "internalNumber",
    label: "Numero interno",
    description: "Identificador interno del expediente dentro de la organizacion.",
    formFields: ["internalNumber"]
  },
  {
    id: "sex",
    label: "Sexo",
    description: "Sexo registrado para antecedentes clinicos y administrativos.",
    formFields: ["sex"]
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
    description:
      "Fecha de nacimiento del paciente. Ayuda a calcular edad y validar atenciones segun etapa de vida.",
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
    lockedContexts: ["onlineAgenda"],
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
    description: "Empresa o entidad empleadora del paciente.",
    formFields: ["employer"]
  },
  {
    id: "observations",
    label: "Observaciones",
    description: "Notas administrativas generales capturadas al registrar o actualizar al paciente.",
    formFields: ["observations"]
  },
  {
    id: "guardian",
    label: "Apoderado",
    description:
      "Persona responsable o contacto principal cuando el paciente requiere tutor o representante.",
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
    id: "guardianDocument",
    label: "CURP/RFC Tutor legal",
    description: "Documento de identidad del tutor o representante legal.",
    formFields: ["emergencyName", "emergencyDocumentNumber"]
  },
  {
    id: "guardianSocialName",
    label: "Nombre social tutor",
    description: "Nombre social del tutor o representante legal.",
    formFields: ["emergencyName", "emergencySocialName"]
  },
  {
    id: "guardianGender",
    label: "Genero tutor",
    description: "Genero declarado por el tutor o representante legal.",
    formFields: ["emergencyName", "emergencyGender"]
  }
];

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

export function normalizePatientFieldSettings(
  value?: Partial<PatientFieldSettings> | null
): PatientFieldSettings {
  const defaults = createDefaultPatientFieldSettings();

  for (const context of PATIENT_FIELD_CONTEXTS) {
    for (const field of PATIENT_FIELD_DEFINITIONS) {
      const stored = value?.[context.id]?.[field.id];
      const next = stored
        ? { present: Boolean(stored.present), required: Boolean(stored.required) }
        : defaults[context.id][field.id];

      if (next.required) next.present = true;
      if (field.isSystemRequired) {
        next.present = true;
        next.required = true;
      }
      if (field.lockedContexts?.includes(context.id)) {
        next.present = true;
        next.required = true;
      }

      defaults[context.id][field.id] = next;
    }
  }

  return defaults;
}

export function recordsToSettings(records: PatientFieldConfigRecord[]): PatientFieldSettings {
  const settings = createDefaultPatientFieldSettings();
  if (!records || !Array.isArray(records)) return settings;

  for (const rec of records) {
    if (settings.newPatient[rec.fieldKey]) {
      settings.newPatient[rec.fieldKey] = {
        present: rec.newPatientPresent,
        required: rec.newPatientRequired
      };
    }
    if (settings.appointment[rec.fieldKey]) {
      settings.appointment[rec.fieldKey] = {
        present: rec.appointmentPresent,
        required: rec.appointmentRequired
      };
    }
    if (settings.onlineAgenda[rec.fieldKey]) {
      settings.onlineAgenda[rec.fieldKey] = {
        present: rec.onlineAgendaPresent,
        required: rec.onlineAgendaRequired
      };
    }
    if (settings.checkIn[rec.fieldKey]) {
      settings.checkIn[rec.fieldKey] = { present: rec.checkInPresent, required: rec.checkInRequired };
    }
  }

  return normalizePatientFieldSettings(settings);
}

export function settingsToRecords(settings: PatientFieldSettings): PatientFieldConfigRecord[] {
  const normalized = normalizePatientFieldSettings(settings);
  return PATIENT_FIELD_DEFINITIONS.map((field) => ({
    fieldKey: field.id,
    isSystemRequired: field.isSystemRequired || false,
    newPatientPresent: normalized.newPatient[field.id]?.present || false,
    newPatientRequired: normalized.newPatient[field.id]?.required || false,
    appointmentPresent: normalized.appointment[field.id]?.present || false,
    appointmentRequired: normalized.appointment[field.id]?.required || false,
    onlineAgendaPresent: normalized.onlineAgenda[field.id]?.present || false,
    onlineAgendaRequired: normalized.onlineAgenda[field.id]?.required || false,
    checkInPresent: normalized.checkIn[field.id]?.present || false,
    checkInRequired: normalized.checkIn[field.id]?.required || false
  }));
}

export function usePatientFieldSettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<PatientFieldSettings | null>(null);

  const query = useQuery({
    queryKey: ["patient-field-config"],
    queryFn: getPatientFieldConfig,
    staleTime: 5 * 60 * 1000
  });

  const mutation = useMutation({
    mutationFn: updatePatientFieldConfig,
    onSuccess: (updatedRecords) => {
      queryClient.setQueryData(["patient-field-config"], updatedRecords);
      setLocalSettings(recordsToSettings(updatedRecords));
    }
  });

  const serverSettings = useMemo(() => {
    return query.data ? recordsToSettings(query.data) : createDefaultPatientFieldSettings();
  }, [query.data]);

  const settings = localSettings ?? serverSettings;

  const updateSettings = (next: PatientFieldSettings) => {
    const normalized = normalizePatientFieldSettings(next);
    setLocalSettings(normalized);
  };

  const saveSettings = () => mutation.mutateAsync(settingsToRecords(settings));

  return [
    settings,
    updateSettings,
    {
      saveSettings,
      isLoading: query.isLoading,
      isSaving: mutation.isPending,
      error: query.error ?? mutation.error
    }
  ] as const;
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
