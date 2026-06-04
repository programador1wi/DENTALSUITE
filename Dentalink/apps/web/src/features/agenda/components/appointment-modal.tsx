import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Mail,
  Phone,
  Search,
  Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  PatientDetail,
  PatientListItem,
  PatientPayload
} from "@/features/patients/services/patients.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import {
  useSpecialties,
  useSpecialtyAppointmentReasons
} from "@/features/settings/specialties/hooks/use-specialties";
import { specialtyMatchesSelection } from "@/features/settings/specialties/utils/allowed-specialties";
import {
  getAvailability,
  listAppointmentReasonSuggestions,
  type Appointment,
  type AppointmentPayload,
  type AppointmentReasonSuggestion,
  type AppointmentStatus
} from "../services/appointments.service";

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

type NewPatientState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentNumber: string;
  type: string;
  comment: string;
};

type SelectedSlot = {
  startAt: string;
  endAt: string;
};

type DayAvailability = {
  day: ReturnType<typeof buildWeekDays>[number];
  slots: Array<{ startAt: string; endAt: string; available: boolean }>;
  error?: string;
};

type Step = "schedule" | "reason" | "patient";
type PatientMode = "existing" | "new";
type ReasonOption = {
  id: string;
  name: string;
  durationMinutes: number;
  color?: string | null;
  isActive: boolean;
};

const MAX_REASON_DURATION_MINUTES = 60;

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

const defaultNewPatient: NewPatientState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentNumber: "",
  type: "",
  comment: ""
};

export function AppointmentModal({
  open,
  appointment,
  initialValues,
  defaultDate,
  branches,
  professionals,
  chairs,
  patients,
  onClose,
  onSubmit,
  onCreatePatient
}: {
  open: boolean;
  appointment?: Appointment | null;
  initialValues?: Partial<AppointmentPayload> | null;
  defaultDate?: string;
  branches: Branch[];
  professionals: Professional[];
  chairs: Chair[];
  patients: PatientListItem[];
  onClose: () => void;
  onSubmit: (payload: AppointmentPayload) => Promise<void>;
  onCreatePatient: (payload: PatientPayload) => Promise<PatientDetail>;
}) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [weekStart, setWeekStart] = useState(() => getWeekStartDateInput(toDateInputValue(new Date())));
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [step, setStep] = useState<Step>("reason");
  const [patientMode, setPatientMode] = useState<PatientMode>("existing");
  const [patientSearch, setPatientSearch] = useState("");
  const [reasonSearch, setReasonSearch] = useState("");
  const [newPatient, setNewPatient] = useState<NewPatientState>(defaultNewPatient);
  const [submitting, setSubmitting] = useState(false);

  const specialties = useSpecialties(undefined, "true");
  const reasons = useSpecialtyAppointmentReasons(form.specialtyId);
  const historicalReasons = useQuery({
    queryKey: ["appointments", "reason-suggestions", form.specialtyId],
    queryFn: () => listAppointmentReasonSuggestions({ specialtyId: form.specialtyId }),
    enabled: Boolean(open && form.specialtyId)
  });

  useEffect(() => {
    if (!open) return;
    const nextForm = appointment ? toFormFromAppointment(appointment) : toFormDefaults(initialValues);
    const initialDate = nextForm.startAt ? nextForm.startAt.slice(0, 10) : defaultDate || toDateInputValue(new Date());
    setForm(nextForm);
    setSelectedSlot(
      nextForm.startAt && nextForm.endAt
        ? { startAt: new Date(nextForm.startAt).toISOString(), endAt: new Date(nextForm.endAt).toISOString() }
        : null
    );
    setWeekStart(getWeekStartDateInput(initialDate));
    setStep("reason");
    setPatientMode("existing");
    setPatientSearch("");
    setReasonSearch(nextForm.reason);
    setNewPatient(defaultNewPatient);
  }, [appointment, defaultDate, initialValues, open]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === form.branchId),
    [branches, form.branchId]
  );
  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === form.professionalId),
    [professionals, form.professionalId]
  );
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === form.patientId),
    [patients, form.patientId]
  );
  const selectedSpecialty = useMemo(
    () =>
      (specialties.data ?? []).find((specialty) => specialty.id === form.specialtyId) ??
      appointment?.specialty ??
      null,
    [appointment?.specialty, form.specialtyId, specialties.data]
  );
  const selectedProfessionalBranch = useMemo(
    () =>
      selectedProfessional?.branches?.find(
        (branch) =>
          branch.id === form.branchId &&
          isBranchAssignmentActiveAt(branch, selectedSlot?.startAt ?? form.startAt)
      ) ?? null,
    [selectedProfessional, form.branchId, form.startAt, selectedSlot?.startAt]
  );
  const appointmentIntervalMinutes =
    selectedProfessionalBranch?.agendaSlotMinutes ?? selectedBranch?.agendaSlotMinutes ?? 30;
  const fallbackDuration =
    selectedProfessionalBranch?.defaultAppointmentDurationMinutes ?? appointmentIntervalMinutes;
  const selectedDuration = Number(form.durationMinutes);
  const durationAvailabilityError =
    form.professionalId &&
    Number.isInteger(selectedDuration) &&
    selectedDuration > 0 &&
    selectedDuration % appointmentIntervalMinutes !== 0
      ? `La duracion de ${selectedDuration} min no calza con intervalos de ${appointmentIntervalMinutes} min para este doctor.`
      : "";

  useEffect(() => {
    if (!open) return;
    if (form.durationMinutes) return;
    setForm((prev) => ({ ...prev, durationMinutes: String(fallbackDuration) }));
  }, [fallbackDuration, form.durationMinutes, open]);

  const filteredChairs = useMemo(
    () => chairs.filter((chair) => !form.branchId || chair.branchId === form.branchId),
    [chairs, form.branchId]
  );
  const filteredPatients = useMemo(
    () => patients.filter((patient) => !form.branchId || patient.branchId === form.branchId),
    [patients, form.branchId]
  );
  const filteredProfessionals = useMemo(
    () =>
      professionals.filter((professional) => {
        const isInBranch =
          !form.branchId ||
          professional.branches.some(
            (branch) =>
              branch.id === form.branchId &&
              isBranchAssignmentActiveAt(branch, selectedSlot?.startAt ?? form.startAt)
          );
        const matchesSpecialty =
          !form.specialtyId ||
          professional.specialties.some((specialty) =>
            specialtyMatchesSelection(specialty, form.specialtyId, selectedSpecialty)
          );
        return isInBranch && matchesSpecialty;
      }),
    [form.branchId, form.specialtyId, form.startAt, professionals, selectedSlot?.startAt, selectedSpecialty]
  );

  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const selectedProfessionalIsAvailable = filteredProfessionals.some(
    (professional) => professional.id === form.professionalId
  );
  const availability = useQuery({
    queryKey: [
      "appointments",
      "availability-week",
      form.branchId,
      form.professionalId,
      form.chairId,
      form.durationMinutes,
      weekStart
    ],
    queryFn: async () => {
      const rows = await Promise.all(
        days.map(async (day): Promise<DayAvailability> => {
          const professionalBranchForDay = selectedProfessional?.branches.find(
            (branch) =>
              branch.id === form.branchId &&
              isBranchAssignmentActiveAt(branch, `${day.date}T00:00:00`)
          );
          if (!professionalBranchForDay) {
            return {
              day,
              slots: [],
              error: "Doctor no activo en esta fecha"
            };
          }

          try {
            return {
              day,
              slots: (
                await getAvailability({
                  branchId: form.branchId,
                  professionalId: form.professionalId,
                  chairId: form.chairId || undefined,
                  date: day.date,
                  durationMinutes: form.durationMinutes || String(fallbackDuration)
                })
              ).slots
            };
          } catch (error) {
            return {
              day,
              slots: [],
              error: error instanceof Error ? error.message : "No se pudo consultar disponibilidad"
            };
          }
        })
      );
      return rows;
    },
    enabled: Boolean(
      open &&
        form.branchId &&
        form.professionalId &&
        selectedProfessionalIsAvailable &&
        form.durationMinutes &&
        !durationAvailabilityError
    )
  });

  const activeReasons = useMemo(
    () =>
      mergeReasonOptions(
        (reasons.data ?? []).filter((reason) => reason.isActive),
        historicalReasons.data ?? []
      ).filter((reason) => reason.durationMinutes <= MAX_REASON_DURATION_MINUTES),
    [historicalReasons.data, reasons.data]
  );
  const selectedReason = useMemo(
    () => activeReasons.find((reason) => reason.name === form.reason),
    [activeReasons, form.reason]
  );
  const requiresPatient = form.status !== "BLOCKED";
  const canContinueReason = Boolean(form.branchId && form.specialtyId && selectedReason);
  const canContinueSchedule = Boolean(
    canContinueReason && form.professionalId && selectedProfessionalIsAvailable && selectedSlot
  );
  const canSubmitPatient =
    canContinueSchedule &&
    (!requiresPatient ||
      (patientMode === "existing" && Boolean(form.patientId)) ||
      (patientMode === "new" &&
        newPatient.firstName.trim().length >= 2 &&
        newPatient.lastName.trim().length >= 2));

  const searchedPatients = useMemo(() => {
    const query = normalizeSearch(patientSearch);
    if (!query) return filteredPatients.slice(0, 10);
    return filteredPatients
      .filter((patient) =>
        normalizeSearch(
          `${patient.firstName} ${patient.lastName} ${patient.documentNumber ?? ""} ${patient.phone ?? ""} ${patient.email ?? ""}`
        ).includes(query)
      )
      .slice(0, 12);
  }, [filteredPatients, patientSearch]);

  const handleProfessionalChange = (professionalId: string) => {
    const professional = professionals.find((item) => item.id === professionalId);
    const branchAssignment = professional?.branches.find(
      (branch) => branch.id === form.branchId && isBranchAssignmentActiveAt(branch, form.startAt)
    );
    const nextSpecialtyId = resolveProfessionalSpecialtyId(professional, form.specialtyId, selectedSpecialty);
    const nextChairId = resolveChairIdForBranch(filteredChairs, form.chairId);
    const currentDuration = Number(form.durationMinutes);
    const nextDuration =
      selectedReason?.durationMinutes ??
      (Number.isFinite(currentDuration) && currentDuration > 0 ? currentDuration : undefined) ??
      branchAssignment?.defaultAppointmentDurationMinutes ??
      branchAssignment?.agendaSlotMinutes ??
      selectedBranch?.agendaSlotMinutes ??
      30;

    if (nextSpecialtyId !== form.specialtyId) setReasonSearch("");
    setSelectedSlot(null);
    setForm((prev) => ({
      ...prev,
      professionalId,
      specialtyId: nextSpecialtyId,
      chairId: nextChairId,
      durationMinutes: String(nextDuration),
      reason: nextSpecialtyId === prev.specialtyId ? prev.reason : "",
      startAt: "",
      endAt: ""
    }));
  };

  const submit = async () => {
    const startAt = selectedSlot?.startAt ?? form.startAt;
    const endAt = selectedSlot?.endAt ?? form.endAt;
    if (!startAt || !endAt || !canSubmitPatient) return;

    setSubmitting(true);
    try {
      let patientId = form.patientId || undefined;
      let patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "";

      if (requiresPatient && patientMode === "new") {
        const created = await onCreatePatient({
          branchId: form.branchId,
          firstName: newPatient.firstName.trim(),
          lastName: newPatient.lastName.trim(),
          email: newPatient.email.trim() || undefined,
          phone: newPatient.phone.trim() || undefined,
          documentNumber: newPatient.documentNumber.trim() || undefined,
          source: newPatient.type || undefined,
          status: "NEW"
        });
        patientId = created.id;
        patientName = `${created.firstName} ${created.lastName}`;
      }

      const notes = patientMode === "new" ? newPatient.comment.trim() : form.notes.trim();

      await onSubmit({
        branchId: form.branchId,
        patientId: requiresPatient ? patientId : undefined,
        professionalId: form.professionalId,
        chairId: form.chairId || undefined,
        specialtyId: form.specialtyId || undefined,
        title: appointment
          ? form.title || buildAppointmentTitle(patientName, form.reason)
          : buildAppointmentTitle(patientName, form.reason),
        reason: form.reason || undefined,
        ...(appointment ? { status: form.status } : {}),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        durationMinutes: diffMinutes(startAt, endAt) ?? Number(form.durationMinutes),
        notes: notes || undefined
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

  const handleReasonSelect = (reason: ReasonOption) => {
    const nextDuration = String(reason.durationMinutes);
    const durationChanged = form.durationMinutes !== nextDuration;

    if (durationChanged) {
      setSelectedSlot(null);
    }

    setReasonSearch(reason.name);
    setForm((prev) => ({
      ...prev,
      reason: reason.name,
      title: "",
      durationMinutes: nextDuration,
      startAt: durationChanged ? "" : prev.startAt,
      endAt: durationChanged ? "" : prev.endAt
    }));
  };

  const handleReasonSearchChange = (value: string) => {
    setReasonSearch(value);
    if (value !== form.reason) {
      setForm((prev) => ({ ...prev, reason: "", title: "" }));
    }
  };

  const closeOrStepBack = () => {
    if (step === "patient") {
      setStep("schedule");
      return;
    }
    if (step === "schedule") {
      setStep("reason");
      return;
    }
    onClose();
  };

  return (
    <Modal open={open} title={appointment ? "Editar cita" : "Dar cita"} onClose={onClose} size="2xl">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid min-h-[620px] gap-0 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Nueva atencion</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Agenda inteligente</h3>
              </div>
              <div className="rounded-md bg-cyan-50 p-3 text-cyan-700">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>

            <div className="mb-5 rounded-md border border-cyan-100 bg-white px-3 py-2 text-sm text-slate-700">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Sucursal activa
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {selectedBranch?.name ?? "Sin sucursal seleccionada"}
              </p>
            </div>

            <StepRail step={step} />

            <div className="mt-5 grid gap-3">
              <FieldLabel label="Especialidad">
                <Select
                  value={form.specialtyId}
                  onChange={(event) => {
                    setSelectedSlot(null);
                    setReasonSearch("");
                    setForm((prev) => ({
                      ...prev,
                      specialtyId: event.target.value,
                      professionalId: "",
                      reason: "",
                      startAt: "",
                      endAt: ""
                    }));
                  }}
                  disabled={step !== "reason"}
                >
                  <option value="">Todas las especialidades</option>
                  {(specialties.data ?? []).map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Doctor">
                <Select
                  value={form.professionalId}
                  onChange={(event) => handleProfessionalChange(event.target.value)}
                  disabled={!canContinueReason || step !== "schedule"}
                >
                  <option value="">Seleccionar doctor</option>
                  {filteredProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.firstName} {professional.lastName}
                    </option>
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
                  disabled={!canContinueReason || step !== "schedule"}
                >
                  <option value="">Sin recurso especifico</option>
                  {filteredChairs.map((chair) => (
                    <option key={chair.id} value={chair.id}>
                      {chair.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Duracion del motivo">
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                  {selectedReason ? `${selectedReason.durationMinutes} minutos` : "Selecciona motivo"}
                </div>
              </FieldLabel>
            </div>
          </aside>

          <main className="min-w-0 p-5">
            {step === "reason" ? (
              <ReasonStep
                activeReasons={activeReasons}
                form={form}
                loadingReasons={reasons.isLoading || historicalReasons.isLoading}
                reasonSearch={reasonSearch}
                selectedReasonId={selectedReason?.id ?? ""}
                selectedSlot={selectedSlot}
                selectedSpecialtyName={selectedSpecialty?.name ?? ""}
                onBack={closeOrStepBack}
                onContinue={() => setStep("schedule")}
                onReasonSearchChange={handleReasonSearchChange}
                onReasonSelect={handleReasonSelect}
              />
            ) : step === "schedule" ? (
              <ScheduleStep
                availability={availability}
                availabilityError={durationAvailabilityError}
                canContinue={canContinueSchedule}
                days={days}
                form={form}
                selectedProfessionalIsAvailable={selectedProfessionalIsAvailable}
                selectedSlot={selectedSlot}
                weekStart={weekStart}
                onContinue={() => setStep("patient")}
                onSelectSlot={handleSlotSelect}
                onWeekChange={setWeekStart}
              />
            ) : (
              <PatientStep
                canSubmit={canSubmitPatient}
                filteredPatients={searchedPatients}
                form={form}
                mode={patientMode}
                newPatient={newPatient}
                patientSearch={patientSearch}
                requiresPatient={requiresPatient}
                selectedBranchName={selectedBranch?.name ?? ""}
                selectedPatient={selectedPatient}
                selectedProfessional={selectedProfessional}
                selectedSlot={selectedSlot}
                submitting={submitting}
                onBack={closeOrStepBack}
                onFormChange={setForm}
                onModeChange={setPatientMode}
                onNewPatientChange={setNewPatient}
                onPatientSearchChange={setPatientSearch}
                onSubmit={() => void submit()}
              />
            )}
          </main>
        </div>
      </div>
    </Modal>
  );
}

function StepRail({ step }: { step: Step }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: "reason", label: "Motivo" },
    { id: "schedule", label: "Horario" },
    { id: "patient", label: "Paciente" }
  ];
  const currentIndex = steps.findIndex((item) => item.id === step);

  return (
    <div className="grid gap-2">
      {steps.map((item, index) => {
        const active = item.id === step;
        const complete = index < currentIndex;
        return (
          <div
            key={item.id}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${active ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-600"}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${complete || active ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="font-semibold">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleStep({
  availability,
  availabilityError,
  canContinue,
  days,
  form,
  selectedProfessionalIsAvailable,
  selectedSlot,
  weekStart,
  onContinue,
  onSelectSlot,
  onWeekChange
}: {
  availability: ReturnType<typeof useQuery<DayAvailability[]>>;
  availabilityError?: string;
  canContinue: boolean;
  days: ReturnType<typeof buildWeekDays>;
  form: FormState;
  selectedProfessionalIsAvailable: boolean;
  selectedSlot: SelectedSlot | null;
  weekStart: string;
  onContinue: () => void;
  onSelectSlot: (slot: SelectedSlot) => void;
  onWeekChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Horarios libres</p>
          <h4 className="text-lg font-semibold text-slate-950">{formatWeekRange(days)}</h4>
          <p className="text-xs text-slate-500">Duracion requerida: {form.durationMinutes} minutos</p>
          {availabilityError ? <p className="mt-1 text-xs font-semibold text-red-600">{availabilityError}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onWeekChange(shiftDate(weekStart, -7))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
            Semana anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onWeekChange(shiftDate(weekStart, 7))}
            type="button"
          >
            Semana siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {days.map((day) => {
          const dayAvailability = availability.data?.find((item) => item.day.date === day.date);
          return (
            <section key={day.date} className="min-h-[360px] rounded-md border border-slate-200 bg-white">
              <div className={`border-b border-slate-100 px-3 py-3 ${day.isToday ? "bg-cyan-50" : ""}`}>
                <p className="text-center text-xs font-bold uppercase text-slate-500">{day.weekday}</p>
                <p className="text-center text-lg font-semibold text-slate-950">{day.day}</p>
                <p className="text-center text-xs text-slate-500">{day.month}</p>
              </div>
              <div className="max-h-[290px] space-y-1.5 overflow-y-auto p-2">
                {availabilityError ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Duracion invalida" />
                ) : !form.branchId || !form.professionalId || !selectedProfessionalIsAvailable ? (
                  <EmptyColumn icon={<Stethoscope className="h-4 w-4" />} text="Elige doctor" />
                ) : availability.isLoading ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4 animate-pulse" />} text="Buscando" />
                ) : dayAvailability?.error ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="No activo" />
                ) : !dayAvailability?.slots.some((slot) => slot.available) ? (
                  <EmptyColumn icon={<Clock3 className="h-4 w-4" />} text="Sin horario" />
                ) : (
                  dayAvailability.slots
                    .filter((slot) => slot.available)
                    .map((slot) => {
                      const selected = selectedSlot?.startAt === slot.startAt;
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => onSelectSlot({ startAt: slot.startAt, endAt: slot.endAt })}
                          className={`flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold transition ${
                            selected
                              ? "bg-slate-950 text-white shadow-sm"
                              : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                          }`}
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                          {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                        </button>
                      );
                    })
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="rounded-md bg-slate-100 p-2 text-slate-700">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-950">
              {selectedSlot ? formatSelectedSlot(selectedSlot) : "0 horas seleccionadas"}
            </p>
            <p>Selecciona un horario libre para continuar con el paciente.</p>
          </div>
        </div>
        <Button onClick={onContinue} disabled={!canContinue} type="button">
          Continuar
        </Button>
      </div>
    </div>
  );
}

function ReasonStep({
  activeReasons,
  form,
  loadingReasons,
  reasonSearch,
  selectedReasonId,
  selectedSlot,
  selectedSpecialtyName,
  onBack,
  onContinue,
  onReasonSearchChange,
  onReasonSelect
}: {
  activeReasons: ReasonOption[];
  form: FormState;
  loadingReasons: boolean;
  reasonSearch: string;
  selectedReasonId: string;
  selectedSlot: SelectedSlot | null;
  selectedSpecialtyName: string;
  onBack: () => void;
  onContinue: () => void;
  onReasonSearchChange: (value: string) => void;
  onReasonSelect: (reason: ReasonOption) => void;
}) {
  const normalizedSearch = normalizeReasonKey(reasonSearch);
  const filteredReasons = normalizedSearch
    ? activeReasons.filter((reason) =>
        normalizeReasonKey(`${reason.name} ${reason.durationMinutes}`).includes(normalizedSearch)
      )
    : activeReasons;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-50 p-3 text-emerald-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Motivo / tratamiento
              </p>
              <h4 className="text-xl font-semibold text-slate-950">
                {selectedSpecialtyName || "Especialidad del doctor"}
              </h4>
            </div>
          </div>
          <div className="hidden rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-right text-sm text-cyan-900 sm:block">
            {selectedSlot ? formatSelectedSlot(selectedSlot) : "Horario pendiente"}
          </div>
        </div>

        <FieldLabel label="Motivo">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="relative border-b border-slate-100 p-3">
              <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar motivo existente"
                value={reasonSearch}
                onChange={(event) => onReasonSearchChange(event.target.value)}
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto p-2">
              {loadingReasons ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Cargando motivos de esta especialidad...
                </div>
              ) : !activeReasons.length ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay motivos disponibles para esta especialidad.
                </div>
              ) : filteredReasons.length ? (
                <div className="grid gap-1">
                  {filteredReasons.map((reason) => {
                    const selected = selectedReasonId === reason.id;
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => onReasonSelect(reason)}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                          selected
                            ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-950"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{reason.name}</span>
                          <span className="block text-xs text-slate-500">
                            {reason.durationMinutes} min sugeridos
                          </span>
                        </span>
                        {selected ? <Check className="h-4 w-4 shrink-0 text-emerald-700" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay coincidencias.
                </div>
              )}
            </div>
          </div>
        </FieldLabel>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBack} type="button">
          Regresar
        </Button>
        <Button onClick={onContinue} disabled={!selectedReasonId || !form.reason.trim()} type="button">
          Continuar a horario
        </Button>
      </div>
    </div>
  );
}

function PatientStep({
  canSubmit,
  filteredPatients,
  form,
  mode,
  newPatient,
  patientSearch,
  requiresPatient,
  selectedBranchName,
  selectedPatient,
  selectedProfessional,
  selectedSlot,
  submitting,
  onBack,
  onFormChange,
  onModeChange,
  onNewPatientChange,
  onPatientSearchChange,
  onSubmit
}: {
  canSubmit: boolean;
  filteredPatients: PatientListItem[];
  form: FormState;
  mode: PatientMode;
  newPatient: NewPatientState;
  patientSearch: string;
  requiresPatient: boolean;
  selectedBranchName: string;
  selectedPatient?: PatientListItem;
  selectedProfessional?: Professional;
  selectedSlot: SelectedSlot | null;
  submitting: boolean;
  onBack: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<FormState>>;
  onModeChange: (mode: PatientMode) => void;
  onNewPatientChange: React.Dispatch<React.SetStateAction<NewPatientState>>;
  onPatientSearchChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <p className="font-semibold">Cita seleccionada</p>
        <p className="mt-1">
          {selectedSlot ? formatSelectedSlot(selectedSlot) : "Horario pendiente"}
          {selectedProfessional
            ? ` con ${selectedProfessional.firstName} ${selectedProfessional.lastName}`
            : ""}
          {selectedBranchName ? ` en ${selectedBranchName}` : ""}
        </p>
        <p className="mt-1 text-emerald-800">Motivo: {form.reason}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <button
            type="button"
            className={`mb-2 flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left text-sm font-semibold ${mode === "existing" ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-700"}`}
            onClick={() => onModeChange("existing")}
          >
            <span
              className={`h-3 w-3 rounded-full border ${mode === "existing" ? "border-cyan-700 bg-cyan-700" : "border-slate-300"}`}
            />
            Paciente existente
          </button>
          <button
            type="button"
            className={`flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left text-sm font-semibold ${mode === "new" ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-700"}`}
            onClick={() => onModeChange("new")}
          >
            <span
              className={`h-3 w-3 rounded-full border ${mode === "new" ? "border-cyan-700 bg-cyan-700" : "border-slate-300"}`}
            />
            Paciente nuevo
          </button>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5">
          {!requiresPatient ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Esta cita esta marcada como bloqueo. Puedes guardar sin paciente.
            </div>
          ) : mode === "existing" ? (
            <div className="grid gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre, documento, telefono o correo"
                  value={patientSearch}
                  onChange={(event) => onPatientSearchChange(event.target.value)}
                />
              </div>

              <div className="max-h-[290px] overflow-y-auto rounded-md border border-slate-200">
                {filteredPatients.length ? (
                  filteredPatients.map((patient) => {
                    const selected = patient.id === form.patientId;
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        className={`grid w-full gap-1 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 ${selected ? "bg-cyan-50" : "bg-white hover:bg-slate-50"}`}
                        onClick={() =>
                          onFormChange((prev) => ({
                            ...prev,
                            patientId: patient.id,
                            title: prev.title || `Cita - ${patient.firstName} ${patient.lastName}`
                          }))
                        }
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold uppercase text-slate-900">
                            {patient.firstName} {patient.lastName}
                          </span>
                          {selected ? <Check className="h-4 w-4 text-cyan-700" /> : null}
                        </span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {patient.phone || "Sin telefono"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {patient.email || "Sin correo"}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-sm text-slate-500">
                    No hay pacientes para la busqueda en esta sucursal.
                  </div>
                )}
              </div>

              {selectedPatient ? <PatientSummary patient={selectedPatient} /> : null}

              <FieldLabel label="Comentario">
                <Textarea
                  rows={3}
                  placeholder="Comentario para la cita"
                  value={form.notes}
                  onChange={(event) => onFormChange((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </FieldLabel>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldLabel label="Nombre legal">
                  <Input
                    value={newPatient.firstName}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Apellidos">
                  <Input
                    value={newPatient.lastName}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                  />
                </FieldLabel>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldLabel label="E-mail">
                  <Input
                    type="email"
                    value={newPatient.email}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Telefono movil">
                  <Input
                    placeholder="+52 12221234567"
                    value={newPatient.phone}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </FieldLabel>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldLabel label="Documento">
                  <Input
                    value={newPatient.documentNumber}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, documentNumber: event.target.value }))
                    }
                  />
                </FieldLabel>
                <FieldLabel label="Tipo">
                  <Select
                    value={newPatient.type}
                    onChange={(event) =>
                      onNewPatientChange((prev) => ({ ...prev, type: event.target.value }))
                    }
                  >
                    <option value="">Selecciona un tipo</option>
                    <option value="Primera vez">Primera vez</option>
                    <option value="Referido">Referido</option>
                    <option value="Urgencia">Urgencia</option>
                    <option value="Control">Control</option>
                  </Select>
                </FieldLabel>
              </div>

              <FieldLabel label="Comentario">
                <Textarea
                  rows={3}
                  placeholder="Comentario..."
                  value={newPatient.comment}
                  onChange={(event) =>
                    onNewPatientChange((prev) => ({ ...prev, comment: event.target.value }))
                  }
                />
              </FieldLabel>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {requiresPatient
            ? "Selecciona o crea el paciente antes de guardar."
            : "El bloqueo se guardara sin paciente."}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onBack} type="button">
            Regresar
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting} type="button">
            {submitting ? "Guardando..." : "Guardar cita"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PatientSummary({ patient }: { patient: PatientListItem }) {
  return (
    <div className="grid gap-3 rounded-md border border-cyan-100 bg-cyan-50 p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-bold text-cyan-700 shadow-sm">
        {patientInitials(patient)}
      </div>
      <div className="min-w-0">
        <p className="font-semibold uppercase text-slate-950">
          {patient.firstName} {patient.lastName}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>{patient.documentNumber || "Sin documento"}</span>
          <span>{patient.branchName || "Sucursal activa"}</span>
          <span>{patient.hasFutureAppointment ? "Tiene cita futura" : "Sin cita futura"}</span>
        </div>
      </div>
    </div>
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
    <div className="flex h-24 flex-col items-center justify-center gap-2 rounded-md bg-slate-50 text-xs font-semibold text-slate-400">
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
  const initialDuration = initialValues?.durationMinutes ?? (startAt && endAt ? diffMinutes(startAt, endAt) : undefined);
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
    durationMinutes: initialDuration ? String(initialDuration) : defaultForm.durationMinutes,
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

function buildAppointmentTitle(patientName?: string, reason?: string) {
  if (patientName && reason) return `${reason} - ${patientName}`;
  if (reason) return reason;
  if (patientName) return `Cita - ${patientName}`;
  return "Cita agendada";
}

function diffMinutes(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function resolveProfessionalSpecialtyId(
  professional: Professional | undefined,
  currentSpecialtyId: string,
  currentSpecialty: { id: string; name: string } | null
) {
  if (!professional) return "";
  if (
    currentSpecialtyId &&
    professional.specialties.some((specialty) =>
      specialtyMatchesSelection(specialty, currentSpecialtyId, currentSpecialty)
    )
  ) {
    return currentSpecialtyId;
  }
  return professional.specialties[0]?.id ?? "";
}

function resolveChairIdForBranch(chairs: Chair[], currentChairId: string) {
  if (currentChairId && chairs.some((chair) => chair.id === currentChairId)) return currentChairId;
  return chairs.length === 1 ? chairs[0].id : "";
}

function patientInitials(patient: PatientListItem) {
  const first = patient.firstName?.trim().charAt(0) ?? "";
  const last = patient.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "PX";
}

function mergeReasonOptions(
  configuredReasons: ReasonOption[],
  historicalReasons: AppointmentReasonSuggestion[]
) {
  const byName = new Map<string, ReasonOption>();

  for (const reason of configuredReasons) {
    if (!reason.isActive) continue;
    byName.set(normalizeReasonKey(reason.name), reason);
  }

  for (const reason of historicalReasons) {
    const key = normalizeReasonKey(reason.name);
    if (!reason.isActive || byName.has(key)) continue;
    byName.set(key, {
      id: reason.id,
      name: reason.name,
      durationMinutes: reason.durationMinutes,
      color: reason.color,
      isActive: reason.isActive
    });
  }

  return Array.from(byName.values());
}

function normalizeReasonKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
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
