import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DentalinkPanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useDeactivatePatient, usePatients } from "../hooks/use-patients";
import type { PatientListItem } from "../services/patients.service";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

type FilterState = {
  search: string;
  status: string;
  branchId: string;
  treatment: string;
};

const initialFilters: FilterState = {
  search: "",
  status: "",
  branchId: "",
  treatment: ""
};

function patientNumber(patient: PatientListItem, index: number) {
  const numeric = patient.id.replace(/\D/g, "").slice(-5);
  return numeric || String(6700 + index);
}

export function PatientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...initialFilters,
    search: searchParams.get("search") ?? ""
  }));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const branchQuery = useBranches(undefined, "ACTIVE");
  const patientQuery = usePatients({
    search: filters.search || undefined,
    status: filters.status || undefined,
    branchId: filters.branchId || undefined
  });
  const deactivatePatient = useDeactivatePatient();

  useEffect(() => {
    const search = searchParams.get("search") ?? "";
    setFilters((prev) => (prev.search === search ? prev : { ...prev, search }));
  }, [searchParams]);

  const selectedPatient = useMemo(
    () => patientQuery.data?.find((patient) => patient.id === confirmId) ?? null,
    [confirmId, patientQuery.data]
  );

  const onConfirmDeactivate = async () => {
    if (!confirmId) return;
    await deactivatePatient.mutateAsync(confirmId);
    setConfirmId(null);
  };

  const submitFilters = () => {
    const next = new URLSearchParams(searchParams);
    if (filters.search.trim()) next.set("search", filters.search.trim());
    else next.delete("search");
    setSearchParams(next, { replace: true });
  };

  const actions = (
    <Link to="/patients/new">
      <button className="rounded bg-[#49ad50] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3d9944]">
        + Nuevo paciente
      </button>
    </Link>
  );

  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;

  return (
    <DentalinkPanel>
      <PatientsModuleTabs actions={actions} />

      <div className="p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-[360px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0784d8]">Q</span>
            <input
              className="h-10 w-full rounded border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-[#0784d8]"
              placeholder="Buscar por nombre o apellido..."
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitFilters();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded border border-slate-300 px-3 text-sm outline-none"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Habilitados</option>
              <option value="NEW">Nuevos</option>
              <option value="ACTIVE">Activos</option>
              <option value="IN_TREATMENT">En tratamiento</option>
              <option value="DEBTOR">Morosos</option>
            </select>
            <select
              className="h-10 rounded border border-slate-300 px-3 text-sm outline-none"
              value={filters.branchId}
              onChange={(event) => setFilters((prev) => ({ ...prev, branchId: event.target.value }))}
            >
              <option value="">Numero</option>
              {branchQuery.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select
              className="h-10 rounded border-0 bg-white px-3 text-sm text-[#0784d8] outline-none"
              value={filters.treatment}
              onChange={(event) => setFilters((prev) => ({ ...prev, treatment: event.target.value }))}
            >
              <option value="">Tratamiento</option>
              <option value="ortodoncia">Ortodoncia</option>
              <option value="general">General</option>
            </select>
            <button className="h-10 rounded bg-[#8bcf8f] px-5 text-sm font-bold text-white" type="button" onClick={submitFilters}>
              Buscar
            </button>
          </div>
        </div>

        {patientQuery.isLoading ? (
          <LoadingState message="Cargando pacientes..." />
        ) : !patientQuery.data?.length ? (
          <EmptyState title="Sin pacientes" description="No hay pacientes para los filtros seleccionados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#0893c7] text-left text-white">
                  <th className="w-[120px] px-3 py-3">#</th>
                  <th className="px-3 py-3">Nombre ^</th>
                  <th className="px-3 py-3">Apellidos</th>
                  <th className="px-3 py-3">Tratamientos</th>
                  <th className="px-3 py-3">Deudas</th>
                  <th className="w-[48px] px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {(patientQuery.data ?? []).map((patient, index) => (
                  <tr key={patient.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-4 text-slate-700">{patientNumber(patient, index)}</td>
                    <td className="px-3 py-4">
                      <Link to={`/patients/${patient.id}/profile`} className="font-medium uppercase text-[#0784d8] hover:underline">
                        {patient.firstName || "-"}
                      </Link>
                      <div className="text-xs text-slate-500">{patient.phone || patient.email || ""}</div>
                    </td>
                    <td className="px-3 py-4 uppercase text-slate-700">{patient.lastName || "-"}</td>
                    <td className="px-3 py-4 text-center">{patient.status === "IN_TREATMENT" ? 3 : 1}</td>
                    <td className="px-3 py-4">{patient.hasDebt ? "$ Pendiente" : "No tiene"}</td>
                    <td className="px-3 py-4 text-center">
                      <button
                        className="text-xl font-bold text-slate-500"
                        type="button"
                        title="Desactivar"
                        onClick={() => setConfirmId(patient.id)}
                      >
                        ...
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Desactivar paciente"
        description={
          selectedPatient
            ? `Se desactivara a ${selectedPatient.firstName} ${selectedPatient.lastName}. Esta accion aplica baja logica.`
            : "Se desactivara el paciente seleccionado."
        }
        confirmLabel={deactivatePatient.isPending ? "Desactivando..." : "Desactivar"}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => void onConfirmDeactivate()}
      />
    </DentalinkPanel>
  );
}
