import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Clock,
  DollarSign,
  FileCheck,
  FileText,
  FileSpreadsheet,
  FlaskConical,
  Gauge,
  HandCoins,
  Handshake,
  Image,
  Landmark,
  Mail,
  Package,
  Receipt,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  WalletCards,
  Building2,
  Key
} from "lucide-react";
import { hasEffectivePermission } from "@dentalwarner/shared";
import { APP_ROUTES } from "@/lib/routes";

export type MenuSection = "administration" | "configuration";

export type MenuItem = {
  to: string;
  label: string;
  permission?: string | string[];
  permissionMode?: "all" | "any";
  section?: MenuSection;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: string;
  exact?: boolean;
};

export type PermissionMode = "all" | "any";

export type MainNavItem = MenuItem & {
  icon: LucideIcon;
  children?: MenuItem[];
};

export const navItems: MainNavItem[] = [
  { to: APP_ROUTES.agenda.root, label: "Agenda", icon: CalendarDays, permission: "agenda.view" },
  {
    to: APP_ROUTES.patients.root,
    label: "Pacientes",
    icon: UsersRound,
    permission: ["patients.records.manage", "patients.records.read_only", "patients.personal_data.view", "patients.create", "patients.read"],
    permissionMode: "any"
  },
  {
    to: APP_ROUTES.cashRegister.open,
    label: "Cajas",
    icon: WalletCards,
    permission: ["cash_register.shifts.manage", "cash_register.summaries.view"],
    permissionMode: "any"
  },
  {
    to: APP_ROUTES.payments.accountsReceivable,
    label: "Cobranza",
    icon: HandCoins,
    permission: ["collections.manage", "patient_financing.view", "payroll_financing.view", "accounts_receivable.read"],
    permissionMode: "any",
    children: [
      {
        to: APP_ROUTES.payments.accountsReceivable,
        label: "Cuentas por cobrar",
        permission: ["accounts_receivable.read", "collections.manage"],
        permissionMode: "any",
        icon: ReceiptText
      },
      {
        to: APP_ROUTES.payments.root,
        label: "Pagos recibidos",
        permission: ["payments.read", "cash_register.shifts.manage", "cash_register.summaries.view"],
        permissionMode: "any",
        icon: DollarSign,
        exact: true
      },
      {
        to: APP_ROUTES.payments.settlements,
        label: "Recepciones programadas",
        permission: ["payment_settlements.read", "dentist_payouts.manage"],
        permissionMode: "any",
        icon: Landmark
      },
      {
        to: APP_ROUTES.payments.installments,
        label: "Cuotas",
        permission: ["installments.read", "patient_financing.view"],
        permissionMode: "any",
        icon: Calculator
      },
      {
        to: APP_ROUTES.payments.collections,
        label: "Gestion de morosidad",
        permission: ["collections.manage", "collections.read"],
        permissionMode: "any",
        icon: Clock
      }
    ]
  },
  {
    to: APP_ROUTES.settings.organization,
    label: "Administracion",
    icon: Settings2,
    children: [
      {
        to: APP_ROUTES.settings.agreements,
        label: "Convenios",
        permission: ["admin.agreements.manage", "settings.read"],
        permissionMode: "any",
        section: "administration",
        icon: Briefcase
      },
      {
        to: APP_ROUTES.settings.expenses,
        label: "Gastos",
        permission: "admin.expenses.manage",
        section: "administration",
        icon: DollarSign
      },
      {
        to: APP_ROUTES.settings.specialties,
        label: "Gestion de especialidades",
        permission: "admin.specialties.manage",
        section: "administration",
        icon: Stethoscope
      },
      {
        to: APP_ROUTES.inventory.root,
        label: "Inventario",
        permission: "admin.inventory.manage",
        section: "administration",
        icon: Package
      },
      {
        to: APP_ROUTES.labs.root,
        label: "Laboratorios",
        permission: "admin.laboratories.manage",
        section: "administration",
        icon: FlaskConical
      },
      {
        to: APP_ROUTES.settings.payroll,
        label: "Nominas",
        permission: "admin.settlements.manage",
        section: "administration",
        icon: Receipt
      },
      {
        to: APP_ROUTES.settings.chairs,
        label: "Planificacion de cubiculos",
        permission: "admin.health_center.view",
        section: "administration",
        icon: Armchair
      },
      {
        to: APP_ROUTES.settings.users,
        label: "Usuarios",
        permission: ["admin.users.manage", "admin.dentists.manage", "admin.roles.manage", "admin.user_permissions.manage"],
        permissionMode: "any",
        section: "administration",
        icon: UsersRound
      },
      {
        to: APP_ROUTES.patients.dataQuality,
        label: "Identidad de pacientes",
        permission: "admin.patient_field_config.manage",
        section: "administration",
        icon: ShieldCheck
      },
      {
        to: APP_ROUTES.patients.merge,
        label: "Fusion de fichas",
        permission: "patients.merge",
        section: "administration",
        icon: ClipboardList
      },
      {
        to: APP_ROUTES.payments.tpv,
        label: "Pagos TPV",
        permission: "admin.online_tpv_dashboard.view",
        section: "administration",
        badge: "Nuevo",
        icon: WalletCards
      },
      {
        to: APP_ROUTES.settings.plans,
        label: "Planes y servicios",
        permission: "settings.read",
        section: "administration",
        icon: FileCheck
      },
      {
        to: APP_ROUTES.settings.apiKeys,
        label: "Integraciones API",
        permission: "developer_api.credentials.read",
        section: "administration",
        icon: Key
      },
      {
        to: APP_ROUTES.settings.onlineScheduling,
        label: "Agenda Online",
        permission: ["admin.dentists.manage", "admin.ges_config.manage"],
        permissionMode: "any",
        section: "configuration",
        icon: CalendarDays
      },
      {
        to: APP_ROUTES.settings.priceLists,
        label: "Listado de precios",
        permission: "admin.price_lists_templates.manage",
        section: "configuration",
        icon: Calculator
      },
      {
        to: APP_ROUTES.settings.banks,
        label: "Bancos y entidades financieras",
        permission: "admin.payment_methods_banks.manage",
        section: "configuration",
        icon: Landmark
      },
      {
        to: APP_ROUTES.settings.clinicalDocuments,
        label: "Documentos clinicos",
        permission: ["admin.clinical_docs.manage", "admin.templates_only.manage"],
        permissionMode: "any",
        section: "configuration",
        icon: FileText
      },
      {
        to: APP_ROUTES.settings.consentTemplates,
        label: "Consentimientos informados",
        permission: "admin.consent_templates.manage",
        section: "configuration",
        icon: FileCheck
      },
      {
        to: APP_ROUTES.settings.branches,
        label: "Sucursales",
        permission: "admin.health_center.view",
        section: "configuration",
        icon: Building2
      },
      {
        to: APP_ROUTES.settings.logo,
        label: "Logotipo",
        permission: "admin.logo.manage",
        section: "configuration",
        icon: Image
      },
      {
        to: APP_ROUTES.settings.paymentMethods,
        label: "Opciones de pago",
        permission: "admin.payment_methods_banks.manage",
        section: "configuration",
        icon: Receipt
      },
      {
        to: APP_ROUTES.payments.cancelledPending,
        label: "Pagos anulados y pendientes",
        permission: "admin.pending_void_payments.manage",
        section: "configuration",
        icon: Clock
      }
    ]
  },
  {
    to: APP_ROUTES.reports.root,
    label: "Reportes",
    icon: ChartNoAxesColumnIncreasing,
    permission: ["reports.management.read", "dashboard.performance.view"],
    permissionMode: "any",
    children: [
      { to: APP_ROUTES.reports.performance, label: "Panel de desempeno", permission: "dashboard.performance.view", icon: Gauge },
      { to: APP_ROUTES.reports.excel, label: "Reportes Excel", permission: "admin.reports_excel.export", icon: FileSpreadsheet },
      { to: APP_ROUTES.reports.charts, label: "Reportes graficos", permission: "reports.management.read", icon: BarChart3 }
    ]
  },
  {
    to: APP_ROUTES.crm.emailMarketing,
    label: "CRM",
    icon: Handshake,
    permission: ["crm.marketing_campaigns.manage", "crm.tasks.manage", "crm.surveys.manage"],
    permissionMode: "any",
    children: [
      {
        to: APP_ROUTES.crm.emailMarketing,
        label: "Email Marketing",
        permission: "crm.marketing_campaigns.manage",
        icon: Mail
      },
      {
        to: APP_ROUTES.crm.surveys,
        label: "Encuestas de satisfacción",
        permission: ["crm.surveys.manage", "crm.surveys.edit"],
        permissionMode: "any",
        icon: FileCheck
      },
      {
        to: APP_ROUTES.crm.tasks,
        label: "Tareas de gestión",
        permission: "crm.tasks.manage",
        icon: ClipboardList
      }
    ]
  }
];

export function hasRequiredPermissions(
  permissions: string[],
  required: string | string[] | undefined,
  mode: PermissionMode = "all"
) {
  if (permissions.includes("organization.manage_all")) return true;
  const requiredPermissions = Array.isArray(required) ? required : required ? [required] : [];
  return (
    requiredPermissions.length === 0 ||
    (mode === "any"
      ? requiredPermissions.some((permission) => hasEffectivePermission(permissions, permission))
      : requiredPermissions.every((permission) => hasEffectivePermission(permissions, permission)))
  );
}

export function canSee(item: MenuItem, permissions: string[]) {
  return hasRequiredPermissions(permissions, item.permission, item.permissionMode);
}

export function itemMatchesPath(pathname: string, item: MenuItem) {
  if (pathname === item.to) return true;
  if (item.exact || item.to === "/panel" || item.to === "/dashboard") return false;
  return pathname.startsWith(`${item.to}/`);
}

export function visibleNavigation(permissions: string[]) {
  return navItems
    .map((item) => ({ ...item, children: item.children?.filter((child) => canSee(child, permissions)) }))
    .filter((item) => item.children ? item.children.length > 0 : canSee(item, permissions));
}

export function firstAuthorizedPath(permissions: string[]) {
  const firstItem = visibleNavigation(permissions)[0];
  if (!firstItem) return APP_ROUTES.settings.profile;

  if (firstItem.permission && canSee(firstItem, permissions)) {
    return firstItem.to;
  }

  return firstItem.children?.[0]?.to ?? firstItem.to;
}
