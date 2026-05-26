import { DentalinkPanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePatients } from "../hooks/use-patients";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

export function PatientsOrthodontiaPage() {
  const patients = usePatients({ status: "IN_TREATMENT" });
  const rows = patients.data ?? [];

  if (patients.isError) return <ErrorState message={patients.error.message} />;

  return (
    <DentalinkPanel className="min-h-[720px]">
      <PatientsModuleTabs />
      <div className="p-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] text-slate-700">Pacientes de Ortodoncia en Dental + Suc. Puerto Vallarta</h1>
          <div className="flex gap-2">
            <button className="rounded bg-[#0784d8] px-4 py-2 text-sm font-bold text-white">Descargar reporte</button>
            <button className="rounded border border-slate-300 bg-white px-4 py-2 text-sm">Pantalla completa</button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Pacientes en tratamiento activo", rows.length],
            ["Pacientes Atrasados", rows.filter((row) => !row.hasFutureAppointment).length],
            ["Pacientes sin cita futura", rows.filter((row) => !row.hasFutureAppointment).length],
            ["De 1 a 6 anos", 5],
            ["De 6 a 12 anos", 9],
            ["Mayores de 12 anos", Math.max(rows.length - 14, 0)]
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-base leading-tight text-black">{label}</p>
              <p className="text-[42px] font-bold leading-none text-[#0784d8]">{value}</p>
            </div>
          ))}
        </div>

        {patients.isLoading ? (
          <LoadingState message="Cargando pacientes..." />
        ) : !rows.length ? (
          <EmptyState title="Sin pacientes" description="No hay pacientes de ortodoncia para mostrar." />
        ) : (
          <div className="max-h-[480px] overflow-auto border border-slate-300">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  {["#", "Nombre", "Apellidos", "Sexo", "Edad", "T. Fijo", "T. Movil", "Inicio tratamiento", "Dr.(a) tratante", "Progreso calendario"].map((header) => (
                    <th key={header} className="border-b border-slate-300 px-2 py-3 text-left">v {header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((patient, index) => (
                  <tr key={patient.id} className="border-b border-slate-200 text-slate-600">
                    <td className="px-2 py-3 text-[#0784d8]">{1398 + index}...</td>
                    <td className="px-2 py-3 uppercase text-[#0784d8]">{patient.firstName}</td>
                    <td className="px-2 py-3 uppercase text-[#0784d8]">{patient.lastName}</td>
                    <td className="px-2 py-3">-</td>
                    <td className="px-2 py-3">-</td>
                    <td className="px-2 py-3">-</td>
                    <td className="px-2 py-3">{patient.phone || "-"}</td>
                    <td className="px-2 py-3">20 may. 2026</td>
                    <td className="px-2 py-3">Dr.(a) tratante</td>
                    <td className="px-2 py-3">
                      <span className="mr-2">{index % 2 ? "8%" : "5%"}</span>
                      <span className="inline-block h-4 w-16 rounded-sm border border-[#0784d8] align-middle">
                        <span className="block h-full w-[14%] bg-[#0784d8]" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DentalinkPanel>
  );
}
