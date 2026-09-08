import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { TreatmentPlanKind } from "@/features/treatments/services/treatments.service";


export const PLAN_KIND_LABELS: Record<TreatmentPlanKind, string> = {
  GENERAL: "General / Integral",
  ORTHODONTICS: "Ortodoncia"
};

function professionalName(professional?: { firstName: string; lastName: string } | null) {
  if (!professional) return "No informado";
  return `${professional.firstName} ${professional.lastName}`.trim();
}

function normalizeSpecialtyKey(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function specialtyKind(name?: string | null): TreatmentPlanKind | null {
  const key = normalizeSpecialtyKey(name);
  if (!key) return null;
  if (key === "ortodoncia" || key.includes("orthodontics")) return "ORTHODONTICS";
  if (key.includes("general") || key.includes("integral")) return "GENERAL";
  return null;
}

export function professionalPlanKinds(professional?: Professional | null): Map<TreatmentPlanKind, string> {
  const kinds = new Map<TreatmentPlanKind, string>();
  for (const specialty of professional?.specialties ?? []) {
    const kind = specialtyKind(specialty.name);
    if (kind) kinds.set(kind, specialty.name);
  }
  return kinds;
}

export function NewTreatmentPlanModal({
  open,
  patientBranchId,
  planCount,
  onClose,
  onSave,
  saving
}: {
  open: boolean;
  patientBranchId: string;
  planCount: number;
  onClose: () => void;
  onSave: (payload: {
    branchId: string;
    professionalId: string;
    kind: TreatmentPlanKind;
    name: string;
    description?: string;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [kind, setKind] = useState<TreatmentPlanKind | "">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", {
    branchId: branchId || undefined,
    pageSize: 100
  });
  const selectedProfessional =
    (professionals.data ?? []).find((professional) => professional.id === professionalId) ?? null;
  const kindOptions = useMemo(
    () => [...professionalPlanKinds(selectedProfessional).keys()],
    [selectedProfessional]
  );
  const canChooseKind = kindOptions.length > 1;
  const canSave = Boolean(branchId && professionalId && kind && name.trim());

  useEffect(() => {
    if (!open) return;
    setBranchId(patientBranchId);
    setProfessionalId("");
    setKind("");
    setName(`Plan de tratamiento ${planCount + 1}`);
    setDescription("");
  }, [open, patientBranchId, planCount]);

  useEffect(() => {
    if (!open || !selectedProfessional) return;
    if (kindOptions.length === 1) {
      const nextKind = kindOptions[0];
      setKind(nextKind);
      setName((current) =>
        current.trim() && !current.startsWith("Plan de tratamiento")
          ? current
          : `${PLAN_KIND_LABELS[nextKind]} ${planCount + 1}`
      );
      return;
    }
    if (!kindOptions.includes(kind as TreatmentPlanKind)) setKind("");
  }, [kind, kindOptions, open, planCount, selectedProfessional]);

  return (
    <Modal open={open} title="Nuevo plan de tratamiento" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-700">Sucursal *</label>
            <Select
              className="mt-2"
              value={branchId}
              disabled={branches.isLoading}
              onChange={(event) => {
                setBranchId(event.target.value);
                setProfessionalId("");
                setKind("");
              }}
            >
              <option value="">Seleccionar sucursal</option>
              {(branches.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Medico asignado *</label>
            <Select
              className="mt-2"
              value={professionalId}
              disabled={!branchId || professionals.isLoading}
              onChange={(event) => {
                setProfessionalId(event.target.value);
                setKind("");
              }}
            >
              <option value="">Seleccionar medico</option>
              {(professionals.data ?? []).map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professionalName(professional)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedProfessional ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Especialidades del medico</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedProfessional.specialties.length ? (
                selectedProfessional.specialties.map((specialty) => (
                  <span
                    key={specialty.id}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    {specialty.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-red-600">Sin especialidad valida para planes.</span>
              )}
            </div>
          </div>
        ) : null}

        {canChooseKind ? (
          <div>
            <label className="text-xs font-semibold text-slate-700">Tipo de plan *</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {kindOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                    kind === option
                      ? "border-sky-500 bg-sky-50 text-sky-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                  }`}
                  onClick={() => {
                    setKind(option);
                    setName(`${PLAN_KIND_LABELS[option]} ${planCount + 1}`);
                  }}
                >
                  <span className="font-semibold">{PLAN_KIND_LABELS[option]}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {option === "ORTHODONTICS"
                      ? "Ficha longitudinal de ortodoncia."
                      : "Plan integral con odontograma general."}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selectedProfessional && !kindOptions.length ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            El medico seleccionado no tiene especialidad General/Integral u Ortodoncia.
          </div>
        ) : null}

        <div className="grid gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Nombre del plan *</label>
            <Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Descripcion</label>
            <Textarea
              className="mt-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave || saving}
            onClick={() =>
              void onSave({
                branchId,
                professionalId,
                kind: kind as TreatmentPlanKind,
                name: name.trim(),
                description: description.trim() || undefined
              })
            }
          >
            {saving ? "Creando..." : "Crear plan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
