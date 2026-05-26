import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import {
  useCreateSchedule,
  useDeactivateSchedule,
  useSchedules,
  useUpdateSchedule
} from "../hooks/use-schedules";
import type { Schedule } from "../services/schedules.service";

type ScheduleForm = {
  professionalId: string;
  branchId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
};

const days = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miercoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sabado" }
];

const emptyForm: ScheduleForm = {
  professionalId: "",
  branchId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  breakStartTime: "",
  breakEndTime: ""
};

function dayLabel(value: number) {
  return days.find((day) => day.value === String(value))?.label ?? String(value);
}

function toForm(schedule: Schedule): ScheduleForm {
  return {
    professionalId: schedule.professionalId,
    branchId: schedule.branchId,
    dayOfWeek: String(schedule.dayOfWeek),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    breakStartTime: schedule.breakStartTime ?? "",
    breakEndTime: schedule.breakEndTime ?? ""
  };
}

function optionalTime(value: string) {
  return value || undefined;
}

export function SchedulesSettingsPage() {
  const [params, setParams] = useSearchParams();
  const selectedProfessionalId = params.get("professionalId") ?? "";
  const selectedBranchId = params.get("branchId") ?? "";
  const selectedActive = params.get("active") ?? "true";
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const schedules = useSchedules({
    professionalId: selectedProfessionalId || undefined,
    branchId: selectedBranchId || undefined,
    active: selectedActive || undefined
  });
  const professionals = useProfessionals(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deactivateSchedule = useDeactivateSchedule();
  const actionPending =
    createSchedule.isPending || updateSchedule.isPending || deactivateSchedule.isPending;

  useEffect(() => {
    if (!modalOpen || editing || !selectedProfessionalId) return;
    setForm((current) => ({ ...current, professionalId: selectedProfessionalId }));
  }, [editing, modalOpen, selectedProfessionalId]);

  const updateParam = (key: "professionalId" | "branchId" | "active", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      professionalId: selectedProfessionalId,
      branchId: selectedBranchId
    });
    setModalOpen(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule);
    setForm(toForm(schedule));
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(false);
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.professionalId || !form.branchId || !form.startTime || !form.endTime) return;

    const payload = {
      professionalId: form.professionalId,
      branchId: form.branchId,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      breakStartTime: optionalTime(form.breakStartTime),
      breakEndTime: optionalTime(form.breakEndTime)
    };

    if (editing) {
      await updateSchedule.mutateAsync({ id: editing.id, payload });
    } else {
      await createSchedule.mutateAsync(payload);
    }

    closeModal();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Horarios profesionales"
        description="Disponibilidad habitual por profesional y sucursal."
        helpText="Los horarios activos son los que quedan disponibles para agenda. Configura los dias de atencion y descansos desde esta vista."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              Profesional
              <Select
                value={selectedProfessionalId}
                onChange={(event) => updateParam("professionalId", event.target.value)}
              >
                <option value="">Todos los profesionales</option>
                {professionals.data?.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.firstName} {professional.lastName}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Sucursal
              <Select value={selectedBranchId} onChange={(event) => updateParam("branchId", event.target.value)}>
                <option value="">Todas las sucursales</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Estado
              <Select value={selectedActive} onChange={(event) => updateParam("active", event.target.value)}>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
                <option value="">Todos</option>
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/settings/professionals"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Volver a profesionales
            </Link>
            <Button onClick={openCreate}>Nuevo horario</Button>
          </div>
        </div>
      </Card>

      {schedules.isLoading || professionals.isLoading || branches.isLoading ? (
        <LoadingState message="Cargando horarios y catalogos..." />
      ) : null}
      {schedules.isError ? <ErrorState message={schedules.error.message} /> : null}
      {professionals.isError ? <ErrorState message={professionals.error.message} /> : null}
      {branches.isError ? <ErrorState message={branches.error.message} /> : null}

      {!schedules.isLoading && schedules.data ? (
        !schedules.data.length ? (
          <EmptyState title="Sin horarios" description="No hay disponibilidad configurada para estos filtros." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Profesional</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3">Jornada</th>
                    <th className="px-4 py-3">Descanso</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.data.map((schedule) => (
                    <tr key={schedule.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {schedule.professional.firstName} {schedule.professional.lastName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{schedule.branch.name}</td>
                      <td className="px-4 py-4 text-slate-600">{dayLabel(schedule.dayOfWeek)}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {schedule.startTime} - {schedule.endTime}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {schedule.breakStartTime && schedule.breakEndTime
                          ? `${schedule.breakStartTime} - ${schedule.breakEndTime}`
                          : "Sin descanso"}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          value={schedule.isActive ? "ACTIVO" : "INACTIVO"}
                          tone={schedule.isActive ? "success" : "warning"}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => openEdit(schedule)}>
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            disabled={!schedule.isActive || actionPending}
                            onClick={() => void deactivateSchedule.mutateAsync(schedule.id)}
                          >
                            Desactivar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      <Modal open={modalOpen} title={editing ? "Editar horario" : "Nuevo horario"} onClose={closeModal}>
        <form className="space-y-4" onSubmit={submitSchedule}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Profesional
              <Select
                required
                value={form.professionalId}
                onChange={(event) => setForm((current) => ({ ...current, professionalId: event.target.value }))}
              >
                <option value="">Selecciona</option>
                {professionals.data?.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.firstName} {professional.lastName}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Sucursal
              <Select
                required
                value={form.branchId}
                onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
              >
                <option value="">Selecciona</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Dia
              <Select
                value={form.dayOfWeek}
                onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
              >
                {days.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-slate-700">
              Inicio
              <Input
                required
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Fin
              <Input
                required
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Inicio descanso
              <Input
                type="time"
                value={form.breakStartTime}
                onChange={(event) => setForm((current) => ({ ...current, breakStartTime: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Fin descanso
              <Input
                type="time"
                value={form.breakEndTime}
                onChange={(event) => setForm((current) => ({ ...current, breakEndTime: event.target.value }))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={actionPending}>
              {editing ? "Actualizar horario" : "Crear horario"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
