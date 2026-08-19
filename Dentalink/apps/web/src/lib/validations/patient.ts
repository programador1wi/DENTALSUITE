import { z } from "zod";

export const GENDERS = ["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_DECIR"] as const;

export const MEXICO_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas"
] as const;

const nameRegex = /^[\p{L}\p{M}\s.'’-]+$/u;
const addressRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,\- '#]*$/;
const phoneRegex = /^\+?[0-9\s()-]{7,40}$/;

const nameString = z
  .string()
  .trim()
  .max(100, "Máximo 100 caracteres")
  .regex(nameRegex, "Nombre contiene caracteres no válidos")
  .optional()
  .or(z.literal(""));
const addressString = z
  .string()
  .trim()
  .regex(addressRegex, "Contiene caracteres no permitidos")
  .optional()
  .or(z.literal(""));
const phoneString = z
  .string()
  .trim()
  .regex(phoneRegex, "Formato de teléfono no válido")
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }, "Debe contener entre 7 y 15 dígitos")
  .optional()
  .or(z.literal(""));
const optionalString = z.string().trim().optional().or(z.literal(""));

const patientFormBaseSchema = z.object({
  branchId: z.string().min(1, "Sucursal requerida"),
  firstName: nameString,
  socialName: nameString,
  lastName: nameString,
  agreementId: optionalString,
  internalNumber: optionalString,
  birthDate: optionalString,
  sex: optionalString,
  gender: z.enum(GENDERS, { message: "Género no válido" }).optional().or(z.literal("")),
  documentType: optionalString,
  documentNumber: z
    .string()
    .trim()
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9-]*$/, "Documento inválido")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(254, "Email demasiado largo")
    .email("Email invalido")
    .optional()
    .or(z.literal("")),
  phone: phoneString,
  alternatePhone: phoneString,
  occupation: optionalString,
  employer: optionalString,
  observations: optionalString,
  referredBy: optionalString,
  source: optionalString,
  status: z.enum([
    "NEW",
    "PROVISIONAL",
    "ACTIVE",
    "IN_TREATMENT",
    "INACTIVE",
    "DEBTOR",
    "COMPLETED",
    "MERGED"
  ]),
  addressStreet: addressString,
  addressCity: addressString,
  addressState: z.enum(MEXICO_STATES, { message: "Estado no válido" }).optional().or(z.literal("")),
  addressCountry: addressString,
  addressZipCode: z
    .string()
    .trim()
    .regex(/^[0-9]*$/, "Código postal inválido")
    .optional()
    .or(z.literal("")),
  emergencyName: nameString,
  emergencySocialName: nameString,
  emergencyDocumentNumber: optionalString,
  emergencyGender: optionalString,
  emergencyRelationship: optionalString,
  emergencyPhone: phoneString,
  emergencyEmail: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  alertType: optionalString,
  alertDescription: optionalString,
  alertSeverity: optionalString
});

export type PatientFormValues = z.infer<typeof patientFormBaseSchema>;

type RequiredPatientField = keyof PatientFormValues;

const defaultRequiredFields: Partial<Record<RequiredPatientField, string>> = {
  firstName: "Nombre requerido",
  lastName: "Apellido requerido"
};

export function createPatientFormSchema(
  requiredFields: Partial<Record<RequiredPatientField, string>> = defaultRequiredFields
) {
  return patientFormBaseSchema.superRefine((values, context) => {
    const mergedRequiredFields = { ...defaultRequiredFields, ...requiredFields };

    for (const [field, message] of Object.entries(mergedRequiredFields) as Array<
      [RequiredPatientField, string]
    >) {
      const value = values[field];
      if (typeof value === "string" && value.trim().length > 0) continue;

      context.addIssue({
        code: "custom",
        message,
        path: [field]
      });
    }

    if (values.firstName?.trim() && values.firstName.trim().length < 2) {
      context.addIssue({ code: "custom", message: "Mínimo 2 caracteres", path: ["firstName"] });
    }

    if (values.lastName?.trim() && values.lastName.trim().length < 2) {
      context.addIssue({ code: "custom", message: "Mínimo 2 caracteres", path: ["lastName"] });
    }

    if (values.birthDate) {
      const birthDate = new Date(`${values.birthDate}T00:00:00`);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
        context.addIssue({
          code: "custom",
          message: "Nacimiento no puede estar en el futuro",
          path: ["birthDate"]
        });
      }
    }
  });
}

export const patientFormSchema = createPatientFormSchema();
