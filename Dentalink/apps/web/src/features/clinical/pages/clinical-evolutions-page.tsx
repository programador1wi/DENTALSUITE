import { useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useBranchStore } from "@/stores/branch.store";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalEvolutions, useClinicalMutations } from "../hooks/use-clinical";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Printer, Plus } from "lucide-react";
import { ClinicalEvolutionModal } from "../components/clinical-evolution-modal";

export function ClinicalEvolutionsPage() {
  const { id = "" } = useParams();
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;
  
  const evolutions = useClinicalEvolutions(id);
  const mutations = useClinicalMutations(id);
  
  const [addendum, setAddendum] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  // Filter evolutions if we implement cancelled status in the future
  const displayedEvolutions = evolutions.data || [];

  return (
    <ClinicalShell patientId={id} title="Evoluciones clinicas" description="Notas SOAP, firma y adendas.">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
        <h2 className="text-xl font-medium text-slate-800">Evoluciones</h2>
        
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" className="h-9 w-9 text-slate-500 hover:text-slate-700">
            <Printer className="h-4 w-4" />
          </Button>
          
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input 
              type="checkbox" 
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
            />
            Mostrar anuladas
          </label>
          
          <Button 
            className="bg-green-600 text-white hover:bg-green-700 h-9" 
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva evolución
          </Button>
        </div>
      </div>

      <div className="flex gap-6 mb-6 text-sm">
        <button className="font-semibold text-slate-900 border-b-2 border-slate-900 pb-1">
          Todas las evoluciones
        </button>
        <button className="text-slate-500 hover:text-slate-700 pb-1">
          Solo mis evoluciones
        </button>
      </div>

      <div className="space-y-4">
        {!displayedEvolutions.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-400">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-slate-500">No se encontraron evoluciones</p>
          </div>
        ) : null}
        
        {displayedEvolutions.map((evolution) => (
          <Card key={evolution.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{evolution.professional.firstName} {evolution.professional.lastName}</p>
                <p className="text-xs text-slate-500">{evolution.signedAt ? new Date(evolution.signedAt).toLocaleString() : "Sin firma"}</p>
              </div>
              <div className="flex items-center gap-2">
                {evolution.notes?.includes("Privada") && <Badge value="Privada" tone="default" />}
                <Badge value={evolution.signedAt ? "Firmada" : "Borrador"} tone={evolution.signedAt ? "success" : "warning"} />
              </div>
            </div>
            
            <div className="mt-4 text-sm text-slate-700">
              {/* If it has the old SOAP format, display it */}
              {(evolution.subjective || evolution.objective || evolution.assessment || evolution.plan) && (
                <div className="grid gap-2 md:grid-cols-2 mb-3">
                  {evolution.subjective && <p><strong>S:</strong> {evolution.subjective}</p>}
                  {evolution.objective && <p><strong>O:</strong> {evolution.objective}</p>}
                  {evolution.assessment && <p><strong>A:</strong> {evolution.assessment}</p>}
                  {evolution.plan && <p><strong>P:</strong> {evolution.plan}</p>}
                </div>
              )}
              
              {/* Main content from the new rich text editor is stored in notes */}
              {evolution.notes && (
                <div 
                  className="whitespace-pre-wrap font-sans bg-slate-50 p-3 rounded-md border border-slate-100 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: evolution.notes }}
                />
              )}
            </div>
            
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" disabled={Boolean(evolution.signedAt)} onClick={() => void mutations.signEvolution.mutate(evolution.id)}>Firmar</Button>
                <HelpTooltip content="Al firmar la evolución, esta se bloquea permanentemente por seguridad médico-legal de la ficha. Solo se le podrán agregar aclaraciones mediante 'Adendas' posteriores." />
              </div>
              {evolution.signedAt ? (
                <div className="flex w-full mt-2 items-center gap-2">
                  <Textarea className="min-h-[40px]" rows={1} placeholder="Adenda" value={addendum[evolution.id] ?? ""} onChange={(event) => setAddendum((prev) => ({ ...prev, [evolution.id]: event.target.value }))} />
                  <Button
                    size="sm"
                    disabled={!addendum[evolution.id]}
                    onClick={() => void mutations.createAddendum.mutate({ evolutionId: evolution.id, professionalId: evolution.professionalId, notes: addendum[evolution.id] })}
                  >
                    Agregar adenda
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <ClinicalEvolutionModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        patientId={id}
        branchId={branchId}
      />
    </ClinicalShell>
  );
}
