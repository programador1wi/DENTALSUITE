import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { OdontogramView } from "./odontogram-view";
import { ToothDiagnosisPickerWindow } from "./tooth-diagnosis-modal";
import type { OdontogramRecord, ToothCondition, ToothProcedure } from "../services/clinical.service";

function TestOdontogram({
  mode = "clinical",
  onApplyQuickDiagnosis = vi.fn(),
  onOpenProcedureCatalog = vi.fn(),
  conditions = [],
  records = [],
  procedures = []
}: {
  mode?: "clinical" | "treatment-plan";
  onApplyQuickDiagnosis?: (diagnosis: string) => void;
  onOpenProcedureCatalog?: () => void;
  conditions?: ToothCondition[];
  records?: OdontogramRecord[];
  procedures?: ToothProcedure[];
}) {
  const selectedTooth = useOdontogramStore((state) => state.selectedTooth);
  const selectTooth = useOdontogramStore((state) => state.selectTooth);
  const openModal = useOdontogramStore((state) => state.openModal);

  return (
    <OdontogramView
      mode={mode}
      selectedTooth={selectedTooth}
      latestByTooth={{}}
      conditions={conditions}
      records={records}
      procedures={procedures}
      onSelectTooth={selectTooth}
      onOpenDiagnosis={() => openModal("diagnosis")}
      onOpenPreexistence={() => openModal("preexistence")}
      onOpenLesion={() => openModal("lesion")}
      onOpenTreatment={vi.fn()}
      onOpenProcedureCatalog={onOpenProcedureCatalog}
      onOpenInformation={() => openModal("info")}
      onApplyQuickDiagnosis={onApplyQuickDiagnosis}
    />
  );
}

describe("OdontogramView contextual interactions", () => {
  beforeEach(() => {
    useOdontogramStore.getState().resetWorkspace();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        text: () => Promise.resolve('<svg viewBox="0 0 1177 608"></svg>')
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("highlights a tooth on hover without selecting it", () => {
    render(<TestOdontogram />);

    expect(screen.queryByTestId("tooth-highlight-14")).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByLabelText("Pieza 1.4"));

    expect(screen.getByTestId("tooth-highlight-14")).toBeInTheDocument();
    expect(useOdontogramStore.getState().selectedTooth).toBe("");
  });

  it("opens a contextual menu with disabled procedure outside treatment plans", () => {
    render(<TestOdontogram mode="clinical" />);

    fireEvent.contextMenu(screen.getByLabelText("Pieza 1.4"), { clientX: 120, clientY: 140 });

    expect(screen.getByRole("menu", { name: /Opciones de pieza 1.4/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Agregar prestacion/i })).toBeDisabled();
  });

  it("opens the agreement procedure catalog from treatment-plan context", () => {
    const onOpenProcedureCatalog = vi.fn();
    render(<TestOdontogram mode="treatment-plan" onOpenProcedureCatalog={onOpenProcedureCatalog} />);

    fireEvent.contextMenu(screen.getByLabelText("Pieza 1.4"), { clientX: 120, clientY: 140 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Agregar prestacion/i }));

    expect(onOpenProcedureCatalog).toHaveBeenCalledTimes(1);
  });

  it("saves direct symbolic diagnosis from the contextual menu", () => {
    const onApplyQuickDiagnosis = vi.fn();
    render(<TestOdontogram onApplyQuickDiagnosis={onApplyQuickDiagnosis} />);

    fireEvent.contextMenu(screen.getByLabelText("Pieza 1.4"), { clientX: 120, clientY: 140 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Diente sano/i }));

    expect(onApplyQuickDiagnosis).toHaveBeenCalledWith("Diente sano");
  });

  it("selects multiple teeth with Ctrl click", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Pieza 1.4"), { ctrlKey: true });
    fireEvent.click(screen.getByLabelText("Pieza 1.3"), { ctrlKey: true });

    expect(screen.getByTestId("tooth-highlight-14")).toBeInTheDocument();
    expect(screen.getByTestId("tooth-highlight-13")).toBeInTheDocument();
    expect(useOdontogramStore.getState().selectedTeeth).toEqual(["14", "13"]);
  });

  it("selects a superior distal surface from the surface circle", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Cara distal de pieza 1.8"));

    expect(useOdontogramStore.getState().selectedTooth).toBe("18");
    expect(useOdontogramStore.getState().selectedSurface).toBe("D");
  });

  it("selects multiple surfaces on the same tooth", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Cara distal de pieza 1.8"));
    fireEvent.click(screen.getByLabelText("Cara mesial de pieza 1.8"));

    expect(useOdontogramStore.getState().selectedTooth).toBe("18");
    expect(useOdontogramStore.getState().selectedSurface).toBe("M,D");
    expect(screen.getByTestId("surface-face-18-D")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("surface-face-18-M")).toHaveAttribute("aria-pressed", "true");
  });

  it("marks every face for a procedure stored as full tooth", () => {
    render(
      <TestOdontogram
        procedures={[
          {
            id: "procedure-14",
            toothNumber: "14",
            surface: "ALL",
            status: "PLANNED",
            createdAt: "2026-07-06T12:00:00.000Z",
            procedure: { id: "procedure-1", code: "RES", name: "Resina compuesta" }
          }
        ]}
      />
    );

    for (const surface of ["B", "M", "P", "D", "O"]) {
      const face = screen.getByTestId(`surface-face-14-${surface}`);
      expect(face.getAttribute("class")).toContain("fill-[#ff0000]");
      expect(face.getAttribute("class")).toContain("stroke-black");
      expect(face).toHaveAttribute("stroke-width", "1.9");
    }
  });

  it("marks only the selected face as lesion when a surface diagnosis exists", () => {
    render(
      <TestOdontogram
        records={[
          {
            id: "record-18",
            toothNumber: "18",
            surface: "D",
            condition: "Caries",
            diagnosis: "Caries distal",
            status: "PLANNED",
            createdAt: "2026-07-13T12:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByTestId("surface-face-18-D").getAttribute("class")).toContain("fill-black");
    expect(screen.getByTestId("surface-face-18-M").getAttribute("class")).toContain("fill-white");
    expect(screen.getByTestId("surface-face-18-O").getAttribute("class")).toContain("fill-white");
  });

  it("marks every face as lesion when a tooth diagnosis is stored as full tooth", () => {
    render(
      <TestOdontogram
        records={[
          {
            id: "record-34",
            toothNumber: "34",
            surface: "ALL",
            condition: "Fractura",
            diagnosis: "Fractura",
            status: "PLANNED",
            createdAt: "2026-07-13T12:00:00.000Z"
          }
        ]}
      />
    );

    for (const surface of ["L", "D", "B", "M", "O"]) {
      const face = screen.getByTestId(`surface-face-34-${surface}`);
      expect(face.getAttribute("class")).toContain("fill-black");
      expect(face).toHaveAttribute("stroke-width", "1.9");
    }
  });

  it("uses the explicit odontogram symbol before inferring from procedure text", () => {
    render(
      <TestOdontogram
        procedures={[
          {
            id: "procedure-14",
            toothNumber: "14",
            surface: "ALL",
            odontogramSymbol: "restoration",
            diagnosis: null,
            status: "PLANNED",
            createdAt: "2026-07-06T12:00:00.000Z",
            procedure: { id: "procedure-1", code: "GEN", name: "Consulta general" }
          }
        ]}
      />
    );

    expect(document.querySelector("style")?.textContent).toContain("#r_14");
  });

  it("toggles one selected surface without clearing the others", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Cara distal de pieza 1.8"));
    fireEvent.click(screen.getByLabelText("Cara mesial de pieza 1.8"));
    fireEvent.click(screen.getByLabelText("Cara distal de pieza 1.8"));

    expect(useOdontogramStore.getState().selectedSurface).toBe("M");
    expect(screen.getByTestId("surface-face-18-D")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("surface-face-18-M")).toHaveAttribute("aria-pressed", "true");
  });

  it("starts a new surface selection when switching tooth", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Cara distal de pieza 1.8"));
    fireEvent.click(screen.getByLabelText("Cara mesial de pieza 1.8"));
    fireEvent.click(screen.getByLabelText("Cara lingual de pieza 4.8"));

    expect(useOdontogramStore.getState().selectedTooth).toBe("48");
    expect(useOdontogramStore.getState().selectedSurface).toBe("L");
  });

  it("selects an inferior lingual surface from the surface circle", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Cara lingual de pieza 4.8"));

    expect(useOdontogramStore.getState().selectedTooth).toBe("48");
    expect(useOdontogramStore.getState().selectedSurface).toBe("L");
  });

  it("clears selected surface when clicking the tooth body", () => {
    render(<TestOdontogram />);

    fireEvent.click(screen.getByLabelText("Cara distal de pieza 1.8"));
    fireEvent.click(screen.getByLabelText("Pieza 1.8"));

    expect(useOdontogramStore.getState().selectedTooth).toBe("18");
    expect(useOdontogramStore.getState().selectedSurface).toBe("");
  });

  it("loads temporal odontogram and selects temporal teeth", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<TestOdontogram />);

    fireEvent.click(screen.getByRole("button", { name: /Temporal/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/warner-suite-odontogram-temporal.svg"));
    fireEvent.click(screen.getByLabelText("Pieza 5.5"));
    fireEvent.click(screen.getByLabelText("Pieza 8.5"), { ctrlKey: true });

    expect(useOdontogramStore.getState().selectedTeeth).toEqual(["55", "85"]);
  });

  it("enables multiple selection mode from the contextual menu", () => {
    render(<TestOdontogram />);

    fireEvent.contextMenu(screen.getByLabelText("Pieza 1.4"), { clientX: 120, clientY: 140 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Seleccionar multiples piezas/i }));

    expect(useOdontogramStore.getState().multiSelectMode).toBe(true);
    expect(useOdontogramStore.getState().activeModal).toBe("multi-help");
  });
});

describe("ToothDiagnosisPickerWindow", () => {
  afterEach(() => cleanup());

  it("submits a preexistence for every selected tooth displayed in the window", () => {
    const onAddDiagnosis = vi.fn();
    render(
      <ToothDiagnosisPickerWindow
        open
        title="Agregar una preexistencia"
        tone="preexistence"
        sectionTitles={["Preexistencias"]}
        toothNumbers={["14", "13"]}
        onClose={vi.fn()}
        onAddDiagnosis={onAddDiagnosis}
      />
    );

    expect(screen.getByText("1.4, 1.3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Corona$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar al odontograma/i }));

    expect(onAddDiagnosis).toHaveBeenCalledWith("Corona", undefined);
  });

  it("shows the selected surface in the diagnosis picker", () => {
    render(
      <ToothDiagnosisPickerWindow
        open
        title="Agregar una lesion"
        tone="lesion"
        sectionTitles={["Lesiones"]}
        toothNumbers={["18"]}
        surface="D"
        onClose={vi.fn()}
        onAddDiagnosis={vi.fn()}
      />
    );

    expect(screen.getByText("1.8 - Cara distal")).toBeInTheDocument();
  });

  it("shows multiple selected surfaces in the diagnosis picker", () => {
    render(
      <ToothDiagnosisPickerWindow
        open
        title="Agregar una lesion"
        tone="lesion"
        sectionTitles={["Lesiones"]}
        toothNumbers={["18"]}
        surface="M,D"
        onClose={vi.fn()}
        onAddDiagnosis={vi.fn()}
      />
    );

    expect(screen.getByText("1.8 - Cara mesial, distal")).toBeInTheDocument();
  });
});
