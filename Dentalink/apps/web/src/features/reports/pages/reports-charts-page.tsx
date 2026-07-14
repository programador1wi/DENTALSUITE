import { useMemo, useState } from "react";
import { BarChart3, Play, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { requestChartReport, useChartsCatalog } from "../hooks/use-reports";
import type { GeneratedChartReport } from "../services/reports.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function valueKey(row?: Record<string, number | string>) {
  if (!row) return "value";
  if ("amount" in row) return "amount";
  if ("value" in row) return "value";
  return Object.keys(row).find((key) => typeof row[key] === "number") ?? "value";
}

export function ReportsChartsPage() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("results");
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [branchId, setBranchId] = useState("");
  const [criteria, setCriteria] = useState("");
  const [result, setResult] = useState<GeneratedChartReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const catalog = useChartsCatalog();
  const branches = useBranches(undefined, "ACTIVE");
  const filteredCatalog = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (catalog.data ?? []).filter((item) => !needle || `${item.title} ${item.description}`.toLowerCase().includes(needle));
  }, [catalog.data, search]);
  const selected = catalog.data?.find((item) => item.type === selectedType);
  const chartKey = valueKey(result?.chart[0]);

  async function generate() {
    setError("");
    setLoading(true);
    try {
      const data = await requestChartReport(selectedType, {
        preset: "custom",
        dateFrom,
        dateTo,
        branchId: branchId || undefined,
        currency: "MXN",
        criteria
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "No se pudo generar el reporte grafico");
    } finally {
      setLoading(false);
    }
  }

  if (catalog.isLoading) return <LoadingState message="Cargando catalogo de reportes graficos..." />;
  if (catalog.isError) return <ErrorState message={catalog.error.message} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Reportes graficos" description="Catalogo analitico independiente. Las consultas se ejecutan solo al pulsar Generar." />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar reporte grafico" />
            </div>
          </Card>

          <div className="max-h-[720px] space-y-2 overflow-auto pr-1">
            {filteredCatalog.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedType(item.type)}
                className={`w-full rounded-[var(--radius-md)] border bg-[var(--bg-surface)] p-3 text-left transition hover:border-[var(--border-strong)] ${selectedType === item.type ? "border-[var(--action-primary)] ring-2 ring-emerald-500/10" : "border-[var(--border-default)]"}`}
              >
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{item.title}</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{item.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{selected?.title ?? "Reporte grafico"}</h2>
                  <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{selected?.description}</p>
                </div>
              </div>
              <HelpTooltip content="Cada reporte usa organizationId, sucursales autorizadas, rango de fechas, zona horaria y moneda. No se consulta informacion pesada hasta pulsar Generar." />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Fecha inicial" />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Fecha final" />
              <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Sucursal">
                <option value="">Todas las sucursales autorizadas</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
              <Input value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="Criterio especifico opcional" />
            </div>

            <Button type="button" onClick={generate} disabled={loading}>
              <Play className="h-4 w-4" />
              {loading ? "Generando..." : "Generar"}
            </Button>
          </Card>

          {error ? <ErrorState message={error} /> : null}
          {loading ? <LoadingState message="Generando reporte grafico..." /> : null}

          {!loading && result ? (
            <div className="space-y-4">
              <Card>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{result.title}</h3>
                    <p className="text-[13px] text-[var(--text-secondary)]">{result.description}</p>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {result.filters.branchName} · {new Date(result.filters.dateFrom).toLocaleDateString()} - {new Date(result.filters.dateTo).toLocaleDateString()}
                  </p>
                </div>
                {result.chart.length ? (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={result.chart.slice(0, 16)}>
                        <CartesianGrid stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey={chartKey} fill="#0f766e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="Sin grafica" description="Este reporte entrega principalmente detalle tabular." />
                )}
              </Card>

              <Card>
                <h3 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">Detalle</h3>
                <DataTable
                  rows={result.rows as unknown as Record<string, unknown>[]}
                  empty={<EmptyState title="Sin datos" description="No hay datos para los filtros seleccionados." />}
                  columns={Object.keys(result.rows[0] ?? { empty: "" }).slice(0, 6).map((key) => ({ key, title: key }))}
                  responsiveCards
                />
              </Card>
            </div>
          ) : !loading ? (
            <EmptyState title="Selecciona filtros y genera" description="Los reportes graficos no cargan consultas pesadas automaticamente." />
          ) : null}
        </div>
      </div>
    </div>
  );
}
