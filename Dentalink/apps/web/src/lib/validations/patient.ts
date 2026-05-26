import { z } from "zod";

const optionalString = z.string().trim().optional().or(z.literal(""));

export const patientFormSchema = z.object({
  branchId: z.string().min(1, "Sucursal requerida"),
  firstName: z.string().trim().min(2, "Nombre requerido"),
  lastName: z.string().trim().min(2, "Apellido requerido"),
  birthDate: optionalString,
  gender: optionalString,
  documentType: optionalString,
  documentNumber: optionalString,
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  phone: optionalString,
  alternatePhone: optionalString,
  occupation: optionalString,
  referredBy: optionalString,
  source: optionalString,
  status: z.enum(["NEW", "ACTIVE", "IN_TREATMENT", "INACTIVE", "DEBTOR", "COMPLETED"]),
  addressStreet: optionalString,
  addressCity: optionalString,
  addressState: optionalString,
  addressCountry: optionalString,
  addressZipCode: optionalString,
  emergencyName: optionalString,
  emergencyRelationship: optionalString,
  emergencyPhone: optionalString,
  emergencyEmail: z.string().trim().email("Email invalido").optional().or(z.literal("")),
  alertType: optionalString,
  alertDescription: optionalString,
  alertSeverity: optionalString
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;
