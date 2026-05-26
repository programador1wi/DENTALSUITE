import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useAgreementDebts, usePayAgreementDebt } from "../hooks/use-admin-workflows";

export function AgreementsDebtsPage() {
  const { data: debts, isLoading, isError, error } = useAgreementDebts();
  const payDebt = usePayAgreementDebt();

  if (isLoading) return <LoadingState message="Cargando reporte de deudas..." />;
  if (isError) return <ErrorState message={error?.message || "Ocurrió un error"} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reporte de Deudas por Convenio"
        description="Consolida el saldo que las empresas/aseguradoras adeudan a la clínica por copagos de tratamientos."
        helpText="Cuando los convenios cubren una parte del tratamiento, la deuda se acumula aquí. Haz clic en Pagar deuda para saldarla y registrar el ingreso."
      />

      <Card>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Deudas Consolidadas</h3>
        <DataTable
          rows={debts ?? []}
          empty={
            <EmptyState
              title="Sin deudas pendientes"
              description="Actualmente no hay aseguradoras ni empresas con saldos pendientes por pagar."
            />
          }
          columns={[
            { key: "companyName", title: "Empresa" },
            { key: "agreementName", title: "Convenio" },
            {
              key: "debt",
              title: "Deuda",
              render: (row) => (
                <span className="font-medium text-slate-900">
                  ${Number(row.debt).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )
            },
            {
              key: "id",
              title: "Pagar",
              render: (row) => (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (confirm(`¿Estás seguro que deseas registrar el pago de $${row.debt} por parte de ${row.companyName}?`)) {
                      payDebt.mutate(row.id);
                    }
                  }}
                  disabled={payDebt.isPending}
                  className="text-sm"
                >
                  Pagar deuda
                </Button>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
