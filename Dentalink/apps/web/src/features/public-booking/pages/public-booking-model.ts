import type { PublicPatient } from "../services/public-booking.service";

export type PublicBookingStep = 1 | 2 | 3 | 4 | 5;
export type PublicBookingSearchMode = "professional" | "specialty" | "";

export function createEmptyPublicPatient(): PublicPatient {
  return {
    firstName: "",
    socialName: "",
    lastName: "",
    agreementId: "",
    internalNumber: "",
    email: "",
    phone: "",
    documentNumber: "",
    documentType: "",
    birthDate: "",
    sex: "",
    gender: "",
    alternatePhone: "",
    occupation: "",
    employer: "",
    observations: "",
    referredBy: "",
    type: "",
    guardianName: "",
    guardianSocialName: "",
    guardianDocumentNumber: "",
    guardianGender: "",
    guardianRelationship: "",
    guardianPhone: "",
    guardianEmail: "",
    address: { street: "", city: "", state: "" }
  };
}
