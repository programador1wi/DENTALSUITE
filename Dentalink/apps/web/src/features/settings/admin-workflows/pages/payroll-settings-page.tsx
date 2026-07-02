import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Download, RefreshCcw } from "lucide-react";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  useFinalizedPayroll,
  useFinalizePayroll,
  usePayroll,
  useRecalculatePayroll
} from "../hooks/use-admin-workflows";
import type { FinalizedPayroll, PayrollItem, PayrollSummary } from "../services/admin-workflows.service";

type PayrollView = "active" | "finalized";

function money(value: number | string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2
  }).format(Number(value));
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("es-MX") : "-";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("es-MX") : "-";
}

function downloadCsv(filename: string, rows: Array<Array<string | number | boolean>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function activeMatches(row: PayrollSummary, search: string) {
  const query = search.trim().toLowerCase();
  return (
    row.professionalName.toLowerCase().includes(query) ||
    row.items.some((item) => [item.patientName, item.action, item.treatmentNumber].join(" ").toLowerCase().includes(query))
  );
}

function finalizedName(row: FinalizedPayroll) {
  return `${row.professional.firstName} ${row.professional.lastName}`.trim();
}

function finalizedMatches(row: FinalizedPayroll, search: string) {
  const query = search.trim().toLowerCase();
  return (
    finalizedName(row).toLowerCase().includes(query) ||
    row.items.some((item) => [item.patientName, item.action, item.treatmentNumber].join(" ").toLowerCase().includes(query))
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-4)] py-[var(--space-3)]">
      <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-[var(--space-1)] text-[var(--text-xl)] font-semibold text-[var(--text-brand-strong)]">{value}</p>
    </div>
  );
}

function PayrollItemsTable({ items }: { items: PayrollItem[] }) {
  return (
    <Table containerClassName="rounded-[var(--radius-md)]">
      <TableHead>
        <TableRow>
          <TableHeader>Trat.</TableHeader>
          <TableHeader wrap>Explicar</TableHeader>
          <TableHeader>Paciente</TableHeader>
          <TableHeader wrap>Accion</TableHeader>
          <TableHeader>Fecha</TableHeader>
          <TableHeader>Monto</TableHeader>
          <TableHeader>Medio de pago</TableHeader>
          <TableHeader>Total</TableHeader>
          <TableHeader>Estado</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.treatmentPlanItemId}>
            <TableCell className="font-medium text-[var(--text-brand-strong)]">{item.treatmentNumber}</TableCell>
            <TableCell wrap>{item.calculationExplanation}</TableCell>
            <TableCell>{item.patientName}</TableCell>
            <TableCell wrap>
              <span className="font-medium">{item.action}</span>
              <span className="block text-[var(--text-xs)] text-[var(--text-secondary)]">
                {item.procedureCode}
                {item.toothNumber ? ` - Pieza ${item.toothNumber}` : ""}
              </span>
              <span className="block text-[var(--text-xs)] text-[var(--text-secondary)]">
                {item.priceSource === "PRICE_LIST" ? "Arancel" : item.priceSource === "UNPRICED" ? "Sin precio" : "Manual"}
                {item.priceSnapshotName ? ` - ${item.priceSnapshotName}` : ""}
                {item.priceSnapshotCategory ? ` - ${item.priceSnapshotCategory}` : ""}
              </span>
            </TableCell>
            <TableCell>{formatDate(item.completedAt)}</TableCell>
            <TableCell>{money(item.collectedAmount)}</TableCell>
            <TableCell>{item.paymentMethods}</TableCell>
            <TableCell className="font-semibold">{money(item.payableAmount)}</TableCell>
            <TableCell>
              <Badge value={item.cashValidated ? "VALIDA" : "SIN CAJA"} tone={item.cashValidated ? "success" : "warning"} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PayrollSettingsPage() {
  const [view, setView] = useState<PayrollView>("active");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const { branchId, setBranchId } = useActiveBranchFilter();
  const branches = useBranches(undefined, "ACTIVE");
  const payroll = usePayroll(branchId || undefined);
  const finalized = useFinalizedPayroll(branchId || undefined);
  const finalize = useFinalizePayroll();
  const recalculate = useRecalculatePayroll();

  const activeRows = useMemo(
    () => (payroll.data ?? []).filter((row) => activeMatches(row, search)),
    [payroll.data, search]
  );
  const finalizedRows = useMemo(
    () => (finalized.data ?? []).filter((row) => finalizedMatches(row, search)),
    [finalized.data, search]
  );
  const activeTotals = useMemo(
    () => ({
      professionals: activeRows.length,
      items: activeRows.reduce((sum, row) => sum + row.completedItems, 0),
      payable: activeRows.reduce((sum, row) => sum + row.payableAmount, 0)
    }),
    [activeRows]
  );
  const finalizedTotals = useMemo(
    () => ({
      liquidations: finalizedRows.length,
      items: finalizedRows.reduce((sum, row) => sum + row.completedItems, 0),
      payable: finalizedRows.reduce((sum, row) => sum + Number(row.payableAmount), 0)
    }),
    [finalizedRows]
  );
  const payrollSearchRows = useMemo(
    () =>
      view === "active"
        ? activeRows.map((row) => ({
            id: row.professionalId,
            name: row.professionalName,
            detail: `${row.completedItems} prestaciones - ${money(row.payableAmount)}`
          }))
        : finalizedRows.map((row) => ({
            id: row.id,
            name: finalizedName(row),
            detail: `${formatDate(row.finalizedAt)} - ${money(row.payableAmount)}`
          })),
    [activeRows, finalizedRows, view]
  );

  const download = (target: string) => {
    if (target === "active") {
      downloadCsv("liquidaciones-activas.csv", [
        ["Profesional", "Comision", "Prestaciones", "Pendientes", "Cobrado", "A pagar", "Ultima prestacion"],
        ...activeRows.map((row) => [
          row.professionalName,
          row.commissionRate,
          row.completedItems,
          row.pendingItems,
          row.collectedAmount,
          row.payableAmount,
          row.lastCompletedAt ? formatDate(row.lastCompletedAt) : ""
        ])
      ]);
      return;
    }

    if (target === "active-detail") {
      downloadCsv("detalle-liquidaciones-activas.csv", [
        ["Trat.", "Explicar", "Paciente", "Accion", "Fecha", "Monto", "Medio de pago", "Total", "Caja validada"],
        ...activeRows.flatMap((row) =>
          row.items.map((item) => [
            item.treatmentNumber,
            item.calculationExplanation,
            item.patientName,
            item.action,
            formatDate(item.completedAt),
            item.collectedAmount,
            item.paymentMethods,
            item.payableAmount,
            item.cashValidated
          ])
        )
      ]);
      return;
    }

    downloadCsv("liquidaciones-finalizadas.csv", [
      ["Profesional", "Sucursal", "Fecha finalizacion", "Prestaciones", "Cobrado", "A pagar", "Finalizada por"],
      ...finalizedRows.map((row) => [
        finalizedName(row),
        row.branch?.name ?? "Todas",
        formatDateTime(row.finalizedAt),
        row.completedItems,
        Number(row.collectedAmount),
        Number(row.payableAmount),
        `${row.finalizedBy.firstName} ${row.finalizedBy.lastName}`.trim()
      ])
    ]);
  };

  const finalizeAll = async () => {
    for (const row of activeRows) {
      if (row.payableAmount > 0) {
        await finalize.mutateAsync({ professionalId: row.professionalId, branchId: branchId || undefined });
      }
    }
  };

  const recalculateAll = () => {
    void recalculate.mutateAsync({ branchId: branchId || undefined });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <PageHeader
        title="Nominas"
        description="Liquidaciones activas y finalizadas por profesional."
        helpText="Dentalink calcula honorarios desde prestaciones completadas, pagos asignados y la comision vigente del profesional."
      />

      <Card className="space-y-[var(--space-4)]">
        <div className="grid gap-[var(--space-3)] md:grid-cols-3">
          {view === "active" ? (
            <>
              <Metric label="Profesionales activos" value={String(activeTotals.professionals)} />
              <Metric label="Prestaciones validas" value={String(activeTotals.items)} />
              <Metric label="Total a pagar" value={money(activeTotals.payable)} />
            </>
          ) : (
            <>
              <Metric label="Liquidaciones" value={String(finalizedTotals.liquidations)} />
              <Metric label="Prestaciones cerradas" value={String(finalizedTotals.items)} />
              <Metric label="Total finalizado" value={money(finalizedTotals.payable)} />
            </>
          )}
        </div>

        <div className="flex flex-col gap-[var(--space-3)] xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-end">
            <Tabs
              active={view}
              onChange={(next) => {
                setView(next as PayrollView);
                setExpandedId("");
              }}
              items={[
                { key: "active", label: "Activas" },
                { key: "finalized", label: "Finalizadas" }
              ]}
            />
            <div className="w-full sm:w-60">
              <Dropdown
                placeholder="Descargar..."
                options={[
                  { label: "Activas resumen", value: "active" },
                  { label: "Activas detalle", value: "active-detail" },
                  { label: "Finalizadas", value: "finalized" }
                ]}
                onChange={download}
              />
            </div>
          </div>

          <label className="text-[var(--text-sm)] text-[var(--text-primary)] xl:w-72">
            Sucursal
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex flex-col gap-[var(--space-2)] lg:flex-row lg:items-center lg:justify-between">
          <EntitySearchBox
            placeholder="Buscar profesional, paciente o tratamiento"
            value={search}
            onValueChange={setSearch}
            items={search.trim() ? payrollSearchRows : []}
            onSelect={(row) => setSearch(row.name)}
            getItemKey={(row) => row.id}
            emptyMessage="Sin liquidaciones encontradas"
            renderItem={(row) => (
              <div className="min-w-0">
                <p className="truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{row.name}</p>
                <p className="mt-0.5 truncate text-[var(--text-xs)] text-[var(--text-secondary)]">{row.detail}</p>
              </div>
            )}
            className="lg:max-w-md"
          />
          {view === "active" ? (
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <Button variant="secondary" disabled={recalculate.isPending} onClick={recalculateAll}>
                <RefreshCcw className="h-4 w-4" /> Recalcular
              </Button>
              <Button variant="secondary" onClick={() => download("active-detail")}>
                <Download className="h-4 w-4" /> Detalle CSV
              </Button>
              <Button disabled={finalize.isPending || !activeRows.some((row) => row.payableAmount > 0)} onClick={() => void finalizeAll()}>
                <CheckCircle2 className="h-4 w-4" /> Finalizar todas
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => download("finalized")}>
              <Download className="h-4 w-4" /> Descargar
            </Button>
          )}
        </div>
      </Card>

      {view === "active" ? (
        <>
          {payroll.isLoading ? <LoadingState message="Calculando nominas activas..." /> : null}
          {payroll.isError ? <ErrorState message={payroll.error.message} /> : null}
          {payroll.data ? (
            activeRows.length ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Profesional</TableHeader>
                    <TableHeader>Fecha</TableHeader>
                    <TableHeader>Realizado</TableHeader>
                    <TableHeader>A pagar</TableHeader>
                    <TableHeader>Prestaciones</TableHeader>
                    <TableHeader>Estado</TableHeader>
                    <TableHeader>Acciones</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeRows.map((row) => {
                    const expanded = expandedId === row.professionalId;
                    return (
                      <Fragment key={row.professionalId}>
                        <TableRow>
                          <TableCell className="font-semibold">
                            <button
                              type="button"
                              className="inline-flex items-center gap-[var(--space-2)] text-left text-[var(--text-brand-strong)]"
                              aria-expanded={expanded}
                              onClick={() => setExpandedId(expanded ? "" : row.professionalId)}
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {row.professionalName}
                            </button>
                            <span className="block text-[var(--text-xs)] font-normal text-[var(--text-secondary)]">
                              Comision {row.commissionRate}%
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(row.lastCompletedAt)}</TableCell>
                          <TableCell>{money(row.collectedAmount)}</TableCell>
                          <TableCell className="font-semibold">{money(row.payableAmount)}</TableCell>
                          <TableCell>{row.completedItems}</TableCell>
                          <TableCell>
                            <Badge value={row.pendingItems ? `${row.pendingItems} pendientes` : "ACTIVA"} tone={row.pendingItems ? "warning" : "success"} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-[var(--space-2)]">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={recalculate.isPending}
                                onClick={() => void recalculate.mutateAsync({ professionalId: row.professionalId, branchId: branchId || undefined })}
                              >
                                <RefreshCcw className="h-4 w-4" /> Recalcular
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={finalize.isPending || row.payableAmount <= 0}
                                onClick={() => void finalize.mutateAsync({ professionalId: row.professionalId, branchId: branchId || undefined })}
                              >
                                Finalizar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <tr key={`${row.professionalId}-detail`}>
                            <td className="bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-4)]" colSpan={7}>
                              <PayrollItemsTable items={row.items} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Sin liquidaciones activas" description="No hay prestaciones completadas y pagadas listas para liquidacion." />
            )
          ) : null}
        </>
      ) : (
        <>
          {finalized.isLoading ? <LoadingState message="Cargando liquidaciones finalizadas..." /> : null}
          {finalized.isError ? <ErrorState message={finalized.error.message} /> : null}
          {finalized.data ? (
            finalizedRows.length ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Profesional</TableHeader>
                    <TableHeader>Sucursal</TableHeader>
                    <TableHeader>Fecha finalizacion</TableHeader>
                    <TableHeader>Prestaciones</TableHeader>
                    <TableHeader>Realizado</TableHeader>
                    <TableHeader>A pagar</TableHeader>
                    <TableHeader>Finalizada por</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {finalizedRows.map((row) => {
                    const expanded = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <TableRow>
                          <TableCell className="font-semibold">
                            <button
                              type="button"
                              className="inline-flex items-center gap-[var(--space-2)] text-left text-[var(--text-brand-strong)]"
                              aria-expanded={expanded}
                              onClick={() => setExpandedId(expanded ? "" : row.id)}
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {finalizedName(row)}
                            </button>
                            <span className="block text-[var(--text-xs)] font-normal text-[var(--text-secondary)]">
                              Comision congelada {row.commissionRate}%
                            </span>
                          </TableCell>
                          <TableCell>{row.branch?.name ?? "Todas"}</TableCell>
                          <TableCell>{formatDateTime(row.finalizedAt)}</TableCell>
                          <TableCell>{row.completedItems}</TableCell>
                          <TableCell>{money(row.collectedAmount)}</TableCell>
                          <TableCell className="font-semibold">{money(row.payableAmount)}</TableCell>
                          <TableCell>{`${row.finalizedBy.firstName} ${row.finalizedBy.lastName}`.trim()}</TableCell>
                        </TableRow>
                        {expanded ? (
                          <tr key={`${row.id}-detail`}>
                            <td className="bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-4)]" colSpan={7}>
                              <PayrollItemsTable items={row.items} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Sin liquidaciones finalizadas" description="Finaliza una liquidacion activa para verla aqui." />
            )
          ) : null}
        </>
      )}
    </div>
  );
}
