import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  createDefaultPatientFieldSettings,
  type PatientFieldSettings
} from "../config/patient-field-settings";
import { PatientsConfigurationPage } from "./patients-configuration-page";

const fieldConfigMock = vi.hoisted(() => ({
  settings: null as PatientFieldSettings | null,
  setSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock("../config/patient-field-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/patient-field-settings")>();
  return {
    ...actual,
    usePatientFieldSettings: () => [
      fieldConfigMock.settings ?? actual.createDefaultPatientFieldSettings(),
      fieldConfigMock.setSettings,
      {
        saveSettings: fieldConfigMock.saveSettings,
        isLoading: false,
        isSaving: false,
        error: null
      }
    ]
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/patients/configuration"]}>
      <PatientsConfigurationPage />
    </MemoryRouter>
  );
}

describe("PatientsConfigurationPage", () => {
  beforeEach(() => {
    fieldConfigMock.settings = createDefaultPatientFieldSettings();
    fieldConfigMock.setSettings.mockReset();
    fieldConfigMock.saveSettings.mockReset().mockResolvedValue(undefined);
  });

  it("keeps the save action below the configuration matrix and persists explicitly", async () => {
    renderPage();

    expect(screen.getByText("Nombre social")).toBeInTheDocument();
    const table = screen.getByRole("table");
    const saveButton = screen.getByRole("button", { name: "Guardar" });
    expect(table.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(saveButton);

    await waitFor(() => expect(fieldConfigMock.saveSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Configuracion guardada y aplicada a todos los flujos."
    );
  });

  it("updates editable permissions while keeping system fields locked", () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: "Nombre legal presente en En seccion de nuevo paciente" })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Email requerido en En seccion de nuevo paciente" }));

    expect(fieldConfigMock.setSettings).toHaveBeenCalledTimes(1);
    const nextSettings = fieldConfigMock.setSettings.mock.calls[0][0] as PatientFieldSettings;
    expect(nextSettings.newPatient.email).toEqual({ present: true, required: true });
  });
});
