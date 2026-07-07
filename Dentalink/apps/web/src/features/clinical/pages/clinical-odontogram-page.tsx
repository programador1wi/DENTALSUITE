import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranchStore } from "@/stores/branch.store";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { ClinicalShell } from "../components/clinical-shell";
import { OdontogramView } from "../components/odontogram-view";
import { MultipleToothSelectionModal, ToothInformationModal, ToothTreatmentModal } from "../components/tooth-action-modals";
import { ToothDiagnosisModal, ToothDiagnosisPickerWindow } from "../components/tooth-diagnosis-modal";
import { useClinicalMutations, useOdontogram, useToothHistory } from "../hooks/use-clinical";

export function ClinicalOdontogramPage() {
  const { id = "" } = useParams();
  const selectedTooth = useOdontogramStore((state) => state.selectedTooth);
  const selectedTeeth = useOdontogramStore((state) => state.selectedTeeth);
  const selectedSurface = useOdontogramStore((state) => state.selectedSurface);
  const activeModal = useOdontogramStore((state) => state.activeModal);
  const selectTooth = useOdontogramStore((state) => state.selectTooth);
  const setSelectedSurface = useOdontogramStore((state) => state.setSelectedSurface);
  const openModal = useOdontogramStore((state) => state.openModal);
  const closeModal = useOdontogramStore((state) => state.closeModal);
  const resetWorkspace = useOdontogramStore((state) => state.resetWorkspace);

  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const patient = usePatient(id);
  const branchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const procedures = useProcedures(undefined, "true");
  const odontogram = useOdontogram(id);
  const history = useToothHistory(id, selectedTooth, selectedSurface || undefined);
  const mutations = useClinicalMutations(id);
  const professionalOptions = (professionals.data ?? []).map((professional) => ({
    id: professional.id,
    label: `${professional.firstName} ${professional.lastName}`
  }));
  const procedureOptions = (procedures.data ?? []).map((procedure) => ({
    id: procedure.id,
    label: `${procedure.code} - ${procedure.name}`
  }));
  const actionTeeth = selectedTeeth.length ? selectedTeeth : selectedTooth ? [selectedTooth] : [];

  const createDiagnosisForSelectedTeeth = async (diagnosis: string, notes?: string) => {
    const professionalId = professionalOptions[0]?.id;
    if (!professionalId) {
      toast.error("No hay profesionales activos para registrar el diagnostico.");
      return;
    }
    if (!actionTeeth.length) {
      toast.error("Selecciona una pieza dental.");
      return;
    }

    try {
      await Promise.all(
        actionTeeth.map((toothNumber) =>
          mutations.createToothCondition.mutateAsync({
            professionalId,
            toothNumber,
            surface: selectedSurface || undefined,
            condition: diagnosis,
            diagnosis,
            notes
          })
        )
      );
      closeModal();
      toast.success(actionTeeth.length > 1 ? `Diagnostico agregado a ${actionTeeth.length} piezas.` : "Diagnostico agregado al odontograma.");
    } catch {
      // El hook de mutacion ya muestra el error de API.
    }
  };

  useEffect(() => {
    resetWorkspace();
  }, [id, resetWorkspace]);

  if (odontogram.isLoading) return <LoadingState message="Cargando odontograma..." />;
  if (odontogram.isError) return <ErrorState message={odontogram.error.message} />;

  return (
    <ClinicalShell patientId={id} title="Odontograma" description="Registro visual por pieza dental y superficies en sistema FDI.">
      <OdontogramView
        mode="clinical"
        selectedTooth={selectedTooth}
        latestByTooth={odontogram.data?.latestByTooth ?? {}}
        conditions={odontogram.data?.conditions ?? []}
        records={odontogram.data?.records ?? []}
        procedures={odontogram.data?.procedures ?? []}
        onSelectTooth={selectTooth}
        onOpenDiagnosis={() => openModal("diagnosis")}
        onOpenPreexistence={() => openModal("preexistence")}
        onOpenLesion={() => openModal("lesion")}
        onOpenTreatment={() => openModal("procedure")}
        onOpenInformation={() => openModal("info")}
        onApplyQuickDiagnosis={(diagnosis) => void createDiagnosisForSelectedTeeth(diagnosis)}
        onCancelRecord={(odontogramRecordId) => mutations.cancelOdontogramRecord.mutate(odontogramRecordId)}
      />

      <ToothDiagnosisModal
        open={activeModal === "diagnosis" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        surface={selectedSurface}
        onClose={closeModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothDiagnosisPickerWindow
        open={activeModal === "preexistence" && Boolean(selectedTooth)}
        title="Agregar una preexistencia"
        tone="preexistence"
        sectionTitles={["Preexistencias"]}
        toothNumbers={actionTeeth}
        surface={selectedSurface}
        onClose={closeModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothDiagnosisPickerWindow
        open={activeModal === "lesion" && Boolean(selectedTooth)}
        title="Agregar una lesion"
        tone="lesion"
        sectionTitles={["Lesiones"]}
        toothNumbers={actionTeeth}
        surface={selectedSurface}
        onClose={closeModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
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
        surface={selectedSurface}
        history={history.data}
        historyLoading={history.isLoading}
        onCancelRecord={(odontogramRecordId) => mutations.cancelOdontogramRecord.mutate(odontogramRecordId)}
        onUpdateProcedureStatus={(payload) => mutations.updateToothProcedureStatus.mutate(payload)}
        onClose={closeModal}
      />

      <MultipleToothSelectionModal open={activeModal === "multi-help"} onClose={closeModal} />
    </ClinicalShell>
  );
}
