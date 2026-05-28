import { useMemo, useState } from "react";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useFinalizedPayroll, useFinalizePayroll, usePayroll } from "../hooks/use-admin-workflows";
import type { FinalizedPayroll, PayrollSummary } from "../services/admin-workflows.service";

type PayrollView = "active" | "finalized";

function money(value: number | string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2
  }).format(Number(value));
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
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
  return row.professionalName.toLowerCase().includes(search.trim().toLowerCase());
}

function finalizedName(row: FinalizedPayroll) {
  return `${row.professional.firstName} ${row.professional.lastName}`.trim();
}

function finalizedMatches(row: FinalizedPayroll, search: string) {
  return finalizedName(row).toLowerCase().includes(search.trim().toLowerCase());
}

export function PayrollSettingsPage() {
  const [view, setView] = useState<PayrollView>("active");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const branches = useBranches(undefined, "ACTIVE");
  const payroll = usePayroll(branchId || undefined);
  const finalized = useFinalizedPayroll(branchId || undefined);
  const finalize = useFinalizePayroll();

  const activeRows = useMemo(
    () => (payroll.data ?? []).filter((row) => activeMatches(row, search)),
    [payroll.data, search]
  );
  const finalizedRows = useMemo(
    () => (finalized.data ?? []).filter((row) => finalizedMatches(row, search)),
    [finalized.data, search]
  );

  const download = (target: string) => {
    if (target === "active") {
      downloadCsv("liquidaciones-activas.csv", [
        ["Profesional", "Comision", "Prestaciones", "Cobrado", "A pagar", "Ultima prestacion"],
        ...activeRows.map((row) => [
          row.professionalName,
          row.commissionRate,
          row.completedItems,
          row.collectedAmount,
          row.payableAmount,
          row.lastCompletedAt ? new Date(row.lastCompletedAt).toLocaleDateString() : ""
        ])
      ]);
      return;
    }

    downloadCsv("liquidaciones-finalizadas.csv", [
      ["Profesional", "Sucursal", "Fecha finalizacion", "Prestaciones", "Cobrado", "A pagar", "Finalizada por"],
      ...finalizedRows.map((row) => [
        finalizedName(row),
        row.branch?.name ?? "Todas",
        new Date(row.finalizedAt).toLocaleString(),
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nominas"
        description="Liquidaciones activas y finalizadas por profesional."
        helpText="Warner Suite separa las liquidaciones activas de las finalizadas. Al finalizar se congela el resumen de prestaciones pagadas que pasan a pago del profesional."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Tabs
              active={view}
              onChange={(next) => setView(next as PayrollView)}
              items={[
                { key: "active", label: "Activas" },
                { key: "finalized", label: "Finalizadas" }
              ]}
            />
            <div className="w-full sm:w-52">
              <Dropdown
                placeholder="Descargar..."
                options={[
                  { label: "Liquidaciones activas", value: "active" },
                  { label: "Liquidaciones finalizadas", value: "finalized" }
                ]}
                onChange={download}
              />
            </div>
          </div>

          <label className="text-sm text-slate-700 xl:w-72">
            Sucursal
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {view === "active"
            ? `Mostrando liquidaciones activas hasta el ${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}.`
            : "Mostrando liquidaciones finalizadas guardadas para pago y descarga."}
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <Input
            placeholder="Buscar por nombre o apellidos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="lg:max-w-sm"
          />
          {view === "active" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => download("active")}>
                Descargar activas
              </Button>
              <Button disabled={finalize.isPending || !activeRows.some((row) => row.payableAmount > 0)} onClick={() => void finalizeAll()}>
                Finalizar todas
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {view === "active" ? (
        <>
          {payroll.isLoading ? <LoadingState message="Calculando nominas activas..." /> : null}
          {payroll.isError ? <ErrorState message={payroll.error.message} /> : null}
          {payroll.data ? (
            <DataTable
              rows={activeRows}
              empty={<EmptyState title="Sin liquidaciones activas" description="No hay prestaciones cobradas listas para liquidacion." />}
              columns={[
                { key: "professionalName", title: "Profesional" },
                { key: "lastCompletedAt", title: "Fecha", render: (row) => row.lastCompletedAt ? new Date(row.lastCompletedAt).toLocaleDateString() : "-" },
                { key: "collectedAmount", title: "Realizado", render: (row) => money(row.collectedAmount) },
                { key: "payableAmount", title: "A pagar", render: (row) => money(row.payableAmount) },
                { key: "completedItems", title: "Prestaciones", render: (row) => String(row.completedItems) },
                {
                  key: "commissionRate",
                  title: "Estado",
                  render: (row) => <Badge value={row.payableAmount > 0 ? "ACTIVA" : "SIN MONTO"} tone={row.payableAmount > 0 ? "success" : "warning"} />
                },
                {
                  key: "professionalId",
                  title: "Finalizar",
                  render: (row) => (
                    <Button
                      disabled={finalize.isPending || row.payableAmount <= 0}
                      onClick={() => void finalize.mutateAsync({ professionalId: row.professionalId, branchId: branchId || undefined })}
                    >
                      Finalizar
                    </Button>
                  )
                }
              ]}
            />
          ) : null}
        </>
      ) : (
        <>
          {finalized.isLoading ? <LoadingState message="Cargando liquidaciones finalizadas..." /> : null}
          {finalized.isError ? <ErrorState message={finalized.error.message} /> : null}
          {finalized.data ? (
            <DataTable
              rows={finalizedRows}
              empty={<EmptyState title="Sin liquidaciones finalizadas" description="Finaliza una liquidacion activa para verla aqui." />}
              columns={[
                { key: "professional", title: "Profesional", render: (row) => finalizedName(row) },
                { key: "branch", title: "Sucursal", render: (row) => row.branch?.name ?? "Todas" },
                { key: "finalizedAt", title: "Fecha finalizacion", render: (row) => new Date(row.finalizedAt).toLocaleString() },
                { key: "completedItems", title: "Prestaciones", render: (row) => String(row.completedItems) },
                { key: "collectedAmount", title: "Realizado", render: (row) => money(row.collectedAmount) },
                { key: "payableAmount", title: "A pagar", render: (row) => money(row.payableAmount) },
                {
                  key: "finalizedBy",
                  title: "Finalizada por",
                  render: (row) => `${row.finalizedBy.firstName} ${row.finalizedBy.lastName}`.trim()
                }
              ]}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
