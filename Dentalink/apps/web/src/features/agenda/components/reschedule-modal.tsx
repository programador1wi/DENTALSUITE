import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { useSpecialties } from "@/features/settings/specialties/hooks/use-specialties";
import { specialtyMatchesSelection } from "@/features/settings/specialties/utils/allowed-specialties";
import { getAvailability, type Appointment, type RescheduleAppointmentPayload } from "../services/appointments.service";

type FormState = {
  branchId: string;
  specialtyId: string;
  professionalId: string;
  chairId: string;
  durationMinutes: string;
};

type SelectedSlot = {
  startAt: string;
  endAt: string;
};

export function RescheduleModal({
  appointment,
  branches,
  professionals,
  chairs,
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  branches: Branch[];
  professionals: Professional[];
  chairs: Chair[];
  onClose: () => void;
  onConfirm: (id: string, payload: RescheduleAppointmentPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    branchId: "",
    specialtyId: "",
    professionalId: "",
    chairId: "",
    durationMinutes: "30"
  });
  const [weekStart, setWeekStart] = useState(() => getWeekStartDateInput(toDateInputValue(new Date())));
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"schedule" | "reason">("schedule");
  const [submitting, setSubmitting] = useState(false);

  const specialties = useSpecialties(undefined, "true");

  useEffect(() => {
    if (!appointment) return;
    const duration = appointment.durationMinutes || diffMinutes(appointment.startAt, appointment.endAt) || 30;
    setForm({
      branchId: appointment.branchId,
      specialtyId: appointment.specialtyId ?? "",
      professionalId: appointment.professionalId,
      chairId: appointment.chairId ?? "",
      durationMinutes: String(duration)
    });
    setWeekStart(getWeekStartDateInput(appointment.startAt.slice(0, 10)));
    setSelectedSlot(null);
    setReason("");
    setStep("schedule");
  }, [appointment]);

  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === form.branchId), [branches, form.branchId]);
  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === form.professionalId),
    [professionals, form.professionalId]
  );
  const selectedSpecialty = useMemo(
    () => (specialties.data ?? []).find((specialty) => specialty.id === form.specialtyId) ?? appointment?.specialty ?? null,
    [appointment?.specialty, form.specialtyId, specialties.data]
  );
  const selectedProfessionalBranch = useMemo(
    () => selectedProfessional?.branches?.find((branch) => branch.id === form.branchId && isBranchAssignmentActiveAt(branch, selectedSlot?.startAt ?? `${weekStart}T00:00:00`)) ?? null,
    [form.branchId, selectedProfessional, selectedSlot?.startAt, weekStart]
  );
  const intervalMinutes = selectedProfessionalBranch?.agendaSlotMinutes ?? selectedBranch?.agendaSlotMinutes ?? 20;
  const defaultDuration = selectedProfessionalBranch?.defaultAppointmentDurationMinutes ?? intervalMinutes;

  const durationOptions = useMemo(() => {
    const values = new Set([Number(form.durationMinutes), defaultDuration, intervalMinutes, 20, 30, 40, 60]);
    return Array.from(values).filter((value) => Number.isFinite(value) && value >= 5).sort((a, b) => a - b);
  }, [defaultDuration, form.durationMinutes, intervalMinutes]);

  const filteredProfessionals = useMemo(
    () =>
      professionals.filter((professional) => {
        const inBranch = professional.branches.some((branch) => branch.id === form.branchId && isBranchAssignmentActiveAt(branch, selectedSlot?.startAt ?? `${weekStart}T00:00:00`));
        const matchesSpecialty =
          !form.specialtyId ||
          professional.specialties.some((specialty) => specialtyMatchesSelection(specialty, form.specialtyId, selectedSpecialty));
        return inBranch && matchesSpecialty;
      }),
    [form.branchId, form.specialtyId, professionals, selectedSlot?.startAt, selectedSpecialty, weekStart]
  );
  const filteredChairs = useMemo(() => chairs.filter((chair) => chair.branchId === form.branchId), [chairs, form.branchId]);
  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const selectedProfessionalIsAvailable = filteredProfessionals.some((professional) => professional.id === form.professionalId);

  const availability = useQuery({
    queryKey: ["appointments", "reschedule-availability-week", appointment?.id, form.branchId, form.professionalId, form.chairId, form.durationMinutes, weekStart],
    queryFn: async () => {
      const rows = await Promise.all(
        days.map(async (day) => {
          const availabilityForDay = await getAvailability({
            branchId: form.branchId,
            professionalId: form.professionalId,
            chairId: form.chairId || undefined,
            date: day.date,
            durationMinutes: form.durationMinutes || String(defaultDuration),
            excludeAppointmentId: appointment?.id
          });
          return {
            day,
            slots: availabilityForDay.slots.filter((slot) => slot.available)
          };
        })
      );
      return rows;
    },
    enabled: Boolean(appointment && form.branchId && form.professionalId && selectedProfessionalIsAvailable && form.durationMinutes)
  });

  const canContinue = Boolean(selectedSlot);
  const canSubmit = Boolean(appointment && selectedSlot && reason.trim());

  const handleSpecialtyChange = (specialtyId: string) => {
    setSelectedSlot(null);
    setForm((prev) => ({
      ...prev,
      specialtyId,
      professionalId: "",
      chairId: ""
    }));
  };

  const handleProfessionalChange = (professionalId: string) => {
    setSelectedSlot(null);
    setForm((prev) => ({
      ...prev,
      professionalId,
      chairId: ""
    }));
  };

  const handleChairChange = (chairId: string) => {
    setSelectedSlot(null);
    setForm((prev) => ({ ...prev, chairId }));
  };

  const handleDurationChange = (durationMinutes: string) => {
    setSelectedSlot(null);
    setForm((prev) => ({ ...prev, durationMinutes }));
  };

  const confirm = async () => {
    if (!appointment || !selectedSlot) return;
    setSubmitting(true);
    try {
      await onConfirm(appointment.id, {
        branchId: form.branchId,
        professionalId: form.professionalId,
        chairId: form.chairId || undefined,
        specialtyId: form.specialtyId || undefined,
        startAt: new Date(selectedSlot.startAt).toISOString(),
        endAt: new Date(selectedSlot.endAt).toISOString(),
        durationMinutes: diffMinutes(selectedSlot.startAt, selectedSlot.endAt) ?? Number(form.durationMinutes),
        reason: reason.trim()
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title="Cambiar fecha" onClose={onClose} size="2xl">
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Reagendar</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">{appointment?.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "Cita"}</h3>
                <p className="mt-1 text-xs text-slate-500">{appointment ? `${formatDateTime(appointment.startAt)} - ${formatTime(appointment.endAt)}` : ""}</p>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-3">
              <FieldLabel label="Sucursal">
                <Select value={form.branchId} disabled>
                  {!selectedBranch && appointment?.branch ? (
                    <option value={appointment.branchId}>{appointment.branch.name}</option>
                  ) : null}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Especialidad">
                <Select value={form.specialtyId} onChange={(event) => handleSpecialtyChange(event.target.value)}>
                  <option value="">Todas</option>
                  {(specialties.data ?? []).map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Profesional">
                <Select value={form.professionalId} onChange={(event) => handleProfessionalChange(event.target.value)}>
                  <option value="">Seleccionar doctor</option>
                  {filteredProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Recurso / box">
                <Select value={form.chairId} onChange={(event) => handleChairChange(event.target.value)}>
                  <option value="">Sin recurso específico</option>
                  {filteredChairs.map((chair) => (
                    <option key={chair.id} value={chair.id}>{chair.name}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Duración">
                <Select value={form.durationMinutes} onChange={(event) => handleDurationChange(event.target.value)}>
                  {durationOptions.map((duration) => (
                    <option key={duration} value={duration}>{duration} minutos</option>
                  ))}
                </Select>
              </FieldLabel>
            </div>
          </aside>

          <main className="min-w-0 p-5">
            {step === "schedule" ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Horarios libres</p>
                    <h4 className="text-lg font-semibold text-slate-950">{formatWeekRange(days)}</h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setWeekStart(shiftDate(weekStart, -7))} type="button">
                      <ChevronLeft className="h-4 w-4" />
                      Semana anterior
                    </Button>
                    <Input
                      className="w-[148px]"
                      type="date"
                      value={weekStart}
                      onChange={(event) => {
                        if (event.target.value) setWeekStart(getWeekStartDateInput(event.target.value));
                      }}
                    />
                    <Button variant="secondary" size="sm" onClick={() => setWeekStart(shiftDate(weekStart, 7))} type="button">
                      Semana siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="grid min-w-[760px] grid-cols-7 gap-2">
                    {days.map((day) => {
                      const dayAvailability = availability.data?.find((item) => item.day.date === day.date);
                      return (
                        <section key={day.date} className="min-h-[390px] rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className={`border-b border-slate-100 px-2 py-3 ${day.isToday ? "bg-cyan-50" : ""}`}>
                            <p className="text-center text-[11px] font-bold uppercase text-slate-500">{day.weekday}</p>
                            <p className="text-center text-lg font-semibold text-slate-950">{day.day}</p>
                            <p className="text-center text-xs text-slate-500">{day.month}</p>
                          </div>
                          <div className="max-h-[310px] space-y-1.5 overflow-y-auto p-2">
                            {!form.professionalId || !selectedProfessionalIsAvailable ? (
                              <EmptyColumn icon={<Stethoscope className="h-4 w-4" />} text="Elige doctor" />
                            ) : availability.isLoading ? (
                              <EmptyColumn icon={<Clock3 className="h-4 w-4 animate-pulse" />} text="Buscando" />
                            ) : availability.isError ? (
                              <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Error" />
                            ) : !dayAvailability?.slots.length ? (
                              <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Sin horario" />
                            ) : (
                              dayAvailability.slots.map((slot) => {
                                const selected = selectedSlot?.startAt === slot.startAt;
                                return (
                                  <button
                                    key={slot.startAt}
                                    type="button"
                                    onClick={() => setSelectedSlot({ startAt: slot.startAt, endAt: slot.endAt })}
                                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                                      selected
                                        ? "bg-slate-950 text-white shadow-md"
                                        : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                                    }`}
                                  >
                                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                                    {formatTime(slot.startAt)}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">{selectedSlot ? formatSelectedSlot(selectedSlot) : "0 horas seleccionadas"}</p>
                      <p>Selecciona un horario libre para continuar con el motivo.</p>
                    </div>
                  </div>
                  <Button onClick={() => setStep("reason")} disabled={!canContinue} type="button">
                    Continuar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                    Nuevo horario: <span className="font-semibold">{selectedSlot ? formatSelectedSlot(selectedSlot) : ""}</span>
                  </div>
                  <FieldLabel label="Motivo de reagendado">
                    <Textarea rows={4} placeholder="Escribe el motivo del cambio de fecha" value={reason} onChange={(event) => setReason(event.target.value)} />
                  </FieldLabel>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => setStep("schedule")} type="button">Regresar</Button>
                  <Button onClick={() => void confirm()} disabled={!canSubmit || submitting} type="button">
                    {submitting ? "Reagendando..." : "Confirmar reagendado"}
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </Modal>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function EmptyColumn({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 text-xs font-semibold text-slate-400">
      {icon}
      {text}
    </div>
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStartDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  const weekDay = date.getDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  date.setDate(date.getDate() + diff);
  return toDateInputValue(date);
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function buildWeekDays(weekStart: string) {
  const today = toDateInputValue(new Date());
  const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(weekStart, index);
    const [year, month, day] = date.split("-").map(Number);
    return {
      date,
      weekday: weekdays[index],
      day: String(day),
      month: months[month - 1],
      isToday: date === today,
      label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`
    };
  });
}

function formatWeekRange(days: ReturnType<typeof buildWeekDays>) {
  if (!days.length) return "";
  return `${days[0].label} - ${days[days.length - 1].label}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSelectedSlot(slot: SelectedSlot) {
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);
  const date = start.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
  return `${date}, ${formatTime(start.toISOString())} - ${formatTime(end.toISOString())}`;
}

function diffMinutes(startAt: string, endAt: string) {
  return Math.max(5, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

function isBranchAssignmentActiveAt(
  branch: {
    status?: "ACTIVE" | "PAUSED" | "ENDED";
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
  },
  value?: string
) {
  if (branch.status && branch.status !== "ACTIVE") return false;
  if (!value) return true;
  const date = new Date(value);
  const startsAt = branch.startsAt ? new Date(branch.startsAt) : null;
  const endsAt = branch.endsAt ? new Date(branch.endsAt) : null;
  if (startsAt && startsAt > date) return false;
  if (endsAt && endsAt <= date) return false;
  return true;
}
