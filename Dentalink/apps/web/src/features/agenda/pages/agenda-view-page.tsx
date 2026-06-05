import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useCreatePatient, usePatient, usePatients } from "@/features/patients/hooks/use-patients";
import type { PatientListItem } from "@/features/patients/services/patients.service";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useSchedules } from "@/features/settings/schedules/hooks/use-schedules";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { RotateCcw } from "lucide-react";
import { AppointmentModal } from "../components/appointment-modal";
import {
  AppointmentCommentModal,
  AppointmentDurationModal,
  AppointmentEmailModal,
  AppointmentHistoryModal,
  AppointmentStatusModal,
  type AppointmentEmailMode
} from "../components/appointment-action-modals";
import { AvailabilityPicker } from "../components/availability-picker";
import { CalendarView } from "../components/calendar-view";
import { AgendaDailyList } from "../components/agenda-daily-list";
import { CancelAppointmentModal } from "../components/cancel-appointment-modal";
import { ChairFilter, BranchFilter, ProfessionalFilter } from "../components/filters";
import { RescheduleModal } from "../components/reschedule-modal";
import { StatusLegend } from "../components/status-legend";
import { AgendaToolbar } from "../components/agenda-toolbar";
import {
  useAppointmentActions,
  useAppointments,
  useAddAppointmentNote,
  useCreateAppointmentReminder,
  useUpdateAppointmentReminder,
  useCreateAppointment,
  useUpdateAppointment
} from "../hooks/use-appointments";
import type { Appointment, AppointmentPayload, AppointmentReminderPayload, AppointmentStatus } from "../services/appointments.service";
import type { AppointmentMenuAction } from "../components/appointment-actions-menu";
import { resolveAgendaViewConfig } from "../utils/agenda-grid-config";

export function AgendaViewPage({ view }: { view: "day" | "week" | "month" | "list" }) {
  const [searchParams] = useSearchParams();
  const prefillPatientId = searchParams.get("patientId") ?? "";
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const [professionalId, setProfessionalId] = useState("");
  const [chairId, setChairId] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [initialAppointmentValues, setInitialAppointmentValues] = useState<Partial<AppointmentPayload> | null>(null);
  const [openedPrefillPatientId, setOpenedPrefillPatientId] = useState("");
  const [canceling, setCanceling] = useState<{ appointment: Appointment; cancelledBy?: "patient" | "clinic" } | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [durationEditing, setDurationEditing] = useState<Appointment | null>(null);
  const [commenting, setCommenting] = useState<Appointment | null>(null);
  const [statusChanging, setStatusChanging] = useState<Appointment | null>(null);
  const [historyViewing, setHistoryViewing] = useState<Appointment | null>(null);
  const [emailAction, setEmailAction] = useState<{ appointment: Appointment; mode: AppointmentEmailMode } | null>(null);

  const branches = useBranches(undefined, "ACTIVE");

  const assignedBranches = useMemo(
    () => branches.data?.filter((branch) => user?.branchIds?.includes(branch.id)) ?? [],
    [branches.data, user?.branchIds]
  );

  const activeBranch = useMemo(
    () => (assignedBranches ?? []).find((branch) => branch.id === activeBranchId) ?? null,
    [assignedBranches, activeBranchId]
  );

  const professionals = useProfessionals(undefined, "true", {
    branchId: activeBranchId || undefined,
    pageSize: 100
  });
  const chairs = useChairs(undefined, "true");
  const patients = usePatients({});
  const prefillPatient = usePatient(prefillPatientId);

  const selectedProfessional = useMemo(
    () => (professionals.data ?? []).find((p) => p.id === professionalId) ?? null,
    [professionals.data, professionalId]
  );

  const selectedProfessionalBranch = useMemo(
    () => selectedProfessional?.branches?.find((b) => b.id === activeBranchId && isBranchAssignmentActiveOn(b, date)) ?? null,
    [selectedProfessional, activeBranchId, date]
  );

  const visibleProfessionals = useMemo(
    () =>
      (professionals.data ?? []).filter(
        (professional) =>
          !activeBranchId ||
          professional.branches.some((branch) => branch.id === activeBranchId && isBranchAssignmentActiveOn(branch, date))
      ),
    [activeBranchId, date, professionals.data]
  );
  const { agendaSlotMinutes, defaultAppointmentDurationMinutes, agendaStartHour, agendaEndHour } = useMemo(
    () =>
      resolveAgendaViewConfig({
        activeBranch,
        activeBranchId,
        selectedProfessionalBranch,
        visibleProfessionals
      }),
    [activeBranch, activeBranchId, selectedProfessionalBranch, visibleProfessionals]
  );
  const visibleChairs = useMemo(
    () => (chairs.data ?? []).filter((chair) => !activeBranchId || chair.branchId === activeBranchId),
    [activeBranchId, chairs.data]
  );
  const appointmentsView = view === "list" ? "day" : view;
  const appointmentsDate = view === "week" ? getWeekStartDateInput(date) : date;
  const appointments = useAppointments({ date: appointmentsDate, view: appointmentsView, branchId: activeBranchId || undefined, professionalId: professionalId || undefined, chairId: chairId || undefined, status: status || undefined });
  const schedules = useSchedules({
    branchId: activeBranchId || undefined,
    professionalId: professionalId || undefined,
    dayOfWeek: view === "day" ? String(getDayOfWeek(date)) : undefined,
    active: "true"
  });
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const createPatient = useCreatePatient();
  const addAppointmentNote = useAddAppointmentNote();
  const createAppointmentReminder = useCreateAppointmentReminder();
  const updateAppointmentReminder = useUpdateAppointmentReminder();
  const actions = useAppointmentActions();
  const hasActiveFilters = Boolean(professionalId || chairId || status);
  const patientsForModal = useMemo<PatientListItem[]>(() => {
    const rows = patients.data ?? [];
    const patient = prefillPatient.data;
    if (!patient || rows.some((row) => row.id === patient.id)) return rows;

    return [
      {
        id: patient.id,
        branchId: patient.branchId,
        branchName: patient.branch?.name,
        firstName: patient.firstName,
        lastName: patient.lastName,
        documentNumber: patient.documentNumber,
        email: patient.email,
        phone: patient.phone,
        status: patient.status,
        createdAt: new Date().toISOString(),
        hasDebt: (patient.summary?.balance ?? 0) > 0,
        hasFutureAppointment: Boolean(patient.summary?.nextAppointment),
        isNew: false,
        hasCriticalAlert: patient.summary?.hasCriticalAlert ?? false
      },
      ...rows
    ];
  }, [patients.data, prefillPatient.data]);

  useEffect(() => {
    if (!assignedBranches.length) return;
    const hasBranchAccess = assignedBranches.some((branch) => branch.id === activeBranchId);
    if (!activeBranchId || !hasBranchAccess) {
      setActiveBranchId(assignedBranches[0].id);
    }
  }, [activeBranchId, assignedBranches, setActiveBranchId]);

  useEffect(() => {
    if (!professionalId) return;
    const professionalVisible = visibleProfessionals.some((professional) => professional.id === professionalId);
    if (!professionalVisible) setProfessionalId("");
  }, [professionalId, visibleProfessionals]);

  useEffect(() => {
    if (!chairId) return;
    const chairVisible = visibleChairs.some((chair) => chair.id === chairId);
    if (!chairVisible) setChairId("");
  }, [chairId, visibleChairs]);

  useEffect(() => {
    const patient = prefillPatient.data;
    if (!prefillPatientId || !patient || openedPrefillPatientId === prefillPatientId) return;

    setEditing(null);
    setActiveBranchId(patient.branchId);
    setInitialAppointmentValues({
      branchId: patient.branchId,
      patientId: patient.id,
      title: `Cita - ${patient.firstName} ${patient.lastName}`,
      status: "SCHEDULED"
    });
    setModalOpen(true);
    setOpenedPrefillPatientId(prefillPatientId);
  }, [openedPrefillPatientId, prefillPatient.data, prefillPatientId, setActiveBranchId]);

  const openCreate = (defaults?: Partial<AppointmentPayload>) => {
    setEditing(null);
    setInitialAppointmentValues({
      ...defaults,
      branchId: defaults?.branchId ?? (activeBranchId || assignedBranches[0]?.id || ""),
      status: defaults?.status ?? "SCHEDULED"
    });
    setModalOpen(true);
  };

  const openEdit = (appointment: Appointment) => {
    setEditing(appointment);
    setInitialAppointmentValues(null);
    setModalOpen(true);
  };

  const closeAppointmentModal = () => {
    setModalOpen(false);
    setInitialAppointmentValues(null);
  };

  const submitAppointment = async (payload: AppointmentPayload) => {
    const saved = editing
      ? await updateAppointment.mutateAsync({ id: editing.id, payload })
      : await createAppointment.mutateAsync(payload);

    focusSavedAppointment(saved);
  };

  const focusSavedAppointment = (appointment: Appointment) => {
    setActiveBranchId(appointment.branchId);
    setDate(toDateInputValue(new Date(appointment.startAt)));
    if (professionalId && professionalId !== appointment.professionalId) setProfessionalId("");
    if (chairId && chairId !== (appointment.chairId ?? "")) setChairId("");
    if (status && status !== appointment.status) setStatus("");
  };

  const clearFilters = () => {
    setProfessionalId("");
    setChairId("");
    setStatus("");
  };

  const handleAppointmentMenuAction = (appointment: Appointment, action: AppointmentMenuAction) => {
    switch (action) {
      case "requestDataEmail":
        setEmailAction({ appointment, mode: "dataRequest" });
        break;
      case "modifyDuration":
        setDurationEditing(appointment);
        break;
      case "addComment":
        setCommenting(appointment);
        break;
      case "changeDate":
        setRescheduling(appointment);
        break;
      case "changeStatus":
        setStatusChanging(appointment);
        break;
      case "notifyEmail":
        setEmailAction({ appointment, mode: "notification" });
        break;
      case "viewHistory":
        setHistoryViewing(appointment);
        break;
      case "cancel":
        openCancelAppointment(appointment, "clinic");
        break;
    }
  };

  const openCancelAppointment = (appointment: Appointment, cancelledBy: "patient" | "clinic" = "clinic") => {
    setCanceling({ appointment, cancelledBy });
  };

  const updateAppointmentFromAction = async (id: string, payload: Partial<AppointmentPayload>) => {
    await updateAppointment.mutateAsync({ id, payload });
  };

  const changeAppointmentStatus = async (id: string, nextStatus: AppointmentStatus) => {
    switch (nextStatus) {
      case "CONFIRMED":
        await actions.confirm.mutateAsync(id);
        break;
      case "ARRIVED":
        await actions.arrive.mutateAsync(id);
        break;
      case "WAITING_ROOM":
        await actions.waitingRoom.mutateAsync(id);
        break;
      case "IN_PROGRESS":
        await actions.start.mutateAsync(id);
        break;
      case "COMPLETED":
        await actions.complete.mutateAsync(id);
        break;
      case "NO_SHOW":
        await actions.noShow.mutateAsync(id);
        break;
      default:
        await updateAppointment.mutateAsync({ id, payload: { status: nextStatus } });
        break;
    }
  };

  if (appointments.isLoading || (view !== "list" && schedules.isLoading)) return <LoadingState message="Cargando agenda..." />;
  if (appointments.isError) return <ErrorState message={appointments.error.message} />;
  if (schedules.isError) return <ErrorState message={schedules.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Agenda clínica" description="Operación diaria, semanal y mensual de citas." />

      <AgendaToolbar 
        view={view} 
        date={date}
        totalAppointments={appointments.data?.length ?? 0}
        onDateChange={setDate}
        onGoToday={() => setDate(toDateInputValue(new Date()))}
        onPrint={() => window.print()}
        onEmail={() => {
          window.location.href = `mailto:?subject=${encodeURIComponent(`Agenda ${date}`)}&body=${encodeURIComponent(`Agenda de citas para ${date}. Total: ${appointments.data?.length ?? 0}`)}`;
        }}
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="flex items-center gap-1.5 w-full">
            <BranchFilter value={activeBranchId} branches={assignedBranches} onChange={setActiveBranchId} />
            <HelpTooltip content="Filtra la agenda para mostrar las citas y sillones exclusivos de esta sucursal. Los clínicos solo pueden alternar entre sus sucursales asignadas." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <ProfessionalFilter value={professionalId} professionals={visibleProfessionals} onChange={setProfessionalId} />
            <HelpTooltip content="Muestra únicamente la columna y los horarios del odontólogo seleccionado. Déjalo vacío para ver la agenda de todos los doctores en paralelo." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <ChairFilter value={chairId} chairs={visibleChairs} onChange={setChairId} />
            <HelpTooltip content="Permite filtrar las citas por el sillón de atención asignado (ej. Sillón General o Quirófano) para organizar el espacio físico." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="PENDING_CONFIRMATION">Por confirmar</option>
              <option value="ARRIVED">Llegó a clínica</option>
              <option value="WAITING_ROOM">Sala de espera</option>
              <option value="IN_PROGRESS">En atención</option>
              <option value="COMPLETED">Atendida</option>
              <option value="RESCHEDULED">Reagendada</option>
              <option value="NO_SHOW">No asistió</option>
              <option value="CANCELLED_BY_PATIENT">Cancelada por paciente</option>
              <option value="CANCELLED_BY_CLINIC">Cancelada por clínica</option>
              <option value="BLOCKED">Bloqueada</option>
            </Select>
            <HelpTooltip content="Filtra las citas según su estado actual en el flujo clínico: desde Agendada hasta Atendida, pasando por todos los estados intermedios." />
          </div>
          <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters} className="w-full">
            <RotateCcw className="h-4 w-4" />
            Limpiar filtros
          </Button>
          <Button onClick={() => openCreate()}>Nueva cita</Button>
        </div>

        {/* Color status legend */}
        <div className="border-t border-[var(--border-default)] mt-1 -mx-1">
          <StatusLegend />
        </div>
      </Card>

      {/* Lista diaria */}
      {view === "list" ? (
        <AgendaDailyList
          appointments={appointments.data ?? []}
          date={date}
          onDateChange={setDate}
          onCreateClick={() => openCreate()}
          onEdit={openEdit}
          onCancel={openCancelAppointment}
          onReschedule={setRescheduling}
          onChangeStatus={(appointment, nextStatus) => void changeAppointmentStatus(appointment.id, nextStatus)}
          onConfirm={(id) => void actions.confirm.mutate(id)}
          onArrive={(id) => void actions.arrive.mutate(id)}
          onWaitingRoom={(id) => void actions.waitingRoom.mutate(id)}
          onStart={(id) => void actions.start.mutate(id)}
          onComplete={(id) => void actions.complete.mutate(id)}
          onNoShow={(id) => void actions.noShow.mutate(id)}
          onMenuAction={handleAppointmentMenuAction}
        />
      ) : view === "day" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <CalendarView
            appointments={appointments.data ?? []}
            date={date}
            view={view}
            professionals={visibleProfessionals}
            selectedProfessionalId={professionalId}
            selectedBranchId={activeBranchId}
            daySlotMinutes={agendaSlotMinutes}
            dayStartHour={agendaStartHour}
            dayEndHour={agendaEndHour}
            schedules={schedules.data ?? []}
            onSelectProfessional={setProfessionalId}
            onCreateClick={() => openCreate()}
            onCreateSlotClick={(slot) => openCreate(slot)}
            onEdit={openEdit}
            onCancel={openCancelAppointment}
            onReschedule={setRescheduling}
            onChangeStatus={(appointment, nextStatus) => void changeAppointmentStatus(appointment.id, nextStatus)}
            onConfirm={(id) => void actions.confirm.mutate(id)}
            onArrive={(id) => void actions.arrive.mutate(id)}
            onWaitingRoom={(id) => void actions.waitingRoom.mutate(id)}
            onStart={(id) => void actions.start.mutate(id)}
            onComplete={(id) => void actions.complete.mutate(id)}
            onNoShow={(id) => void actions.noShow.mutate(id)}
            onMenuAction={handleAppointmentMenuAction}
          />
          <AvailabilityPicker
            branchId={activeBranchId}
            professionalId={professionalId}
            chairId={chairId || undefined}
            date={date}
            durationMinutes={String(defaultAppointmentDurationMinutes)}
            onSelectSlot={(slot) =>
              openCreate({
                branchId: activeBranchId,
                professionalId,
                chairId: chairId || undefined,
                startAt: slot.startAt,
                endAt: slot.endAt
              })
            }
          />
        </div>
      ) : (
        <CalendarView
          appointments={appointments.data ?? []}
          date={date}
          view={view}
          professionals={visibleProfessionals}
          selectedProfessionalId={professionalId}
          selectedBranchId={activeBranchId}
          daySlotMinutes={agendaSlotMinutes}
          dayStartHour={agendaStartHour}
          dayEndHour={agendaEndHour}
          schedules={schedules.data ?? []}
          onSelectProfessional={setProfessionalId}
          onCreateClick={() => openCreate()}
          onCreateSlotClick={(slot) => openCreate(slot)}
          onEdit={openEdit}
          onCancel={openCancelAppointment}
          onReschedule={setRescheduling}
          onChangeStatus={(appointment, nextStatus) => void changeAppointmentStatus(appointment.id, nextStatus)}
          onConfirm={(id) => void actions.confirm.mutate(id)}
          onArrive={(id) => void actions.arrive.mutate(id)}
          onWaitingRoom={(id) => void actions.waitingRoom.mutate(id)}
          onStart={(id) => void actions.start.mutate(id)}
          onComplete={(id) => void actions.complete.mutate(id)}
          onNoShow={(id) => void actions.noShow.mutate(id)}
          onMenuAction={handleAppointmentMenuAction}
        />
      )}

      <AppointmentModal
        open={modalOpen}
        appointment={editing}
        initialValues={initialAppointmentValues}
        defaultDate={date}
        branches={branches.data ?? []}
        professionals={professionals.data ?? []}
        chairs={chairs.data ?? []}
        patients={patientsForModal}
        onClose={closeAppointmentModal}
        onSubmit={submitAppointment}
        onCreatePatient={async (payload) => (await createPatient.mutateAsync(payload)).patient}
      />
      <CancelAppointmentModal
        appointment={canceling?.appointment ?? null}
        cancelledBy={canceling?.cancelledBy ?? "clinic"}
        onClose={() => setCanceling(null)}
        onConfirm={async (id, reason) => {
          await actions.cancel.mutateAsync({ id, reason, cancelledBy: canceling?.cancelledBy ?? "clinic" });
        }}
      />
      <RescheduleModal
        appointment={rescheduling}
        branches={branches.data ?? []}
        professionals={professionals.data ?? []}
        chairs={chairs.data ?? []}
        onClose={() => setRescheduling(null)}
        onConfirm={async (id, payload) => {
          await actions.reschedule.mutateAsync({ id, payload });
        }}
      />
      <AppointmentDurationModal
        appointment={durationEditing}
        onClose={() => setDurationEditing(null)}
        onConfirm={updateAppointmentFromAction}
      />
      <AppointmentCommentModal
        appointment={commenting}
        onClose={() => setCommenting(null)}
        onConfirm={async (id, note, isPrivate) => {
          await addAppointmentNote.mutateAsync({ id, payload: { note, isPrivate } });
        }}
      />
      <AppointmentStatusModal
        appointment={statusChanging}
        onClose={() => setStatusChanging(null)}
        onConfirm={changeAppointmentStatus}
      />
      <AppointmentEmailModal
        appointment={emailAction?.appointment ?? null}
        mode={emailAction?.mode ?? "notification"}
        onClose={() => setEmailAction(null)}
        onScheduleReminder={async (id: string, payload: AppointmentReminderPayload) => {
          await createAppointmentReminder.mutateAsync({ id, payload });
        }}
      />
      <AppointmentHistoryModal
        appointment={historyViewing}
        onClose={() => setHistoryViewing(null)}
        onUpdateReminderStatus={async (id, reminderId, reminderStatus) => {
          await updateAppointmentReminder.mutateAsync({
            id,
            reminderId,
            payload: { status: reminderStatus }
          });
        }}
      />
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

function getDayOfWeek(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).getDay();
}

function isBranchAssignmentActiveOn(
  branch: {
    status?: "ACTIVE" | "PAUSED" | "ENDED";
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
  },
  date: string
) {
  if (branch.status && branch.status !== "ACTIVE") return false;
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  const startsAt = branch.startsAt ? new Date(branch.startsAt) : null;
  const endsAt = branch.endsAt ? new Date(branch.endsAt) : null;

  if (startsAt && startsAt > dayEnd) return false;
  if (endsAt && endsAt <= dayStart) return false;
  return true;
}
