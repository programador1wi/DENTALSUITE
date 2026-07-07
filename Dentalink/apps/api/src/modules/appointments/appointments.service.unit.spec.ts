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
    const service = new AppointmentsService({} as never);

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

    const service = new AppointmentsService(prisma as never);
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
      appointment: {
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
    const service = new AppointmentsService(prisma as never);
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
    const service = new AppointmentsService(prisma as never);
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
    const service = new AppointmentsService(prisma as never);
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
    const service = new AppointmentsService(prisma as never);
    mockPrepareAppointment(service)
      .mockResolvedValueOnce(buildPrepared({ startAt: "2026-06-29T15:00:00.000Z", endAt: "2026-06-29T15:30:00.000Z" }));

    await expect(service.createBatch(actor, { appointments: [buildDto()] })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("filters cancelled and rescheduled appointments out of the patient-day lookup", async () => {
    const { prisma } = buildPrisma();
    const service = new AppointmentsService(prisma as never);
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
    const service = new AppointmentsService(prisma as never);
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
    const service = new AppointmentsService(prisma as never);

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
