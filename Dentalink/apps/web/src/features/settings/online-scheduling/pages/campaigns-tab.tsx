import { ListTodo, Copy } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OnlineSchedulingDrawer } from "../components/online-scheduling-drawer";
import { OnlineSchedulingNav } from "../components/online-scheduling-nav";
import { getCampaigns, createCampaign, deleteCampaign, type OnlineSchedulingCampaign } from "../services/online-scheduling.service";
import { http } from "@/lib/api/http-client";

type Campaign = {
  code: string;
  name: string;
  professionalId: string;
};

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CampaignsTab() {
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({name: "", code: "", professionalId: ""});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const professionals = useProfessionals(undefined, "true", { branchId: activeBranchId || undefined, pageSize: 100 });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['online-scheduling-campaigns'],
    queryFn: getCampaigns
  });

  const { data: config } = useQuery({
    queryKey: ["online-scheduling-config-online"],
    queryFn: async () => {
      const { data } = await http.get("/online-scheduling/config?mode=ONLINE");
      return data;
    }
  });

  const baseUrl = window.location.origin;

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-scheduling-campaigns'] });
      setIsCreating(false);
      setFormData({name: "", code: "", professionalId: ""});
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['online-scheduling-campaigns'] })
  });

  const handleCreate = () => {
    if (formData.name && formData.code) {
      createMutation.mutate({
        name: formData.name,
        code: formData.code,
        professionalId: formData.professionalId || undefined
      });
    }
  };

  return (
    <OnlineSchedulingNav>
      {!isCreating ? (
        campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 min-h-[500px]">
            <div className="w-16 h-12 bg-slate-100 rounded flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
              <ListTodo className="h-8 w-8 text-slate-300" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-300 mb-2">No existen campañas</h2>
            <p className="text-slate-300 text-sm mb-6">Para crear una nueva campaña haz click en:</p>
            <Button onClick={() => setIsCreating(true)} className="bg-[#5cb85c] hover:bg-[#4cae4c] text-white px-6">
              + Crear nueva campaña
            </Button>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">Tus Campañas Activas</h2>
              <Button onClick={() => setIsCreating(true)} className="bg-[#5cb85c] hover:bg-[#4cae4c] text-white px-4">
                + Crear nueva campaña
              </Button>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Profesional Asociado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {campaigns.map((camp) => {
                    const linkUrl = config?.slug 
                      ? `${baseUrl}/book/${config.slug}?campaign=${camp.code}${camp.professionalId ? `&professional=${camp.professionalId}` : ''}`
                      : `${baseUrl}/book/loading...`;

                    return (
                      <tr key={camp.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{camp.name}</td>
                        <td className="px-4 py-3 text-sky-600 font-mono">{camp.code}</td>
                        <td className="px-4 py-3">{camp.professional ? `${camp.professional.firstName} ${camp.professional.lastName}` : "Todos los profesionales"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <HelpTooltip content="Copiar link" position="top">
                              <button 
                                onClick={() => navigator.clipboard.writeText(linkUrl)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </HelpTooltip>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-slate-400 hover:text-red-500" 
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(camp.id)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Nueva Campaña</h2>
          <form className="space-y-4 max-w-md">
            <label className="block text-sm font-bold text-slate-700">
              Nombre de la campaña
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Código de la campaña
              <Input value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="mt-1" />
            </label>
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-1">Selección de profesional</label>
              <Select className="max-w-md" value={formData.professionalId} onChange={(e) => setFormData({...formData, professionalId: e.target.value})}>
                <option value="">Todos los profesionales</option>
                {professionals.data?.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.firstName} {professional.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="pt-6">
              <Button type="button" onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#5cb85c] hover:bg-[#4cae4c] text-white px-6">
                {createMutation.isPending ? 'Creando...' : 'Crear campaña'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </OnlineSchedulingNav>
  );
}
