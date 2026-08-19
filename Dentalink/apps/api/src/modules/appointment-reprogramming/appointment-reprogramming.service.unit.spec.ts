import {
  AppointmentReprogrammingBatchItemStatus,
  AppointmentStatus
} from "@prisma/client";
import { AppointmentReprogrammingService } from "./appointment-reprogramming.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "recepcion@example.com",
  firstName: "Recepción",
  lastName: "Uno",
  roleIds: [],
  roleNames: ["RECEPTIONIST"],
  permissions: [
    "agenda.reprogramming.view",
    "agenda.reprogramming.mass_cancel",
    "agenda.reprogramming.reschedule",
    "agenda.reprogramming.view_financial_status"
  ],
  branchIds: ["branch-1"]
};

describe("AppointmentReprogrammingService", () => {
  it("previews affected appointments without mutating appointment state", async () => {
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: "branch-1",
          timezone: "America/Mexico_City"
        })
      },
      professional: { findFirst: jest.fn().mockResolvedValue({ id: "professional-1" }) },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "appointment-1",
            patient: {
              id: "patient-1",
              firstName: "Ana",
              lastName: "Pérez",
              phone: null,
              email: null
            },
            branch: { id: "branch-1", name: "Centro", timezone: "America/Mexico_City" },
            professional: { id: "professional-1", firstName: "Dra.", lastName: "Luna" },
            chair: { id: "chair-1", name: "Box 1" },
            startAt: new Date("2026-07-30T16:00:00.000Z"),
            endAt: new Date("2026-07-30T16:30:00.000Z"),
            durationMinutes: 30,
            status: AppointmentStatus.SCHEDULED,
            reason: "Revisión",
            title: "Consulta",
            _count: { appointmentNotes: 1 }
          }
        ]),
        update: jest.fn()
      }
    };
    const service = new AppointmentReprogrammingService(
      prisma as never,
      {} as never,
      {} as never
    );

    const result = await service.preview(actor, {
      branchId: "branch-1",
      professionalId: "professional-1",
      startDate: "2026-07-30",
      endDate: "2026-07-30",
      reasonCode: "SCHEDULE_CHANGE",
      reasonText: "Cambio de horario"
    });

    expect(result.total).toBe(1);
    expect(result.appointments[0]?.warnings).toEqual([
      "Paciente sin teléfono ni correo registrado",
      "La cita tiene 1 observación(es)"
    ]);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("keeps the original dates, cancels by reprogramming and creates one pending case", async () => {
    const appointment = {
      id: "appointment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      professionalId: "professional-1",
      chairId: "chair-1",
      title: "Consulta",
      reason: "Revisión",
      notes: "Control",
      status: AppointmentStatus.SCHEDULED,
      startAt: new Date("2026-07-30T16:00:00.000Z"),
      endAt: new Date("2026-07-30T16:30:00.000Z"),
      durationMinutes: 30,
      patient: { firstName: "Ana", lastName: "Pérez" },
      professional: { firstName: "Dra.", lastName: "Luna" },
      branch: { name: "Centro" },
      chair: { name: "Box 1" }
    };
    const tx = {
      $queryRaw: jest.fn(),
      appointmentReprogrammingBatchItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: "item-1",
          batchId: "batch-1",
          status: AppointmentReprogrammingBatchItemStatus.PENDING,
          appointment,
          batch: {
            id: "batch-1",
            organizationId: "org-1",
            branchId: "branch-1",
            professionalId: "professional-1",
            startAt: new Date("2026-07-30T05:00:00.000Z"),
            endAt: new Date("2026-07-31T05:00:00.000Z"),
            reasonCode: "SCHEDULE_CHANGE",
            reasonText: "Cambio de horario"
          }
        }),
        update: jest.fn()
      },
      appointmentReprogrammingCase: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "case-1" })
      },
      appointment: { update: jest.fn() },
      appointmentStatusHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      appointmentReprogrammingBatchItem: { updateMany: jest.fn() }
    };
    const service = new AppointmentReprogrammingService(
      prisma as never,
      {} as never,
      {} as never
    );

    await (
      service as unknown as {
        processBatchItem: (
          currentActor: typeof actor,
          batchId: string,
          itemId: string
        ) => Promise<void>;
      }
    ).processBatchItem(
      actor,
      "batch-1",
      "item-1"
    );

    expect(tx.appointmentReprogrammingCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalAppointmentId: "appointment-1",
          originalStartAt: appointment.startAt,
          originalEndAt: appointment.endAt
        })
      })
    );
    expect(tx.appointment.update).toHaveBeenCalledWith({
      where: { id: "appointment-1" },
      data: expect.objectContaining({
        status: AppointmentStatus.CANCELLED_RESCHEDULED,
        cancellationReason: "Cambio de horario"
      })
    });
    const updateData = tx.appointment.update.mock.calls[0]?.[0]?.data;
    expect(updateData).not.toHaveProperty("startAt");
    expect(updateData).not.toHaveProperty("endAt");
    expect(tx.appointmentReprogrammingBatchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AppointmentReprogrammingBatchItemStatus.PROCESSED,
          caseId: "case-1"
        })
      })
    );
  });
});
