import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FilePenLine,
  Mail,
  ShieldCheck,
  Stethoscope,
  UserPen,
  UserRoundCheck,
  UserRoundPlus,
  UserRoundX
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { uploadUserBinaryFile } from "@/features/documents/services/documents.service";
import {
  useCreateProfessional,
  useProfessionals,
  useUpdateProfessional
} from "@/features/settings/professionals/hooks/use-professionals";
import { useSpecialties } from "@/features/settings/specialties/hooks/use-specialties";
import { useRolesQuery } from "@/features/settings/roles/hooks/use-roles";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import { useUpdateProfessionalAgendaConfig } from "@/features/settings/schedules/hooks/use-schedules";
import {
  createSchedule as createProfessionalSchedule,
  listSchedules,
  updateSchedule as updateProfessionalSchedule,
  type SchedulePayload
} from "@/features/settings/schedules/services/schedules.service";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { usePermissions } from "@/hooks/use-permissions";
import { UsersModuleNav } from "../components/users-module-nav";
import { useCreateUser, useDeactivateUser, useReactivateUser, useUpdateUser, useUsersQuery } from "../hooks/use-users";
import type { UserListItem } from "../services/users.service";
import {
  validateCollaboratorForm,
  type CollaboratorFormErrorKey
} from "../utils/collaborator-form-validation";

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

type UserKind = "STAFF" | "CEYE" | "PROFESSIONAL" | "ADMIN";

type CollaboratorProfessionalForm = {
  enabled: boolean;
  branchId: string;
  licenseNumber: string;
  specialtyIds: string[];
  color: string;
  commissionRate: string;
  agendaSlotMinutes: string;
  defaultAppointmentDurationMinutes: string;
  chairId: string;
  applyWeeklySchedule: boolean;
  workDays: number[];
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
};

type PersonnelDocumentCategory = "INE" | "TITLE" | "LICENSE" | "CONTRACT" | "CERTIFICATION";

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

const emptyProfessionalForm: CollaboratorProfessionalForm = {
  enabled: false,
  branchId: "",
  licenseNumber: "",
  specialtyIds: [],
  color: "#111827",
  commissionRate: "0",
  agendaSlotMinutes: "20",
  defaultAppointmentDurationMinutes: "40",
  chairId: "",
  applyWeeklySchedule: false,
  workDays: [1, 2, 3, 4, 5],
  startTime: "10:00",
  endTime: "19:00",
  breakStartTime: "14:00",
  breakEndTime: "15:00"
};

const documentOptions: { category: PersonnelDocumentCategory; label: string }[] = [
  { category: "INE", label: "Identificacion oficial" },
  { category: "TITLE", label: "Titulo profesional" },
  { category: "LICENSE", label: "Cedula profesional" },
  { category: "CONTRACT", label: "Contrato" },
  { category: "CERTIFICATION", label: "Certificacion" }
];

const dayOptions = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" }
];

const userKindOptions: { value: UserKind; label: string; rolePattern: RegExp }[] = [
  { value: "STAFF", label: "Staff", rolePattern: /staff|recepci|asistente|auxiliar/i },
  { value: "CEYE", label: "CEYE", rolePattern: /ceye|esteril/i },
  { value: "PROFESSIONAL", label: "Profesional", rolePattern: /profesional|doctor|dentista|odont/i },
  { value: "ADMIN", label: "Administracion", rolePattern: /admin|administrador|system/i }
];

const statusLabels: Record<string, string> = {
  ACTIVE: "Habilitado",
  INACTIVE: "Deshabilitado",
  LOCKED: "Bloqueado",
  PENDING: "Pendiente"
};

function userDisplayName(user: UserListItem) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function getInitials(user: UserListItem) {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
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

function defaultProfessionalBranchIdFromUser(user: UserListItem, preferredBranchId?: string | null) {
  return (
    user.branches.find((branch) => branch.id === preferredBranchId)?.id ??
    user.branches.find((branch) => branch.isPrimary)?.id ??
    user.branches[0]?.id ??
    ""
  );
}

function inferUserKind(roleName?: string | null): UserKind {
  const match = userKindOptions.find((option) => option.rolePattern.test(roleName ?? ""));
  return match?.value ?? "STAFF";
}

function professionalFormFromUser(user: UserListItem): CollaboratorProfessionalForm {
  return {
    ...emptyProfessionalForm,
    enabled: Boolean(user.professional),
    commissionRate: String(user.professional?.commissionRate ?? "0")
  };
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function textOrUndefined(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function errorMessageFromUnknown(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function UsersPage() {
  const actorId = useAuthStore((state) => state.user?.id);
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [userKind, setUserKind] = useState<UserKind>("STAFF");
  const [professionalForm, setProfessionalForm] = useState<CollaboratorProfessionalForm>(emptyProfessionalForm);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<PersonnelDocumentCategory, File>>>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<CollaboratorFormErrorKey, string>>>({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalWarning, setModalWarning] = useState<string | null>(null);
  const [partialUser, setPartialUser] = useState<UserListItem | null>(null);
  const [contractUser, setContractUser] = useState<UserListItem | null>(null);
  const [commissionRate, setCommissionRate] = useState("");

  const routeStatus = searchParams.get("status") ?? "";
  const status = supportedStatuses.has(routeStatus) ? routeStatus : "";
  const users = useUsersQuery(search || undefined, status || undefined, activeBranchId || undefined);
  const roles = useRolesQuery(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");
  const specialties = useSpecialties(undefined, "true");
  const professionals = useProfessionals(undefined, undefined, { branchId: activeBranchId || undefined, pageSize: 100 });
  const chairs = useChairs(undefined, "true", professionalForm.branchId || userForm.primaryBranchId || undefined);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();
  const createProfessional = useCreateProfessional();
  const updateProfessional = useUpdateProfessional();
  const updateAgendaConfig = useUpdateProfessionalAgendaConfig();
  const canManageAll = can("system.manage_all");
  const canCreateUser = canManageAll || can("users.create");
  const canUpdateUser = canManageAll || can("users.update");
  const canDeactivateUser = canManageAll || can("users.deactivate");
  const canCreateProfessional = canManageAll || can("professionals.create");
  const canUpdateProfessional = canManageAll || can("professionals.update");

  const userMutationPending =
    createUser.isPending ||
    updateUser.isPending ||
    deactivateUser.isPending ||
    reactivateUser.isPending ||
    createProfessional.isPending ||
    updateProfessional.isPending ||
    updateAgendaConfig.isPending;
  const contractRate = Number(commissionRate);
  const contractRateValid = Number.isFinite(contractRate) && contractRate >= 0 && contractRate <= 100;
  const professionalsByUserId = useMemo(
    () => new Map((professionals.data ?? []).filter((professional) => professional.user?.id).map((professional) => [professional.user?.id, professional])),
    [professionals.data]
  );
  const currentProfessional = editing
    ? professionalsByUserId.get(editing.id) ?? (editing.professional ? professionals.data?.find((professional) => professional.id === editing.professional?.id) : undefined)
    : undefined;
  const professionalEnabled = userKind === "PROFESSIONAL" || professionalForm.enabled;
  const clinicalBranchChairs = chairs.data ?? [];
  const selectedRole = roles.data?.find((role) => role.id === userForm.roleId);
  const selectedPrimaryBranch = branches.data?.find((branch) => branch.id === userForm.primaryBranchId);
  const selectedClinicalBranch = branches.data?.find((branch) => branch.id === professionalForm.branchId);
  const liveValidation = useMemo(
    () =>
      validateCollaboratorForm({
        editing: Boolean(editing || partialUser),
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        email: userForm.email,
        password: userForm.password,
        roleId: userForm.roleId,
        branchIds: userForm.branchIds,
        primaryBranchId: userForm.primaryBranchId,
        professionalEnabled,
        professionalBranchId: professionalForm.branchId,
        specialtyIds: professionalForm.specialtyIds,
        commissionRate: professionalForm.commissionRate,
        applyWeeklySchedule: professionalForm.applyWeeklySchedule,
        workDays: professionalForm.workDays,
        startTime: professionalForm.startTime,
        endTime: professionalForm.endTime,
        breakStartTime: professionalForm.breakStartTime,
        breakEndTime: professionalForm.breakEndTime
      }),
    [editing, partialUser, professionalEnabled, professionalForm, userForm]
  );
  const submitDisabledReason = userMutationPending
    ? "Guardando cambios..."
    : liveValidation.firstMessage;
  const canSubmitUserForm = !submitDisabledReason;
  const fieldErrors: Partial<Record<CollaboratorFormErrorKey, string | undefined>> = {
    ...(showValidationErrors ? liveValidation.errors : formErrors),
    ...(userForm.email.trim() ? { email: liveValidation.errors.email } : {}),
    ...(userForm.password.trim() ? { password: liveValidation.errors.password } : {}),
    ...(professionalForm.commissionRate.trim() ? { commissionRate: liveValidation.errors.commissionRate } : {})
  };
  const validationSummary = showValidationErrors && !liveValidation.valid ? liveValidation.firstMessage : null;

  const changeStatus = (nextStatus: string) => {
    setSearchParams(nextStatus ? { status: nextStatus } : {});
  };

  useEffect(() => {
    if (userFormOpen || searchParams.get("newCollaborator") !== "professional") return;

    const branchIds = (searchParams.get("branchIds") ?? "")
      .split(",")
      .map((branchId) => branchId.trim())
      .filter(Boolean);

    setEditing(null);
    setUserKind("PROFESSIONAL");
    const initialBranchIds = branchIds.length ? branchIds : activeBranchId ? [activeBranchId] : [];
    setUserForm({
      ...emptyUserForm,
      branchIds: initialBranchIds,
      primaryBranchId: initialBranchIds[0] ?? ""
    });
    setProfessionalForm({
      ...emptyProfessionalForm,
      enabled: true,
      branchId: initialBranchIds[0] ?? "",
      applyWeeklySchedule: true
    });
    setDocumentFiles({});
    setFormErrors({});
    setShowValidationErrors(false);
    setModalError(null);
    setModalWarning(null);
    setPartialUser(null);
    setUserFormOpen(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("newCollaborator");
        next.delete("branchIds");
        return next;
      },
      { replace: true }
    );
  }, [activeBranchId, searchParams, setSearchParams, userFormOpen]);

  const openCreate = () => {
    const initialBranchIds = activeBranchId ? [activeBranchId] : [];
    setEditing(null);
    setUserForm({ ...emptyUserForm, branchIds: initialBranchIds, primaryBranchId: initialBranchIds[0] ?? "" });
    setProfessionalForm({ ...emptyProfessionalForm, branchId: initialBranchIds[0] ?? "" });
    setDocumentFiles({});
    setFormErrors({});
    setShowValidationErrors(false);
    setModalError(null);
    setModalWarning(null);
    setPartialUser(null);
    setUserKind("STAFF");
    setUserFormOpen(true);
  };

  const openEdit = (user: UserListItem) => {
    const professional = professionalsByUserId.get(user.id);
    setEditing(user);
    setUserForm(formFromUser(user));
    setProfessionalForm({
      ...professionalFormFromUser(user),
      enabled: Boolean(user.professional || professional),
      licenseNumber: professional?.licenseNumber ?? "",
      specialtyIds: professional?.specialties.map((specialty) => specialty.id) ?? [],
      color: professional?.color ?? "#111827",
      commissionRate: String(professional?.commissionRate ?? user.professional?.commissionRate ?? "0"),
      agendaSlotMinutes: String(professional?.branches[0]?.agendaSlotMinutes ?? "20"),
      defaultAppointmentDurationMinutes: String(professional?.branches[0]?.defaultAppointmentDurationMinutes ?? "40"),
      branchId: professional?.branches[0]?.id ?? defaultProfessionalBranchIdFromUser(user, activeBranchId)
    });
    setDocumentFiles({});
    setFormErrors({});
    setShowValidationErrors(false);
    setModalError(null);
    setModalWarning(null);
    setPartialUser(null);
    setUserKind(inferUserKind(user.role?.name));
    setUserFormOpen(true);
  };

  const closeUserForm = () => {
    setEditing(null);
    setUserForm(emptyUserForm);
    setProfessionalForm(emptyProfessionalForm);
    setDocumentFiles({});
    setFormErrors({});
    setShowValidationErrors(false);
    setModalError(null);
    setModalWarning(null);
    setPartialUser(null);
    setUserKind("STAFF");
    setUserFormOpen(false);
  };

  const toggleBranch = (branchId: string) => {
    setUserForm((current) => {
      const branchIds = current.branchIds.includes(branchId)
        ? current.branchIds.filter((selectedBranchId) => selectedBranchId !== branchId)
        : [...current.branchIds, branchId];
      const primaryBranchId = branchIds.includes(current.primaryBranchId)
        ? current.primaryBranchId
        : (branchIds[0] ?? "");

      setProfessionalForm((professional) => ({
        ...professional,
        branchId: branchIds.includes(professional.branchId) ? professional.branchId : primaryBranchId,
        chairId: branchIds.includes(professional.branchId) ? professional.chairId : ""
      }));

      return {
        ...current,
        branchIds,
        primaryBranchId
      };
    });
  };

  const setRole = (roleId: string) => {
    setUserForm((current) => ({ ...current, roleId }));
  };

  const applyUserKind = (kind: UserKind) => {
    setUserKind(kind);
    setProfessionalForm((current) => ({
      ...current,
      enabled: kind === "PROFESSIONAL" || Boolean(editing?.professional),
      branchId: current.branchId || userForm.primaryBranchId || userForm.branchIds[0] || ""
    }));
    const option = userKindOptions.find((item) => item.value === kind);
    const matchedRole = roles.data?.find((role) => option?.rolePattern.test(`${role.name} ${role.code ?? ""}`));
    if (matchedRole) setRole(matchedRole.id);
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setModalError(null);
    setModalWarning(null);
    setShowValidationErrors(true);
    setFormErrors(liveValidation.errors);

    if (!liveValidation.valid) {
      return;
    }

    try {
      let savedUser: UserListItem;
      const updatePayload = {
        branchIds: userForm.branchIds,
        firstName: userForm.firstName.trim(),
        lastName: userForm.lastName.trim(),
        password: userForm.password.trim() || undefined,
        phone: userForm.phone.trim() || undefined,
        primaryBranchId: userForm.primaryBranchId,
        roleId: userForm.roleId
      };

      if (editing) {
        savedUser = await updateUser.mutateAsync({
          id: editing.id,
          payload: updatePayload
        });
      } else if (partialUser) {
        savedUser = await updateUser.mutateAsync({
          id: partialUser.id,
          payload: updatePayload
        });
      } else {
        savedUser = await createUser.mutateAsync({
          ...updatePayload,
          email: userForm.email.trim(),
          password: userForm.password.trim()
        });
      }

      if (professionalEnabled) {
        try {
          await saveProfessionalProfile(savedUser);
          setPartialUser(null);
        } catch (error) {
          const apiMessage = errorMessageFromUnknown(error, "No se pudo completar el perfil clinico.");
          const message = "El usuario fue creado, pero falta completar su perfil clinico.";
          setPartialUser(savedUser);
          setModalError(`${message} ${apiMessage}`);
          void users.refetch();
          void professionals.refetch();
          toast.error(message);
          return;
        }
      }

      closeUserForm();
      toast.success(editing ? "Colaborador actualizado." : "Colaborador creado.");
    } catch (error) {
      const message = errorMessageFromUnknown(error, "No se pudo guardar el colaborador.");
      setModalError(message);
      toast.error(message);
    }
  };

  const saveProfessionalProfile = async (savedUser: UserListItem) => {
    const existingProfessional = professionalsByUserId.get(savedUser.id) ?? currentProfessional;
    const professionalBranchId = professionalForm.branchId || userForm.primaryBranchId;
    const professionalPayload = {
      userId: savedUser.id,
      firstName: userForm.firstName.trim(),
      lastName: userForm.lastName.trim(),
      licenseNumber: textOrUndefined(professionalForm.licenseNumber),
      phone: textOrUndefined(userForm.phone),
      email: savedUser.email,
      color: professionalForm.color,
      commissionRate: numberOrUndefined(professionalForm.commissionRate),
      specialtyIds: professionalForm.specialtyIds,
      branchIds: [professionalBranchId]
    };

    const professional = existingProfessional
      ? await updateProfessional.mutateAsync({ id: existingProfessional.id, payload: professionalPayload })
      : await createProfessional.mutateAsync(professionalPayload);

    const agendaSlotMinutes = numberOrUndefined(professionalForm.agendaSlotMinutes);
    const defaultAppointmentDurationMinutes = numberOrUndefined(professionalForm.defaultAppointmentDurationMinutes);
    if (professionalBranchId && (agendaSlotMinutes || defaultAppointmentDurationMinutes)) {
      await updateAgendaConfig.mutateAsync({
        professionalId: professional.id,
        branchId: professionalBranchId,
        payload: {
          agendaSlotMinutes,
          defaultAppointmentDurationMinutes
        }
      });
    }

    if (professionalForm.applyWeeklySchedule && professionalBranchId) {
      await saveWeeklySchedule(professional.id, professionalBranchId);
    }

    try {
      await uploadPersonnelDocuments(savedUser.id, professional.id);
    } catch (error) {
      const message = errorMessageFromUnknown(error, "No se pudieron subir todos los documentos del colaborador.");
      setModalWarning(message);
      toast.warning(message);
    }
  };

  const saveWeeklySchedule = async (professionalId: string, branchId: string) => {
    const existingSchedules = await listSchedules({ professionalId, branchId });
    const schedulesByDay = new Map(existingSchedules.map((schedule) => [schedule.dayOfWeek, schedule]));

    for (const dayOfWeek of professionalForm.workDays) {
      const payload: SchedulePayload = {
        professionalId,
        branchId,
        chairId: professionalForm.chairId || null,
        dayOfWeek,
        startTime: professionalForm.startTime,
        endTime: professionalForm.endTime,
        breakStartTime: textOrUndefined(professionalForm.breakStartTime) ?? null,
        breakEndTime: textOrUndefined(professionalForm.breakEndTime) ?? null
      };
      const current = schedulesByDay.get(dayOfWeek);
      if (current) {
        await updateProfessionalSchedule(current.id, { ...payload, isActive: true });
      } else {
        await createProfessionalSchedule({
          ...payload,
          chairId: professionalForm.chairId || undefined,
          breakStartTime: textOrUndefined(professionalForm.breakStartTime),
          breakEndTime: textOrUndefined(professionalForm.breakEndTime)
        });
      }
    }
  };

  const uploadPersonnelDocuments = async (userId: string, professionalId?: string) => {
    for (const option of documentOptions) {
      const file = documentFiles[option.category];
      if (!file) continue;
      await uploadUserBinaryFile(userId, {
        file,
        category: option.category,
        professionalId
      });
    }
  };

  const setUserEnabled = async (user: UserListItem) => {
    if (user.status === "ACTIVE") {
      await deactivateUser.mutateAsync(user.id);
      return;
    }

    await reactivateUser.mutateAsync(user.id);
  };

  const canToggleUserStatus = (user: UserListItem) => (user.status === "ACTIVE" ? canDeactivateUser : canUpdateUser);

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
      <UsersModuleNav>
        <div className="space-y-4">
          <PageHeader title="Personal y usuarios" description="Alta, acceso, rol y expediente operativo del colaborador." />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between pb-2">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center max-w-3xl">
              <div className="w-full sm:max-w-md">
                <EntitySearchBox
                  placeholder="Buscar por nombre o correo"
                  value={search}
                  onValueChange={setSearch}
                  items={search.trim() ? users.data ?? [] : []}
                  onSelect={(user) => {
                    setSearch(userDisplayName(user));
                    openEdit(user);
                  }}
                  getItemKey={(user) => user.id}
                  emptyMessage="Sin usuarios encontrados"
                  renderItem={(user) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{userDisplayName(user)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                  )}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <Select value={status} onChange={(event) => changeStatus(event.target.value)} className="w-full">
                  <option value="">Todos los estados</option>
                  <option value="ACTIVE">Habilitados</option>
                  <option value="INACTIVE">Deshabilitados</option>
                  <option value="LOCKED">Bloqueados</option>
                  <option value="PENDING">Pendientes</option>
                </Select>
              </div>
            </div>
            {canCreateUser ? (
              <Button onClick={openCreate} className="w-full sm:w-auto shrink-0">
                <UserRoundPlus className="mr-1.5 h-4 w-4" />
                Nuevo colaborador
              </Button>
            ) : null}
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
              tableClassName="w-full table-fixed"
              stickyFirstColumn={true}
              stickyLastColumn={true}
              responsiveCards={true}
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
                  headerClassName: "w-[240px]",
                  cellClassName: "min-w-0",
                  render: (row) => (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-brand-light)] text-xs font-semibold text-[var(--text-brand-strong)] uppercase">
                        {getInitials(row)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 capitalize truncate" title={userDisplayName(row)}>
                          {userDisplayName(row)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate" title={row.role?.name ?? "Sin perfil"}>
                          {row.role?.name ?? "Sin perfil"}
                        </p>
                      </div>
                    </div>
                  )
                },
                {
                  key: "email",
                  title: "Contacto",
                  wrap: true,
                  headerClassName: "w-auto",
                  cellClassName: "min-w-0",
                  render: (row) => (
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-xs font-medium text-slate-700" title={row.email}>
                        {row.email}
                      </p>
                      <p className="text-[11px] text-slate-400">{row.phone || "Sin teléfono"}</p>
                    </div>
                  )
                },
                {
                  key: "branches",
                  title: "Sucursales",
                  wrap: true,
                  headerClassName: "w-[220px]",
                  cellClassName: "min-w-0",
                  render: (row) => <BranchSummary branches={row.branches} />
                },
                {
                  key: "status",
                  title: "Estado",
                  headerClassName: "w-[120px]",
                  render: (row) => (
                    <Badge
                      value={statusLabels[row.status] ?? row.status}
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
                  headerClassName: "w-[184px] text-right",
                  cellClassName: "w-[184px]",
                  render: (row) => (
                    <div className="flex min-w-[140px] flex-nowrap justify-end gap-1.5">
                      {row.professional?.isActive ? (
                        <>
                          {canUpdateProfessional ? (
                            <>
                              <ActionLink
                                title="Editar horarios"
                                to={`/settings/online-scheduling/schedules?professionalId=${row.professional.id}${row.branches.length === 1 ? `&branchId=${row.branches[0].id}` : ""}`}
                              >
                                <CalendarClock className="h-4 w-4" />
                              </ActionLink>
                              <ActionButton title="Editar contrato" onClick={() => openContract(row)}>
                                <FilePenLine className="h-4 w-4" />
                              </ActionButton>
                            </>
                          ) : null}
                        </>
                      ) : null}

                      {!row.professional && row.status === "ACTIVE" && canCreateProfessional ? (
                        <ActionLink
                          title="Crear perfil profesional"
                          to={`/settings/professionals?userId=${row.id}${defaultProfessionalBranchIdFromUser(row, activeBranchId) ? `&branchIds=${defaultProfessionalBranchIdFromUser(row, activeBranchId)}` : ""}`}
                        >
                          <Stethoscope className="h-4 w-4" />
                        </ActionLink>
                      ) : null}

                      {canUpdateUser ? (
                        <ActionButton title="Editar colaborador" onClick={() => openEdit(row)}>
                          <UserPen className="h-4 w-4" />
                        </ActionButton>
                      ) : null}

                      {canToggleUserStatus(row) ? (
                        <ActionButton
                          title={row.status === "ACTIVE" ? "Deshabilitar usuario" : "Habilitar usuario"}
                          disabled={userMutationPending || row.id === actorId}
                          onClick={() => void setUserEnabled(row)}
                        >
                          {row.status === "ACTIVE" ? (
                            <UserRoundX className="h-4 w-4" />
                          ) : (
                            <UserRoundCheck className="h-4 w-4" />
                          )}
                        </ActionButton>
                      ) : null}
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
        title={editing ? "Editar colaborador" : "Nuevo colaborador"}
        size="2xl"
        onClose={closeUserForm}
      >
        <form className="space-y-5" onSubmit={submitUser}>
          {roles.isLoading || branches.isLoading ? (
            <LoadingState message="Cargando perfiles y sucursales..." />
          ) : null}

          {validationSummary ? <FormNotice tone="warning" message={validationSummary} /> : null}
          {modalError ? <FormNotice tone="danger" message={modalError} /> : null}
          {modalWarning ? <FormNotice tone="warning" message={modalWarning} /> : null}

          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem
              icon={<Mail className="h-4 w-4" />}
              label="Acceso"
              value={userForm.email || (editing ? editing.email : "Correo requerido")}
            />
            <SummaryItem
              icon={<Building2 className="h-4 w-4" />}
              label="Sucursal principal"
              value={selectedPrimaryBranch?.name ?? "Pendiente"}
            />
            <SummaryItem
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Rol"
              value={selectedRole?.name ?? "Pendiente"}
            />
            <SummaryItem
              icon={professionalEnabled ? <CheckCircle2 className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
              label="Perfil clinico"
              value={professionalEnabled ? selectedClinicalBranch?.name ?? "Sucursal pendiente" : "Sin agenda clinica"}
            />
          </div>

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
              <FieldError message={fieldErrors.firstName} />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Apellido
              <Input
                required
                value={userForm.lastName}
                onChange={(event) => setUserForm((current) => ({ ...current, lastName: event.target.value }))}
              />
              <FieldError message={fieldErrors.lastName} />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Correo
              <Input
                required={!editing && !partialUser}
                disabled={Boolean(editing || partialUser)}
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
              />
              <FieldError message={fieldErrors.email} />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Telefono
              <Input
                value={userForm.phone}
                onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              {editing || partialUser ? "Nueva contrasena opcional" : "Contrasena"}
              <Input
                required={!editing && !partialUser}
                minLength={8}
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
              />
              <FieldError message={fieldErrors.password} />
            </label>
            <div className="grid gap-1 text-sm text-slate-700">
              Tipo de usuario
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1">
                {userKindOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => applyUserKind(option.value)}
                    className={cn(
                      "h-9 rounded-md px-2 text-xs font-semibold transition-colors",
                      userKind === option.value
                        ? "bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-sm text-slate-700">
              Rol / perfil
              <Select
                required
                value={userForm.roleId}
                onChange={(event) => {
                  const roleId = event.target.value;
                  const nextKind = inferUserKind(roles.data?.find((role) => role.id === roleId)?.name);
                  setRole(roleId);
                  setUserKind(nextKind);
                  if (nextKind === "PROFESSIONAL") {
                    setProfessionalForm((current) => ({
                      ...current,
                      enabled: true,
                      branchId: current.branchId || userForm.primaryBranchId || userForm.branchIds[0] || ""
                    }));
                  }
                }}
              >
                <option value="">Selecciona perfil</option>
                {(roles.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
              <span className="text-xs leading-relaxed text-slate-500">
                Los permisos se administran desde Perfiles; este usuario hereda todo desde el rol seleccionado.
              </span>
              <FieldError message={fieldErrors.roleId} />
            </label>
          </div>

          <section className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Acceso del usuario</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Puede entrar a varias sucursales; la sucursal clinica del profesional se define aparte.
                </p>
              </div>
              <Badge value={`${userForm.branchIds.length} seleccionada${userForm.branchIds.length === 1 ? "" : "s"}`} tone="default" />
            </div>
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
            <FieldError message={fieldErrors.branchIds} />
            <label className="mt-3 grid gap-1 text-sm text-slate-700">
              Sucursal principal
              <Select
                required
                value={userForm.primaryBranchId}
                onChange={(event) => {
                  const branchId = event.target.value;
                  setUserForm((current) => ({ ...current, primaryBranchId: branchId }));
                  setProfessionalForm((current) => ({
                    ...current,
                    branchId: current.branchId || branchId
                  }));
                }}
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
              <FieldError message={fieldErrors.primaryBranchId} />
            </label>
          </section>

          <section className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Perfil profesional y agenda</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Activalo para doctores, ortodoncistas, integralistas o profesionales que aparecen en agenda.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={professionalEnabled}
                  onChange={(event) =>
                    setProfessionalForm((current) => ({
                      ...current,
                      enabled: event.target.checked,
                      branchId: event.target.checked
                        ? current.branchId || userForm.primaryBranchId || userForm.branchIds[0] || ""
                        : current.branchId
                    }))
                  }
                />
                Crear perfil clinico
              </label>
            </div>

            {professionalEnabled ? (
              <div className="mt-3 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="grid gap-1 text-sm text-slate-700">
                    Sucursal clinica / agenda
                    <Select
                      value={professionalForm.branchId}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({
                          ...current,
                          branchId: event.target.value,
                          chairId: ""
                        }))
                      }
                    >
                      <option value="">Selecciona sucursal clinica</option>
                      {(branches.data ?? [])
                        .filter((branch) => userForm.branchIds.includes(branch.id))
                        .map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                    </Select>
                    <span className="text-xs leading-relaxed text-slate-500">
                      Regla operativa: un profesional solo queda activo en una sucursal clinica.
                    </span>
                    <FieldError message={fieldErrors.professionalBranchId} />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-700">
                    Cedula
                    <Input
                      value={professionalForm.licenseNumber}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({ ...current, licenseNumber: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-700">
                    Color en agenda
                    <Input
                      className="h-10 p-1"
                      type="color"
                      value={professionalForm.color}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({ ...current, color: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-700">
                    Comision (%)
                    <Input
                      min={0}
                      max={100}
                      step="0.01"
                      type="number"
                      value={professionalForm.commissionRate}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({ ...current, commissionRate: event.target.value }))
                      }
                    />
                    <FieldError message={fieldErrors.commissionRate} />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-700">
                    Intervalo agenda
                    <Select
                      value={professionalForm.agendaSlotMinutes}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({ ...current, agendaSlotMinutes: event.target.value }))
                      }
                    >
                      <option value="10">10 minutos</option>
                      <option value="15">15 minutos</option>
                      <option value="20">20 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="45">45 minutos</option>
                      <option value="60">60 minutos</option>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm text-slate-700">
                    Duracion por defecto
                    <Select
                      value={professionalForm.defaultAppointmentDurationMinutes}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({
                          ...current,
                          defaultAppointmentDurationMinutes: event.target.value
                        }))
                      }
                    >
                      <option value="20">20 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="40">40 minutos</option>
                      <option value="60">60 minutos</option>
                      <option value="90">90 minutos</option>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm text-slate-700">
                    Box / sillon
                    <Select
                      value={professionalForm.chairId}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({ ...current, chairId: event.target.value }))
                      }
                    >
                      <option value="">Sin box fijo</option>
                      {clinicalBranchChairs.map((chair) => (
                        <option key={chair.id} value={chair.id}>
                          {chair.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                <div className="rounded-md border border-slate-100 p-3">
                  <h5 className="text-xs font-semibold uppercase text-slate-500">Especialidades</h5>
                  <div className="mt-2 grid max-h-28 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                    {(specialties.data ?? []).map((specialty) => (
                      <label key={specialty.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={professionalForm.specialtyIds.includes(specialty.id)}
                          onChange={() =>
                            setProfessionalForm((current) => ({
                              ...current,
                              specialtyIds: toggleValue(current.specialtyIds, specialty.id)
                            }))
                          }
                        />
                        <span>{specialty.name}</span>
                      </label>
                    ))}
                  </div>
                  {!professionalForm.specialtyIds.length ? (
                    <p className="mt-2 text-xs text-amber-700">Selecciona al menos una especialidad.</p>
                  ) : null}
                  <FieldError message={fieldErrors.specialtyIds} />
                </div>

                <div className="rounded-md border border-slate-100 p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={professionalForm.applyWeeklySchedule}
                      onChange={(event) =>
                        setProfessionalForm((current) => ({
                          ...current,
                          applyWeeklySchedule: event.target.checked
                        }))
                      }
                    />
                    Configurar horario base al guardar
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-1 text-sm text-slate-700">
                      Entrada
                      <Input
                        type="time"
                        value={professionalForm.startTime}
                        disabled={!professionalForm.applyWeeklySchedule}
                        onChange={(event) =>
                          setProfessionalForm((current) => ({ ...current, startTime: event.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm text-slate-700">
                      Salida
                      <Input
                        type="time"
                        value={professionalForm.endTime}
                        disabled={!professionalForm.applyWeeklySchedule}
                        onChange={(event) =>
                          setProfessionalForm((current) => ({ ...current, endTime: event.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm text-slate-700">
                      Inicio descanso
                      <Input
                        type="time"
                        value={professionalForm.breakStartTime}
                        disabled={!professionalForm.applyWeeklySchedule}
                        onChange={(event) =>
                          setProfessionalForm((current) => ({ ...current, breakStartTime: event.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm text-slate-700">
                      Fin descanso
                      <Input
                        type="time"
                        value={professionalForm.breakEndTime}
                        disabled={!professionalForm.applyWeeklySchedule}
                        onChange={(event) =>
                          setProfessionalForm((current) => ({ ...current, breakEndTime: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dayOptions.map((day) => (
                      <label
                        key={day.value}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                      >
                        <input
                          type="checkbox"
                          disabled={!professionalForm.applyWeeklySchedule}
                          checked={professionalForm.workDays.includes(day.value)}
                          onChange={() =>
                            setProfessionalForm((current) => ({
                              ...current,
                              workDays: toggleValue(current.workDays, day.value)
                            }))
                          }
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                  <FieldError message={fieldErrors.workDays} />
                  <FieldError message={fieldErrors.schedule} />
                </div>

                <div className="rounded-md border border-slate-100 p-3">
                  <h5 className="text-xs font-semibold uppercase text-slate-500">Documentos del colaborador</h5>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {documentOptions.map((option) => (
                      <label key={option.category} className="grid gap-1 text-sm text-slate-700">
                        {option.label}
                        <Input
                          type="file"
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setDocumentFiles((current) => ({
                              ...current,
                              [option.category]: event.target.files?.[0]
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-xs text-slate-500">
              {submitDisabledReason && !userMutationPending ? (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {submitDisabledReason}
                </span>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeUserForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSubmitUserForm}>
                {userMutationPending
                  ? "Guardando..."
                  : partialUser && professionalEnabled
                    ? "Reintentar perfil clinico"
                    : editing
                      ? "Actualizar colaborador"
                      : "Crear colaborador"}
              </Button>
            </div>
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

function FormNotice({ message, tone }: { message: string; tone: "danger" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-[var(--text-brand)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase text-slate-500">{label}</span>
        <span className="block truncate text-sm font-semibold text-slate-900" title={value}>
          {value}
        </span>
      </span>
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
    <HelpTooltip content={title} position="top">
      <button
        type="button"
        aria-label={title}
        disabled={disabled}
        onClick={onClick}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-slate-500 shadow-sm transition-all duration-[var(--duration-fast)] hover:border-[var(--border-brand-subtle)] hover:bg-[var(--bg-brand-light)] hover:text-[var(--text-brand-strong)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </button>
    </HelpTooltip>
  );
}

function ActionLink({ children, title, to }: { children: ReactNode; title: string; to: string }) {
  return (
    <HelpTooltip content={title} position="top">
      <Link
        aria-label={title}
        to={to}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-slate-500 shadow-sm transition-all duration-[var(--duration-fast)] hover:border-[var(--border-brand-subtle)] hover:bg-[var(--bg-brand-light)] hover:text-[var(--text-brand-strong)]"
      >
        {children}
      </Link>
    </HelpTooltip>
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
          className={cn(
            "max-w-[150px] truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all duration-[var(--duration-fast)]",
            branch.isPrimary
              ? "bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
              : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
          )}
        >
          {branch.name}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">+{remaining}</span>
      ) : null}
    </div>
  );
}
