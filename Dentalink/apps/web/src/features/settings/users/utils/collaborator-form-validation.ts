import { z } from "zod";

export type CollaboratorFormValidationInput = {
  editing: boolean;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  branchIds: string[];
  primaryBranchId: string;
  professionalEnabled: boolean;
  professionalBranchId: string;
  specialtyIds: string[];
  commissionRate: string;
  applyWeeklySchedule: boolean;
  workDays: number[];
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
};

export type CollaboratorFormErrorKey = keyof CollaboratorFormValidationInput | "schedule" | "form";

export type CollaboratorFormValidationResult = {
  valid: boolean;
  errors: Partial<Record<CollaboratorFormErrorKey, string>>;
  messages: string[];
  firstMessage?: string;
};

const emailSchema = z.string().trim().email("Ingresa un correo valido.");

const collaboratorFormSchema = z
  .object({
    editing: z.boolean(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    password: z.string(),
    roleId: z.string(),
    branchIds: z.array(z.string()),
    primaryBranchId: z.string(),
    professionalEnabled: z.boolean(),
    professionalBranchId: z.string(),
    specialtyIds: z.array(z.string()),
    commissionRate: z.string(),
    applyWeeklySchedule: z.boolean(),
    workDays: z.array(z.number()),
    startTime: z.string(),
    endTime: z.string(),
    breakStartTime: z.string(),
    breakEndTime: z.string()
  })
  .superRefine((data, ctx) => {
    const addIssue = (path: CollaboratorFormErrorKey, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };

    if (!data.firstName.trim()) addIssue("firstName", "Ingresa el nombre.");
    if (!data.lastName.trim()) addIssue("lastName", "Ingresa el apellido.");
    if (!data.roleId) addIssue("roleId", "Selecciona un rol.");
    if (!data.branchIds.length) addIssue("branchIds", "Selecciona al menos una sucursal de acceso.");
    if (!data.primaryBranchId) {
      addIssue("primaryBranchId", "Selecciona la sucursal principal.");
    } else if (!data.branchIds.includes(data.primaryBranchId)) {
      addIssue("primaryBranchId", "La sucursal principal debe estar dentro del acceso del usuario.");
    }

    if (!data.editing || data.email.trim()) {
      const emailResult = emailSchema.safeParse(data.email);
      if (!emailResult.success) addIssue("email", emailResult.error.issues[0]?.message ?? "Ingresa un correo valido.");
    }

    if (!data.editing && data.password.trim().length < 8) {
      addIssue("password", "La contrasena debe tener al menos 8 caracteres.");
    }

    if (data.professionalEnabled) {
      if (!data.professionalBranchId) {
        addIssue("professionalBranchId", "Selecciona una sucursal clinica para la agenda.");
      } else if (!data.branchIds.includes(data.professionalBranchId)) {
        addIssue("professionalBranchId", "La sucursal clinica debe estar incluida en el acceso del usuario.");
      }

      if (!data.specialtyIds.length) addIssue("specialtyIds", "Selecciona al menos una especialidad.");

      const commissionRate = Number(data.commissionRate);
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        addIssue("commissionRate", "La comision debe estar entre 0 y 100.");
      }

      if (data.applyWeeklySchedule) {
        if (!data.workDays.length) addIssue("workDays", "Selecciona al menos un dia laboral.");

        const start = timeToMinutes(data.startTime);
        const end = timeToMinutes(data.endTime);
        const breakStart = data.breakStartTime ? timeToMinutes(data.breakStartTime) : null;
        const breakEnd = data.breakEndTime ? timeToMinutes(data.breakEndTime) : null;

        if (start === null || end === null || start >= end) {
          addIssue("schedule", "La entrada debe ser menor que la salida.");
        }

        if ((breakStart === null) !== (breakEnd === null)) {
          addIssue("schedule", "Completa inicio y fin de descanso.");
        } else if (start !== null && end !== null && breakStart !== null && breakEnd !== null) {
          if (breakStart >= breakEnd || breakStart < start || breakEnd > end) {
            addIssue("schedule", "El descanso debe quedar dentro del horario laboral.");
          }
        }
      }
    }
  });

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function validateCollaboratorForm(
  input: CollaboratorFormValidationInput
): CollaboratorFormValidationResult {
  const result = collaboratorFormSchema.safeParse(input);
  if (result.success) return { valid: true, errors: {}, messages: [] };

  const errors: Partial<Record<CollaboratorFormErrorKey, string>> = {};
  for (const issue of result.error.issues) {
    const key = (issue.path[0] as CollaboratorFormErrorKey | undefined) ?? "form";
    if (!errors[key]) errors[key] = issue.message;
  }

  const messages = Array.from(new Set(Object.values(errors).filter(Boolean)));
  return {
    valid: false,
    errors,
    messages,
    firstMessage: messages[0]
  };
}
