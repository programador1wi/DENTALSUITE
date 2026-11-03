import { http } from "@/lib/api/http-client";
import {
  createMassReprogrammingBatch,
  definitivelyCancelReprogrammingCase,
  previewMassReprogramming,
  rescheduleAppointmentCase
} from "./appointment-reprogramming.service";

vi.mock("@/lib/api/http-client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe("appointment reprogramming service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.post).mockResolvedValue({ data: {} });
  });

  it("keeps preview read-only on the preview endpoint", async () => {
    const criteria = {
      branchId: "branch-1",
      professionalId: "professional-1",
      startDate: "2026-07-30",
      endDate: "2026-07-31",
      reasonCode: "SCHEDULE_CHANGE",
      reasonText: "Cambio de horario"
    };

    await previewMassReprogramming(criteria);

    expect(http.post).toHaveBeenCalledWith("/agenda/reprogramming/batches/preview", criteria);
  });

  it("sends a stable idempotency key when creating a mass batch", async () => {
    const payload = {
      branchId: "branch-1",
      professionalId: "professional-1",
      startDate: "2026-07-30",
      endDate: "2026-07-31",
      reasonCode: "SCHEDULE_CHANGE",
      reasonText: "Cambio de horario",
      selectedAppointmentIds: ["appointment-1"]
    };

    await createMassReprogrammingBatch(payload, "batch-request-1");

    expect(http.post).toHaveBeenCalledWith("/agenda/reprogramming/batches", payload, {
      headers: { "Idempotency-Key": "batch-request-1" }
    });
  });

  it("uses separate endpoints for replacement appointments and definitive cancellation", async () => {
    await rescheduleAppointmentCase("case-1", {
      version: 2,
      branchId: "branch-1",
      professionalId: "professional-1",
      startAt: "2026-08-01T16:00:00.000Z",
      endAt: "2026-08-01T16:30:00.000Z",
      durationMinutes: 30
    });
    await definitivelyCancelReprogrammingCase("case-1", {
      version: 2,
      reason: "Paciente no desea reagendar"
    });

    expect(http.post).toHaveBeenNthCalledWith(
      1,
      "/agenda/reprogramming/cases/case-1/reschedule",
      expect.objectContaining({ version: 2, durationMinutes: 30 })
    );
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/agenda/reprogramming/cases/case-1/cancel-definitively",
      { version: 2, reason: "Paciente no desea reagendar" }
    );
  });
});
