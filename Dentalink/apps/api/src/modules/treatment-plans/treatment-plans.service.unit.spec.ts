import { BadRequestException } from "@nestjs/common";
import {
  AppointmentStatus,
  ProfessionalBranchStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanKind,
  TreatmentPriceSource
} from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { TreatmentPlansService } from "./treatment-plans.service";

describe("TreatmentPlansService professional branch validation", () => {
  const generalProfessionalSpecialty = {
    specialty: { id: "specialty-general", name: "General", isActive: true }
  };
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1", "branch-2"],
    permissions: []
  };

  it("rejects treatment plans with a professional outside the selected branch", async () => {
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-1" })
      },
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", agreement: null })
      },
      professional: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new TreatmentPlansService(prisma as never);

    await expect(
      service.createTreatmentPlan(actor, {
        branchId: "branch-1",
        patientId: "patient-1",
        professionalId: "professional-2",
        name: "Plan inicial"
      } as never)
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "professional-2",
          organizationId: "org-1",
          isActive: true,
          branches: {
            some: expect.objectContaining({
              branchId: "branch-1",
              status: ProfessionalBranchStatus.ACTIVE
            })
          }
        })
      })
    );
  });

  it("stores planned orthodontic controls in the treatment profile", async () => {
    const currentPlan = {
      id: "plan-ortho",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      kind: TreatmentPlanKind.ORTHODONTICS,
      patient: { id: "patient-1", agreement: null }
    };
    const savedProfile = {
      id: "profile-1",
      treatmentPlanId: "plan-ortho",
      startDate: null,
      estimatedMonths: 24,
      estimatedControls: 18
    };
    const detailPlan = {
      ...currentPlan,
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      branch: { id: "branch-1", name: "Sucursal 1" },
      specialty: { id: "specialty-ortho", name: "Ortodoncia" },
      orthodonticProfile: savedProfile,
      pauses: [],
      sections: [],
      items: [],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: [],
      clinicalEvolutions: []
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(currentPlan).mockResolvedValueOnce(detailPlan)
      },
      orthodonticTreatmentProfile: {
        upsert: jest.fn().mockResolvedValue(savedProfile)
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const service = new TreatmentPlansService(prisma as never);

    const result = await service.updateOrthodonticProfile(actor, "plan-ortho", {
      estimatedMonths: 24,
      estimatedControls: 18
    });

    expect(prisma.orthodonticTreatmentProfile.upsert).toHaveBeenCalledWith({
      where: { treatmentPlanId: "plan-ortho" },
      create: expect.objectContaining({
        treatmentPlanId: "plan-ortho",
        estimatedMonths: 24,
        estimatedControls: 18
      }),
      update: expect.objectContaining({
        estimatedMonths: 24,
        estimatedControls: 18
      })
    });
    expect(result.orthodonticSummary?.estimatedControls).toBe(18);
  });

  it("changes patient and current plan branch without moving future appointments by default", async () => {
    const currentPlan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      kind: TreatmentPlanKind.GENERAL,
      patient: { id: "patient-1", agreement: null }
    };
    const updatedPlan = {
      ...currentPlan,
      branchId: "branch-2",
      professionalId: "professional-2",
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-2", firstName: "Dr", lastName: "Nuevo" },
      branch: { id: "branch-2", name: "Sucursal 2" },
      sections: [],
      items: [],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      patient: { update: jest.fn() },
      treatmentPlan: { update: jest.fn() },
      appointment: { updateMany: jest.fn() }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(currentPlan).mockResolvedValueOnce(updatedPlan)
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-2" })
      },
      professional: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "professional-2", specialties: [generalProfessionalSpecialty] })
      },
      appointment: {
        count: jest.fn().mockResolvedValue(2)
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    const result = await service.changeBranch(actor, "plan-1", {
      branchId: "branch-2",
      professionalId: "professional-2"
    });

    expect(tx.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: { branchId: "branch-2" }
    });
    expect(tx.treatmentPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: {
        branchId: "branch-2",
        professionalId: "professional-2",
        specialtyId: "specialty-general",
        specialtySnapshotName: expect.any(String)
      }
    });
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
    expect(result.futureAppointmentsCount).toBe(2);
    expect(result.movedFutureAppointmentsCount).toBe(0);
  });

  it("moves future appointments when explicitly requested", async () => {
    const currentPlan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      kind: TreatmentPlanKind.GENERAL,
      patient: { id: "patient-1", agreement: null }
    };
    const updatedPlan = {
      ...currentPlan,
      branchId: "branch-2",
      professionalId: "professional-2",
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-2", firstName: "Dr", lastName: "Nuevo" },
      branch: { id: "branch-2", name: "Sucursal 2" },
      sections: [],
      items: [],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      patient: { update: jest.fn() },
      treatmentPlan: { update: jest.fn() },
      appointment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(currentPlan).mockResolvedValueOnce(updatedPlan)
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-2" })
      },
      professional: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "professional-2", specialties: [generalProfessionalSpecialty] })
      },
      appointment: {
        count: jest.fn().mockResolvedValue(2)
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    const result = await service.changeBranch(actor, "plan-1", {
      branchId: "branch-2",
      professionalId: "professional-2",
      moveFutureAppointments: true
    });

    expect(tx.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          treatmentPlanId: "plan-1",
          status: expect.objectContaining({
            notIn: expect.arrayContaining([
              AppointmentStatus.COMPLETED,
              AppointmentStatus.CANCELLED_BY_PATIENT
            ])
          })
        }),
        data: {
          branchId: "branch-2",
          professionalId: "professional-2",
          chairId: null,
          updatedById: "user-1"
        }
      })
    );
    expect(result.movedFutureAppointmentsCount).toBe(2);
  });

  it("syncs an updated treatment item with one odontogram tooth procedure", async () => {
    const currentItem = {
      id: "item-1",
      treatmentPlanId: "plan-1",
      procedureId: "procedure-1",
      sectionId: null,
      toothNumber: null,
      surface: null,
      quantity: 1,
      unitPrice: 100,
      discount: 0,
      total: 100,
      status: "PLANNED",
      notes: null,
      agreementCoverage: 0
    };
    const plan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      patient: { id: "patient-1", agreement: null }
    };
    const updatedItem = {
      ...currentItem,
      toothNumber: "14",
      surface: "P,M",
      status: "PLANNED"
    };
    const detailPlan = {
      ...plan,
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      branch: { id: "branch-1", name: "Sucursal 1" },
      sections: [],
      items: [updatedItem],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      treatmentPlanItem: {
        update: jest.fn().mockResolvedValue(updatedItem)
      },
      toothProcedure: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn()
      },
      odontogramRecord: {
        create: jest.fn().mockResolvedValue({ id: "record-1" })
      }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(detailPlan)
      },
      treatmentPlanItem: {
        findFirst: jest.fn().mockResolvedValue(currentItem)
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    await service.updateItem(actor, "plan-1", "item-1", {
      toothNumber: "14",
      surface: "P,M",
      syncOdontogram: true
    } as never);

    expect(tx.toothProcedure.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { treatmentPlanItemId: "item-1" }
      })
    );
    expect(tx.odontogramRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: "patient-1",
          toothNumber: "14",
          surface: "P,M",
          procedureId: "procedure-1"
        })
      })
    );
    expect(tx.toothProcedure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          treatmentPlanItemId: "item-1",
          toothNumber: "14",
          surface: "P,M",
          odontogramRecordId: "record-1"
        })
      })
    );
  });

  it("syncs an added treatment item with full-tooth surface to the odontogram", async () => {
    const plan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      patient: { id: "patient-1", agreement: null }
    };
    const createdItem = {
      id: "item-1",
      treatmentPlanId: "plan-1",
      procedureId: "procedure-1",
      sectionId: null,
      toothNumber: "14",
      surface: "ALL",
      odontogramSymbol: "restoration",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      total: 0,
      status: TreatmentPlanItemStatus.PLANNED,
      notes: null,
      agreementCoverage: 0
    };
    const detailPlan = {
      ...plan,
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      branch: { id: "branch-1", name: "Sucursal 1" },
      sections: [],
      items: [createdItem],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      treatmentPlanItem: {
        create: jest.fn().mockResolvedValue(createdItem)
      },
      toothProcedure: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn()
      },
      odontogramRecord: {
        create: jest.fn().mockResolvedValue({ id: "record-1" })
      }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(detailPlan)
      },
      procedure: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: "procedure-1" })
          .mockResolvedValueOnce({
            id: "procedure-1",
            code: "RES",
            category: { name: "Operatoria" }
          })
      },
      branchPriceList: {
        count: jest.fn().mockResolvedValue(0)
      },
      priceListItem: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    await service.addItem(actor, "plan-1", {
      procedureId: "procedure-1",
      toothNumber: "14",
      surface: "ALL",
      odontogramSymbol: "restoration",
      quantity: 1,
      syncOdontogram: true
    } as never);

    expect(tx.odontogramRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: "patient-1",
          toothNumber: "14",
          surface: "ALL",
          diagnosis: "restoration",
          odontogramSymbol: "restoration",
          procedureId: "procedure-1",
          status: "PLANNED"
        })
      })
    );
    expect(tx.toothProcedure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          treatmentPlanId: "plan-1",
          treatmentPlanItemId: "item-1",
          toothNumber: "14",
          surface: "ALL",
          diagnosis: "restoration",
          odontogramSymbol: "restoration",
          odontogramRecordId: "record-1"
        })
      })
    );
  });

  it("updates plannedAt without changing the clinical item status", async () => {
    const plannedAt = "2026-06-09T10:00:00.000Z";
    const currentItem = {
      id: "item-1",
      treatmentPlanId: "plan-1",
      procedureId: "procedure-1",
      sectionId: null,
      toothNumber: null,
      surface: null,
      quantity: 1,
      unitPrice: 100,
      discount: 0,
      total: 100,
      status: TreatmentPlanItemStatus.ACCEPTED,
      notes: null,
      plannedAt: null,
      agreementCoverage: 0
    };
    const plan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      patient: { id: "patient-1", agreement: null }
    };
    const updatedItem = {
      ...currentItem,
      plannedAt: new Date(plannedAt)
    };
    const detailPlan = {
      ...plan,
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      branch: { id: "branch-1", name: "Sucursal 1" },
      sections: [],
      items: [updatedItem],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      treatmentPlanItem: {
        update: jest.fn().mockResolvedValue(updatedItem)
      }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(detailPlan)
      },
      treatmentPlanItem: {
        findFirst: jest.fn().mockResolvedValue(currentItem)
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    await service.updateItem(actor, "plan-1", "item-1", { plannedAt } as never);

    const updateData = tx.treatmentPlanItem.update.mock.calls[0][0].data;
    expect(updateData.plannedAt).toEqual(new Date(plannedAt));
    expect(updateData).not.toHaveProperty("status");
  });

  it("clears plannedAt without changing the clinical item status", async () => {
    const currentItem = {
      id: "item-1",
      treatmentPlanId: "plan-1",
      procedureId: "procedure-1",
      sectionId: null,
      toothNumber: null,
      surface: null,
      quantity: 1,
      unitPrice: 100,
      discount: 0,
      total: 100,
      status: TreatmentPlanItemStatus.ACCEPTED,
      notes: null,
      plannedAt: new Date("2026-06-09T10:00:00.000Z"),
      agreementCoverage: 0
    };
    const plan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      patient: { id: "patient-1", agreement: null }
    };
    const updatedItem = {
      ...currentItem,
      plannedAt: null
    };
    const detailPlan = {
      ...plan,
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      branch: { id: "branch-1", name: "Sucursal 1" },
      sections: [],
      items: [updatedItem],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      treatmentPlanItem: {
        update: jest.fn().mockResolvedValue(updatedItem)
      }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(detailPlan)
      },
      treatmentPlanItem: {
        findFirst: jest.fn().mockResolvedValue(currentItem)
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    await service.updateItem(actor, "plan-1", "item-1", { plannedAt: null } as never);

    const updateData = tx.treatmentPlanItem.update.mock.calls[0][0].data;
    expect(updateData.plannedAt).toBeNull();
    expect(updateData).not.toHaveProperty("status");
  });

  it("stores price list traceability when adding a treatment item from the resolved agreement list", async () => {
    const plan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      patient: {
        id: "patient-1",
        agreement: { id: "agreement-1", isActive: true, priceListId: "price-list-1", discountPercent: 0 }
      }
    };
    const detailPlan = {
      ...plan,
      patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      branch: { id: "branch-1", name: "Sucursal 1" },
      sections: [],
      items: [],
      budgets: [],
      alternativePlans: [],
      alternativesAsParent: []
    };
    const tx = {
      treatmentPlanItem: {
        create: jest.fn().mockResolvedValue({ id: "item-1", procedureId: "procedure-1" })
      }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(detailPlan)
      },
      procedure: {
        findFirst: jest.fn().mockResolvedValue({ id: "procedure-1" })
      },
      branchPriceList: {
        count: jest.fn().mockResolvedValue(0)
      },
      priceListItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: "price-item-1",
          priceListId: "price-list-1",
          price: 250,
          priceList: { id: "price-list-1", name: "POLIZA 2026" },
          priceListCategory: { name: "Endodoncia" },
          procedure: { code: "ENDO-1", name: "Endodoncia", category: { name: "Endodoncia" } }
        })
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never);

    await service.addItem(actor, "plan-1", { procedureId: "procedure-1", quantity: 2 } as never);

    const createdData = tx.treatmentPlanItem.create.mock.calls[0][0].data;
    expect(Number(createdData.unitPrice)).toBe(250);
    expect(Number(createdData.total)).toBe(500);
    expect(createdData.priceListId).toBe("price-list-1");
    expect(createdData.priceListItemId).toBe("price-item-1");
    expect(createdData.priceSource).toBe(TreatmentPriceSource.PRICE_LIST);
    expect(createdData.priceSnapshotName).toBe("POLIZA 2026");
    expect(createdData.priceSnapshotCode).toBe("ENDO-1");
    expect(createdData.priceSnapshotCategory).toBe("Endodoncia");
    expect(createdData.priceResolvedAt).toBeInstanceOf(Date);
  });

  it("rejects manual price overrides without the explicit price list permission", async () => {
    const plan = {
      id: "plan-1",
      organizationId: "org-1",
      patientId: "patient-1",
      branchId: "branch-1",
      professionalId: "professional-1",
      patient: {
        id: "patient-1",
        agreement: { id: "agreement-1", isActive: true, priceListId: "price-list-1", discountPercent: 0 }
      }
    };
    const prisma = {
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValue(plan)
      },
      procedure: {
        findFirst: jest.fn().mockResolvedValue({ id: "procedure-1" })
      },
      branchPriceList: {
        count: jest.fn().mockResolvedValue(0)
      },
      priceListItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: "price-item-1",
          priceListId: "price-list-1",
          price: 250,
          priceList: { id: "price-list-1", name: "POLIZA 2026" },
          priceListCategory: { name: "Endodoncia" },
          procedure: { code: "ENDO-1", name: "Endodoncia", category: { name: "Endodoncia" } }
        })
      },
      $transaction: jest.fn()
    };
    const service = new TreatmentPlansService(prisma as never);

    await expect(
      service.addItem(actor, "plan-1", { procedureId: "procedure-1", quantity: 1, unitPrice: 999 } as never)
    ).rejects.toThrow("Manual price overrides require price_lists.override_manual permission");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
