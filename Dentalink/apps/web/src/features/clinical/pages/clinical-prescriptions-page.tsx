import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Printer, Trash2, Plus, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalMutations, useClinicalPrescriptions } from "../hooks/use-clinical";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import { RichTextEditor } from "../components/rich-text-editor";
import { VademecumModal } from "../components/vademecum-modal";
import { toast } from "sonner";

const PRESCRIPTION_TEMPLATES = [
  {
    name: "Esquema Antibiótico Básico",
    content: `<div><strong>Amoxicilina 500 mg</strong></div><div>Posología: 1 Cápsula cada 8 Horas durante 7 Días. Vía: Oral.</div><div>Indicaciones: <em>Tomar después de las comidas. Completar los 7 días completos de tratamiento.</em></div>`
  },
  {
    name: "Esquema Analgésico / Antiinflamatorio",
    content: `<div><strong>Ibuprofeno 600 mg</strong></div><div>Posología: 1 Comprimido cada 8 Horas durante 5 Días. Vía: Oral.</div><div>Indicaciones: <em>Tomar acompañado de alimentos para proteger el estómago. Suspender en caso de no haber dolor.</em></div>`
  },
  {
    name: "Esquema Dolor Severo (Ketorolaco)",
    content: `<div><strong>Ketorolaco 10 mg</strong></div><div>Posología: 1 Tableta sublingual cada 8 Horas durante 3 Días. Vía: Sublingual.</div><div>Indicaciones: <em>Disolver debajo de la lengua en caso de dolor agudo.</em></div>`
  }
];

export function ClinicalPrescriptionsPage() {
  const { id = "" } = useParams();
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  
  const prescriptions = useClinicalPrescriptions(id);
  const treatmentPlans = useTreatmentPlans({ patientId: id });
  const mutations = useClinicalMutations(id);

  // States
  const [professionalId, setProfessionalId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [bodyContent, setBodyContent] = useState("");
  const [associatedPlanId, setAssociatedPlanId] = useState("");
  
  // Custom prescription items tracking for API/Print compliance
  const [medicationItems, setMedicationItems] = useState<Array<{ medication: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>>([]);

  // Filtering states
  const [selectedTreatmentId, setSelectedTreatmentId] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [printText, setPrintText] = useState("");
  const [isVademecumOpen, setIsVademecumOpen] = useState(false);

  useEffect(() => {
    if (!professionalId && professionals.data?.length) {
      // Auto-select first professional if available
      setProfessionalId(professionals.data[0].id);
    }
  }, [professionals.data, professionalId]);

  useEffect(() => {
    if (!professionalId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === professionalId);
    if (!isVisible) setProfessionalId("");
  }, [professionalId, professionals.data]);

  const handleCreate = async () => {
    if (!professionalId) {
      toast.error("Selecciona un profesional");
      return;
    }
    if (!bodyContent.trim()) {
      toast.error("Redacta las indicaciones de la receta");
      return;
    }

    // If they typed manually and medicationItems is empty, create a generic item
    const items = medicationItems.length > 0 
      ? medicationItems 
      : [{ medication: "Prescripción médica personalizada", instructions: "Ver indicaciones de la receta" }];

    await mutations.createPrescription.mutateAsync({
      professionalId,
      treatmentPlanId: associatedPlanId || undefined,
      diagnosis: diagnosis.trim() || undefined,
      notes: bodyContent.trim(),
      items
    });

    // Reset
    setDiagnosis("");
    setBodyContent("");
    setMedicationItems([]);
    setAssociatedPlanId("");
    toast.success("Receta creada exitosamente");
  };

  const handleVademecumSelect = (formattedHTML: string) => {
    setBodyContent((prev) => prev + formattedHTML);
    
    // Add a structural item for print/audit compliance
    const parser = new DOMParser();
    const doc = parser.parseFromString(formattedHTML, 'text/html');
    const title = doc.querySelector('strong')?.textContent || "Medicamento";
    
    setMedicationItems((prev) => [
      ...prev,
      {
        medication: title,
        instructions: "Indicaciones añadidas en receta"
      }
    ]);
  };

  // Filtered list
  const displayPrescriptions = useMemo(() => {
    let list = prescriptions.data ?? [];
    
    // Filter by Treatment Plan
    if (selectedTreatmentId) {
      list = list.filter((p) => p.treatmentPlanId === selectedTreatmentId);
    }
    
    // Filter by Cancelled Status
    if (!showCancelled) {
      list = list.filter((p) => p.status !== "CANCELLED");
    }

    return list;
  }, [prescriptions.data, selectedTreatmentId, showCancelled]);

  return (
    <ClinicalShell patientId={id} title="Recetas" description="Prescripciones y gestión de recetas.">
      
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Filtros</span>
        
        <div className="flex items-center gap-3">
          {/* Custom Dropdown for filtering by treatment */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 rounded-md border border-slate-200 hover:bg-slate-50 text-sm font-semibold transition-colors shadow-sm"
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              {selectedTreatmentId 
                ? `Plan: ${treatmentPlans.data?.find(p => p.id === selectedTreatmentId)?.name || 'Seleccionado'}`
                : "Filtrar por tratamiento"}
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 z-10 w-80 bg-white rounded-md border border-slate-200 shadow-lg py-1 max-h-60 overflow-y-auto">
                <button
                  type="button"
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${!selectedTreatmentId ? 'font-semibold text-sky-600 bg-sky-50/50' : 'text-slate-700'}`}
                  onClick={() => {
                    setSelectedTreatmentId("");
                    setDropdownOpen(false);
                  }}
                >
                  Todos los tratamientos
                </button>
                {treatmentPlans.data?.map((plan) => {
                  let hash = 0;
                  for (let i = 0; i < plan.id.length; i++) {
                    hash = plan.id.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const numericCode = Math.abs(hash % 1000000).toString().padStart(6, '0');
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-t border-slate-100 leading-tight ${selectedTreatmentId === plan.id ? 'font-semibold text-sky-600 bg-sky-50/50' : 'text-slate-700'}`}
                      onClick={() => {
                        setSelectedTreatmentId(plan.id);
                        setDropdownOpen(false);
                      }}
                    >
                      <span className="block font-medium">{plan.name}</span>
                      <span className="text-xs text-slate-400 block mt-0.5">#{numericCode} • {plan.professional.firstName} {plan.professional.lastName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-md border border-slate-200 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer shrink-0 shadow-sm">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
            />
            Mostrar anuladas
          </label>
        </div>
      </div>

      {/* Main Split-Screen Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        
        {/* Left Side: Create prescription form */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Nueva Prescripción</h3>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-sky-400 bg-white px-3 py-1.5 text-sm font-semibold text-sky-600 hover:bg-sky-50 transition-colors shadow-sm"
              onClick={() => setIsVademecumOpen(true)}
            >
              Vademécum
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Profesional firmante *</label>
                <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
                  <option value="">Seleccionar...</option>
                  {professionals.data?.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diagnóstico</label>
                <Input placeholder="Diagnóstico" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cuerpo de la Receta (Indicaciones) *</label>
              <RichTextEditor
                value={bodyContent}
                onChange={setBodyContent}
                placeholder="Redacta la receta directamente o añade fármacos desde el Vademecum..."
                className="min-h-[220px]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Usar plantilla de receta</label>
                <Select value="" onChange={(e) => {
                  const selected = PRESCRIPTION_TEMPLATES.find(t => t.name === e.target.value);
                  if (selected) {
                    setBodyContent((prev) => prev + selected.content);
                  }
                }}>
                  <option value="">Cargar plantilla...</option>
                  {PRESCRIPTION_TEMPLATES.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Asociar a Plan de Tratamiento</label>
                <Select value={associatedPlanId} onChange={(event) => setAssociatedPlanId(event.target.value)}>
                  <option value="">Ninguno</option>
                  {treatmentPlans.data?.map((plan) => {
                    let hash = 0;
                    for (let i = 0; i < plan.id.length; i++) {
                      hash = plan.id.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const numericCode = Math.abs(hash % 1000000).toString().padStart(6, '0');
                    return (
                      <option key={plan.id} value={plan.id}>
                        #{numericCode}: {plan.name}
                      </option>
                    );
                  })}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button
              className="bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm h-10 px-5"
              onClick={handleCreate}
              disabled={!professionalId || !bodyContent.trim() || mutations.createPrescription.isPending}
            >
              Crear prescripción
            </Button>
          </div>
        </Card>

        {/* Right Side: Prescription history list */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Historial de Recetas</h3>
          
          {printText && (
            <Card className="border-sky-200 bg-sky-50/15 p-4 relative">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2 mb-3">
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Vista Previa de Impresión</span>
                <button 
                  type="button" 
                  className="text-xs text-sky-600 hover:text-sky-800 font-semibold" 
                  onClick={() => setPrintText("")}
                >
                  Ocultar
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono leading-relaxed">{printText}</pre>
            </Card>
          )}

          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            {displayPrescriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500 text-center">
                <Info className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm font-bold">Este tratamiento no tiene recetas</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                  Registra una receta en el panel de redacción o selecciona otro filtro de tratamiento.
                </p>
              </div>
            ) : (
              displayPrescriptions.map((prescription) => {
                const isCancelled = prescription.status === "CANCELLED";
                return (
                  <Card
                    key={prescription.id}
                    className={`transition-all duration-200 border border-slate-200 p-4 ${
                      isCancelled ? "opacity-65 bg-slate-50/80" : "bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-bold text-slate-800 text-base">
                            {prescription.diagnosis || "Receta General"}
                          </span>
                          {isCancelled && (
                            <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-2xs font-semibold text-red-600 leading-none">
                              Anulada
                            </span>
                          )}
                          {prescription.treatmentPlan && (
                            <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-2xs font-semibold text-slate-600 leading-none">
                              Plan: {prescription.treatmentPlan.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Por: {prescription.professional.firstName} {prescription.professional.lastName} • {new Date(prescription.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-slate-600 hover:bg-slate-100"
                          onClick={() => void mutations.printPrescription.mutateAsync(prescription.id).then((res) => setPrintText(res.printableText ?? ""))}
                        >
                          Ver
                        </Button>
                        {!isCancelled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm("¿Estás seguro de que deseas anular esta receta médica?")) {
                                void mutations.updatePrescriptionStatus.mutateAsync({
                                  prescriptionId: prescription.id,
                                  status: "CANCELLED"
                                });
                              }
                            }}
                          >
                            Anular
                          </Button>
                        )}
                      </div>
                    </div>

                    {prescription.notes && (
                      <div 
                        className="mt-3 text-sm text-slate-700 border-t border-slate-100 pt-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:list-item [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: prescription.notes }}
                      />
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <VademecumModal
        open={isVademecumOpen}
        onClose={() => setIsVademecumOpen(false)}
        onSelect={handleVademecumSelect}
      />
    </ClinicalShell>
  );
}
