import { describe, expect, it } from "vitest";
import {
  validateCollaboratorForm,
  type CollaboratorFormValidationInput
} from "../utils/collaborator-form-validation";

const baseInput: CollaboratorFormValidationInput = {
  editing: false,
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@example.com",
  password: "Password1",
  roleId: "role-1",
  branchIds: ["branch-1"],
  primaryBranchId: "branch-1",
  professionalEnabled: false,
  professionalBranchId: "",
  specialtyIds: [],
  commissionRate: "0",
  applyWeeklySchedule: false,
  workDays: [1, 2, 3, 4, 5],
  startTime: "10:00",
  endTime: "19:00",
  breakStartTime: "14:00",
  breakEndTime: "15:00"
};

describe("users-page collaborator validation", () => {
  it("blocks invalid emails before calling the API", () => {
    const result = validateCollaboratorForm({ ...baseInput, email: "ana.invalid" });

    expect(result.valid).toBe(false);
    expect(result.errors.email).toBe("Ingresa un correo valido.");
  });

  it("allows multi-branch user access with one clinical professional branch", () => {
    const result = validateCollaboratorForm({
      ...baseInput,
      branchIds: ["branch-1", "branch-2"],
      primaryBranchId: "branch-1",
      professionalEnabled: true,
      professionalBranchId: "branch-2",
      specialtyIds: ["specialty-1"]
    });

    expect(result.valid).toBe(true);
    expect(result.errors.professionalBranchId).toBeUndefined();
  });

  it("blocks invalid professional schedule ranges", () => {
    const result = validateCollaboratorForm({
      ...baseInput,
      professionalEnabled: true,
      professionalBranchId: "branch-1",
      specialtyIds: ["specialty-1"],
      applyWeeklySchedule: true,
      startTime: "19:00",
      endTime: "10:00"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.schedule).toBe("La entrada debe ser menor que la salida.");
  });
});
