import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { UpdatePatientFieldConfigDto } from "./dto/update-patient-field-config.dto";

type PatientFieldDefaults = Partial<{
  isSystemRequired: boolean;
  newPatientPresent: boolean;
  newPatientRequired: boolean;
  appointmentPresent: boolean;
  appointmentRequired: boolean;
  onlineAgendaPresent: boolean;
  onlineAgendaRequired: boolean;
  checkInPresent: boolean;
  checkInRequired: boolean;
}>;

function fieldConfig(fieldKey: string, sortOrder: number, defaults: PatientFieldDefaults = {}) {
  return {
    fieldKey,
    sortOrder,
    isSystemRequired: false,
    newPatientPresent: false,
    newPatientRequired: false,
    appointmentPresent: false,
    appointmentRequired: false,
    onlineAgendaPresent: false,
    onlineAgendaRequired: false,
    checkInPresent: false,
    checkInRequired: false,
    ...defaults
  };
}

const ALWAYS_REQUIRED = {
  isSystemRequired: true,
  newPatientPresent: true,
  newPatientRequired: true,
  appointmentPresent: true,
  appointmentRequired: true,
  onlineAgendaPresent: true,
  onlineAgendaRequired: true,
  checkInPresent: true,
  checkInRequired: true
};

export const DEFAULT_PATIENT_FIELD_CONFIGS = [
  fieldConfig("legalName", 1, ALWAYS_REQUIRED),
  fieldConfig("socialName", 2),
  fieldConfig("lastName", 3, ALWAYS_REQUIRED),
  fieldConfig("curp", 4, { checkInPresent: true, checkInRequired: true }),
  fieldConfig("email", 5, {
    appointmentPresent: true,
    appointmentRequired: true,
    onlineAgendaPresent: true,
    onlineAgendaRequired: true,
    checkInPresent: true,
    checkInRequired: true
  }),
  fieldConfig("agreement", 6),
  fieldConfig("internalNumber", 7),
  fieldConfig("sex", 8),
  fieldConfig("gender", 9),
  fieldConfig("birthDate", 10, { checkInPresent: true, checkInRequired: true }),
  fieldConfig("city", 11),
  fieldConfig("delegation", 12),
  fieldConfig("address", 13),
  fieldConfig("fixedPhone", 14),
  fieldConfig("mobilePhone", 15, {
    newPatientPresent: true,
    newPatientRequired: true,
    appointmentPresent: true,
    appointmentRequired: true,
    onlineAgendaPresent: true,
    onlineAgendaRequired: true,
    checkInPresent: true,
    checkInRequired: true
  }),
  fieldConfig("profession", 16),
  fieldConfig("employer", 17),
  fieldConfig("observations", 18),
  fieldConfig("guardian", 19),
  fieldConfig("reference", 20),
  fieldConfig("type", 21, { newPatientPresent: true, appointmentPresent: true }),
  fieldConfig("guardianDocument", 22),
  fieldConfig("guardianSocialName", 23),
  fieldConfig("guardianGender", 24)
];

export type PatientFieldContext = "newPatient" | "appointment" | "onlineAgenda" | "checkIn";

const REQUIRED_PROPERTY_BY_CONTEXT = {
  newPatient: "newPatientRequired",
  appointment: "appointmentRequired",
  onlineAgenda: "onlineAgendaRequired",
  checkIn: "checkInRequired"
} as const;

const PATIENT_FIELD_LABELS: Record<string, string> = {
  legalName: "Nombre legal",
  socialName: "Nombre social",
  lastName: "Apellidos",
  curp: "CURP/RFC",
  email: "Email",
  agreement: "Convenio",
  internalNumber: "Numero interno",
  sex: "Sexo",
  gender: "Genero",
  birthDate: "Fecha de nacimiento",
  city: "Ciudad",
  delegation: "Delegacion",
  address: "Direccion",
  fixedPhone: "Telefono fijo",
  mobilePhone: "Telefono movil",
  profession: "Actividad o profesion",
  employer: "Empleador",
  observations: "Observaciones",
  guardian: "Apoderado",
  reference: "Referencia",
  type: "Tipo",
  guardianDocument: "CURP/RFC tutor legal",
  guardianSocialName: "Nombre social tutor",
  guardianGender: "Genero tutor"
};

@Injectable()
export class PatientFieldConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getByOrganization(organizationId: string) {
    let configs = await this.prisma.patientFieldConfig.findMany({
      where: { organizationId },
      orderBy: { sortOrder: "asc" }
    });

    const storedByKey = new Map(configs.map((config) => [config.fieldKey, config]));
    const needsSync = DEFAULT_PATIENT_FIELD_CONFIGS.some((item) => {
      const stored = storedByKey.get(item.fieldKey);
      return (
        !stored || stored.sortOrder !== item.sortOrder || stored.isSystemRequired !== item.isSystemRequired
      );
    });

    if (needsSync) {
      await this.syncDefaults(organizationId);
      configs = await this.prisma.patientFieldConfig.findMany({
        where: { organizationId },
        orderBy: { sortOrder: "asc" }
      });
    }

    return configs;
  }

  async update(organizationId: string, dto: UpdatePatientFieldConfigDto) {
    const allowedFieldKeys = new Set(DEFAULT_PATIENT_FIELD_CONFIGS.map((item) => item.fieldKey));
    const unknownFieldKeys = dto.fields
      .map((field) => field.fieldKey)
      .filter((fieldKey) => !allowedFieldKeys.has(fieldKey));
    if (unknownFieldKeys.length > 0) {
      throw new BadRequestException(`Campos de configuracion no soportados: ${unknownFieldKeys.join(", ")}`);
    }

    const operations = dto.fields.map((field, idx) => {
      const isSystemRequired = field.fieldKey === "legalName" || field.fieldKey === "lastName";
      const isOnlineIdentityRequired = field.fieldKey === "mobilePhone";
      const newPatientPresent = isSystemRequired ? true : field.newPatientPresent;
      const newPatientRequired = isSystemRequired ? true : field.newPatientRequired || false;
      const appointmentPresent = isSystemRequired ? true : field.appointmentPresent;
      const appointmentRequired = isSystemRequired ? true : field.appointmentRequired || false;
      const onlineAgendaPresent =
        isSystemRequired || isOnlineIdentityRequired ? true : field.onlineAgendaPresent;
      const onlineAgendaRequired =
        isSystemRequired || isOnlineIdentityRequired ? true : field.onlineAgendaRequired || false;
      const checkInPresent = isSystemRequired ? true : field.checkInPresent;
      const checkInRequired = isSystemRequired ? true : field.checkInRequired || false;

      return this.prisma.patientFieldConfig.upsert({
        where: {
          organizationId_fieldKey: {
            organizationId,
            fieldKey: field.fieldKey
          }
        },
        create: {
          organizationId,
          fieldKey: field.fieldKey,
          isSystemRequired,
          sortOrder: idx + 1,
          newPatientPresent,
          newPatientRequired,
          appointmentPresent,
          appointmentRequired,
          onlineAgendaPresent,
          onlineAgendaRequired,
          checkInPresent,
          checkInRequired
        },
        update: {
          isSystemRequired,
          sortOrder: idx + 1,
          newPatientPresent,
          newPatientRequired,
          appointmentPresent,
          appointmentRequired,
          onlineAgendaPresent,
          onlineAgendaRequired,
          checkInPresent,
          checkInRequired
        }
      });
    });

    return this.prisma.$transaction(operations);
  }

  async assertRequiredFields(
    organizationId: string,
    context: PatientFieldContext,
    values: Record<string, unknown>
  ) {
    const configs = await this.getByOrganization(organizationId);
    const requiredProperty = REQUIRED_PROPERTY_BY_CONTEXT[context];
    const missing = configs
      .filter((config) => config[requiredProperty])
      .filter((config) => !this.hasValue(values[config.fieldKey]))
      .map((config) => PATIENT_FIELD_LABELS[config.fieldKey] ?? config.fieldKey);

    if (missing.length > 0) {
      throw new BadRequestException(`Campos requeridos para ${context}: ${missing.join(", ")}`);
    }
  }

  private hasValue(value: unknown) {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  }

  private async syncDefaults(organizationId: string) {
    return this.prisma.$transaction(
      DEFAULT_PATIENT_FIELD_CONFIGS.map((item) =>
        this.prisma.patientFieldConfig.upsert({
          where: { organizationId_fieldKey: { organizationId, fieldKey: item.fieldKey } },
          create: { organizationId, ...item },
          update: { sortOrder: item.sortOrder, isSystemRequired: item.isSystemRequired }
        })
      )
    );
  }
}
