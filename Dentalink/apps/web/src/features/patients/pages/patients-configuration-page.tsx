import { useState } from "react";
import { DentalinkPanel } from "@/components/layout/module-tabs";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

const rows = [
  "Nombre legal",
  "Nombre social",
  "Apellidos",
  "CURP/RFC",
  "Email",
  "Convenio",
  "Numero interno",
  "Sexo",
  "Genero",
  "Fecha nacimiento",
  "Telefono movil",
  "Direccion"
];

const groups = [
  "En seccion de nuevo paciente",
  "Al crear paciente agendando",
  "En seccion de agenda online",
  "Al enviar check in"
];

function defaultEnabled(row: string, group: string, kind: "present" | "required") {
  if (row === "Nombre legal" || row === "Apellidos") return true;
  if (group === "En seccion de agenda online" && row === "Email") return true;
  if (group === "Al enviar check in" && ["CURP/RFC", "Email", "Sexo", "Fecha nacimiento"].includes(row)) return kind === "present" || row !== "Email";
  return false;
}

export function PatientsConfigurationPage() {
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const row of rows) {
      for (const group of groups) {
        next[`${row}-${group}-present`] = defaultEnabled(row, group, "present");
        next[`${row}-${group}-required`] = defaultEnabled(row, group, "required");
      }
    }
    return next;
  });

  return (
    <DentalinkPanel>
      <PatientsModuleTabs />
      <div className="p-3">
        <div className="mb-3 rounded border border-sky-200 bg-sky-100 px-4 py-3 text-sm text-sky-800">
          En esta seccion podras decidir <strong>que datos seran obligatorios</strong> al crear un nuevo paciente desde la seccion de nuevo paciente, y que datos seran requeridos al momento de crear un nuevo paciente desde el <strong>proceso de agendamiento.</strong>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-white px-2 py-3" rowSpan={2}>Dato</th>
                {groups.map((group) => (
                  <th key={group} className="border border-slate-200 bg-white px-2 py-3 text-center" colSpan={2}>{group}</th>
                ))}
              </tr>
              <tr>
                {groups.flatMap((group) => [
                  <th key={`${group}-present`} className="border border-slate-200 bg-white px-2 py-3">Presente</th>,
                  <th key={`${group}-required`} className="border border-slate-200 bg-white px-2 py-3">Requerido</th>
                ])}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <td className="border border-slate-200 px-2 py-2">{row} <span className="text-sky-500">i</span></td>
                  {groups.flatMap((group) => (["present", "required"] as const).map((kind) => {
                    const key = `${row}-${group}-${kind}`;
                    return (
                      <td key={key} className="border border-slate-200 px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setState((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold ${
                            state[key] ? "border-[#4db95c] bg-[#4db95c] text-white" : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          v
                        </button>
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DentalinkPanel>
  );
}
