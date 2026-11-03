import {
  BadRequestException,
  GoneException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { PublicBookingService } from "./public-booking.service";

const rolePermission = (permissionId: string) => ({
  permissionId,
  permission: { isActive: true, deletedAt: null }
});

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  firstName: "System",
  lastName: "Admin",
  roleId: "role-super-admin",
  role: {
    id: "role-super-admin",
    name: "SUPER_ADMIN",
    code: "super_admin",
    permissions: [rolePermission("appointments.status.update"), rolePermission("appointments.cancel")]
  },
  roles: [],
  branches: [{ branchId: "branch-1" }],
  permissions: []
};

function buildService({
  user,
  appointment = {
    id: "appt-1",
    organizationId: "org-1",
    branchId: "branch-1",
    status: "NOTIFIED_BY_EMAIL",
    startAt: new Date("2026-08-30T16:00:00.000Z")
  },
  jwtVerify = jest
    .fn()
    .mockReturnValue({
      sub: "appt-1",
      purpose: "APPOINTMENT_CONFIRMATION",
      appointmentStartAt: "2026-08-30T16:00:00.000Z"
    })
}: {
  user?: unknown;
  appointment?: unknown;
  jwtVerify?: jest.Mock;
} = {}) {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(user === undefined ? adminUser : user)
    },
    appointment: {
      findUnique: jest.fn().mockResolvedValue(appointment)
    },
    agreement: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null)
    }
  };
  const appointmentsService = {
    confirmByEmail: jest.fn().mockResolvedValue({ id: "appt-1" }),
    cancel: jest.fn().mockResolvedValue({ id: "appt-1" })
  };
  const jwtService = {
    verify: jwtVerify
  };
  const configService = {
    get: jest.fn((key: string) => (key === "JWT_ACCESS_SECRET" ? "secret" : undefined))
  };
  const patientIdentityService = {};
  const patientFieldConfig = {
    getByOrganization: jest.fn().mockResolvedValue([]),
    assertRequiredFields: jest.fn().mockResolvedValue(undefined)
  };

  return {
    prisma,
    appointmentsService,
    jwtService,
    service: new PublicBookingService(
      prisma as never,
      appointmentsService as never,
      jwtService as never,
      configService as never,
      patientIdentityService as never,
      patientFieldConfig as never
    )
  };
}

describe("PublicBookingService - email confirmation actor", () => {
  it("confirms with an active administrative actor from the same organization and branch", async () => {
    const { service, prisma, appointmentsService } = buildService();

    await service.confirmEmail("appt-1", "valid-token");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          isActive: true,
          status: "ACTIVE",
          deletedAt: null,
          branches: { some: { branchId: "branch-1" } }
        })
      })
    );
    expect(appointmentsService.confirmByEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "admin-1",
        organizationId: "org-1",
        branchIds: ["branch-1"],
        roleNames: ["SUPER_ADMIN"],
        permissions: expect.arrayContaining(["appointments.status.update"])
      }),
      "appt-1"
    );
  });

  it("uses the appointment organization and branch to resolve the public action actor", async () => {
    const { service, prisma, appointmentsService } = buildService({
      user: {
        ...adminUser,
        branches: [{ branchId: "branch-2" }]
      },
      appointment: {
        id: "appt-2",
        organizationId: "org-2",
        branchId: "branch-2",
        status: "NOTIFIED_BY_EMAIL",
        startAt: new Date("2026-08-31T16:00:00.000Z")
      },
      jwtVerify: jest
        .fn()
        .mockReturnValue({
          sub: "appt-2",
          purpose: "APPOINTMENT_CONFIRMATION",
          appointmentStartAt: "2026-08-31T16:00:00.000Z"
        })
    });

    await service.confirmEmail("appt-2", "valid-token");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-2",
          branches: { some: { branchId: "branch-2" } }
        }),
        orderBy: { email: "asc" }
      })
    );
    expect(appointmentsService.confirmByEmail).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-2", branchIds: ["branch-2"] }),
      "appt-2"
    );
  });

  it("fails as internal configuration when the organization has no valid public action actor", async () => {
    const { service } = buildService({ user: null });

    await expect(service.confirmEmail("appt-1", "valid-token")).rejects.toThrow(InternalServerErrorException);
  });

  it("requires the actor query to exclude inactive and deleted users", async () => {
    const { service, prisma } = buildService();

    await service.confirmEmail("appt-1", "valid-token");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          status: "ACTIVE",
          deletedAt: null
        })
      })
    );
  });

  it("cancels with the same public action actor and patient-link reason", async () => {
    const { service, appointmentsService } = buildService();

    await service.cancelEmail("appt-1", "valid-token");

    expect(appointmentsService.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-1", organizationId: "org-1", branchIds: ["branch-1"] }),
      "appt-1",
      {
        reason: "Cancelado por el paciente via enlace publico de email",
        cancelledBy: "patient"
      }
    );
  });

  it("rejects invalid tokens without looking up an appointment", async () => {
    const { service, prisma } = buildService({
      jwtVerify: jest.fn().mockImplementation(() => {
        throw new Error("bad token");
      })
    });

    await expect(service.confirmEmail("appt-1", "bad-token")).rejects.toThrow(UnauthorizedException);
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  it("rejects expired tokens distinctly", async () => {
    const expired = new Error("jwt expired");
    expired.name = "TokenExpiredError";
    const { service } = buildService({
      jwtVerify: jest.fn().mockImplementation(() => {
        throw expired;
      })
    });

    await expect(service.confirmEmail("appt-1", "expired-token")).rejects.toThrow(GoneException);
  });

  it("rejects a token for another appointment", async () => {
    const { service, prisma } = buildService({
      jwtVerify: jest.fn().mockReturnValue({ sub: "another-appt" })
    });

    await expect(service.confirmEmail("appt-1", "wrong-token")).rejects.toThrow(UnauthorizedException);
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing appointment without resolving an internal actor", async () => {
    const { service, prisma } = buildService({ appointment: null });

    await expect(service.confirmEmail("appt-1", "valid-token")).rejects.toThrow(NotFoundException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("treats an already confirmed appointment as an idempotent success", async () => {
    const { service, appointmentsService } = buildService({
      appointment: {
        id: "appt-1",
        organizationId: "org-1",
        branchId: "branch-1",
        status: "CONFIRMED_BY_PHONE",
        startAt: new Date("2026-08-30T16:00:00.000Z")
      }
    });
    await expect(service.confirmEmail("appt-1", "valid-token")).resolves.toEqual({
      success: true,
      alreadyResolved: true
    });
    expect(appointmentsService.confirmByEmail).not.toHaveBeenCalled();
  });

  it("treats an already cancelled appointment as an idempotent success", async () => {
    const { service, appointmentsService } = buildService({
      appointment: {
        id: "appt-1",
        organizationId: "org-1",
        branchId: "branch-1",
        status: "CANCELLED_BY_PATIENT",
        startAt: new Date("2026-08-30T16:00:00.000Z")
      }
    });
    await expect(service.cancelEmail("appt-1", "valid-token")).resolves.toEqual({
      success: true,
      alreadyResolved: true
    });
    expect(appointmentsService.cancel).not.toHaveBeenCalled();
  });

  it("expires a confirmation link after the appointment is rescheduled", async () => {
    const { service } = buildService({
      jwtVerify: jest
        .fn()
        .mockReturnValue({
          sub: "appt-1",
          purpose: "APPOINTMENT_CONFIRMATION",
          appointmentStartAt: "2026-08-29T16:00:00.000Z"
        })
    });
    await expect(service.confirmEmail("appt-1", "valid-token")).rejects.toThrow(GoneException);
  });

  describe("Patient Profile Public Updating", () => {
    it("throws error if token is missing", async () => {
      const { service } = buildService();
      await expect(service.getPatientProfile("appt-1", "")).rejects.toThrow("Token is required");
    });

    it("throws error if token is invalid", async () => {
      const { service } = buildService({
        jwtVerify: jest.fn().mockImplementation(() => {
          throw new Error("Invalid signature");
        })
      });
      await expect(service.getPatientProfile("appt-1", "bad-token")).rejects.toThrow(UnauthorizedException);
    });

    it("throws error if purpose does not match", async () => {
      const { service } = buildService({
        jwtVerify: jest.fn().mockReturnValue({ sub: "appt-1", purpose: "WRONG_PURPOSE" })
      });
      await expect(service.getPatientProfile("appt-1", "token")).rejects.toThrow("Invalid token purpose");
    });

    it("throws error if appointment is cancelled", async () => {
      const { service } = buildService({
        jwtVerify: jest.fn().mockReturnValue({ sub: "appt-cancelled", purpose: "PATIENT_PROFILE_UPDATE" }),
        appointment: {
          id: "appt-cancelled",
          status: "CANCELLED_BY_PATIENT",
          patient: { id: "patient-1", firstName: "John" },
          branch: { organizationId: "org-1" }
        }
      });
      await expect(service.getPatientProfile("appt-cancelled", "token")).rejects.toThrow(
        "Cannot update profile for a cancelled appointment"
      );
    });

    it("returns profile data for valid token", async () => {
      const { service } = buildService({
        jwtVerify: jest.fn().mockReturnValue({ sub: "appt-valid", purpose: "PATIENT_PROFILE_UPDATE" }),
        appointment: {
          id: "appt-valid",
          status: "SCHEDULED",
          patient: { id: "patient-1", firstName: "John", lastName: "Doe", email: "john@example.com" },
          branch: { organizationId: "org-1" }
        }
      });
      const profile = await service.getPatientProfile("appt-valid", "token");
      expect(profile).toEqual({
        firstName: "John",
        socialName: undefined,
        lastName: "Doe",
        agreementId: undefined,
        internalNumber: undefined,
        email: "john@example.com",
        phone: undefined,
        documentType: undefined,
        documentNumber: undefined,
        birthDate: null,
        sex: undefined,
        gender: undefined,
        alternatePhone: undefined,
        occupation: undefined,
        employer: undefined,
        observations: undefined,
        referredBy: undefined,
        type: undefined,
        guardianName: null,
        guardianSocialName: null,
        guardianDocumentNumber: null,
        guardianGender: null,
        address: null,
        patientFieldConfigs: [],
        agreements: []
      });
    });

    it("updates profile and creates audit log when privacy notice is accepted", async () => {
      const { service, prisma } = buildService({
        jwtVerify: jest.fn().mockReturnValue({ sub: "appt-valid", purpose: "PATIENT_PROFILE_UPDATE" }),
        appointment: {
          id: "appt-valid",
          status: "SCHEDULED",
          organizationId: "org-1",
          createdById: "user-1",
          patient: { id: "patient-1", firstName: "John" }
        }
      });

      const txOperations: any[] = [];
      const txMock = {
        patient: {
          update: jest.fn().mockImplementation((args) => txOperations.push({ type: "patient.update", args }))
        },
        auditLog: {
          create: jest.fn().mockImplementation((args) => txOperations.push({ type: "auditLog.create", args }))
        }
      };
      (prisma as any)["$transaction"] = jest.fn().mockImplementation(async (cb) => cb(txMock));

      await service.updatePatientProfile("appt-valid", "token", {
        firstName: "Johnny",
        lastName: "Doe",
        privacyNoticeAccepted: true
      });

      expect(txOperations.length).toBe(2);
      expect(txOperations[0].type).toBe("patient.update");
      expect(txOperations[0].args.data.firstName).toBe("Johnny");
      expect(txOperations[1].type).toBe("auditLog.create");
      expect(txOperations[1].args.data.reason).toBe("PUBLIC_PATIENT_PROFILE");
    });
  });
});
