import { useMemo, useState } from "react";
import { FileKey2, Link2, Phone, ShieldCheck, UserRoundPlus, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth.store";
import { PatientSearchBox } from "./patient-search-box";
import { PatientFamilyPolicies } from "./patient-family-policies";
import {
  usePatientIdentity,
  usePatientIdentityConfig,
  usePatientIdentityConfigMutation,
  usePatientIdentityMutations
} from "../hooks/use-patient-identity";
import type { PatientListItem } from "../services/patients.service";

type Props = {
  patientId: string;
  patientName: string;
  patientBranchId: string;
  patientPhone?: string | null;
};

type FamilyPermissionKey =
  | "canBook"
  | "canReschedule"
  | "canCancel"
  | "canReceiveReminders"
  | "canViewAppointmentSummary"
  | "canViewFinancialInformation"
  | "canViewClinicalInformation"
  | "canSignConsents";

type FamilyPermissionDraft = Record<FamilyPermissionKey, boolean> & { consentStatus: string };

const FAMILY_PERMISSION_OPTIONS: Array<{
  key: FamilyPermissionKey;
  label: string;
  description: string;
  sensitive?: boolean;
}> = [
  { key: "canBook", label: "Agendar citas", description: "Crear citas para integrante" },
  { key: "canReschedule", label: "Reprogramar", description: "Cambiar fecha u horario" },
  { key: "canCancel", label: "Cancelar", description: "Cancelar citas existentes" },
  { key: "canReceiveReminders", label: "Recordatorios", description: "Recibir avisos del integrante" },
  { key: "canViewAppointmentSummary", label: "Resumen de cita", description: "Ver datos mínimos de agenda" },
  {
    key: "canViewFinancialInformation",
    label: "Información financiera",
    description: "Acceso sensible; no se hereda",
    sensitive: true
  },
  {
    key: "canViewClinicalInformation",
    label: "Información clínica",
    description: "Acceso sensible; no se hereda",
    sensitive: true
  },
  {
    key: "canSignConsents",
    label: "Firmar consentimientos",
    description: "Requiere autorización expresa",
    sensitive: true
  }
];

const EMPTY_PERMISSION_DRAFT: FamilyPermissionDraft = {
  canBook: false,
  canReschedule: false,
  canCancel: false,
  canReceiveReminders: false,
  canViewAppointmentSummary: false,
  canViewFinancialInformation: false,
  canViewClinicalInformation: false,
  canSignConsents: false,
  consentStatus: "PENDING"
};

const BASIC_PERMISSION_KEYS = new Set<FamilyPermissionKey>([
  "canBook",
  "canReschedule",
  "canCancel",
  "canReceiveReminders"
]);

const ROLE_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  SHARED_FAMILY: "Compartido familiar",
  GUARDIAN: "Tutor",
  AUTHORIZED_BOOKER: "Autorizado para agendar",
  NOTIFICATION_ONLY: "Solo notificaciones",
  GROUP_OWNER: "Administrador",
  GROUP_MANAGER: "Gestor",
  ADULT_MEMBER: "Adulto",
  DEPENDENT_ADULT: "Adulto dependiente",
  MINOR: "Menor"
};

const CONSENT_LABELS: Record<string, string> = {
  ACCEPTED: "Aceptado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  REVOKED: "Revocado"
};

const CONTACT_STATUS_LABELS: Record<string, string> = {
  VERIFIED: "Verificado",
  FAMILY_SHARED: "Familiar",
  AMBIGUOUS: "Ambiguo",
  BLOCKED: "Bloqueado",
  UNVERIFIED: "Sin verificar",
  REVOKED: "Revocado"
};

export function PatientIdentityCard({ patientId, patientName, patientBranchId, patientPhone }: Props) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRead = hasPermission("contact_points.read");
  const canLink = hasPermission("contact_points.link");
  const canManageFamily = hasPermission("family_groups.manage_members");
  const canManagePermissions = hasPermission("family_groups.manage_permissions");
  const canManageConfig = hasPermission("patient_identity.config.manage");
  const identity = usePatientIdentity(canRead ? patientId : undefined);
  const config = usePatientIdentityConfig(canManageConfig);
  const configMutation = usePatientIdentityConfigMutation();
  const mutations = usePatientIdentityMutations(patientId);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(patientPhone ?? "");
  const [phoneRole, setPhoneRole] = useState("PERSONAL");
  const [groupName, setGroupName] = useState(`Familia ${patientName.split(" ").at(-1) ?? patientName}`);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberMode, setMemberMode] = useState<"existing" | "new">("new");
  const [selectedMember, setSelectedMember] = useState<PatientListItem | null>(null);
  const [memberRole, setMemberRole] = useState("ADULT_MEMBER");
  const [relationship, setRelationship] = useState("");
  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: ""
  });
  const [permissionMemberId, setPermissionMemberId] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<FamilyPermissionDraft>(EMPTY_PERMISSION_DRAFT);
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false);
  const [activeTab, setActiveTab] = useState<"contact" | "family" | "policies">("family");

  const contacts = identity.data?.contacts ?? [];
  const groups = useMemo(() => {
    const unique = new Map<string, NonNullable<typeof identity.data>["memberships"][number]["familyGroup"]>();
    for (const membership of identity.data?.memberships ?? [])
      unique.set(membership.familyGroup.id, membership.familyGroup);
    return [...unique.values()];
  }, [identity.data]);
  const activeGroup = groups[0];
  const activeFamilyContact =
    activeGroup?.contacts.find((contact) => contact.isPrimary) ?? activeGroup?.contacts[0];
  const sharedContact = contacts.find(
    (contact) => contact.role !== "PERSONAL" || contact.contactPoint.status === "FAMILY_SHARED"
  );

  if (!canRead) return null;

  const linkPhone = async () => {
    if (!phone.trim()) return;
    await mutations.linkPhone.mutateAsync({
      patientId,
      phone,
      role: phoneRole,
      isPrimary: phoneRole === "PERSONAL",
      consentStatus: ["PERSONAL", "SHARED_FAMILY"].includes(phoneRole) ? "ACCEPTED" : "PENDING",
      familyGroupId: phoneRole === "SHARED_FAMILY" ? activeGroup?.id : undefined
    });
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    await mutations.createGroup.mutateAsync({
      name: groupName,
      ownerPatientId: patientId,
      primaryContact: phone.trim() ? { phone } : undefined
    });
  };

  const addMember = async () => {
    if (!activeGroup || !selectedMember) return;
    await mutations.addMember.mutateAsync({
      groupId: activeGroup.id,
      payload: {
        patientId: selectedMember.id,
        role: memberRole,
        relationship: relationship || undefined,
        consentStatus: memberRole === "MINOR" ? "ACCEPTED" : "PENDING"
      }
    });
    setSelectedMember(null);
    setMemberSearch("");
    setRelationship("");
  };

  const addNewMember = async () => {
    if (!activeGroup) return;
    await mutations.createMemberPatient.mutateAsync({
      groupId: activeGroup.id,
      payload: {
        branchId: patientBranchId,
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        birthDate: newMember.birthDate,
        gender: newMember.gender || undefined,
        role: memberRole,
        relationship,
        consentStatus: memberRole === "MINOR" ? "ACCEPTED" : "PENDING"
      }
    });
    setNewMember({ firstName: "", lastName: "", birthDate: "", gender: "" });
    setRelationship("");
    setMemberRole("ADULT_MEMBER");
  };

  const ageLabel = (birthDate?: string | null) => {
    if (!birthDate) return "Edad no registrada";
    const date = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const beforeBirthday =
      today.getMonth() < date.getMonth() ||
      (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
    if (beforeBirthday) age -= 1;
    return `${Math.max(age, 0)} años`;
  };

  const editPermissions = (memberId: string) => {
    if (!activeGroup || !activeFamilyContact) return;
    const member = activeGroup.members.find((item) => item.id === memberId);
    const grant = activeGroup.bookingGrants?.find(
      (item) =>
        item.patientId === member?.patientId &&
        item.actorContactPointId === activeFamilyContact.contactPoint.id
    );
    setPermissionMemberId(memberId);
    setPermissionDraft({
      canBook: grant?.canBook ?? false,
      canReschedule: grant?.canReschedule ?? false,
      canCancel: grant?.canCancel ?? false,
      canReceiveReminders: grant?.canReceiveReminders ?? false,
      canViewAppointmentSummary: grant?.canViewAppointmentSummary ?? false,
      canViewFinancialInformation: grant?.canViewFinancialInformation ?? false,
      canViewClinicalInformation: grant?.canViewClinicalInformation ?? false,
      canSignConsents: grant?.canSignConsents ?? false,
      consentStatus: member?.consentStatus ?? "PENDING"
    });
  };

  const savePermissions = async (memberId: string) => {
    if (!activeGroup || !activeFamilyContact) return;
    const member = activeGroup.members.find((item) => item.id === memberId);
    if (!member) return;
    if (member.consentStatus !== permissionDraft.consentStatus) {
      await mutations.updateMember.mutateAsync({
        groupId: activeGroup.id,
        memberId: member.id,
        payload: { consentStatus: permissionDraft.consentStatus, expectedVersion: member.version }
      });
    }
    await mutations.grant.mutateAsync({
      groupId: activeGroup.id,
      payload: {
        actorContactPointId: activeFamilyContact.contactPoint.id,
        patientId: member.patientId,
        ...permissionDraft
      }
    });
    setPermissionMemberId(null);
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--action-primary)]" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 pl-1">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-[var(--text-brand)]" />
              <h3 className="text-base font-semibold text-slate-900">Identidad y familia</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Teléfono localiza contactos; expediente conserva identidad propia.
            </p>
          </div>
          <Badge
            value={sharedContact ? "Contacto compartido" : "Contacto personal"}
            tone={sharedContact ? "warning" : "success"}
          />
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Medios vinculados
              </p>
              <p className="truncate text-sm font-medium text-slate-800">
                {contacts.length
                  ? `${contacts.length} contacto${contacts.length === 1 ? "" : "s"}`
                  : "Sin migrar"}
              </p>
            </div>
            <Phone className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Grupo familiar
              </p>
              <p className="truncate text-sm font-medium text-slate-800">
                {activeGroup
                  ? `${activeGroup.name} · ${activeGroup.members.length} integrantes`
                  : "No configurado"}
              </p>
            </div>
            <ShieldCheck className="h-4 w-4 text-slate-400" />
          </div>
        </div>

        <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Link2 className="h-4 w-4" />
          Gestionar identidad
        </Button>
      </Card>

      <Modal open={open} title="Identidad, contactos y familia" onClose={() => setOpen(false)} size="2xl">
        <div className="mb-4 grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {(
            [
              ["contact", "Contacto", Phone],
              ["family", "Grupo familiar", UsersRound],
              ["policies", "Pólizas", FileKey2]
            ] as const
          ).map(([tab, label, Icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className={activeTab === "policies" ? "hidden" : "grid gap-5"}>
          <section
            className={`${activeTab !== "contact" ? "hidden" : ""} space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Canal de contacto
              </p>
              <h4 className="mt-1 font-semibold text-slate-900">Vincular teléfono</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Compartir número genera relación; nunca fusiona fichas.
              </p>
            </div>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+52 961 000 0000"
              inputMode="tel"
            />
            <Select value={phoneRole} onChange={(event) => setPhoneRole(event.target.value)}>
              <option value="PERSONAL">Uso personal</option>
              <option value="SHARED_FAMILY">Compartido familiar</option>
              <option value="GUARDIAN">Teléfono de tutor</option>
              <option value="AUTHORIZED_BOOKER">Autorizado para agendar</option>
              <option value="NOTIFICATION_ONLY">Solo notificaciones</option>
            </Select>
            <Button
              className="w-full"
              onClick={() => void linkPhone()}
              disabled={
                !canLink ||
                !phone.trim() ||
                mutations.linkPhone.isPending ||
                (phoneRole === "SHARED_FAMILY" && !activeGroup)
              }
            >
              Vincular sin fusionar
            </Button>
            {phoneRole === "SHARED_FAMILY" && !activeGroup ? (
              <p className="text-xs font-medium text-amber-700">
                Crea o asigna grupo familiar antes de compartir teléfono.
              </p>
            ) : null}

            <div className="space-y-2 border-t border-slate-200 pt-4">
              {contacts.length ? (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {contact.contactPoint.normalizedValue}
                      </p>
                      <p className="text-xs text-slate-500">{ROLE_LABELS[contact.role] ?? contact.role}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {CONTACT_STATUS_LABELS[contact.contactPoint.status] ?? contact.contactPoint.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Guarda o migra teléfono para crear primer vínculo.</p>
              )}
            </div>
          </section>

          <section
            className={`${activeTab !== "family" ? "hidden" : ""} space-y-4 rounded-xl border border-slate-200 p-4`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Autorizaciones limitadas
                </p>
                <h4 className="mt-1 font-semibold text-slate-900">Grupo familiar</h4>
                {activeGroup ? (
                  <p className="mt-1 font-mono text-xs font-bold text-[var(--text-brand)]">
                    {activeGroup.familyCode}
                  </p>
                ) : null}
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Grupo permite agendar. No concede acceso clínico ni financiero.
                </p>
              </div>
              {activeGroup ? <Badge value="Activo" tone="success" /> : <Badge value="Sin grupo" />}
            </div>

            {!activeGroup ? (
              <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                {canManageConfig && config.data && !config.data.familyGroupsEnabled ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                      configMutation.mutate({ familyGroupsEnabled: true, adminResolutionEnabled: true })
                    }
                    disabled={configMutation.isPending}
                  >
                    Habilitar grupos familiares
                  </Button>
                ) : null}
                <Input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Nombre del grupo"
                />
                <Button
                  className="w-full"
                  onClick={() => void createGroup()}
                  disabled={!canManageFamily || !groupName.trim() || mutations.createGroup.isPending}
                >
                  <UsersRound className="h-4 w-4" />
                  Crear grupo familiar
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {activeGroup.members.map((member) => (
                    <div
                      key={member.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {member.patient.firstName} {member.patient.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {member.relationship || ROLE_LABELS[member.role] || member.role} ·{" "}
                            {ageLabel(member.patient.birthDate)} ·{" "}
                            {member.role === "MINOR" ? "Menor" : "Adulto"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <Badge
                            value={CONSENT_LABELS[member.consentStatus] ?? member.consentStatus}
                            tone={member.consentStatus === "ACCEPTED" ? "success" : "warning"}
                          />
                          {canManagePermissions ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!activeFamilyContact}
                              onClick={() =>
                                permissionMemberId === member.id
                                  ? setPermissionMemberId(null)
                                  : editPermissions(member.id)
                              }
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Permisos
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {permissionMemberId === member.id ? (
                        <div className="border-t border-slate-200 bg-slate-50/80 p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Consentimiento y alcance
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Cada permiso aplica solo a este integrante y teléfono.
                              </p>
                            </div>
                            <label className="min-w-40 text-xs font-medium text-slate-600">
                              Consentimiento
                              <Select
                                className="mt-1"
                                value={permissionDraft.consentStatus}
                                onChange={(event) =>
                                  setPermissionDraft((current) => ({
                                    ...current,
                                    consentStatus: event.target.value
                                  }))
                                }
                              >
                                <option value="PENDING">Pendiente</option>
                                <option value="ACCEPTED">Aceptado</option>
                                <option value="REJECTED">Rechazado</option>
                                <option value="REVOKED">Revocado</option>
                              </Select>
                            </label>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {FAMILY_PERMISSION_OPTIONS.filter(
                              (permission) =>
                                showAdvancedPermissions || BASIC_PERMISSION_KEYS.has(permission.key)
                            ).map((permission) => {
                              const enabled = permissionDraft[permission.key];
                              return (
                                <button
                                  key={permission.key}
                                  type="button"
                                  role="switch"
                                  aria-checked={enabled}
                                  onClick={() =>
                                    setPermissionDraft((current) => ({
                                      ...current,
                                      [permission.key]: !enabled
                                    }))
                                  }
                                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                                    enabled
                                      ? permission.sensitive
                                        ? "border-amber-300 bg-amber-50"
                                        : "border-emerald-300 bg-emerald-50"
                                      : "border-slate-200 bg-white hover:border-slate-300"
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-slate-800">
                                      {permission.label}
                                    </span>
                                    <span className="block truncate text-[11px] text-slate-500">
                                      {permission.description}
                                    </span>
                                  </span>
                                  <span
                                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${enabled ? (permission.sensitive ? "bg-amber-500" : "bg-emerald-600") : "bg-slate-300"}`}
                                  >
                                    <span
                                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled ? "left-[18px]" : "left-0.5"}`}
                                    />
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <p className="text-[11px] leading-4 text-amber-700">
                              Clínica, finanzas y firma permanecen apagados salvo autorización explícita.
                            </p>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setShowAdvancedPermissions((value) => !value)}
                              >
                                {showAdvancedPermissions ? "Ocultar avanzado" : "Configuración avanzada"}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => void savePermissions(member.id)}
                                disabled={mutations.grant.isPending || mutations.updateMember.isPending}
                              >
                                Guardar permisos
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!activeFamilyContact ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      Vincula un teléfono al grupo antes de administrar permisos.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <UserRoundPlus className="h-4 w-4 text-[var(--text-brand)]" />
                      Agregar integrante
                    </div>
                    <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
                      <button
                        type="button"
                        className={`rounded-md px-3 py-1.5 ${memberMode === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                        onClick={() => setMemberMode("new")}
                      >
                        Nuevo
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-3 py-1.5 ${memberMode === "existing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                        onClick={() => setMemberMode("existing")}
                      >
                        Existente
                      </button>
                    </div>
                  </div>
                  {memberMode === "existing" ? (
                    <>
                      <PatientSearchBox
                        value={memberSearch}
                        onValueChange={(value) => {
                          setMemberSearch(value);
                          setSelectedMember(null);
                        }}
                        onSelect={(patient) => {
                          setSelectedMember(patient);
                          setMemberSearch(`${patient.firstName} ${patient.lastName}`);
                        }}
                        placeholder="Buscar por nombre, documento o teléfono"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                          <option value="ADULT_MEMBER">Adulto</option>
                          <option value="MINOR">Menor</option>
                          <option value="GUARDIAN">Tutor</option>
                          <option value="DEPENDENT_ADULT">Adulto dependiente</option>
                          <option value="AUTHORIZED_BOOKER">Autorizado para agendar</option>
                        </Select>
                        <Input
                          value={relationship}
                          onChange={(event) => setRelationship(event.target.value)}
                          placeholder="Relación: hijo, madre…"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => void addMember()}
                        disabled={!selectedMember || mutations.addMember.isPending}
                      >
                        Vincular paciente existente
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          value={newMember.firstName}
                          onChange={(event) =>
                            setNewMember((current) => ({ ...current, firstName: event.target.value }))
                          }
                          placeholder="Nombre"
                        />
                        <Input
                          value={newMember.lastName}
                          onChange={(event) =>
                            setNewMember((current) => ({ ...current, lastName: event.target.value }))
                          }
                          placeholder="Apellidos"
                        />
                        <Input
                          type="date"
                          value={newMember.birthDate}
                          onChange={(event) =>
                            setNewMember((current) => ({ ...current, birthDate: event.target.value }))
                          }
                        />
                        <Select
                          value={newMember.gender}
                          onChange={(event) =>
                            setNewMember((current) => ({ ...current, gender: event.target.value }))
                          }
                        >
                          <option value="">Género opcional</option>
                          <option value="FEMALE">Femenino</option>
                          <option value="MALE">Masculino</option>
                          <option value="OTHER">Otro</option>
                        </Select>
                        <Select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                          <option value="MINOR">Menor</option>
                          <option value="ADULT_MEMBER">Adulto</option>
                          <option value="DEPENDENT_ADULT">Adulto dependiente</option>
                        </Select>
                        <Input
                          value={relationship}
                          onChange={(event) => setRelationship(event.target.value)}
                          placeholder="Relación: hijo, hija..."
                        />
                      </div>
                      {newMember.birthDate ? (
                        <p className="text-xs text-slate-500">
                          Referencia: {ageLabel(newMember.birthDate)}. El teléfono queda como contacto
                          familiar, no como teléfono personal.
                        </p>
                      ) : null}
                      <Button
                        className="w-full"
                        onClick={() => void addNewMember()}
                        disabled={
                          !newMember.firstName.trim() ||
                          !newMember.lastName.trim() ||
                          !newMember.birthDate ||
                          !relationship.trim() ||
                          mutations.createMemberPatient.isPending
                        }
                      >
                        Agregar integrante nuevo
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
        {activeTab === "policies" ? (
          <PatientFamilyPolicies patientId={patientId} patientName={patientName} familyGroup={activeGroup} />
        ) : null}
      </Modal>
    </>
  );
}
