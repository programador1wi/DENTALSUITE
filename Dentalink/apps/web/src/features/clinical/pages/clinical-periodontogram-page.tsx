import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { ClinicalShell } from "../components/clinical-shell";
import { PeriodontalComparison } from "../components/periodontal-comparison";
import { PeriodontalChartTable } from "../components/periodontal-chart-table";
import { useClinicalMutations, usePeriodontalCharts, usePeriodontalComparison } from "../hooks/use-clinical";
import type { PeriodontalChart, PeriodontalMeasurement } from "../services/clinical.service";

const PROBING_DEPTH_MIN = 0;
const PROBING_DEPTH_MAX = 20;
const MARGIN_MIN = -8;
const MARGIN_MAX = 5;
const MOBILITY_MIN = 0;
const MOBILITY_MAX = 4;

function clampMeasurementValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function serializeMeasurements(measurements: PeriodontalMeasurement[]) {
  return measurements.map((measurement) => ({
    toothNumber: measurement.toothNumber,
    position: measurement.position,
    probingDepth: clampMeasurementValue(measurement.probingDepth, PROBING_DEPTH_MIN, PROBING_DEPTH_MAX),
    bleeding: measurement.bleeding,
    plaque: measurement.plaque,
    recession: clampMeasurementValue(measurement.recession ?? 0, MARGIN_MIN, MARGIN_MAX),
    mobility: clampMeasurementValue(measurement.mobility ?? 0, MOBILITY_MIN, MOBILITY_MAX),
    furcation: measurement.furcation || undefined,
    suppuration: measurement.suppuration
  }));
}

export function ClinicalPeriodontogramPage() {
  const { id = "" } = useParams();
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const charts = usePeriodontalCharts(id);
  const mutations = useClinicalMutations(id);

  const [professionalId, setProfessionalId] = useState("");
  const [chartDate, setChartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<PeriodontalMeasurement[]>([]);
  const [chartAId, setChartAId] = useState("");
  const [chartBId, setChartBId] = useState("");
  const [loadedChartId, setLoadedChartId] = useState("");

  const comparison = usePeriodontalComparison(id, chartAId, chartBId);

  const hasComparisonReady = Boolean(chartAId && chartBId && chartAId !== chartBId);
  const activeMeasurements = useMemo(
    () =>
      measurements.filter(
        (row) =>
          row.probingDepth > 0 ||
          row.bleeding ||
          row.plaque ||
          row.suppuration ||
          (row.recession ?? 0) !== 0 ||
          (row.mobility ?? 0) !== 0 ||
          Boolean(row.furcation)
      ),
    [measurements]
  );

  useEffect(() => {
    if (!professionalId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === professionalId);
    if (!isVisible) setProfessionalId("");
  }, [professionalId, professionals.data]);

  const loadChart = (chart: PeriodontalChart) => {
    setLoadedChartId(chart.id);
    setMeasurements(chart.measurements);
    setProfessionalId(chart.professional?.id ?? "");
    setChartDate(new Date(chart.chartDate).toISOString().slice(0, 10));
    setNotes(chart.notes ?? "");
  };

  const createChart = () => {
    if (!professionalId) {
      toast.error("Selecciona un profesional");
      return;
    }
    if (!activeMeasurements.length) {
      toast.error("Captura al menos una medicion periodontal");
      return;
    }
    const measurementsToSave = measurements.length ? measurements : activeMeasurements;
    mutations.createPeriodontalChart.mutate(
      {
        professionalId,
        chartDate: `${chartDate}T00:00:00.000Z`,
        notes: notes || undefined,
        measurements: serializeMeasurements(measurementsToSave)
      },
      {
        onSuccess: (chart) => {
          toast.success("Periodontograma guardado");
          loadChart(chart);
        }
      }
    );
  };

  return (
    <ClinicalShell patientId={id} title="Periodontograma" description="Registro periodontal y comparacion evolutiva por fecha.">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {loadedChartId
              ? `Viendo periodontograma ${loadedChartId.slice(0, 8)}`
              : charts.data?.length
                ? `${charts.data.length} periodontograma(s) previo(s)`
                : "No hay periodontogramas anteriores"}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled>
              <Printer className="h-4 w-4" />
            </Button>
            <Button onClick={createChart} disabled={mutations.createPeriodontalChart.isPending}>
              Guardar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
            <option value="">Profesional</option>
            {professionals.data?.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.firstName} {professional.lastName}
              </option>
            ))}
          </Select>
          <Input type="date" value={chartDate} onChange={(event) => setChartDate(event.target.value)} />
          <Input placeholder="Notas clinicas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </Card>

      <PeriodontalChartTable value={measurements} onChange={setMeasurements} />

      <Card className="space-y-4">
        <h3 className="text-base font-semibold">Historial y comparacion</h3>

        <DataTable
          rows={charts.data ?? []}
          empty={<EmptyState title="Sin periodontogramas" description="Aun no se han registrado periodontogramas para este paciente." />}
          columns={[
            { key: "chartDate", title: "Fecha", render: (row) => new Date(row.chartDate).toLocaleDateString() },
            { key: "professional", title: "Profesional", render: (row) => row.professional ? `${row.professional.firstName} ${row.professional.lastName}` : "-" },
            { key: "notes", title: "Notas" },
            { key: "measurements", title: "Mediciones", render: (row) => String(row.measurements.length) },
            {
              key: "id",
              title: "Acciones",
              render: (row) => (
                <Button type="button" variant={loadedChartId === row.id ? "secondary" : "ghost"} onClick={() => loadChart(row)}>
                  Ver
                </Button>
              )
            }
          ]}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Select value={chartAId} onChange={(event) => setChartAId(event.target.value)}>
            <option value="">Chart A</option>
            {charts.data?.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {new Date(chart.chartDate).toLocaleDateString()} - {chart.id.slice(0, 8)}
              </option>
            ))}
          </Select>
          <Select value={chartBId} onChange={(event) => setChartBId(event.target.value)}>
            <option value="">Chart B</option>
            {charts.data?.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {new Date(chart.chartDate).toLocaleDateString()} - {chart.id.slice(0, 8)}
              </option>
            ))}
          </Select>
        </div>

        {hasComparisonReady ? <PeriodontalComparison comparison={comparison.data} /> : <EmptyState title="Selecciona dos charts" description="Selecciona dos periodontogramas distintos para comparar." />}
      </Card>
    </ClinicalShell>
  );
}
