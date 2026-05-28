import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarClock,
  CheckSquare,
  Eraser,
  FilePenLine,
  Search,
  ShieldCheck,
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
import { usePermissionsQuery } from "@/features/settings/permissions/hooks/use-permissions";
import type { PermissionListItem } from "@/features/settings/permissions/services/permissions.service";
import { useUpdateProfessional } from "@/features/settings/professionals/hooks/use-professionals";
import { useRolesQuery } from "@/features/settings/roles/hooks/use-roles";
import { useAuthStore } from "@/stores/auth.store";
import { UsersModuleNav } from "../components/users-module-nav";
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsersQuery } from "../hooks/use-users";
import type { UserListItem } from "../services/users.service";

type UserForm = {
  branchIds: string[];
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  permissionIds: string[];
  phone: string;
  primaryBranchId: string;
  roleId: string;
};

const supportedStatuses = new Set(["ACTIVE", "INACTIVE", "LOCKED", "PENDING"]);
const moduleLabels: Record<string, string> = {
  accounts_receivable: "Cuentas por cobrar",
  appointments: "Agenda",
  branches: "Sucursales",
  budgets: "Presupuestos",
  cash_register: "Cajas",
  clinical: "Clinica",
  collections: "Cobranza",
  dashboard: "Dashboard",
  documents: "Documentos",
  inventory: "Inventario",
  labs: "Laboratorios",
  payments: "Pagos",
  payment_methods: "Medios de pago",
  permissions: "Permisos",
  price_lists: "Listas de precios",
  procedures: "Prestaciones",
  professionals: "Profesionales",
  reports: "Reportes",
  roles: "Perfiles",
  schedules: "Horarios",
  settings: "Configuracion",
  specialties: "Especialidades",
  system: "Sistema",
  treatment_plans: "Tratamientos",
  users: "Usuarios"
};

const permissionLabels: Record<string, string> = {
  "accounts_receivable.read": "Ver cuentas por cobrar",
  "appointments.block": "Bloquear espacios de agenda",
  "appointments.cancel": "Cancelar citas",
  "appointments.create": "Crear citas",
  "appointments.overbook": "Permitir sobrecupo en agenda",
  "appointments.read": "Ver agenda y citas",
  "appointments.status.update": "Cambiar estado de citas",
  "appointments.update": "Editar citas",
  "branches.create": "Crear sucursales",
  "branches.deactivate": "Desactivar sucursales",
  "branches.read": "Ver sucursales",
  "branches.update": "Editar sucursales",
  "budgets.accept": "Aceptar presupuestos",
  "budgets.create": "Crear presupuestos",
  "budgets.print": "Imprimir presupuestos",
  "budgets.read": "Ver presupuestos",
  "budgets.reject": "Rechazar presupuestos",
  "budgets.send": "Enviar presupuestos",
  "budgets.update": "Editar presupuestos",
  "cash_register.close": "Cerrar caja",
  "cash_register.close_any": "Cerrar cualquier caja",
  "cash_register.move": "Registrar movimientos de caja",
  "cash_register.open": "Abrir caja",
  "cash_register.read": "Ver caja",
  "chairs.create": "Crear sillones",
  "chairs.deactivate": "Desactivar sillones",
  "chairs.read": "Ver sillones",
  "chairs.update": "Editar sillones",
  "clinical.documents.create": "Crear documentos clinicos",
  "clinical.evolutions.create": "Crear evoluciones clinicas",
  "clinical.evolutions.sign": "Firmar evoluciones clinicas",
  "clinical.history.update": "Editar historia clinica",
  "clinical.odontogram.read": "Ver odontograma",
  "clinical.odontogram.write": "Editar odontograma",
  "clinical.periodontogram.read": "Ver periodontograma",
  "clinical.periodontogram.write": "Editar periodontograma",
  "clinical.prescriptions.create": "Crear recetas",
  "clinical.read": "Ver ficha clinica",
  "clinical.templates.manage": "Gestionar plantillas clinicas",
  "collections.activities.create": "Registrar actividades de cobranza",
  "collections.create": "Crear casos de cobranza",
  "collections.detect": "Detectar cuentas vencidas",
  "collections.read": "Ver cobranza",
  "collections.update": "Editar casos de cobranza",
  "consent_templates.create": "Crear plantillas de consentimiento",
  "consent_templates.deactivate": "Desactivar plantillas de consentimiento",
  "consent_templates.read": "Ver plantillas de consentimiento",
  "consent_templates.update": "Editar plantillas de consentimiento",
  "consents.create": "Generar consentimientos",
  "consents.pdf": "Descargar PDF de consentimientos",
  "consents.read": "Ver consentimientos",
  "consents.sign": "Firmar consentimientos",
  "dashboard.read": "Ver dashboard",
  "files.read": "Ver archivos de pacientes",
  "files.upload": "Subir archivos de pacientes",
  "installments.create": "Crear convenios de pago",
  "installments.pay": "Registrar pagos de convenios",
  "installments.read": "Ver convenios de pago",
  "inventory.alerts.read": "Ver alertas de inventario",
  "inventory.create": "Crear articulos de inventario",
  "inventory.deactivate": "Desactivar articulos de inventario",
  "inventory.movements.create": "Crear movimientos de inventario",
  "inventory.movements.read": "Ver movimientos de inventario",
  "inventory.read": "Ver inventario",
  "inventory.update": "Editar inventario",
  "lab_orders.cost.update": "Editar costos de laboratorio",
  "lab_orders.create": "Crear ordenes de laboratorio",
  "lab_orders.read": "Ver ordenes de laboratorio",
  "lab_orders.update": "Editar ordenes de laboratorio",
  "lab_profitability.read": "Ver rentabilidad de laboratorio",
  "lab_providers.create": "Crear laboratorios",
  "lab_providers.deactivate": "Desactivar laboratorios",
  "lab_providers.read": "Ver laboratorios",
  "lab_providers.update": "Editar laboratorios",
  "payment_links.create": "Crear links de pago",
  "payment_methods.create": "Crear medios de pago",
  "payment_methods.deactivate": "Desactivar medios de pago",
  "payment_methods.read": "Ver medios de pago",
  "payment_methods.update": "Editar medios de pago",
  "payments.allocate": "Asignar pagos a tratamientos",
  "payments.create": "Recibir pagos",
  "payments.override.closed_cash": "Permitir pagos sin caja abierta",
  "payments.read": "Ver pagos",
  "payments.refund": "Registrar devoluciones",
  "permissions.create": "Crear permisos",
  "permissions.deactivate": "Desactivar permisos",
  "permissions.read": "Ver permisos",
  "permissions.update": "Editar permisos",
  "price_lists.create": "Crear listas de precios",
  "price_lists.deactivate": "Desactivar listas de precios",
  "price_lists.read": "Ver listas de precios",
  "price_lists.update": "Editar listas de precios",
  "procedure_categories.create": "Crear categorias de prestaciones",
  "procedure_categories.deactivate": "Desactivar categorias de prestaciones",
  "procedure_categories.read": "Ver categorias de prestaciones",
  "procedure_categories.update": "Editar categorias de prestaciones",
  "procedures.create": "Crear prestaciones",
  "procedures.deactivate": "Desactivar prestaciones",
  "procedures.read": "Ver prestaciones",
  "procedures.update": "Editar prestaciones",
  "professionals.create": "Crear profesionales",
  "professionals.deactivate": "Desactivar profesionales",
  "professionals.read": "Ver profesionales",
  "professionals.update": "Editar profesionales",
  "reports.export": "Exportar reportes",
  "reports.read": "Ver reportes",
  "roles.create": "Crear perfiles",
  "roles.deactivate": "Desactivar perfiles",
  "roles.read": "Ver perfiles",
  "roles.update": "Editar perfiles",
  "schedules.create": "Crear horarios",
  "schedules.deactivate": "Desactivar horarios",
  "schedules.read": "Ver horarios",
  "schedules.update": "Editar horarios",
  "settings.read": "Ver configuracion",
  "settings.update": "Editar configuracion",
  "specialties.create": "Crear especialidades",
  "specialties.deactivate": "Desactivar especialidades",
  "specialties.read": "Ver especialidades",
  "specialties.update": "Editar especialidades",
  "suppliers.create": "Crear proveedores",
  "suppliers.deactivate": "Desactivar proveedores",
  "suppliers.read": "Ver proveedores",
  "suppliers.update": "Editar proveedores",
  "system.manage_all": "Administracion completa del sistema",
  "treatment_plans.alternatives.manage": "Gestionar alternativas de tratamiento",
  "treatment_plans.create": "Crear planes de tratamiento",
  "treatment_plans.read": "Ver planes de tratamiento",
  "treatment_plans.status.update": "Cambiar estado de tratamientos",
  "treatment_plans.update": "Editar planes de tratamiento",
  "users.create": "Crear usuarios",
  "users.deactivate": "Desactivar usuarios",
  "users.read": "Ver usuarios",
  "users.update": "Editar usuarios"
};

const emptyUserForm: UserForm = {
  branchIds: [],
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  permissionIds: [],
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
    permissionIds: user.permissions.map((permission) => permission.id),
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
  const [permissionSearch, setPermissionSearch] = useState("");

  const routeStatus = searchParams.get("status") ?? "";
  const status = supportedStatuses.has(routeStatus) ? routeStatus : "";
  const users = useUsersQuery(search || undefined, status || undefined);
  const roles = useRolesQuery(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");
  const permissions = usePermissionsQuery(undefined, undefined, "true");
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const updateProfessional = useUpdateProfessional();

  const userMutationPending = createUser.isPending || updateUser.isPending || deactivateUser.isPending;
  const contractRate = Number(commissionRate);
  const contractRateValid = Number.isFinite(contractRate) && contractRate >= 0 && contractRate <= 100;
  const selectedPermissions = useMemo(() => new Set(userForm.permissionIds), [userForm.permissionIds]);
  const groupedPermissions = useMemo(
    () => groupPermissions(permissions.data ?? [], permissionSearch),
    [permissions.data, permissionSearch]
  );
  const selectedRolePermissionIds = useMemo(
    () =>
      roles.data
        ?.find((role) => role.id === userForm.roleId)
        ?.permissions.map((permission) => permission.id) ?? [],
    [roles.data, userForm.roleId]
  );

  const changeStatus = (nextStatus: string) => {
    setSearchParams(nextStatus ? { status: nextStatus } : {});
  };

  const openCreate = () => {
    setEditing(null);
    setUserForm(emptyUserForm);
    setPermissionSearch("");
    setUserFormOpen(true);
  };

  const openEdit = (user: UserListItem) => {
    setEditing(user);
    setUserForm(formFromUser(user));
    setPermissionSearch("");
    setUserFormOpen(true);
  };

  const closeUserForm = () => {
    setEditing(null);
    setUserForm(emptyUserForm);
    setPermissionSearch("");
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
          : (branchIds[0] ?? "")
      };
    });
  };

  const setRole = (roleId: string) => {
    const rolePermissionIds =
      roles.data?.find((role) => role.id === roleId)?.permissions.map((permission) => permission.id) ?? [];
    setUserForm((current) => ({ ...current, roleId, permissionIds: rolePermissionIds }));
  };

  const togglePermission = (permissionId: string) => {
    setUserForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((selectedPermissionId) => selectedPermissionId !== permissionId)
        : [...current.permissionIds, permissionId]
    }));
  };

  const setAllPermissions = () => {
    setUserForm((current) => ({
      ...current,
      permissionIds: (permissions.data ?? []).map((permission) => permission.id)
    }));
  };

  const clearPermissions = () => {
    setUserForm((current) => ({ ...current, permissionIds: [] }));
  };

  const applyRolePermissions = () => {
    setUserForm((current) => ({ ...current, permissionIds: selectedRolePermissionIds }));
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
          permissionIds: userForm.permissionIds,
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
        permissionIds: userForm.permissionIds,
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
          {permissions.isError ? <ErrorState message={permissions.error.message} /> : null}
          {createUser.isError ? <ErrorState message={createUser.error.message} /> : null}
          {updateUser.isError ? <ErrorState message={updateUser.error.message} /> : null}
          {deactivateUser.isError ? <ErrorState message={deactivateUser.error.message} /> : null}

          {users.data ? (
            <DataTable
              rows={users.data}
              tableClassName="table-fixed"
              containerClassName="overflow-hidden"
              empty={
                <EmptyState
                  title="Sin usuarios"
                  description="No hay registros para los filtros seleccionados."
                />
              }
              columns={[
                {
                  key: "firstName",
                  title: "Usuario",
                  wrap: true,
                  headerClassName: "w-[22%]",
                  cellClassName: "min-w-0",
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{userDisplayName(row)}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.role?.name ?? "Sin perfil"}</p>
                    </div>
                  )
                },
                {
                  key: "email",
                  title: "Contacto",
                  wrap: true,
                  headerClassName: "w-[22%]",
                  cellClassName: "min-w-0",
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="truncate" title={row.email}>
                        {row.email}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{row.phone || "Sin telefono"}</p>
                    </div>
                  )
                },
                {
                  key: "branches",
                  title: "Sucursales",
                  wrap: true,
                  headerClassName: "w-[30%]",
                  cellClassName: "min-w-0",
                  render: (row) => <BranchSummary branches={row.branches} />
                },
                {
                  key: "status",
                  title: "Estado",
                  headerClassName: "w-[110px]",
                  render: (row) => (
                    <Badge
                      value={row.status}
                      tone={
                        row.status === "ACTIVE"
                          ? "success"
                          : row.status === "INACTIVE"
                            ? "warning"
                            : "default"
                      }
                    />
                  )
                },
                {
                  key: "id",
                  title: "Acciones",
                  headerClassName: "w-[168px] text-right",
                  render: (row) => (
                    <div className="flex flex-nowrap justify-end gap-1">
                      {row.professional?.isActive ? (
                        <>
                          <ActionLink
                            title="Editar horarios"
                            to={`/settings/online-scheduling/schedules?professionalId=${row.professional.id}`}
                          >
                            <CalendarClock className="h-5 w-5" />
                          </ActionLink>
                          <ActionButton title="Editar contrato" onClick={() => openContract(row)}>
                            <FilePenLine className="h-5 w-5" />
                          </ActionButton>
                        </>
                      ) : null}

                      <ActionButton title="Editar datos y permisos" onClick={() => openEdit(row)}>
                        <UserPen className="h-5 w-5" />
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
                      </ActionButton>
                    </div>
                  )
                }
              ]}
            />
          ) : null}
        </div>
      </UsersModuleNav>

      <Modal
        open={userFormOpen}
        title={editing ? "Editar datos y permisos" : "Nuevo usuario"}
        size="xl"
        onClose={closeUserForm}
      >
        <form className="space-y-4" onSubmit={submitUser}>
          {roles.isLoading || branches.isLoading || permissions.isLoading ? (
            <LoadingState message="Cargando perfiles, sucursales y permisos..." />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-700">
              Nombre
              <Input
                required
                value={userForm.firstName}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, firstName: event.target.value }))
                }
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
              <Select required value={userForm.roleId} onChange={(event) => setRole(event.target.value)}>
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
            <h4 className="text-sm font-semibold text-slate-900">Sucursales de acceso</h4>
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

          <section className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Permisos del usuario</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Seleccionados: {userForm.permissionIds.length} de {permissions.data?.length ?? 0}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={applyRolePermissions}>
                  <ShieldCheck className="h-4 w-4" />
                  Segun perfil
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={setAllPermissions}>
                  <CheckSquare className="h-4 w-4" />
                  Marcar todos
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={clearPermissions}>
                  <Eraser className="h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </div>

            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar permiso por modulo, nombre o codigo"
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
              />
            </label>

            <div className="mt-3 max-h-[360px] space-y-3 overflow-auto pr-1">
              {groupedPermissions.length ? (
                groupedPermissions.map((group) => (
                  <div key={group.module} className="rounded-md border border-slate-100">
                    <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {moduleLabels[group.module] ?? group.module}
                      </p>
                      <span className="text-xs text-slate-400">
                        {
                          group.permissions.filter((permission) => selectedPermissions.has(permission.id))
                            .length
                        }
                        /{group.permissions.length}
                      </span>
                    </div>
                    <div className="grid gap-1 p-2 md:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex min-h-10 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 transition hover:bg-sky-50"
                        >
                          <input
                            className="mt-1"
                            type="checkbox"
                            checked={selectedPermissions.has(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium leading-5 text-slate-800">
                              {permissionDisplayName(permission)}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {permissionHelpText(permission)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                  No hay permisos para la busqueda actual.
                </p>
              )}
            </div>
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
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-sky-50 hover:text-[#0679c8] disabled:cursor-not-allowed disabled:opacity-40"
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
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-sky-50 hover:text-[#0679c8]"
    >
      {children}
    </Link>
  );
}

function BranchSummary({ branches }: { branches: UserListItem["branches"] }) {
  if (!branches.length) return <span className="text-slate-400">-</span>;

  const primary = branches.find((branch) => branch.isPrimary);
  const visible = [
    ...(primary ? [primary] : []),
    ...branches.filter((branch) => branch.id !== primary?.id)
  ].slice(0, 2);
  const remaining = branches.length - visible.length;
  const title = branches.map((branch) => branch.name).join(", ");

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" title={title}>
      {visible.map((branch) => (
        <span
          key={branch.id}
          className={
            branch.isPrimary
              ? "max-w-[180px] truncate rounded bg-sky-50 px-2 py-1 text-xs font-medium text-[#0679c8]"
              : "max-w-[150px] truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
          }
        >
          {branch.name}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">+{remaining}</span>
      ) : null}
    </div>
  );
}

function groupPermissions(permissions: PermissionListItem[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? permissions.filter((permission) =>
        [
          permission.key,
          permission.name,
          permissionDisplayName(permission),
          permissionHelpText(permission),
          moduleLabels[permission.module] ?? permission.module,
          permission.description ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : permissions;

  const groups = new Map<string, PermissionListItem[]>();
  for (const permission of filtered) {
    const entries = groups.get(permission.module) ?? [];
    entries.push(permission);
    groups.set(permission.module, entries);
  }

  return [...groups.entries()]
    .sort(([firstModule], [secondModule]) => firstModule.localeCompare(secondModule))
    .map(([module, group]) => ({
      module,
      permissions: group.sort((first, second) => first.key.localeCompare(second.key))
    }));
}

function permissionDisplayName(permission: PermissionListItem) {
  const translated = permissionLabels[permission.key] ?? permissionLabels[permission.code ?? ""];
  if (translated) return translated;

  const moduleName = (moduleLabels[permission.module] ?? permission.module).toLowerCase();
  let fallback = permission.name
    .replace(/^Read /, "Ver ")
    .replace(/^Create /, "Crear ")
    .replace(/^Update /, "Actualizar ")
    .replace(/^Deactivate /, "Desactivar ")
    .replace(/^Manage /, "Gestionar ")
    .replace(/^Print /, "Imprimir ")
    .replace(/^Export /, "Exportar ");

  fallback = fallback.replace(permission.module, moduleName);
  if (permission.resource) fallback = fallback.replace(permission.resource, moduleName);
  return fallback;
}

function permissionHelpText(permission: PermissionListItem) {
  const moduleName = moduleLabels[permission.module] ?? permission.module;
  return `Modulo: ${moduleName}`;
}
