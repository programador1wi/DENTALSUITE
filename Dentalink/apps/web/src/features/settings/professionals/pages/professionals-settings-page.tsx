import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useSpecialties } from "@/features/settings/specialties/hooks/use-specialties";
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import {
  useCreateProfessional,
  useDeactivateProfessional,
  useProfessionals,
  useTransferProfessionalBranch,
  useUpdateProfessional
} from "../hooks/use-professionals";
import type { Professional } from "../services/professionals.service";

type ProfessionalForm = {
  userId: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string;
  email: string;
  color: string;
  specialtyIds: string[];
  branchIds: string[];
};

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

const emptyForm: ProfessionalForm = {
  userId: "",
  firstName: "",
  lastName: "",
  licenseNumber: "",
  phone: "",
  email: "",
  color: "#111827",
  specialtyIds: [],
  branchIds: []
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

function textOrUndefined(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function displayName(professional: Professional) {
  return `${professional.firstName} ${professional.lastName}`.trim();
}

function toForm(professional: Professional): ProfessionalForm {
  return {
    userId: professional.user?.id ?? "",
    firstName: professional.firstName,
    lastName: professional.lastName,
    licenseNumber: professional.licenseNumber ?? "",
    phone: professional.phone ?? "",
    email: professional.email ?? "",
    color: professional.color ?? "#111827",
    specialtyIds: professional.specialties.map((specialty) => specialty.id),
    branchIds: professional.branches.slice(0, 1).map((branch) => branch.id)
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function isBranchCurrentlyAssignable(branch: Professional["branches"][number]) {
  if (branch.status && branch.status !== "ACTIVE") return false;
  const now = new Date();
  const endsAt = branch.endsAt ? new Date(branch.endsAt) : null;
  return !endsAt || endsAt > now;
}

export function ProfessionalsSettingsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"true" | "false">("true");
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<Professional | null>(null);
  const [form, setForm] = useState<ProfessionalForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [professionalFormContext, setProfessionalFormContext] = useState<"default" | "transfer" | "user">("default");
  const [contractProfessional, setContractProfessional] = useState<Professional | null>(null);
  const [commissionRate, setCommissionRate] = useState("");
  const [transferProfessional, setTransferProfessional] = useState<Professional | null>(null);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm);
  const [transferModalHidden, setTransferModalHidden] = useState(false);
  const [createdTransferReplacement, setCreatedTransferReplacement] = useState<Professional | null>(null);

  const professionals = useProfessionals(search || undefined, view);
  const specialties = useSpecialties(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");
  const users = useUsersQuery(undefined, "ACTIVE");
  const createProfessional = useCreateProfessional();
  const updateProfessional = useUpdateProfessional();
  const deactivateProfessional = useDeactivateProfessional();
  const transferBranch = useTransferProfessionalBranch();

  const actionPending =
    createProfessional.isPending ||
    updateProfessional.isPending ||
    deactivateProfessional.isPending ||
    transferBranch.isPending;

  const visibleProfessionals = professionals.data ?? [];
  const specialtiesById = useMemo(
    () => new Map((specialties.data ?? []).map((specialty) => [specialty.id, specialty.name])),
    [specialties.data]
  );
  const branchesById = useMemo(
    () => new Map((branches.data ?? []).map((branch) => [branch.id, branch.name])),
    [branches.data]
  );
  const availableUserOptions = useMemo(
    () =>
      (users.data ?? []).filter(
        (user) => !user.professional || user.professional.id === editing?.id || user.id === form.userId
      ),
    [editing?.id, form.userId, users.data]
  );
  const transferReplacementCandidates = useMemo(
    () => {
      const rows = [...(professionals.data ?? [])];
      if (createdTransferReplacement && !rows.some((professional) => professional.id === createdTransferReplacement.id)) {
        rows.push(createdTransferReplacement);
      }

      return rows.filter(
        (professional) =>
          professional.id !== transferProfessional?.id &&
          professional.isActive &&
          professional.branches.some(
            (branch) => branch.id === transferForm.branchId && isBranchCurrentlyAssignable(branch)
          )
      );
    },
    [createdTransferReplacement, professionals.data, transferForm.branchId, transferProfessional?.id]
  );

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (!userId || formOpen || editing) return;

    const user = users.data?.find((row) => row.id === userId);
    if (!user || user.professional) return;

    const branchIds = (searchParams.get("branchIds") ?? "")
      .split(",")
      .map((branchId) => branchId.trim())
      .filter(Boolean);

    setProfessionalFormContext("user");
    setForm({
      ...emptyForm,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
      branchIds: branchIds.length ? [branchIds[0]] : user.branches.slice(0, 1).map((branch) => branch.id)
    });
    setFormOpen(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("userId");
        next.delete("branchIds");
        return next;
      },
      { replace: true }
    );
  }, [editing, formOpen, searchParams, setSearchParams, users.data]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setProfessionalFormContext("default");
    setFormOpen(true);
  };

  const openEdit = (professional: Professional) => {
    setEditing(professional);
    setForm(toForm(professional));
    setProfessionalFormContext("default");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (professionalFormContext === "transfer") {
      setTransferModalHidden(false);
    }
    setProfessionalFormContext("default");
  };

  const submitProfessional = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    if (!form.specialtyIds.length || form.branchIds.length !== 1) return;

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      userId: textOrUndefined(form.userId),
      licenseNumber: textOrUndefined(form.licenseNumber),
      phone: textOrUndefined(form.phone),
      email: textOrUndefined(form.email),
      color: textOrUndefined(form.color),
      specialtyIds: form.specialtyIds,
      branchIds: form.branchIds
    };

    if (editing) {
      await updateProfessional.mutateAsync({ id: editing.id, payload });
    } else {
      const created = await createProfessional.mutateAsync(payload);
      if (professionalFormContext === "transfer") {
        setCreatedTransferReplacement(created);
        setTransferForm((current) => ({ ...current, toProfessionalId: created.id }));
        setTransferModalHidden(false);
        toast.success("Profesional creado y seleccionado como reemplazo.");
      }
    }

    closeForm();
  };

  const openContract = (professional: Professional) => {
    setContractProfessional(professional);
    setCommissionRate(String(professional.commissionRate ?? "0"));
  };

  const openTransfer = (professional: Professional) => {
    const firstBranch = professional.branches.find((branch) => isBranchCurrentlyAssignable(branch));
    setTransferProfessional(professional);
    setTransferModalHidden(false);
    setCreatedTransferReplacement(null);
    setTransferForm({
      ...emptyTransferForm,
      branchId: firstBranch?.id ?? "",
      effectiveAt: toDateTimeLocalValue(new Date()),
      notes: `Sustitucion de ${displayName(professional)}`
    });
  };

  const openCreateForTransfer = () => {
    if (!transferForm.branchId) return;

    navigate(`/settings/users?newCollaborator=professional&branchIds=${transferForm.branchId}`);
  };

  const submitContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contractProfessional) return;

    const normalizedRate = Number(commissionRate);
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0 || normalizedRate > 100) return;

    await updateProfessional.mutateAsync({
      id: contractProfessional.id,
      payload: { commissionRate: normalizedRate }
    });
    setContractProfessional(null);
    setCommissionRate("");
  };

  const submitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transferProfessional || !transferForm.branchId || !transferForm.toProfessionalId || !transferForm.effectiveAt) return;

    try {
      const result = await transferBranch.mutateAsync({
        branchId: transferForm.branchId,
        fromProfessionalId: transferProfessional.id,
        toProfessionalId: transferForm.toProfessionalId,
        effectiveAt: new Date(transferForm.effectiveAt).toISOString(),
        moveFutureAppointments: transferForm.moveFutureAppointments,
        moveFutureBlocks: transferForm.moveFutureBlocks,
        copySchedules: transferForm.copySchedules,
        copyAgendaConfig: transferForm.copyAgendaConfig,
        endSourceAssignment: transferForm.endSourceAssignment,
        notes: textOrUndefined(transferForm.notes)
      });

      toast.success(
        `Sustitucion aplicada: ${result.appointmentsTransferred} citas, ${result.blocksTransferred} bloqueos y ${result.schedulesCopied} horarios.`
      );
      setTransferProfessional(null);
      setTransferModalHidden(false);
      setCreatedTransferReplacement(null);
      setTransferForm(emptyTransferForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar la sustitucion");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestion de profesionales"
        description="Datos clinicos, sucursales, contratos y acceso directo a horarios por profesional."
        helpText="Esta vista concentra el flujo operativo del profesional. Los permisos siguen administrandose desde Usuarios y Roles."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            active={view}
            onChange={(nextView) => setView(nextView as "true" | "false")}
            items={[
              { key: "true", label: "Habilitados" },
              { key: "false", label: "Deshabilitados" }
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Buscar nombre, correo o cedula"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="sm:w-72"
            />
            <Button onClick={openCreate}>Nuevo profesional</Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          El contrato actual usa la comision global configurada para nominas. El horario se edita por sucursal desde la accion de cada profesional.
        </div>
      </Card>

      {professionals.isLoading || specialties.isLoading || branches.isLoading || users.isLoading ? (
        <LoadingState message="Cargando profesionales y catalogos..." />
      ) : null}
      {professionals.isError ? <ErrorState message={professionals.error.message} /> : null}
      {specialties.isError ? <ErrorState message={specialties.error.message} /> : null}
      {branches.isError ? <ErrorState message={branches.error.message} /> : null}
      {users.isError ? <ErrorState message={users.error.message} /> : null}

      {!professionals.isLoading && professionals.data ? (
        !visibleProfessionals.length ? (
          <EmptyState
            title={view === "true" ? "Sin profesionales habilitados" : "Sin profesionales deshabilitados"}
            description="No hay registros para los filtros seleccionados."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Profesional</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Especialidades</th>
                    <th className="px-4 py-3">Sucursales</th>
                    <th className="px-4 py-3">Contrato</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProfessionals.map((professional) => (
                    <tr key={professional.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-1 h-3 w-3 shrink-0 rounded-full border border-white shadow ring-1 ring-slate-200"
                            style={{ backgroundColor: professional.color ?? "#111827" }}
                          />
                          <div>
                            <p className="font-semibold text-slate-900">{displayName(professional)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {professional.licenseNumber ? `Cedula ${professional.licenseNumber}` : "Sin cedula"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <p>{professional.email || "Sin correo"}</p>
                        <p className="mt-1 text-xs text-slate-500">{professional.phone || "Sin telefono"}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {professional.specialties.map((specialty) => specialty.name).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {professional.branches.map((branch) => branch.name).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {Number(professional.commissionRate).toFixed(2)}%
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Comision global</p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          value={professional.isActive ? "HABILITADO" : "DESHABILITADO"}
                          tone={professional.isActive ? "success" : "warning"}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="secondary" onClick={() => openEdit(professional)}>
                            Datos
                          </Button>
                          <Button variant="secondary" onClick={() => openContract(professional)}>
                            Contrato
                          </Button>
                          <Button variant="secondary" onClick={() => openTransfer(professional)}>
                            Sustituir
                          </Button>
                          <Link
                            to={`/settings/online-scheduling/schedules?professionalId=${professional.id}`}
                            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                          >
                            Horarios
                          </Link>
                          {professional.isActive ? (
                            <Button
                              variant="danger"
                              disabled={actionPending}
                              onClick={() => void deactivateProfessional.mutateAsync(professional.id)}
                            >
                              Deshabilitar
                            </Button>
                          ) : (
                            <Button
                              disabled={actionPending}
                              onClick={() =>
                                void updateProfessional.mutateAsync({
                                  id: professional.id,
                                  payload: { isActive: true }
                                })
                              }
                            >
                              Habilitar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      <Modal
        open={formOpen}
        title={
          editing
            ? "Editar profesional"
            : professionalFormContext === "transfer"
              ? "Añadir profesional a la sucursal"
              : "Nuevo profesional"
        }
        onClose={closeForm}
      >
        <form className="space-y-4" onSubmit={submitProfessional}>
          <label className="block text-sm text-slate-700">
            Usuario vinculado
            <select
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
            >
              <option value="">Sin usuario de acceso</option>
              {availableUserOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} - {user.email}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Nombre
              <Input
                required
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Apellido
              <Input
                required
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Cedula
              <Input
                value={form.licenseNumber}
                onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Telefono
              <Input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Correo
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Color agenda
              <Input
                type="color"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                className="h-10 p-1"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-slate-200 p-3">
              <h4 className="text-sm font-semibold text-slate-900">Especialidades</h4>
              <div className="mt-2 max-h-36 space-y-2 overflow-auto pr-1">
                {(specialties.data ?? []).map((specialty) => (
                  <label key={specialty.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.specialtyIds.includes(specialty.id)}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          specialtyIds: toggleValue(current.specialtyIds, specialty.id)
                        }))
                      }
                    />
                    <span>{specialtiesById.get(specialty.id) ?? specialty.name}</span>
                  </label>
                ))}
              </div>
              {!form.specialtyIds.length ? (
                <p className="mt-2 text-xs text-amber-700">Selecciona al menos una especialidad.</p>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 p-3">
              <h4 className="text-sm font-semibold text-slate-900">Sucursales</h4>
              <div className="mt-2 max-h-36 space-y-2 overflow-auto pr-1">
                {(branches.data ?? []).map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="radio"
                      name="professional-branch"
                      checked={form.branchIds.includes(branch.id)}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          branchIds: current.branchIds.includes(branch.id) ? [] : [branch.id]
                        }))
                      }
                    />
                    <span>{branchesById.get(branch.id) ?? branch.name}</span>
                  </label>
                ))}
              </div>
              {form.branchIds.length !== 1 ? (
                <p className="mt-2 text-xs text-amber-700">Selecciona una sola sucursal.</p>
              ) : null}
            </section>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={actionPending || !form.specialtyIds.length || form.branchIds.length !== 1}
            >
              {editing ? "Actualizar datos" : "Crear profesional"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(contractProfessional)}
        title={contractProfessional ? `Contrato de ${displayName(contractProfessional)}` : "Contrato"}
        onClose={() => setContractProfessional(null)}
      >
        <form className="space-y-4" onSubmit={submitContract}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            El backend actual conserva una comision global por profesional. Esta comision alimenta el calculo de nominas del sistema.
          </div>
          <label className="block text-sm text-slate-700">
            Comision global (%)
            <Input
              required
              min={0}
              max={100}
              step="0.01"
              type="number"
              value={commissionRate}
              onChange={(event) => setCommissionRate(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setContractProfessional(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={actionPending}>
              Actualizar contrato
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(transferProfessional) && !transferModalHidden}
        title={transferProfessional ? `Sustituir a ${displayName(transferProfessional)}` : "Sustituir profesional"}
        onClose={() => {
          setTransferProfessional(null);
          setTransferModalHidden(false);
          setCreatedTransferReplacement(null);
          setTransferForm(emptyTransferForm);
        }}
      >
        <form className="space-y-4" onSubmit={submitTransfer}>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            El traspaso mueve agenda futura y conserva el historial anterior con el profesional original.
          </div>

          <label className="block text-sm text-slate-700">
            Sucursal donde se sustituye
            <select
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={transferForm.branchId}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  branchId: event.target.value,
                  toProfessionalId: ""
                }))
              }
            >
              <option value="">Selecciona sucursal</option>
              {(transferProfessional?.branches ?? []).filter(isBranchCurrentlyAssignable).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <label className="block text-sm text-slate-700">
              Profesional reemplazo
              <select
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50"
                value={transferForm.toProfessionalId}
                disabled={!transferForm.branchId || !transferReplacementCandidates.length}
                onChange={(event) => setTransferForm((current) => ({ ...current, toProfessionalId: event.target.value }))}
              >
                <option value="">Selecciona profesional nuevo</option>
                {transferReplacementCandidates.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {displayName(professional)}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {transferForm.branchId && !transferReplacementCandidates.length
                    ? "No hay otro profesional activo en esta sucursal."
                    : "Puedes crear un reemplazo nuevo para esta sucursal."}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!transferForm.branchId}
                  onClick={openCreateForTransfer}
                >
                  Añadir profesional
                </Button>
              </div>
            </div>
          </div>

          <label className="block text-sm text-slate-700">
            Fecha efectiva
            <Input
              required
              type="datetime-local"
              value={transferForm.effectiveAt}
              onChange={(event) => setTransferForm((current) => ({ ...current, effectiveAt: event.target.value }))}
            />
          </label>

          <div className="grid gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transferForm.moveFutureAppointments}
                onChange={(event) => setTransferForm((current) => ({ ...current, moveFutureAppointments: event.target.checked }))}
              />
              Traspasar citas futuras activas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transferForm.moveFutureBlocks}
                onChange={(event) => setTransferForm((current) => ({ ...current, moveFutureBlocks: event.target.checked }))}
              />
              Traspasar bloqueos futuros
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transferForm.copySchedules}
                onChange={(event) => setTransferForm((current) => ({ ...current, copySchedules: event.target.checked }))}
              />
              Copiar horario semanal al reemplazo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transferForm.copyAgendaConfig}
                onChange={(event) => setTransferForm((current) => ({ ...current, copyAgendaConfig: event.target.checked }))}
              />
              Copiar intervalo y duracion de agenda
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transferForm.endSourceAssignment}
                onChange={(event) => setTransferForm((current) => ({ ...current, endSourceAssignment: event.target.checked }))}
              />
              Finalizar asignacion del profesional anterior
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            Nota interna
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={transferForm.notes}
              onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTransferProfessional(null);
                setTransferModalHidden(false);
                setCreatedTransferReplacement(null);
                setTransferForm(emptyTransferForm);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={actionPending || !transferForm.branchId || !transferForm.toProfessionalId}>
              {transferBranch.isPending ? "Sustituyendo..." : "Aplicar sustitucion"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
