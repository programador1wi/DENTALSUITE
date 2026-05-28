import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { ClinicalShell } from "../components/clinical-shell";
import { OdontogramView } from "../components/odontogram-view";
import { ToothInformationModal, ToothTreatmentModal } from "../components/tooth-action-modals";
import { ToothDiagnosisModal } from "../components/tooth-diagnosis-modal";
import { useClinicalMutations, useOdontogram, useToothHistory } from "../hooks/use-clinical";

export function ClinicalOdontogramPage() {
  const { id = "" } = useParams();
  const selectedTooth = useOdontogramStore((state) => state.selectedTooth);
  const selectedSurface = useOdontogramStore((state) => state.selectedSurface);
  const activeModal = useOdontogramStore((state) => state.activeModal);
  const selectTooth = useOdontogramStore((state) => state.selectTooth);
  const setSelectedSurface = useOdontogramStore((state) => state.setSelectedSurface);
  const openModal = useOdontogramStore((state) => state.openModal);
  const closeModal = useOdontogramStore((state) => state.closeModal);
  const resetWorkspace = useOdontogramStore((state) => state.resetWorkspace);

  const professionals = useProfessionals(undefined, "true");
  const procedures = useProcedures(undefined, "true");
  const odontogram = useOdontogram(id);
  const history = useToothHistory(id, selectedTooth);
  const mutations = useClinicalMutations(id);
  const professionalOptions = (professionals.data ?? []).map((professional) => ({
    id: professional.id,
    label: `${professional.firstName} ${professional.lastName}`
  }));
  const procedureOptions = (procedures.data ?? []).map((procedure) => ({
    id: procedure.id,
    label: `${procedure.code} - ${procedure.name}`
  }));

  useEffect(() => {
    resetWorkspace();
  }, [id, resetWorkspace]);

  if (odontogram.isLoading) return <LoadingState message="Cargando odontograma..." />;
  if (odontogram.isError) return <ErrorState message={odontogram.error.message} />;

  return (
    <ClinicalShell patientId={id} title="Odontograma" description="Registro visual por pieza dental y superficies en sistema FDI.">
      <OdontogramView
        selectedTooth={selectedTooth}
        latestByTooth={odontogram.data?.latestByTooth ?? {}}
        conditions={odontogram.data?.conditions ?? []}
        records={odontogram.data?.records ?? []}
        procedures={odontogram.data?.procedures ?? []}
        onSelectTooth={selectTooth}
        onOpenDiagnosis={() => openModal("diagnosis")}
        onOpenTreatment={() => openModal("procedure")}
        onOpenInformation={() => openModal("info")}
        onCancelRecord={(odontogramRecordId) => mutations.cancelOdontogramRecord.mutate(odontogramRecordId)}
      />

      <ToothDiagnosisModal
        open={activeModal === "diagnosis" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        onClose={closeModal}
        onAddDiagnosis={(diagnosis, notes) => {
          const professionalId = professionalOptions[0]?.id;
          if (!professionalId) {
            toast.error("No hay profesionales activos para registrar el diagnostico.");
            return;
          }

          mutations.createToothCondition.mutate(
            {
              professionalId,
              toothNumber: selectedTooth,
              surface: selectedSurface || undefined,
              condition: diagnosis,
              diagnosis,
              notes
            },
            { onSuccess: closeModal }
          );
        }}
      />

      <ToothTreatmentModal
        open={activeModal === "procedure" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        surface={selectedSurface}
        onSurfaceChange={setSelectedSurface}
        professionals={professionalOptions}
        procedures={procedureOptions}
        onClose={closeModal}
        onCreateProcedure={(payload) => mutations.createToothProcedure.mutate(payload, { onSuccess: closeModal })}
      />

      <ToothInformationModal
        open={activeModal === "info" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        history={history.data}
        historyLoading={history.isLoading}
        onCancelRecord={(odontogramRecordId) => mutations.cancelOdontogramRecord.mutate(odontogramRecordId)}
        onUpdateProcedureStatus={(payload) => mutations.updateToothProcedureStatus.mutate(payload)}
        onClose={closeModal}
      />
    </ClinicalShell>
  );
}
