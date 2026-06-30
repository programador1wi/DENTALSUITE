import { useState, useEffect } from "react";
import { AlertCircle, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useSpecialtyClinicalTemplates } from "@/features/settings/specialties/hooks/use-specialties";

interface ClinicalTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string) => void;
  specialties: { id: string; name: string }[];
  professionalId?: string;
  templateType: "EVOLUTION" | "PRESCRIPTION";
}

export function ClinicalTemplateModal({ open, onClose, onSelectTemplate, specialties, professionalId, templateType }: ClinicalTemplateModalProps) {
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    if (open) {
      if (specialties.length > 0 && !selectedSpecialtyId) {
        setSelectedSpecialtyId(specialties[0]!.id);
      }
      setSelectedTemplateId("");
    }
  }, [open, specialties, selectedSpecialtyId]);

  const templatesQuery = useSpecialtyClinicalTemplates(selectedSpecialtyId || undefined, templateType);
  const allTemplates = templatesQuery.data?.filter(t => t.isActive) || [];

  const selectedTemplate = allTemplates.find((t) => t.id === selectedTemplateId);

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate.content);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Usar Plantilla" size="lg">
      <div className="flex flex-col gap-4">
        {!professionalId ? (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p>Por favor, selecciona un profesional en el formulario principal para ver sus plantillas específicas.</p>
          </div>
        ) : specialties.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p>El profesional seleccionado no tiene especialidades configuradas. No se pueden mostrar plantillas.</p>
          </div>
        ) : (
          specialties.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Especialidad</label>
              <Select 
                value={selectedSpecialtyId} 
                onChange={(e) => {
                  setSelectedSpecialtyId(e.target.value);
                  setSelectedTemplateId("");
                }}
                className="w-full"
              >
                {specialties.map(specialty => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </option>
                ))}
              </Select>
            </div>
          )
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Plantilla</label>
          <Select 
            value={selectedTemplateId} 
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full"
            disabled={allTemplates.length === 0}
          >
            <option value="">Seleccionar plantilla...</option>
            {allTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          {allTemplates.length === 0 && professionalId && specialties.length > 0 && !templatesQuery.isLoading && (
            <p className="mt-1.5 text-sm text-slate-500">No hay plantillas configuradas para esta especialidad.</p>
          )}
        </div>

        {selectedTemplate && (
          <div className="rounded-md border border-slate-200 bg-white p-4 max-h-[300px] overflow-y-auto">
            <div 
              className="prose prose-sm max-w-none text-slate-700 prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6"
              dangerouslySetInnerHTML={{ __html: selectedTemplate.content }}
            />
          </div>
        )}

        {selectedTemplate && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p>Al agregar la plantilla, se reemplazará el texto actual del documento.</p>
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
