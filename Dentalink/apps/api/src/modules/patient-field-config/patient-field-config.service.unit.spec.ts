import { BadRequestException } from "@nestjs/common";
import { DEFAULT_PATIENT_FIELD_CONFIGS, PatientFieldConfigService } from "./patient-field-config.service";

function buildService(configs: Array<Record<string, unknown>> = []) {
  const prisma = {
    patientFieldConfig: {
      findMany: jest.fn().mockResolvedValue(configs),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create))
    },
    $transaction: jest
      .fn()
      .mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations))
  };
  return { prisma, service: new PatientFieldConfigService(prisma as never) };
}

describe("PatientFieldConfigService", () => {
  it("backfills new catalog fields for organizations that already have legacy configuration", async () => {
    const legacyConfigs = DEFAULT_PATIENT_FIELD_CONFIGS.filter((item) => item.fieldKey !== "socialName");
    const { service, prisma } = buildService(legacyConfigs);
    prisma.patientFieldConfig.findMany
      .mockResolvedValueOnce(legacyConfigs)
      .mockResolvedValueOnce(DEFAULT_PATIENT_FIELD_CONFIGS);

    const result = await service.getByOrganization("org-1");

    expect(result).toHaveLength(24);
    expect(prisma.patientFieldConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ fieldKey: "socialName", sortOrder: 2 }) })
    );
  });

  it("rejects a request when a configured required field is empty", async () => {
    const { service } = buildService([{ fieldKey: "email", appointmentRequired: true }]);

    await expect(service.assertRequiredFields("org-1", "appointment", { email: "" })).rejects.toThrow(
      new BadRequestException("Campos requeridos para appointment: Email")
    );
  });

  it("accepts a request when all configured required fields contain values", async () => {
    const { service } = buildService([{ fieldKey: "email", appointmentRequired: true }]);

    await expect(
      service.assertRequiredFields("org-1", "appointment", { email: "patient@example.com" })
    ).resolves.toBeUndefined();
  });

  it("forces the phone field to remain visible and required in agenda online", async () => {
    const { service, prisma } = buildService();

    await service.update("org-1", {
      fields: [
        {
          fieldKey: "mobilePhone",
          newPatientPresent: false,
          newPatientRequired: false,
          appointmentPresent: false,
          appointmentRequired: false,
          onlineAgendaPresent: false,
          onlineAgendaRequired: false,
          checkInPresent: false,
          checkInRequired: false
        }
      ]
    });

    expect(prisma.patientFieldConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ onlineAgendaPresent: true, onlineAgendaRequired: true }),
        update: expect.objectContaining({ onlineAgendaPresent: true, onlineAgendaRequired: true })
      })
    );
  });

  it("rejects field keys that are not part of the supported catalog", async () => {
    const { service } = buildService();

    await expect(
      service.update("org-1", {
        fields: [
          {
            fieldKey: "unknownField",
            newPatientPresent: false,
            newPatientRequired: false,
            appointmentPresent: false,
            appointmentRequired: false,
            onlineAgendaPresent: false,
            onlineAgendaRequired: false,
            checkInPresent: false,
            checkInRequired: false
          }
        ]
      })
    ).rejects.toThrow("Campos de configuracion no soportados");
  });
});
