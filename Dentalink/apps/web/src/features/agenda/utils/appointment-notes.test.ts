import { hasAppointmentNotes } from "./appointment-notes";

describe("appointment note signal", () => {
  it("detects appointment notes saved on the appointment", () => {
    expect(hasAppointmentNotes({ notes: "Comentario inicial" })).toBe(true);
  });

  it("detects persisted appointment note counts from agenda list payloads", () => {
    expect(hasAppointmentNotes({ _count: { appointmentNotes: 1 } })).toBe(true);
  });

  it("ignores empty note signals", () => {
    expect(hasAppointmentNotes({ notes: "   ", appointmentNotes: [], _count: { appointmentNotes: 0 } })).toBe(false);
  });
});
