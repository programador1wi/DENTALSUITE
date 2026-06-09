import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { LoadingState } from "@/components/feedback/loading-state";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { useAppointments } from "@/features/agenda/hooks/use-appointments";
import type { Appointment } from "@/features/agenda/services/appointments.service";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useChairs, useCreateChair, useDeactivateChair, useUpdateChair } from "../hooks/use-chairs";

const START_HOUR = 6;
const END_HOUR = 21;
const DAY_MINUTES = (END_HOUR - START_HOUR) * 60;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function weekDays(value: string) {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dayOffsetMinutes(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes() - START_HOUR * 60;
}

function appointmentBlock(appointment: Appointment) {
  const start = Math.max(0, dayOffsetMinutes(appointment.startAt));
  const end = Math.min(DAY_MINUTES, dayOffsetMinutes(appointment.endAt));
  return {
    left: `${(start / DAY_MINUTES) * 100}%`,
    width: `${(Math.max(end - start, 20) / DAY_MINUTES) * 100}%`
  };
}

function statusTone(status: Appointment["status"]) {
  if (status === "BLOCKED") return "border-zinc-300 bg-zinc-700 text-white";
  if (status === "COMPLETED") return "border-emerald-600 bg-emerald-600 text-white";
  if (status === "NO_SHOW" || status.startsWith("CANCELLED")) return "border-rose-500 bg-rose-500 text-white";
  return "border-emerald-500 bg-emerald-500 text-white";
}

function formatDay(day: Date) {
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "2-digit", month: "short" }).format(day);
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function ChairsSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branches = useBranches(undefined, "ACTIVE");
  const assignedBranches = branches.data?.filter((branch) => user?.branchIds.includes(branch.id)) ?? [];
  const chairs = useChairs(search || undefined, active || undefined, activeBranchId || undefined);
  const planningChairs = useChairs(undefined, "true", activeBranchId || undefined);
  const days = useMemo(() => weekDays(date), [date]);
  const weekStart = dateKey(days[0]);
  const appointments = useAppointments({ date: weekStart, view: "week", branchId: activeBranchId || undefined });
  const createChair = useCreateChair();
  const updateChair = useUpdateChair();
  const deactivateChair = useDeactivateChair();

  useEffect(() => {
    if (!activeBranchId && assignedBranches[0]) setActiveBranchId(assignedBranches[0].id);
  }, [activeBranchId, assignedBranches, setActiveBranchId]);

  const appointmentsByChairDay = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();
    for (const appointment of appointments.data ?? []) {
      if (!appointment.chairId) continue;
      const key = `${appointment.chairId}:${dateKey(new Date(appointment.startAt))}`;
      grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
    }
    return grouped;
  }, [appointments.data]);

  const unassignedAppointments = (appointments.data ?? []).filter((appointment) => !appointment.chairId).length;
  const hourLabels = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planificacion y uso de Cubiculos"
        description="Ocupacion semanal de cubiculos y recursos fisicos por sucursal."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Semana
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="text-sm text-slate-700">
              Sucursal
              <Select value={activeBranchId} onChange={(event) => setActiveBranchId(event.target.value)}>
                {assignedBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <Button variant="secondary" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>
            Ir a esta semana
          </Button>
        </div>

        {planningChairs.isLoading || appointments.isLoading ? <LoadingState message="Cargando planificacion..." /> : null}
        {planningChairs.error ? <ErrorState message={planningChairs.error.message} /> : null}
        {appointments.error ? <ErrorState message={appointments.error.message} /> : null}

        {!planningChairs.isLoading && !planningChairs.error && !(planningChairs.data ?? []).length ? (
          <EmptyState title="Sin cubiculos" description="Registra cubiculos activos para construir la planificacion de esta sucursal." />
        ) : null}

        {(planningChairs.data ?? []).length ? (
          <>
            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <div className="min-w-[4080px]">
                <div className="grid grid-cols-[160px_repeat(7,minmax(560px,1fr))] border-b border-slate-200 bg-slate-50">
                  <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase text-slate-500">
                    Cubiculo
                  </div>
                  {days.map((day) => (
                    <div key={dateKey(day)} className="border-r border-slate-200">
                      <div className="border-b border-slate-200 px-3 py-2 text-center text-sm font-semibold capitalize text-slate-700">
                        {formatDay(day)}
                      </div>
                      <div className="grid grid-cols-[repeat(15,minmax(36px,1fr))] text-[10px] font-medium text-slate-500">
                        {hourLabels.map((hour) => (
                          <span key={`${dateKey(day)}-${hour}`} className="border-r border-slate-200 px-1 py-1 text-center">
                            {formatHour(hour)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {(planningChairs.data ?? []).map((chair) => (
                  <div key={chair.id} className="grid min-h-14 grid-cols-[160px_repeat(7,minmax(560px,1fr))] border-b border-slate-200 last:border-b-0">
                    <div className="sticky left-0 z-10 flex items-center border-r border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
                      {chair.name}
                    </div>
                    {days.map((day) => {
                      const dayAppointments = appointmentsByChairDay.get(`${chair.id}:${dateKey(day)}`) ?? [];
                      return (
                        <div
                          key={`${chair.id}-${dateKey(day)}`}
                          className="relative min-h-14 border-r border-slate-200 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(6.666%_-_1px),rgb(226_232_240)_calc(6.666%_-_1px),rgb(226_232_240)_6.666%)]"
                        >
                          {dayAppointments.map((appointment) => (
                            <HelpTooltip
                              key={appointment.id}
                              content={`${appointment.title} - ${appointment.professional.firstName} ${appointment.professional.lastName}`}
                              position="top"
                              triggerClassName={`absolute top-2 h-9 block overflow-hidden rounded border text-left shadow-sm ${statusTone(appointment.status)}`}
                              triggerStyle={appointmentBlock(appointment)}
                            >
                              <div className="h-full w-full px-2 py-1 text-[11px] font-semibold">
                                <span className="block truncate">{appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : appointment.title}</span>
                                <span className="block truncate text-[10px] font-medium opacity-90">{appointment.professional.firstName} {appointment.professional.lastName}</span>
                              </div>
                            </HelpTooltip>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              La planificacion muestra las citas que ya tienen cubiculo asignado en la sucursal seleccionada.
              {unassignedAppointments ? ` Hay ${unassignedAppointments} cita(s) de la semana sin cubiculo asignado.` : ""}
            </div>
          </>
        ) : null}
      </Card>

      <SimpleCrudPage
        title="Cubiculos"
        description="Recursos fisicos por sucursal"
        showHeader={false}
        rows={chairs.data}
        loading={chairs.isLoading}
        error={chairs.error?.message}
        search={search}
        setSearch={setSearch}
        active={active}
        setActive={setActive}
        fields={[
          {
            key: "branchId",
            label: "Sucursal",
            type: "select",
            options: assignedBranches.map((branch) => ({ label: branch.name, value: branch.id }))
          },
          { key: "name", label: "Nombre", type: "text" },
          { key: "description", label: "Descripcion", type: "textarea" }
        ]}
        columns={[
          { key: "name", title: "Nombre" },
          { key: "branch", title: "Sucursal", render: (row) => row.branch.name },
          { key: "description", title: "Descripcion" },
          {
            key: "isActive",
            title: "Estado",
            render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
          }
        ]}
        actions={{
          create: async (payload) => createChair.mutateAsync(payload as never),
          update: async (id, payload) => updateChair.mutateAsync({ id, payload: payload as never }),
          deactivate: async (id) => deactivateChair.mutateAsync(id),
          mapToForm: (row) => ({ branchId: row.branchId, name: row.name, description: row.description ?? "" }),
          mapToPayload: (payload) => ({ ...payload, branchId: String(payload.branchId || activeBranchId) }),
          getId: (row) => row.id
        }}
      />
    </div>
  );
}
