import { ConflictException, ForbiddenException } from "@nestjs/common";
import { PatientIdentityService } from "./patient-identity.service";
import { PhoneNormalizationService } from "./phone-normalization.service";

const future = () => new Date(Date.now() + 30 * 60_000);
const adminActor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@clinic.test",
  firstName: "Admin",
  lastName: "Clinic",
  roleIds: [],
  roleNames: [],
  branchIds: ["branch-1"],
  permissions: []
};

function familySession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    organizationId: "org-1",
    contactPointId: "contact-1",
    contactPoint: { id: "contact-1", normalizedValue: "+529612222222" },
    selectedPatientId: null,
    bookingActorPatientId: "father-1",
    familyGroupId: "family-1",
    source: "WHATSAPP",
    conversationId: "conversation-1",
    status: "PENDING",
    resolution: "FAMILY_SHARED",
    resolutionMethod: null,
    confidence: 95,
    metadata: { candidatePatientIds: ["father-1", "child-1", "child-2"] },
    contactVerifiedAt: new Date(),
    selectionExpiresAt: null,
    expiresAt: future(),
    ...overrides
  };
}

function authorizedGrant(patientId: string) {
  return {
    id: `grant-${patientId}`,
    patientId,
    familyGroupId: "family-1",
    actorContactPointId: "contact-1",
    canBook: true,
    canReschedule: false,
    canCancel: false,
    canReceiveReminders: true,
    canViewAppointmentSummary: true,
    canViewFinancialInformation: false,
    canViewClinicalInformation: false,
    canSignConsents: false,
    consentStatus: "ACCEPTED"
  };
}

function makeService(prisma: Record<string, unknown>, appointments: Record<string, unknown> = {}) {
  return new PatientIdentityService(prisma as never, new PhoneNormalizationService(), appointments as never);
}

describe("PatientIdentityService family booking policy", () => {
  it("does not grant clinical, financial or consent access when creating a family phone", async () => {
    const tx = {
      familyGroup: { create: jest.fn().mockResolvedValue({ id: "family-1", name: "Familia Chanona" }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      patientIdentityConfig: {
        upsert: jest.fn().mockResolvedValue({ familyGroupsEnabled: true, defaultCountry: "MX" })
      },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "father-1" }) },
      contactPoint: {
        upsert: jest.fn().mockResolvedValue({ id: "contact-1", status: "UNVERIFIED" }),
        update: jest.fn().mockResolvedValue({ id: "contact-1", status: "FAMILY_SHARED" })
      },
      familyGroup: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "family-1", members: [], contacts: [], bookingGrants: [] })
      },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    await makeService(prisma).createFamilyGroup(adminActor, {
      name: "Familia Chanona",
      ownerPatientId: "father-1",
      primaryContact: { phone: "+529612222222" }
    });
    expect(tx.familyGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingGrants: {
            create: expect.objectContaining({
              canBook: true,
              canViewFinancialInformation: false,
              canViewClinicalInformation: false,
              canSignConsents: false
            })
          }
        })
      })
    );
  });

  it("materializes the family contact before allowing a shared phone link", async () => {
    const tx = {
      familyGroupContact: {
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({ id: "family-contact-1" })
      },
      patientContactLink: {
        updateMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: "link-1" })
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      patientIdentityConfig: { upsert: jest.fn().mockResolvedValue({ defaultCountry: "MX" }) },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "child-1" }) },
      contactPoint: {
        upsert: jest.fn().mockResolvedValue({ id: "contact-1", status: "UNVERIFIED" }),
        update: jest.fn().mockResolvedValue({ id: "contact-1", status: "FAMILY_SHARED" })
      },
      patientContactLink: {
        findMany: jest.fn().mockResolvedValue([{ patientId: "father-1" }]),
        count: jest.fn().mockResolvedValue(2)
      },
      familyGroupMember: {
        findMany: jest.fn().mockResolvedValue([
          { patientId: "father-1", role: "GROUP_OWNER" },
          { patientId: "child-1", role: "MINOR" }
        ])
      },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    await makeService(prisma).linkPatientPhone(adminActor, {
      patientId: "child-1",
      phone: "+529612222222",
      role: "SHARED_FAMILY",
      familyGroupId: "family-1",
      consentStatus: "ACCEPTED"
    });
    expect(tx.familyGroupContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          familyGroupId: "family-1",
          contactPointId: "contact-1",
          actorPatientId: "father-1"
        })
      })
    );
  });

  it("does not turn consent acceptance into an implicit booking permission", async () => {
    const member = {
      id: "member-adult",
      familyGroupId: "family-1",
      organizationId: "org-1",
      patientId: "adult-1",
      consentStatus: "PENDING",
      version: 1
    };
    const prisma = {
      familyGroupMember: {
        findFirst: jest.fn().mockResolvedValue(member),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...member, consentStatus: "ACCEPTED", version: 2 })
      },
      familyBookingGrant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      patientContactLink: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    await makeService(prisma).updateFamilyMember(adminActor, "family-1", "member-adult", {
      consentStatus: "ACCEPTED",
      expectedVersion: 1
    });
    const grantUpdate = prisma.familyBookingGrant.updateMany.mock.calls[0][0].data;
    expect(grantUpdate).not.toHaveProperty("canBook");
    expect(grantUpdate).not.toHaveProperty("canViewClinicalInformation");
  });

  it("allows a father to select himself", async () => {
    const session = familySession();
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...session, ...data }))
      },
      familyBookingGrant: { findFirst: jest.fn().mockResolvedValue(authorizedGrant("father-1")) },
      familyGroupMember: {
        findFirst: jest.fn().mockResolvedValue({ relationship: "Responsable", role: "GROUP_OWNER" })
      },
      auditLog: { create: jest.fn() }
    };
    const result = await makeService(prisma).selectSessionPatient("org-1", "session-1", {
      patientId: "father-1"
    });
    expect(result.selectedPatientId).toBe("father-1");
  });

  it("creates the appointment for the child and records the father as booking actor", async () => {
    const session = familySession({
      selectedPatientId: "child-1",
      status: "SELECTED",
      selectionExpiresAt: future()
    });
    const transaction = jest
      .fn()
      .mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations));
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue({})
      },
      bookingIdempotency: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "idem-1" }),
        update: jest.fn().mockResolvedValue({})
      },
      familyBookingGrant: { findFirst: jest.fn().mockResolvedValue(authorizedGrant("child-1")) },
      familyGroupMember: { findFirst: jest.fn().mockResolvedValue({ relationship: "Hijo", role: "MINOR" }) },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "bot@clinic.test",
          firstName: "Bot",
          lastName: "Booking",
          roleId: null,
          role: null,
          roles: [],
          branches: [{ branchId: "branch-1" }],
          permissions: []
        })
      },
      appointmentBookingActor: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: transaction
    };
    const appointments = {
      create: jest.fn().mockResolvedValue({ id: "appointment-1", patientId: "child-1" }),
      findOne: jest.fn()
    };
    await makeService(prisma, appointments).bookResolvedAppointment(
      "org-1",
      "session-1",
      {
        branchId: "branch-1",
        professionalId: "professional-1",
        title: "Consulta",
        startAt: "2026-08-01T15:00:00.000Z",
        endAt: "2026-08-01T15:30:00.000Z"
      },
      "idem-family"
    );
    expect(appointments.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ patientId: "child-1" })
    );
    expect(prisma.appointmentBookingActor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          actorPatientId: "father-1",
          familyGroupId: "family-1",
          contactPointId: "contact-1",
          bookingSource: "WHATSAPP"
        })
      })
    );
  });

  it("keeps two children with the same name distinguishable by patient id", async () => {
    const session = familySession();
    const prisma = {
      bookingIdentitySession: { findFirst: jest.fn().mockResolvedValue(session) },
      familyGroupMember: {
        findFirst: jest.fn().mockResolvedValue({ id: "manager-1" }),
        findMany: jest.fn().mockResolvedValue([])
      },
      patient: {
        findMany: jest.fn().mockResolvedValue([
          { id: "child-1", firstName: "Mateo", lastName: "Chanona", birthDate: new Date("2015-01-01") },
          { id: "child-2", firstName: "Mateo", lastName: "Chanona", birthDate: new Date("2015-01-01") }
        ])
      }
    };
    const result = await makeService(prisma).lookupBookingFamilyMember("org-1", "session-1", {
      branchId: "branch-1",
      firstName: "Mateo",
      lastName: "Chanona",
      birthDate: "2015-01-01"
    });
    expect(result.matches.map((match) => match.patientId)).toEqual(["child-1", "child-2"]);
  });

  it("rejects an integrante without booking permission", async () => {
    const prisma = {
      bookingIdentitySession: { findFirst: jest.fn().mockResolvedValue(familySession()) },
      familyBookingGrant: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    await expect(
      makeService(prisma).selectSessionPatient("org-1", "session-1", { patientId: "child-1" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an adult without explicit consent", async () => {
    const prisma = {
      bookingIdentitySession: { findFirst: jest.fn().mockResolvedValue(familySession()) },
      familyBookingGrant: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    await expect(
      makeService(prisma).selectSessionPatient("org-1", "session-1", { patientId: "adult-1" })
    ).rejects.toThrow("consentimiento");
  });

  it("reveals only authorized family members after the phone is verified", async () => {
    const session = familySession({ contactVerifiedAt: null, resolution: "CONTACT_VERIFICATION_REQUIRED" });
    const members = [
      {
        patientId: "father-1",
        role: "GROUP_OWNER",
        relationship: "Responsable",
        consentStatus: "ACCEPTED",
        patient: {
          id: "father-1",
          firstName: "Eduardo",
          lastName: "Chanona",
          birthDate: new Date("1990-01-01"),
          deletedAt: null,
          status: "ACTIVE"
        }
      },
      {
        patientId: "child-1",
        role: "MINOR",
        relationship: "Hijo",
        consentStatus: "ACCEPTED",
        patient: {
          id: "child-1",
          firstName: "Mateo",
          lastName: "Chanona",
          birthDate: new Date("2015-01-01"),
          deletedAt: null,
          status: "ACTIVE"
        }
      },
      {
        patientId: "adult-1",
        role: "ADULT_MEMBER",
        relationship: "Hermano",
        consentStatus: "PENDING",
        patient: {
          id: "adult-1",
          firstName: "Luis",
          lastName: "Chanona",
          birthDate: new Date("1995-01-01"),
          deletedAt: null,
          status: "ACTIVE"
        }
      }
    ];
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...session, ...data }))
      },
      patientContactLink: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ patientId: "father-1" }, { patientId: "child-1" }, { patientId: "adult-1" }])
      },
      familyGroupContact: {
        findMany: jest.fn().mockResolvedValue([
          {
            familyGroupId: "family-1",
            actorPatientId: "father-1",
            familyGroup: {
              members,
              bookingGrants: [
                authorizedGrant("father-1"),
                authorizedGrant("child-1"),
                authorizedGrant("adult-1")
              ]
            }
          }
        ])
      },
      contactPoint: {
        findFirst: jest.fn().mockResolvedValue({ id: "contact-1", status: "FAMILY_SHARED" }),
        update: jest.fn().mockResolvedValue({})
      },
      contactVerificationEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({})
      },
      bookingIdentityIncident: { upsert: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations))
    };
    const result = await makeService(prisma).verifyBookingContact("org-1", "session-1", {
      verified: true,
      method: "WHATSAPP_SESSION",
      providerEventId: "wamid-1"
    });
    expect(result).toEqual(
      expect.objectContaining({
        prompt: "¿Para quién deseas agendar?",
        candidates: expect.arrayContaining([
          expect.objectContaining({
            patientId: "child-1",
            displayName: "Mateo Chanona",
            relationship: "Hijo"
          })
        ])
      })
    );
    expect(result).not.toEqual(
      expect.objectContaining({
        candidates: expect.arrayContaining([expect.objectContaining({ patientId: "adult-1" })])
      })
    );
  });

  it("marks a duplicated phone without a common family as ambiguous and private", async () => {
    const prisma = {
      patientIdentityConfig: {
        upsert: jest
          .fn()
          .mockResolvedValue({ defaultCountry: "MX", shadowMode: true, whatsappResolutionEnabled: false })
      },
      bookingIdentitySession: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "session-1", selectedPatientId: null, expiresAt: data.expiresAt, ...data })
          )
      },
      contactPoint: {
        upsert: jest.fn().mockResolvedValue({ id: "contact-1", status: "UNVERIFIED" }),
        findFirst: jest.fn().mockResolvedValue({ id: "contact-1", status: "UNVERIFIED" }),
        update: jest.fn().mockResolvedValue({})
      },
      patientContactLink: {
        findMany: jest.fn().mockResolvedValue([{ patientId: "patient-1" }, { patientId: "patient-2" }])
      },
      familyGroupContact: { findMany: jest.fn().mockResolvedValue([]) },
      contactVerificationEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({})
      },
      bookingIdentityIncident: { upsert: jest.fn().mockResolvedValue({ id: "incident-1" }) },
      auditLog: { create: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations))
    };
    const result = await makeService(prisma).createSession("org-1", {
      source: "WHATSAPP",
      phone: "+529612222222",
      conversationId: "conversation-1",
      channelVerified: true
    });
    expect(result).toEqual(
      expect.objectContaining({ status: "AMBIGUOUS", resolution: "AMBIGUOUS", candidates: [] })
    );
    expect(prisma.bookingIdentityIncident.upsert).toHaveBeenCalled();
  });

  it("creates and selects a new minor family member atomically", async () => {
    const session = familySession();
    const tx = {
      patient: {
        create: jest.fn().mockResolvedValue({
          id: "new-child",
          firstName: "Sofia",
          lastName: "Chanona",
          birthDate: new Date("2018-04-02")
        })
      },
      familyGroupMember: { upsert: jest.fn().mockResolvedValue({}) },
      familyBookingGrant: { upsert: jest.fn().mockResolvedValue({}) },
      patientContactLink: { upsert: jest.fn().mockResolvedValue({}) },
      bookingIdentitySession: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      bookingIdentitySession: { findFirst: jest.fn().mockResolvedValue(session) },
      familyGroupMember: {
        findFirst: jest.fn().mockResolvedValue({ id: "manager-1" }),
        findMany: jest.fn().mockResolvedValue([])
      },
      patient: { findMany: jest.fn().mockResolvedValue([]) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const result = await makeService(prisma).addBookingFamilyMember("org-1", "session-1", {
      branchId: "branch-1",
      firstName: "Sofia",
      lastName: "Chanona",
      birthDate: "2018-04-02",
      relationship: "Hija"
    });
    expect(result).toEqual(expect.objectContaining({ status: "SELECTED", patientId: "new-child" }));
    expect(tx.bookingIdentitySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ selectedPatientId: "new-child", status: "SELECTED" })
      })
    );
    expect(tx.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ phone: expect.anything() })
      })
    );
  });

  it("creates a new family from WhatsApp with a responsible and a minor without a personal child phone", async () => {
    const session = familySession({
      familyGroupId: null,
      bookingActorPatientId: null,
      resolution: "NO_MATCH"
    });
    const tx = {
      patient: {
        create: jest
          .fn()
          .mockResolvedValueOnce({
            id: "mother-1",
            firstName: "Maria",
            lastName: "Lopez",
            birthDate: new Date("1992-04-10")
          })
          .mockResolvedValueOnce({
            id: "child-1",
            firstName: "Mateo",
            lastName: "Lopez",
            birthDate: new Date("2017-01-20")
          }),
        findFirstOrThrow: jest.fn()
      },
      familyGroup: { create: jest.fn().mockResolvedValue({ id: "family-new" }) },
      contactPoint: { update: jest.fn().mockResolvedValue({}) },
      familyGroupMember: { upsert: jest.fn().mockResolvedValue({}) },
      familyBookingGrant: { upsert: jest.fn().mockResolvedValue({}) },
      patientContactLink: { upsert: jest.fn().mockResolvedValue({}) },
      bookingIdentitySession: {
        update: jest.fn().mockResolvedValue({
          ...session,
          familyGroupId: "family-new",
          bookingActorPatientId: "mother-1",
          resolution: "FAMILY_SHARED",
          status: "PENDING"
        })
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      bookingIdempotency: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "idem-create-family" }),
        upsert: jest.fn().mockResolvedValue({})
      },
      bookingIdentitySession: { findFirst: jest.fn().mockResolvedValue(session) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      patient: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const result = await makeService(prisma).createBookingFamily(
      "org-1",
      "session-1",
      {
        branchId: "branch-1",
        groupName: "Familia Lopez",
        responsible: {
          firstName: "Maria",
          lastName: "Lopez",
          birthDate: "1992-04-10"
        },
        members: [
          {
            firstName: "Mateo",
            lastName: "Lopez",
            birthDate: "2017-01-20",
            relationship: "Hijo"
          }
        ]
      },
      "idem-create-family"
    );
    expect(result).toEqual(expect.objectContaining({ familyGroupId: "family-new" }));
    expect(tx.patient.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.not.objectContaining({ phone: expect.anything() })
      })
    );
    expect(tx.patientContactLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          patientId: "child-1",
          contactPointId: "contact-1",
          role: "SHARED_FAMILY"
        })
      })
    );
    expect(prisma.bookingIdempotency.upsert).toHaveBeenCalled();
  });

  it("returns the existing conversation for a repeated webhook", async () => {
    const existing = familySession({
      selectedPatientId: "child-1",
      status: "SELECTED",
      selectionExpiresAt: future()
    });
    const prisma = {
      patientIdentityConfig: {
        upsert: jest
          .fn()
          .mockResolvedValue({ defaultCountry: "MX", shadowMode: true, whatsappResolutionEnabled: false })
      },
      bookingIdentitySession: { findUnique: jest.fn().mockResolvedValue(existing) },
      contactPoint: { upsert: jest.fn() }
    };
    const result = await makeService(prisma).createSession("org-1", {
      source: "WHATSAPP",
      phone: "+529612222222",
      conversationId: "conversation-1",
      channelVerified: true
    });
    expect(result).toEqual(
      expect.objectContaining({ selectedPatientId: "child-1", hasSelectedPatient: true })
    );
    expect(prisma.contactPoint.upsert).not.toHaveBeenCalled();
  });

  it("audits changing the selected patient during an active conversation", async () => {
    const session = familySession({
      selectedPatientId: "child-1",
      status: "SELECTED",
      selectionExpiresAt: future()
    });
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...session, ...data }))
      },
      familyBookingGrant: { findFirst: jest.fn().mockResolvedValue(authorizedGrant("child-2")) },
      familyGroupMember: { findFirst: jest.fn().mockResolvedValue({ relationship: "Hijo", role: "MINOR" }) },
      auditLog: { create: jest.fn() }
    };
    await makeService(prisma).selectSessionPatient("org-1", "session-1", { patientId: "child-2" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "change_selected_patient" })
    });
  });

  it("expires and clears selected_patient_id", async () => {
    const session = familySession({
      selectedPatientId: "child-1",
      status: "SELECTED",
      selectionExpiresAt: new Date(Date.now() - 1_000)
    });
    const prisma = {
      bookingIdentitySession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue({})
      }
    };
    await expect(
      makeService(prisma).getSelectedPatientForSession("org-1", "session-1")
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.bookingIdentitySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ selectedPatientId: null, status: "EXPIRED" })
      })
    );
  });

  it("does not expose candidates before phone verification", async () => {
    const prisma = {
      patientIdentityConfig: {
        upsert: jest
          .fn()
          .mockResolvedValue({ defaultCountry: "MX", shadowMode: true, whatsappResolutionEnabled: false })
      },
      bookingIdentitySession: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "session-1", selectedPatientId: null, expiresAt: data.expiresAt, ...data })
          )
      },
      contactPoint: { upsert: jest.fn().mockResolvedValue({ id: "contact-1" }) },
      patientContactLink: { findMany: jest.fn() },
      familyGroupContact: { findMany: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const result = await makeService(prisma).createSession("org-1", {
      source: "WHATSAPP",
      phone: "+529612222222",
      conversationId: "conversation-privacy"
    });
    expect(result).toEqual(
      expect.objectContaining({ resolution: "CONTACT_VERIFICATION_REQUIRED", candidates: [] })
    );
    expect(prisma.patientContactLink.findMany).not.toHaveBeenCalled();
    expect(prisma.familyGroupContact.findMany).not.toHaveBeenCalled();
  });
});
