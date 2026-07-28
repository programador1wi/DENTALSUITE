import { http } from "@/lib/api/http-client";
import { listCashRegisters, type CashRegisterStatus } from "./payments.service";

vi.mock("@/lib/api/http-client", () => ({
  http: {
    get: vi.fn()
  }
}));

describe("listCashRegisters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
  });

  it("omits an absent status instead of serializing status=", async () => {
    await listCashRegisters({ branchId: "branch-1" });

    expect(http.get).toHaveBeenCalledWith("/cash-register", {
      params: { branchId: "branch-1" }
    });
  });

  it("keeps a valid cash-register status", async () => {
    await listCashRegisters({ branchId: "branch-1", status: "CLOSED" });

    expect(http.get).toHaveBeenCalledWith("/cash-register", {
      params: { branchId: "branch-1", status: "CLOSED" }
    });
  });

  it("defensively drops a blank status received from an untyped caller", async () => {
    await listCashRegisters({ branchId: "branch-1", status: "" as CashRegisterStatus });

    expect(http.get).toHaveBeenCalledWith("/cash-register", {
      params: { branchId: "branch-1" }
    });
  });
});
