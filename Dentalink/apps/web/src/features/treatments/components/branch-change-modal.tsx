import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { TreatmentPlanDetail } from "@/features/treatments/services/treatments.service";

function professionalName(professional?: Professional | { firstName: string; lastName: string } | null) {
  if (!professional) return "No informado";
  return `${professional.firstName} ${professional.lastName}`.trim();
}

export function BranchChangeModal({
  open,
  plan,
  branches,
  branchesLoading,
  onClose,
  onConfirm,
  saving
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  branches: Branch[];
  branchesLoading: boolean;
  onClose: () => void;
  onConfirm: (payload: { branchId: string; professionalId: string }) => Promise<void>;
  saving: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const professionals = useProfessionals(undefined, "true", {
    branchId: branchId || undefined,
    pageSize: 100
  });
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;
  const professionalOptions = professionals.data ?? [];
  const selectedProfessional =
    professionalOptions.find((professional) => professional.id === professionalId) ?? null;
  const hasChanges = Boolean(
    plan && (branchId !== plan.branch.id || professionalId !== plan.professional.id)
  );

  useEffect(() => {
    if (!open || !plan) return;
    setBranchId(plan.branch.id);
    setProfessionalId(plan.professional.id);
    setConfirming(false);
  }, [open, plan?.branch.id, plan?.id, plan?.professional.id]);

  useEffect(() => {
    if (!open || !professionalOptions.length) return;
    const selectedStillVisible = professionalOptions.some(
      (professional) => professional.id === professionalId
    );
    if (!selectedStillVisible) setProfessionalId(professionalOptions[0]?.id ?? "");
  }, [open, professionalId, professionalOptions]);

  return (
    <Modal open={open} title="Cambiar sucursal" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>
              Selecciona la sucursal y el doctor que recibira este plan. El paciente pasara a formar parte de
              la sucursal asignada.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <label className="text-xs font-semibold text-slate-700">Sucursal *</label>
          <Select
            value={branchId}
            disabled={branchesLoading}
            onChange={(event) => {
              setBranchId(event.target.value);
              setProfessionalId("");
              setConfirming(false);
            }}
          >
            <option value="">Buscar sucursal...</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3">
          <label className="text-xs font-semibold text-slate-700">Doctor asignado *</label>
          <Select
            value={professionalId}
            disabled={!branchId || professionals.isLoading}
            onChange={(event) => {
              setProfessionalId(event.target.value);
              setConfirming(false);
            }}
          >
            <option value="">Seleccionar doctor...</option>
            {professionalOptions.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professionalName(professional)}
              </option>
            ))}
          </Select>
          {branchId && !professionals.isLoading && !professionalOptions.length ? (
            <p className="text-xs text-red-600">No hay profesionales activos en la sucursal seleccionada.</p>
          ) : null}
        </div>

        {confirming && selectedBranch && selectedProfessional ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-semibold">Confirma el cambio</p>
            <p className="mt-1">
              El paciente y el plan se moveran a {selectedBranch.name}, asignados a{" "}
              {professionalName(selectedProfessional)}.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {!confirming ? (
            <Button
              disabled={!branchId || !professionalId || !hasChanges}
              onClick={() => setConfirming(true)}
            >
              Revisar cambio
            </Button>
          ) : (
            <Button
              disabled={!branchId || !professionalId || saving}
              onClick={() => void onConfirm({ branchId, professionalId })}
            >
              Cambiar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
