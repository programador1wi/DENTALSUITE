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
import { useSchedules, useSpecialSchedules } from "@/features/settings/schedules/hooks/use-schedules";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useChairs, useCreateChair, useDeactivateChair, useUpdateChair } from "../hooks/use-chairs";

const START_HOUR = 8;
const END_HOUR = 20;
const DAY_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOURS_COUNT = END_HOUR - START_HOUR;
const HOUR_PERCENTAGE = (1 / HOURS_COUNT) * 100;

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

function timeOffsetMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m - START_HOUR * 60;
}

function scheduleBlockStyle(startTime: string, endTime: string) {
  const start = Math.max(0, timeOffsetMinutes(startTime));
  const end = Math.min(DAY_MINUTES, timeOffsetMinutes(endTime));
  return {
    left: `${(start / DAY_MINUTES) * 100}%`,
    width: `${(Math.max(end - start, 20) / DAY_MINUTES) * 100}%`
  };
}

function blockTone(isSpecial: boolean) {
  return isSpecial ? "border-amber-500 bg-amber-500 text-white" : "border-emerald-500 bg-emerald-500 text-white";
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
  
  const schedules = useSchedules({ branchId: activeBranchId || undefined, active: "true", pageSize: 1000 }, Boolean(activeBranchId));
  const specialSchedules = useSpecialSchedules({ branchId: activeBranchId || undefined, active: "true", pageSize: 1000 }, Boolean(activeBranchId));
  
  const createChair = useCreateChair();
  const updateChair = useUpdateChair();
  const deactivateChair = useDeactivateChair();

  useEffect(() => {
    if (!activeBranchId && assignedBranches[0]) setActiveBranchId(assignedBranches[0].id);
  }, [activeBranchId, assignedBranches, setActiveBranchId]);

  const schedulesBlocksByChairDay = useMemo(() => {
    const grouped = new Map<string, any[]>();
    
    for (const day of days) {
      const dayDateKey = dateKey(day);
      const dayOfWeek = day.getDay();
      
      for (const s of schedules.data ?? []) {
        if (!s.chairId || s.dayOfWeek !== dayOfWeek) continue;
        const key = `${s.chairId}:${dayDateKey}`;
        
        const pushBlock = (start: string, end: string) => {
          grouped.set(key, [...(grouped.get(key) ?? []), {
            id: `${s.id}-${start}`,
            chairId: s.chairId,
            professional: s.professional,
            startTime: start,
            endTime: end,
            isSpecial: false
          }]);
        };

        if (s.breakStartTime && s.breakEndTime) {
           pushBlock(s.startTime, s.breakStartTime);
           pushBlock(s.breakEndTime, s.endTime);
        } else {
           pushBlock(s.startTime, s.endTime);
        }
      }
    }

    for (const s of specialSchedules.data ?? []) {
      if (!s.chairId) continue;
      const key = `${s.chairId}:${s.date}`;
      if (!days.some(d => dateKey(d) === s.date)) continue;

      const pushBlock = (start: string, end: string) => {
        grouped.set(key, [...(grouped.get(key) ?? []), {
          id: `${s.id}-${start}`,
          chairId: s.chairId,
          professional: s.professional,
          startTime: start,
          endTime: end,
          isSpecial: true
        }]);
      };

      if (s.breakStartTime && s.breakEndTime) {
         pushBlock(s.startTime, s.breakStartTime);
         pushBlock(s.breakEndTime, s.endTime);
      } else {
         pushBlock(s.startTime, s.endTime);
      }
    }

    return grouped;
  }, [schedules.data, specialSchedules.data, days]);

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

        {planningChairs.isLoading || schedules.isLoading || specialSchedules.isLoading ? <LoadingState message="Cargando planificacion..." /> : null}
        {planningChairs.error ? <ErrorState message={planningChairs.error.message} /> : null}
        {schedules.error ? <ErrorState message={schedules.error.message} /> : null}

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
                      <div
                        className="grid text-[10px] font-medium text-slate-500"
                        style={{ gridTemplateColumns: `repeat(${HOURS_COUNT}, minmax(36px, 1fr))` }}
                      >
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
                      const dayBlocks = schedulesBlocksByChairDay.get(`${chair.id}:${dateKey(day)}`) ?? [];
                      return (
                        <div
                          key={`${chair.id}-${dateKey(day)}`}
                          className="relative min-h-14 border-r border-slate-200"
                          style={{ backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${HOUR_PERCENTAGE}% - 1px), rgb(226 232 240) calc(${HOUR_PERCENTAGE}% - 1px), rgb(226 232 240) ${HOUR_PERCENTAGE}%)` }}
                        >
                          {dayBlocks.map((block) => (
                            <HelpTooltip
                              key={block.id}
                              content={`${block.isSpecial ? "Horario Especial" : "Horario Regular"} - ${block.professional.firstName} ${block.professional.lastName}`}
                              position="top"
                              triggerClassName={`absolute top-2 h-9 block overflow-hidden rounded border text-left shadow-sm ${blockTone(block.isSpecial)}`}
                              triggerStyle={scheduleBlockStyle(block.startTime, block.endTime)}
                            >
                              <div className="flex h-full w-full flex-col justify-center px-2 py-1 text-[11px] font-semibold leading-tight">
                                <span className="block truncate">{block.professional.firstName} {block.professional.lastName}</span>
                                <span className="block truncate text-[10px] font-medium opacity-90">
                                  {block.isSpecial ? "Especial" : "Regular"} • {block.startTime} - {block.endTime}
                                </span>
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
              La matriz proyecta los horarios laborales regulares y especiales asignados a los cubículos para la semana seleccionada.
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
