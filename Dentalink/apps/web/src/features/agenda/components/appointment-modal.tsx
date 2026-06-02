import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Stethoscope, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PatientListItem } from "@/features/patients/services/patients.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { useSpecialties, useSpecialtyAppointmentReasons } from "@/features/settings/specialties/hooks/use-specialties";
import { getAvailability, type Appointment, type AppointmentPayload, type AppointmentStatus } from "../services/appointments.service";

type FormState = {
  branchId: string;
  specialtyId: string;
  patientId: string;
  professionalId: string;
  chairId: string;
  title: string;
  reason: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  durationMinutes: string;
  notes: string;
};

type SelectedSlot = {
  startAt: string;
  endAt: string;
};

const defaultForm: FormState = {
  branchId: "",
  specialtyId: "",
  patientId: "",
  professionalId: "",
  chairId: "",
  title: "",
  reason: "",
  status: "SCHEDULED",
  startAt: "",
  endAt: "",
  durationMinutes: "30",
  notes: ""
};

export function AppointmentModal({
  open,
  appointment,
  initialValues,
  branches,
  professionals,
  chairs,
  patients,
  onClose,
  onSubmit
}: {
  open: boolean;
  appointment?: Appointment | null;
  initialValues?: Partial<AppointmentPayload> | null;
  branches: Branch[];
  professionals: Professional[];
  chairs: Chair[];
  patients: PatientListItem[];
  onClose: () => void;
  onSubmit: (payload: AppointmentPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [weekStart, setWeekStart] = useState(() => getWeekStartDateInput(toDateInputValue(new Date())));
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [step, setStep] = useState<"schedule" | "reason">("schedule");
  const [submitting, setSubmitting] = useState(false);

  const specialties = useSpecialties(undefined, "true");
  const reasons = useSpecialtyAppointmentReasons(form.specialtyId);

  useEffect(() => {
    if (!open) return;
    const nextForm = appointment ? toFormFromAppointment(appointment) : toFormDefaults(initialValues);
    setForm(nextForm);
    setSelectedSlot(nextForm.startAt && nextForm.endAt ? { startAt: new Date(nextForm.startAt).toISOString(), endAt: new Date(nextForm.endAt).toISOString() } : null);
    setWeekStart(getWeekStartDateInput(nextForm.startAt ? nextForm.startAt.slice(0, 10) : toDateInputValue(new Date())));
    setStep("schedule");
  }, [appointment, initialValues, open]);

  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === form.branchId), [branches, form.branchId]);
  const selectedProfessional = useMemo(() => professionals.find((professional) => professional.id === form.professionalId), [professionals, form.professionalId]);
  const selectedPatient = useMemo(() => patients.find((patient) => patient.id === form.patientId), [patients, form.patientId]);
  const selectedProfessionalBranch = useMemo(
    () => selectedProfessional?.branches?.find((branch) => branch.id === form.branchId && isBranchAssignmentActiveAt(branch, selectedSlot?.startAt ?? form.startAt)) ?? null,
    [selectedProfessional, form.branchId, form.startAt, selectedSlot?.startAt]
  );
  const appointmentIntervalMinutes = selectedProfessionalBranch?.agendaSlotMinutes ?? selectedBranch?.agendaSlotMinutes ?? 30;
  const fallbackDuration = selectedProfessionalBranch?.defaultAppointmentDurationMinutes ?? appointmentIntervalMinutes;

  useEffect(() => {
    if (!open) return;
    if (form.durationMinutes) return;
    setForm((prev) => ({ ...prev, durationMinutes: String(fallbackDuration) }));
  }, [fallbackDuration, form.durationMinutes, open]);

  const filteredChairs = useMemo(() => chairs.filter((chair) => !form.branchId || chair.branchId === form.branchId), [chairs, form.branchId]);
  const filteredPatients = useMemo(() => patients.filter((patient) => !form.branchId || patient.branchId === form.branchId), [patients, form.branchId]);
  const filteredProfessionals = useMemo(
    () =>
      professionals.filter((professional) => {
        const isInBranch = !form.branchId || professional.branches.some((branch) => branch.id === form.branchId && isBranchAssignmentActiveAt(branch, selectedSlot?.startAt ?? form.startAt));
        const matchesSpecialty = !form.specialtyId || professional.specialties.some((specialty) => specialty.id === form.specialtyId);
        return isInBranch && matchesSpecialty;
      }),
    [form.branchId, form.specialtyId, form.startAt, professionals, selectedSlot?.startAt]
  );

  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const availability = useQuery({
    queryKey: ["appointments", "availability-week", form.branchId, form.professionalId, form.chairId, form.durationMinutes, weekStart],
    queryFn: async () => {
      const rows = await Promise.all(
        days.map(async (day) => ({
          day,
          slots: (await getAvailability({
            branchId: form.branchId,
            professionalId: form.professionalId,
            chairId: form.chairId || undefined,
            date: day.date,
            durationMinutes: form.durationMinutes || String(fallbackDuration)
          })).slots
        }))
      );
      return rows;
    },
    enabled: Boolean(open && form.branchId && form.professionalId && form.durationMinutes)
  });

  const durationOptions = useMemo(() => {
    const base = appointmentIntervalMinutes || 30;
    const values = new Set([base, base * 2, base * 3, fallbackDuration, Number(form.durationMinutes)]);
    for (const reason of reasons.data ?? []) values.add(reason.durationMinutes);
    return Array.from(values).filter((value) => Number.isFinite(value) && value >= 5).sort((a, b) => a - b);
  }, [appointmentIntervalMinutes, fallbackDuration, form.durationMinutes, reasons.data]);

  const canContinue = Boolean(form.branchId && form.specialtyId && form.professionalId && selectedSlot);
  const selectedReason = useMemo(() => (reasons.data ?? []).find((reason) => reason.name === form.reason), [form.reason, reasons.data]);

  const submit = async () => {
    const startAt = selectedSlot?.startAt ?? form.startAt;
    const endAt = selectedSlot?.endAt ?? form.endAt;
    if (!startAt || !endAt) return;

    setSubmitting(true);
    try {
      await onSubmit({
        branchId: form.branchId,
        patientId: form.status === "BLOCKED" ? undefined : form.patientId || undefined,
        professionalId: form.professionalId,
        chairId: form.chairId || undefined,
        specialtyId: form.specialtyId || undefined,
        title: form.title || buildAppointmentTitle(selectedPatient, form.reason),
        reason: form.reason || undefined,
        status: form.status,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        durationMinutes: diffMinutes(startAt, endAt) ?? Number(form.durationMinutes),
        notes: form.notes || undefined
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSlotSelect = (slot: SelectedSlot) => {
    setSelectedSlot(slot);
    setForm((prev) => ({
      ...prev,
      startAt: toLocalInput(slot.startAt),
      endAt: toLocalInput(slot.endAt)
    }));
  };

  const handleDurationChange = (value: string) => {
    setSelectedSlot(null);
    setForm((prev) => ({ ...prev, durationMinutes: value, startAt: "", endAt: "" }));
  };

  return (
    <Modal open={open} title={appointment ? "Editar cita" : "Dar cita"} onClose={onClose} size="2xl">
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60">
        <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-white/85 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Nueva atencion</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Agenda inteligente</h3>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-3">
              <FieldLabel label="Estado">
                <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as AppointmentStatus }))}>
                  <option value="SCHEDULED">Agendada</option>
                  <option value="PENDING_CONFIRMATION">Por confirmar</option>
                  <option value="BLOCKED">Bloqueo</option>
                </Select>
              </FieldLabel>

              <FieldLabel label="Sucursal">
                <Select
                  value={form.branchId}
                  onChange={(event) => {
                    setSelectedSlot(null);
                    setForm((prev) => ({ ...prev, branchId: event.target.value, specialtyId: "", professionalId: "", chairId: "", patientId: "", startAt: "", endAt: "" }));
                  }}
                >
                  <option value="">Seleccionar sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Especialidad">
                <Select
                  value={form.specialtyId}
                  onChange={(event) => {
                    setSelectedSlot(null);
                    setForm((prev) => ({ ...prev, specialtyId: event.target.value, professionalId: "", reason: "", startAt: "", endAt: "" }));
                  }}
                >
                  <option value="">Seleccionar especialidad</option>
                  {(specialties.data ?? []).map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Paciente">
                <Select value={form.patientId} disabled={form.status === "BLOCKED"} onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}>
                  <option value="">Seleccionar paciente</option>
                  {filteredPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Doctor">
                <Select
                  value={form.professionalId}
                  onChange={(event) => {
                    setSelectedSlot(null);
                    setForm((prev) => ({ ...prev, professionalId: event.target.value, startAt: "", endAt: "" }));
                  }}
                >
                  <option value="">Seleccionar doctor</option>
                  {filteredProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Recurso / box">
                <Select
                  value={form.chairId}
                  onChange={(event) => {
                    setSelectedSlot(null);
                    setForm((prev) => ({ ...prev, chairId: event.target.value, startAt: "", endAt: "" }));
                  }}
                >
                  <option value="">Sin recurso especifico</option>
                  {filteredChairs.map((chair) => (
                    <option key={chair.id} value={chair.id}>{chair.name}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Intervalo">
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
                <div className="flex flex-col gap-3 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Horarios libres</p>
                    <h4 className="text-lg font-semibold text-slate-950">{formatWeekRange(days)}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setWeekStart(shiftDate(weekStart, -7))} type="button">
                      <ChevronLeft className="h-4 w-4" />
                      Semana anterior
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setWeekStart(shiftDate(weekStart, 7))} type="button">
                      Semana siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                  {days.map((day) => {
                    const dayAvailability = availability.data?.find((item) => item.day.date === day.date);
                    return (
                      <section key={day.date} className="min-h-[360px] rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
                        <div className={`border-b border-slate-100 px-3 py-3 ${day.isToday ? "bg-cyan-50" : ""}`}>
                          <p className="text-center text-xs font-bold uppercase text-slate-500">{day.weekday}</p>
                          <p className="text-center text-lg font-semibold text-slate-950">{day.day}</p>
                          <p className="text-center text-xs text-slate-500">{day.month}</p>
                        </div>
                        <div className="max-h-[290px] space-y-1.5 overflow-y-auto p-2">
                          {!form.branchId || !form.professionalId ? (
                            <EmptyColumn icon={<Stethoscope className="h-4 w-4" />} text="Elige doctor" />
                          ) : availability.isLoading ? (
                            <EmptyColumn icon={<Clock3 className="h-4 w-4 animate-pulse" />} text="Buscando" />
                          ) : !dayAvailability?.slots.length ? (
                            <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Sin horario" />
                          ) : (
                            dayAvailability.slots.map((slot) => {
                              const selected = selectedSlot?.startAt === slot.startAt;
                              return (
                                <button
                                  key={slot.startAt}
                                  type="button"
                                  disabled={!slot.available}
                                  onClick={() => handleSlotSelect({ startAt: slot.startAt, endAt: slot.endAt })}
                                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                                    selected
                                      ? "bg-slate-950 text-white shadow-md"
                                      : slot.available
                                        ? "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                                        : "cursor-not-allowed bg-slate-50 text-slate-300"
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
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Motivo de atencion</p>
                      <h4 className="text-xl font-semibold text-slate-950">Completa los datos de la cita</h4>
                    </div>
                  </div>

                  <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                    Puedes escoger un motivo configurado para la especialidad o escribir uno manualmente.
                  </div>

                  <div className="grid gap-3">
                    <FieldLabel label="Motivo configurado">
                      <Select
                        value={selectedReason?.id ?? ""}
                        onChange={(event) => {
                          const reason = (reasons.data ?? []).find((item) => item.id === event.target.value);
                          if (!reason) return;
                          setForm((prev) => ({
                            ...prev,
                            reason: reason.name,
                            title: prev.title || reason.name,
                            durationMinutes: String(reason.durationMinutes)
                          }));
                        }}
                      >
                        <option value="">Seleccionar motivo</option>
                        {(reasons.data ?? []).map((reason) => (
                          <option key={reason.id} value={reason.id}>{reason.name} - {reason.durationMinutes} min</option>
                        ))}
                      </Select>
                    </FieldLabel>

                    <FieldLabel label="Motivo manual">
                      <Input placeholder="Ej. Control de ortodoncia, urgencia, valoracion..." value={form.reason} onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value, title: prev.title || event.target.value }))} />
                    </FieldLabel>

                    <FieldLabel label="Titulo interno">
                      <Input placeholder="Titulo de la cita" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
                    </FieldLabel>

                    <FieldLabel label="Notas">
                      <Textarea rows={4} placeholder="Notas visibles para recepcion o clinica" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    </FieldLabel>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => setStep("schedule")} type="button">Regresar</Button>
                  <Button variant="ghost" onClick={() => void submit()} disabled={submitting || !canContinue} type="button">Omitir motivo</Button>
                  <Button onClick={() => void submit()} disabled={submitting || !canContinue || !form.reason} type="button">
                    {submitting ? "Guardando..." : "Guardar cita"}
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

function toFormFromAppointment(appointment: Appointment): FormState {
  const duration = appointment.durationMinutes || diffMinutes(appointment.startAt, appointment.endAt) || 30;
  return {
    branchId: appointment.branchId,
    specialtyId: appointment.specialtyId ?? "",
    patientId: appointment.patientId ?? "",
    professionalId: appointment.professionalId,
    chairId: appointment.chairId ?? "",
    title: appointment.title,
    reason: appointment.reason ?? "",
    status: appointment.status,
    startAt: toLocalInput(appointment.startAt),
    endAt: toLocalInput(appointment.endAt),
    durationMinutes: String(duration),
    notes: appointment.notes ?? ""
  };
}

function toFormDefaults(initialValues?: Partial<AppointmentPayload> | null): FormState {
  const startAt = initialValues?.startAt ? toLocalInput(initialValues.startAt) : "";
  const endAt = initialValues?.endAt ? toLocalInput(initialValues.endAt) : "";
  return {
    ...defaultForm,
    branchId: initialValues?.branchId ?? "",
    specialtyId: initialValues?.specialtyId ?? "",
    patientId: initialValues?.patientId ?? "",
    professionalId: initialValues?.professionalId ?? "",
    chairId: initialValues?.chairId ?? "",
    title: initialValues?.title ?? "",
    reason: initialValues?.reason ?? "",
    status: initialValues?.status ?? "SCHEDULED",
    startAt,
    endAt,
    durationMinutes: initialValues?.durationMinutes ? String(initialValues.durationMinutes) : defaultForm.durationMinutes,
    notes: initialValues?.notes ?? ""
  };
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
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
  const weekdays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
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
      labelDate: new Date(year, month - 1, day)
    };
  });
}

function formatWeekRange(days: ReturnType<typeof buildWeekDays>) {
  const first = days[0]?.labelDate;
  const last = days[days.length - 1]?.labelDate;
  if (!first || !last) return "";
  return `${first.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} - ${last.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function formatSelectedSlot(slot: SelectedSlot) {
  const start = new Date(slot.startAt);
  return `${start.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "short" })}, ${formatTime(slot.startAt)} - ${formatTime(slot.endAt)}`;
}

function buildAppointmentTitle(patient?: PatientListItem, reason?: string) {
  if (reason) return reason;
  if (patient) return `Cita - ${patient.firstName} ${patient.lastName}`;
  return "Cita agendada";
}

function diffMinutes(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function isBranchAssignmentActiveAt(
  branch: {
    status?: "ACTIVE" | "PAUSED" | "ENDED";
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
  },
  localDateTime: string
) {
  if (branch.status && branch.status !== "ACTIVE") return false;
  if (!localDateTime) return true;
  const appointmentDate = new Date(localDateTime);
  const startsAt = branch.startsAt ? new Date(branch.startsAt) : null;
  const endsAt = branch.endsAt ? new Date(branch.endsAt) : null;

  if (startsAt && appointmentDate < startsAt) return false;
  if (endsAt && appointmentDate >= endsAt) return false;
  return true;
}
