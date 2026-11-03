export type SchedulingMode = "online" | "express";
export type FieldState = { present: boolean; required: boolean };

type PatientFieldDefinition = {
  defaultPresent?: boolean;
  defaultRequired?: boolean;
  id: string;
  info?: boolean;
  label: string;
};

export type SchedulingSettings = {
  allowedBranches: Record<string, boolean>;
  allowedProfessionals?: string[];
  allowedSpecialties?: string[];
  analyticsCode: string;
  appointmentBlocks: string;
  askSpecialtyReason: boolean;
  brandColor: string;
  chairScope: "all" | "single";
  confirmationMessage?: string;
  facebookPixel: string;
  footerEmail: string;
  footerPhone: string;
  identifyByCurp: boolean;
  identifyByEmail: boolean;
  identifyByMobile: boolean;
  logoName: string;
  maxAvailabilityDays: string;
  maxUnvalidatedAppointments: string;
  menuByBranch: boolean;
  menuByProfessional: boolean;
  menuBySpecialty: boolean;
  onlineEnabled: boolean;
  patientBlockEnabled: boolean;
  patientDataMoment: "start" | "end";
  patientFields: Record<string, FieldState>;
  redirectUrl: string;
  safetyHours: string;
  showAppointmentDuration: boolean;
};

type BackendSchedulingSettings = {
  allowedBranches?: string[];
  allowedProfessionals?: string[];
  allowedSpecialties?: string[];
  requiredPatientFields?: string[];
  footerText?: string;
  googleAnalyticsId?: string;
  blocksPerAppointment?: string | number;
  brandColor?: string;
  confirmationMessage?: string;
  identificationMethod?: string;
  logoUrl?: string;
  maxDaysInAdvance?: string | number;
  maxUnvalidatedAppointmentsPerPatient?: string | number;
  isEnabled?: boolean;
  redirectUrl?: string;
  securityMarginHours?: string | number;
  patientBlockEnabled?: boolean;
  chairScope?: SchedulingSettings["chairScope"];
  facebookPixel?: string;
  menuByProfessional?: boolean;
  menuBySpecialty?: boolean;
  menuByBranch?: boolean;
  patientDataMoment?: SchedulingSettings["patientDataMoment"];
  askSpecialtyReason?: boolean;
  showAppointmentDuration?: boolean;
};

export const patientFieldDefinitions: PatientFieldDefinition[] = [
  { id: "legalName", label: "Nombre legal", info: true, defaultPresent: true, defaultRequired: true },
  { id: "socialName", label: "Nombre social", info: true },
  { id: "lastName", label: "Apellidos", defaultPresent: true, defaultRequired: true },
  { id: "curp", label: "CURP/RFC" },
  { id: "email", label: "Email", defaultPresent: true, defaultRequired: true },
  { id: "agreement", label: "Convenio" },
  { id: "internalNumber", label: "Numero interno" },
  { id: "sex", label: "Sexo", info: true },
  { id: "gender", label: "Genero", info: true },
  { id: "birthDate", label: "Fecha nacimiento" },
  { id: "city", label: "Ciudad" },
  { id: "delegation", label: "Delegacion" },
  { id: "address", label: "Direccion" },
  { id: "fixedPhone", label: "Telefono fijo" },
  { id: "mobilePhone", label: "Telefono movil", defaultPresent: true, defaultRequired: true },
  { id: "profession", label: "Actividad o profesion" },
  { id: "employer", label: "Empleador" },
  { id: "observations", label: "Observaciones" },
  { id: "guardian", label: "Apoderado" },
  { id: "reference", label: "Referencia" },
  { id: "type", label: "Tipo" },
  { id: "guardianCurp", label: "CURP/RFC Tutor legal" }
];

export const brandColors = [
  "#ffffff",
  "#4299e1",
  "#087ed8",
  "#0d5ea5",
  "#5867c5",
  "#0aa7a0",
  "#0c7d77",
  "#61a35e",
  "#da7b45",
  "#dd6d68",
  "#d86194",
  "#414141"
];

function createFieldState() {
  return Object.fromEntries(
    patientFieldDefinitions.map((field) => [
      field.id,
      { present: Boolean(field.defaultPresent), required: Boolean(field.defaultRequired) }
    ])
  ) as Record<string, FieldState>;
}

export function defaultSettings(mode: SchedulingMode): SchedulingSettings {
  return {
    allowedBranches: {},
    allowedProfessionals: [],
    allowedSpecialties: [],
    analyticsCode: "",
    appointmentBlocks: "1",
    askSpecialtyReason: false,
    brandColor: "#087ed8",
    chairScope: "single",
    confirmationMessage:
      "¡Gracias por preferirnos! Tu cita ha sido agendada con éxito. Recuerda llegar 10 minutos antes de la hora acordada.",
    facebookPixel: "",
    footerEmail: "",
    footerPhone: "",
    identifyByCurp: false,
    identifyByEmail: true,
    identifyByMobile: false,
    logoName: "",
    maxAvailabilityDays: "30",
    maxUnvalidatedAppointments: "1",
    menuByBranch: false,
    menuByProfessional: true,
    menuBySpecialty: true,
    onlineEnabled: true,
    patientBlockEnabled: false,
    patientDataMoment: "end",
    patientFields: createFieldState(),
    redirectUrl: "",
    safetyHours: "1",
    showAppointmentDuration: true,
    ...(mode === "express" ? { menuByBranch: true } : {})
  };
}

export function backendToFrontendSettings(
  data: BackendSchedulingSettings | null | undefined,
  mode: SchedulingMode
): SchedulingSettings {
  const defaults = defaultSettings(mode);
  if (!data) return defaults;

  const allowedBranchesRecord: Record<string, boolean> = {};
  if (Array.isArray(data.allowedBranches)) {
    data.allowedBranches.forEach((branchId: string) => {
      allowedBranchesRecord[branchId] = true;
    });
  }

  const patientFields = createFieldState();
  if (Array.isArray(data.requiredPatientFields)) {
    const requiredPatientFields = data.requiredPatientFields;
    Object.keys(patientFields).forEach((fieldId) => {
      const isRequired = requiredPatientFields.includes(fieldId);
      patientFields[fieldId] = { present: isRequired, required: isRequired };
    });
  }

  let footerEmail = "";
  let footerPhone = "";
  if (data.footerText) {
    const parts = data.footerText.split(" ");
    footerEmail = parts[0] || "";
    footerPhone = parts.slice(1).join(" ") || "";
  }

  return {
    ...defaults,
    allowedBranches: Array.isArray(data.allowedBranches) ? allowedBranchesRecord : defaults.allowedBranches,
    allowedProfessionals: Array.isArray(data.allowedProfessionals)
      ? data.allowedProfessionals
      : defaults.allowedProfessionals,
    allowedSpecialties: Array.isArray(data.allowedSpecialties)
      ? data.allowedSpecialties
      : defaults.allowedSpecialties,
    analyticsCode: data.googleAnalyticsId ?? defaults.analyticsCode,
    appointmentBlocks:
      data.blocksPerAppointment !== undefined && data.blocksPerAppointment !== null
        ? String(data.blocksPerAppointment)
        : defaults.appointmentBlocks,
    brandColor: data.brandColor ?? defaults.brandColor,
    confirmationMessage: data.confirmationMessage ?? defaults.confirmationMessage,
    footerEmail,
    footerPhone,
    identifyByCurp: data.identificationMethod === "DOCUMENT",
    identifyByEmail: data.identificationMethod === "EMAIL" || !data.identificationMethod,
    identifyByMobile: data.identificationMethod === "PHONE",
    logoName: data.logoUrl ?? defaults.logoName,
    maxAvailabilityDays:
      data.maxDaysInAdvance !== undefined && data.maxDaysInAdvance !== null
        ? String(data.maxDaysInAdvance)
        : defaults.maxAvailabilityDays,
    maxUnvalidatedAppointments:
      data.maxUnvalidatedAppointmentsPerPatient !== undefined &&
      data.maxUnvalidatedAppointmentsPerPatient !== null
        ? String(data.maxUnvalidatedAppointmentsPerPatient)
        : defaults.maxUnvalidatedAppointments,
    onlineEnabled: data.isEnabled ?? defaults.onlineEnabled,
    patientFields: data.requiredPatientFields ? patientFields : defaults.patientFields,
    redirectUrl: data.redirectUrl ?? defaults.redirectUrl,
    safetyHours:
      data.securityMarginHours !== undefined && data.securityMarginHours !== null
        ? String(data.securityMarginHours)
        : defaults.safetyHours,
    patientBlockEnabled: data.patientBlockEnabled ?? defaults.patientBlockEnabled,
    chairScope: (data.chairScope as SchedulingSettings["chairScope"]) ?? defaults.chairScope,
    facebookPixel: data.facebookPixel ?? defaults.facebookPixel,
    menuByProfessional: data.menuByProfessional ?? defaults.menuByProfessional,
    menuBySpecialty: data.menuBySpecialty ?? defaults.menuBySpecialty,
    menuByBranch: data.menuByBranch ?? defaults.menuByBranch,
    patientDataMoment:
      (data.patientDataMoment as SchedulingSettings["patientDataMoment"]) ?? defaults.patientDataMoment,
    askSpecialtyReason: data.askSpecialtyReason ?? defaults.askSpecialtyReason,
    showAppointmentDuration: data.showAppointmentDuration ?? defaults.showAppointmentDuration
  };
}

export function frontendToBackendDto(newSettings: SchedulingSettings, mode: SchedulingMode) {
  const allowedBranches = Object.entries(newSettings.allowedBranches || {})
    .filter(([, allowed]) => allowed)
    .map(([id]) => id);
  const identificationMethod = newSettings.identifyByCurp
    ? "DOCUMENT"
    : newSettings.identifyByMobile
      ? "PHONE"
      : "EMAIL";
  const requiredPatientFields = Object.entries(newSettings.patientFields || {})
    .filter(([, state]) => state.required)
    .map(([id]) => id);
  const footerText = `${newSettings.footerEmail || ""} ${newSettings.footerPhone || ""}`.trim();

  return {
    isEnabled: newSettings.onlineEnabled,
    mode: mode.toUpperCase(),
    allowedBranches,
    allowedProfessionals: newSettings.allowedProfessionals || [],
    allowedSpecialties: newSettings.allowedSpecialties || [],
    securityMarginHours: parseInt(newSettings.safetyHours || "1", 10),
    blocksPerAppointment: parseInt(newSettings.appointmentBlocks || "1", 10),
    maxDaysInAdvance: parseInt(newSettings.maxAvailabilityDays || "30", 10),
    maxUnvalidatedAppointmentsPerPatient: parseInt(newSettings.maxUnvalidatedAppointments || "1", 10),
    brandColor: newSettings.brandColor,
    logoUrl: newSettings.logoName,
    footerText,
    googleAnalyticsId: newSettings.analyticsCode,
    redirectUrl: newSettings.redirectUrl,
    confirmationMessage: newSettings.confirmationMessage,
    identificationMethod,
    requiredPatientFields,
    patientBlockEnabled: newSettings.patientBlockEnabled,
    chairScope: newSettings.chairScope,
    facebookPixel: newSettings.facebookPixel,
    menuByProfessional: newSettings.menuByProfessional,
    menuBySpecialty: newSettings.menuBySpecialty,
    menuByBranch: newSettings.menuByBranch,
    patientDataMoment: newSettings.patientDataMoment,
    askSpecialtyReason: newSettings.askSpecialtyReason,
    showAppointmentDuration: newSettings.showAppointmentDuration
  };
}
