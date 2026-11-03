import { describe, expect, it } from "vitest";
import {
  PATIENT_FIELD_DEFINITIONS,
  createDefaultPatientFieldSettings,
  getRequiredFormFields,
  getVisibleFormFields,
  normalizePatientFieldSettings,
  recordsToSettings
} from "./patient-field-settings";

describe("patient field settings", () => {
  it("contains the complete Dentalink field catalog including social and guardian identity", () => {
    expect(PATIENT_FIELD_DEFINITIONS).toHaveLength(24);
    expect(PATIENT_FIELD_DEFINITIONS.map((field) => field.id)).toEqual(
      expect.arrayContaining([
        "socialName",
        "agreement",
        "internalNumber",
        "sex",
        "employer",
        "observations",
        "guardianDocument",
        "guardianSocialName",
        "guardianGender"
      ])
    );
  });

  it("projects Nombre social into a form when the configured context enables it", () => {
    const settings = createDefaultPatientFieldSettings();
    settings.newPatient.socialName = { present: true, required: true };

    expect(getVisibleFormFields(settings.newPatient).has("socialName")).toBe(true);
    expect(getRequiredFormFields(settings.newPatient).has("socialName")).toBe(true);
  });

  it("maps persisted context flags to visible and required form fields", () => {
    const settings = recordsToSettings([
      {
        fieldKey: "birthDate",
        newPatientPresent: false,
        newPatientRequired: false,
        appointmentPresent: true,
        appointmentRequired: true,
        onlineAgendaPresent: false,
        onlineAgendaRequired: false,
        checkInPresent: false,
        checkInRequired: false
      }
    ]);

    expect(getVisibleFormFields(settings.appointment).has("birthDate")).toBe(true);
    expect(getRequiredFormFields(settings.appointment).has("birthDate")).toBe(true);
    expect(getVisibleFormFields(settings.onlineAgenda).has("birthDate")).toBe(false);
  });

  it("keeps identity-critical phone enabled in agenda online", () => {
    const settings = createDefaultPatientFieldSettings();
    settings.onlineAgenda.mobilePhone = { present: false, required: false };

    const normalized = normalizePatientFieldSettings(settings);

    expect(normalized.onlineAgenda.mobilePhone).toEqual({ present: true, required: true });
  });
});
