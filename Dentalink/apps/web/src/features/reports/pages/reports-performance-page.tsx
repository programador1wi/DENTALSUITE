import { useMemo, useState, type ReactNode } from "react";
import { Activity, CalendarClock, CircleDollarSign, Clock3, FileCheck2, Stethoscope, TrendingUp, UsersRound } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePerformanceReport } from "../hooks/use-reports";

function money(value: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value || 0);
}

function currentMonth() {
  const now = new Date();
  return String(now.getMonth() + 1).padStart(2, "0");
}

function currentYear() {
  return String(new Date().getFullYear());
}

function tooltip(definition: string, formula: string, included: string, excluded: string, period?: string) {
  return (
    <div className="space-y-1">
      <p><strong>Definicion:</strong> {definition}</p>
      <p><strong>Formula:</strong> {formula}</p>
      <p><strong>Incluye:</strong> {included}</p>
      <p><strong>Excluye:</strong> {excluded}</p>
      {period ? <p><strong>Periodo:</strong> {period}</p> : null}
    </div>
  );
}

function KpiCard({
  title,
  value,
  detail,
  icon,
  help,
  tone = "brand"
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  help: ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "default";
}) {
  return (
    <Card className="min-h-[138px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.02em] text-[var(--text-secondary)]">{title}</p>
            <HelpTooltip content={help} />
          </div>
          <p className="mt-3 text-[26px] font-semibold leading-none text-[var(--text-primary)]">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
          {icon}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[12px] leading-5 text-[var(--text-secondary)]">{detail}</p>
        <Badge value={tone === "success" ? "Alza" : tone === "danger" ? "Riesgo" : "Dato"} tone={tone} />
      </div>
    </Card>
  );
}

export function ReportsPerformancePage() {
  const [preset, setPreset] = useState("month");
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [branchId, setBranchId] = useState("");
  const branches = useBranches(undefined, "ACTIVE");

  const filters = useMemo(
    () => ({
      preset: preset as "month" | "last30",
      month,
      year,
      branchId: branchId || undefined,
      currency: "MXN"
    }),
    [branchId, month, preset, year]
  );
  const report = usePerformanceReport(filters);
  const data = report.data;
  const period = data ? `${new Date(data.filters.dateFrom).toLocaleDateString()} - ${new Date(data.filters.dateTo).toLocaleDateString()}` : "";

  if (report.isLoading) return <LoadingState message="Cargando panel de desempeno..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;
  if (!data) return <EmptyState title="Sin datos" description="No hay informacion para el panel." />;

  return (
    <div className="space-y-5">
      <PageHeader title="Panel de desempeno" description="Indicadores ejecutivos calculados en backend con los mismos filtros globales." />

      <Card className="p-3">
        <div className="grid gap-3 md:grid-cols-[auto_140px_140px_1fr]">
          <Tabs
            active={preset}
            onChange={setPreset}
            items={[
              { key: "month", label: "Mes" },
              { key: "last30", label: "Ultimos 30 dias" }
            ]}
          />
          <Input type="number" min="1" max="12" value={month} onChange={(event) => setMonth(event.target.value.padStart(2, "0"))} disabled={preset !== "month"} aria-label="Mes" />
          <Input type="number" min="2020" value={year} onChange={(event) => setYear(event.target.value)} disabled={preset !== "month"} aria-label="Ano" />
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Sucursal">
            <option value="">Todas las sucursales autorizadas</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[var(--text-secondary)]">
          <span>Sucursal: {data.filters.branchName}</span>
          <span>Periodo: {period}</span>
          <span>Zona horaria: {data.filters.timezone}</span>
          <span>Ultima actualizacion: {new Date(data.updatedAt).toLocaleString()}</span>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Agenda</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            title="Pacientes nuevos"
            value={number(data.agenda.newPatients)}
            detail="Nuevos con diagnostico o atencion registrada."
            icon={<UsersRound className="h-5 w-5" />}
            help={tooltip("Pacientes creados en el periodo con evolucion clinica o plan asociado.", "COUNT Patient", "clinicalEvolutions o treatmentPlans", "Pacientes eliminados", period)}
          />
          <KpiCard
            title="Citas anuladas"
            value={number(data.agenda.cancelledAppointments)}
            detail="Paciente o cambio de horario."
            icon={<CalendarClock className="h-5 w-5" />}
            help={tooltip("Citas anuladas por paciente o reagendamiento.", "COUNT Appointment", "CANCELLED_BY_PATIENT, CANCELLED_RESCHEDULED, RESCHEDULED", "Bloqueos y anulaciones de clinica", period)}
            tone="warning"
          />
          <KpiCard
            title="Ocupacion"
            value={`${number(data.agenda.occupancy.percent)}%`}
            detail={`${number(data.agenda.occupancy.usedMinutes)} / ${number(data.agenda.occupancy.availableMinutes)} min`}
            icon={<Activity className="h-5 w-5" />}
            help={tooltip("Minutos usados en atenciones contra minutos disponibles por horario.", "minutos atendidos / minutos de ProfessionalSchedule", "COMPLETED, WAITING_ROOM, IN_PROGRESS", "Canceladas, no show, bloqueos", period)}
            tone="success"
          />
          <KpiCard
            title="Presupuestos"
            value={number(data.agenda.diagnosticBudgets)}
            detail="Generados desde citas de diagnostico."
            icon={<FileCheck2 className="h-5 w-5" />}
            help={tooltip("Presupuestos ligados a citas cuyo motivo contiene diagnostico.", "COUNT Budget", "Budgets con TreatmentPlan no alternativo", "Alternativos y fuera de rango", period)}
          />
          <KpiCard
            title="Atendidos/agendados"
            value={`${number(data.agenda.attendedVsScheduled.percent)}%`}
            detail={`${data.agenda.attendedVsScheduled.attended} de ${data.agenda.attendedVsScheduled.scheduled}`}
            icon={<Stethoscope className="h-5 w-5" />}
            help={tooltip("Citas atendidas frente a citas agendadas validas.", "atendidas / agendadas", "COMPLETED, WAITING_ROOM, IN_PROGRESS", "Canceladas, no show, bloqueos", period)}
            tone="success"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">Atenciones por mes</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={data.agenda.monthlyAttention}>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line dataKey="attended" name="Atenciones" stroke="#0f766e" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">Ventas y cobranza mensual</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={data.finance.monthly}>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value), data.filters.currency)} />
                <Line dataKey="sales" name="Ventas" stroke="#2563eb" strokeWidth={3} />
                <Line dataKey="collections" name="Cobranza" stroke="#16a34a" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Ventas, cobranza y operacion</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Ventas" value={money(data.finance.sales, data.filters.currency)} detail={`${number(data.finance.salesVariationPercent)}% vs periodo anterior`} icon={<TrendingUp className="h-5 w-5" />} help={tooltip("Prestaciones realizadas o evolucionadas.", "SUM TreatmentPlanItem.total", "COMPLETED", "Canceladas y no realizadas", period)} tone={data.finance.salesVariationPercent >= 0 ? "success" : "danger"} />
          <KpiCard title="Cobranza" value={money(data.finance.collections, data.filters.currency)} detail={`${number(data.finance.collectionsVariationPercent)}% vs periodo anterior`} icon={<CircleDollarSign className="h-5 w-5" />} help={tooltip("Pagos recibidos de pacientes.", "SUM Payment.amount", "RECEIVED, PARTIALLY_ALLOCATED, ALLOCATED", "REFUNDED, VOIDED", period)} tone={data.finance.collectionsVariationPercent >= 0 ? "success" : "danger"} />
          <KpiCard title="Espera promedio" value={`${number(data.operation.averageWaitMinutes)} min`} detail={`${number(data.operation.variationPercent)}% vs historico`} icon={<Clock3 className="h-5 w-5" />} help={tooltip("Inicio de atencion menos ingreso a sala de espera.", "statusHistory(IN_PROGRESS/COMPLETED) - WAITING_ROOM", "Citas con ambos eventos", "Citas sin historial suficiente", period)} />
          <KpiCard title="Costos teoricos" value={money(data.production.theoreticalCosts, data.filters.currency)} detail="Basado en costo laboratorio/arancel." icon={<Activity className="h-5 w-5" />} help={tooltip("Costos teoricos de prestaciones completadas.", "SUM PriceListItem.labCost * quantity", "Prestaciones completadas con arancel", "Sin costo configurado", period)} />
          <KpiCard title="Profesionales" value={number(data.production.salesByProfessional.length)} detail="Con produccion en el periodo." icon={<UsersRound className="h-5 w-5" />} help={tooltip("Ventas por profesional.", "SUM ventas / profesional", "Prestaciones completadas", "Profesionales sin ventas", period)} />
        </div>
      </section>

      <Card>
        <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">Eficiencia por profesional</h3>
        <DataTable
          rows={data.production.professionalEfficiency}
          empty={<EmptyState title="Sin datos" description="No hay produccion profesional para este periodo." />}
          columns={[
            { key: "name", title: "Profesional" },
            { key: "sales", title: "Ventas", render: (row) => money(Number(row.sales), data.filters.currency) },
            { key: "attendedHours", title: "Horas atendidas" },
            { key: "efficiency", title: "Ventas / hora", render: (row) => money(Number(row.efficiency), data.filters.currency) }
          ]}
        />
      </Card>
    </div>
  );
}
