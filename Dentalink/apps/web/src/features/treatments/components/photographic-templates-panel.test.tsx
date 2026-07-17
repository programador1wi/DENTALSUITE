import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PhotographicTemplatesPanel } from "./photographic-templates-panel";
import type {
  PhotographicSession,
  PhotographicSlot,
  PhotographicTemplatesResult
} from "../services/photographic-templates.service";

const state = vi.hoisted(() => ({
  result: null as PhotographicTemplatesResult | null,
  upload: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
}));

function mutation(mutateAsync = vi.fn()) {
  return { mutateAsync, isPending: false };
}

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

vi.mock("../hooks/use-photographic-templates", () => ({
  usePhotographicTemplates: () => ({ data: state.result, isLoading: false }),
  usePhotographicAvailableLinks: () => ({ data: { appointments: [], controls: [], evolutions: [] } }),
  usePhotographicTemplateMutations: () => ({
    createSession: mutation(state.create),
    updateSession: mutation(state.update),
    uploadImage: mutation(state.upload),
    editImage: mutation(),
    voidImage: mutation(),
    completeSession: mutation(),
    voidSession: mutation(),
    createLink: mutation(),
    removeLink: mutation(),
    updatePolicy: mutation(),
    updateSlot: mutation(),
    dismissReminder: mutation(),
    createMobileUpload: mutation()
  })
}));

vi.mock("../services/photographic-templates.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/photographic-templates.service")>();
  return { ...original, getPhotographicFileBlob: vi.fn(), auditPhotographicComparison: vi.fn() };
});

describe("PhotographicTemplatesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = {
      slots: slotsFixture(),
      sessions: [],
      policy: { treatmentPlanId: "plan-1", frequency: "NONE" },
      reminder: null
    };
  });

  it("renders a virtual Initial template with exactly ten configured positions", () => {
    renderPanel();
    expect(screen.getByText("Plantilla fotografica · Inicial")).toBeInTheDocument();
    expect(screen.getByText(/Se creara al cargar primera imagen/)).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(10);
    expect(screen.getByText("Frontal en reposo")).toBeInTheDocument();
    expect(screen.getByText("Oclusal inferior")).toBeInTheDocument();
    expect(screen.getByText(/no representa progreso clinico/i)).toBeInTheDocument();
  });

  it("uploads the first image without pre-creating an empty session", async () => {
    const { container } = renderPanel();
    const file = new File(["image"], "front.jpg", { type: "image/jpeg" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [file] } });
    await waitFor(() => expect(state.upload).toHaveBeenCalledTimes(1));
    expect(state.upload).toHaveBeenCalledWith(
      expect.objectContaining({ treatmentPlanId: "plan-1", sessionId: undefined, slotId: "slot-1", file })
    );
  });

  it("navigates multiple sessions chronologically without exposing a treatment percentage", async () => {
    state.result = {
      slots: slotsFixture(),
      sessions: [
        sessionFixture("session-1", "Inicial", "2026-01-15"),
        sessionFixture("session-2", "Control 1", "2026-03-15")
      ],
      policy: { treatmentPlanId: "plan-1", frequency: "NONE" },
      reminder: null
    };
    renderPanel();
    expect(screen.getByText("Plantilla fotografica · Inicial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Control 1/ }));
    await waitFor(() => expect(screen.getByText("Plantilla fotografica · Control 1")).toBeInTheDocument());
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });
});

function renderPanel() {
  return render(
    <PhotographicTemplatesPanel
      treatmentPlanId="plan-1"
      patientId="patient-1"
      professionalId="professional-1"
      branchId="branch-1"
    />
  );
}

function slotsFixture(): PhotographicSlot[] {
  const labels = [
    "Frontal en reposo",
    "Frontal sonriendo",
    "Perfil derecho",
    "Perfil izquierdo",
    "Intraoral frontal",
    "Intraoral derecha",
    "Intraoral izquierda",
    "Oclusal superior",
    "Oclusal inferior",
    "Intraoral adicional"
  ];
  return labels.map((label, index) => ({
    id: `slot-${index + 1}`,
    code: `SLOT_${index + 1}`,
    label,
    group: index < 4 ? "FACIAL" : "INTRAORAL",
    sortOrder: index + 1,
    rowNumber: index < 4 ? 1 : index < 7 ? 2 : 3,
    columnNumber: index < 4 ? index + 1 : index < 7 ? index - 3 : index - 6,
    isRequired: true,
    isActive: true,
    version: 1
  }));
}

function sessionFixture(id: string, name: string, clinicalDate: string): PhotographicSession {
  return {
    id,
    organizationId: "org-1",
    patientId: "patient-1",
    treatmentPlanId: "plan-1",
    branchId: "branch-1",
    professionalId: "professional-1",
    name,
    sessionType: name === "Inicial" ? "INITIAL" : "FOLLOW_UP",
    clinicalDate,
    status: "INCOMPLETE",
    version: 1,
    createdAt: clinicalDate,
    updatedAt: clinicalDate,
    images: [],
    links: []
  };
}
