import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { toast } from "sonner";
import {
  useCreateSchedule,
  useCreateScheduleBlock,
  useDeleteScheduleBlock,
  useFutureScheduleBlocks,
  useScheduleBlockConflicts,
  useSchedules,
  useUpdateSchedule,
  useUpdateProfessionalAgendaConfig
} from "../hooks/use-schedules";
import { AgendaIntervalModals } from "../components/agenda-interval-modals";
import { SpecialSchedulesSection } from "../components/special-schedules-section";
import type { Schedule, ScheduleBlockAppointment, SchedulePayload } from "../services/schedules.service";

type DayForm = {
  startTime: string;
  endTime: string;
  chairId: string;
  hasBreak: boolean;
  breakStartTime: string;
  breakEndTime: string;
  noAttend: boolean;
};

type BlockForm = {
  branchId: string;
  professionalId: string;
  chairId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes: string;
};

const days = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" }
];

const timeOptions = buildTimeOptions(10, 19, 60);
const fixedEndTimesByDay: Partial<Record<number, string>> = {
  1: "19:00",
  2: "19:00",
  3: "19:00",
  4: "19:00",
  5: "19:00",
  6: "15:00"
};

function defaultDayForm(dayOfWeek: number, chairId = ""): DayForm {
  const hasBreak = dayOfWeek !== 0 && dayOfWeek !== 6;

  if (dayOfWeek === 0) {
    return {
      startTime: "10:00",
      endTime: fixedEndTimesByDay[dayOfWeek] ?? "19:00",
      chairId,
      hasBreak: false,
      breakStartTime: "",
      breakEndTime: "",
      noAttend: true
    };
  }

  return {
    startTime: "10:00",
    endTime: fixedEndTimesByDay[dayOfWeek] ?? "19:00",
    chairId,
    hasBreak,
    breakStartTime: hasBreak ? "14:00" : "",
    breakEndTime: hasBreak ? "15:00" : "",
    noAttend: false
  };
}

function emptyWeeklyForm(chairId = "") {
  return Object.fromEntries(days.map((day) => [day.value, defaultDayForm(day.value, chairId)])) as Record<number, DayForm>;
}

function emptyBlockForm(branchId = "", professionalId = "", chairId = ""): BlockForm {
  return {
    branchId,
    professionalId,
    chairId,
    date: toDateInputValue(new Date()),
    startTime: "10:00",
    endTime: "11:00",
    reason: "Bloqueo programado",
    notes: ""
  };
}

function scheduleToDayForm(schedule: Schedule): DayForm {
  const hasBreak = schedule.dayOfWeek !== 6 && Boolean(schedule.breakStartTime && schedule.breakEndTime);

  return {
    startTime: schedule.startTime,
    endTime: fixedEndTimesByDay[schedule.dayOfWeek] ?? schedule.endTime,
    chairId: schedule.chairId ?? "",
    hasBreak,
    breakStartTime: hasBreak ? schedule.breakStartTime ?? "" : "",
    breakEndTime: hasBreak ? schedule.breakEndTime ?? "" : "",
    noAttend: !schedule.isActive
  };
}

function weeklyFormFromSchedules(schedules: Schedule[], chairId = "") {
  const form = emptyWeeklyForm(chairId);
  for (const schedule of schedulesByDayMap(schedules).values()) {
    form[schedule.dayOfWeek] = scheduleToDayForm(schedule);
  }
  return form;
}

function schedulesByDayMap(schedules: Schedule[]) {
  const map = new Map<number, Schedule>();
  for (const schedule of schedules) {
    const current = map.get(schedule.dayOfWeek);
    if (!current || (!current.isActive && schedule.isActive)) {
      map.set(schedule.dayOfWeek, schedule);
    }
  }
  return map;
}

export function SchedulesSettingsPage() {
  const [params, setParams] = useSearchParams();
  const selectedProfessionalId = params.get("professionalId") ?? "";
  const selectedBranchId = params.get("branchId") ?? "";
  const [weeklyForm, setWeeklyForm] = useState<Record<number, DayForm>>(emptyWeeklyForm());
  const [weeklyError, setWeeklyError] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockForm>(emptyBlockForm());
  const [intervalOpen, setIntervalOpen] = useState(false);
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const professionalBranchFilterId = selectedBranchId || (!selectedProfessionalId ? activeBranchId : "");

  const professionals = useProfessionals(undefined, "true", {
    branchId: professionalBranchFilterId || undefined,
    pageSize: 100
  });
  const branches = useBranches(undefined, "ACTIVE");
  const chairs = useChairs(undefined, "true", selectedBranchId || undefined);
  const schedules = useSchedules({
    professionalId: selectedProfessionalId || undefined,
    branchId: selectedBranchId || undefined,
    active: selectedProfessionalId && selectedBranchId ? undefined : "true"
  });
  const branchActiveSchedules = useSchedules(
    {
      branchId: selectedBranchId || undefined,
      active: "true"
    },
    Boolean(selectedBranchId)
  );
  const futureBlocks = useFutureScheduleBlocks({
    professionalId: selectedProfessionalId || undefined,
    branchId: selectedBranchId || undefined,
    start: startOfTodayIso()
  });
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const createBlock = useCreateScheduleBlock();
  const deleteBlock = useDeleteScheduleBlock();
  const updateAgendaConfig = useUpdateProfessionalAgendaConfig();

  const selectedProfessional = useMemo(
    () => professionals.data?.find((professional) => professional.id === selectedProfessionalId),
    [professionals.data, selectedProfessionalId]
  );
  const selectedProfessionalName = selectedProfessional
    ? `${selectedProfessional.firstName} ${selectedProfessional.lastName}`.trim()
    : "";
  const professionalBranches = useMemo(() => selectedProfessional?.branches ?? [], [selectedProfessional]);
  const branchOptions = useMemo(
    () => (selectedProfessional ? professionalBranches : branches.data ?? []),
    [branches.data, professionalBranches, selectedProfessional]
  );
  const selectedBranch = useMemo(
    () => professionalBranches.find((branch) => branch.id === selectedBranchId) ?? branches.data?.find((branch) => branch.id === selectedBranchId),
    [branches.data, professionalBranches, selectedBranchId]
  );
  const selectedProfessionalBranch = useMemo(
    () => professionalBranches.find((branch) => branch.id === selectedBranchId) ?? null,
    [professionalBranches, selectedBranchId]
  );
  const branchChairs = useMemo(() => chairs.data ?? [], [chairs.data]);
  const chairNamesById = useMemo(() => new Map(branchChairs.map((chair) => [chair.id, chair.name])), [branchChairs]);
  const defaultChairId = branchChairs.length === 1 ? branchChairs[0].id : "";
  const isReadyForEditor = Boolean(selectedProfessionalId && selectedBranchId);
  const isProfessionalLocked = Boolean(selectedProfessionalId);
  const hasSingleBranch = Boolean(
    selectedProfessional &&
      (professionalBranches.length === 1 || (isProfessionalLocked && Boolean(selectedBranchId)))
  );
  const needsBranchSelection = Boolean(selectedProfessional && !hasSingleBranch && professionalBranches.length > 1);
  const actionPending = createSchedule.isPending || updateSchedule.isPending || updateAgendaConfig.isPending || branchActiveSchedules.isLoading;

  useEffect(() => {
    if (!activeBranchId) return;
    
    setParams((current) => {
      if (current.get("branchId") === activeBranchId) return current;
      const next = new URLSearchParams(current);
      next.set("branchId", activeBranchId);
      return next;
    }, { replace: true });
  }, [activeBranchId, setParams]);

  useEffect(() => {
    if (!selectedProfessionalId || !professionalBranchFilterId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === selectedProfessionalId);
    if (isVisible) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("professionalId");
      return next;
    }, { replace: true });
  }, [professionalBranchFilterId, professionals.data, selectedProfessionalId, setParams]);

  const blockRange = blockDateRange(blockForm);
  const blockConflictQuery = useScheduleBlockConflicts(
    blockRange
      ? {
          professionalId: blockForm.professionalId,
          branchId: blockForm.branchId,
          start: blockRange.startAt,
          end: blockRange.endAt
        }
      : undefined,
    blockOpen && Boolean(blockRange)
  );
  const blockConflicts = blockConflictQuery.data ?? [];
  const blockDuration = blockRange ? diffMinutes(new Date(blockRange.startAt), new Date(blockRange.endAt)) : 0;

  useEffect(() => {
    if (!isReadyForEditor) return;
    setWeeklyForm(weeklyFormFromSchedules(schedules.data ?? [], defaultChairId));
  }, [defaultChairId, isReadyForEditor, schedules.data]);

  useEffect(() => {
    if (!selectedProfessionalId || !selectedProfessional) return;

    const assignedBranchIds = professionalBranches.map((branch) => branch.id);
    const nextBranchId = assignedBranchIds.length === 1 ? assignedBranchIds[0] : "";
    const branchIsAssigned = selectedBranchId ? assignedBranchIds.includes(selectedBranchId) : false;

    if (nextBranchId && selectedBranchId !== nextBranchId) {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("branchId", nextBranchId);
        return next;
      }, { replace: true });
      return;
    }

    if (selectedBranchId && !branchIsAssigned) {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("branchId");
        return next;
      }, { replace: true });
    }
  }, [professionalBranches, selectedBranchId, selectedProfessional, selectedProfessionalId, setParams]);

  useEffect(() => {
    setBlockForm((current) => ({
      ...current,
      branchId: selectedBranchId,
      professionalId: selectedProfessionalId,
      chairId: branchChairs.some((chair) => chair.id === current.chairId) ? current.chairId : defaultChairId
    }));
  }, [branchChairs, defaultChairId, selectedBranchId, selectedProfessionalId]);

  const updateParam = (key: "professionalId" | "branchId", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const updateDay = (dayOfWeek: number, patch: Partial<DayForm>) => {
    setWeeklyError("");
    setWeeklyForm((current) => ({
      ...current,
      [dayOfWeek]: normalizeDayForm(dayOfWeek, {
        ...current[dayOfWeek],
        ...patch
      })
    }));
  };

  const submitWeeklySchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProfessionalId || !selectedBranchId) return;
    createSchedule.reset();
    updateSchedule.reset();

    if (branchActiveSchedules.isLoading) {
      setWeeklyError("Espera a que carguen los horarios de la sucursal.");
      return;
    }

    const schedulesByDay = schedulesByDayMap(schedules.data ?? []);
    const validationError = validateWeeklyForm(weeklyForm);
    if (validationError) {
      setWeeklyError(validationError);
      return;
    }

    const chairConflictError = validateChairConflicts(
      weeklyForm,
      schedulesByDay,
      branchActiveSchedules.data ?? [],
      chairNamesById
    );
    if (chairConflictError) {
      setWeeklyError(chairConflictError);
      toast.error(chairConflictError);
      return;
    }

    try {
      for (const day of days) {
        const row = weeklyForm[day.value];
        const current = schedulesByDay.get(day.value);

        if (row.noAttend) {
          if (current?.isActive) {
            await updateSchedule.mutateAsync({ id: current.id, payload: { isActive: false } });
          }
          continue;
        }

        const payload: SchedulePayload = {
          professionalId: selectedProfessionalId,
          branchId: selectedBranchId,
          chairId: row.chairId || null,
          dayOfWeek: day.value,
          startTime: row.startTime,
          endTime: row.endTime,
          breakStartTime: row.hasBreak ? row.breakStartTime : null,
          breakEndTime: row.hasBreak ? row.breakEndTime : null
        };

        if (current) {
          await updateSchedule.mutateAsync({ id: current.id, payload: { ...payload, isActive: true } });
        } else {
          await createSchedule.mutateAsync({
            ...payload,
            chairId: row.chairId || undefined,
            breakStartTime: row.hasBreak ? row.breakStartTime : undefined,
            breakEndTime: row.hasBreak ? row.breakEndTime : undefined
          });
        }
      }
      setWeeklyError("");
      toast.success("Horario actualizado con exito");
    } catch (error) {
      const message = scheduleSaveErrorMessage(error);
      createSchedule.reset();
      updateSchedule.reset();
      setWeeklyError(message);
      toast.error(message);
    }
  };

  const openBlock = () => {
    setBlockForm(emptyBlockForm(selectedBranchId, selectedProfessionalId, defaultChairId));
    setBlockOpen(true);
  };

  const submitBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!blockRange || blockDuration < 5 || blockConflicts.length) return;

    await createBlock.mutateAsync({
      branchId: blockForm.branchId,
      professionalId: blockForm.professionalId,
      chairId: blockForm.chairId || undefined,
      title: blockForm.reason.trim() || "Bloqueo programado",
      reason: blockForm.reason.trim() || undefined,
      startAt: blockRange.startAt,
      endAt: blockRange.endAt,
      durationMinutes: blockDuration,
      notes: blockForm.notes.trim() || undefined
    });
    setBlockOpen(false);
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <PageHeader
        title="Horarios profesionales"
        description="Disponibilidad habitual, box asignado y bloqueos programados por profesional."
        helpText="Los descansos se consideran horario de comida y quedan cerrados automaticamente para agenda. Los sabados no usan descanso."
      />

      <Card className="space-y-[var(--space-4)]">
        <div className="grid gap-[var(--space-3)] md:grid-cols-2">
          <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Profesional
            <Select value={selectedProfessionalId} onChange={(event) => updateParam("professionalId", event.target.value)}>
              <option value="">Selecciona profesional</option>
              {professionals.data?.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.firstName} {professional.lastName}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Sucursal
            <Select
              value={selectedBranchId}
              disabled={Boolean(selectedProfessional && !professionalBranches.length)}
              onChange={(event) => updateParam("branchId", event.target.value)}
            >
              <option value="">{needsBranchSelection ? "Selecciona sucursal del doctor" : "Selecciona sucursal"}</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {schedules.isLoading || branchActiveSchedules.isLoading || professionals.isLoading || branches.isLoading || chairs.isLoading ? (
        <LoadingState message="Cargando horarios y catalogos..." />
      ) : null}
      {schedules.isError ? <ErrorState message={schedules.error.message} /> : null}
      {branchActiveSchedules.isError ? <ErrorState message={branchActiveSchedules.error.message} /> : null}
      {professionals.isError ? <ErrorState message={professionals.error.message} /> : null}
      {branches.isError ? <ErrorState message={branches.error.message} /> : null}
      {chairs.isError ? <ErrorState message={chairs.error.message} /> : null}
      {createSchedule.isError ? <ErrorState message={createSchedule.error.message} /> : null}
      {updateSchedule.isError ? <ErrorState message={updateSchedule.error.message} /> : null}

      {!isReadyForEditor ? (
        <EmptyState
          title="Selecciona filtros"
          description={
            selectedProfessional && !professionalBranches.length
              ? "Este profesional no tiene sucursales asignadas."
              : "Elige profesional y sucursal para editar su horario semanal."
          }
        />
      ) : (
        <div className="space-y-[var(--space-4)]">
          <form className="space-y-[var(--space-4)]" onSubmit={submitWeeklySchedule}>
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-[var(--space-2)] border-b border-[var(--border-default)] px-[var(--space-4)] py-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">
                  Editar horarios de {selectedProfessionalName}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)]">
                  <span>Lunes a viernes 10:00 a 19:00. Sabado 10:00 a 15:00.</span>
                  <span className="hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5">
                    <span>Intervalo: <strong className="text-[var(--text-primary)]">{selectedBranch?.agendaSlotMinutes ?? 30} minutos</strong></span>
                    <button
                      type="button"
                      onClick={() => setIntervalOpen(true)}
                      className="font-semibold text-[var(--text-brand-strong)] hover:underline"
                    >
                      Saber más / Cambiar
                    </button>
                  </div>
                </div>
              </div>
              <Badge value={actionPending ? "GUARDANDO" : "ACTIVO"} tone={actionPending ? "warning" : "success"} />
            </div>

            <div className="hidden lg:block overflow-x-auto w-full max-w-full">
              <table className="w-full min-w-[720px] lg:min-w-[840px] border-collapse bg-[var(--bg-surface)] text-[var(--text-sm)]">
                <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">
                  <tr>
                    <th className="w-[100px] sm:w-[120px] md:w-[130px] px-1 py-[var(--space-2)]">Configuracion</th>
                    {days.map((day) => (
                      <th key={day.value} className="px-1.5 py-[var(--space-3)] text-center sm:px-[var(--space-3)]">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <ScheduleRow label="Hora inicio">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <TimeSelect
                          value={weeklyForm[day.value].startTime}
                          disabled={weeklyForm[day.value].noAttend}
                          onChange={(value) => updateDay(day.value, { startTime: value })}
                        />
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                  <ScheduleRow label="Hora termino">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <TimeSelect
                          value={weeklyForm[day.value].endTime}
                          disabled={weeklyForm[day.value].noAttend}
                          options={endTimeOptionsForDay(day.value)}
                          onChange={(value) => updateDay(day.value, { endTime: value })}
                        />
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                  <ScheduleRow label="Dar descanso">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <label className="inline-flex items-center justify-center gap-[var(--space-2)] text-[var(--text-sm)] text-[var(--text-primary)]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--action-brand)]"
                            checked={weeklyForm[day.value].hasBreak}
                            disabled={weeklyForm[day.value].noAttend || day.value === 6 || day.value === 0}
                            onChange={(event) => updateDay(day.value, { hasBreak: event.target.checked })}
                          />
                          Si
                        </label>
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                  <ScheduleRow label="Inicio descanso">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <TimeSelect
                          value={weeklyForm[day.value].breakStartTime}
                          disabled={weeklyForm[day.value].noAttend || !weeklyForm[day.value].hasBreak}
                          placeholder="-"
                          onChange={(value) => updateDay(day.value, { breakStartTime: value })}
                        />
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                  <ScheduleRow label="Termino descanso">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <TimeSelect
                          value={weeklyForm[day.value].breakEndTime}
                          disabled={weeklyForm[day.value].noAttend || !weeklyForm[day.value].hasBreak}
                          placeholder="-"
                          onChange={(value) => updateDay(day.value, { breakEndTime: value })}
                        />
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                  <ScheduleRow label="Box atencion">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <Select
                          className="w-full min-w-[80px] sm:min-w-[95px] md:min-w-[104px]"
                          value={weeklyForm[day.value].chairId}
                          disabled={weeklyForm[day.value].noAttend || !branchChairs.length}
                          onChange={(event) => updateDay(day.value, { chairId: event.target.value })}
                        >
                          <option value="">{branchChairs.length ? "Sin box" : "Sin boxes"}</option>
                          {branchChairs.map((chair) => (
                            <option key={chair.id} value={chair.id}>
                              {chair.name}
                            </option>
                          ))}
                        </Select>
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                  <ScheduleRow label="No atiende">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--action-brand)]"
                          checked={weeklyForm[day.value].noAttend}
                          onChange={(event) =>
                            updateDay(day.value, {
                              noAttend: event.target.checked,
                              hasBreak: event.target.checked ? false : weeklyForm[day.value].hasBreak
                            })
                          }
                        />
                      </ScheduleCell>
                    ))}
                  </ScheduleRow>
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card-based View */}
            <div className="block lg:hidden divide-y divide-[var(--border-default)]">
              {days.map((day) => {
                const form = weeklyForm[day.value];
                return (
                  <div key={day.value} className="p-[var(--space-3)] space-y-[var(--space-2)] bg-[var(--bg-surface)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-sm)] font-bold text-[var(--text-brand-strong)] uppercase tracking-wider">
                        {day.label}
                      </span>
                      <label className="inline-flex items-center gap-[var(--space-2)] text-[var(--text-xs)] font-medium text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--action-brand)] cursor-pointer"
                          checked={form.noAttend}
                          onChange={(event) =>
                            updateDay(day.value, {
                              noAttend: event.target.checked,
                              hasBreak: event.target.checked ? false : form.hasBreak
                            })
                          }
                        />
                        No atiende
                      </label>
                    </div>

                    {!form.noAttend ? (
                      <div className="grid grid-cols-2 gap-[var(--space-2)]">
                        <label className="grid gap-1 text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">
                          Hora inicio
                          <TimeSelect
                            value={form.startTime}
                            disabled={form.noAttend}
                            onChange={(value) => updateDay(day.value, { startTime: value })}
                          />
                        </label>

                        <label className="grid gap-1 text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">
                          Hora termino
                          <TimeSelect
                            value={form.endTime}
                            disabled={form.noAttend}
                            options={endTimeOptionsForDay(day.value)}
                            onChange={(value) => updateDay(day.value, { endTime: value })}
                          />
                        </label>

                        {day.value !== 6 && day.value !== 0 && (
                          <div className="col-span-2 space-y-1.5 border-t border-[var(--border-default)] pt-[var(--space-2)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">¿Dar descanso?</span>
                              <label className="inline-flex items-center gap-[var(--space-2)] text-[var(--text-xs)] font-medium text-[var(--text-primary)] cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--action-brand)] cursor-pointer"
                                  checked={form.hasBreak}
                                  disabled={form.noAttend}
                                  onChange={(event) => updateDay(day.value, { hasBreak: event.target.checked })}
                                />
                                Si
                              </label>
                            </div>

                            {form.hasBreak && (
                              <div className="grid grid-cols-2 gap-[var(--space-2)] pt-1">
                                <label className="grid gap-1 text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">
                                  Inicio descanso
                                  <TimeSelect
                                    value={form.breakStartTime}
                                    disabled={form.noAttend || !form.hasBreak}
                                    placeholder="-"
                                    onChange={(value) => updateDay(day.value, { breakStartTime: value })}
                                  />
                                </label>

                                <label className="grid gap-1 text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">
                                  Termino descanso
                                  <TimeSelect
                                    value={form.breakEndTime}
                                    disabled={form.noAttend || !form.hasBreak}
                                    placeholder="-"
                                    onChange={(value) => updateDay(day.value, { breakEndTime: value })}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        )}

                        <label className="col-span-2 grid gap-1 text-[var(--text-xs)] font-semibold text-[var(--text-secondary)] border-t border-[var(--border-default)] pt-[var(--space-2)]">
                          Box atencion
                          <Select
                            className="w-full"
                            value={form.chairId}
                            disabled={form.noAttend || !branchChairs.length}
                            onChange={(event) => updateDay(day.value, { chairId: event.target.value })}
                          >
                            <option value="">{branchChairs.length ? "Sin box" : "Sin boxes"}</option>
                            {branchChairs.map((chair) => (
                              <option key={chair.id} value={chair.id}>
                                {chair.name}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </div>
                    ) : (
                      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] py-[var(--space-3)] text-center text-[var(--text-xs)] text-[var(--text-secondary)] font-medium italic">
                        No atiende este día
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-[var(--space-3)] border-t border-[var(--border-default)] px-[var(--space-4)] py-[var(--space-4)] md:flex-row md:items-center md:justify-between">
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                El descanso bloquea agenda como comida. Si marcas no atiende, ese dia queda cerrado.
              </p>
              <Button type="submit" disabled={actionPending}>
                <CalendarClock className="h-4 w-4" />
                {actionPending ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </Card>

          {weeklyError ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--status-warning-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] font-medium text-[var(--status-warning-text)]">
              {weeklyError}
            </div>
          ) : null}
          </form>
        </div>
      )}

      {isReadyForEditor && (
        <SpecialSchedulesSection
          professionalId={selectedProfessionalId!}
          branchId={selectedBranchId!}
          chairs={chairs.data ?? []}
        />
      )}

      {isReadyForEditor ? (
        <Card className="space-y-[var(--space-4)]">
          <div className="flex flex-col gap-[var(--space-3)] md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Bloqueos programados futuros</h3>
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                Cierra rangos especificos de agenda. Si hay citas, se muestra advertencia antes de crear el bloqueo.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={openBlock}>
              <Plus className="h-4 w-4" />
              Nuevo bloqueo
            </Button>
          </div>

          {futureBlocks.isLoading ? <LoadingState message="Cargando bloqueos programados..." /> : null}
          {futureBlocks.isError ? <ErrorState message={futureBlocks.error.message} /> : null}

          {!futureBlocks.isLoading && futureBlocks.data ? (
            futureBlocks.data.length ? (
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
                <table className="w-full min-w-[480px] md:min-w-full border-collapse bg-[var(--bg-surface)] text-[var(--text-sm)]">
                  <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-[var(--space-3)] py-[var(--space-3)]">Sucursal</th>
                      <th className="px-[var(--space-3)] py-[var(--space-3)]">Fecha</th>
                      <th className="px-[var(--space-3)] py-[var(--space-3)]">Hora inicio</th>
                      <th className="px-[var(--space-3)] py-[var(--space-3)]">Hora termino</th>
                      <th className="hidden md:table-cell px-[var(--space-3)] py-[var(--space-3)]">Creado por</th>
                      <th className="hidden sm:table-cell px-[var(--space-3)] py-[var(--space-3)]">Recurso</th>
                      <th className="px-[var(--space-3)] py-[var(--space-3)] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureBlocks.data.map((block) => (
                      <tr key={block.id} className="border-t border-[var(--border-default)]">
                        <td className="px-[var(--space-3)] py-[var(--space-3)]">{block.branch.name}</td>
                        <td className="px-[var(--space-3)] py-[var(--space-3)]">{formatDate(block.startAt)}</td>
                        <td className="px-[var(--space-3)] py-[var(--space-3)]">{formatTime(block.startAt)}</td>
                        <td className="px-[var(--space-3)] py-[var(--space-3)]">{formatTime(block.endAt)}</td>
                        <td className="hidden md:table-cell px-[var(--space-3)] py-[var(--space-3)]">{formatCreatedBy(block)}</td>
                        <td className="hidden sm:table-cell px-[var(--space-3)] py-[var(--space-3)]">{block.chair?.name ?? "Profesional"}</td>
                        <td className="px-[var(--space-3)] py-[var(--space-3)] text-right">
                          <HelpTooltip content="Eliminar bloqueo" position="left">
                            <button
                              type="button"
                              aria-label="Eliminar bloqueo"
                              disabled={deleteBlock.isPending}
                              onClick={() => void deleteBlock.mutateAsync(block.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-danger)] transition-[background-color,color] hover:bg-[var(--status-danger-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </HelpTooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sin bloqueos futuros" description="No hay bloqueos programados para este profesional y sucursal." />
            )
          ) : null}
        </Card>
      ) : null}

      <Modal open={blockOpen} title="Crear bloqueo programado" size="lg" onClose={() => setBlockOpen(false)}>
        <form className="space-y-[var(--space-4)]" onSubmit={submitBlock}>
          <div className="grid gap-[var(--space-3)] md:grid-cols-2">
            <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Fecha
              <Input
                required
                type="date"
                value={blockForm.date}
                onChange={(event) => setBlockForm((current) => ({ ...current, date: event.target.value }))}
              />
            </label>
            <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Box atencion
              <Select
                value={blockForm.chairId}
                onChange={(event) => setBlockForm((current) => ({ ...current, chairId: event.target.value }))}
              >
                <option value="">Sin box especifico</option>
                {branchChairs.map((chair) => (
                  <option key={chair.id} value={chair.id}>
                    {chair.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Hora inicio
              <TimeSelect
                value={blockForm.startTime}
                onChange={(value) => setBlockForm((current) => ({ ...current, startTime: value }))}
              />
            </label>
            <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Hora termino
              <TimeSelect
                value={blockForm.endTime}
                onChange={(value) => setBlockForm((current) => ({ ...current, endTime: value }))}
              />
            </label>
          </div>

          <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Motivo
            <Input
              required
              value={blockForm.reason}
              onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))}
            />
          </label>
          <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Notas
            <Textarea
              rows={3}
              value={blockForm.notes}
              onChange={(event) => setBlockForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          {!blockRange || blockDuration < 5 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--status-danger-bg)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] font-medium text-[var(--status-danger-text)]">
              La hora de termino debe ser posterior a la hora de inicio.
            </div>
          ) : null}

          {blockConflictQuery.isFetching ? <LoadingState message="Revisando citas afectadas..." /> : null}
          {blockConflicts.length ? <ConflictWarning conflicts={blockConflicts} /> : null}
          {createBlock.isError ? <ErrorState message={createBlock.error.message} /> : null}

          <div className="flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={() => setBlockOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                createBlock.isPending ||
                blockConflictQuery.isFetching ||
                !blockRange ||
                blockDuration < 5 ||
                Boolean(blockConflicts.length)
              }
            >
              {createBlock.isPending ? "Creando..." : "Crear bloqueo"}
            </Button>
          </div>
        </form>
      </Modal>

      {selectedProfessional && selectedBranch && (
        <AgendaIntervalModals
          open={intervalOpen}
          onClose={() => setIntervalOpen(false)}
          professional={{
            id: selectedProfessional.id,
            firstName: selectedProfessional.firstName,
            lastName: selectedProfessional.lastName,
            branchName: selectedBranch.name,
            agendaSlotMinutes: selectedProfessionalBranch?.agendaSlotMinutes ?? selectedBranch.agendaSlotMinutes ?? null,
            defaultAppointmentDurationMinutes: selectedProfessionalBranch?.defaultAppointmentDurationMinutes ?? null
          }}
          onSave={async (payload) => {
            await updateAgendaConfig.mutateAsync({
              professionalId: selectedProfessional.id,
              branchId: selectedBranch.id,
              payload
            });
            toast.success("Intervalo de agenda actualizado con éxito");
          }}
          isPending={updateAgendaConfig.isPending}
        />
      )}
    </div>
  );
}

function ScheduleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-[var(--border-default)] align-middle">
      <th className="px-1.5 sm:px-[var(--space-2)] py-[var(--space-2)] text-left text-xs sm:text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
        {label}
      </th>
      {children}
    </tr>
  );
}

function ScheduleCell({ children }: { children: React.ReactNode }) {
  return <td className="px-0.5 sm:px-1 py-[var(--space-2)] text-center">{children}</td>;
}

function TimeSelect({
  disabled,
  onChange,
  options = timeOptions,
  placeholder = "Hora",
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
  value: string;
}) {
  return (
    <Select className="w-full min-w-[68px] sm:min-w-[76px] md:min-w-[88px]" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </Select>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)]">
      <p className="text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 truncate text-[var(--text-sm)] font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
      <span>{label}</span>
      <div className="flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function ConflictWarning({ conflicts }: { conflicts: ScheduleBlockAppointment[] }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--status-warning-bg)] p-[var(--space-4)] text-[var(--status-warning-text)]">
      <div className="flex items-start gap-[var(--space-2)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-[var(--text-sm)] font-semibold">Hay citas en este rango</p>
          <p className="mt-1 text-[var(--text-sm)]">
            Resuelve estas citas antes de bloquear el horario. El sistema no las reasigna automaticamente.
          </p>
        </div>
      </div>
      <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
        {conflicts.slice(0, 5).map((appointment) => (
          <div key={appointment.id} className="rounded-[var(--radius-sm)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] text-[var(--text-primary)]">
            <span className="font-semibold">{formatTimeRange(appointment.startAt, appointment.endAt)}</span>
            {" - "}
            {appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : appointment.title}
          </div>
        ))}
        {conflicts.length > 5 ? (
          <p className="text-[var(--text-sm)] font-medium">Y {conflicts.length - 5} cita(s) mas.</p>
        ) : null}
      </div>
    </div>
  );
}

function validateWeeklyForm(form: Record<number, DayForm>) {
  for (const day of days) {
    const row = form[day.value];
    if (row.noAttend) continue;

    if (!row.startTime || !row.endTime) return `${day.label}: indica hora de inicio y termino.`;
    const requiredEndTime = fixedEndTimesByDay[day.value];
    if (requiredEndTime && row.endTime !== requiredEndTime) {
      return `${day.label}: la hora de termino debe ser ${requiredEndTime}.`;
    }
    if (toMinutes(row.startTime) >= toMinutes(row.endTime)) {
      return `${day.label}: la hora de inicio debe ser anterior a la hora de termino.`;
    }

    if (day.value === 6 && row.hasBreak) {
      return "Sabado no debe tener descanso.";
    }

    if (row.hasBreak) {
      if (!row.breakStartTime || !row.breakEndTime) return `${day.label}: completa el inicio y termino del descanso.`;
      const start = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      const breakStart = toMinutes(row.breakStartTime);
      const breakEnd = toMinutes(row.breakEndTime);
      if (breakStart >= breakEnd) return `${day.label}: el inicio del descanso debe ser anterior al termino.`;
      if (breakStart < start || breakEnd > end) return `${day.label}: el descanso debe estar dentro del horario laboral.`;
    }
  }

  return "";
}

function validateChairConflicts(
  form: Record<number, DayForm>,
  currentSchedulesByDay: Map<number, Schedule>,
  branchSchedules: Schedule[],
  chairNamesById: Map<string, string>
) {
  for (const day of days) {
    const row = form[day.value];
    if (row.noAttend || !row.chairId) continue;

    const current = currentSchedulesByDay.get(day.value);
    const start = toMinutes(row.startTime);
    const end = toMinutes(row.endTime);
    const conflict = branchSchedules.find((schedule) => {
      if (!schedule.isActive || schedule.id === current?.id || schedule.chairId !== row.chairId || schedule.dayOfWeek !== day.value) {
        return false;
      }

      return start < toMinutes(schedule.endTime) && end > toMinutes(schedule.startTime);
    });

    if (conflict) {
      const chairName = conflict.chair?.name ?? chairNamesById.get(row.chairId) ?? "El box seleccionado";
      const professionalName = `${conflict.professional.firstName} ${conflict.professional.lastName}`.trim();
      return `${day.label}: ${chairName} ya esta asignado a ${professionalName} de ${conflict.startTime} a ${conflict.endTime}. Elige otro box, ajusta el horario o deja "Sin box".`;
    }
  }

  return "";
}

function scheduleSaveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo actualizar el horario.";
  if (message.includes("Overlapping schedule for selected chair")) {
    return "El box seleccionado ya tiene otro horario activo en ese dia y rango. Elige otro box, ajusta las horas o deja el dia sin box.";
  }
  if (message.includes("Overlapping schedule for professional and branch")) {
    return "El profesional ya tiene otro horario activo en esa sucursal, dia y rango.";
  }
  return message;
}

function blockDateRange(form: BlockForm) {
  if (!form.date || !form.startTime || !form.endTime) return null;
  const startAt = new Date(`${form.date}T${form.startTime}:00`);
  const endAt = new Date(`${form.date}T${form.endTime}:00`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) return null;
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

function buildTimeOptions(startHour: number, endHour: number, stepMinutes: number) {
  const options: string[] = [];
  for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return options;
}

function normalizeDayForm(dayOfWeek: number, row: DayForm): DayForm {
  const fixedEndTime = fixedEndTimesByDay[dayOfWeek];
  const hasBreak = dayOfWeek === 6 ? false : row.hasBreak;

  return {
    ...row,
    endTime: fixedEndTime ?? row.endTime,
    hasBreak,
    breakStartTime: hasBreak ? row.breakStartTime : "",
    breakEndTime: hasBreak ? row.breakEndTime : ""
  };
}

function endTimeOptionsForDay(dayOfWeek: number) {
  const fixedEndTime = fixedEndTimesByDay[dayOfWeek];
  return fixedEndTime ? [fixedEndTime] : timeOptions;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function diffMinutes(startAt: Date, endAt: Date) {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60000);
}

function startOfTodayIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatTimeRange(startAt: string, endAt: string) {
  return `${formatTime(startAt)} - ${formatTime(endAt)}`;
}

function formatCreatedBy(block: ScheduleBlockAppointment) {
  if (!block.createdBy) return "Sistema";
  return `${block.createdBy.firstName} ${block.createdBy.lastName}`.trim();
}
