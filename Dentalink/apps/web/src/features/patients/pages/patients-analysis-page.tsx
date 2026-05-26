import { useState } from "react";
import { DentalinkPanel } from "@/components/layout/module-tabs";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

export function PatientsAnalysisPage() {
  const [from, setFrom] = useState("2026-05");
  const [to, setTo] = useState("2026-06");
  const [branchId, setBranchId] = useState("");
  const branches = useBranches(undefined, "ACTIVE");

  return (
    <DentalinkPanel className="min-h-[720px]">
      <PatientsModuleTabs />
      <div className="px-8 py-14 text-center">
        <h1 className="text-xl font-bold uppercase text-[#0784d8]">Conversion de los pacientes</h1>
        <div className="mx-auto my-5 flex max-w-[960px] items-center justify-center">
          <div className="h-px flex-1 bg-slate-200" />
          <div className="mx-4 h-9 w-9 rotate-45 border border-slate-200 bg-[#0784d8]" />
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <p className="mx-auto max-w-[950px] text-[17px] leading-7 text-slate-700">
          Esta grafica representa la conversion de una cita a presupuesto aceptado. Esto quiere decir la cantidad de citas que fueron necesarias para generar un presupuesto y que este fuera aceptado por el paciente.
        </p>

        <div className="mt-16">
          <h2 className="mb-7 text-base font-bold">Filtrar los resultados</h2>
          <div className="flex flex-wrap justify-center gap-1">
            <input className="h-9 w-[170px] border border-slate-300 px-3 text-center" value={to} onChange={(event) => setTo(event.target.value)} />
            <input className="h-9 w-[170px] border border-slate-300 px-3 text-center" value={from} onChange={(event) => setFrom(event.target.value)} />
            <select className="h-9 w-[265px] border border-slate-300 px-3" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Dental + Suc. Puerto Vallarta</option>
              {branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <button className="h-9 rounded bg-[#086ccc] px-5 font-bold text-white">Filtrar</button>
          </div>
          <p className="mt-4 text-sm text-slate-400">Ultima actualizacion: 20/05/26</p>
          <button className="mt-2 text-sm text-[#0784d8]">Actualizar</button>
        </div>

        <div className="mt-12 grid gap-8 text-left md:grid-cols-[280px_1fr]">
          <div>
            <h3 className="mb-3 text-center font-bold">Conversion total del periodo</h3>
            <div className="mx-auto flex h-[180px] w-[230px] items-center justify-center bg-[#337fb9] text-2xl font-bold text-white [clip-path:polygon(0_0,100%_0,75%_100%,25%_100%)]">
              100%
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-center font-bold">Conversion de pacientes a traves del tiempo</h3>
            <svg className="h-[220px] w-full border border-slate-200 bg-white" viewBox="0 0 620 220">
              {[40, 80, 120, 160, 200].map((y) => <line key={y} x1="0" y1={y} x2="620" y2={y} stroke="#ddd" />)}
              {[80, 160, 240, 320, 400, 480, 560].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="220" stroke="#ddd" />)}
              <polyline fill="none" stroke="#2f7ebd" strokeWidth="4" points="0,45 85,75 170,108 260,102 345,94 430,80 515,48 585,150" />
              {[0, 85, 170, 260, 345, 430, 515, 585].map((x, index) => <circle key={x} cx={x} cy={[45,75,108,102,94,80,48,150][index]} r="5" fill="white" stroke="#2f7ebd" strokeWidth="3" />)}
            </svg>
          </div>
        </div>
      </div>
    </DentalinkPanel>
  );
}
