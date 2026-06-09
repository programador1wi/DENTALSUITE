import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { PatientSearchBox, getPatientSearchLabel } from "@/features/patients/components/patient-search-box";
import { useAccountsReceivable } from "../hooks/use-payments";

export function AccountsReceivablePage() {
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const { branchId, setBranchId } = useActiveBranchFilter();
  const branches = useBranches(undefined, "ACTIVE");
  const accountsReceivable = useAccountsReceivable({
    patientId: patientId || undefined,
    search: search || undefined,
    branchId: branchId || undefined
  });

  if (accountsReceivable.isLoading) return <LoadingState message="Cargando cuentas por cobrar..." />;
  if (accountsReceivable.isError) return <ErrorState message={accountsReceivable.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas por cobrar"
        description="Pacientes con saldo pendiente y cuotas vencidas."
        helpText="Muestra el listado consolidado de pacientes que poseen saldos deudores o cuotas de financiamiento vencidas en la clínica. Te permite realizar un seguimiento preventivo y contactar a los pacientes para regularizar su situación."
      />

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <div className="flex items-center gap-1.5 w-full">
          <PatientSearchBox
            placeholder="Buscar paciente" 
            value={search} 
            onValueChange={(value) => {
              setSearch(value);
              setPatientId("");
            }}
            onSelect={(patient) => {
              setSearch(getPatientSearchLabel(patient));
              setPatientId(patient.id);
            }}
            className="flex-1"
          />
          <HelpTooltip content="Busca pacientes por nombre, apellido o RUT/DNI para consultar su estado y saldo deudor." />
        </div>

        <div className="flex items-center gap-1.5 w-full">
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="flex-1">
            <option value="">Sucursal activa</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <HelpTooltip content="Filtra los pacientes con deudas activas según la sucursal física donde realizaron o planificaron sus tratamientos." />
        </div>
      </div>

      <DataTable
        rows={accountsReceivable.data ?? []}
        empty={<EmptyState title="Sin saldos pendientes" description="No hay pacientes con deuda para los filtros seleccionados." />}
        columns={[
          { key: "fullName", title: "Paciente" },
          { key: "branchName", title: "Sucursal" },
          { key: "plannedAmount", title: "Planificado", render: (row) => row.plannedAmount.toFixed(2) },
          { key: "allocatedPaidAmount", title: "Pagado aplicado", render: (row) => row.allocatedPaidAmount.toFixed(2) },
          {
            key: "outstandingAmount",
            title: (
              <span className="flex items-center gap-1.5">
                Saldo
                <HelpTooltip content="Representa el saldo deudor actual neto (Monto planificado del tratamiento menos los pagos reales aplicados por el paciente)." />
              </span>
            ),
            render: (row) => row.outstandingAmount.toFixed(2)
          },
          {
            key: "overdueInstallments",
            title: (
              <span className="flex items-center gap-1.5">
                Cuotas vencidas
                <HelpTooltip content="Cantidad de cuotas de financiamiento activas que ya superaron su fecha límite de pago sin haber sido saldadas." />
              </span>
            )
          }
        ]}
      />
    </div>
  );
}
