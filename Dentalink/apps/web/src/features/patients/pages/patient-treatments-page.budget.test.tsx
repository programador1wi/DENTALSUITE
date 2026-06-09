import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientTreatmentsPage } from "./patient-treatments-page";
import type { PriceList } from "@/features/settings/price-lists/services/price-lists.service";
import type { TreatmentPlanDetail, TreatmentPlanItem } from "@/features/treatments/services/treatments.service";

const mockState = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  addItemMutateAsync: vi.fn(),
  createBudgetMutateAsync: vi.fn(),
  updateItemMutateAsync: vi.fn(),
  navigate: vi.fn(),
  updatePatientMutateAsync: vi.fn(),
  patientAgreement: null as {
    id: string;
    name: string;
    discountPercent: string;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
  } | null,
  currentPlan: null as TreatmentPlanDetail | null,
  currentPriceList: null as PriceList | null,
  priceListLoading: false
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockState.toastError,
    success: mockState.toastSuccess
  }
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mockState.navigate,
  useParams: () => ({ id: "patient-1" })
}));

vi.mock("../components/patient-section-page", () => ({
  PatientSectionPage: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock("@/features/clinical/components/odontogram-view", () => ({
  OdontogramView: () => <div data-testid="odontogram" />
}));

vi.mock("@/features/clinical/components/tooth-action-modals", () => ({
  MultipleToothSelectionModal: () => null,
  ToothInformationModal: () => null
}));

vi.mock("@/features/clinical/components/tooth-diagnosis-modal", () => ({
  ToothDiagnosisModal: () => null,
  ToothDiagnosisPickerWindow: () => null
}));

vi.mock("@/features/clinical/hooks/use-clinical", () => ({
  useClinicalAppointmentHistory: () => ({ data: [], isLoading: false, isError: false }),
  useClinicalMutations: () => ({}),
  useOdontogram: () => ({
    data: { latestByTooth: {}, conditions: [], records: [], procedures: [] },
    isLoading: false,
    isError: false
  }),
  useToothHistory: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/payments/hooks/use-payments", () => ({
  usePatientPayments: () => ({ data: { balance: { allocatedPaidAmount: 0 } }, isLoading: false, isError: false }),
  usePaymentsMutations: () => ({ removeAllocation: { mutateAsync: vi.fn(), isPending: false } }),
  useRefunds: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/admin-workflows/hooks/use-admin-workflows", () => ({
  useAgreements: () => ({
    data: [
      {
        id: "agreement-1",
        name: "Seguro Dental",
        discountPercent: "0",
        priceList: { id: "price-list-1", name: "REDES SOCIALES 2026", isDefault: false },
        _count: { patients: 1 }
      }
    ],
    isLoading: false,
    isError: false
  })
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/price-lists/hooks/use-price-lists", () => ({
  usePriceList: () => ({ data: mockState.currentPriceList, isLoading: mockState.priceListLoading, isError: false })
}));

vi.mock("@/features/settings/procedures/hooks/use-procedures", () => ({
  useProcedures: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/professionals/hooks/use-professionals", () => ({
  useProfessionals: () => ({ data: [professionalFixture()], isLoading: false, isError: false })
}));

vi.mock("@/stores/branch.store", () => ({
  useBranchStore: (selector: (state: { activeBranchId: string }) => unknown) => selector({ activeBranchId: "branch-1" })
}));

vi.mock("@/stores/odontogram.store", () => {
  const state = {
    selectedTooth: "",
    selectedTeeth: [],
    selectedSurface: "",
    activeModal: null,
    selectTooth: vi.fn(),
    setSelectedSurface: vi.fn(),
    setActiveTool: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    resetWorkspace: vi.fn()
  };
  return {
    useOdontogramStore: (selector: (value: typeof state) => unknown) => selector(state)
  };
});

vi.mock("../hooks/use-patients", () => ({
  useAddPatientNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePatient: () => ({
    data: {
      id: "patient-1",
      branchId: "branch-1",
      agreement: mockState.patientAgreement,
      notes: []
    },
    isLoading: false,
    isError: false
  }),
  useUpdatePatient: () => ({ mutateAsync: mockState.updatePatientMutateAsync, isPending: false })
}));

vi.mock("@/features/treatments/hooks/use-treatments", () => ({
  useBudgets: () => ({ data: mockState.currentPlan?.budgets ?? [], isLoading: false, isError: false }),
  useTreatmentPlan: () => ({ data: mockState.currentPlan, isLoading: false, isError: false }),
  useTreatmentPlans: () => ({ data: mockState.currentPlan ? [mockState.currentPlan] : [], isLoading: false, isError: false }),
  useTreatmentMutations: () => ({
    acceptBudget: { mutate: vi.fn(), isPending: false },
    addItem: { mutateAsync: mockState.addItemMutateAsync, isPending: false },
    addSection: { mutateAsync: vi.fn(), isPending: false },
    changeBranch: { mutateAsync: vi.fn(), isPending: false },
    createBudget: { mutateAsync: mockState.createBudgetMutateAsync, isPending: false },
    createTreatmentPlan: { mutateAsync: vi.fn(), isPending: false },
    deleteItem: { mutate: vi.fn(), isPending: false },
    printBudget: { mutateAsync: vi.fn(), isPending: false },
    sendBudget: { mutate: vi.fn(), isPending: false },
    updateItem: { mutateAsync: mockState.updateItemMutateAsync, isPending: false },
    updateItemStatus: { mutate: vi.fn(), isPending: false }
  })
}));

describe("PatientTreatmentsPage budget agreement flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.patientAgreement = null;
    mockState.currentPlan = planFixture();
    mockState.currentPriceList = null;
    mockState.priceListLoading = false;
    mockState.addItemMutateAsync.mockResolvedValue(planFixture());
    mockState.createBudgetMutateAsync.mockResolvedValue({});
    mockState.updateItemMutateAsync.mockResolvedValue(planFixture());
    mockState.updatePatientMutateAsync.mockResolvedValue({});
  });

  it("blocks budget creation when the patient has no agreement price list", () => {
    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));

    expect(mockState.toastError).toHaveBeenCalledWith("Asigna un convenio con arancel antes de crear presupuesto.");
    expect(screen.getAllByText("Asignar convenio").length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog", { name: "Definir procedimiento" })).not.toBeInTheDocument();
  });

  it("opens agreement detail instead of assignment when the plan already has items", () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPlan = planFixture({ items: [itemFixture()] });
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByText("Seguro Dental"));

    expect(screen.getByText("Detalle del convenio")).toBeInTheDocument();
    expect(screen.getByText("REDES SOCIALES 2026")).toBeInTheDocument();
    expect(screen.queryByText("Asignar convenio")).not.toBeInTheDocument();
  });

  it("loads products from the agreement price list and adds them with the agreement price", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalled());
    expect(mockState.addItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        quantity: 1,
        unitPrice: 399,
        discount: 0
      })
    });
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Prestacion agregada al plan.");
  });

  it("assigns a tooth and multiple surfaces from the procedure row", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPlan = planFixture({ items: [itemFixture()] });
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByLabelText("Asignar pieza dental"));
    fireEvent.change(screen.getByDisplayValue("Seleccione una opcion"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: /Palatina/i }));
    fireEvent.click(screen.getByRole("button", { name: /Mesial/i }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar piezas/i }));

    await waitFor(() => expect(mockState.updateItemMutateAsync).toHaveBeenCalled());
    expect(mockState.updateItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      itemId: "item-1",
      payload: {
        toothNumber: "14",
        surface: "P,M",
        syncOdontogram: true
      }
    });
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Pieza asignada a la prestacion.");
  });

  it("navigates to patient payments with the selected item when paying a procedure", () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPlan = planFixture({ items: [itemFixture()] });
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByText(/\[45E1\]/i));
    fireEvent.click(screen.getByRole("button", { name: /Abonar/i }));

    expect(mockState.navigate).toHaveBeenCalledWith("/patients/patient-1/payments?treatmentPlanId=plan-1&itemId=item-1&amount=399");
  });

  it("marks a procedure for future realization with plannedAt", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPlan = planFixture({ items: [itemFixture({ status: "ACCEPTED", plannedAt: null })] });
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Marcar futura realizacion/i }));

    await waitFor(() => expect(mockState.updateItemMutateAsync).toHaveBeenCalled());
    expect(mockState.updateItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      itemId: "item-1",
      payload: { plannedAt: expect.any(String) }
    });
  });

  it("unmarks a future procedure by clearing plannedAt", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPlan = planFixture({ items: [itemFixture({ status: "ACCEPTED", plannedAt: "2026-06-09T10:00:00.000Z" })] });
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Desmarcar futura realizacion/i }));

    await waitFor(() => expect(mockState.updateItemMutateAsync).toHaveBeenCalled());
    expect(mockState.updateItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      itemId: "item-1",
      payload: { plannedAt: null }
    });
  });
});

function agreementFixture() {
  return {
    id: "agreement-1",
    name: "Seguro Dental",
    discountPercent: "0",
    priceList: { id: "price-list-1", name: "REDES SOCIALES 2026", isDefault: false }
  };
}

function professionalFixture() {
  return { id: "professional-1", firstName: "Andrea", lastName: "Silva" };
}

function planFixture(overrides: Partial<TreatmentPlanDetail> = {}): TreatmentPlanDetail {
  return {
    id: "plan-1",
    name: "Plan de tratamiento 1",
    description: null,
    status: "DRAFT",
    isAlternative: false,
    patient: { id: "patient-1", firstName: "Demo", lastName: "Paciente" },
    professional: professionalFixture(),
    branch: { id: "branch-1", name: "Dental + Real Del Bosque" },
    sections: [],
    items: [],
    budgets: [],
    ...overrides
  };
}

function itemFixture(overrides: Partial<TreatmentPlanItem> = {}): TreatmentPlanItem {
  return {
    id: "item-1",
    treatmentPlanId: "plan-1",
    procedureId: "procedure-1",
    procedure: { id: "procedure-1", code: "45E1", name: "Limpieza dental" },
    section: null,
    toothNumber: null,
    surface: null,
    quantity: "1",
    unitPrice: "399",
    discount: "0",
    total: "399",
    status: "PLANNED",
    plannedAt: null,
    paymentAllocations: [],
    ...overrides
  };
}

function priceListFixture(): PriceList {
  return {
    id: "price-list-1",
    name: "REDES SOCIALES 2026",
    isDefault: false,
    isActive: true,
    branchAssignments: [],
    categories: [
      {
        id: "category-1",
        priceListId: "price-list-1",
        name: "Operatoria",
        sortOrder: 1,
        isActive: true,
        items: [
          {
            id: "price-item-1",
            procedureId: "procedure-1",
            priceListCategoryId: "category-1",
            price: "399",
            labCost: "0",
            allowsDiscount: true,
            currency: "MXN",
            procedure: {
              id: "procedure-1",
              categoryId: "procedure-category-1",
              displayId: 1,
              code: "45E1",
              name: "Limpieza dental",
              defaultDuration: 30,
              requiresTooth: false,
              requiresSurface: false,
              requiresLab: false,
              isActive: true
            }
          }
        ]
      }
    ],
    items: []
  };
}
