import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useBranchStore } from "@/stores/branch.store";
import { useProfessionals, useTransferProfessionalBranch } from "../hooks/use-professionals";
import type { Professional } from "../services/professionals.service";

type TransferForm = {
  branchId: string;
  toProfessionalId: string;
  effectiveAt: string;
  moveFutureAppointments: boolean;
  moveFutureBlocks: boolean;
  copySchedules: boolean;
  copyAgendaConfig: boolean;
  endSourceAssignment: boolean;
  notes: string;
};

const emptyTransferForm: TransferForm = {
  branchId: "",
  toProfessionalId: "",
  effectiveAt: "",
  moveFutureAppointments: true,
  moveFutureBlocks: true,
  copySchedules: true,
  copyAgendaConfig: true,
  endSourceAssignment: true,
  notes: ""
};

function displayName(professional: Professional) {
  return `${professional.firstName} ${professional.lastName}`.trim();
}

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isAssignable(branch: Professional["branches"][number]) {
  if (branch.status && branch.status !== "ACTIVE") return false;
  return !branch.endsAt || new Date(branch.endsAt).getTime() > Date.now();
}

export function ProfessionalTransferModal({
  professional,
  onClose
}: {
  professional: Professional | null;
  onClose: () => void;
}) {
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const [form, setForm] = useState<TransferForm>(emptyTransferForm);
  const professionals = useProfessionals(undefined, "true", { branchId: form.branchId || activeBranchId || undefined, pageSize: 100 });
  const transfer = useTransferProfessionalBranch();

  useEffect(() => {
    if (!professional) {
      setForm(emptyTransferForm);
      return;
    }
    const firstBranch =
      professional.branches.find((branch) => branch.id === activeBranchId && isAssignable(branch)) ??
      professional.branches.find(isAssignable);
    setForm({
      ...emptyTransferForm,
      branchId: firstBranch?.id ?? "",
      effectiveAt: toDateTimeLocalValue(new Date()),
      notes: `Sustitucion de ${displayName(professional)}`
    });
  }, [activeBranchId, professional]);

  const candidates = useMemo(
    () =>
      (professionals.data ?? []).filter(
        (candidate) =>
          candidate.id !== professional?.id &&
          candidate.isActive &&
          candidate.branches.some((branch) => branch.id === form.branchId && isAssignable(branch))
      ),
    [form.branchId, professional?.id, professionals.data]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!professional || !form.branchId || !form.toProfessionalId || !form.effectiveAt) return;
    try {
      const result = await transfer.mutateAsync({
        branchId: form.branchId,
        fromProfessionalId: professional.id,
        toProfessionalId: form.toProfessionalId,
        effectiveAt: new Date(form.effectiveAt).toISOString(),
        moveFutureAppointments: form.moveFutureAppointments,
        moveFutureBlocks: form.moveFutureBlocks,
        copySchedules: form.copySchedules,
        copyAgendaConfig: form.copyAgendaConfig,
        endSourceAssignment: form.endSourceAssignment,
        notes: form.notes.trim() || undefined
      });
      toast.success(`Sustitucion aplicada: ${result.appointmentsTransferred} citas y ${result.blocksTransferred} bloqueos.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar la sustitucion");
    }
  };

  return (
    <Modal open={Boolean(professional)} title={professional ? `Sustituir a ${displayName(professional)}` : "Sustituir profesional"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          Traspaso conserva historial anterior y mueve solamente agenda futura seleccionada.
        </div>
        <label className="grid gap-1 text-sm text-[var(--text-primary)]">
          Sucursal
          <select className="h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3" value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value, toProfessionalId: "" }))}>
            <option value="">Selecciona sucursal</option>
            {(professional?.branches ?? []).filter(isAssignable).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[var(--text-primary)]">
          Profesional reemplazo
          <select className="h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3" value={form.toProfessionalId} disabled={!form.branchId} onChange={(event) => setForm((current) => ({ ...current, toProfessionalId: event.target.value }))}>
            <option value="">Selecciona reemplazo</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{displayName(candidate)}</option>)}
          </select>
        </label>
        {form.branchId && !professionals.isLoading && !candidates.length ? (
          <p className="text-sm text-[var(--status-warning-text)]">No existe otro profesional activo en esta sucursal. Crea primero usuario clinico reemplazo.</p>
        ) : null}
        <label className="grid gap-1 text-sm text-[var(--text-primary)]">
          Fecha efectiva
          <Input required type="datetime-local" value={form.effectiveAt} onChange={(event) => setForm((current) => ({ ...current, effectiveAt: event.target.value }))} />
        </label>
        <div className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] p-3 text-sm text-[var(--text-primary)]">
          {[
            ["moveFutureAppointments", "Traspasar citas futuras"],
            ["moveFutureBlocks", "Traspasar bloqueos futuros"],
            ["copySchedules", "Copiar horario semanal"],
            ["copyAgendaConfig", "Copiar configuracion de agenda"],
            ["endSourceAssignment", "Finalizar asignacion anterior"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(form[key as keyof TransferForm])} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
        <label className="grid gap-1 text-sm text-[var(--text-primary)]">
          Nota interna
          <textarea className="min-h-20 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={transfer.isPending || !form.branchId || !form.toProfessionalId}>{transfer.isPending ? "Sustituyendo..." : "Aplicar sustitucion"}</Button>
        </div>
      </form>
    </Modal>
  );
}
