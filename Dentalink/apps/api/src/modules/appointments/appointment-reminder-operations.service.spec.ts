import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PERMISSIONS_KEY } from "../../common/decorators/permissions.decorator";
import type { AuthUser } from "../../common/types/auth-user";
import type { PrismaService } from "../../database/prisma.service";
import type { EmailService } from "../notifications/email.service";
import {
  AppointmentReminderOperationsController,
  AppointmentReminderSettingsController
} from "./appointment-reminder-operations.controller";
import { AppointmentReminderOperationsService } from "./appointment-reminder-operations.service";
import { AppointmentReminderResolution } from "./dto/appointment-reminder-operations.dto";

describe("AppointmentReminderOperationsService", () => {
  const user: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "operator@example.com",
    firstName: "QA",
    lastName: "Operator",
    roleIds: ["admin"],
    roleNames: ["Administrator"],
    permissions: ["appointments.read", "appointments.reminders.manage"],
    branchIds: ["branch-1"]
  };
  let prisma: {
    appointmentReminderPolicy: { findUnique: jest.Mock };
    appointmentReminderBranchPolicy: { findUnique: jest.Mock };
    appointmentReminder: { findFirst: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let service: AppointmentReminderOperationsService;

  beforeEach(() => {
    prisma = {
      appointmentReminderPolicy: { findUnique: jest.fn() },
      appointmentReminderBranchPolicy: { findUnique: jest.fn() },
      appointmentReminder: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    service = new AppointmentReminderOperationsService(
      prisma as unknown as PrismaService,
      { sendPatientEmail: jest.fn() } as unknown as EmailService
    );
  });

  it("merges a branch override without mutating retry policy", async () => {
    prisma.appointmentReminderPolicy.findUnique.mockResolvedValue({
      enabled: false,
      firstOffsetHours: 48,
      finalOffsetHours: 24,
      sendWindowStartMinutes: 480,
      sendWindowEndMinutes: 1200,
      retryDelaysMinutes: [15, 60, 240],
      maxAttempts: 3
    });
    prisma.appointmentReminderBranchPolicy.findUnique.mockResolvedValue({ enabled: true });

    await expect(service.getEffectivePolicy("org-1", "branch-1")).resolves.toEqual({
      enabled: true,
      firstOffsetHours: 48,
      finalOffsetHours: 24,
      sendWindowStartMinutes: 480,
      sendWindowEndMinutes: 1200,
      retryDelaysMinutes: [15, 60, 240],
      maxAttempts: 3
    });
  });

  it("rejects a branch outside the authenticated user's scope", async () => {
    await expect(service.list(user, { page: 1, pageSize: 25, branchId: "branch-2" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("allows manual retry only for FAILED and records an audit event", async () => {
    prisma.appointmentReminder.findFirst.mockResolvedValue({ id: "rem-1", status: "FAILED" });
    prisma.appointmentReminder.update.mockResolvedValue({ id: "rem-1", status: "PENDING" });

    await expect(service.retry(user, "rem-1")).resolves.toEqual({ id: "rem-1", status: "PENDING" });
    expect(prisma.appointmentReminder.update).toHaveBeenCalledWith({
      where: { id: "rem-1" },
      data: expect.objectContaining({
        status: "PENDING",
        failureCode: "MANUAL_RETRY",
        errorMessage: null
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "appointment_reminders.retry_requested" })
      })
    );
  });

  it("never retries UNCERTAIN through the ordinary retry endpoint", async () => {
    prisma.appointmentReminder.findFirst.mockResolvedValue({ id: "rem-1", status: "UNCERTAIN" });

    await expect(service.retry(user, "rem-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appointmentReminder.update).not.toHaveBeenCalled();
  });

  it("resolves UNCERTAIN only after an audited explicit decision", async () => {
    prisma.appointmentReminder.findFirst.mockResolvedValue({
      id: "rem-1",
      status: "UNCERTAIN",
      sentAt: null
    });
    prisma.appointmentReminder.update.mockResolvedValue({ id: "rem-1", status: "SENT" });

    await service.resolve(user, "rem-1", {
      resolution: AppointmentReminderResolution.MARK_SENT,
      reason: "Verified in provider log"
    });

    expect(prisma.appointmentReminder.update).toHaveBeenCalledWith({
      where: { id: "rem-1" },
      data: expect.objectContaining({ status: "SENT", failureCode: "MANUALLY_RESOLVED_SENT" })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "appointment_reminders.uncertain_resolved",
          after: expect.objectContaining({ reason: "Verified in provider log" })
        })
      })
    );
  });
});

describe("appointment reminder route permissions", () => {
  it("keeps read endpoints separate from operational mutations", () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AppointmentReminderOperationsController.prototype.list)
    ).toEqual(["appointments.read"]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AppointmentReminderSettingsController.prototype.get)).toEqual(
      ["appointments.read"]
    );
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AppointmentReminderOperationsController.prototype.retry)
    ).toEqual(["appointments.reminders.manage"]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AppointmentReminderOperationsController.prototype.resolve)
    ).toEqual(["appointments.reminders.manage"]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AppointmentReminderSettingsController.prototype.update)
    ).toEqual(["appointments.reminders.manage"]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AppointmentReminderSettingsController.prototype.test)
    ).toEqual(["appointments.reminders.manage"]);
  });
});
