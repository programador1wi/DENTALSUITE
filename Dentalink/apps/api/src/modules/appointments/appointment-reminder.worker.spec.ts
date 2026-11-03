import { AppointmentReminderStage, AppointmentStatus } from "@prisma/client";
import {
  AppointmentReminderWorker,
  CHANNEL_EMAIL_24H,
  CHANNEL_EMAIL_48H
} from "./appointment-reminder.worker";

describe("AppointmentReminderWorker", () => {
  const now = new Date("2026-08-28T16:00:00.000Z");
  let worker: AppointmentReminderWorker;
  let prisma: any;
  let config: any;

  beforeEach(() => {
    prisma = {
      appointment: { findMany: jest.fn() },
      appointmentReminder: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      $queryRaw: jest.fn().mockResolvedValue([])
    };
    config = { get: jest.fn().mockReturnValue(undefined) };
    worker = new AppointmentReminderWorker(
      prisma,
      { dispatchEmailNotification: jest.fn() } as any,
      {
        getEffectivePolicy: jest.fn().mockResolvedValue({
          enabled: true,
          firstOffsetHours: 48,
          finalOffsetHours: 24,
          sendWindowStartMinutes: 480,
          sendWindowEndMinutes: 1200,
          retryDelaysMinutes: [15, 60, 240],
          maxAttempts: 3
        })
      } as any,
      { ping: jest.fn(), getClient: jest.fn() } as any,
      {
        recordAppointmentReminder: jest.fn(),
        setAppointmentReminderCircuit: jest.fn(),
        setAppointmentReminderBacklog: jest.fn()
      } as any,
      config
    );
  });

  afterEach(() => worker.onModuleDestroy());

  it.each([
    [72, []],
    [48, [AppointmentReminderStage.FIRST_48H, AppointmentReminderStage.FINAL_24H]],
    [24, [AppointmentReminderStage.FINAL_24H]],
    [2, [AppointmentReminderStage.FINAL_24H]]
  ])("applies the adaptive stages at %s hours before the appointment", async (hours, expectedStages) => {
    const startAt = new Date(now.getTime() + Number(hours) * 3_600_000);
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: `a-${hours}h`,
        organizationId: "org",
        branchId: "branch",
        startAt,
        patient: { email: "patient@example.com" },
        branch: { timezone: "America/Mexico_City" },
        status: AppointmentStatus.SCHEDULED
      }
    ]);

    await worker.materializeUpcomingJobs(now);

    expect(
      prisma.appointmentReminder.upsert.mock.calls.map(
        ([input]: [{ create: { automationStage: AppointmentReminderStage } }]) => input.create.automationStage
      )
    ).toEqual(expectedStages);
  });

  it("materializes first and final stages for a new appointment created 30 hours ahead", async () => {
    const startAt = new Date(now.getTime() + 30 * 3_600_000);
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: "a-30h",
        organizationId: "org",
        branchId: "branch",
        startAt,
        patient: { email: "patient@example.com" },
        branch: { timezone: "America/Mexico_City" },
        status: AppointmentStatus.SCHEDULED
      }
    ]);

    await worker.materializeUpcomingJobs(now);

    expect(prisma.appointmentReminder.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.appointmentReminder.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          channel: CHANNEL_EMAIL_48H,
          automationStage: AppointmentReminderStage.FIRST_48H
        })
      })
    );
    expect(prisma.appointmentReminder.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          channel: CHANNEL_EMAIL_24H,
          automationStage: AppointmentReminderStage.FINAL_24H,
          scheduledAt: new Date(startAt.getTime() - 24 * 3_600_000)
        })
      })
    );
  });

  it("materializes only the final stage below 24 hours and stales an unsent first stage", async () => {
    const startAt = new Date(now.getTime() + 23 * 3_600_000);
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: "a-23h",
        organizationId: "org",
        branchId: "branch",
        startAt,
        patient: { email: "patient@example.com" },
        branch: { timezone: "America/Mexico_City" },
        status: AppointmentStatus.SCHEDULED
      }
    ]);

    await worker.materializeUpcomingJobs(now);

    expect(prisma.appointmentReminder.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.appointmentReminder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ automationStage: AppointmentReminderStage.FINAL_24H })
      })
    );
    expect(prisma.appointmentReminder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ automationStage: AppointmentReminderStage.FIRST_48H }),
        data: expect.objectContaining({ status: "STALE", failureCode: "ADAPTIVE_FINAL_ONLY" })
      })
    );
  });

  it("materializes a visible skipped operation for reserved seed email", async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: "seed",
        organizationId: "org",
        branchId: "branch",
        startAt: new Date(now.getTime() + 30 * 3_600_000),
        patient: { email: "seed.patient@clinic.local" },
        branch: { timezone: "America/Mexico_City" },
        status: AppointmentStatus.SCHEDULED
      }
    ]);

    await worker.materializeUpcomingJobs(now);

    expect(prisma.appointmentReminder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "SKIPPED",
          failureCode: "RESERVED_EMAIL",
          nextAttemptAt: null
        })
      })
    );
  });

  it("uses an atomic SKIP LOCKED claim", async () => {
    await (worker as any).claimNextJob();
    const strings = prisma.$queryRaw.mock.calls[0][0].join(" ");
    expect(strings).toContain("FOR UPDATE SKIP LOCKED");
    expect(strings).toContain('"leaseOwner"');
  });

  it("rejects invalid timezones instead of falling back to UTC", () => {
    expect(worker.isInsideAllowedSendHours("Invalid/Timezone", now)).toBe(false);
  });

  it("only starts its timer when explicitly enabled", () => {
    const spy = jest.spyOn(global, "setInterval");
    worker.onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    config.get.mockImplementation((key: string) =>
      key === "APPOINTMENT_REMINDER_WORKER_ENABLED" ? "true" : "60000"
    );
    worker.onModuleInit();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
