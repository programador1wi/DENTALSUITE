import { EmptyState } from "@/components/feedback/empty-state";
import type { Appointment } from "../services/appointments.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { CalendarDays, Clock, Plus, UserRound } from "lucide-react";

import { AppointmentCard } from "./appointment-card";

function dayKey(value: string) {
  return toDateInputValue(new Date(value));
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00"
];

const WEEK_START_HOUR = 8;
const WEEK_END_HOUR = 20;
const WEEK_SLOT_MINUTES = 20;
const WEEK_SLOT_HEIGHT = 36;
const WEEK_TIME_SLOTS = buildTimeSlots(WEEK_START_HOUR, WEEK_END_HOUR, WEEK_SLOT_MINUTES);

const getAppointmentSlotKey = (appointment: Appointment) => {
  try {
    const date = new Date(appointment.startAt);
    const hrs = String(date.getHours()).padStart(2, "0");
    const mins = date.getMinutes() >= 30 ? "30" : "00";
    return `${hrs}:${mins}`;
  } catch {
    return "";
  }
};

export function CalendarView({
  appointments,
  date,
  view = "day",
  professionals = [],
  selectedProfessionalId = "",
  selectedBranchId = "",
  onSelectProfessional,
  onCreateClick,
  onCreateSlotClick,
  onEdit,
  onCancel,
  onReschedule,
  onConfirm,
  onArrive,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow
}: {
  appointments: Appointment[];
  date: string;
  view?: "day" | "week" | "month";
  professionals?: Professional[];
  selectedProfessionalId?: string;
  selectedBranchId?: string;
  onSelectProfessional?: (professionalId: string) => void;
  onCreateClick?: () => void;
  onCreateSlotClick?: (slot: { professionalId: string; branchId?: string; startAt: string; endAt: string }) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onConfirm: (id: string) => void;
  onArrive: (id: string) => void;
  onWaitingRoom: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  if (view === "week") {
    const weekStart = getWeekStart(parseDateInput(date));
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      return {
        date: day,
        key: toDateInputValue(day),
        label: formatWeekDay(day),
        shortLabel: day.toLocaleDateString("es-MX", { weekday: "short" }),
        count: 0
      };
    });
    const dayKeys = new Set(days.map((day) => day.key));
    const appointmentsInWeek = appointments.filter((appointment) => dayKeys.has(dayKey(appointment.startAt)));

    if (!selectedProfessionalId) {
      const appointmentCounts = appointmentsInWeek.reduce<Record<string, number>>((acc, appointment) => {
        acc[appointment.professionalId] = (acc[appointment.professionalId] ?? 0) + 1;
        return acc;
      }, {});
      const displayProfessionals = professionals.length > 0
        ? professionals
        : Array.from(new Set(appointmentsInWeek.map((appointment) => appointment.professionalId))).map((id) => {
            const appointment = appointmentsInWeek.find((item) => item.professionalId === id);
            return {
              id,
              firstName: appointment?.professional?.firstName || "Doctor",
              lastName: appointment?.professional?.lastName || "",
              color: appointment?.professional?.color
            } as Professional;
          });

      if (displayProfessionals.length === 0) {
        return <EmptyState title="Sin doctores para agendar" description="No hay doctores activos registrados para esta sucursal." />;
      }

      return (
        <div className="rounded-xl border border-zinc-200/70 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-zinc-100 px-4 py-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Semana</p>
              <h3 className="text-sm font-semibold text-zinc-900">{formatWeekRange(weekStart)}</h3>
            </div>
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
              <UserRound className="h-3.5 w-3.5" />
              {displayProfessionals.length} doctores
            </div>
          </div>

          <div className="grid gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {displayProfessionals.map((professional) => {
              const count = appointmentCounts[professional.id] ?? 0;
              const accentColor = professional.color || "#18181b";

              return (
                <button
                  key={professional.id}
                  type="button"
                  onClick={() => onSelectProfessional?.(professional.id)}
                  className="group flex min-h-24 items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {professional.firstName.charAt(0)}{professional.lastName.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">
                      {professional.firstName} {professional.lastName}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 ring-1 ring-zinc-200">
                        <CalendarDays className="h-3 w-3" />
                        {count} {count === 1 ? "cita" : "citas"}
                      </span>
                      {professional.specialties?.[0]?.name && (
                        <span className="truncate rounded-full bg-zinc-50 px-2 py-0.5 ring-1 ring-zinc-200">
                          {professional.specialties[0].name}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    const selectedProfessional =
      professionals.find((professional) => professional.id === selectedProfessionalId) ??
      appointmentsInWeek.find((appointment) => appointment.professionalId === selectedProfessionalId)?.professional;

    if (!selectedProfessional) {
      return <EmptyState title="Doctor no disponible" description="El doctor seleccionado no esta activo para esta sucursal." />;
    }

    const selectedAppointments = appointmentsInWeek.filter((appointment) => appointment.professionalId === selectedProfessional.id);
    const appointmentsByDay = selectedAppointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
      const key = dayKey(appointment.startAt);
      acc[key] = [...(acc[key] ?? []), appointment];
      return acc;
    }, {});
    const totalTimelineHeight = WEEK_TIME_SLOTS.length * WEEK_SLOT_HEIGHT;

    return (
      <div className="w-full rounded-xl border border-zinc-200/70 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
              {selectedProfessional.firstName.charAt(0)}{selectedProfessional.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{formatWeekRange(weekStart)}</p>
              <h3 className="truncate text-base font-semibold text-zinc-900">
                {selectedProfessional.firstName} {selectedProfessional.lastName}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
              <Clock className="h-3.5 w-3.5" />
              {selectedAppointments.length} {selectedAppointments.length === 1 ? "cita" : "citas"}
            </span>
            {onSelectProfessional && (
              <button
                type="button"
                onClick={() => onSelectProfessional("")}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Cambiar doctor
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div
              className="grid border-b border-zinc-200 bg-zinc-50/70"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))" }}
            >
              <div className="sticky left-0 z-30 flex h-14 items-center justify-center border-r border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Hora
              </div>
              {days.map((day) => {
                const dayCount = appointmentsByDay[day.key]?.length ?? 0;

                return (
                  <div key={day.key} className="flex h-14 flex-col justify-center border-r border-zinc-200 px-3 last:border-r-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{day.shortLabel}</span>
                    <span className="text-xs font-semibold text-zinc-900">{day.label}</span>
                    <span className="text-[10px] font-medium text-zinc-500">{dayCount} {dayCount === 1 ? "cita" : "citas"}</span>
                  </div>
                );
              })}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))" }}
            >
              <div className="sticky left-0 z-20 border-r border-zinc-200 bg-zinc-50/80">
                {WEEK_TIME_SLOTS.map((time) => (
                  <div
                    key={time}
                    className="flex items-start justify-center border-b border-zinc-200/70 pt-1 text-[10px] font-medium text-zinc-500"
                    style={{ height: WEEK_SLOT_HEIGHT }}
                  >
                    {time}
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const dayAppointments = appointmentsByDay[day.key] ?? [];

                return (
                  <div
                    key={day.key}
                    className="relative border-r border-zinc-200 bg-white last:border-r-0"
                    style={{ height: totalTimelineHeight }}
                  >
                    {WEEK_TIME_SLOTS.map((time, index) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          if (onCreateSlotClick) {
                            onCreateSlotClick({
                              professionalId: selectedProfessional.id,
                              branchId: selectedBranchId || undefined,
                              ...slotRange(day.key, time)
                            });
                            return;
                          }
                          onCreateClick?.();
                        }}
                        className="group absolute left-0 right-0 border-b border-zinc-100/90 transition-colors hover:bg-cyan-50/40"
                        style={{ top: index * WEEK_SLOT_HEIGHT, height: WEEK_SLOT_HEIGHT }}
                      >
                        <span className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-md text-cyan-700 opacity-0 transition-opacity group-hover:opacity-100">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}

                    {dayAppointments.map((appointment) => {
                      const placement = getWeekAppointmentPlacement(appointment);

                      return (
                        <div
                          key={appointment.id}
                          className="absolute z-10 px-1"
                          style={{
                            top: placement.top,
                            height: placement.height,
                            left: 0,
                            right: 0
                          }}
                        >
                          <AppointmentCard
                            appointment={appointment}
                            compact={true}
                            onEdit={onEdit}
                            onCancel={onCancel}
                            onReschedule={onReschedule}
                            onConfirm={onConfirm}
                            onArrive={onArrive}
                            onWaitingRoom={onWaitingRoom}
                            onStart={onStart}
                            onComplete={onComplete}
                            onNoShow={onNoShow}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DAY VIEW: MULTI-PROFESSIONAL COLUMN GRID (SaaS Premium Redesign) ---
  if (view === "day") {
    const activeProfessionals = selectedProfessionalId
      ? professionals.filter((p) => p.id === selectedProfessionalId)
      : professionals;

    // Fallback to active appointment professionals if the list is empty
    const displayProfessionals = activeProfessionals.length > 0
      ? activeProfessionals
      : Array.from(new Set(appointments.map((a) => a.professionalId))).map((id) => {
          const app = appointments.find((a) => a.professionalId === id);
          return {
            id,
            firstName: app?.professional?.firstName || "Doctor",
            lastName: app?.professional?.lastName || "",
          } as Professional;
        });

    if (displayProfessionals.length === 0) {
      return (
        <div className="space-y-4">
          <EmptyState 
            title="Sin doctores para agendar" 
            description="No hay doctores activos registrados para mostrar columnas en este día." 
          />
          {onCreateClick && (
            <div className="flex justify-center">
              <button 
                onClick={onCreateClick}
                className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600 shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
              >
                + Crear Nueva Cita
              </button>
            </div>
          )}
        </div>
      );
    }

    // Map appointments by professionalId and slotKey for constant-time lookups
    const appMap: Record<string, Appointment[]> = {};
    appointments.forEach((app) => {
      const slotKey = getAppointmentSlotKey(app);
      if (slotKey) {
        const mapKey = `${app.professionalId}:${slotKey}`;
        appMap[mapKey] = [...(appMap[mapKey] ?? []), app];
      }
    });

    return (
      <div className="w-full space-y-4">
        {/* Responsive horizontal scroll shell for daily clinical columns */}
        <div className="w-full rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all duration-200">
          <div className="overflow-x-auto">
            <div className="flex min-w-[700px]">
              {/* Sticky Hours Timeline Left Panel */}
              <div className="w-16 shrink-0 border-r border-zinc-100 bg-zinc-50/20 flex flex-col z-20">
                {/* Visual corner connector indicator */}
                <div className="h-16 border-b border-zinc-100 flex items-center justify-center bg-zinc-50/40 shrink-0 select-none">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                    Hora
                  </span>
                </div>
                
                {/* Hourly grid lines indicators */}
                <div className="flex-1 divide-y divide-zinc-100/60">
                  {TIME_SLOTS.map((time) => (
                    <div key={time} className="h-20 flex items-center justify-center text-center shrink-0">
                      <span className="text-[10px] font-medium text-zinc-400 tracking-tight">
                        {time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns list for each active professional */}
              <div className="flex flex-1 divide-x divide-zinc-200/40">
                {displayProfessionals.map((prof) => {
                  const profApps = appointments.filter((a) => a.professionalId === prof.id);
                  const profAppsCount = profApps.length;

                  return (
                    <div key={prof.id} className="flex-1 min-w-[220px] flex flex-col">
                      {/* Professional Info Column Header */}
                      <div className="sticky top-0 h-16 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-zinc-200/60 flex items-center gap-2.5 z-10 shrink-0">
                        <div className="h-8 w-8 rounded-full bg-zinc-950 text-white flex items-center justify-center font-medium text-xs shrink-0 select-none">
                          {prof.firstName.charAt(0)}{prof.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-900 truncate">
                            {prof.firstName} {prof.lastName}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-zinc-50 border border-zinc-200/60 px-2 py-0.5 text-[9px] font-medium text-zinc-500 mt-0.5 select-none">
                            {profAppsCount} {profAppsCount === 1 ? "cita" : "citas"}
                          </span>
                        </div>
                      </div>

                      {/* Timeline Slots under this doctor */}
                      <div className="flex-1 divide-y divide-zinc-200/30 bg-zinc-50/5">
                        {TIME_SLOTS.map((time) => {
                          const mapKey = `${prof.id}:${time}`;
                          const slotApps = appMap[mapKey] ?? [];

                          return (
                            <div key={time} className="h-20 p-1 relative group">
                              {slotApps.length > 0 ? (
                                <div className="space-y-1 h-full">
                                  {slotApps.map((app) => (
                                    <div key={app.id} className="h-full">
                                      <AppointmentCard
                                        appointment={app}
                                        compact={true}
                                        onEdit={onEdit}
                                        onCancel={onCancel}
                                        onReschedule={onReschedule}
                                        onConfirm={onConfirm}
                                        onArrive={onArrive}
                                        onWaitingRoom={onWaitingRoom}
                                        onStart={onStart}
                                        onComplete={onComplete}
                                        onNoShow={onNoShow}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                /* Interactive Glassmorphic Hover Free Slot */
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onCreateSlotClick) {
                                      onCreateSlotClick({
                                        professionalId: prof.id,
                                        branchId: selectedBranchId || undefined,
                                        ...slotRange(date, time)
                                      });
                                      return;
                                    }
                                    onCreateClick?.();
                                  }}
                                  className="w-full h-full rounded-lg border border-transparent hover:bg-zinc-50/70 flex items-center justify-center transition-all duration-150 group/slot"
                                >
                                  <span className="text-[10px] font-medium text-zinc-400/80 group-hover/slot:text-zinc-600 flex items-center gap-1 opacity-0 group-hover/slot:opacity-100 transition-opacity duration-150">
                                    <svg className="h-3.5 w-3.5 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    <span>Disponible</span>
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- WEEK / MONTH VIEW FALLBACK (Standard Day Groups) ---
  const groups = appointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    const key = dayKey(appointment.startAt);
    acc[key] = [...(acc[key] ?? []), appointment];
    return acc;
  }, {});

  if (!Object.keys(groups).length) {
    return <EmptyState title="Sin citas" description="No hay citas para los filtros seleccionados." />;
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([date, rows]) => (
        <section key={date} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase text-slate-500">{new Date(`${date}T00:00:00`).toLocaleDateString()}</h3>
          <div className="grid gap-3 xl:grid-cols-2">
            {rows.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onEdit={onEdit}
                onCancel={onCancel}
                onReschedule={onReschedule}
                onConfirm={onConfirm}
                onArrive={onArrive}
                onWaitingRoom={onWaitingRoom}
                onStart={onStart}
                onComplete={onComplete}
                onNoShow={onNoShow}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function slotRange(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatWeekDay(date: Date) {
  const weekday = date.toLocaleDateString("es-MX", { weekday: "long" });
  return `${capitalize(weekday)} ${date.getDate()}`;
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const end = weekEnd.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${start} al ${end}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildTimeSlots(startHour: number, endHour: number, stepMinutes: number) {
  const slots: string[] = [];
  for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    slots.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
  }
  return slots;
}

function getWeekAppointmentPlacement(appointment: Appointment) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const timelineStart = WEEK_START_HOUR * 60;
  const timelineEnd = WEEK_END_HOUR * 60;
  const startMinutes = Math.max(timelineStart, start.getHours() * 60 + start.getMinutes());
  const endMinutes = Math.min(timelineEnd + WEEK_SLOT_MINUTES, end.getHours() * 60 + end.getMinutes());
  const top = ((startMinutes - timelineStart) / WEEK_SLOT_MINUTES) * WEEK_SLOT_HEIGHT + 2;
  const height = Math.max(28, ((endMinutes - startMinutes) / WEEK_SLOT_MINUTES) * WEEK_SLOT_HEIGHT - 4);

  return { top, height };
}
