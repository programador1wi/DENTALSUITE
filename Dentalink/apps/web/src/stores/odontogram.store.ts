import { create } from "zustand";

export type OdontogramDentition = "permanent" | "temporal";
export type OdontogramTool = "diagnosis" | "procedure" | "info" | "cancel";
type OdontogramModal = Extract<OdontogramTool, "diagnosis" | "procedure" | "info">;

type OdontogramState = {
  selectedTooth: string;
  selectedSurface: string;
  dentition: OdontogramDentition;
  activeTool: OdontogramTool;
  activeModal: OdontogramModal | null;
  showOnlyDiagnosis: boolean;
  selectTooth: (toothNumber: string) => void;
  setSelectedSurface: (surface: string) => void;
  setDentition: (dentition: OdontogramDentition) => void;
  setActiveTool: (tool: OdontogramTool) => void;
  openModal: (tool: OdontogramModal) => void;
  closeModal: () => void;
  toggleShowOnlyDiagnosis: () => void;
  resetSelection: () => void;
  resetWorkspace: () => void;
};

export const useOdontogramStore = create<OdontogramState>()((set, get) => ({
  selectedTooth: "",
  selectedSurface: "",
  dentition: "permanent",
  activeTool: "diagnosis",
  activeModal: null,
  showOnlyDiagnosis: false,
  selectTooth: (toothNumber) =>
    set((state) => ({
      selectedTooth: toothNumber,
      selectedSurface: state.selectedTooth === toothNumber ? state.selectedSurface : ""
    })),
  setSelectedSurface: (surface) => set({ selectedSurface: surface }),
  setDentition: (dentition) =>
    set((state) => ({
      dentition,
      selectedTooth: dentition === state.dentition ? state.selectedTooth : "",
      selectedSurface: dentition === state.dentition ? state.selectedSurface : ""
    })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  openModal: (tool) => set({ activeTool: tool, activeModal: tool }),
  closeModal: () => set({ activeModal: null }),
  toggleShowOnlyDiagnosis: () => set({ showOnlyDiagnosis: !get().showOnlyDiagnosis }),
  resetSelection: () => set({ selectedTooth: "", selectedSurface: "", activeModal: null }),
  resetWorkspace: () =>
    set({
      selectedTooth: "",
      selectedSurface: "",
      dentition: "permanent",
      activeTool: "diagnosis",
      activeModal: null,
      showOnlyDiagnosis: false
    })
}));
