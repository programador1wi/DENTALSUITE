import { useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarClock,
  FilePenLine,
  UserPen,
  UserRoundCheck,
  UserRoundPlus,
  UserRoundX
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useUpdateProfessional } from "@/features/settings/professionals/hooks/use-professionals";
import { useRolesQuery } from "@/features/settings/roles/hooks/use-roles";
import { useAuthStore } from "@/stores/auth.store";
import { UsersModuleNav } from "../components/users-module-nav";
import {
  useCreateUser,
  useDeactivateUser,
  useUpdateUser,
  useUsersQuery
} from "../hooks/use-users";
import type { UserListItem } from "../services/users.service";

type UserForm = {
  branchIds: string[];
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
  primaryBranchId: string;
  roleId: string;
};

const supportedStatuses = new Set(["ACTIVE", "INACTIVE", "LOCKED", "PENDING"]);
const emptyUserForm: UserForm = {
  branchIds: [],
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  phone: "",
  primaryBranchId: "",
  roleId: ""
};

function userDisplayName(user: UserListItem) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function formFromUser(user: UserListItem): UserForm {
  return {
    branchIds: user.branches.map((branch) => branch.id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    password: "",
    phone: user.phone ?? "",
    primaryBranchId: user.branches.find((branch) => branch.isPrimary)?.id ?? user.branches[0]?.id ?? "",
    roleId: user.role?.id ?? ""
  };
}

export function UsersPage() {
  const actorId = useAuthStore((state) => state.user?.id);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [contractUser, setContractUser] = useState<UserListItem | null>(null);
  const [commissionRate, setCommissionRate] = useState("");

  const routeStatus = searchParams.get("status") ?? "";
  const status = supportedStatuses.has(routeStatus) ? routeStatus : "";
  const users = useUsersQuery(search || undefined, status || undefined);
  const roles = useRolesQuery(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const updateProfessional = useUpdateProfessional();

  const userMutationPending = createUser.isPending || updateUser.isPending || deactivateUser.isPending;
  const contractRate = Number(commissionRate);
  const contractRateValid = Number.isFinite(contractRate) && contractRate >= 0 && contractRate <= 100;

  const changeStatus = (nextStatus: string) => {
    setSearchParams(nextStatus ? { status: nextStatus } : {});
  };

  const openCreate = () => {
    setEditing(null);
    setUserForm(emptyUserForm);
    setUserFormOpen(true);
  };

  const openEdit = (user: UserListItem) => {
    setEditing(user);
    setUserForm(formFromUser(user));
    setUserFormOpen(true);
  };

  const closeUserForm = () => {
    setEditing(null);
    setUserForm(emptyUserForm);
    setUserFormOpen(false);
  };

  const toggleBranch = (branchId: string) => {
    setUserForm((current) => {
      const branchIds = current.branchIds.includes(branchId)
        ? current.branchIds.filter((selectedBranchId) => selectedBranchId !== branchId)
        : [...current.branchIds, branchId];

      return {
        ...current,
        branchIds,
        primaryBranchId: branchIds.includes(current.primaryBranchId)
          ? current.primaryBranchId
          : branchIds[0] ?? ""
      };
    });
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !userForm.firstName.trim() ||
      !userForm.lastName.trim() ||
      !userForm.roleId ||
      !userForm.branchIds.length ||
      !userForm.primaryBranchId
    ) {
      return;
    }

    if (editing) {
      await updateUser.mutateAsync({
        id: editing.id,
        payload: {
          branchIds: userForm.branchIds,
          firstName: userForm.firstName.trim(),
          lastName: userForm.lastName.trim(),
          password: userForm.password.trim() || undefined,
          phone: userForm.phone.trim() || undefined,
          primaryBranchId: userForm.primaryBranchId,
          roleId: userForm.roleId
        }
      });
    } else {
      if (!userForm.email.trim() || userForm.password.trim().length < 8) return;

      await createUser.mutateAsync({
        branchIds: userForm.branchIds,
        email: userForm.email.trim(),
        firstName: userForm.firstName.trim(),
        lastName: userForm.lastName.trim(),
        password: userForm.password.trim(),
        phone: userForm.phone.trim() || undefined,
        primaryBranchId: userForm.primaryBranchId,
        roleId: userForm.roleId
      });
    }

    closeUserForm();
  };

  const setUserEnabled = async (user: UserListItem) => {
    if (user.status === "ACTIVE") {
      await deactivateUser.mutateAsync(user.id);
      return;
    }

    await updateUser.mutateAsync({
      id: user.id,
      payload: { status: "ACTIVE" }
    });
  };

  const openContract = (user: UserListItem) => {
    if (!user.professional) return;

    setContractUser(user);
    setCommissionRate(String(user.professional.commissionRate ?? "0"));
  };

  const submitContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contractUser?.professional || !contractRateValid) return;

    await updateProfessional.mutateAsync({
      id: contractUser.professional.id,
      payload: { commissionRate: contractRate }
    });
    setContractUser(null);
    setCommissionRate("");
  };

  return (
    <div className="space-y-4">
      <UsersModuleNav
        actions={
          <Button onClick={openCreate}>
            <UserRoundPlus className="mr-1.5 h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      >
        <div className="space-y-4">
          <PageHeader title="Usuarios" description="Administracion de usuarios por organizacion" />

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[minmax(240px,1fr)_260px]">
            <Input
              placeholder="Buscar por nombre o correo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Filtrar usuarios
              <Select value={status} onChange={(event) => changeStatus(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Habilitados</option>
                <option value="INACTIVE">Deshabilitados</option>
                <option value="LOCKED">Bloqueados</option>
                <option value="PENDING">Pendientes</option>
              </Select>
            </label>
          </div>

          {users.isLoading ? <LoadingState message="Cargando usuarios..." /> : null}
          {users.isError ? <ErrorState message={users.error.message} /> : null}
          {roles.isError ? <ErrorState message={roles.error.message} /> : null}
          {branches.isError ? <ErrorState message={branches.error.message} /> : null}
          {createUser.isError ? <ErrorState message={createUser.error.message} /> : null}
          {updateUser.isError ? <ErrorState message={updateUser.error.message} /> : null}
          {deactivateUser.isError ? <ErrorState message={deactivateUser.error.message} /> : null}

          {users.data ? (
            <DataTable
              rows={users.data}
              empty={<EmptyState title="Sin usuarios" description="No hay registros para los filtros seleccionados." />}
              columns={[
                {
                  key: "firstName",
                  title: "Usuario",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-slate-900">{userDisplayName(row)}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.role?.name ?? "Sin perfil"}</p>
                    </div>
                  )
                },
                {
                  key: "email",
                  title: "Contacto",
                  render: (row) => (
                    <div>
                      <p>{row.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.phone || "Sin telefono"}</p>
                    </div>
                  )
                },
                {
                  key: "branches",
                  title: "Sucursales",
                  render: (row) => row.branches.map((branch) => branch.name).join(", ") || "-"
                },
                {
                  key: "status",
                  title: "Estado",
                  render: (row) => (
                    <Badge
                      value={row.status}
                      tone={row.status === "ACTIVE" ? "success" : row.status === "INACTIVE" ? "warning" : "default"}
                    />
                  )
                },
                {
                  key: "id",
                  title: "Acciones",
                  render: (row) => (
                    <div className="flex min-w-[390px] flex-nowrap justify-end gap-1.5">
                      {row.professional?.isActive ? (
                        <>
                          <ActionLink
                            title="Editar horarios"
                            to={`/settings/schedules?professionalId=${row.professional.id}`}
                          >
                            <CalendarClock className="h-5 w-5" />
                            <span>Editar horarios</span>
                          </ActionLink>
                          <ActionButton title="Editar contrato" onClick={() => openContract(row)}>
                            <FilePenLine className="h-5 w-5" />
                            <span>Editar contrato</span>
                          </ActionButton>
                        </>
                      ) : null}

                      <ActionButton title="Editar datos y permisos" onClick={() => openEdit(row)}>
                        <UserPen className="h-5 w-5" />
                        <span>Editar datos y permisos</span>
                      </ActionButton>

                      <ActionButton
                        title={row.status === "ACTIVE" ? "Deshabilitar usuario" : "Habilitar usuario"}
                        disabled={userMutationPending || row.id === actorId}
                        onClick={() => void setUserEnabled(row)}
                      >
                        {row.status === "ACTIVE" ? (
                          <UserRoundX className="h-5 w-5" />
                        ) : (
                          <UserRoundCheck className="h-5 w-5" />
                        )}
                        <span>{row.status === "ACTIVE" ? "Deshabilitar" : "Habilitar"}</span>
                      </ActionButton>
                    </div>
                  )
                }
              ]}
            />
          ) : null}
        </div>
      </UsersModuleNav>

      <Modal open={userFormOpen} title={editing ? "Editar datos y permisos" : "Nuevo usuario"} onClose={closeUserForm}>
        <form className="space-y-4" onSubmit={submitUser}>
          {roles.isLoading || branches.isLoading ? <LoadingState message="Cargando perfiles y sucursales..." /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-700">
              Nombre
              <Input
                required
                value={userForm.firstName}
                onChange={(event) => setUserForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Apellido
              <Input
                required
                value={userForm.lastName}
                onChange={(event) => setUserForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Correo
              <Input
                required={!editing}
                disabled={Boolean(editing)}
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Telefono
              <Input
                value={userForm.phone}
                onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              {editing ? "Nueva contrasena opcional" : "Contrasena"}
              <Input
                required={!editing}
                minLength={8}
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Perfil
              <Select
                required
                value={userForm.roleId}
                onChange={(event) => setUserForm((current) => ({ ...current, roleId: event.target.value }))}
              >
                <option value="">Selecciona perfil</option>
                {(roles.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <section className="rounded-lg border border-slate-200 p-3">
            <h4 className="text-sm font-semibold text-slate-900">Sucursales y permisos operativos</h4>
            <div className="mt-2 grid max-h-36 gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {(branches.data ?? []).map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={userForm.branchIds.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                  />
                  <span>{branch.name}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 grid gap-1 text-sm text-slate-700">
              Sucursal principal
              <Select
                required
                value={userForm.primaryBranchId}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, primaryBranchId: event.target.value }))
                }
              >
                <option value="">Selecciona sucursal</option>
                {(branches.data ?? [])
                  .filter((branch) => userForm.branchIds.includes(branch.id))
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </Select>
            </label>
          </section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeUserForm}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                userMutationPending ||
                !userForm.roleId ||
                !userForm.branchIds.length ||
                !userForm.primaryBranchId ||
                (!editing && userForm.password.trim().length < 8)
              }
            >
              {editing ? "Actualizar usuario" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(contractUser)}
        title={contractUser ? `Editar contrato de ${userDisplayName(contractUser)}` : "Editar contrato"}
        onClose={() => setContractUser(null)}
      >
        <form className="space-y-4" onSubmit={submitContract}>
          <p className="text-sm text-slate-600">
            Esta accion actualiza la comision global del profesional vinculado al usuario.
          </p>
          <label className="grid gap-1 text-sm text-slate-700">
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
          {!contractRateValid && commissionRate ? (
            <p className="text-sm text-red-600">La comision debe estar entre 0 y 100.</p>
          ) : null}
          {updateProfessional.isError ? <ErrorState message={updateProfessional.error.message} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setContractUser(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!contractRateValid || updateProfessional.isPending}>
              {updateProfessional.isPending ? "Actualizando..." : "Actualizar contrato"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  title
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-16 w-[92px] shrink-0 flex-col items-center justify-center gap-1 whitespace-normal rounded px-1 py-1 text-center text-[11px] leading-3 text-slate-600 transition hover:bg-sky-50 hover:text-[#0679c8] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ActionLink({ children, title, to }: { children: ReactNode; title: string; to: string }) {
  return (
    <Link
      title={title}
      to={to}
      className="inline-flex min-h-16 w-[92px] shrink-0 flex-col items-center justify-center gap-1 whitespace-normal rounded px-1 py-1 text-center text-[11px] leading-3 text-slate-600 transition hover:bg-sky-50 hover:text-[#0679c8]"
    >
      {children}
    </Link>
  );
}
