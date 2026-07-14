import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useBranchStore } from "@/stores/branch.store";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalEvolutions, useClinicalMutations } from "../hooks/use-clinical";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Printer, Plus, AlertTriangle, CheckCircle, FileText, XCircle } from "lucide-react";
import { ClinicalEvolutionModal } from "../components/clinical-evolution-modal";

export function ClinicalEvolutionsPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const treatmentPlanItemId = searchParams.get("treatmentPlanItemId") ?? "";
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;

  const evolutions = useClinicalEvolutions(id);
  const mutations = useClinicalMutations(id);

  const [addendum, setAddendum] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvolutionId, setSelectedEvolutionId] = useState<string | null>(null);

  const [showCancelled, setShowCancelled] = useState(false);

  // Annul Modal State
  const [isAnnulModalOpen, setIsAnnulModalOpen] = useState(false);
  const [evolutionToAnnul, setEvolutionToAnnul] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState("");

  const displayedEvolutions = evolutions.data?.filter((e) => (showCancelled ? true : !e.annulledAt)) || [];
  const selectedEvolution =
    evolutions.data?.find((evolution) => evolution.id === selectedEvolutionId) ?? null;

  useEffect(() => {
    if (treatmentPlanItemId) setIsModalOpen(true);
  }, [treatmentPlanItemId]);

  const handleAnnul = () => {
    if (evolutionToAnnul && annulReason.trim()) {
      mutations.annulEvolution.mutate(
        { evolutionId: evolutionToAnnul, reason: annulReason.trim() },
        {
          onSuccess: () => {
            setIsAnnulModalOpen(false);
            setEvolutionToAnnul(null);
            setAnnulReason("");
          }
        }
      );
    }
  };

  const openAnnulModal = (id: string) => {
    setEvolutionToAnnul(id);
    setAnnulReason("");
    setIsAnnulModalOpen(true);
  };

  const getStatusBadge = (evolution: any) => {
    if (evolution.annulledAt) {
      return <Badge value="Anulada" tone="danger" />;
    }
    if (evolution.signedAt) {
      return <Badge value="Firmada" tone="success" />;
    }
    return <Badge value="Borrador" tone="warning" />;
  };

  return (
    <ClinicalShell
      patientId={id}
      title="Evoluciones clinicas"
      description="Registro clínico legal, firma electrónica y adendas."
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Evoluciones</h2>
          <p className="text-sm text-slate-500">Historial clínico y procedimientos realizados.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 text-slate-600 hover:text-slate-900 border-slate-300"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Ficha
          </Button>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
            />
            Mostrar anuladas
          </label>

          <Button
            className="bg-blue-600 text-white hover:bg-blue-700 h-9"
            onClick={() => {
              setSelectedEvolutionId(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva evolución
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {evolutions.isLoading ? (
          <LoadingState message="Cargando evoluciones..." />
        ) : evolutions.isError ? (
          <ErrorState message={evolutions.error.message} />
        ) : !displayedEvolutions.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <FileText className="h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-700">Sin evoluciones</h3>
            <p className="text-slate-500 mt-1 mb-4 max-w-sm">
              Este paciente no tiene evoluciones clínicas registradas. Crea la primera evolución para
              registrar procedimientos o atenciones.
            </p>
            <Button
              onClick={() => {
                setSelectedEvolutionId(null);
                setIsModalOpen(true);
              }}
            >
              Crear primera evolución
            </Button>
          </div>
        ) : null}

        {displayedEvolutions.map((evolution: any) => (
          <Card
            key={evolution.id}
            className={`overflow-hidden transition-all shadow-sm border ${evolution.annulledAt ? "border-red-200 bg-red-50/30" : "border-slate-200 hover:shadow-md"}`}
          >
            <div
              className={`px-6 py-4 border-b ${evolution.annulledAt ? "bg-red-50/50 border-red-100" : "bg-slate-50/80 border-slate-100"} flex flex-wrap items-center justify-between gap-4`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${evolution.annulledAt ? "bg-red-100 text-red-600" : evolution.signedAt ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"}`}
                >
                  {evolution.annulledAt ? (
                    <XCircle className="h-5 w-5" />
                  ) : evolution.signedAt ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    {evolution.professional.firstName} {evolution.professional.lastName}
                    {evolution.isPrivate && <Badge value="Privada" tone="default" />}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    {evolution.signedAt
                      ? `Firmada el ${new Date(evolution.signedAt).toLocaleDateString()} a las ${new Date(evolution.signedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : `Borrador creado el ${new Date(evolution.createdAt || Date.now()).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">{getStatusBadge(evolution)}</div>
            </div>

            <div className="p-6">
              {/* Contexto de Tratamiento */}
              {(evolution.actionNameSnapshot ||
                (evolution.treatmentPlanItem && evolution.treatmentPlanItem.procedure)) && (
                <div className="mb-5 inline-block rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 border border-blue-100">
                  Prestación: {evolution.actionNameSnapshot || evolution.treatmentPlanItem?.procedure?.name}
                  {evolution.treatmentPlanItem?.treatmentPlan && (
                    <span className="text-blue-600 ml-2 font-normal">
                      (Plan #{evolution.treatmentPlanItem.treatmentPlan.displayId})
                    </span>
                  )}
                </div>
              )}

              {/* Campos dinámicos de la evolución */}
              {evolution.fields && evolution.fields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 p-4 rounded-lg bg-slate-50 border border-slate-100">
                  {evolution.fields.map((field: any, idx: number) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {field.label}
                      </span>
                      <span className="text-sm text-slate-800">{field.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Inventario / Materiales */}
              {evolution.materials && evolution.materials.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Materiales utilizados
                  </h4>
                  <ul className="space-y-1">
                    {evolution.materials.map((mat: any, idx: number) => (
                      <li key={idx} className="text-sm flex items-center gap-2 text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                        <span className="font-medium">
                          {mat.quantity} {mat.unitSnapshot || mat.inventoryItem?.unit || "unidades"}
                        </span>
                        <span>de</span>
                        <span>{mat.nameSnapshot || mat.inventoryItem?.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notas principales / Texto Libre */}
              {evolution.notes && (
                <div className="mb-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Evolución Clínica
                  </h4>
                  <div
                    className="whitespace-pre-wrap font-sans text-slate-800 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
                    dangerouslySetInnerHTML={{ __html: evolution.notes }}
                  />
                </div>
              )}

              {/* Adendas */}
              {evolution.addenda && evolution.addenda.length > 0 && (
                <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                  <h4 className="text-sm font-medium text-slate-800">Adendas ({evolution.addenda.length})</h4>
                  {evolution.addenda.map((addendum: any) => (
                    <div
                      key={addendum.id}
                      className="rounded-md bg-amber-50/50 p-3 border border-amber-100 text-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-amber-900">
                          {addendum.professional?.firstName} {addendum.professional?.lastName}
                        </span>
                        <span className="text-xs text-amber-700">
                          {new Date(addendum.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-amber-800 whitespace-pre-wrap">{addendum.notes}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Motivo de anulación */}
              {evolution.annulReason && (
                <div className="mt-6 rounded-md bg-red-50 p-4 border border-red-100 text-sm">
                  <span className="font-semibold text-red-800 block mb-1">Motivo de Anulación:</span>
                  <p className="text-red-700">{evolution.annulReason}</p>
                </div>
              )}
            </div>

            {/* Acciones del Footer */}
            {!evolution.annulledAt && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                {/* Draft Actions */}
                {!evolution.signedAt && (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedEvolutionId(evolution.id);
                        setIsModalOpen(true);
                      }}
                    >
                      Editar Borrador
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                        onClick={() => void mutations.signEvolution.mutate(evolution.id)}
                      >
                        Firmar Evolución
                      </Button>
                      <HelpTooltip content="Al firmar, se descontará el inventario (si aplica) y la evolución se bloqueará. Solo podrás agregar adendas o anularla." />
                    </div>
                  </div>
                )}

                {/* Signed Actions */}
                {evolution.signedAt && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full justify-between">
                    <div className="flex w-full sm:w-2/3 items-start sm:items-center gap-2">
                      <Textarea
                        className="min-h-[40px] text-sm bg-white border-slate-200 focus:border-blue-400 w-full"
                        rows={1}
                        placeholder="Escribir adenda aclaratoria..."
                        value={addendum[evolution.id] ?? ""}
                        onChange={(event) =>
                          setAddendum((prev) => ({ ...prev, [evolution.id]: event.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        className="whitespace-nowrap bg-slate-800 text-white hover:bg-slate-700"
                        disabled={!addendum[evolution.id]?.trim()}
                        onClick={() =>
                          void mutations.createAddendum.mutate(
                            {
                              evolutionId: evolution.id,
                              professionalId: evolution.professionalId,
                              notes: addendum[evolution.id]
                            },
                            { onSuccess: () => setAddendum((prev) => ({ ...prev, [evolution.id]: "" })) }
                          )
                        }
                      >
                        Agregar Adenda
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium"
                      onClick={() => openAnnulModal(evolution.id)}
                    >
                      Anular Evolución
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <ClinicalEvolutionModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEvolutionId(null);
          if (treatmentPlanItemId) {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("treatmentPlanItemId");
              return next;
            });
          }
        }}
        patientId={id}
        branchId={branchId}
        evolution={selectedEvolution}
        initialTreatmentPlanItemId={treatmentPlanItemId}
      />

      {/* Annul Modal */}
      <Modal
        open={isAnnulModalOpen}
        onClose={() => setIsAnnulModalOpen(false)}
        title="Anular Evolución"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-red-50 p-4 border border-red-100 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-800">Advertencia</h4>
              <p className="text-sm text-red-700 mt-1">
                La anulación revertirá los descuentos de inventario asociados y eliminará el estado
                "Completado" del plan de tratamiento (si aplica). Esta acción dejará un registro inmutable por
                auditoría médica.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Motivo de Anulación <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={annulReason}
              onChange={(e) => setAnnulReason(e.target.value)}
              placeholder="Indique claramente por qué se anula este registro clínico..."
              className="w-full min-h-[100px]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setIsAnnulModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleAnnul}
              disabled={!annulReason.trim() || mutations.annulEvolution.isPending}
            >
              Confirmar Anulación
            </Button>
          </div>
        </div>
      </Modal>
    </ClinicalShell>
  );
}
