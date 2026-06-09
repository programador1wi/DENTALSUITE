import { create } from "zustand";

export type OdontogramDentition = "permanent" | "temporal";
export type OdontogramTool = "diagnosis" | "procedure" | "info" | "cancel" | "preexistence" | "lesion";
export type OdontogramModal = Extract<OdontogramTool, "diagnosis" | "procedure" | "info" | "preexistence" | "lesion"> | "multi-help";
export type OdontogramContextMenu = { toothNumber: string; x: number; y: number } | null;

type OdontogramState = {
  selectedTooth: string;
  selectedTeeth: string[];
  hoveredTooth: string;
  selectedSurface: string;
  dentition: OdontogramDentition;
  activeTool: OdontogramTool;
  activeModal: OdontogramModal | null;
  contextMenu: OdontogramContextMenu;
  multiSelectMode: boolean;
  showOnlyDiagnosis: boolean;
  selectTooth: (toothNumber: string, options?: { additive?: boolean }) => void;
  setHoveredTooth: (toothNumber: string) => void;
  openContextMenu: (menu: NonNullable<OdontogramContextMenu>) => void;
  closeContextMenu: () => void;
  enableMultiSelectMode: () => void;
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
  selectedTeeth: [],
  hoveredTooth: "",
  selectedSurface: "",
  dentition: "permanent",
  activeTool: "diagnosis",
  activeModal: null,
  contextMenu: null,
  multiSelectMode: false,
  showOnlyDiagnosis: false,
  selectTooth: (toothNumber, options) =>
    set((state) => {
      if (options?.additive) {
        const nextTeeth = state.selectedTeeth.includes(toothNumber)
          ? state.selectedTeeth.filter((item) => item !== toothNumber)
          : [...state.selectedTeeth, toothNumber];
        const selectedTooth = nextTeeth.includes(toothNumber) ? toothNumber : nextTeeth[0] ?? "";

        return {
          selectedTooth,
          selectedTeeth: nextTeeth,
          selectedSurface: state.selectedTooth === selectedTooth ? state.selectedSurface : ""
        };
      }

      return {
        selectedTooth: toothNumber,
        selectedTeeth: toothNumber ? [toothNumber] : [],
        selectedSurface: state.selectedTooth === toothNumber ? state.selectedSurface : ""
      };
    }),
  setHoveredTooth: (toothNumber) => set({ hoveredTooth: toothNumber }),
  openContextMenu: (menu) =>
    set((state) => ({
      contextMenu: menu,
      selectedTooth: menu.toothNumber,
      selectedTeeth: state.selectedTeeth.includes(menu.toothNumber) ? state.selectedTeeth : [menu.toothNumber],
      selectedSurface: state.selectedTooth === menu.toothNumber ? state.selectedSurface : ""
    })),
  closeContextMenu: () => set({ contextMenu: null }),
  enableMultiSelectMode: () => set({ multiSelectMode: true, activeModal: "multi-help", contextMenu: null }),
  setSelectedSurface: (surface) => set({ selectedSurface: surface }),
  setDentition: (dentition) =>
    set((state) => ({
      dentition,
      selectedTooth: dentition === state.dentition ? state.selectedTooth : "",
      selectedTeeth: dentition === state.dentition ? state.selectedTeeth : [],
      hoveredTooth: "",
      selectedSurface: dentition === state.dentition ? state.selectedSurface : ""
    })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  openModal: (tool) => set({ activeTool: tool === "multi-help" ? get().activeTool : tool, activeModal: tool, contextMenu: null }),
  closeModal: () => set({ activeModal: null }),
  toggleShowOnlyDiagnosis: () => set({ showOnlyDiagnosis: !get().showOnlyDiagnosis }),
  resetSelection: () => set({ selectedTooth: "", selectedTeeth: [], hoveredTooth: "", selectedSurface: "", activeModal: null, contextMenu: null }),
  resetWorkspace: () =>
    set({
      selectedTooth: "",
      selectedTeeth: [],
      hoveredTooth: "",
      selectedSurface: "",
      dentition: "permanent",
      activeTool: "diagnosis",
      activeModal: null,
      contextMenu: null,
      multiSelectMode: false,
      showOnlyDiagnosis: false
    })
}));
