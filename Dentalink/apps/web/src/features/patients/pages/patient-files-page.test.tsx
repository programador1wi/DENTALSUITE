import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientFilesPage } from "./patient-files-page";
import type { FileAttachment, RadiographyAnalysis } from "@/features/documents/services/documents.service";

const uploadPatientBinaryFile = { mutateAsync: vi.fn(), isPending: false };
const savePatientRadiographyAnalysis = { mutateAsync: vi.fn(), isPending: false };
let radiographyAnalysis: RadiographyAnalysis | null = null;

const files: FileAttachment[] = [
  {
    id: "xray-1",
    organizationId: "org-1",
    patientId: "patient-1",
    uploadedById: "user-1",
    fileName: "stored-xray.jpg",
    originalName: "panoramica.jpg",
    mimeType: "image/jpeg",
    size: 1024 * 1024,
    url: "/patients/patient-1/files/xray-1/content",
    category: "XRAY",
    createdAt: "2026-05-22T16:14:08.000Z",
    updatedAt: "2026-05-22T16:14:08.000Z"
  },
  {
    id: "doc-1",
    organizationId: "org-1",
    patientId: "patient-1",
    uploadedById: "user-1",
    fileName: "stored-doc.pdf",
    originalName: "consentimiento.pdf",
    mimeType: "application/pdf",
    size: 2048,
    url: "/patients/patient-1/files/doc-1/content",
    category: "DOCUMENT",
    createdAt: "2026-05-21T16:14:08.000Z",
    updatedAt: "2026-05-21T16:14:08.000Z"
  }
];

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useParams: () => ({ id: "patient-1" }),
    useLocation: () => ({ pathname: "/patients/patient-1/clinical/files" })
  };
});

vi.mock("../components/patient-section-page", () => ({
  PatientSectionPage: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock("@/features/patients/hooks/use-patients", () => ({
  usePatient: () => ({
    data: { id: "patient-1", firstName: "Gilberto", lastName: "Dominguez", status: "ACTIVE" }
  })
}));

vi.mock("@/features/clinical/hooks/use-clinical", () => ({
  useClinicalSummary: () => ({
    data: {},
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/documents/hooks/use-documents", () => ({
  usePatientFiles: () => ({
    data: files,
    isLoading: false,
    isError: false,
    error: null
  }),
  usePatientRadiographyAnalysis: () => ({
    data: radiographyAnalysis,
    isLoading: false,
    isError: false,
    error: null
  }),
  useRadiographyAnalysisMutations: () => ({
    savePatientRadiographyAnalysis
  }),
  useDocumentsMutations: () => ({
    uploadPatientBinaryFile
  })
}));

vi.mock("@/features/documents/services/documents.service", () => ({
  getPatientFileBlob: vi.fn(() => Promise.resolve(new Blob(["image"], { type: "image/jpeg" })))
}));

describe("PatientFilesPage radiography viewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    radiographyAnalysis = savedRadiographyAnalysis();
    savePatientRadiographyAnalysis.mutateAsync.mockImplementation(async (variables) => ({
      ...savedRadiographyAnalysis(),
      id: "analysis-saved",
      findings: variables.findings
    }));
    vi.stubGlobal("open", vi.fn());
    URL.createObjectURL = vi.fn(() => "blob:radiography");
    URL.revokeObjectURL = vi.fn();
  });

  it("opens XRAY image files in the radiography viewer modal", async () => {
    render(<PatientFilesPage />);

    openFile("panoramica.jpg");

    expect(screen.getByRole("dialog", { name: "Visor radiografico" })).toBeInTheDocument();
    expect(screen.getAllByText(/Gilberto Dominguez/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Analisis RX").length).toBeGreaterThan(0);
    expect(screen.queryByText("Vista de solo lectura")).not.toBeInTheDocument();
  });

  it("keeps non-radiography files in the generic read-only drawer", () => {
    render(<PatientFilesPage />);

    openFile("consentimiento.pdf");

    expect(screen.getByText("Vista de solo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Visor radiografico" })).not.toBeInTheDocument();
  });

  it("zooms in and out within the radiography viewer", () => {
    render(<PatientFilesPage />);

    openFile("panoramica.jpg");
    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Acercar"));
    expect(screen.getByText("125%")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Alejar"));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("toggles the global labels layer", async () => {
    render(<PatientFilesPage />);

    openFile("panoramica.jpg");
    await waitFor(() => expect(screen.getByTestId("finding-overlay-implant-16")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Ocultar capa etiquetas"));

    expect(screen.queryByTestId("finding-overlay-implant-16")).not.toBeInTheDocument();
  });

  it("toggles a single finding overlay", async () => {
    render(<PatientFilesPage />);

    openFile("panoramica.jpg");
    await waitFor(() => expect(screen.getByTestId("finding-overlay-implant-16")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Ocultar 1.6 Implante"));

    expect(screen.queryByTestId("finding-overlay-implant-16")).not.toBeInTheDocument();
    expect(screen.getByTestId("finding-overlay-wisdom-18")).toBeInTheDocument();
  });

  it("opens new XRAY images without demo findings and enables manual analysis creation", async () => {
    radiographyAnalysis = null;
    render(<PatientFilesPage />);

    openFile("panoramica.jpg");

    expect(screen.getByText("Sin hallazgos")).toBeInTheDocument();
    expect(screen.queryByTestId("finding-overlay-implant-16")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Crear analisis" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar hallazgo" }));
    fireEvent.change(screen.getByPlaceholderText("FDI"), { target: { value: "1.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(savePatientRadiographyAnalysis.mutateAsync).toHaveBeenCalled());
    expect(savePatientRadiographyAnalysis.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "patient-1",
        fileId: "xray-1",
        status: "DRAFT",
        findings: [
          expect.objectContaining({
            tooth: "1.1",
            label: "Cavidad",
            source: "MANUAL"
          })
        ]
      })
    );
  });

  it("shows file information in the radiography sidebar", () => {
    render(<PatientFilesPage />);

    openFile("panoramica.jpg");
    const infoButtons = screen.getAllByRole("button", { name: "Informacion del archivo" });
    fireEvent.click(infoButtons[infoButtons.length - 1]);

    expect(screen.getByText("Radiografia")).toBeInTheDocument();
    expect(screen.getAllByText("image/jpeg").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.0 MB").length).toBeGreaterThan(0);
  });
});

function openFile(name: string) {
  const target = screen.getAllByText(name).at(-1);
  if (!target) throw new Error(`Missing file ${name}`);
  fireEvent.click(target);
}

function savedRadiographyAnalysis(): RadiographyAnalysis {
  return {
    id: "analysis-1",
    organizationId: "org-1",
    patientId: "patient-1",
    fileAttachmentId: "xray-1",
    provider: "MANUAL",
    status: "DRAFT",
    findings: [
      {
        id: "implant-16",
        tooth: "1.6",
        label: "Implante",
        bbox: { x: 0.41, y: 0.42, width: 0.07, height: 0.13 },
        visible: true,
        source: "MANUAL"
      },
      {
        id: "wisdom-18",
        tooth: "1.8",
        label: "Muela del juicio",
        bbox: { x: 0.28, y: 0.34, width: 0.09, height: 0.2 },
        visible: true,
        source: "MANUAL"
      }
    ],
    createdAt: "2026-05-22T16:14:08.000Z",
    updatedAt: "2026-05-22T16:14:08.000Z"
  };
}
