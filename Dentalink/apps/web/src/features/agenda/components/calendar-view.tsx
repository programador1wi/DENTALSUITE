import { EmptyState } from "@/components/feedback/empty-state";
import type { Appointment } from "../services/appointments.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";

import { AppointmentCard } from "./appointment-card";

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00"
];

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
  if (!appointments.length && view !== "day") {
    return <EmptyState title="Sin citas" description="No hay citas para los filtros seleccionados." />;
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
