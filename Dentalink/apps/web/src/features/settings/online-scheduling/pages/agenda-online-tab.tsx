import { Copy } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Select } from "@/components/ui/select";
import { OnlineSchedulingNav } from "../components/online-scheduling-nav";
import { SchedulingConfigSection } from "../components/scheduling-config-section";
import { http } from "@/lib/api/http-client";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";

export function AgendaOnlineTab() {
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const { data: config } = useQuery({
    queryKey: ["online-scheduling-config-online"],
    queryFn: async () => {
      const { data } = await http.get("/online-scheduling/config?mode=ONLINE");
      return data;
    }
  });
  
  const { data: professionals = [] } = useProfessionals();

  const baseUrl = window.location.origin;
  const linkUrl = config?.slug 
    ? `${baseUrl}/book/${config.slug}${selectedProfessional ? `?professional=${selectedProfessional}` : ''}`
    : `${baseUrl}/book/loading...`;

  const copyLink = () => {
    navigator.clipboard.writeText(linkUrl);
  };

  return (
    <OnlineSchedulingNav>
      <div className="px-5 py-4">
        <h2 className="mb-2 text-sm font-bold text-slate-800">Dirección de Agendamiento:</h2>
        <div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row">
          <Select 
            className="border-slate-300"
            containerClassName="md:w-64 md:shrink-0"
            value={selectedProfessional}
            onChange={(e) => setSelectedProfessional(e.target.value)}
          >
            <option value="">Todos los Profesionales</option>
            {professionals.filter(p => p.isActive).map(p => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </Select>
          <div className="flex min-w-0 flex-1 overflow-hidden rounded border border-slate-300">
            <input
              readOnly
              className="min-w-0 flex-1 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              value={linkUrl}
            />
            <HelpTooltip content="Copiar link" position="left">
              <button onClick={copyLink} type="button" className="bg-slate-800 px-3 text-white hover:bg-slate-700" aria-label="Copiar link">
                <Copy className="h-4 w-4" />
              </button>
            </HelpTooltip>
          </div>
        </div>
        <SchedulingConfigSection mode="online" />
      </div>
    </OnlineSchedulingNav>
  );
}
