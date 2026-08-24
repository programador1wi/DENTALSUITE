import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
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
import { useAuthStore } from "@/stores/auth.store";
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
import {
  blockDateRange,
  days,
  diffMinutes,
  emptyBlockForm,
  emptyWeeklyForm,
  endOfFutureIso,
  endTimeOptionsForDay,
  fixedEndTimesByDay,
  formatCreatedBy,
  formatDate,
  formatTime,
  formatTimeRange,
  normalizeDayForm,
  scheduleSaveErrorMessage,
  schedulesByDayMap,
  startOfTodayIso,
  timeOptions,
  validateChairConflicts,
  validateWeeklyForm,
  weeklyFormFromSchedules,
  type BlockForm,
  type DayForm
} from "./schedules-page-model";

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
  const currentUser = useAuthStore((state) => state.user);
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
    start: startOfTodayIso(),
    end: endOfFutureIso()
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

  useEffect(() => {
    if (!professionals.data?.length) return;
    if (params.get("professionalId")) return;

    const matchedProfessional = professionals.data.find(
      (prof) => prof.user?.id === currentUser?.id
    );

    const defaultProfId = matchedProfessional?.id ?? professionals.data[0].id;

    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("professionalId", defaultProfId);
      return next;
    }, { replace: true });
  }, [professionals.data, currentUser, params, setParams]);

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
          breakEndTime: row.hasBreak ? row.breakEndTime : null,
          simultaneousChairs: row.simultaneousChairs,
          attendanceMode: row.attendanceMode
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
                    <span>
                      Intervalo:{" "}
                      <strong className="text-[var(--text-primary)]">
                        {selectedProfessionalBranch?.agendaSlotMinutes ?? selectedBranch?.agendaSlotMinutes ?? 30} minutos
                      </strong>
                    </span>
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
              <table className="w-full min-w-[680px] lg:min-w-[760px] border-collapse bg-[var(--bg-surface)] text-[var(--text-sm)]">
                <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-xs)] font-semibold uppercase text-[var(--text-secondary)]">
                  <tr>
                    <th className="w-[80px] sm:w-[100px] md:w-[110px] px-1 py-[var(--space-2)]">Configuracion</th>
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
                  <ScheduleRow label="Sillones simultaneos">
                    {days.map((day) => (
                      <ScheduleCell key={day.value}>
                        <Select
                          className="w-full min-w-[56px] sm:min-w-[64px] md:min-w-[70px] h-8 px-1 text-xs"
                          value={String(weeklyForm[day.value].simultaneousChairs)}
                          disabled={weeklyForm[day.value].noAttend}
                          onChange={(event) => updateDay(day.value, { simultaneousChairs: Number(event.target.value) })}
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </Select>
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
                          className="w-full min-w-[75px] sm:min-w-[85px] md:min-w-[95px] h-8 px-1.5 text-xs"
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
            <Alert variant="warning" size="sm">
              {weeklyError}
            </Alert>
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
            <Alert variant="danger" size="sm">
              La hora de término debe ser posterior a la hora de inicio.
            </Alert>
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
    <Select className="w-full min-w-[56px] sm:min-w-[64px] md:min-w-[70px] h-8 px-1 text-xs" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
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
    <Alert variant="warning" size="sm" title="Hay citas en este rango">
      <p className="mb-2">
        Resuelve estas citas antes de bloquear el horario. El sistema no las reasigna automáticamente.
      </p>
      <div className="space-y-1.5 pt-1">
        {conflicts.slice(0, 5).map((appointment) => (
          <div key={appointment.id} className="rounded-md bg-white/90 border border-amber-200/60 px-2.5 py-1.5 text-xs text-slate-800">
            <span className="font-semibold">{formatTimeRange(appointment.startAt, appointment.endAt)}</span>
            {" - "}
            {appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : appointment.title}
          </div>
        ))}
        {conflicts.length > 5 ? (
          <p className="text-xs font-medium text-amber-900">Y {conflicts.length - 5} cita(s) más.</p>
        ) : null}
      </div>
    </Alert>
  );
}
