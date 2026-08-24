import type { AuthUser } from "../../common/types/auth-user";
import { PatientsService } from "./patients.service";

describe("PatientsService task and note attachments", () => {
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

  it("creates a real patient task with assignee and due date", async () => {
    const tx = {
      patientTask: {
        create: jest.fn().mockResolvedValue({
          id: "task-1",
          patientId: "patient-1",
          type: "Agendar Cita",
          detail: "Fijar cita por ausencia",
          dueDate: new Date("2026-08-28T00:00:00.000Z"),
          assignedToId: "user-2",
          status: "PENDING"
        })
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1" })
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "user-2" })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new PatientsService(prisma as never);

    await service.createTask(actor, "patient-1", {
      type: "Agendar Cita",
      detail: "Fijar cita por ausencia",
      dueDate: "2026-08-28",
      assignedToId: "user-2"
    });

    expect(tx.patientTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          patientId: "patient-1",
          type: "Agendar Cita",
          detail: "Fijar cita por ausencia",
          assignedToId: "user-2",
          createdById: "user-1"
        })
      })
    );
  });

  it("rejects administrative note attachments that do not belong to the patient", async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1" })
      },
      fileAttachment: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const service = new PatientsService(prisma as never);

    await expect(
      service.addNote(actor, "patient-1", {
        note: "Comentario con archivo",
        fileAttachmentIds: ["file-from-other-patient"]
      })
    ).rejects.toThrow("One or more attachments do not belong to this patient");
  });
});

describe("PatientsService exact duplicate guard", () => {
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
  const duplicatePatient = {
    id: "patient-existing",
    firstName: "CHANONA",
    lastName: "ARREOLA",
    phone: "9613184040",
    email: "programador1.wi@gmail.com"
  };

  it("persists the social and legacy identity fields when creating a patient", async () => {
    const tx = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "patient-social",
          firstName: "Alex",
          socialName: "Lex",
          lastName: "Rivera",
          email: null,
          phone: null,
          documentNumber: null
        })
      },
      patientContact: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      patient: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx))
    };
    const service = new PatientsService(prisma as never);
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "patient-social" } as never);

    await service.create(actor, {
      branchId: "branch-1",
      firstName: "Alex",
      socialName: "Lex",
      lastName: "Rivera",
      internalNumber: "EXP-25",
      sex: "NO_ESPECIFICADO",
      employer: "Warner",
      observations: "Usar nombre social",
      contacts: [
        {
          name: "Tutor Rivera",
          socialName: "Tutor",
          documentNumber: "TUTOR123",
          gender: "OTRO"
        }
      ]
    });

    expect(tx.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          socialName: "Lex",
          internalNumber: "EXP-25",
          sex: "NO_ESPECIFICADO",
          employer: "Warner",
          observations: "Usar nombre social"
        })
      })
    );
    expect(tx.patientContact.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ socialName: "Tutor", documentNumber: "TUTOR123", gender: "OTRO" })]
      })
    );
  });

  function exactDuplicateService(prisma: unknown) {
    return new PatientsService(prisma as never) as unknown as {
      ensureNoExactPatientDuplicate: (
        actor: AuthUser,
        fields: { firstName?: string; lastName?: string; phone?: string | null; email?: string | null },
        excludeId?: string
      ) => Promise<void>;
    };
  }

  it("rejects creating a patient with same name, last name, phone and email", async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      patient: { findMany: jest.fn().mockResolvedValue([duplicatePatient]) },
      $transaction: jest.fn()
    };
    const service = new PatientsService(prisma as never);

    await expect(
      service.create(actor, {
        branchId: "branch-1",
        firstName: " chanona ",
        lastName: "arreola",
        phone: "961-318-4040",
        email: " PROGRAMADOR1.WI@GMAIL.COM "
      })
    ).rejects.toThrow("Ya existe un paciente con el mismo nombre");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects another patient's exact identity when excluding the current patient", async () => {
    const prisma = {
      patient: {
        findMany: jest.fn().mockResolvedValue([duplicatePatient])
      }
    };
    const service = exactDuplicateService(prisma);

    await expect(
      service.ensureNoExactPatientDuplicate(
        actor,
        {
        firstName: "CHANONA",
        lastName: "ARREOLA",
        phone: "9613184040",
        email: "programador1.wi@gmail.com"
        },
        "patient-current"
      )
    ).rejects.toThrow("Ya existe un paciente con el mismo nombre");
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "patient-current" } })
      })
    );
  });

  it("allows the same name when phone is different", async () => {
    const prisma = {
      patient: { findMany: jest.fn().mockResolvedValue([{ ...duplicatePatient, phone: "9610000000" }]) }
    };
    const service = exactDuplicateService(prisma);

    await expect(
      service.ensureNoExactPatientDuplicate(actor, {
        firstName: "CHANONA",
        lastName: "ARREOLA",
        phone: "9613184040",
        email: "programador1.wi@gmail.com"
      })
    ).resolves.toBeUndefined();
  });

  it("allows same phone and email when the name is different", async () => {
    const prisma = {
      patient: { findMany: jest.fn().mockResolvedValue([{ ...duplicatePatient, firstName: "OTRA" }]) }
    };
    const service = exactDuplicateService(prisma);

    await expect(
      service.ensureNoExactPatientDuplicate(actor, {
        firstName: "CHANONA",
        lastName: "ARREOLA",
        phone: "9613184040",
        email: "programador1.wi@gmail.com"
      })
    ).resolves.toBeUndefined();
  });

  it("excludes the current patient when checking duplicate identity", async () => {
    const prisma = {
      patient: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = exactDuplicateService(prisma);

    await service.ensureNoExactPatientDuplicate(
      actor,
      {
        firstName: "CHANONA",
        lastName: "ARREOLA",
        phone: "9613184040",
        email: "programador1.wi@gmail.com"
      },
      "patient-current"
    );

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "patient-current" } })
      })
    );
  });
});

describe("PatientsService shared phone boundary", () => {
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

  it("rejects an ordinary patient creation when the normalized phone belongs to another patient", async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      contactPoint: {
        findUnique: jest.fn().mockResolvedValue({
          id: "contact-1",
          patientLinks: [{ id: "link-existing" }]
        })
      },
      patient: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn()
    };
    const identity = {
      normalizePhone: jest.fn().mockResolvedValue({ normalizedValue: "+529612222222" })
    };
    const service = new PatientsService(prisma as never, undefined, undefined, identity as never);

    await expect(
      service.create(actor, {
        branchId: "branch-1",
        firstName: "Otro",
        lastName: "Paciente",
        phone: "961 222 2222"
      })
    ).rejects.toThrow("grupo familiar");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
