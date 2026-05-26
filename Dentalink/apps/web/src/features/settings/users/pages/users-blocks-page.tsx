import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, LockKeyhole } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { createAppointment } from "@/features/agenda/services/appointments.service";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useAuthStore } from "@/stores/auth.store";
import { UsersModuleNav } from "../components/users-module-nav";
import { useLockAllUserAccess, useUsersQuery } from "../hooks/use-users";

type AgendaBlockPayload = {
  branchId: string;
  endAt: string;
  notes: string;
  professionalIds: string[];
  startAt: string;
  title: string;
};

type AgendaBlockSummary = {
  created: number;
  failed: string[];
};

export function AgendaUsersBlockPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [title, setTitle] = useState("Bloqueo general");
  const [notes, setNotes] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true");
  const availableProfessionals = useMemo(
    () =>
      (professionals.data ?? []).filter((professional) =>
        professional.branches.some((branch) => branch.id === branchId)
      ),
    [branchId, professionals.data]
  );

  const blockAgenda = useMutation<AgendaBlockSummary, Error, AgendaBlockPayload>({
    mutationFn: async (payload) => {
      const results = await Promise.allSettled(
        payload.professionalIds.map((professionalId) =>
          createAppointment({
            branchId: payload.branchId,
            endAt: payload.endAt,
            notes: payload.notes || undefined,
            professionalId,
            startAt: payload.startAt,
            status: "BLOCKED",
            title: payload.title
          })
        )
      );

      return {
        created: results.filter((result) => result.status === "fulfilled").length,
        failed: results.flatMap((result) => {
          if (result.status === "fulfilled") return [];
          return [result.reason instanceof Error ? result.reason.message : "No se pudo crear un bloqueo."];
        })
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] })
  });

  const submitBlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (!branchId || !title.trim() || !Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf())) return;
    if (end <= start || !availableProfessionals.length) return;

    blockAgenda.mutate({
      branchId,
      endAt: end.toISOString(),
      notes: notes.trim(),
      professionalIds: availableProfessionals.map((professional) => professional.id),
      startAt: start.toISOString(),
      title: title.trim()
    });
  };

  const rangeInvalid = Boolean(startAt && endAt && new Date(endAt) <= new Date(startAt));

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        <div className="space-y-4">
          <PageHeader
            title="Bloquear agendas"
            description="Crea un bloqueo de agenda para cada profesional habilitado de la sucursal seleccionada."
          />

          {branches.isLoading || professionals.isLoading ? (
            <LoadingState message="Cargando profesionales y sucursales..." />
          ) : null}
          {branches.isError ? <ErrorState message={branches.error.message} /> : null}
          {professionals.isError ? <ErrorState message={professionals.error.message} /> : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
            <Card>
              <form className="space-y-4" onSubmit={submitBlock}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-slate-700">
                    Sucursal
                    <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                      <option value="">Selecciona sucursal</option>
                      {(branches.data ?? []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    Titulo del bloqueo
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    Inicio
                    <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                  </label>

                  <label className="grid gap-1 text-sm text-slate-700">
                    Fin
                    <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                  </label>
                </div>

                <label className="grid gap-1 text-sm text-slate-700">
                  Notas
                  <Input
                    placeholder="Motivo operativo"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>

                {rangeInvalid ? <p className="text-sm text-red-600">El fin debe ser posterior al inicio.</p> : null}
                {blockAgenda.isError ? <ErrorState message={blockAgenda.error.message} /> : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="submit"
                    disabled={
                      blockAgenda.isPending ||
                      !branchId ||
                      !title.trim() ||
                      !startAt ||
                      !endAt ||
                      rangeInvalid ||
                      !availableProfessionals.length
                    }
                  >
                    <CalendarClock className="mr-1.5 h-4 w-4" />
                    {blockAgenda.isPending ? "Bloqueando..." : "Bloquear agendas"}
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Alcance</h3>
              <p className="text-sm text-slate-600">
                {branchId
                  ? `${availableProfessionals.length} profesionales habilitados recibiran un bloqueo en esa sucursal.`
                  : "Selecciona una sucursal para calcular los profesionales afectados."}
              </p>
              <div className="max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2">
                {availableProfessionals.length ? (
                  availableProfessionals.map((professional) => (
                    <p key={professional.id} className="border-b border-slate-100 px-2 py-1.5 text-xs text-slate-600 last:border-0">
                      {professional.firstName} {professional.lastName}
                    </p>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-xs text-slate-500">Sin profesionales para el alcance actual.</p>
                )}
              </div>
            </Card>
          </div>

          {blockAgenda.data ? (
            <Card className="space-y-2 border-sky-200 bg-sky-50/60">
              <p className="text-sm font-semibold text-slate-900">
                Bloqueos creados: {blockAgenda.data.created}
              </p>
              {blockAgenda.data.failed.length ? (
                <p className="text-sm text-amber-800">
                  {blockAgenda.data.failed.length} bloqueos no se crearon por conflictos o validaciones de agenda.
                </p>
              ) : (
                <p className="text-sm text-slate-600">La agenda quedo bloqueada para todo el alcance seleccionado.</p>
              )}
            </Card>
          ) : null}
        </div>
      </UsersModuleNav>
    </div>
  );
}

export function AccessUsersBlockPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const actorId = useAuthStore((state) => state.user?.id);
  const activeUsers = useUsersQuery(undefined, "ACTIVE");
  const lockedUsers = useUsersQuery(undefined, "LOCKED");
  const lockAccess = useLockAllUserAccess();
  const visibleLockableUsers = (activeUsers.data ?? []).filter((user) => user.id !== actorId);

  const runLock = async () => {
    await lockAccess.mutateAsync();
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        <div className="space-y-4">
          <PageHeader
            title="Bloquear acceso"
            description="Bloquea usuarios activos de la organizacion y conserva abierta la sesion que ejecuta la accion."
          />

          {activeUsers.isLoading || lockedUsers.isLoading ? <LoadingState message="Cargando usuarios..." /> : null}
          {activeUsers.isError ? <ErrorState message={activeUsers.error.message} /> : null}
          {lockedUsers.isError ? <ErrorState message={lockedUsers.error.message} /> : null}
          {lockAccess.isError ? <ErrorState message={lockAccess.error.message} /> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Activos visibles</p>
              <p className="text-3xl font-semibold text-slate-900">{visibleLockableUsers.length}</p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Ya bloqueados</p>
              <p className="text-3xl font-semibold text-slate-900">{lockedUsers.data?.length ?? 0}</p>
            </Card>
            <Card className="flex items-center justify-end">
              <Button variant="danger" disabled={lockAccess.isPending} onClick={() => setConfirmOpen(true)}>
                <LockKeyhole className="mr-1.5 h-4 w-4" />
                Bloquear acceso global
              </Button>
            </Card>
          </div>

          <Card className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Usuarios activos visibles antes del bloqueo</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Correo</th>
                    <th className="px-3 py-2">Perfil</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLockableUsers.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{user.email}</td>
                      <td className="px-3 py-2 text-slate-600">{user.role?.name ?? "Sin perfil"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {lockAccess.data ? (
            <Card className="border-sky-200 bg-sky-50/60 text-sm text-slate-700">
              Se bloquearon {lockAccess.data.updated} usuarios activos y se revocaron sus sesiones abiertas.
            </Card>
          ) : null}
        </div>
      </UsersModuleNav>

      <Modal open={confirmOpen} title="Bloquear acceso global" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta accion cambia a bloqueado el acceso de todos los usuarios activos de la organizacion excepto tu usuario.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" disabled={lockAccess.isPending} onClick={() => void runLock()}>
              {lockAccess.isPending ? "Bloqueando..." : "Confirmar bloqueo"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
