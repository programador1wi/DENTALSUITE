import { BadRequestException } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { AppointmentsService } from "./appointments.service";
import type { CreateAppointmentDto } from "./dto/create-appointment.dto";

describe("AppointmentsService - Cancellation rules", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };

  it("fails to cancel an appointment if reason is empty", async () => {
    const service = new AppointmentsService({} as never, {} as never, {} as never, {} as never);

    await expect(
      service.cancel(actor, "appt-1", { reason: "   ", cancelledBy: "patient" })
    ).rejects.toThrow(BadRequestException);
    
    await expect(
      service.cancel(actor, "appt-1", { reason: "", cancelledBy: "clinic" })
    ).rejects.toThrow(BadRequestException);
  });

  it("cancels appointment and trims reason", async () => {
    const tx = {
      appointment: {
        update: jest.fn().mockResolvedValue({ id: "appt-1" })
      },
      appointmentStatusHistory: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };

    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue({ id: "appt-1", status: AppointmentStatus.SCHEDULED, branchId: "branch-1" })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };

    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    service.findOne = jest.fn().mockResolvedValue({ id: "appt-1", status: AppointmentStatus.SCHEDULED });

    await service.cancel(actor, "appt-1", { reason: " Motivo valido ", cancelledBy: "clinic" });

    expect(service.findOne).toHaveBeenCalledWith(actor, "appt-1");
    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({
          status: AppointmentStatus.CANCELLED_BY_CLINIC,
          cancellationReason: "Motivo valido"
        })
      })
    );
  });

  it("changes to email notification status and dispatches the confirmation email", async () => {
    const tx = {
      appointment: {
        update: jest.fn().mockResolvedValue({ id: "appt-1" })
      },
      appointmentStatusHistory: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    service.findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: "appt-1", status: AppointmentStatus.SCHEDULED })
      .mockResolvedValueOnce({ id: "appt-1", status: AppointmentStatus.NOTIFIED_BY_EMAIL });
    const dispatch = jest.spyOn(service, "dispatchEmailNotification").mockResolvedValue(undefined);

    await service.changeAppointmentStatus(actor, "appt-1", AppointmentStatus.NOTIFIED_BY_EMAIL);

    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({
          status: AppointmentStatus.NOTIFIED_BY_EMAIL,
          updatedById: actor.id
        })
      })
    );
    expect(tx.appointmentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt-1",
          previousStatus: AppointmentStatus.SCHEDULED,
          newStatus: AppointmentStatus.NOTIFIED_BY_EMAIL,
          reason: "Enviado para confirmacion por email"
        })
      })
    );
    expect(dispatch).toHaveBeenCalledWith("appt-1", "CONFIRMATION");
  });

  it("changes to WhatsApp notification status and records a sent WhatsApp reminder", async () => {
    const tx = {
      appointment: {
        update: jest.fn().mockResolvedValue({ id: "appt-1" })
      },
      appointmentStatusHistory: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };

    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue({ id: "appt-1", status: AppointmentStatus.SCHEDULED, branchId: "branch-1" })
      },
      appointmentReminder: {
        create: jest.fn().mockResolvedValue({ id: "reminder-1" })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };

    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    service.findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: "appt-1", status: AppointmentStatus.SCHEDULED })
      .mockResolvedValueOnce({ id: "appt-1", status: AppointmentStatus.NOTIFIED_BY_WHATSAPP });

    await service.changeAppointmentStatus(actor, "appt-1", AppointmentStatus.NOTIFIED_BY_WHATSAPP);

    expect(prisma.appointmentReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt-1",
          channel: "WHATSAPP",
          status: "SENT"
        })
      })
    );
  });

  it("does not mark an appointment as notified when the confirmation email fails", async () => {
    const tx = {
      appointment: {
        update: jest.fn()
      },
      appointmentStatusHistory: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    service.findOne = jest.fn().mockResolvedValue({ id: "appt-1", status: AppointmentStatus.SCHEDULED });
    jest.spyOn(service, "dispatchEmailNotification").mockRejectedValue(new Error("SMTP down"));

    await expect(service.changeAppointmentStatus(actor, "appt-1", AppointmentStatus.NOTIFIED_BY_EMAIL)).rejects.toThrow("SMTP down");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it("rejects email confirmation dispatch when the patient has no email", async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "appt-1",
          startAt: new Date(Date.now() + 60 * 60 * 1000),
          patient: { firstName: "Ana", lastName: "Lopez", email: null },
          professional: { firstName: "Dra.", lastName: "Ruiz" },
          branch: { timezone: "America/Mexico_City", address: "", city: "", state: "", phone: "" }
        })
      }
    };
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.dispatchEmailNotification("appt-1", "CONFIRMATION")).rejects.toThrow(
      "El paciente no tiene correo electronico registrado"
    );
  });

  it("builds the confirmation URL from FRONTEND_URL", async () => {
    const startAt = new Date(Date.now() + 60 * 60 * 1000);
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "appt-1",
          startAt,
          patient: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com" },
          professional: { firstName: "Dra.", lastName: "Ruiz" },
          branch: { timezone: "America/Mexico_City", address: "", city: "", state: "", phone: "" }
        })
      }
    };
    const emailService = {
      sendAppointmentConfirmationRequired: jest.fn().mockResolvedValue(undefined)
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue("signed-token")
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "JWT_ACCESS_SECRET") return "secret";
        if (key === "FRONTEND_URL") return "http://localhost:3000";
        return undefined;
      })
    };
    const service = new AppointmentsService(
      prisma as never,
      emailService as never,
      jwtService as never,
      configService as never
    );

    await service.dispatchEmailNotification("appt-1", "CONFIRMATION");

    expect(emailService.sendAppointmentConfirmationRequired).toHaveBeenCalledWith(
      "ana@example.com",
      expect.objectContaining({
        confirmUrl: "http://localhost:3000/confirm-appointment?id=appt-1&token=signed-token"
      })
    );
  });

  it("rejects confirmation email dispatch when FRONTEND_URL is missing", async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "appt-1",
          startAt: new Date(Date.now() + 60 * 60 * 1000),
          patient: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com" },
          professional: { firstName: "Dra.", lastName: "Ruiz" },
          branch: { timezone: "America/Mexico_City", address: "", city: "", state: "", phone: "" }
        })
      }
    };
    const configService = {
      get: jest.fn((key: string) => (key === "JWT_ACCESS_SECRET" ? "secret" : undefined))
    };
    const service = new AppointmentsService(
      prisma as never,
      { sendAppointmentConfirmationRequired: jest.fn() } as never,
      { sign: jest.fn() } as never,
      configService as never
    );

    await expect(service.dispatchEmailNotification("appt-1", "CONFIRMATION")).rejects.toThrow(
      "FRONTEND_URL no esta configurado"
    );
  });

  it("rejects direct cancellation status changes without the cancellation flow", async () => {
    const service = new AppointmentsService({} as never, {} as never, {} as never, {} as never);

    await expect(service.changeAppointmentStatus(actor, "appt-1", AppointmentStatus.CANCELLED_CONFLICT)).rejects.toThrow(
      BadRequestException
    );
  });

  it("confirms appointments by email through the normal status transition", async () => {
    const tx = {
      appointment: {
        update: jest.fn().mockResolvedValue({ id: "appt-1" })
      },
      appointmentStatusHistory: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    service.findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: "appt-1", status: AppointmentStatus.NOTIFIED_BY_EMAIL })
      .mockResolvedValueOnce({ id: "appt-1", status: AppointmentStatus.CONFIRMED_BY_EMAIL });
    const dispatch = jest.spyOn(service, "dispatchEmailNotification").mockResolvedValue(undefined);

    await service.confirmByEmail(actor, "appt-1");

    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt-1" },
        data: expect.objectContaining({
          status: AppointmentStatus.CONFIRMED_BY_EMAIL,
          updatedById: actor.id
        })
      })
    );
    expect(tx.appointmentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt-1",
          previousStatus: AppointmentStatus.NOTIFIED_BY_EMAIL,
          newStatus: AppointmentStatus.CONFIRMED_BY_EMAIL,
          reason: "Confirmado por el paciente via enlace publico de email"
        })
      })
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("AppointmentsService - Batch creation rules", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildDto(overrides: Partial<CreateAppointmentDto> = {}): CreateAppointmentDto {
    return {
      branchId: "branch-1",
      patientId: "patient-1",
      professionalId: "professional-1",
      chairId: "chair-1",
      specialtyId: "specialty-1",
      title: "Control dental",
      reason: "Control",
      startAt: "2026-06-29T15:00:00.000Z",
      endAt: "2026-06-29T15:30:00.000Z",
      durationMinutes: 30,
      ...overrides
    };
  }

  function buildPrepared(overrides: Partial<CreateAppointmentDto> = {}) {
    const dto = buildDto(overrides);
    return {
      dto,
      status: (dto.status ?? AppointmentStatus.SCHEDULED) as AppointmentStatus,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      durationMinutes: dto.durationMinutes ?? 30,
      chairId: dto.chairId
    };
  }

  function buildPrisma() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn()
          .mockResolvedValueOnce({ id: "appt-1" })
          .mockResolvedValueOnce({ id: "appt-2" })
      },
      appointmentStatusHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      treatmentPlan: { create: jest.fn().mockResolvedValue({ id: "plan-1" }) }
    };
    const prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { id: "appt-1", patientId: "patient-1", specialty: null },
          { id: "appt-2", patientId: "patient-1", specialty: null }
        ])
      },
      patient: {
        findMany: jest.fn().mockResolvedValue([])
      },
      $transaction: jest.fn((callback) => callback(tx))
    };

    return { prisma, tx };
  }

  function mockPrepareAppointment(service: AppointmentsService) {
    return jest.spyOn(
      service as unknown as { prepareAppointmentForCreate: (...args: unknown[]) => Promise<unknown> },
      "prepareAppointmentForCreate"
    );
  }

  it("rejects two batch appointments for the same patient on the same day", async () => {
    const { prisma } = buildPrisma();
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T15:00:00.000Z", endAt: "2026-06-29T15:30:00.000Z" }))
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T17:00:00.000Z", endAt: "2026-06-29T17:30:00.000Z" }));

    await expect(
      service.createBatch(actor, { appointments: [buildDto(), buildDto({ startAt: "2026-06-29T17:00:00.000Z", endAt: "2026-06-29T17:30:00.000Z" })] })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates batch appointments for the same patient on different days", async () => {
    const { prisma, tx } = buildPrisma();
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T15:00:00.000Z", endAt: "2026-06-29T15:30:00.000Z" }))
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-30T15:00:00.000Z", endAt: "2026-06-30T15:30:00.000Z" }));

    const result = await service.createBatch(actor, {
      appointments: [buildDto(), buildDto({ startAt: "2026-06-30T15:00:00.000Z", endAt: "2026-06-30T15:30:00.000Z" })]
    });

    expect(tx.appointment.create).toHaveBeenCalledTimes(2);
    expect(prisma.appointment.findFirst).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it("merges contiguous batch intervals for the same patient into one appointment", async () => {
    const { prisma, tx } = buildPrisma();
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({
        startAt: "2026-06-29T15:00:00.000Z",
        endAt: "2026-06-29T15:20:00.000Z",
        durationMinutes: 20
      }))
      .mockResolvedValueOnce(buildPrepared({
        startAt: "2026-06-29T15:20:00.000Z",
        endAt: "2026-06-29T15:40:00.000Z",
        durationMinutes: 20
      }));

    const result = await service.createBatch(actor, {
      appointments: [
        buildDto({
          startAt: "2026-06-29T15:00:00.000Z",
          endAt: "2026-06-29T15:20:00.000Z",
          durationMinutes: 20
        }),
        buildDto({
          startAt: "2026-06-29T15:20:00.000Z",
          endAt: "2026-06-29T15:40:00.000Z",
          durationMinutes: 20
        })
      ]
    });

    expect(tx.appointment.create).toHaveBeenCalledTimes(1);
    expect(tx.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startAt: new Date("2026-06-29T15:00:00.000Z"),
          endAt: new Date("2026-06-29T15:40:00.000Z"),
          durationMinutes: 40
        })
      })
    );
    expect(prisma.appointment.findFirst).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it("rejects a batch appointment when the patient already has an active appointment that day", async () => {
    const { prisma } = buildPrisma();
    prisma.appointment.findFirst.mockResolvedValueOnce({ id: "existing-appt" });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T15:00:00.000Z", endAt: "2026-06-29T15:30:00.000Z" }));

    await expect(service.createBatch(actor, { appointments: [buildDto()] })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("filters cancelled and rescheduled appointments out of the patient-day lookup", async () => {
    const { prisma } = buildPrisma();
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T15:00:00.000Z", endAt: "2026-06-29T15:30:00.000Z" }));

    await service.createBatch(actor, { appointments: [buildDto()] });

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            notIn: expect.arrayContaining([
              AppointmentStatus.CANCELLED_BY_PATIENT,
              AppointmentStatus.CANCELLED_BY_CLINIC,
              AppointmentStatus.CANCELLED_CONFLICT,
              AppointmentStatus.CANCELLED_RESCHEDULED,
              AppointmentStatus.NO_SHOW,
              AppointmentStatus.RESCHEDULED
            ])
          }
        })
      })
    );
  });

  it("keeps initial treatment plan and appointments in one transaction", async () => {
    const { prisma, tx } = buildPrisma();
    tx.appointment.create
      .mockReset()
      .mockResolvedValueOnce({ id: "appt-1" })
      .mockRejectedValueOnce(new Error("boom"));
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T15:00:00.000Z", endAt: "2026-06-29T15:30:00.000Z" }))
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-30T15:00:00.000Z", endAt: "2026-06-30T15:30:00.000Z" }));

    await expect(
      service.createBatch(actor, {
        appointments: [buildDto(), buildDto({ startAt: "2026-06-30T15:00:00.000Z", endAt: "2026-06-30T15:30:00.000Z" })],
        autoCreateInitialTreatmentPlan: true
      })
    ).rejects.toThrow("boom");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.treatmentPlan.create).toHaveBeenCalledTimes(1);
    expect(tx.appointment.create).toHaveBeenCalledTimes(2);
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it("rejects a treatment plan that does not belong to the selected patient", async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      professional: { findFirst: jest.fn().mockResolvedValue({ id: "professional-1" }) },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1" }) },
      treatmentPlan: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(
      (
        service as unknown as {
          validateReferences: (
            actor: AuthUser,
            input: {
              branchId: string;
              patientId?: string;
              professionalId: string;
              treatmentPlanId?: string;
              status: AppointmentStatus;
            }
          ) => Promise<void>;
        }
      ).validateReferences(actor, {
        branchId: "branch-1",
        patientId: "patient-1",
        professionalId: "professional-1",
        treatmentPlanId: "plan-other-patient",
        status: AppointmentStatus.SCHEDULED
      })
    ).rejects.toThrow(BadRequestException);

    expect(prisma.treatmentPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "plan-other-patient",
          organizationId: "org-1",
          patientId: "patient-1",
          branchId: { in: ["branch-1"] }
        })
      })
    );
  });
});

describe("AppointmentsService - Effective schedule blocks", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };

  const agendaAssignment = {
    agendaSlotMinutes: 20,
    defaultAppointmentDurationMinutes: 20,
    branch: { agendaSlotMinutes: 30, agendaStartHour: 8, agendaEndHour: 19 }
  };

  function buildSchedulingPrisma({
    regularSchedules = [],
    specialSchedules = [],
    busy = []
  }: {
    regularSchedules?: Array<{
      id: string;
      chairId?: string | null;
      startTime: string;
      endTime: string;
      breakStartTime?: string | null;
      breakEndTime?: string | null;
    }>;
    specialSchedules?: Array<{
      id: string;
      chairId?: string | null;
      startTime: string;
      endTime: string;
      breakStartTime?: string | null;
      breakEndTime?: string | null;
    }>;
    busy?: Array<{ startAt: Date; endAt: Date }>;
  }) {
    return {
      professionalBranch: { findFirst: jest.fn().mockResolvedValue(agendaAssignment) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      professional: { findFirst: jest.fn().mockResolvedValue({ id: "professional-1" }) },
      chair: { findFirst: jest.fn().mockResolvedValue({ id: "chair-1" }) },
      professionalSchedule: { findMany: jest.fn().mockResolvedValue(regularSchedules) },
      professionalSpecialSchedule: { findMany: jest.fn().mockResolvedValue(specialSchedules) },
      holiday: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: { findMany: jest.fn().mockResolvedValue(busy), findFirst: jest.fn().mockResolvedValue(null) }
    };
  }

  it("returns availability slots from every active regular block in the day", async () => {
    const prisma = buildSchedulingPrisma({
      regularSchedules: [
        { id: "morning", chairId: null, startTime: "08:00", endTime: "09:00", breakStartTime: null, breakEndTime: null },
        { id: "afternoon", chairId: null, startTime: "13:00", endTime: "14:00", breakStartTime: null, breakEndTime: null }
      ]
    });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.availability(actor, {
      branchId: "branch-1",
      professionalId: "professional-1",
      date: "2026-07-07",
      durationMinutes: "20"
    });

    expect((result as any).slots.map((slot: any) => slot.startAt.toTimeString().slice(0, 5))).toEqual([
      "08:00",
      "08:20",
      "08:40",
      "13:00",
      "13:20",
      "13:40"
    ]);
  });

  it("treats a special schedule as an opening on its exact date", async () => {
    const prisma = buildSchedulingPrisma({
      specialSchedules: [
        { id: "special", chairId: null, startTime: "15:00", endTime: "16:00", breakStartTime: null, breakEndTime: null }
      ]
    });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.availability(actor, {
      branchId: "branch-1",
      professionalId: "professional-1",
      date: "2026-07-07",
      durationMinutes: "20"
    });

    expect(prisma.professionalSpecialSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: "2026-07-07" })
      })
    );
    expect((result as any).slots.map((slot: any) => slot.startAt.toTimeString().slice(0, 5))).toEqual(["15:00", "15:20", "15:40"]);
  });

  it("excludes the current appointment from availability when editing", async () => {
    const prisma = buildSchedulingPrisma({
      regularSchedules: [
        { id: "morning", chairId: null, startTime: "08:00", endTime: "09:00", breakStartTime: null, breakEndTime: null }
      ]
    });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await service.availability(actor, {
      branchId: "branch-1",
      professionalId: "professional-1",
      date: "2026-07-07",
      durationMinutes: "20",
      excludeAppointmentId: "appt-current"
    });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "appt-current" } })
      })
    );
  });

  it("accepts appointment validation inside the second regular block", async () => {
    const prisma = buildSchedulingPrisma({
      regularSchedules: [
        { id: "morning", chairId: null, startTime: "08:00", endTime: "09:00", breakStartTime: null, breakEndTime: null },
        { id: "afternoon", chairId: null, startTime: "13:00", endTime: "14:00", breakStartTime: null, breakEndTime: null }
      ]
    });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(
      (
        service as unknown as {
          ensureInsideProfessionalSchedule: (
            actor: AuthUser,
            input: { branchId: string; professionalId: string; startAt: Date; endAt: Date }
          ) => Promise<void>;
        }
      ).ensureInsideProfessionalSchedule(actor, {
        branchId: "branch-1",
        professionalId: "professional-1",
        startAt: new Date(2026, 6, 7, 13, 20),
        endAt: new Date(2026, 6, 7, 13, 40)
      })
    ).resolves.toBeUndefined();
  });

  it("rejects normal appointment that overlaps with the break time", async () => {
    const prisma = buildSchedulingPrisma({
      regularSchedules: [
        { id: "morning", chairId: null, startTime: "08:00", endTime: "19:00", breakStartTime: "14:00", breakEndTime: "15:00" }
      ]
    });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(
      (
        service as unknown as {
          ensureInsideProfessionalSchedule: (
            actor: AuthUser,
            input: { branchId: string; professionalId: string; startAt: Date; endAt: Date; status?: AppointmentStatus }
          ) => Promise<void>;
        }
      ).ensureInsideProfessionalSchedule(actor, {
        branchId: "branch-1",
        professionalId: "professional-1",
        startAt: new Date(2026, 6, 7, 10, 0),
        endAt: new Date(2026, 6, 7, 19, 0),
        status: AppointmentStatus.SCHEDULED
      })
    ).rejects.toThrow("La cita se superpone con el horario de descanso del profesional");
  });

  it("accepts blocking appointment (BLOCKED) that overlaps with the break time", async () => {
    const prisma = buildSchedulingPrisma({
      regularSchedules: [
        { id: "morning", chairId: null, startTime: "08:00", endTime: "19:00", breakStartTime: "14:00", breakEndTime: "15:00" }
      ]
    });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(
      (
        service as unknown as {
          ensureInsideProfessionalSchedule: (
            actor: AuthUser,
            input: { branchId: string; professionalId: string; startAt: Date; endAt: Date; status?: AppointmentStatus }
          ) => Promise<void>;
        }
      ).ensureInsideProfessionalSchedule(actor, {
        branchId: "branch-1",
        professionalId: "professional-1",
        startAt: new Date(2026, 6, 7, 10, 0),
        endAt: new Date(2026, 6, 7, 19, 0),
        status: AppointmentStatus.BLOCKED
      })
    ).resolves.toBeUndefined();
  });
});

describe("AppointmentsService - Explicit overbooking intent", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };
  const systemActor = { ...actor, permissions: ["system.manage_all"] };
  const overbookingActor = { ...actor, permissions: ["appointments.overbook"] };

  function callEnforceSchedulingRules(
    service: AppointmentsService,
    authUser: AuthUser,
    overrides: Partial<{
      branchId: string;
      professionalId: string;
      chairId: string;
      startAt: Date;
      endAt: Date;
      status: AppointmentStatus;
      allowOverbooking: boolean;
    }> = {},
    excludeId = "appt-current"
  ) {
    return (
      service as unknown as {
        enforceSchedulingRules: (
          actor: AuthUser,
          input: {
            branchId: string;
            professionalId: string;
            chairId?: string;
            startAt: Date;
            endAt: Date;
            status: AppointmentStatus;
            allowOverbooking?: boolean;
          },
          excludeId?: string
        ) => Promise<void>;
      }
    ).enforceSchedulingRules(
      authUser,
      {
        branchId: "branch-1",
        professionalId: "professional-1",
        startAt: new Date(2026, 6, 7, 16, 0),
        endAt: new Date(2026, 6, 7, 16, 40),
        status: AppointmentStatus.SCHEDULED,
        ...overrides
      },
      excludeId
    );
  }

  function buildPrisma(overlap: unknown = null) {
    return {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(overlap)
      }
    };
  }

  it("blocks extending 16:00-16:20 to 16:00-16:40 when another patient starts at 16:20", async () => {
    const prisma = buildPrisma({ id: "appt-next", startAt: new Date(2026, 6, 7, 16, 20), endAt: new Date(2026, 6, 7, 17, 0) });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    jest.spyOn(
      service as unknown as { ensureInsideProfessionalSchedule: (...args: unknown[]) => Promise<void> },
      "ensureInsideProfessionalSchedule"
    ).mockResolvedValue(undefined);

    await expect(callEnforceSchedulingRules(service, systemActor)).rejects.toThrow("empalma con otra cita");
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "appt-current" },
          professionalId: "professional-1",
          startAt: { lt: new Date(2026, 6, 7, 16, 40) },
          endAt: { gt: new Date(2026, 6, 7, 16, 0) }
        })
      })
    );
  });

  it("allows exact contiguous appointments because 16:00-16:20 and 16:20-17:00 do not overlap", async () => {
    const prisma = buildPrisma(null);
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    jest.spyOn(
      service as unknown as { ensureInsideProfessionalSchedule: (...args: unknown[]) => Promise<void> },
      "ensureInsideProfessionalSchedule"
    ).mockResolvedValue(undefined);

    await expect(
      callEnforceSchedulingRules(service, systemActor, {
        startAt: new Date(2026, 6, 7, 16, 0),
        endAt: new Date(2026, 6, 7, 16, 20)
      })
    ).resolves.toBeUndefined();
  });

  it("does not let system.manage_all overbook unless allowOverbooking is explicit", async () => {
    const prisma = buildPrisma({ id: "appt-next" });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    jest.spyOn(
      service as unknown as { ensureInsideProfessionalSchedule: (...args: unknown[]) => Promise<void> },
      "ensureInsideProfessionalSchedule"
    ).mockResolvedValue(undefined);

    await expect(callEnforceSchedulingRules(service, systemActor)).rejects.toThrow("empalma con otra cita");
  });

  it("lets a permitted user overbook the professional only when allowOverbooking is true", async () => {
    const prisma = buildPrisma(null);
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);
    const ensureSchedule = jest.spyOn(
      service as unknown as { ensureInsideProfessionalSchedule: (...args: unknown[]) => Promise<void> },
      "ensureInsideProfessionalSchedule"
    ).mockResolvedValue(undefined);

    await expect(callEnforceSchedulingRules(service, overbookingActor, { allowOverbooking: true })).resolves.toBeUndefined();
    expect(ensureSchedule).not.toHaveBeenCalled();
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  it("always blocks overlapping the same chair even with explicit overbooking", async () => {
    const prisma = buildPrisma({ id: "chair-overlap" });
    const service = new AppointmentsService(prisma as never, {} as never, {} as never, {} as never);

    await expect(
      callEnforceSchedulingRules(service, overbookingActor, { chairId: "chair-1", allowOverbooking: true })
    ).rejects.toThrow("empalma con otra cita");
  });

  it("requires allowOverbooking on both batch appointments to overlap the same professional", () => {
    const service = new AppointmentsService({} as never, {} as never, {} as never, {} as never);
    const prepared = [
      {
        dto: {
          branchId: "branch-1",
          professionalId: "professional-1",
          patientId: "patient-1",
          title: "A",
          startAt: "2026-07-07T16:00:00.000Z",
          endAt: "2026-07-07T16:40:00.000Z",
          allowOverbooking: true
        },
        status: AppointmentStatus.SCHEDULED,
        startAt: new Date(2026, 6, 7, 16, 0),
        endAt: new Date(2026, 6, 7, 16, 40),
        durationMinutes: 40
      },
      {
        dto: {
          branchId: "branch-1",
          professionalId: "professional-1",
          patientId: "patient-2",
          title: "B",
          startAt: "2026-07-07T16:20:00.000Z",
          endAt: "2026-07-07T17:00:00.000Z"
        },
        status: AppointmentStatus.SCHEDULED,
        startAt: new Date(2026, 6, 7, 16, 20),
        endAt: new Date(2026, 6, 7, 17, 0),
        durationMinutes: 40
      }
    ];

    expect(() =>
      (
        service as unknown as {
          enforceBatchSchedulingRules: (actor: AuthUser, appointments: unknown[]) => void;
        }
      ).enforceBatchSchedulingRules(overbookingActor, prepared)
    ).toThrow("empalma con otra cita");
  });

  it("allows batch professional overbooking when both appointments opt in and the actor has permission", () => {
    const service = new AppointmentsService({} as never, {} as never, {} as never, {} as never);
    const prepared = [
      {
        dto: {
          branchId: "branch-1",
          professionalId: "professional-1",
          patientId: "patient-1",
          title: "A",
          startAt: "2026-07-07T16:00:00.000Z",
          endAt: "2026-07-07T16:40:00.000Z",
          allowOverbooking: true
        },
        status: AppointmentStatus.SCHEDULED,
        startAt: new Date(2026, 6, 7, 16, 0),
        endAt: new Date(2026, 6, 7, 16, 40),
        durationMinutes: 40
      },
      {
        dto: {
          branchId: "branch-1",
          professionalId: "professional-1",
          patientId: "patient-2",
          title: "B",
          startAt: "2026-07-07T16:20:00.000Z",
          endAt: "2026-07-07T17:00:00.000Z",
          allowOverbooking: true
        },
        status: AppointmentStatus.SCHEDULED,
        startAt: new Date(2026, 6, 7, 16, 20),
        endAt: new Date(2026, 6, 7, 17, 0),
        durationMinutes: 40
      }
    ];

    expect(() =>
      (
        service as unknown as {
          enforceBatchSchedulingRules: (actor: AuthUser, appointments: unknown[]) => void;
        }
      ).enforceBatchSchedulingRules(overbookingActor, prepared)
    ).not.toThrow();
  });
});
