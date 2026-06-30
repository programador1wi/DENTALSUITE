import { z } from "zod";

export const GENDERS = ["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_DECIR"] as const;

export const MEXICO_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
] as const;

const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/;
const addressRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s.,\- '#]*$/;
const phoneRegex = /^\+?[0-9]{10,15}$/;

const nameString = z.string().trim().regex(nameRegex, "Solo se permiten letras, espacios, guiones y comillas").optional().or(z.literal(""));
const addressString = z.string().trim().regex(addressRegex, "Contiene caracteres no permitidos").optional().or(z.literal(""));
const phoneString = z.string().trim().regex(phoneRegex, "Debe ser un número válido de 10 a 15 dígitos").optional().or(z.literal(""));
const optionalString = z.string().trim().optional().or(z.literal(""));

const patientFormBaseSchema = z.object({
  branchId: z.string().min(1, "Sucursal requerida"),
  firstName: nameString,
  lastName: nameString,
  birthDate: optionalString,
  gender: z.enum(GENDERS, { message: "Género no válido" }).optional().or(z.literal("")),
  documentType: optionalString,
  documentNumber: z.string().trim().regex(/^[a-zA-Z0-9-]*$/, "Documento inválido").optional().or(z.literal("")),
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  phone: phoneString,
  alternatePhone: phoneString,
  occupation: optionalString,
  referredBy: optionalString,
  source: optionalString,
  status: z.enum(["NEW", "ACTIVE", "IN_TREATMENT", "INACTIVE", "DEBTOR", "COMPLETED"]),
  addressStreet: addressString,
  addressCity: addressString,
  addressState: z.enum(MEXICO_STATES, { message: "Estado no válido" }).optional().or(z.literal("")),
  addressCountry: addressString,
  addressZipCode: z.string().trim().regex(/^[0-9]*$/, "Código postal inválido").optional().or(z.literal("")),
  emergencyName: nameString,
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

export function createPatientFormSchema(requiredFields: Partial<Record<RequiredPatientField, string>> = defaultRequiredFields) {
  return patientFormBaseSchema.superRefine((values, context) => {
    const mergedRequiredFields = { ...defaultRequiredFields, ...requiredFields };

    for (const [field, message] of Object.entries(mergedRequiredFields) as Array<[RequiredPatientField, string]>) {
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
  });
}

export const patientFormSchema = createPatientFormSchema();

