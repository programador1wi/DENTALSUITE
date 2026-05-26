import { Copy } from "lucide-react";
import { Select } from "@/components/ui/select";
import { OnlineSchedulingNav } from "../components/online-scheduling-nav";
import { SchedulingConfigSection } from "../components/scheduling-config-section";

export function AgendaExpressTab() {
  return (
    <OnlineSchedulingNav>
      <div className="px-5 py-4">
        <h2 className="mb-2 text-sm font-bold text-slate-800">Direccion de Agendamiento Express:</h2>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <Select className="border-slate-300 md:w-64">
            <option>Todas las Sucursales</option>
          </Select>
          <div className="flex flex-1 overflow-hidden rounded border border-slate-300">
            <input
              readOnly
              className="flex-1 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              value="https://ff.healthatom.io/GtPq0L"
            />
            <button type="button" className="bg-slate-800 px-3 text-white hover:bg-slate-700" title="Copiar link" aria-label="Copiar link">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <SchedulingConfigSection mode="express" />
      </div>
    </OnlineSchedulingNav>
  );
}
