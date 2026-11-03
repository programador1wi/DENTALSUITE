import { ForbiddenException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PatientIdentityService } from "./patient-identity.service";
import { PhoneNormalizationService } from "./phone-normalization.service";

function patient(id: string, firstName: string) {
  return { id, firstName, lastName: "Paciente" };
}

describe("PatientIdentityService resolution", () => {
  it("returns candidates without automatically selecting a single phone match", async () => {
    const prisma = {
      patientIdentityConfig: {
        upsert: jest.fn().mockResolvedValue({
          defaultCountry: "MX",
          shadowMode: true,
          whatsappResolutionEnabled: false
        })
      },
      contactPoint: {
        upsert: jest.fn().mockResolvedValue({ id: "contact-1" })
      },
      patientContactLink: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { patientId: "patient-1", role: "PERSONAL", patient: patient("patient-1", "Ana") }
          ])
      },
      familyBookingGrant: { findMany: jest.fn().mockResolvedValue([]) },
      familyGroupContact: { findMany: jest.fn().mockResolvedValue([]) },
      bookingIdentitySession: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: "session-1",
          status: "PENDING",
          selectedPatientId: null,
          expiresAt: data.expiresAt,
          ...data
        }))
      },
      auditLog: { create: jest.fn() }
    };
    const service = new PatientIdentityService(prisma as never, new PhoneNormalizationService(), {} as never);

    const result = await service.createSession("org-1", {
      source: "PUBLIC_BOOKING",
      phone: "+525512345678"
    });

    expect(result.resolution).toBe("SINGLE_CONTACT_MATCH");
    expect(result.hasSelectedPatient).toBe(false);
    expect("candidates" in result).toBe(true);
    if ("candidates" in result) {
      expect(result.candidates).toEqual([
        expect.objectContaining({ patientId: "patient-1", relationship: "PERSONAL" })
      ]);
    }
  });

  it("rejects selecting a patient not authorized for the contact", async () => {
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue({
          id: "session-1",
          organizationId: "org-1",
          contactPointId: "contact-1",
          expiresAt: new Date(Date.now() + 60_000),
          status: "PENDING",
          resolution: "SINGLE_VERIFIED_MATCH",
          metadata: { candidatePatientIds: ["patient-1"] }
        })
      },
      patientContactLink: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { patientId: "patient-1", role: "PERSONAL", patient: patient("patient-1", "Ana") }
          ])
      },
      familyBookingGrant: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new PatientIdentityService(prisma as never, new PhoneNormalizationService(), {} as never);

    await expect(
      service.selectSessionPatient("org-1", "session-1", { patientId: "patient-2" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects reusing an idempotency key with a different request", async () => {
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue({
          id: "session-1",
          organizationId: "org-1",
          selectedPatientId: "patient-1",
          contactPointId: "contact-1",
          expiresAt: new Date(Date.now() + 60_000),
          status: "SELECTED",
          source: "WHATSAPP"
        })
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          organizationId: "org-1",
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "User",
          roleId: null,
          role: null,
          roles: [],
          branches: [{ branchId: "branch-1" }],
          permissions: []
        })
      },
      bookingIdempotency: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ requestHash: "different-hash", appointmentId: "appointment-1" })
      }
    };
    const service = new PatientIdentityService(prisma as never, new PhoneNormalizationService(), {} as never);

    await expect(
      service.bookResolvedAppointment(
        "org-1",
        "session-1",
        {
          branchId: "branch-1",
          professionalId: "professional-1",
          title: "Consulta",
          startAt: "2026-08-01T15:00:00.000Z",
          endAt: "2026-08-01T15:30:00.000Z"
        },
        "same-key"
      )
    ).rejects.toThrow("otro contenido");
  });

  it("returns the existing appointment when a completed request is retried", async () => {
    const dto = {
      branchId: "branch-1",
      professionalId: "professional-1",
      title: "Consulta",
      startAt: "2026-08-01T15:00:00.000Z",
      endAt: "2026-08-01T15:30:00.000Z"
    };
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ sessionId: "session-1", dto }))
      .digest("hex");
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue({
          id: "session-1",
          organizationId: "org-1",
          selectedPatientId: "patient-1",
          status: "COMPLETED",
          source: "WHATSAPP"
        })
      },
      bookingIdempotency: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ requestHash, appointmentId: "appointment-1", status: "COMPLETED" })
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "User",
          roleId: null,
          role: null,
          roles: [],
          branches: [{ branchId: "branch-1" }],
          permissions: []
        })
      }
    };
    const appointments = { findOne: jest.fn().mockResolvedValue({ id: "appointment-1" }) };
    const service = new PatientIdentityService(
      prisma as never,
      new PhoneNormalizationService(),
      appointments as never
    );

    await expect(service.bookResolvedAppointment("org-1", "session-1", dto, "same-key")).resolves.toEqual({
      id: "appointment-1"
    });
    expect(appointments.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "appointment-1"
    );
  });
});
