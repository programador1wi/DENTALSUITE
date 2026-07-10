import { getDirectAppointmentStatusOptions } from "./appointment-status-flow";

describe("appointment status flow", () => {
  it("keeps cancellation reasons out of direct status changes", () => {
    const actions = getDirectAppointmentStatusOptions("SCHEDULED").map((option) => option.action);

    expect(actions).not.toContain("cancelPatient");
    expect(actions).not.toContain("cancelClinic");
    expect(actions).not.toContain("cancelConflict");
    expect(actions).not.toContain("cancelRescheduled");
  });

  it("distinguishes email notification from manual email confirmation", () => {
    const options = getDirectAppointmentStatusOptions("SCHEDULED");

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "notifyEmail", label: "Enviar confirmación por email" }),
        expect.objectContaining({ action: "confirmEmail", label: "Marcar confirmado por email" })
      ])
    );
  });
});
