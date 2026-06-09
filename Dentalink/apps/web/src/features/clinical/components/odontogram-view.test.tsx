import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { OdontogramView } from "./odontogram-view";
import { ToothDiagnosisPickerWindow } from "./tooth-diagnosis-modal";

function TestOdontogram({
  mode = "clinical",
  onApplyQuickDiagnosis = vi.fn(),
  onOpenProcedureCatalog = vi.fn()
}: {
  mode?: "clinical" | "treatment-plan";
  onApplyQuickDiagnosis?: (diagnosis: string) => void;
  onOpenProcedureCatalog?: () => void;
}) {
  const selectedTooth = useOdontogramStore((state) => state.selectedTooth);
  const selectTooth = useOdontogramStore((state) => state.selectTooth);
  const openModal = useOdontogramStore((state) => state.openModal);

  return (
    <OdontogramView
      mode={mode}
      selectedTooth={selectedTooth}
      latestByTooth={{}}
      conditions={[]}
      records={[]}
      procedures={[]}
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
});
