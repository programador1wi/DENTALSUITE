import { http } from "@/lib/api/http-client";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  updateApiKey,
  type CreateApiKeyPayload
} from "./api-keys.service";

vi.mock("@/lib/api/http-client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn()
  }
}));

describe("developer API credential service contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue({ data: {} });
    vi.mocked(http.post).mockResolvedValue({ data: {} });
    vi.mocked(http.patch).mockResolvedValue({ data: {} });
  });

  it("preserves search, lifecycle status and pagination in the list request", async () => {
    const params = { status: "ROTATING" as const, search: "agenda", page: 2, pageSize: 50 };
    await listApiKeys(params);
    expect(http.get).toHaveBeenCalledWith("/settings/api-keys", { params });
  });

  it("creates a credential with only external scopes and explicit restrictions", async () => {
    const payload: CreateApiKeyPayload = {
      name: "Agenda corporativa",
      scopes: ["patients:read", "appointments:write"],
      branchScope: "SELECTED",
      branchIds: ["branch-1"],
      networkScope: "ALLOWLIST",
      allowedIps: ["203.0.113.10"],
      expiresInDays: 90
    };
    await createApiKey(payload);
    expect(http.post).toHaveBeenCalledWith("/settings/api-keys", payload);
  });

  it("uses distinct update, rotate and revoke lifecycle endpoints", async () => {
    await updateApiKey("credential-1", { name: "Agenda renovada" });
    await rotateApiKey("credential-1");
    await revokeApiKey("credential-1");

    expect(http.patch).toHaveBeenCalledWith("/settings/api-keys/credential-1", { name: "Agenda renovada" });
    expect(http.post).toHaveBeenCalledWith("/settings/api-keys/credential-1/rotate");
    expect(http.post).toHaveBeenCalledWith("/settings/api-keys/credential-1/revoke");
  });
});
