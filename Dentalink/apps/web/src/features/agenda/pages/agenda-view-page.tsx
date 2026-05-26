import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { AppointmentModal } from "../components/appointment-modal";
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
  useCreateAppointment,
  useUpdateAppointment
} from "../hooks/use-appointments";
import type { Appointment, AppointmentPayload } from "../services/appointments.service";

export function AgendaViewPage({ view }: { view: "day" | "week" | "month" | "list" }) {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const [professionalId, setProfessionalId] = useState("");
  const [chairId, setChairId] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [initialAppointmentValues, setInitialAppointmentValues] = useState<Partial<AppointmentPayload> | null>(null);
  const [canceling, setCanceling] = useState<Appointment | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const branches = useBranches(undefined, "ACTIVE");

  const assignedBranches = useMemo(
    () => branches.data?.filter((branch) => user?.branchIds?.includes(branch.id)) ?? [],
    [branches.data, user?.branchIds]
  );

  const professionals = useProfessionals(undefined, "true");
  const chairs = useChairs(undefined, "true");
  const patients = usePatients({});

  const visibleProfessionals = useMemo(
    () => (professionals.data ?? []).filter((professional) => !activeBranchId || professional.branches.some((branch) => branch.id === activeBranchId)),
    [activeBranchId, professionals.data]
  );
  const visibleChairs = useMemo(
    () => (chairs.data ?? []).filter((chair) => !activeBranchId || chair.branchId === activeBranchId),
    [activeBranchId, chairs.data]
  );
  const appointmentsView = view === "list" ? "day" : view;
  const appointments = useAppointments({ date, view: appointmentsView, branchId: activeBranchId || undefined, professionalId: professionalId || undefined, chairId: chairId || undefined, status: status || undefined });
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const actions = useAppointmentActions();

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
    if (editing) await updateAppointment.mutateAsync({ id: editing.id, payload });
    else await createAppointment.mutateAsync(payload);
  };

  if (appointments.isLoading) return <LoadingState message="Cargando agenda..." />;
  if (appointments.isError) return <ErrorState message={appointments.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Agenda clinica" description="Operacion diaria, semanal y mensual de citas." />

      <AgendaToolbar 
        view={view} 
        totalAppointments={appointments.data?.length ?? 0}
        onCreateClick={() => openCreate()} 
        onGoToday={() => setDate(toDateInputValue(new Date()))}
        onPrint={() => window.print()}
        onEmail={() => {
          window.location.href = `mailto:?subject=${encodeURIComponent(`Agenda ${date}`)}&body=${encodeURIComponent(`Agenda de citas para ${date}. Total: ${appointments.data?.length ?? 0}`)}`;
        }}
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="flex items-center gap-1.5 w-full">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="flex-1" />
            <HelpTooltip content="Permite cambiar la fecha de visualización de la agenda para consultar citas pasadas, presentes o futuras en tiempo real." />
          </div>
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
          <Button onClick={() => openCreate()}>Nueva cita</Button>
        </div>

        {/* Color status legend */}
        <div className="border-t border-zinc-100 mt-1 -mx-1">
          <StatusLegend />
        </div>
      </Card>

      {/* Lista diaria (Dentalink style) */}
      {view === "list" ? (
        <AgendaDailyList
          appointments={appointments.data ?? []}
          date={date}
          onDateChange={setDate}
          onCreateClick={() => openCreate()}
          onEdit={openEdit}
          onCancel={setCanceling}
          onReschedule={setRescheduling}
          onConfirm={(id) => void actions.confirm.mutate(id)}
          onArrive={(id) => void actions.arrive.mutate(id)}
          onWaitingRoom={(id) => void actions.waitingRoom.mutate(id)}
          onStart={(id) => void actions.start.mutate(id)}
          onComplete={(id) => void actions.complete.mutate(id)}
          onNoShow={(id) => void actions.noShow.mutate(id)}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <CalendarView
            appointments={appointments.data ?? []}
            date={date}
            view={view}
            professionals={visibleProfessionals}
            selectedProfessionalId={professionalId}
            selectedBranchId={activeBranchId}
            onCreateClick={() => openCreate()}
            onCreateSlotClick={(slot) => openCreate(slot)}
            onEdit={openEdit}
            onCancel={setCanceling}
            onReschedule={setRescheduling}
            onConfirm={(id) => void actions.confirm.mutate(id)}
            onArrive={(id) => void actions.arrive.mutate(id)}
            onWaitingRoom={(id) => void actions.waitingRoom.mutate(id)}
            onStart={(id) => void actions.start.mutate(id)}
            onComplete={(id) => void actions.complete.mutate(id)}
            onNoShow={(id) => void actions.noShow.mutate(id)}
          />
          <AvailabilityPicker
            branchId={activeBranchId}
            professionalId={professionalId}
            chairId={chairId || undefined}
            date={date}
            durationMinutes="30"
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
      )}

      <AppointmentModal
        open={modalOpen}
        appointment={editing}
        initialValues={initialAppointmentValues}
        branches={branches.data ?? []}
        professionals={professionals.data ?? []}
        chairs={chairs.data ?? []}
        patients={patients.data ?? []}
        onClose={closeAppointmentModal}
        onSubmit={submitAppointment}
      />
      <CancelAppointmentModal
        appointment={canceling}
        onClose={() => setCanceling(null)}
        onConfirm={async (id, reason) => {
          await actions.cancel.mutateAsync({ id, reason });
        }}
      />
      <RescheduleModal
        appointment={rescheduling}
        onClose={() => setRescheduling(null)}
        onConfirm={async (id, startAt, endAt, reason) => {
          await actions.reschedule.mutateAsync({ id, startAt, endAt, reason });
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
