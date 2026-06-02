import {
  buildTimeSlotsFromRange,
  getProfessionalBranchAgendaConfig,
  isTimeAlignedToSlot,
  resolveAgendaTimelineRange,
  resolveAgendaViewConfig
} from "./agenda-grid-config";

describe("agenda grid config", () => {
  it("uses the common professional interval in the global daily agenda", () => {
    const config = resolveAgendaViewConfig({
      activeBranch: { id: "branch-1", agendaSlotMinutes: 30, agendaStartHour: 8, agendaEndHour: 19 },
      activeBranchId: "branch-1",
      selectedProfessionalBranch: null,
      visibleProfessionals: [
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20, defaultAppointmentDurationMinutes: 20 }] },
        { branches: [{ id: "branch-1", agendaSlotMinutes: 20, defaultAppointmentDurationMinutes: 40 }] }
      ]
    });

    expect(config.agendaSlotMinutes).toBe(20);
    expect(config.agendaStartHour).toBe(8);
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

  it("checks time alignment from the professional schedule start", () => {
    expect(isTimeAlignedToSlot("08:40", "08:00", 20)).toBe(true);
    expect(isTimeAlignedToSlot("08:30", "08:00", 20)).toBe(false);
    expect(isTimeAlignedToSlot("09:15", "08:45", 15)).toBe(true);
  });

  it("derives the visible agenda range from active professional schedules", () => {
    const range = resolveAgendaTimelineRange({
      fallbackStartHour: 8,
      fallbackEndHour: 19,
      schedules: [
        { professionalId: "a", startTime: "09:00", endTime: "14:00", isActive: true },
        { professionalId: "b", startTime: "10:00", endTime: "18:30", isActive: true }
      ]
    });

    expect(range).toEqual({ startMinutes: 540, endMinutes: 1110 });
  });

  it("builds agenda labels from a minute range and interval", () => {
    expect(buildTimeSlotsFromRange(540, 600, 20, { endExclusive: true })).toEqual(["09:00", "09:20", "09:40"]);
  });
});
