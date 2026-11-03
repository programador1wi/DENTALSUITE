import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ArrowRightLeft,
  FilePenLine,
  KeyRound,
  MoreVertical,
  Pencil,
  Search,
  Settings2,
  Stethoscope,
  UserPen,
  UserRoundCheck,
  UserRoundPlus,
  UserRoundX,
  X
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getPermissionMetadata } from "@dentalwarner/shared";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { APP_ROUTES } from "@/lib/routes";
import { useBranches, normalizeName } from "@/features/settings/branches/hooks/use-branches";
import { uploadUserBinaryFile } from "@/features/documents/services/documents.service";
import {
  useCreateProfessional,
  useDeactivateProfessional,
  useProfessionals,
  useUpdateProfessional
} from "@/features/settings/professionals/hooks/use-professionals";
import { getProfessionalDeactivationImpact } from "@/features/settings/professionals/services/professionals.service";
import { ProfessionalTransferModal } from "@/features/settings/professionals/components/professional-transfer-modal";
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
import { CollaboratorFormOverview } from "../components/collaborator-form-overview";
import { useDeactivateUser, useReactivateUser, useUpdateUser } from "../hooks/use-users";
import type { UserListItem } from "../services/users.service";
import { useCollaboratorsQuery, useCreateCollaborator, useCreateProfessionalAccess } from "../hooks/use-collaborators";
import type { CollaboratorDirectoryItem } from "../services/collaborators.service";
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

type ProfessionalAccessForm = {
  email: string;
  password: string;
  roleId: string;
  branchIds: string[];
  primaryBranchId: string;
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

const emptyProfessionalAccessForm: ProfessionalAccessForm = {
  email: "",
  password: "",
  roleId: "",
  branchIds: [],
  primaryBranchId: ""
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

function collaboratorDisplayName(collaborator: CollaboratorDirectoryItem) {
  return `${collaborator.firstName} ${collaborator.lastName}`.trim();
}

function collaboratorToUser(collaborator: CollaboratorDirectoryItem): UserListItem | null {
  if (!collaborator.userId || !collaborator.email || !collaborator.accessStatus) return null;
  return {
    id: collaborator.userId,
    email: collaborator.email,
    firstName: collaborator.firstName,
    lastName: collaborator.lastName,
    phone: collaborator.phone,
    isActive: collaborator.accessStatus === "ACTIVE",
    status: collaborator.accessStatus,
    role: collaborator.role,
    branches: collaborator.accessBranches,
    professional: collaborator.professionalId
      ? {
          id: collaborator.professionalId,
          commissionRate: collaborator.commissionRate ?? "0",
          isActive: collaborator.clinicalStatus === "ACTIVE"
        }
      : null
  };
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
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManageAll = can("organization.manage_all");
  const canReadUsers = canManageAll || can("users.read");
  const canReadProfessionals = canManageAll || can("professionals.read");
  const canReadRoles = canManageAll || can("roles.read");
  const canReadBranches = canManageAll || can("branches.read");
  const canReadSpecialties = canManageAll || can("specialties.read");
  const canReadChairs = canManageAll || can("chairs.read");
  const canCreateUser = canManageAll || can("users.create");
  const canUpdateUser = canManageAll || can("users.update");
  const canDeactivateUser = canManageAll || can("users.deactivate");
  const canCreateProfessional = canManageAll || can("professionals.create");
  const canUpdateProfessional = canManageAll || can("professionals.update");
  const canCreateCollaborator = canCreateUser && canReadRoles && canReadBranches;
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
  const [managedCollaborator, setManagedCollaborator] = useState<CollaboratorDirectoryItem | null>(null);
  const [accessProfessional, setAccessProfessional] = useState<CollaboratorDirectoryItem | null>(null);
  const [professionalAccessForm, setProfessionalAccessForm] = useState<ProfessionalAccessForm>(emptyProfessionalAccessForm);
  const [transferProfessionalId, setTransferProfessionalId] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState("");
  const [professionalAccessBranchSearch, setProfessionalAccessBranchSearch] = useState("");

  const routeStatus = searchParams.get("status") ?? "";
  const status = supportedStatuses.has(routeStatus) ? routeStatus : "";
  const directoryAccessStatus = routeStatus === "WITHOUT_ACCESS" ? "WITHOUT_ACCESS" : status;
  const routeKind = searchParams.get("kind") ?? "ALL";
  const kind = ["ALL", "ADMINISTRATIVE", "CLINICAL", "CLINICAL_WITHOUT_ACCESS"].includes(routeKind)
    ? routeKind as "ALL" | "ADMINISTRATIVE" | "CLINICAL" | "CLINICAL_WITHOUT_ACCESS"
    : "ALL";
  const clinicalStatus = searchParams.get("clinicalStatus") ?? "";
  const collaborators = useCollaboratorsQuery({
    search: search || undefined,
    branchId: activeBranchId || undefined,
    kind,
    accessStatus: directoryAccessStatus || undefined,
    clinicalStatus: clinicalStatus || undefined,
    pageSize: 100
  }, canReadUsers || canReadProfessionals);
  const roles = useRolesQuery(undefined, "true", canReadRoles);
  const branches = useBranches(undefined, "ACTIVE", canReadBranches);
  const specialties = useSpecialties(undefined, "true", canReadSpecialties);
  const professionals = useProfessionals(undefined, undefined, {
    branchId: activeBranchId || undefined,
    pageSize: 100,
    enabled: canReadProfessionals
  });
  const chairs = useChairs(
    undefined,
    "true",
    professionalForm.branchId || userForm.primaryBranchId || undefined,
    canReadChairs
  );
  const createCollaborator = useCreateCollaborator();
  const createProfessionalAccess = useCreateProfessionalAccess();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();
  const createProfessional = useCreateProfessional();
  const updateProfessional = useUpdateProfessional();
  const deactivateProfessional = useDeactivateProfessional();
  const updateAgendaConfig = useUpdateProfessionalAgendaConfig();
  const userMutationPending =
    createCollaborator.isPending ||
    createProfessionalAccess.isPending ||
    updateUser.isPending ||
    deactivateUser.isPending ||
    reactivateUser.isPending ||
    createProfessional.isPending ||
    updateProfessional.isPending ||
    deactivateProfessional.isPending ||
    updateAgendaConfig.isPending;
  const professionalsByUserId = useMemo(
    () => new Map((professionals.data ?? []).filter((professional) => professional.user?.id).map((professional) => [professional.user?.id, professional])),
    [professionals.data]
  );
  const currentProfessional = editing
    ? professionalsByUserId.get(editing.id) ?? (editing.professional ? professionals.data?.find((professional) => professional.id === editing.professional?.id) : undefined)
    : undefined;
  const transferProfessional = transferProfessionalId
    ? professionals.data?.find((professional) => professional.id === transferProfessionalId) ?? null
    : null;
  const professionalEnabled = userKind === "PROFESSIONAL" || professionalForm.enabled;
  const clinicalBranchChairs = chairs.data ?? [];
  const selectedRole = roles.data?.find((role) => role.id === userForm.roleId);
  const selectedRolePermissionSummary = useMemo(() => {
    if (!selectedRole) return null;
    const presented = selectedRole.permissions.map((permission) => ({
      ...getPermissionMetadata({
        key: permission.code ?? "",
        name: permission.name,
        description: permission.description,
        module: permission.module
      }),
      key: permission.code ?? ""
    }));
    return {
      basic: presented.filter((permission) => permission.presentationTier === "BASIC"),
      advanced: presented.filter((permission) => permission.presentationTier === "ADVANCED"),
      internal: presented.filter((permission) => permission.presentationTier === "INTERNAL")
    };
  }, [selectedRole]);
  const selectedPrimaryBranch = branches.data?.find((branch) => branch.id === userForm.primaryBranchId);
  const selectedClinicalBranch = branches.data?.find((branch) => branch.id === professionalForm.branchId);

  const filteredBranches = useMemo(() => {
    const list = branches.data ?? [];
    const term = normalizeName(branchSearch.trim());
    if (!term) return list;
    return list.filter((b) => {
      const name = normalizeName(b.name || "");
      const code = normalizeName(b.code || "");
      const zoneName = normalizeName(b.zone?.name || "");
      const zoneCode = normalizeName(b.zone?.code || "");
      return (
        name.includes(term) ||
        code.includes(term) ||
        zoneName.includes(term) ||
        zoneCode.includes(term)
      );
    });
  }, [branches.data, branchSearch]);

  const filteredProfessionalAccessBranches = useMemo(() => {
    const list = branches.data ?? [];
    const term = normalizeName(professionalAccessBranchSearch.trim());
    if (!term) return list;
    return list.filter((b) => {
      const name = normalizeName(b.name || "");
      const code = normalizeName(b.code || "");
      const zoneName = normalizeName(b.zone?.name || "");
      const zoneCode = normalizeName(b.zone?.code || "");
      return (
        name.includes(term) ||
        code.includes(term) ||
        zoneName.includes(term) ||
        zoneCode.includes(term)
      );
    });
  }, [branches.data, professionalAccessBranchSearch]);

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
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextStatus) next.set("status", nextStatus);
      else next.delete("status");
      return next;
    });
  };

  const changeDirectoryFilter = (key: "kind" | "clinicalStatus", value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value && value !== "ALL") next.set(key, value);
      else next.delete(key);
      return next;
    });
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
    setBranchSearch("");
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
    setBranchSearch("");
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
    setBranchSearch("");
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
      if (!editing && !partialUser) {
        const result = await createCollaborator.mutateAsync({
          kind: professionalEnabled ? "CLINICAL" : "ADMINISTRATIVE",
          branchIds: userForm.branchIds,
          email: userForm.email.trim(),
          firstName: userForm.firstName.trim(),
          lastName: userForm.lastName.trim(),
          password: userForm.password.trim(),
          phone: textOrUndefined(userForm.phone),
          primaryBranchId: userForm.primaryBranchId,
          roleId: userForm.roleId,
          clinicalProfile: professionalEnabled
            ? {
                branchId: professionalForm.branchId,
                chairId: textOrUndefined(professionalForm.chairId),
                licenseNumber: textOrUndefined(professionalForm.licenseNumber),
                color: professionalForm.color,
                commissionRate: numberOrUndefined(professionalForm.commissionRate),
                specialtyIds: professionalForm.specialtyIds,
                agendaSlotMinutes: numberOrUndefined(professionalForm.agendaSlotMinutes),
                defaultAppointmentDurationMinutes: numberOrUndefined(professionalForm.defaultAppointmentDurationMinutes),
                schedules: professionalForm.applyWeeklySchedule
                  ? professionalForm.workDays.map((dayOfWeek) => ({
                      dayOfWeek,
                      startTime: professionalForm.startTime,
                      endTime: professionalForm.endTime,
                      breakStartTime: dayOfWeek === 6 ? undefined : textOrUndefined(professionalForm.breakStartTime),
                      breakEndTime: dayOfWeek === 6 ? undefined : textOrUndefined(professionalForm.breakEndTime)
                    }))
                  : undefined
              }
            : undefined
        });
        try {
          await uploadPersonnelDocuments(result.userId, result.professionalId ?? undefined);
        } catch (error) {
          const message = errorMessageFromUnknown(error, "No se pudieron subir todos los documentos del colaborador.");
          toast.warning(message);
        }
        closeUserForm();
        toast.success("Colaborador creado.");
        return;
      }

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
        throw new Error("No existe un colaborador pendiente para actualizar.");
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
          void collaborators.refetch();
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

  const editManagedCollaborator = () => {
    if (!managedCollaborator) return;
    const user = collaboratorToUser(managedCollaborator);
    if (!user) return;
    setManagedCollaborator(null);
    openEdit(user);
  };

  const openProfessionalAccess = (collaborator: CollaboratorDirectoryItem) => {
    const branchId = collaborator.clinicalBranch?.id ?? activeBranchId ?? "";
    const professionalRole = roles.data?.find((role) => /profesional|doctor|dentista|odont/i.test(`${role.name} ${role.code ?? ""}`));
    setProfessionalAccessForm({
      ...emptyProfessionalAccessForm,
      email: collaborator.email ?? "",
      roleId: professionalRole?.id ?? "",
      branchIds: branchId ? [branchId] : [],
      primaryBranchId: branchId
    });
    setManagedCollaborator(null);
    setProfessionalAccessBranchSearch("");
    setAccessProfessional(collaborator);
  };

  const toggleProfessionalAccessBranch = (branchId: string) => {
    setProfessionalAccessForm((current) => {
      const branchIds = toggleValue(current.branchIds, branchId);
      return {
        ...current,
        branchIds,
        primaryBranchId: branchIds.includes(current.primaryBranchId) ? current.primaryBranchId : branchIds[0] ?? ""
      };
    });
  };

  const submitProfessionalAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessProfessional?.professionalId) return;
    try {
      await createProfessionalAccess.mutateAsync({
        professionalId: accessProfessional.professionalId,
        payload: {
          email: professionalAccessForm.email.trim(),
          password: professionalAccessForm.password,
          roleId: professionalAccessForm.roleId,
          branchIds: professionalAccessForm.branchIds,
          primaryBranchId: professionalAccessForm.primaryBranchId
        }
      });
      setAccessProfessional(null);
      setProfessionalAccessForm(emptyProfessionalAccessForm);
      toast.success("Acceso creado y vinculado al profesional.");
    } catch (error) {
      toast.error(errorMessageFromUnknown(error, "No se pudo crear el acceso."));
    }
  };

  const setClinicalEnabled = async (collaborator: CollaboratorDirectoryItem) => {
    if (!collaborator.professionalId) return;
    try {
      if (collaborator.clinicalStatus === "ACTIVE") {
        const impact = await getProfessionalDeactivationImpact(
          collaborator.professionalId,
          collaborator.clinicalBranch?.id ?? undefined
        );
        if (!impact.canDeactivate) {
          toast.error(
            `No se puede deshabilitar: ${impact.futureAppointments} citas, ${impact.futureBlocks} bloqueos y ${impact.activeSchedules} horarios activos. Sustituye o libera la agenda.`
          );
          setManagedCollaborator(null);
          setTransferProfessionalId(collaborator.professionalId);
          return;
        }
        await deactivateProfessional.mutateAsync(collaborator.professionalId);
        toast.success("Atencion clinica deshabilitada.");
      } else {
        await updateProfessional.mutateAsync({ id: collaborator.professionalId, payload: { isActive: true } });
        toast.success("Atencion clinica habilitada.");
      }
      setManagedCollaborator(null);
      void collaborators.refetch();
    } catch (error) {
      toast.error(errorMessageFromUnknown(error, "No se pudo cambiar el estado clinico."));
    }
  };

  const handleToggleUserStatus = async (user: UserListItem) => {
    try {
      if (user.status === "ACTIVE") {
        await deactivateUser.mutateAsync(user.id);
        toast.success("Acceso deshabilitado.");
      } else {
        await reactivateUser.mutateAsync(user.id);
        toast.success("Acceso habilitado.");
      }
      void collaborators.refetch();
    } catch (error) {
      toast.error(errorMessageFromUnknown(error, "No se pudo cambiar el estado de acceso."));
    }
  };

  const handleQuickEdit = (collaborator: CollaboratorDirectoryItem) => {
    const user = collaboratorToUser(collaborator);
    if (user && canUpdateUser) {
      openEdit(user);
      return;
    }
    if (!collaborator.hasAccess && collaborator.professionalId) {
      if (canCreateCollaborator && canUpdateProfessional) {
        openProfessionalAccess(collaborator);
        return;
      }
    }
    setManagedCollaborator(collaborator);
  };

  const getCollaboratorActionMenuItems = (row: CollaboratorDirectoryItem): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];
    const user = collaboratorToUser(row);
    const isCurrentUser = Boolean(row.userId && row.userId === actorId);

    items.push({
      id: `view-details-${row.id}`,
      label: "Ver expediente completo",
      icon: <Settings2 className="h-4 w-4 shrink-0 text-slate-500" />,
      onSelect: () => setManagedCollaborator(row)
    });

    if (row.hasAccess && canUpdateUser) {
      items.push({
        id: `edit-user-${row.id}`,
        label: "Editar datos y acceso",
        icon: <UserPen className="h-4 w-4 shrink-0 text-slate-500" />,
        onSelect: () => {
          if (user) openEdit(user);
        }
      });
    }

    if (!row.hasAccess && row.professionalId && canCreateCollaborator && canUpdateProfessional) {
      items.push({
        id: `create-access-${row.id}`,
        label: "Crear acceso al sistema",
        icon: <KeyRound className="h-4 w-4 shrink-0 text-emerald-600" />,
        onSelect: () => openProfessionalAccess(row)
      });
    }

    if (row.hasAccess && row.userId) {
      const isUserActive = row.accessStatus === "ACTIVE";
      const canToggle = isUserActive ? canDeactivateUser : canUpdateUser;
      items.push({
        id: `toggle-access-${row.id}`,
        label: isCurrentUser
          ? (isUserActive ? "Deshabilitar acceso (Usuario actual)" : "Habilitar acceso (Usuario actual)")
          : (isUserActive ? "Deshabilitar acceso" : "Habilitar acceso"),
        icon: isUserActive ? (
          <UserRoundX className="h-4 w-4 shrink-0" />
        ) : (
          <UserRoundCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        ),
        disabled: userMutationPending || isCurrentUser || !canToggle,
        destructive: isUserActive && !isCurrentUser,
        onSelect: () => {
          if (!user || isCurrentUser) return;
          void handleToggleUserStatus(user);
        }
      });
    }

    if (row.kind === "CLINICAL" && row.professionalId) {
      const isClinicalActive = row.clinicalStatus === "ACTIVE";
      const canToggleClinical = isClinicalActive ? (can("professionals.deactivate") || canManageAll) : canUpdateProfessional;

      items.push({
        id: `toggle-clinical-${row.id}`,
        label: isClinicalActive ? "Deshabilitar atención clínica" : "Habilitar atención clínica",
        icon: isClinicalActive ? (
          <UserRoundX className="h-4 w-4 shrink-0" />
        ) : (
          <UserRoundCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        ),
        disabled: userMutationPending || !canToggleClinical,
        destructive: isClinicalActive,
        onSelect: () => {
          void setClinicalEnabled(row);
        }
      });

      items.push({
        id: `schedules-${row.id}`,
        label: "Ver horarios en agenda",
        icon: <CalendarClock className="h-4 w-4 shrink-0 text-slate-500" />,
        onSelect: () => {
          navigate(`${APP_ROUTES.settings.schedules}?professionalId=${row.professionalId}${row.clinicalBranch ? `&branchId=${row.clinicalBranch.id}` : ""}`);
        }
      });

      if (canUpdateProfessional) {
        items.push({
          id: `contract-${row.id}`,
          label: "Gestionar contrato",
          icon: <FilePenLine className="h-4 w-4 shrink-0 text-slate-500" />,
          onSelect: () => {
            navigate(`${APP_ROUTES.settings.userContractsBulk}?professionalId=${row.professionalId}${row.clinicalBranch ? `&branchId=${row.clinicalBranch.id}` : ""}`);
          }
        });

        items.push({
          id: `transfer-${row.id}`,
          label: "Sustituir profesional",
          icon: <ArrowRightLeft className="h-4 w-4 shrink-0 text-slate-500" />,
          onSelect: () => setTransferProfessionalId(row.professionalId)
        });
      }
    }

    return items;
  };

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        <div className="space-y-4">
          <PageHeader title="Personal y usuarios" description="Alta, acceso, rol y expediente operativo del colaborador." />

          <div className="flex flex-col gap-3 border-b border-[var(--border-default)] pb-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(18rem,1.5fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)]">
              <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                <EntitySearchBox
                  placeholder="Buscar nombre, correo o cedula"
                  value={search}
                  onValueChange={setSearch}
                  items={search.trim() ? collaborators.data?.items ?? [] : []}
                  onSelect={(collaborator) => {
                    setSearch(collaboratorDisplayName(collaborator));
                    setManagedCollaborator(collaborator);
                  }}
                  getItemKey={(collaborator) => collaborator.id}
                  emptyMessage="Sin colaboradores encontrados"
                  renderItem={(collaborator) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{collaboratorDisplayName(collaborator)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{collaborator.email || "Profesional sin acceso"}</p>
                    </div>
                  )}
                />
              </div>
              <Select aria-label="Tipo de colaborador" value={kind} onChange={(event) => changeDirectoryFilter("kind", event.target.value)}>
                <option value="ALL">Todos los tipos</option>
                <option value="ADMINISTRATIVE">Administrativos</option>
                <option value="CLINICAL">Clinicos</option>
                <option value="CLINICAL_WITHOUT_ACCESS">Clinicos sin acceso</option>
              </Select>
              <Select aria-label="Estado de acceso" value={directoryAccessStatus} onChange={(event) => changeStatus(event.target.value)}>
                  <option value="">Todo acceso</option>
                  <option value="ACTIVE">Habilitados</option>
                  <option value="INACTIVE">Deshabilitados</option>
                  <option value="LOCKED">Bloqueados</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="WITHOUT_ACCESS">Sin acceso</option>
              </Select>
              <Select aria-label="Estado de atencion clinica" value={clinicalStatus} onChange={(event) => changeDirectoryFilter("clinicalStatus", event.target.value)}>
                <option value="">Toda atencion</option>
                <option value="ACTIVE">Atencion habilitada</option>
                <option value="INACTIVE">Atencion deshabilitada</option>
                <option value="NOT_APPLICABLE">No clinicos</option>
              </Select>
            </div>
            {canCreateCollaborator ? (
              <Button onClick={openCreate} className="w-full shrink-0 xl:w-auto">
                <UserRoundPlus className="mr-1.5 h-4 w-4" />
                Nuevo usuario
              </Button>
            ) : null}
          </div>

          {collaborators.isLoading ? <LoadingState message="Cargando personal y usuarios..." /> : null}
          {collaborators.isError ? <ErrorState message={collaborators.error.message} /> : null}
          {roles.isError ? <ErrorState message={roles.error.message} /> : null}
          {branches.isError ? <ErrorState message={branches.error.message} /> : null}
          {updateUser.isError ? <ErrorState message={updateUser.error.message} /> : null}
          {deactivateUser.isError ? <ErrorState message={deactivateUser.error.message} /> : null}

          {collaborators.data ? (
            <DataTable
              rows={collaborators.data.items}
              getRowKey={(row) => row.id}
              tableClassName="w-full table-fixed"
              stickyFirstColumn={true}
              stickyLastColumn={true}
              responsiveCards={true}
              empty={
                <EmptyState
                  title="Sin colaboradores"
                  description="No hay registros para los filtros seleccionados."
                />
              }
              columns={[
                {
                  key: "firstName",
                  title: "Colaborador",
                  primary: true,
                  headerClassName: "w-[300px] min-w-[260px]",
                  cellClassName: "w-[300px] min-w-[260px]",
                  render: (row) => {
                    const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase();
                    const isClinical = row.kind === "CLINICAL";
                    return (
                      <div className="flex items-start gap-3 min-w-0 py-0.5">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5",
                            isClinical
                              ? "bg-blue-50 text-blue-700 border border-blue-200/80"
                              : "bg-slate-100 text-slate-700 border border-slate-200/80"
                          )}
                        >
                          {initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleQuickEdit(row)}
                            className="font-bold text-slate-900 text-sm leading-tight block truncate hover:text-blue-600 transition-colors text-left"
                            title={collaboratorDisplayName(row)}
                          >
                            {collaboratorDisplayName(row)}
                          </button>
                          <span
                            className="text-xs text-slate-500 truncate block mt-0.5"
                            title={row.email ?? "Sin correo registrado"}
                          >
                            {row.email ?? "Sin correo"}
                          </span>
                          {row.phone ? (
                            <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
                              {row.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                },
                {
                  key: "role",
                  title: "Rol / Perfil",
                  headerClassName: "w-[230px] min-w-[200px]",
                  cellClassName: "w-[230px] min-w-[200px]",
                  render: (row) => {
                    const rawRole = row.role?.name;
                    const formattedRole = rawRole
                      ? rawRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                      : row.hasAccess
                        ? "Sin perfil"
                        : "Perfil clínico histórico";
                    const isClinical = row.kind === "CLINICAL";

                    return (
                      <div className="flex flex-col gap-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-xs text-slate-800 truncate" title={formattedRole}>
                            {formattedRole}
                          </span>
                          {isClinical ? (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.2 text-[10px] font-bold text-blue-700 border border-blue-200/70 shrink-0">
                              Clínico
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600 border border-slate-200/70 shrink-0">
                              Admin
                            </span>
                          )}
                        </div>
                        {isClinical && row.specialties.length > 0 ? (
                          <p
                            className="text-xs text-slate-500 truncate leading-tight"
                            title={row.specialties.map((item) => item.name).join(", ")}
                          >
                            {row.specialties.map((item) => item.name).join(", ")}
                          </p>
                        ) : null}
                        {row.licenseNumber ? (
                          <span className="font-mono text-[11px] font-medium text-slate-400 leading-none">
                            Céd. {row.licenseNumber}
                          </span>
                        ) : null}
                      </div>
                    );
                  }
                },
                {
                  key: "accessBranches",
                  title: "Sucursales",
                  headerClassName: "w-[260px] min-w-[220px]",
                  cellClassName: "w-[260px] min-w-[220px]",
                  render: (row) => {
                    const clinicalBranchName = row.clinicalBranch?.name;
                    const accessCount = row.accessBranches.length;
                    const allAccessNames = row.accessBranches.map((b) => b.name).join(", ");
                    const firstAccessName = row.accessBranches[0]?.name;

                    return (
                      <div className="flex flex-col gap-1 text-xs min-w-0 py-0.5">
                        {clinicalBranchName ? (
                          <div className="flex items-center gap-1.5 min-w-0" title={`Sucursal clínica: ${clinicalBranchName}`}>
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200/80 max-w-full truncate">
                              <Stethoscope className="h-3 w-3 shrink-0 text-emerald-600" />
                              <span className="truncate">{clinicalBranchName}</span>
                            </span>
                          </div>
                        ) : null}

                        {accessCount > 0 ? (
                          <div className="flex items-center gap-1 text-xs text-slate-600 min-w-0" title={allAccessNames}>
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {accessCount === 1 ? (
                              <span className="truncate">{firstAccessName}</span>
                            ) : (
                              <span className="truncate">
                                {firstAccessName} <span className="font-semibold text-slate-400">(+{accessCount - 1} más)</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin sucursales asignadas</span>
                        )}
                      </div>
                    );
                  }
                },
                {
                  key: "accessStatus",
                  title: "Estado",
                  headerClassName: "w-[160px] min-w-[140px]",
                  cellClassName: "w-[160px] min-w-[140px]",
                  render: (row) => {
                    const isAccessActive = row.accessStatus === "ACTIVE";
                    const isWithoutAccess = !row.hasAccess || !row.accessStatus;
                    const isClinicalActive = row.clinicalStatus === "ACTIVE";

                    return (
                      <div className="flex flex-col gap-1 text-xs leading-tight py-0.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border w-fit",
                            isAccessActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                              : isWithoutAccess
                                ? "bg-slate-100 text-slate-600 border-slate-200/80"
                                : "bg-amber-50 text-amber-700 border-amber-200/80"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isAccessActive
                                ? "bg-emerald-500"
                                : isWithoutAccess
                                  ? "bg-slate-400"
                                  : "bg-amber-500"
                            )}
                          />
                          {isWithoutAccess || !row.accessStatus
                            ? "Sin acceso"
                            : statusLabels[row.accessStatus] ?? row.accessStatus}
                        </span>

                        {row.kind === "CLINICAL" ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium pl-0.5",
                              isClinicalActive ? "text-emerald-700" : "text-amber-700"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isClinicalActive ? "bg-emerald-500" : "bg-amber-500"
                              )}
                            />
                            {isClinicalActive ? "Atención activa" : "Atención pausada"}
                          </span>
                        ) : null}
                      </div>
                    );
                  }
                },
                {
                  key: "id",
                  title: "Acciones",
                  actions: true,
                  headerClassName: "w-[100px] min-w-[100px] text-right",
                  cellClassName: "w-[100px] min-w-[100px]",
                  render: (row) => (
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title={row.hasAccess ? "Editar colaborador" : "Gestionar colaborador"}
                        aria-label={row.hasAccess ? "Editar colaborador" : "Gestionar colaborador"}
                        onClick={() => handleQuickEdit(row)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0" />
                      </button>
                      <ActionMenu
                        items={getCollaboratorActionMenuItems(row)}
                        triggerIcon={<MoreVertical className="h-4 w-4 shrink-0" />}
                        size="sm"
                        label="Acciones de colaborador"
                        align="right"
                        buttonClassName="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                      />
                    </div>
                  )
                }
              ]}
            />
          ) : null}
        </div>
      </UsersModuleNav>

      <Drawer
        open={Boolean(managedCollaborator)}
        title={managedCollaborator ? collaboratorDisplayName(managedCollaborator) : "Gestionar colaborador"}
        description={managedCollaborator?.kind === "CLINICAL" ? "Acceso y operacion clinica son estados independientes." : "Datos, acceso, perfil y sucursales del usuario."}
        onClose={() => setManagedCollaborator(null)}
      >
        {managedCollaborator ? (
          <div className="space-y-5">
            <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={managedCollaborator.kind === "CLINICAL" ? "Usuario clinico" : "Usuario administrativo"} tone={managedCollaborator.kind === "CLINICAL" ? "brand" : "default"} />
                <Badge value={managedCollaborator.accessStatus ? `Acceso: ${statusLabels[managedCollaborator.accessStatus] ?? managedCollaborator.accessStatus}` : "Sin acceso"} tone={managedCollaborator.accessStatus === "ACTIVE" ? "success" : "warning"} />
                {managedCollaborator.kind === "CLINICAL" ? <Badge value={managedCollaborator.clinicalStatus === "ACTIVE" ? "Atencion habilitada" : "Atencion deshabilitada"} tone={managedCollaborator.clinicalStatus === "ACTIVE" ? "success" : "warning"} /> : null}
              </div>
              <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2 min-w-0">
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Correo de acceso</dt>
                  <dd className="mt-1 font-semibold text-slate-900 break-all">{managedCollaborator.email ?? "Sin correo de acceso"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Perfil</dt>
                  <dd className="mt-1 font-semibold text-slate-900 break-words">{managedCollaborator.role?.name ?? "Sin perfil"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Sucursales de acceso</dt>
                  <dd className="mt-1 font-medium text-slate-800 break-words">{managedCollaborator.accessBranches.map((branch) => branch.name).join(", ") || "Sin acceso"}</dd>
                </div>
                {managedCollaborator.clinicalBranch ? (
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Sucursal clínica</dt>
                    <dd className="mt-1 font-medium text-slate-800 break-words">{managedCollaborator.clinicalBranch.name}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[var(--text-brand-strong)]">Datos y acceso</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {managedCollaborator.hasAccess && canUpdateUser ? <Button variant="secondary" onClick={editManagedCollaborator}><UserPen className="h-4 w-4" />Editar datos y acceso</Button> : null}
                {!managedCollaborator.hasAccess && managedCollaborator.professionalId && canCreateCollaborator && canUpdateProfessional ? <Button variant="secondary" onClick={() => openProfessionalAccess(managedCollaborator)}><KeyRound className="h-4 w-4" />Crear acceso</Button> : null}
                {managedCollaborator.hasAccess && managedCollaborator.userId && (managedCollaborator.accessStatus === "ACTIVE" ? canDeactivateUser : canUpdateUser) ? (
                  <Button
                    variant={managedCollaborator.accessStatus === "ACTIVE" ? "danger" : "secondary"}
                    disabled={userMutationPending || managedCollaborator.userId === actorId}
                    onClick={() => {
                      const user = collaboratorToUser(managedCollaborator);
                      if (!user) return;
                      void setUserEnabled(user).then(() => {
                        setManagedCollaborator(null);
                        void collaborators.refetch();
                      });
                    }}
                  >
                    {managedCollaborator.accessStatus === "ACTIVE" ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
                    {managedCollaborator.accessStatus === "ACTIVE" ? "Deshabilitar acceso" : "Habilitar acceso"}
                  </Button>
                ) : null}
              </div>
            </section>

            {managedCollaborator.kind === "CLINICAL" && managedCollaborator.professionalId ? (
              <section className="border-t border-[var(--border-default)] pt-5">
                <h3 className="text-sm font-semibold text-[var(--text-brand-strong)]">Operacion clinica</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {canUpdateProfessional ? <Button variant="secondary" onClick={editManagedCollaborator}><Stethoscope className="h-4 w-4" />Perfil clinico</Button> : null}
                  <Link className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-brand)] px-4 font-medium text-[var(--text-brand)] hover:text-[var(--action-brand-hover)]" to={`/settings/online-scheduling/schedules?professionalId=${managedCollaborator.professionalId}${managedCollaborator.clinicalBranch ? `&branchId=${managedCollaborator.clinicalBranch.id}` : ""}`}><CalendarClock className="h-4 w-4" />Horarios</Link>
                  {canUpdateProfessional ? <Link className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-brand)] px-4 font-medium text-[var(--text-brand)] hover:text-[var(--action-brand-hover)]" to={`/settings/users/contracts/bulk?professionalId=${managedCollaborator.professionalId}${managedCollaborator.clinicalBranch ? `&branchId=${managedCollaborator.clinicalBranch.id}` : ""}`}><FilePenLine className="h-4 w-4" />Contrato</Link> : null}
                  {canUpdateProfessional ? <Button variant="secondary" onClick={() => { setTransferProfessionalId(managedCollaborator.professionalId); setManagedCollaborator(null); }}><ArrowRightLeft className="h-4 w-4" />Sustituir</Button> : null}
                  {(managedCollaborator.clinicalStatus === "ACTIVE" ? can("professionals.deactivate") || canManageAll : canUpdateProfessional) ? <Button variant={managedCollaborator.clinicalStatus === "ACTIVE" ? "danger" : "secondary"} onClick={() => void setClinicalEnabled(managedCollaborator)}>{managedCollaborator.clinicalStatus === "ACTIVE" ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}{managedCollaborator.clinicalStatus === "ACTIVE" ? "Deshabilitar atencion" : "Habilitar atencion"}</Button> : null}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">Contrato abre editor real con vista previa. Comisión global queda como compatibilidad para nomina.</p>
              </section>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Modal open={Boolean(accessProfessional)} title={accessProfessional ? `Crear acceso para ${collaboratorDisplayName(accessProfessional)}` : "Crear acceso"} onClose={() => { setAccessProfessional(null); setProfessionalAccessForm(emptyProfessionalAccessForm); setProfessionalAccessBranchSearch(""); }}>
        <form className="space-y-4" onSubmit={submitProfessionalAccess}>
          <p className="text-sm text-[var(--text-secondary)]">Perfil clinico e historial se conservan. Esta accion crea credenciales y las vincula al profesional existente.</p>
          <label className="grid gap-1 text-sm text-[var(--text-primary)]">Correo de acceso<Input required type="email" value={professionalAccessForm.email} onChange={(event) => setProfessionalAccessForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label className="grid gap-1 text-sm text-[var(--text-primary)]">Contraseña temporal<Input required minLength={8} type="password" value={professionalAccessForm.password} onChange={(event) => setProfessionalAccessForm((current) => ({ ...current, password: event.target.value }))} /></label>
          <label className="grid gap-1 text-sm text-[var(--text-primary)]">Rol<Select required value={professionalAccessForm.roleId} onChange={(event) => setProfessionalAccessForm((current) => ({ ...current, roleId: event.target.value }))}><option value="">Selecciona perfil</option>{(roles.data ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></label>
          <fieldset className="rounded-[var(--radius-lg)] border border-[var(--border-default)] p-3">
            <div className="flex items-center justify-between">
              <legend className="px-1 text-sm font-semibold text-[var(--text-primary)]">Sucursales de acceso</legend>
              <Badge value={`${professionalAccessForm.branchIds.length} seleccionada${professionalAccessForm.branchIds.length === 1 ? "" : "s"}`} tone="default" />
            </div>

            <div className="mt-2 relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar sucursal..."
                value={professionalAccessBranchSearch}
                onChange={(e) => setProfessionalAccessBranchSearch(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {professionalAccessBranchSearch ? (
                <button
                  type="button"
                  onClick={() => setProfessionalAccessBranchSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {filteredProfessionalAccessBranches.length === 0 ? (
              <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-2 text-center">
                <p className="text-xs text-slate-500">No se encontraron sucursales para "{professionalAccessBranchSearch}".</p>
              </div>
            ) : (
              <div className="mt-2 grid max-h-36 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                {filteredProfessionalAccessBranches.map((branch) => {
                  const isChecked = professionalAccessForm.branchIds.includes(branch.id);
                  return (
                    <label
                      key={branch.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2 text-xs transition-colors cursor-pointer",
                        isChecked
                          ? "border-blue-200 bg-blue-50/50 text-blue-900 font-medium"
                          : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={isChecked}
                        onChange={() => toggleProfessionalAccessBranch(branch.id)}
                      />
                      <span className="truncate">{branch.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <label className="mt-3 grid gap-1 text-sm">
              Sucursal principal
              <Select
                required
                value={professionalAccessForm.primaryBranchId}
                onChange={(event) => setProfessionalAccessForm((current) => ({ ...current, primaryBranchId: event.target.value }))}
              >
                <option value="">Selecciona sucursal</option>
                {(branches.data ?? [])
                  .filter((branch) => professionalAccessForm.branchIds.includes(branch.id))
                  .map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </label>
          </fieldset>
          {createProfessionalAccess.isError ? <ErrorState message={createProfessionalAccess.error.message} /> : null}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAccessProfessional(null)}>Cancelar</Button><Button type="submit" disabled={createProfessionalAccess.isPending || !professionalAccessForm.branchIds.length}>{createProfessionalAccess.isPending ? "Creando..." : "Crear acceso"}</Button></div>
        </form>
      </Modal>

      <ProfessionalTransferModal professional={transferProfessional} onClose={() => setTransferProfessionalId(null)} />

      <Modal
        open={userFormOpen}
        title={editing ? "Editar usuario" : "Nuevo usuario"}
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

          <CollaboratorFormOverview
            accessLabel={userForm.email || (editing ? editing.email : "Correo requerido")}
            primaryBranchLabel={selectedPrimaryBranch?.name ?? "Pendiente"}
            roleLabel={selectedRole?.name ?? "Pendiente"}
            clinicalBranchLabel={selectedClinicalBranch?.name ?? "Sucursal pendiente"}
            clinical={professionalEnabled}
            editing={Boolean(editing)}
            canCreateProfessional={canCreateProfessional}
            onSelectClinical={() => {
              setUserKind("PROFESSIONAL");
              setProfessionalForm((current) => ({
                ...current,
                enabled: true,
                branchId: current.branchId || userForm.primaryBranchId || userForm.branchIds[0] || ""
              }));
              if (!userForm.roleId) {
                const matchedRole = roles.data?.find((role) => /profesional|doctor|dentista|odont/i.test(role.name));
                if (matchedRole) setRole(matchedRole.id);
              }
            }}
            onSelectAdministrative={() => {
              setUserKind("STAFF");
              setProfessionalForm((current) => ({ ...current, enabled: false }));
              if (!userForm.roleId || userKind === "PROFESSIONAL") {
                const matchedRole = roles.data?.find((role) => /staff|recepci|asistente|auxiliar|admin/i.test(role.name));
                if (matchedRole) setRole(matchedRole.id);
              }
            }}
          />

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
            {selectedRole && selectedRolePermissionSummary ? (
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3 sm:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Facultades heredadas</p>
                    <p className="mt-1 text-xs text-emerald-800/80">
                      Este resumen es informativo. Los cambios se realizan en el perfil {selectedRole.name}.
                    </p>
                  </div>
                  {canReadRoles ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate(APP_ROUTES.settings.roleDetail(selectedRole.id))}>
                      Editar perfil
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge value={`${selectedRolePermissionSummary.basic.length} habituales`} tone="success" />
                  <Badge value={`${selectedRolePermissionSummary.advanced.length} avanzadas`} tone="warning" />
                  {selectedRolePermissionSummary.internal.length ? (
                    <Badge value={`${selectedRolePermissionSummary.internal.length} internas`} tone="default" />
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedRolePermissionSummary.basic.slice(0, 6).map((permission) => (
                    <span key={permission.key} className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] text-emerald-900">
                      {permission.label}
                    </span>
                  ))}
                  {selectedRolePermissionSummary.basic.length > 6 ? (
                    <span className="px-2 py-1 text-[11px] font-medium text-emerald-800">
                      +{selectedRolePermissionSummary.basic.length - 6} más
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
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

            {/* Quick search input & batch tools */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar sucursal por nombre, zona o código..."
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {branchSearch ? (
                  <button
                    type="button"
                    onClick={() => setBranchSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {filteredBranches.length > 0 && branchSearch.trim() ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredBranches.map((b) => b.id);
                      setUserForm((current) => {
                        const nextIds = Array.from(new Set([...current.branchIds, ...visibleIds]));
                        const primaryBranchId = nextIds.includes(current.primaryBranchId)
                          ? current.primaryBranchId
                          : (nextIds[0] ?? "");
                        return { ...current, branchIds: nextIds, primaryBranchId };
                      });
                    }}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Marcar visibles
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = new Set(filteredBranches.map((b) => b.id));
                      setUserForm((current) => {
                        const nextIds = current.branchIds.filter((id) => !visibleIds.has(id));
                        const primaryBranchId = nextIds.includes(current.primaryBranchId)
                          ? current.primaryBranchId
                          : (nextIds[0] ?? "");
                        return { ...current, branchIds: nextIds, primaryBranchId };
                      });
                    }}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Desmarcar
                  </button>
                </div>
              ) : null}
            </div>

            {filteredBranches.length === 0 ? (
              <div className="mt-2 flex h-24 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center">
                <p className="text-xs text-slate-500">
                  No se encontraron sucursales para "{branchSearch}".
                </p>
              </div>
            ) : (
              <div className="mt-2 grid max-h-36 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                {filteredBranches.map((branch) => {
                  const isChecked = userForm.branchIds.includes(branch.id);
                  return (
                    <label
                      key={branch.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2 text-xs transition-colors cursor-pointer",
                        isChecked
                          ? "border-blue-200 bg-blue-50/50 text-blue-900 font-medium"
                          : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={isChecked}
                        onChange={() => toggleBranch(branch.id)}
                      />
                      <span className="truncate">{branch.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

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

          {professionalEnabled ? (
            <section className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-slate-900">Perfil profesional y agenda</h4>
                <p className="text-xs text-slate-500">
                  Configuración operativa de doctor/especialista para agenda, box de atención y especialidades.
                </p>
              </div>

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
            </section>
          ) : null}

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
