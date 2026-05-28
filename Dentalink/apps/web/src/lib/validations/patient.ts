import { z } from "zod";

const optionalString = z.string().trim().optional().or(z.literal(""));

const patientFormBaseSchema = z.object({
  branchId: z.string().min(1, "Sucursal requerida"),
  firstName: optionalString,
  lastName: optionalString,
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
      context.addIssue({ code: "custom", message: "Nombre requerido", path: ["firstName"] });
    }

    if (values.lastName?.trim() && values.lastName.trim().length < 2) {
      context.addIssue({ code: "custom", message: "Apellido requerido", path: ["lastName"] });
    }
  });
}

export const patientFormSchema = createPatientFormSchema();
