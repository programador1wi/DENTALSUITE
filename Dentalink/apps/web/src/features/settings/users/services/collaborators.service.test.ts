import { http } from "@/lib/api/http-client";
import { createCollaborator, createProfessionalAccess, listCollaborators } from "./collaborators.service";

vi.mock("@/lib/api/http-client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe("collaborators service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 100 } });
    vi.mocked(http.post).mockResolvedValue({ data: { userId: "user-1", professionalId: "professional-1" } });
  });

  it("sends independent directory filters to the unified endpoint", async () => {
    const params = {
      search: "ortodoncia",
      branchId: "branch-1",
      kind: "CLINICAL" as const,
      accessStatus: "ACTIVE",
      clinicalStatus: "INACTIVE",
      page: 2,
      pageSize: 100
    };
    await listCollaborators(params);
    expect(http.get).toHaveBeenCalledWith("/collaborators", { params });
  });

  it("creates a clinical user and profile through one public request", async () => {
    const payload = {
      kind: "CLINICAL" as const,
      email: "doctor@example.com",
      password: "password123",
      firstName: "Ana",
      lastName: "Clinica",
      roleId: "role-1",
      branchIds: ["branch-1", "branch-2"],
      primaryBranchId: "branch-1",
      clinicalProfile: {
        branchId: "branch-1",
        specialtyIds: ["specialty-1"]
      }
    };
    await createCollaborator(payload);
    expect(http.post).toHaveBeenCalledWith("/collaborators", payload);
  });

  it("links credentials to an existing professional without creating another profile", async () => {
    const payload = {
      email: "doctor@example.com",
      password: "password123",
      roleId: "role-1",
      branchIds: ["branch-1"],
      primaryBranchId: "branch-1"
    };
    await createProfessionalAccess("professional-1", payload);
    expect(http.post).toHaveBeenCalledWith("/collaborators/professionals/professional-1/access", payload);
  });
});
