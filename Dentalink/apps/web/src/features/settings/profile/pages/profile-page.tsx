import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";
import {
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  Building2,
  CheckCircle2,
  Lock,
  Check,
  Calendar,
  Eye,
  EyeOff,
  LogOut,
  ExternalLink,
  ShieldAlert,
  Search,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Building,
  UserCheck
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { hasRequiredPermissions } from "@/components/layout/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useMeQuery, useUpdateProfileMutation, useChangePasswordMutation } from "@/features/auth/hooks/use-me";
import { useOrganizationSettings } from "@/features/settings/organization/hooks/use-organization";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { cn } from "@/lib/utils/cn";

type PersonalFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
};

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type TabType = "personal" | "security" | "branches" | "permissions" | "organization";

export function ProfilePage() {
  const me = useMeQuery(true);
  const user = me.data;
  const permissions = user?.permissions ?? [];
  const canLoadOrganization = hasRequiredPermissions(permissions, "settings.read");
  const canLoadBranches = hasRequiredPermissions(permissions, "branches.read");

  const { data: organizationData } = useOrganizationSettings(canLoadOrganization);
  const { data: allBranches } = useBranches(undefined, "ACTIVE", canLoadBranches);
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const logout = useLogout();

  const updateProfile = useUpdateProfileMutation();
  const changePassword = useChangePasswordMutation();

  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [previewMode, setPreviewMode] = useState<"REAL" | "STANDARD_USER">("REAL");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [permissionFilter, setPermissionFilter] = useState("");

  const personalForm = useForm<PersonalFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: ""
    }
  });

  const passwordForm = useForm<PasswordFormValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    if (user) {
      personalForm.reset({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        phone: user.phone ?? ""
      });
    }
  }, [user, personalForm]);

  const initials = useMemo(() => {
    if (!user) return "U";
    const f = user.firstName?.[0] ?? "";
    const l = user.lastName?.[0] ?? "";
    return (f + l).toUpperCase() || "U";
  }, [user]);

  const fullName = useMemo(() => {
    if (!user) return "Usuario";
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  }, [user]);

  const resolvedOrgName = useMemo(() => {
    return user?.organization?.name || organizationData?.organizationName || "Organización Principal";
  }, [user, organizationData]);

  const assignedBranches = useMemo(() => {
    if (!user) return [];
    if (user.branches && user.branches.length > 0) {
      return user.branches;
    }
    if (allBranches && user.branchIds) {
      return allBranches
        .filter((b) => user.branchIds.includes(b.id))
        .map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code ?? null,
          isPrimary: false
        }));
    }
    return [];
  }, [user, allBranches]);

  const isRealSuperAdmin = useMemo(() => {
    return (
      Boolean(user?.roleNames?.includes("SUPER_ADMIN")) ||
      Boolean(user?.roleNames?.includes("Super Administrador")) ||
      Boolean(user?.roleNames?.includes("super_admin")) ||
      Boolean(user?.permissions?.includes("organization.manage_all"))
    );
  }, [user]);

  const isSuperAdmin = useMemo(() => {
    if (previewMode === "STANDARD_USER") return false;
    return isRealSuperAdmin;
  }, [previewMode, isRealSuperAdmin]);

  const canViewBranches = useMemo(() => {
    if (previewMode === "STANDARD_USER") return false;
    return isSuperAdmin || Boolean(user?.permissions?.includes("branches.read"));
  }, [previewMode, isSuperAdmin, user]);

  const canViewPermissions = useMemo(() => {
    if (previewMode === "STANDARD_USER") return false;
    return (
      isSuperAdmin ||
      Boolean(user?.permissions?.includes("roles.read")) ||
      Boolean(user?.permissions?.includes("permissions.read"))
    );
  }, [previewMode, isSuperAdmin, user]);

  const canViewOrganization = useMemo(() => {
    if (previewMode === "STANDARD_USER") return false;
    return (
      isSuperAdmin ||
      Boolean(user?.permissions?.includes("settings.read")) ||
      Boolean(user?.permissions?.includes("health_center.view"))
    );
  }, [previewMode, isSuperAdmin, user]);

  const displayedRoleNames = useMemo(() => {
    if (previewMode === "STANDARD_USER") return ["USUARIO_ESTANDAR"];
    return user?.roleNames ?? [];
  }, [previewMode, user]);

  const tabs: Array<{ id: TabType; label: string; icon: typeof UserRound; count?: number }> = useMemo(() => {
    const list: Array<{ id: TabType; label: string; icon: typeof UserRound; count?: number }> = [
      { id: "personal", label: "Datos Personales", icon: UserRound },
      { id: "security", label: "Seguridad y Acceso", icon: ShieldCheck }
    ];

    if (canViewBranches) {
      list.push({ id: "branches", label: "Sucursales", icon: Building2, count: assignedBranches.length });
    }

    if (canViewPermissions) {
      list.push({ id: "permissions", label: "Roles y Permisos", icon: Lock, count: user?.permissions?.length ?? 0 });
    }

    if (canViewOrganization) {
      list.push({ id: "organization", label: "Organización", icon: Building });
    }

    return list;
  }, [canViewBranches, canViewPermissions, canViewOrganization, assignedBranches.length, user?.permissions?.length]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab("personal");
    }
  }, [tabs, activeTab]);

  const categorizedPermissions = useMemo(() => {
    const permissions = user?.permissions ?? [];
    const search = permissionFilter.toLowerCase().trim();

    const groups: Record<string, { label: string; items: string[] }> = {
      agenda: { label: "Agenda y Citas", items: [] },
      patients: { label: "Pacientes y CRM", items: [] },
      clinical: { label: "Ficha Clínica y Tratamientos", items: [] },
      billing: { label: "Caja, Pagos y Facturación", items: [] },
      inventory: { label: "Inventario y Laboratorios", items: [] },
      admin: { label: "Administración y Sistema", items: [] },
      other: { label: "Otros Permisos", items: [] }
    };

    permissions.forEach((perm) => {
      if (search && !perm.toLowerCase().includes(search)) return;

      if (perm.startsWith("appointments.") || perm.startsWith("schedules.") || perm.startsWith("agenda.")) {
        groups.agenda.items.push(perm);
      } else if (perm.startsWith("patients.") || perm.startsWith("crm.") || perm.startsWith("contact_points.") || perm.startsWith("family_")) {
        groups.patients.items.push(perm);
      } else if (perm.startsWith("clinical.") || perm.startsWith("treatment_plans.") || perm.startsWith("documents.") || perm.startsWith("consents.")) {
        groups.clinical.items.push(perm);
      } else if (perm.startsWith("payments.") || perm.startsWith("cash_register.") || perm.startsWith("agreements.") || perm.startsWith("expenses.") || perm.startsWith("installments.")) {
        groups.billing.items.push(perm);
      } else if (perm.startsWith("inventory.") || perm.startsWith("labs.") || perm.startsWith("suppliers.")) {
        groups.inventory.items.push(perm);
      } else if (perm.startsWith("users.") || perm.startsWith("roles.") || perm.startsWith("branches.") || perm.startsWith("settings.") || perm.startsWith("system.")) {
        groups.admin.items.push(perm);
      } else {
        groups.other.items.push(perm);
      }
    });

    return Object.entries(groups).filter(([_, g]) => g.items.length > 0);
  }, [user?.permissions, permissionFilter]);

  const onPersonalSubmit = async (values: PersonalFormValues) => {
    await updateProfile.mutateAsync(values);
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      passwordForm.setError("confirmPassword", {
        type: "manual",
        message: "Las contraseñas no coinciden"
      });
      return;
    }
    if (values.newPassword.length < 8) {
      passwordForm.setError("newPassword", {
        type: "manual",
        message: "La contraseña debe tener al menos 8 caracteres"
      });
      return;
    }
    await changePassword.mutateAsync({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword
    });
    passwordForm.reset();
  };

  if (me.isLoading) return <LoadingState message="Cargando perfil..." />;
  if (me.isError) return <ErrorState message={me.error?.message || "Error al cargar la información del usuario"} />;
  if (!user) return <ErrorState message="No se encontró información de usuario autenticado" />;

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header with Visualizar Como Action */}
      <PageHeader
        title="Mi Perfil"
        description="Información de cuenta, credenciales de acceso, alcance clínico y permisos en Warner Suite."
        primaryAction={
          isRealSuperAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={previewMode === "STANDARD_USER" ? "primary" : "secondary"}
                size="sm"
                className={cn(
                  "text-xs gap-1.5 font-semibold transition-all",
                  previewMode === "STANDARD_USER"
                    ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm"
                    : "text-slate-700 bg-white hover:bg-slate-50 border-slate-300"
                )}
                onClick={() =>
                  setPreviewMode(previewMode === "REAL" ? "STANDARD_USER" : "REAL")
                }
              >
                {previewMode === "STANDARD_USER" ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>
                  {previewMode === "STANDARD_USER"
                    ? "Salir de Vista Previa"
                    : "Visualizar como Usuario Estándar"}
                </span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Simulation Banner */}
      {previewMode === "STANDARD_USER" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/95 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-amber-950 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="h-7 w-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Eye size={15} />
            </span>
            <div>
              <p className="font-bold text-amber-900">Modo de Simulación Activo</p>
              <p className="text-amber-800 text-[11px]">
                Estás visualizando el perfil exactamente como lo ve un usuario regular (sin privilegios de administración ni pestañas corporativas).
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100 text-amber-900 shrink-0 font-bold self-end sm:self-auto"
            onClick={() => setPreviewMode("REAL")}
          >
            Restaurar Vista Super Admin
          </Button>
        </div>
      )}

      {/* Hero Profile Banner Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-sm">
        {/* Subtle Decorative Background Layer */}
        <div className="h-28 bg-gradient-to-r from-[#042c53] via-[#0c447c] to-[#185fa5] relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute top-3 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/20">
              <Sparkles size={12} className="text-amber-300" />
              <span>Sesión Segura</span>
            </span>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3">
            {/* Avatar & Main Info */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Only the avatar floats into the header banner */}
              <div className="relative -mt-12 group shrink-0">
                <div className="h-24 w-24 rounded-2xl border-4 border-white bg-gradient-to-tr from-[#185fa5] to-[#378add] text-white flex items-center justify-center text-3xl font-bold shadow-md select-none tracking-tight">
                  {initials}
                </div>
                <span
                  className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                  title="Usuario activo"
                />
              </div>

              {/* Name & Email sit entirely on the white card */}
              <div className="pt-1 sm:pt-0 pb-0.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{fullName}</h1>
                  <Badge value="ACTIVO" tone="success" dot />
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
              </div>
            </div>

            {/* Role & Org Summary Badges */}
            <div className="flex items-center gap-2 flex-wrap sm:justify-end pb-0.5">
              {displayedRoleNames.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-800"
                >
                  <Lock size={12} className="text-blue-600" />
                  {role}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <Building2 size={12} className="text-slate-500" />
                {resolvedOrgName}
              </span>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                {canViewBranches ? "Sucursales Asignadas" : "Sede de Atención"}
              </span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                <Building2 size={13} className="text-blue-600 shrink-0" />
                <span className="truncate">
                  {canViewBranches
                    ? `${assignedBranches.length} ${assignedBranches.length === 1 ? "sede" : "sedes"}`
                    : (assignedBranches.find((b) => b.isPrimary)?.name || assignedBranches[0]?.name || "Sin sede asignada")}
                </span>
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                {canViewPermissions ? "Permisos Totales" : "Rol Principal"}
              </span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                {canViewPermissions ? (
                  <>
                    <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                    <span>{user.permissions?.length ?? 0} facultades</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={13} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{user.roleNames?.[0] || "Usuario"}</span>
                  </>
                )}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                Teléfono de Contacto
              </span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                <Phone size={13} className="text-indigo-600 shrink-0" />
                <span className="truncate">{user.phone || "No configurado"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Custom Clean Tab Navigation Bar */}
        <div className="border-t border-slate-200 bg-slate-50/60 px-6 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors transition-all",
                  isActive
                    ? "border-blue-600 text-blue-700 bg-white shadow-sm rounded-t-md font-bold"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50"
                )}
              >
                <Icon size={14} className={isActive ? "text-blue-600" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                      isActive ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Datos Personales */}
      {activeTab === "personal" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Editar Datos Personales</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mantén actualizada tu información de contacto profesional en el sistema.
              </p>
            </div>

            <form onSubmit={personalForm.handleSubmit(onPersonalSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Nombre
                  <Input
                    {...personalForm.register("firstName", { required: "El nombre es obligatorio" })}
                    placeholder="Ej. Juan"
                    className="mt-1"
                  />
                  {personalForm.formState.errors.firstName && (
                    <span className="text-[11px] text-red-500 font-normal">
                      {personalForm.formState.errors.firstName.message}
                    </span>
                  )}
                </label>

                <label className="text-xs font-bold text-slate-700 block">
                  Apellidos
                  <Input
                    {...personalForm.register("lastName", { required: "El apellido es obligatorio" })}
                    placeholder="Ej. Pérez López"
                    className="mt-1"
                  />
                  {personalForm.formState.errors.lastName && (
                    <span className="text-[11px] text-red-500 font-normal">
                      {personalForm.formState.errors.lastName.message}
                    </span>
                  )}
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Correo Electrónico
                  <div className="relative mt-1">
                    <Input
                      value={user.email}
                      disabled
                      className="bg-slate-50 text-slate-500 pr-9 cursor-not-allowed font-medium"
                    />
                    <CheckCircle2 size={15} className="absolute right-3 top-2.5 text-emerald-500" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal mt-0.5 block">
                    Correo institucional verificado (no modificable).
                  </span>
                </label>

                <label className="text-xs font-bold text-slate-700 block">
                  Teléfono de Contacto
                  <Input
                    {...personalForm.register("phone")}
                    placeholder="Ingresa tu número (ej. +52 ...)"
                    className="mt-1"
                  />
                  <span className="text-[11px] text-slate-400 font-normal mt-0.5 block">
                    Utilizado para notificaciones del sistema y seguridad.
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    personalForm.reset({
                      firstName: user.firstName,
                      lastName: user.lastName,
                      phone: user.phone ?? ""
                    })
                  }
                  disabled={updateProfile.isPending}
                >
                  Restablecer
                </Button>
                <Button type="submit" size="sm" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? "Guardando cambios..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Side Info Box */}
          <div className="space-y-4">
            <Card className="space-y-3 bg-slate-50/50 border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-600" />
                <span>Estado de la Cuenta</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Estado</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                    Activo y Verificado
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Organización</span>
                  <span className="font-semibold text-slate-800 text-right">{resolvedOrgName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Roles Activos</span>
                  <span className="font-semibold text-slate-800">{user.roleNames?.join(", ") || "Sin rol"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Sede Actual</span>
                  <span className="font-semibold text-blue-700">
                    {assignedBranches.find((b) => b.id === activeBranchId)?.name || "Sin sucursal seleccionada"}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="space-y-2.5 bg-blue-50/40 border-blue-100 text-xs text-blue-950">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <Sparkles size={14} className="text-blue-600 shrink-0" />
                <span>Identidad Profesional</span>
              </div>
              <p className="text-blue-800/90 leading-relaxed text-[11px]">
                Tu perfil y nombre completo se reflejarán automáticamente en las evoluciones clínicas, presupuestos emitidos, recibos de caja y firmas digitales autorizadas.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Seguridad y Contraseña */}
      {activeTab === "security" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Cambiar Contraseña</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Para tu seguridad, elige una contraseña robusta de al menos 8 caracteres con números y letras.
              </p>
            </div>

            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <label className="text-xs font-bold text-slate-700 block">
                Contraseña Actual
                <div className="relative mt-1">
                  <Input
                    type={showCurrentPw ? "text" : "password"}
                    {...passwordForm.register("currentPassword", { required: "Ingresa tu contraseña actual" })}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {passwordForm.formState.errors.currentPassword && (
                  <span className="text-[11px] text-red-500 font-normal">
                    {passwordForm.formState.errors.currentPassword.message}
                  </span>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Nueva Contraseña
                  <div className="relative mt-1">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      {...passwordForm.register("newPassword", {
                        required: "Ingresa la nueva contraseña",
                        minLength: { value: 8, message: "Mínimo 8 caracteres" }
                      })}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.newPassword && (
                    <span className="text-[11px] text-red-500 font-normal">
                      {passwordForm.formState.errors.newPassword.message}
                    </span>
                  )}
                </label>

                <label className="text-xs font-bold text-slate-700 block">
                  Confirmar Nueva Contraseña
                  <div className="relative mt-1">
                    <Input
                      type={showConfirmPw ? "text" : "password"}
                      {...passwordForm.register("confirmPassword", {
                        required: "Confirma tu nueva contraseña"
                      })}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.confirmPassword && (
                    <span className="text-[11px] text-red-500 font-normal">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </span>
                  )}
                </label>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                <span className="font-bold text-slate-700 block text-[11px]">Requisitos de seguridad:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-600 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-emerald-500" />
                    <span>Mínimo 8 caracteres de longitud</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-emerald-500" />
                    <span>Cifrado fuerte unidireccional (Bcrypt)</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <Button type="submit" size="sm" disabled={changePassword.isPending}>
                  {changePassword.isPending ? "Actualizando contraseña..." : "Actualizar Contraseña"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Session Security Card */}
          <div className="space-y-4">
            <Card className="space-y-4 bg-slate-50/50 border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <KeyRound size={14} className="text-indigo-600" />
                <span>Gestión de Sesión</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Sesión Actual</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-slate-500 text-[11px]">Navegador activo autenticado mediante JSON Web Token seguro.</p>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 space-y-1">
                  <span className="font-bold text-slate-800 block">Cifrado de Alta Seguridad</span>
                  <p className="text-slate-500 text-[11px]">Contraseñas con hash salteado de 12 rondas (Bcrypt).</p>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut size={13} className="mr-1.5" />
                Cerrar Sesión Actual
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Sucursales Asignadas */}
      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sucursales Asignadas</h2>
              <p className="text-xs text-slate-500">
                Tienes acceso autorizado a {assignedBranches.length} {assignedBranches.length === 1 ? "sucursal" : "sucursales"} de la red clínica.
              </p>
            </div>
          </div>

          {assignedBranches.length === 0 ? (
            <Card className="text-center py-8 text-slate-500 text-xs">
              <Building2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p>No tienes sucursales vinculadas explícitamente a tu cuenta.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignedBranches.map((branch) => {
                const isCurrentActive = branch.id === activeBranchId;
                return (
                  <Card
                    key={branch.id}
                    className={cn(
                      "relative p-4 transition-all border",
                      isCurrentActive
                        ? "border-blue-500 bg-blue-50/20 shadow-sm ring-1 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 truncate" title={branch.name}>
                            {branch.name}
                          </span>
                          {branch.isPrimary && (
                            <Badge value="Principal" tone="brand" />
                          )}
                        </div>
                        {branch.code && (
                          <p className="text-[11px] font-mono text-slate-500 mb-2">Código: {branch.code}</p>
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                        <Building2 size={16} />
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {isCurrentActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                          <CheckCircle2 size={14} className="text-blue-600" />
                          Sede Activa en Sesión
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs h-7 px-2.5"
                          onClick={() => setActiveBranchId(branch.id)}
                        >
                          Seleccionar Sede
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Roles y Permisos */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Roles y Matriz de Permisos</h2>
              <p className="text-xs text-slate-500">
                Resumen de capacidades asignadas según tus roles ({user.roleNames?.join(", ")}).
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <Input
                value={permissionFilter}
                onChange={(e) => setPermissionFilter(e.target.value)}
                placeholder="Filtrar permisos..."
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {categorizedPermissions.map(([key, group]) => (
              <Card key={key} className="space-y-3 p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Lock size={13} className="text-blue-600" />
                    <span>{group.label}</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {group.items.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {group.items.map((perm) => (
                    <span
                      key={perm}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200/80 transition-colors px-2 py-1 text-[11px] font-mono text-slate-700"
                    >
                      <Check size={11} className="text-emerald-600 shrink-0" />
                      <span>{perm}</span>
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Organización Clínica */}
      {activeTab === "organization" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Información de la Organización</h2>
              <p className="text-xs text-slate-500">
                Datos corporativos e institucionales de la entidad a la que perteneces.
              </p>
            </div>

            {user.permissions?.includes("settings.update") && (
              <Link to={APP_ROUTES.settings.organization}>
                <Button size="sm" variant="secondary" className="text-xs gap-1.5">
                  <span>Administrar Organización</span>
                  <ExternalLink size={13} />
                </Button>
              </Link>
            )}
          </div>

          <Card className="p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Nombre Comercial
                </dt>
                <dd className="text-sm font-bold text-slate-900">{resolvedOrgName}</dd>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Razón Social / Entidad Legal
                </dt>
                <dd className="text-sm font-bold text-slate-900">
                  {user.organization?.legalName || organizationData?.legalName || "No registrado"}
                </dd>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  RFC / Identificador Fiscal
                </dt>
                <dd className="text-sm font-mono font-bold text-slate-900">
                  {user.organization?.taxId || organizationData?.taxId || "No registrado"}
                </dd>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Teléfono Institucional
                </dt>
                <dd className="text-sm font-bold text-slate-900">
                  {user.organization?.phone || organizationData?.phone || "No configurado"}
                </dd>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Correo Institucional
                </dt>
                <dd className="text-sm font-bold text-slate-900 truncate">
                  {user.organization?.email || organizationData?.email || "No configurado"}
                </dd>
              </div>

              {(user.organization?.address || organizationData?.address) && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 sm:col-span-2 lg:col-span-3">
                  <dt className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                    Dirección Corporativa
                  </dt>
                  <dd className="text-xs font-medium text-slate-800">
                    {user.organization?.address || organizationData?.address}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}
