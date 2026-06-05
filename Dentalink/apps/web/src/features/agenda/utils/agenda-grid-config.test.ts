import {
  buildTimelineMarkersFromRange,
  buildTimeSlotsFromRange,
  getProfessionalBranchAgendaConfig,
  isTimeAlignedToSlot,
  resolveAgendaTimelineRange,
  resolveAgendaViewConfig
} from "./agenda-grid-config";

describe("agenda grid config", () => {
  it("uses the common professional interval in the global daily agenda", () => {
    const config = resolveAgendaViewConfig({
      activeBranch: { id: "branch-1", agendaSlotMinutes: 30, agendaStartHour: 10, agendaEndHour: 19 },
      activeBranchId: "branch-1",
      selectedProfessionalBranch: null,
      visibleProfessionals: [
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20, defaultAppointmentDurationMinutes: 20 }] },
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20, defaultAppointmentDurationMinutes: 40 }] }
      ]
    });

    expect(config.agendaSlotMinutes).toBe(20);
    expect(config.agendaStartHour).toBe(10);
    expect(config.agendaEndHour).toBe(19);
  });

  it("uses the shortest professional interval in the global daily agenda", () => {
    const config = resolveAgendaViewConfig({
      activeBranch: { id: "branch-1", agendaSlotMinutes: 30 },
      activeBranchId: "branch-1",
      selectedProfessionalBranch: null,
      visibleProfessionals: [
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20 }] },
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20 }] },
        { branches: [{ id: "branch-1", agendaSlotMinutes: 30 }] }
      ]
    });

    expect(config.agendaSlotMinutes).toBe(20);
  });

  it("uses a configured professional interval instead of deriving a 10 minute grid when intervals are mixed", () => {
    const config = resolveAgendaViewConfig({
      activeBranch: { id: "branch-1", agendaSlotMinutes: 30 },
      activeBranchId: "branch-1",
      selectedProfessionalBranch: null,
      visibleProfessionals: [
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20 }] },
        { branches: [{ id: "branch-1", agendaSlotMinutes: 30 }] }
      ]
    });

    expect(config.agendaSlotMinutes).toBe(20);
  });

  it("prioritizes the selected professional interval and default duration", () => {
    const config = resolveAgendaViewConfig({
      activeBranch: { id: "branch-1", agendaSlotMinutes: 30 },
      activeBranchId: "branch-1",
      selectedProfessionalBranch: {
        id: "branch-1",
        agendaSlotMinutes: 15,
        defaultAppointmentDurationMinutes: 45
      },
      visibleProfessionals: [{ branches: [{ id: "branch-1", agendaSlotMinutes: 30 }] }]
    });

    expect(config.agendaSlotMinutes).toBe(15);
    expect(config.defaultAppointmentDurationMinutes).toBe(45);
  });

  it("returns the professional branch duration for slot creation", () => {
    const config = getProfessionalBranchAgendaConfig(
      { branches: [{ id: "branch-1", agendaSlotMinutes: 20, defaultAppointmentDurationMinutes: 40 }] },
      "branch-1",
      30
    );

    expect(config).toEqual({ slotMinutes: 20, defaultAppointmentDurationMinutes: 40 });
  });

  it("falls back when a professional payload has no branch list", () => {
    const config = getProfessionalBranchAgendaConfig({}, "branch-1", 30);

    expect(config).toEqual({ slotMinutes: 30, defaultAppointmentDurationMinutes: 30 });
  });

  it("checks time alignment from the professional schedule start", () => {
    expect(isTimeAlignedToSlot("08:40", "08:00", 20)).toBe(true);
    expect(isTimeAlignedToSlot("08:30", "08:00", 20)).toBe(false);
    expect(isTimeAlignedToSlot("09:15", "08:45", 15)).toBe(true);
  });

  it("keeps the visible agenda range pinned to branch agenda hours", () => {
    const range = resolveAgendaTimelineRange({
      fallbackStartHour: 10,
      fallbackEndHour: 19,
      schedules: [
        { professionalId: "a", startTime: "09:00", endTime: "14:00", isActive: true },
        { professionalId: "b", startTime: "10:00", endTime: "18:30", isActive: true }
      ]
    });

    expect(range).toEqual({ startMinutes: 600, endMinutes: 1140 });
  });

  it("builds agenda labels from a minute range and interval", () => {
    expect(buildTimeSlotsFromRange(540, 600, 20, { endExclusive: true })).toEqual(["09:00", "09:20", "09:40"]);
  });

  it("keeps 18:40 as the last start label for a 20 minute agenda ending at 19:00", () => {
    const slots = buildTimeSlotsFromRange(600, 1140, 20, { endExclusive: true });

    expect(slots.at(-1)).toBe("18:40");
    expect(slots).not.toContain("19:00");
  });

  it("builds visible time labels for each agenda division", () => {
    const markers = buildTimelineMarkersFromRange(600, 660, 20, { slotMinutes: 20, slotHeight: 38 }, { endExclusive: true });

    expect(markers.map((marker) => marker.time)).toEqual(["10:00", "10:20", "10:40"]);
    expect(markers.map((marker) => marker.top)).toEqual([0, 38, 76]);
  });
});
