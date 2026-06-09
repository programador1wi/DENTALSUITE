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
