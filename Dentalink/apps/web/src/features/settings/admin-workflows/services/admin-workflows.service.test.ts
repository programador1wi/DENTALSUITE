import { http } from "@/lib/api/http-client";
import {
  createCompanyPayment,
  createPayrollDiscountPlan,
  listAgreementDebts
} from "./admin-workflows.service";

vi.mock("@/lib/api/http-client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe("agreement debt service contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue({ data: {} });
    vi.mocked(http.post).mockResolvedValue({ data: {} });
  });

  it("sends the cutoff and identity filters to the real debt-report route", async () => {
    const params = {
      cutoffDate: "2026-07-20",
      companyId: "company-1",
      agreementId: "agreement-1",
      branchId: "branch-1",
      currencyId: "MXN" as const,
      scope: "AUTHORIZED" as const,
      page: 1,
      pageSize: 100
    };

    await listAgreementDebts(params);

    expect(http.get).toHaveBeenCalledWith("/agreements/debt-report", { params });
  });

  it("uses idempotency and correlation headers when receiving a company payment", async () => {
    await createCompanyPayment(
      "agreement-1",
      {
        paymentDate: "2026-07-20",
        amount: 125,
        currencyId: "MXN",
        paymentMethodId: "method-1",
        allocationStrategy: "AUTO_DUE_DATE",
        confirm: true
      },
      "idem-1"
    );

    expect(http.post).toHaveBeenCalledWith(
      "/agreements/agreement-1/payments",
      expect.objectContaining({ amount: 125, allocationStrategy: "AUTO_DUE_DATE" }),
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": "idem-1" })
      })
    );
  });

  it("creates payroll charges from selected treatment items", async () => {
    const payload = {
      treatmentPlanId: "plan-1",
      treatmentPlanItemIds: ["item-1", "item-2"],
      installmentCount: 3,
      firstDueDate: "2026-08-01",
      periodicity: "MONTHLY" as const
    };

    await createPayrollDiscountPlan("agreement-1", payload);

    expect(http.post).toHaveBeenCalledWith(
      "/agreements/agreement-1/payroll-discount-plans",
      payload,
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
});
