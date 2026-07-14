import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PatientBillingPage } from "./patient-billing-page";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "patient-1" }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useLocation: () => ({ pathname: "/patients/patient-1/billing" })
}));

vi.mock("../components/patient-header", () => ({
  PatientHeader: () => <div>Patient header</div>
}));

vi.mock("../components/patient-subnav", () => ({
  PatientSubnav: () => <div>Patient subnav</div>
}));

vi.mock("../components/patient-secondary-nav", () => ({
  PatientSecondaryNav: () => <div>Patient secondary nav</div>
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

vi.mock("../hooks/use-patients", () => ({
  usePatient: () => ({
    data: { id: "patient-1", agreement: null },
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/settings/payment-methods/hooks/use-payment-methods", () => ({
  usePaymentMethods: () => ({ data: [{ id: "method-1", name: "Efectivo" }] })
}));

vi.mock("@/features/settings/financial-institutions/hooks/use-financial-institutions", () => ({
  useFinancialInstitutions: () => ({ data: [{ id: "bank-1", name: "Banco" }] })
}));

vi.mock("@/features/treatments/hooks/use-treatments", () => ({
  useBudgets: () => ({ data: [], isLoading: false, isError: false, error: null })
}));

vi.mock("@/features/payments/services/payments.service", async () => {
  const actual = await vi.importActual<typeof import("@/features/payments/services/payments.service")>(
    "@/features/payments/services/payments.service"
  );
  return {
    ...actual,
    getPaymentReceipt: vi.fn(),
    downloadPaymentReceiptPdf: vi.fn().mockResolvedValue({ blob: new Blob(["pdf"]), fileName: "receipt.pdf" })
  };
});

vi.mock("@/features/payments/hooks/use-payments", () => ({
  useRefunds: () => ({ data: [], isLoading: false, isError: false, error: null }),
  usePaymentsMutations: () => ({
    updatePayment: { mutateAsync: vi.fn(), isPending: false },
    voidPayment: { mutateAsync: vi.fn(), isPending: false }
  }),
  usePatientPayments: () => ({
    data: {
      payments: [
        {
          id: "payment-1",
          paymentNumber: "206329",
          ticketId: "TICKET-1",
          branchId: "branch-1",
          patientId: "patient-1",
          amount: "700",
          currency: "MXN",
          status: "ALLOCATED",
          reference: "REF-1",
          notes: null,
          voidReason: null,
          voidedAt: null,
          voidedById: null,
          paidAt: "2026-07-03T12:00:00.000Z",
          createdAt: "2026-07-03T12:00:00.000Z",
          patient: { id: "patient-1", firstName: "Emilio", lastName: "Navarro", documentNumber: "30319" },
          branch: { id: "branch-1", name: "Dental + Suc. Leon" },
          paymentMethod: { id: "method-1", name: "Efectivo", type: "CASH" },
          financialInstitution: null,
          receivedBy: { id: "user-1", firstName: "Regina", lastName: "Mora" },
          cashRegister: null,
          dueDate: "2026-07-10T12:00:00.000Z",
          allocatedAmount: 700,
          unallocatedAmount: 0,
          treatmentRefs: [{ id: "plan-1", number: "PLAN-1", name: "Ortodoncia", procedures: ["Limpieza"] }],
          treatments: [],
          breakdown: [
            {
              id: "breakdown-1",
              kind: "TREATMENT",
              treatmentPlanId: "plan-1",
              treatmentNumber: "PLAN-1",
              treatmentName: "Ortodoncia",
              detail: "Limpieza dental",
              baseAmount: 900,
              paidAmount: 700,
              remainingAmount: 200,
              dueDate: null
            }
          ],
          allocations: [],
          refunds: []
        }
      ],
      links: [],
      installments: [],
      balance: {
        plannedAmount: 900,
        allocatedPaidAmount: 700,
        totalPaidAmount: 700,
        outstandingAmount: 200,
        unallocatedCredit: 0,
        overdueInstallments: 0
      },
      payablePlans: [],
      payableItems: []
    },
    isLoading: false,
    isError: false,
    error: null
  })
}));

describe("PatientBillingPage", () => {
  it("renders received payments with traceability, breakdown, and actions", () => {
    render(<PatientBillingPage />);

    expect(screen.getByText("# Pago")).toBeInTheDocument();
    expect(screen.getByText("# Trat.")).toBeInTheDocument();
    expect(screen.getByText("Medio de pago")).toBeInTheDocument();
    expect(screen.getByText("Recibido por Regina Mora, en sucursal Dental + Suc. Leon")).toBeInTheDocument();
    expect(screen.getByText("PLAN-1")).toBeInTheDocument();
    expect(screen.getByText("TICKET-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver desglose" }));
    expect(screen.getByText("Desglose de pago #206329")).toBeInTheDocument();
    expect(screen.getByText("Limpieza dental")).toBeInTheDocument();
    expect(screen.getByText("Saldo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Acciones/ }));
    expect(screen.getByText("Imprimir comprobante")).toBeInTheDocument();
    expect(screen.getByText("Modificar datos")).toBeInTheDocument();
    expect(screen.getByText("Anular pago")).toBeInTheDocument();
  });
});
