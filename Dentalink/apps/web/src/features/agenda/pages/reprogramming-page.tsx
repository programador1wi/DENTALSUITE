import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranchStore } from "@/stores/branch.store";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { AgendaToolbar } from "../components/agenda-toolbar";
import { MassReprogrammingModal } from "../components/mass-reprogramming-modal";
import { ReprogrammingCaseModal } from "../components/reprogramming-case-modal";
import { useReprogrammingCases } from "../hooks/use-appointment-reprogramming";
import type { ReprogrammingCase } from "../services/appointment-reprogramming.service";

export function ReprogrammingPage() {
  const { hasPermission } = usePermissions();
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const [professionalId, setProfessionalId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [massOpen, setMassOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ReprogrammingCase | null>(null);
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", {
    branchId: activeBranchId || undefined,
    pageSize: 100
  });
  const visibleProfessionals = professionals.data ?? [];
  const cases = useReprogrammingCases({
    branchId: activeBranchId || undefined,
    professionalId: professionalId || undefined,
    search: search.trim() || undefined,
    page,
    pageSize: 20
  });
  const today = new Date().toISOString().slice(0, 10);
  const canMassCancel = hasPermission("agenda.reprogramming.mass_cancel");
  const canReschedule = hasPermission("agenda.reprogramming.reschedule");

  useEffect(() => setPage(1), [activeBranchId, professionalId, search]);
  useEffect(() => {
    if (!professionalId || visibleProfessionals.some((professional) => professional.id === professionalId)) return;
    setProfessionalId("");
  }, [professionalId, visibleProfessionals]);

  const rows = cases.data?.items ?? [];
  const total = cases.data?.total ?? 0;
  const pendingByUrgency = useMemo(
    () =>
      rows.reduce(
        (summary, item) => {
          const days = Math.floor((Date.now() - new Date(item.originalStartAt).getTime()) / 86_400_000);
          if (days >= 7) summary.overdue += 1;
          else summary.recent += 1;
          return summary;
        },
        { overdue: 0, recent: 0 }
      ),
    [rows]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reprogramación de citas"
        description="Cola operativa de citas anuladas que requieren una nueva fecha."
        helpText="La cita original se conserva con su historial. Reprogramar crea una cita nueva vinculada; esta pantalla no modifica pagos, deudas ni información clínica."
      />
      <AgendaToolbar
        view="reprogramming"
        date={today}
        totalAppointments={total}
        onDateChange={() => undefined}
        onGoToday={() => undefined}
        onPrint={() => window.print()}
        onEmail={() => undefined}
        showDateControls={false}
      />

      <Card className="overflow-hidden p-0">
        <div className="grid gap-4 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-[var(--text-brand-strong)]">
                {total} citas pendientes
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {pendingByUrgency.overdue} visibles con más de 7 días · {pendingByUrgency.recent} recientes en esta página
            </p>
          </div>
          {canMassCancel ? (
            <Button
              data-allow-multiline
              className="w-full whitespace-normal text-left md:w-auto"
              onClick={() => setMassOpen(true)}
            >
              <AlertTriangle className="h-4 w-4" />
              Anulación masiva en rango de fechas
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1.2fr]">
          <Select value={activeBranchId} onChange={(event) => setActiveBranchId(event.target.value)}>
            <option value="">Todas mis sucursales</option>
            {(branches.data ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </Select>
          <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
            <option value="">Todos los profesionales</option>
            {visibleProfessionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.firstName} {professional.lastName}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar paciente, teléfono o motivo"
            />
          </div>
        </div>
      </Card>

      {cases.isLoading ? <LoadingState message="Cargando casos de reprogramación…" /> : null}
      {cases.isError ? <ErrorState message={cases.error.message} /> : null}
      {!cases.isLoading && !cases.isError && !rows.length ? (
        <EmptyState
          title="Sin citas pendientes de reprogramación"
          description="Los lotes procesados aparecerán aquí hasta asignar una nueva cita o cerrar el caso."
        />
      ) : null}
      {rows.length ? (
        <Card className="p-0">
          <Table containerClassName="rounded-none border-0">
            <TableHead>
              <TableRow>
                <TableHeader>Horario original</TableHeader>
                <TableHeader>Paciente</TableHeader>
                <TableHeader>Acción</TableHeader>
                <TableHeader>Doctor original</TableHeader>
                <TableHeader wrap>Motivo de atención</TableHeader>
                <TableHeader>Situación</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => {
                const timezone = item.branch.timezone || "America/Mexico_City";
                const financial = item.financialSituation;
                return (
                  <TableRow key={item.id} className="h-[76px]">
                    <TableCell>
                      <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-center">
                        <div className="font-semibold text-amber-950">{formatTime(item.originalStartAt, timezone)}</div>
                        <div className="text-xs text-amber-700">↓ {formatTime(item.originalEndAt, timezone)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => canReschedule && setSelectedCase(item)}
                        className="text-left"
                      >
                        <span className="block font-semibold text-[var(--text-brand)] hover:underline">
                          {patientName(item)}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                          {formatDate(item.originalStartAt, timezone)} · {item.originalAppointment.patient?.phone || "Sin teléfono"}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canReschedule}
                        onClick={() => setSelectedCase(item)}
                      >
                        Reprogramar
                      </Button>
                      <div className="mt-1 max-w-40 truncate text-xs text-[var(--text-secondary)]" title={item.reasonText}>
                        {item.reasonText}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{item.originalProfessional.firstName} {item.originalProfessional.lastName}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{item.branch.name}</div>
                    </TableCell>
                    <TableCell wrap>
                      {item.originalAttentionReason || "Sin motivo"}
                      {item.originalAppointment.appointmentNotes.length ? (
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          {item.originalAppointment.appointmentNotes.length} observación(es)
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {financial ? (
                        <Badge
                          value={`${financial.label}${financial.amount ? ` · ${financial.amount}` : ""}`}
                          tone={financialTone(financial.severity)}
                        />
                      ) : (
                        <Badge value="Solo lectura" tone="default" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-[var(--border-default)] px-4 py-3">
            <span className="text-sm text-[var(--text-secondary)]">
              Página {cases.data?.page ?? 1} de {cases.data?.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= (cases.data?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <MassReprogrammingModal
        open={massOpen}
        onClose={() => setMassOpen(false)}
        branches={branches.data ?? []}
        professionals={professionals.data ?? []}
        initialBranchId={activeBranchId}
        onCompleted={() => void cases.refetch()}
      />
      <ReprogrammingCaseModal
        open={Boolean(selectedCase)}
        item={selectedCase}
        branches={branches.data ?? []}
        professionals={professionals.data ?? []}
        onClose={() => setSelectedCase(null)}
      />
    </div>
  );
}

function patientName(item: ReprogrammingCase) {
  const patient = item.originalAppointment.patient;
  return patient ? `${patient.firstName} ${patient.lastName}` : "Paciente no asignado";
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: timezone }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone
  }).format(new Date(value));
}

function financialTone(severity: "danger" | "success" | "warning" | "neutral") {
  if (severity === "danger") return "danger" as const;
  if (severity === "success") return "success" as const;
  if (severity === "warning") return "warning" as const;
  return "default" as const;
}
