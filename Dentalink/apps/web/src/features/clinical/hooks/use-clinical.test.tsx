import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useClinicalMutations } from "./use-clinical";
import { createEvolution } from "../services/clinical.service";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn()
  }
}));

vi.mock("../services/clinical.service", () => ({
  getClinicalSummary: vi.fn(),
  listAppointmentHistory: vi.fn(),
  upsertMedicalHistory: vi.fn(),
  createAllergy: vi.fn(),
  createMedication: vi.fn(),
  createCondition: vi.fn(),
  listEvolutions: vi.fn(),
  createEvolution: vi.fn(),
  signEvolution: vi.fn(),
  createEvolutionAddendum: vi.fn(),
  listPrescriptions: vi.fn(),
  createPrescription: vi.fn(),
  printPrescription: vi.fn(),
  updatePrescriptionStatus: vi.fn(),
  listDocuments: vi.fn(),
  listDocumentTemplates: vi.fn(),
  createDocument: vi.fn(),
  createDocumentFromTemplate: vi.fn(),
  createDocumentTemplate: vi.fn(),
  getOdontogram: vi.fn(),
  getToothHistory: vi.fn(),
  createToothCondition: vi.fn(),
  cancelOdontogramRecord: vi.fn(),
  createToothProcedure: vi.fn(),
  updateToothProcedureStatus: vi.fn(),
  listPeriodontalCharts: vi.fn(),
  createPeriodontalChart: vi.fn(),
  comparePeriodontalCharts: vi.fn(),
  deleteClinicalDocument: vi.fn(),
  annulEvolution: vi.fn(),
  updateEvolution: vi.fn()
}));

describe("useClinicalMutations", () => {
  it("adds a created evolution to the cached evolution list immediately", async () => {
    const createdEvolution = {
      id: "evolution-1",
      patientId: "patient-1",
      professionalId: "professional-1",
      notes: "Control clinico",
      isPrivate: false,
      professional: { firstName: "Andrea", lastName: "Silva" },
      fields: [],
      materials: [],
      addenda: []
    };
    vi.mocked(createEvolution).mockResolvedValue(createdEvolution as never);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    queryClient.setQueryData(["clinical", "patient-1", "evolutions"], []);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useClinicalMutations("patient-1"), { wrapper });

    await result.current.createEvolution.mutateAsync({ professionalId: "professional-1", notes: "Control clinico" });

    await waitFor(() => {
      expect(queryClient.getQueryData(["clinical", "patient-1", "evolutions"])).toEqual([createdEvolution]);
    });
  });
});
