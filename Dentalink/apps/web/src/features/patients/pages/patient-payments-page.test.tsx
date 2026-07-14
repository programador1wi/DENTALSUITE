import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientPaymentsPage } from "./patient-payments-page";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "patient-1" }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}));

vi.mock("../components/patient-header", () => ({
  PatientHeader: () => <div>Patient header</div>
}));

vi.mock("../components/patient-subnav", () => ({
  PatientSubnav: () => <div>Patient subnav</div>
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

vi.mock("../hooks/use-patients", () => ({
  usePatient: () => ({
    data: {
      id: "patient-1",
      branchId: "branch-1",
      firstName: "Ana",
      lastName: "Paz",
      branch: { id: "branch-1", name: "Dental + Suc. Leon" }
    },
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

vi.mock("@/features/payments/hooks/use-payments", () => ({
  useCurrentCashRegister: () => ({
    data: {
      id: "register-1",
      openedAt: "2026-07-13T12:00:00.000Z",
      branch: { id: "branch-1", name: "Dental + Suc. Leon" },
      openedBy: { firstName: "Caja", lastName: "Uno" }
    },
    isLoading: false
  }),
  usePatientPayments: () => ({
    data: {
      payments: [],
      links: [],
      installments: [],
      balance: {
        plannedAmount: 1233,
        allocatedPaidAmount: 0,
        totalPaidAmount: 0,
        outstandingAmount: 1233,
        unallocatedCredit: 0,
        overdueInstallments: 0
      },
      payablePlans: [
        {
          id: "plan-1",
          name: "Diagnostico",
          status: "ACCEPTED",
          branch: { id: "branch-1", name: "Dental + Suc. Leon" },
          professional: { id: "professional-1", firstName: "Hilario", lastName: "Cruz" },
          createdAt: "2026-06-09T12:00:00.000Z",
          totalBudget: 1233,
          paidAmount: 0,
          realizedAmount: 0,
          outstandingAmount: 1233,
          items: [
            {
              id: "item-1",
              version: 1,
              treatmentPlanId: "plan-1",
              treatmentPlanName: "Diagnostico",
              treatmentPlanStatus: "ACCEPTED",
              procedure: { id: "procedure-1", code: "DIA", name: "Diagnostico" },
              section: null,
              toothNumber: null,
              surface: null,
              quantity: 1,
              unitPrice: 1233,
              discount: 0,
              total: 1233,
              paidAmount: 0,
              outstandingAmount: 1233,
              status: "PLANNED",
              plannedAt: null,
              completedAt: null
            }
          ]
        }
      ],
      payableItems: []
    },
    isLoading: false,
    isError: false,
    error: null
  }),
  usePaymentsMutations: () => ({
    createPayment: { mutateAsync: vi.fn(), isPending: false },
    payInstallment: { mutateAsync: vi.fn(), isPending: false },
    openCashRegister: { mutate: vi.fn(), isPending: false }
  })
}));

describe("PatientPaymentsPage", () => {
  it("requires selecting a treatment before opening the item selection step", () => {
    render(<PatientPaymentsPage />);

    expect(screen.getByRole("heading", { name: "Cobro de tratamiento" })).toBeInTheDocument();
    expect(screen.getByText("Planes de tratamiento")).toBeInTheDocument();
    expect(screen.queryByText("Selecciona prestaciones a pagar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar tratamiento(s)" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Seleccionar Diagnostico" }));

    expect(screen.getByRole("button", { name: "Pagar tratamiento(s)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Pagar tratamiento(s)" }));

    expect(screen.getByText("Selecciona prestaciones a pagar")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar Diagnostico" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });
});
