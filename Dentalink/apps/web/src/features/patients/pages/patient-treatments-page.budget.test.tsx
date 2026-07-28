import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientTreatmentsPage } from "./patient-treatments-page";
import type {
  OrthodonticTreatmentProfile,
  TreatmentPriceCatalog,
  TreatmentPlanDetail,
  TreatmentPlanItem
} from "@/features/treatments/services/treatments.service";

const mockState = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  addItemMutateAsync: vi.fn(),
  addSectionMutateAsync: vi.fn(),
  createBudgetMutateAsync: vi.fn(),
  previewRepriceMutateAsync: vi.fn(),
  applyRepriceMutateAsync: vi.fn(),
  saveOrthodonticDiagnosisDraftMutateAsync: vi.fn(),
  updateItemMutateAsync: vi.fn(),
  updateOrthodonticProfileMutateAsync: vi.fn(),
  navigate: vi.fn(),
  updatePatientMutateAsync: vi.fn(),
  patientAgreement: null as {
    id: string;
    name: string;
    discountPercent: string;
    priceListId?: string | null;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
  } | null,
  agreements: [] as Array<{
    id: string;
    name: string;
    discountPercent: string;
    priceListId?: string | null;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
    _count: { patients: number };
  }>,
  currentPlan: null as TreatmentPlanDetail | null,
  currentPriceList: null as TreatmentPriceCatalog | null,
  priceListsById: {} as Record<string, TreatmentPriceCatalog | null>,
  lastPriceListId: "",
  priceListLoading: false,
  selectedTooth: "",
  selectedTeeth: [] as string[],
  selectedSurface: ""
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
  useParams: () => ({ id: "patient-1" }),
  useSearchParams: () => [new URLSearchParams("planId=plan-1"), vi.fn()]
}));

vi.mock("../components/patient-section-page", () => ({
  PatientSectionPage: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock("@/features/clinical/components/odontogram-view", () => ({
  OdontogramView: ({ onSelectTooth }: { onSelectTooth: (tooth: string) => void }) => (
    <button type="button" data-testid="odontogram" onClick={() => onSelectTooth("15")}>
      Seleccionar pieza 1.5
    </button>
  )
}));

vi.mock("@/features/clinical/components/tooth-action-modals", () => ({
  MultipleToothSelectionModal: () => null,
  ToothInformationModal: () => null
}));

vi.mock("@/features/clinical/components/tooth-diagnosis-modal", () => ({
  ToothDiagnosisModal: () => null,
  ToothDiagnosisPickerWindow: () => null
}));

vi.mock("../../clinical/components/clinical-evolution-modal", () => ({
  ClinicalEvolutionModal: () => null
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

vi.mock("@/features/documents/hooks/use-documents", () => ({
  useDocumentsMutations: () => ({ uploadPatientBinaryFile: { mutateAsync: vi.fn(), isPending: false } }),
  usePatientFiles: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

vi.mock("@/features/payments/hooks/use-payments", () => ({
  usePatientPayments: () => ({
    data: { balance: { allocatedPaidAmount: 0 }, payablePlans: [] },
    isLoading: false,
    isError: false
  }),
  usePaymentsMutations: () => ({
    createInstallmentPlan: { mutateAsync: vi.fn(), isPending: false },
    removeAllocation: { mutateAsync: vi.fn(), isPending: false }
  }),
  useRefunds: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/admin-workflows/hooks/use-admin-workflows", () => ({
  useAgreements: () => ({
    data: mockState.agreements,
    isLoading: false,
    isError: false
  }),
  useCreatePayrollDiscountPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/price-lists/hooks/use-price-lists", () => ({
  usePriceList: (id: string) => {
    mockState.lastPriceListId = id;
    return {
      data: id ? (mockState.priceListsById[id] ?? mockState.currentPriceList) : null,
      isLoading: mockState.priceListLoading,
      isError: false
    };
  }
}));

vi.mock("@/features/settings/procedures/hooks/use-procedures", () => ({
  useProcedures: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/professionals/hooks/use-professionals", () => ({
  useProfessionals: () => ({ data: [professionalFixture()], isLoading: false, isError: false })
}));

vi.mock("@/stores/branch.store", () => ({
  useBranchStore: (selector: (state: { activeBranchId: string }) => unknown) =>
    selector({ activeBranchId: "branch-1" })
}));

vi.mock("@/stores/odontogram.store", () => {
  const state = {
    activeModal: null,
    selectTooth: vi.fn((toothNumber: string) => {
      mockState.selectedTooth = toothNumber;
      mockState.selectedTeeth = toothNumber ? [toothNumber] : [];
      mockState.selectedSurface = "";
    }),
    setSelectedSurface: vi.fn((surface: string) => {
      mockState.selectedSurface = surface;
    }),
    setActiveTool: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    resetWorkspace: vi.fn()
  };
  const getState = () => ({
    ...state,
    selectedTooth: mockState.selectedTooth,
    selectedTeeth: mockState.selectedTeeth,
    selectedSurface: mockState.selectedSurface
  });
  const useOdontogramStore = (
    selector: (
      value: typeof state & {
        selectedTooth: string;
        selectedTeeth: string[];
        selectedSurface: string;
      }
    ) => unknown
  ) => selector(getState());
  useOdontogramStore.getState = getState;
  return { useOdontogramStore };
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
  useTreatmentPlanPrintOptions: () => ({ data: [], isLoading: false, isError: false }),
  useTreatmentPlanProcedures: () => ({ data: null, isLoading: false, isError: false }),
  useTreatmentPlanPriceCatalog: () => ({
    data: mockState.currentPriceList,
    isLoading: mockState.priceListLoading,
    isError: false
  }),
  useTreatmentPlans: () => ({
    data: mockState.currentPlan ? [mockState.currentPlan] : [],
    isLoading: false,
    isError: false
  }),
  useOrthodonticSummary: () => ({
    data: null,
    isLoading: false,
    isError: false
  }),
  useOrthodonticOptionFields: () => ({
    data: [],
    isLoading: false,
    isError: false
  }),
  useOrthodonticDiagnosisStatus: () => ({
    data: {
      treatmentPlanId: "plan-1",
      status: "EMPTY",
      diagnosis: null,
      summaryItems: [],
      sectionsWithData: []
    },
    isLoading: false,
    isError: false
  }),
  useOrthodonticDiagnosis: () => ({
    data: {
      treatmentPlanId: "plan-1",
      status: "EMPTY",
      diagnosis: null,
      summaryItems: [],
      sectionsWithData: [],
      catalog: []
    },
    isLoading: false,
    isError: false
  }),
  useOrthodonticDiagnosisCatalog: () => ({
    data: [],
    isLoading: false,
    isError: false
  }),
  useTreatmentMutations: () => ({
    acceptBudget: { mutate: vi.fn(), isPending: false },
    addItem: { mutateAsync: mockState.addItemMutateAsync, isPending: false },
    addSection: { mutateAsync: mockState.addSectionMutateAsync, isPending: false },
    applyBulkDiscount: { mutateAsync: vi.fn(), isPending: false },
    applyReprice: { mutateAsync: mockState.applyRepriceMutateAsync, isPending: false },
    changeBranch: { mutateAsync: vi.fn(), isPending: false },
    createBudget: { mutateAsync: mockState.createBudgetMutateAsync, isPending: false },
    createOrthodonticDiagnosisFieldOption: { mutateAsync: vi.fn(), isPending: false },
    createOrthodonticFieldOption: { mutateAsync: vi.fn(), isPending: false },
    createOrthodonticMonthlyItems: { mutateAsync: vi.fn(), isPending: false },
    createTreatmentPlan: { mutateAsync: vi.fn(), isPending: false },
    deleteItem: { mutate: vi.fn(), isPending: false },
    duplicateTreatmentPlan: { mutateAsync: vi.fn(), isPending: false },
    generateTreatmentPlanDocument: { mutateAsync: vi.fn(), isPending: false },
    pauseTreatment: { mutateAsync: vi.fn(), isPending: false },
    previewTreatmentPlanDocument: { mutateAsync: vi.fn(), isPending: false },
    previewReprice: { mutateAsync: mockState.previewRepriceMutateAsync, isPending: false },
    printBudget: { mutateAsync: vi.fn(), isPending: false },
    saveOrthodonticDiagnosisActive: { mutateAsync: vi.fn(), isPending: false },
    saveOrthodonticDiagnosisDraft: {
      mutateAsync: mockState.saveOrthodonticDiagnosisDraftMutateAsync,
      isPending: false
    },
    resumeTreatment: { mutateAsync: vi.fn(), isPending: false },
    sendBudget: { mutate: vi.fn(), isPending: false },
    startOrthodonticTreatment: { mutateAsync: vi.fn(), isPending: false },
    deactivateOrthodonticDiagnosisFieldOption: { mutateAsync: vi.fn(), isPending: false },
    deactivateOrthodonticFieldOption: { mutateAsync: vi.fn(), isPending: false },
    reactivateOrthodonticDiagnosisFieldOption: { mutateAsync: vi.fn(), isPending: false },
    reactivateOrthodonticFieldOption: { mutateAsync: vi.fn(), isPending: false },
    sortOrthodonticDiagnosisFieldOptions: { mutateAsync: vi.fn(), isPending: false },
    sortOrthodonticFieldOptions: { mutateAsync: vi.fn(), isPending: false },
    updateOrthodonticDiagnosisFieldOption: { mutateAsync: vi.fn(), isPending: false },
    updateOrthodonticFieldOption: { mutateAsync: vi.fn(), isPending: false },
    updateOrthodonticDiagnosis: { mutateAsync: vi.fn(), isPending: false },
    updateOrthodonticProfile: {
      mutateAsync: mockState.updateOrthodonticProfileMutateAsync,
      isPending: false
    },
    updateItem: { mutateAsync: mockState.updateItemMutateAsync, isPending: false },
    updateItemStatus: { mutate: vi.fn(), isPending: false }
  })
}));

describe("PatientTreatmentsPage budget agreement flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.patientAgreement = null;
    mockState.agreements = [agreementFixture()];
    mockState.currentPlan = planFixture();
    mockState.currentPriceList = null;
    mockState.priceListsById = {};
    mockState.lastPriceListId = "";
    mockState.priceListLoading = false;
    mockState.selectedTooth = "";
    mockState.selectedTeeth = [];
    mockState.selectedSurface = "";
    mockState.addItemMutateAsync.mockResolvedValue(planFixture());
    mockState.addSectionMutateAsync.mockImplementation(({ name }: { name: string }) =>
      Promise.resolve(
        planFixture({
          sections: [{ id: "section-1", treatmentPlanId: "plan-1", name, sortOrder: 1 }]
        })
      )
    );
    mockState.createBudgetMutateAsync.mockResolvedValue({});
    mockState.applyRepriceMutateAsync.mockResolvedValue(planFixture());
    mockState.previewRepriceMutateAsync.mockResolvedValue({
      planId: "plan-1",
      status: "DRAFT",
      canApply: true,
      requiresRevision: false,
      items: [
        {
          itemId: "item-1",
          procedureId: "procedure-1",
          current: { unitPrice: "399.00", discount: "0.00", total: "399.00", versionNumber: 2 },
          proposed: {
            basePrice: "450.00",
            finalPrice: "450.00",
            discountAmount: "0.00",
            total: "450.00",
            quantity: "1.00",
            priceList: { id: "price-list-1", name: "REDES SOCIALES 2026" },
            version: { id: "version-3", number: 3, itemId: "price-item-1" }
          },
          difference: "51.00",
          hasFinancialDependencies: false,
          error: null
        }
      ]
    });
    mockState.saveOrthodonticDiagnosisDraftMutateAsync.mockResolvedValue({});
    mockState.updateItemMutateAsync.mockResolvedValue(planFixture());
    mockState.updateOrthodonticProfileMutateAsync.mockResolvedValue(planFixture());
    mockState.updatePatientMutateAsync.mockResolvedValue({});
  });

  it("blocks budget creation when the patient has no agreement price list", () => {
    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));

    expect(mockState.toastError).toHaveBeenCalledWith(
      "Asigna un convenio con arancel antes de crear presupuesto."
    );
    expect(screen.getAllByText("Asignar convenio").length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog", { name: "Definir procedimiento" })).not.toBeInTheDocument();
  });

  it("saves planned controls from an orthodontic treatment profile", async () => {
    mockState.currentPlan = planFixture({
      kind: "ORTHODONTICS",
      specialtySnapshotName: "Ortodoncia",
      orthodonticProfile: orthodonticProfileFixture(),
      orthodonticSummary: {
        calendarProgress: 25,
        realProgress: 11,
        realControlsCount: 2,
        estimatedControls: 18,
        isPaused: false,
        pauseStartDate: null,
        latestEvolution: null
      }
    });

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Plan de tratamiento" }));
    expect(screen.getByRole("dialog", { name: "Plan de tratamiento" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cantidad controles"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => expect(mockState.updateOrthodonticProfileMutateAsync).toHaveBeenCalled());
    expect(mockState.updateOrthodonticProfileMutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      payload: expect.objectContaining({
        estimatedMonths: 24,
        estimatedControls: 20
      })
    });
  });

  it("shows an empty treatment plan state and auto opens the technical modal", async () => {
    mockState.currentPlan = planFixture({
      kind: "ORTHODONTICS",
      specialtySnapshotName: "Ortodoncia",
      orthodonticProfile: emptyOrthodonticProfileFixture({
        startDate: "2026-07-14T00:00:00.000Z",
        estimatedMonths: 24,
        estimatedControls: 24,
        nextControlAt: "2026-08-13T18:00:00.000Z"
      })
    });

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Plan de tratamiento" }));

    expect(screen.getByText("El plan de tratamiento está vacío")).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Plan de tratamiento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Definir Plan de Tratamiento" })).toBeInTheDocument();
  });

  it("auto opens the orthodontic diagnosis modal and saves an empty draft", async () => {
    mockState.currentPlan = planFixture({
      kind: "ORTHODONTICS",
      specialtySnapshotName: "Ortodoncia",
      orthodonticProfile: orthodonticProfileFixture()
    });

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Diagnostico" }));

    expect(await screen.findByRole("heading", { name: "Diagnostico" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() => expect(mockState.saveOrthodonticDiagnosisDraftMutateAsync).toHaveBeenCalled());
    expect(mockState.saveOrthodonticDiagnosisDraftMutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      payload: { values: [] }
    });
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
        toothNumber: undefined,
        surface: undefined,
        syncOdontogram: false
      })
    });
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Prestación agregada al plan.");
  });

  it("uses the current agreement price list instead of a stale patient agreement snapshot", () => {
    mockState.patientAgreement = {
      ...agreementFixture(),
      priceListId: "price-list-old",
      priceList: { id: "price-list-old", name: "ARANCEL VIEJO", isDefault: false }
    };
    mockState.agreements = [
      {
        ...agreementFixture(),
        priceListId: "price-list-current",
        priceList: { id: "price-list-current", name: "TARIFARIO POLIZA", isDefault: false }
      }
    ];
    mockState.currentPriceList = priceListFixture({}, { id: "price-list-current", name: "TARIFARIO POLIZA" });

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));

    expect(screen.getByText(/TARIFARIO POLIZA/i)).toBeInTheDocument();
    expect(screen.queryByText(/ARANCEL VIEJO/i)).not.toBeInTheDocument();
  });

  it("shows mixed historical versions and reprices a draft only after preview and reason", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture();
    mockState.currentPlan = planFixture({
      items: [
        itemFixture({
          priceListVersionId: "version-2",
          priceListVersionNumber: 2,
          priceListVersionItemId: "price-item-2",
          priceSnapshotName: "REDES SOCIALES 2026",
          priceSource: "PRICE_LIST"
        })
      ]
    });

    render(<PatientTreatmentsPage />);

    expect(screen.getByText(/v2 · precio histórico/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Actualizar precios/i }));

    expect(await screen.findByText("Actualizar precios del borrador")).toBeInTheDocument();
    expect(screen.getByText(/v2 → v3/i)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Confirmar actualización/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Actualización autorizada/i), {
      target: { value: "Cambio autorizado por administración" }
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(mockState.applyRepriceMutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      payload: { reason: "Cambio autorizado por administración" }
    }));
  });

  it("links a selected tooth even when the product does not require tooth", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({ requiresTooth: false });
    mockState.selectedTooth = "11";
    mockState.selectedTeeth = ["11"];

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalled());
    expect(mockState.addItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "11",
        surface: "ALL",
        quantity: 1,
        sectionId: "section-1",
        syncOdontogram: true
      })
    });
  });

  it("uses the live tooth selected when the odontogram opens the catalog", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({ requiresTooth: false });

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Seleccionar pieza 1.5/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalled());
    expect(mockState.addItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "15",
        surface: "ALL",
        quantity: 1,
        sectionId: "section-1",
        syncOdontogram: true
      })
    });
  });

  it("creates one treatment item per selected tooth from a tooth-required product", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({ requiresTooth: true });
    mockState.selectedTooth = "13";
    mockState.selectedTeeth = ["11", "13"];

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockState.addItemMutateAsync).toHaveBeenNthCalledWith(1, {
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "11",
        surface: "ALL",
        quantity: 1,
        syncOdontogram: true
      })
    });
    expect(mockState.addItemMutateAsync).toHaveBeenNthCalledWith(2, {
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "13",
        surface: "ALL",
        quantity: 1,
        syncOdontogram: true
      })
    });
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Prestaciones agregadas al plan.");
  });

  it("sends ALL for a surface-required product when a whole tooth is selected", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({ requiresTooth: true, requiresSurface: true });
    mockState.selectedTooth = "11";
    mockState.selectedTeeth = ["11"];

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalled());
    expect(mockState.addItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "11",
        surface: "ALL",
        quantity: 1,
        syncOdontogram: true
      })
    });
  });

  it("blocks a tooth/surface-required product when no tooth is selected", () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({ requiresTooth: true, requiresSurface: true });

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    expect(mockState.toastError).toHaveBeenCalledWith(
      "Selecciona una pieza dental, una cara o una region para continuar."
    );
    expect(mockState.addItemMutateAsync).not.toHaveBeenCalled();
  });

  it("sends ALL as the surface when a tooth-required product does not require a specific surface", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({ requiresTooth: true, requiresSurface: false });
    mockState.selectedTooth = "11";
    mockState.selectedTeeth = ["11"];

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalled());
    expect(mockState.addItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "11",
        surface: "ALL",
        quantity: 1,
        syncOdontogram: true
      })
    });
  });

  it("opens the odontogram symbol modal before loading a symbol-required product", async () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPriceList = priceListFixture({
      name: "Limpieza completa + blanqueamiento",
      requiresOdontogramSymbol: true,
      defaultOdontogramSymbol: "restoration"
    });
    mockState.selectedTooth = "31";
    mockState.selectedTeeth = ["31"];

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Generar presupuesto/i }));
    fireEvent.click(screen.getByText("Operatoria"));
    fireEvent.click(screen.getByRole("button", { name: /Cargar/i }));

    expect(screen.getByText(/requiere especificar/i)).toBeInTheDocument();
    expect(mockState.addItemMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Cargar al tratamiento/i }));

    await waitFor(() => expect(mockState.addItemMutateAsync).toHaveBeenCalled());
    expect(mockState.addItemMutateAsync).toHaveBeenCalledWith({
      treatmentPlanId: "plan-1",
      payload: expect.objectContaining({
        procedureId: "procedure-1",
        toothNumber: "31",
        surface: "ALL",
        odontogramSymbol: "restoration",
        syncOdontogram: true
      })
    });
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
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Pieza asignada a la prestación.");
  });

  it("navigates to patient payments with the selected item when paying a procedure", () => {
    mockState.patientAgreement = agreementFixture();
    mockState.currentPlan = planFixture({ items: [itemFixture()] });
    mockState.currentPriceList = priceListFixture();

    render(<PatientTreatmentsPage />);

    fireEvent.click(screen.getByText(/\[45E1\]/i));
    fireEvent.click(screen.getByRole("button", { name: /Abonar/i }));

    expect(mockState.navigate).toHaveBeenCalledWith(
      "/patients/patient-1/payments?treatmentPlanId=plan-1&itemId=item-1&amount=399"
    );
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
    mockState.currentPlan = planFixture({
      items: [itemFixture({ status: "ACCEPTED", plannedAt: "2026-06-09T10:00:00.000Z" })]
    });
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
    priceListId: "price-list-1",
    priceList: { id: "price-list-1", name: "REDES SOCIALES 2026", isDefault: false },
    _count: { patients: 1 }
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
    kind: "GENERAL",
    specialtySnapshotName: "General",
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

function orthodonticProfileFixture(
  overrides: Partial<OrthodonticTreatmentProfile> = {}
): OrthodonticTreatmentProfile {
  return {
    id: "profile-1",
    treatmentPlanId: "plan-1",
    startDate: "2026-01-01T00:00:00.000Z",
    estimatedMonths: 24,
    estimatedControls: 18,
    lastUpperArch: "0.016 NiTi",
    lastLowerArch: "0.014 NiTi",
    nextControlAt: "2026-07-11T15:00:00.000Z",
    nextRadiographyAt: "2026-09-01T15:00:00.000Z",
    hygieneStatus: "Regular",
    alert: null,
    indications: "Usar elasticos nocturnos.",
    elastics: "Clase II",
    diagnosis: {},
    planNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function emptyOrthodonticProfileFixture(
  overrides: Partial<OrthodonticTreatmentProfile> = {}
): OrthodonticTreatmentProfile {
  return orthodonticProfileFixture({
    technicalDescription: null,
    startDate: null,
    estimatedMonths: null,
    estimatedControls: null,
    totalAligners: null,
    indicatedExtractions: null,
    performedExtractions: null,
    reevaluationDate: null,
    interconsultations: null,
    lastUpperArch: null,
    lastLowerArch: null,
    nextControlAt: null,
    nextRadiographyAt: null,
    hygieneStatus: null,
    alert: null,
    indications: null,
    elastics: null,
    planNotes: null,
    fieldValues: [],
    optionValues: [],
    ...overrides
  });
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

function priceListFixture(
  procedureOverrides: Partial<TreatmentPriceCatalog["categories"][number]["items"][number]["procedure"]> = {},
  priceListOverrides: Partial<TreatmentPriceCatalog> = {}
): TreatmentPriceCatalog {
  const priceListId = priceListOverrides.id ?? "price-list-1";
  return {
    id: priceListId,
    name: priceListOverrides.name ?? "REDES SOCIALES 2026",
    context: {
      branchId: "branch-1",
      agreementId: "agreement-1",
      clinicalDate: "2026-07-17T12:00:00.000Z"
    },
    activeVersion: { id: "version-3", number: 3, currency: "MXN" },
    categories: [
      {
        id: "category-1",
        name: "Operatoria",
        description: null,
        sortOrder: 1,
        isActive: true,
        items: [
          {
            id: "price-item-1",
            procedureId: "procedure-1",
            priceListCategoryId: "category-1",
            price: "399",
            basePrice: "399",
            appliedPrice: "399",
            labCost: "0",
            internalCost: "0",
            allowsDiscount: true,
            currency: "MXN",
            priceList: { id: priceListId, name: priceListOverrides.name ?? "REDES SOCIALES 2026" },
            version: { id: "version-3", number: 3, itemId: "price-item-1" },
            category: { id: "category-1", name: "Operatoria" },
            procedure: {
              id: "procedure-1",
              displayId: 1,
              code: "45E1",
              name: "Limpieza dental",
              requiresTooth: false,
              requiresSurface: false,
              requiresLab: false,
              requiresOdontogramSymbol: false,
              isActive: true,
              ...procedureOverrides
            }
          }
        ]
      }
    ],
    items: [],
    ...priceListOverrides
  };
}
