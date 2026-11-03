import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentMethodsSettingsPage } from "./payment-methods-settings-page";

const mutations = vi.hoisted(() => ({
  create: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  update: vi.fn()
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

vi.mock("../hooks/use-payment-methods", () => ({
  usePaymentMethods: () => ({
    data: [
      {
        id: "cash-1",
        publicCode: "SYS-CASH",
        name: "Efectivo",
        type: "CASH",
        source: "SYSTEM",
        isActive: true,
        retentionPercent: "0",
        allowsRefund: true,
        acceptsMultipleSettlements: false,
        requiresReference: false,
        requiresFinancialInstitution: false,
        fiscalCode: null,
        version: 1,
        disabledAt: null,
        disableReason: null,
        includeInCollectionReports: true,
        includeInPhysicalCashBalance: true,
        includeInCashFlowReports: true,
        includeInClosingSummary: true,
        includeInGraphicalReports: true
      }
    ],
    error: null,
    isError: false,
    isLoading: false
  }),
  usePaymentMethodAudit: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useCreatePaymentMethod: () => ({ isPending: false, mutateAsync: mutations.create }),
  useDeactivatePaymentMethod: () => ({ isPending: false, mutateAsync: mutations.deactivate }),
  useReactivatePaymentMethod: () => ({ isPending: false, mutateAsync: mutations.reactivate }),
  useUpdatePaymentMethod: () => ({ isPending: false, mutateAsync: mutations.update })
}));

vi.mock("../hooks/use-cash-discounts", () => ({
  useCashDiscountConfigurationOptions: () => ({
    data: { branches: [{ id: "branch-1", name: "Sucursal Centro" }], users: [] },
    isLoading: false
  }),
  useCashDiscounts: () => ({
    data: [
      {
        id: "discount-1",
        publicCode: "DC-TEST",
        name: "Liquidación inmediata",
        description: null,
        campaign: "Julio",
        discountPercent: "10",
        appliesToClinicalActions: true,
        appliesToLaboratoryActions: false,
        availableToAllUsers: true,
        availableToAllBranches: true,
        stackableWithAgreements: false,
        stackableWithOtherDiscounts: false,
        startsAt: null,
        endsAt: null,
        status: "ENABLED",
        version: 1,
        updatedAt: "2026-07-21T12:00:00.000Z",
        users: [],
        branches: []
      }
    ],
    error: null,
    isError: false,
    isLoading: false
  }),
  useCashDiscountAudit: () => ({ data: [], isLoading: false }),
  useCashDiscountMutations: () => ({
    create: { isPending: false, mutateAsync: vi.fn() },
    update: { isPending: false, mutateAsync: vi.fn() },
    duplicate: { mutateAsync: vi.fn() },
    disable: { mutateAsync: vi.fn() },
    reactivate: { mutateAsync: vi.fn() }
  })
}));

describe("PaymentMethodsSettingsPage", () => {
  beforeEach(() => {
    mutations.create.mockReset().mockResolvedValue({});
    mutations.deactivate.mockReset().mockResolvedValue({});
    mutations.update.mockReset().mockResolvedValue({});
    mutations.reactivate.mockReset().mockResolvedValue({});
  });

  it("shows the Dentalink-style enabled methods table", () => {
    render(<PaymentMethodsSettingsPage />);

    expect(screen.getByText("Configuración de medios de pago habilitados")).toBeInTheDocument();
    expect(screen.getAllByText("Efectivo").length).toBeGreaterThan(0);
    expect(screen.getByText("Recaudación")).toBeInTheDocument();
    expect(screen.getByText("Efectivo físico")).toBeInTheDocument();
    expect(screen.getByText("Flujo de caja")).toBeInTheDocument();
    expect(screen.getByText("Cierre")).toBeInTheDocument();
    expect(screen.getByText("Gráficos")).toBeInTheDocument();
  });

  it("places cash discounts between payment methods and user discounts and opens the real panel", () => {
    render(<PaymentMethodsSettingsPage />);

    const tabs = screen
      .getAllByRole("button")
      .filter((button) =>
        ["Medios de pago", "Descuentos por caja", "Descuentos por usuario"].includes(button.textContent ?? "")
      );
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Medios de pago",
      "Descuentos por caja",
      "Descuentos por usuario"
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Descuentos por caja" }));
    expect(screen.getByText("Promociones aplicables al liquidar prestaciones")).toBeInTheDocument();
    expect(screen.getByText("Liquidación inmediata")).toBeInTheDocument();
  });

  it("creates a cash method with explicit reporting rules", async () => {
    render(<PaymentMethodsSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Nuevo medio" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Caja principal" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear medio" }));

    await waitFor(() =>
      expect(mutations.create).toHaveBeenCalledWith({
        name: "Caja principal",
        type: "CASH",
        retentionPercent: 0,
        allowsRefund: true,
        acceptsMultipleSettlements: false,
        requiresReference: false,
        requiresFinancialInstitution: false,
        fiscalCode: "",
        includeInCollectionReports: true,
        includeInPhysicalCashBalance: true,
        includeInCashFlowReports: true,
        includeInClosingSummary: true,
        includeInGraphicalReports: true
      })
    );
  });
});
