import { ListTodo } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { OnlineSchedulingDrawer } from "../components/online-scheduling-drawer";
import { OnlineSchedulingNav } from "../components/online-scheduling-nav";

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
  const [isCreating, setIsCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<{name: string, code: string, prof: string}[]>([]);
  const [formData, setFormData] = useState({name: "", code: "", prof: "Todos los profesionales"});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const professionals = useProfessionals(undefined, "true");

  const handleCreate = () => {
    if (formData.name && formData.code) {
      setCampaigns([...campaigns, formData]);
      setIsCreating(false);
      setFormData({name: "", code: "", prof: "Todos los profesionales"});
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
                  {campaigns.map((camp, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{camp.name}</td>
                      <td className="px-4 py-3 text-sky-600">{camp.code}</td>
                      <td className="px-4 py-3">{camp.prof}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500" onClick={() => setCampaigns(campaigns.filter((_, idx) => idx !== i))}>
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
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
              <Select className="max-w-md" value={formData.prof} onChange={(e) => setFormData({...formData, prof: e.target.value})}>
                <option>Todos los profesionales</option>
                <option>Dr. Juan Pérez</option>
              </Select>
            </div>
            <div className="pt-6">
              <Button onClick={handleCreate} className="bg-[#5cb85c] hover:bg-[#4cae4c] text-white px-6">
                Crear campaña
              </Button>
            </div>
          </form>
        </div>
      )}
    </OnlineSchedulingNav>
  );
}
