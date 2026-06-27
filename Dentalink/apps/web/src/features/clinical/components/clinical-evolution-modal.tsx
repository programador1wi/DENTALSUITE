import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "./rich-text-editor";
import { EvolutionTemplateModal } from "./evolution-template-modal";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import { useClinicalMutations } from "../hooks/use-clinical";

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
    mutations.createEvolution.mutate(form, {
      onSuccess: () => {
        setForm({ professionalId: "", treatmentPlanId: "", notes: "", isPrivate: false });
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

      <EvolutionTemplateModal 
        open={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)} 
        onSelectTemplate={handleSelectTemplate} 
      />
    </>
  );
}
