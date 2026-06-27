import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EVOLUTION_TEMPLATES, type EvolutionTemplate } from "./evolution-templates";

interface EvolutionTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string) => void;
}

export function EvolutionTemplateModal({ open, onClose, onSelectTemplate }: EvolutionTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const selectedTemplate = EVOLUTION_TEMPLATES.find((t) => t.id === selectedTemplateId);

  // Group templates by category
  const categories = Array.from(new Set(EVOLUTION_TEMPLATES.map(t => t.category)));

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate.content);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Usar Plantilla" size="lg">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Plantilla</label>
          <Select 
            value={selectedTemplateId} 
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full"
          >
            <option value="">Seleccionar plantilla...</option>
            {categories.map(category => (
              <optgroup key={category} label={category}>
                {EVOLUTION_TEMPLATES.filter(t => t.category === category).map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {selectedTemplate && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
              {selectedTemplate.content}
            </pre>
          </div>
        )}

        {selectedTemplate && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p>Al agregar la plantilla, se reemplazará el texto actual.</p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={handleUseTemplate} 
            disabled={!selectedTemplate}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Usar plantilla
          </Button>
        </div>
      </div>
    </Modal>
  );
}
