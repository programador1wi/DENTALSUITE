import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./rich-text-editor";
import { ClinicalTemplateModal } from "./clinical-template-modal";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import { useClinicalMutations } from "../hooks/use-clinical";
import { useInventoryItems } from "@/features/labs-inventory/hooks/use-labs-inventory";
import { Trash2, Plus } from "lucide-react";

interface ClinicalEvolutionModalProps {
  patientId: string;
  branchId?: string;
  open: boolean;
  onClose: () => void;
}

export function ClinicalEvolutionModal({ patientId, branchId, open, onClose }: ClinicalEvolutionModalProps) {
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const treatmentPlans = useTreatmentPlans({ patientId });
  const mutations = useClinicalMutations(patientId);

  const [form, setForm] = useState({
    professionalId: "",
    treatmentPlanId: "",
    notes: "",
    isPrivate: false
  });

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const inventory = useInventoryItems({ active: "true", branchId: branchId || undefined });
  const [materials, setMaterials] = useState<{ inventoryItemId: string; quantity: number; name: string; unit: string }[]>([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);


  // Default date (current date)
  const today = new Date();
  const currentDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  useEffect(() => {
    if (!form.professionalId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === form.professionalId);
    if (!isVisible) setForm((prev) => ({ ...prev, professionalId: "" }));
  }, [form.professionalId, professionals.data]);

  const handleCreate = () => {
    if (!form.professionalId) return;
    const payload: any = { ...form, materials: materials.map(m => ({ inventoryItemId: m.inventoryItemId, quantity: m.quantity })) };
    
    // Evitar enviar strings vacíos que puedan causar errores de validación o llaves foráneas
    if (!payload.treatmentPlanId) {
      delete payload.treatmentPlanId;
    }

    mutations.createEvolution.mutate(payload, {
      onSuccess: () => {
        setForm({ professionalId: "", treatmentPlanId: "", notes: "", isPrivate: false });
        setMaterials([]);
        onClose();
      }
    });
  };

  const handleSelectTemplate = (content: string) => {
    setForm(prev => ({ ...prev, notes: content }));
  };

  // Switch component is not standard HTML, let's make sure it's accessible or use standard inputs if Switch is missing
  // Since we imported Switch, we'll try to use it, if it's missing we can fallback to standard input type checkbox
  // Wait, I am importing Switch from "@/components/ui/switch" but I haven't checked if it exists. 
  // Let me replace it with a standard HTML checkbox styled as a toggle just in case, or use a simple checkbox.
  
  return (
    <>
      <Modal open={open} onClose={onClose} title="Nueva evolución" size="xl">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Profesional</label>
              <Select 
                value={form.professionalId} 
                onChange={(event) => setForm((prev) => ({ ...prev, professionalId: event.target.value }))} 
                className="w-full text-sm"
              >
                <option value="">Buscar profesional...</option>
                {professionals.data?.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {`${professional.firstName} ${professional.lastName}`}
                  </option>
                ))}
              </Select>
            </div>
            
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Tratamiento</label>
              <Select 
                value={form.treatmentPlanId} 
                onChange={(event) => setForm((prev) => ({ ...prev, treatmentPlanId: event.target.value }))} 
                className="w-full text-sm"
              >
                <option value="">Buscar tratamiento...</option>
                {treatmentPlans.data?.map((plan) => {
                  // Generamos un código numérico consistente de 6 dígitos basado en el ID (cuid)
                  let hash = 0;
                  for (let i = 0; i < plan.id.length; i++) {
                    hash = plan.id.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const numericCode = Math.abs(hash % 1000000).toString().padStart(6, '0');
                  
                  return (
                    <option key={plan.id} value={plan.id}>
                      {`#${numericCode} - ${plan.name || "Plan de tratamiento"}`}
                    </option>
                  );
                })}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Fecha</label>
              <div className="relative">
                <Input 
                  value={currentDate} 
                  readOnly 
                  className="w-full text-sm bg-slate-50 cursor-not-allowed pl-9" 
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <RichTextEditor
            value={form.notes}
            onChange={(val) => setForm(prev => ({ ...prev, notes: val }))}
            onUseTemplate={() => setIsTemplateModalOpen(true)}
            onDictate={() => console.log("Dictate not implemented natively")}
            onFeedback={() => console.log("Feedback")}
          />


          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Materiales e Inventario (Opcional)</h3>
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Producto / Material</label>
                <Select 
                  value={selectedInventoryItemId} 
                  onChange={(e) => setSelectedInventoryItemId(e.target.value)}
                  className="w-full text-sm"
                >
                  <option value="">Seleccionar material...</option>
                  {inventory.data?.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.unit}) - Stock: {item.stock}</option>
                  ))}
                </Select>
              </div>
              <div className="w-24">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Cantidad</label>
                <Input 
                  type="number" 
                  min="1"
                  step="any"
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                  className="w-full text-sm"
                />
              </div>
              <Button 
                variant="secondary" 
                type="button"
                disabled={!selectedInventoryItemId || selectedQuantity <= 0}
                onClick={() => {
                  const item = inventory.data?.find(i => i.id === selectedInventoryItemId);
                  if (item) {
                    setMaterials(prev => {
                      const existing = prev.find(m => m.inventoryItemId === item.id);
                      if (existing) {
                        return prev.map(m => m.inventoryItemId === item.id ? { ...m, quantity: m.quantity + selectedQuantity } : m);
                      }
                      return [...prev, { inventoryItemId: item.id, quantity: selectedQuantity, name: item.name, unit: item.unit }];
                    });
                    setSelectedInventoryItemId("");
                    setSelectedQuantity(1);
                  }
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
            
            {materials.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Material</th>
                      <th className="px-3 py-2 font-medium">Cantidad</th>
                      <th className="px-3 py-2 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {materials.map(m => (
                      <tr key={m.inventoryItemId}>
                        <td className="px-3 py-2 font-medium text-slate-900">{m.name}</td>
                        <td className="px-3 py-2">{m.quantity} {m.unit}</td>
                        <td className="px-3 py-2 text-right">
                          <button 
                            type="button" 
                            className="text-slate-400 hover:text-red-500"
                            onClick={() => setMaterials(prev => prev.filter(x => x.inventoryItemId !== m.inventoryItemId))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer items-center">
                <input 
                  type="checkbox" 
                  className="peer sr-only" 
                  checked={form.isPrivate}
                  onChange={(e) => setForm(prev => ({ ...prev, isPrivate: e.target.checked }))}
                />
                <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300"></div>
                <span className="ml-2 text-sm font-medium text-slate-600">Evolución privada</span>
              </label>
            </div>
            
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
              <Button 
                disabled={!form.professionalId || !form.notes} 
                onClick={handleCreate}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Crear nueva evolución
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ClinicalTemplateModal 
        open={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)} 
        onSelectTemplate={handleSelectTemplate} 
        specialties={professionals.data?.find(p => p.id === form.professionalId)?.specialties || []}
        professionalId={form.professionalId}
        templateType="EVOLUTION"
      />
    </>
  );
}
