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
  LayoutDashboard,
  Package,
  Receipt,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UsersRound,
  WalletCards,
  Building2
} from "lucide-react";

export type MenuSection = "administration" | "configuration";

export type MenuItem = {
  to: string;
  label: string;
  permission?: string | string[];
  section?: MenuSection;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: string;
  exact?: boolean;
};

export type MainNavItem = MenuItem & {
  icon: LucideIcon;
  children?: MenuItem[];
};

export const navItems: MainNavItem[] = [
  { to: "/agenda", label: "Agenda", icon: CalendarDays, permission: "appointments.read" },
  { to: "/patients", label: "Pacientes", icon: UsersRound, permission: "patients.read" },

  { to: "/cash-register/open", label: "Cajas", icon: WalletCards, permission: "cash_register.read" },
  {
    to: "/accounts-receivable",
    label: "Cobranza",
    icon: HandCoins,
    permission: "accounts_receivable.read",
    children: [
      { to: "/accounts-receivable", label: "Cuentas por cobrar", permission: "accounts_receivable.read", icon: ReceiptText },
      { to: "/payments", label: "Pagos recibidos", permission: "payments.read", icon: DollarSign, exact: true },
      { to: "/installments", label: "Cuotas", permission: "installments.read", icon: Calculator },
      { to: "/collections", label: "Gestion de morosidad", permission: "collections.read", icon: Clock }
    ]
  },
  {
    to: "/settings/organization",
    label: "Administracion",
    icon: Settings2,
    children: [
      { to: "/settings/agreements", label: "Convenios", permission: "settings.read", section: "administration", icon: Briefcase },
      { to: "/settings/expenses", label: "Gastos", permission: "settings.read", section: "administration", icon: DollarSign },
      { to: "/settings/professionals", label: "Gestion de profesionales", permission: "professionals.read", section: "administration", icon: UserCog },
      { to: "/settings/specialties", label: "Gestion de especialidades", permission: "specialties.read", section: "administration", icon: Stethoscope },
      { to: "/inventory", label: "Inventario", permission: "inventory.read", section: "administration", icon: Package },
      { to: "/labs", label: "Laboratorios", permission: "lab_providers.read", section: "administration", icon: FlaskConical },
      { to: "/settings/payroll", label: "Nominas", permission: "settings.read", section: "administration", icon: Receipt },
      { to: "/settings/chairs", label: "Planificacion de cubiculos", permission: "chairs.read", section: "administration", icon: Armchair },
      { to: "/settings/users", label: "Usuarios", permission: "users.read", section: "administration", icon: UsersRound },
      { to: "/patients/data-quality", label: "Identidad de pacientes", permission: "patient_duplicates.review", section: "administration", icon: ShieldCheck },
      { to: "/patients/merge", label: "Fusion de fichas", permission: "patients.merge", section: "administration", icon: ClipboardList },
      { to: "/payments/tpv", label: "Pagos TPV", permission: "payments.read", section: "administration", badge: "Nuevo", icon: WalletCards },
      { to: "/settings/plans", label: "Planes y servicios", permission: "settings.read", section: "administration", icon: FileCheck },
      { to: "/settings/online-scheduling", label: "Agenda Online", permission: "schedules.read", section: "configuration", icon: CalendarDays },
      { to: "/settings/price-lists", label: "Listado de precios", permission: "price_lists.read", section: "configuration", icon: Calculator },
      { to: "/settings/banks", label: "Bancos y entidades financieras", permission: "settings.read", section: "configuration", icon: Landmark },
      { to: "/settings/clinical-documents", label: "Documentos clinicos", permission: ["clinical.read", "clinical.templates.manage"], section: "configuration", icon: FileText },
      { to: "/settings/consent-templates", label: "Consentimientos informados", permission: "consent_templates.read", section: "configuration", icon: FileCheck },
      { to: "/settings/branches", label: "Sucursales", permission: "branches.read", section: "configuration", icon: Building2 },
      { to: "/settings/logo", label: "Logotipo", permission: "settings.read", section: "configuration", icon: Image },
      { to: "/settings/payment-methods", label: "Opciones de pago", permission: "payment_methods.read", section: "configuration", icon: Receipt },
      { to: "/payments/cancelled-pending", label: "Pagos anulados y pendientes", permission: "payments.read", section: "configuration", icon: Clock }
    ]
  },
  {
    to: "/reports",
    label: "Reportes",
    icon: ChartNoAxesColumnIncreasing,
    permission: "reports.read",
    children: [
      { to: "/reports/performance", label: "Panel de desempeno", permission: "reports.read", icon: Gauge },
      { to: "/reports/excel", label: "Reportes Excel", permission: "reports.read", icon: FileSpreadsheet },
      { to: "/reports/charts", label: "Reportes graficos", permission: "reports.read", icon: BarChart3 }
    ]
  },
  { to: "/integrations", label: "CRM", icon: Handshake, permission: "integrations.communications.read" }
];

export function canSee(item: MenuItem, permissions: string[]) {
  if (permissions.includes("system.manage_all")) return true;
  const requiredPermissions = Array.isArray(item.permission) ? item.permission : item.permission ? [item.permission] : [];
  return requiredPermissions.length === 0 || requiredPermissions.every((permission) => permissions.includes(permission));
}

export function itemMatchesPath(pathname: string, item: MenuItem) {
  if (pathname === item.to) return true;
  if (item.exact || item.to === "/dashboard") return false;
  return pathname.startsWith(`${item.to}/`);
}

export function visibleNavigation(permissions: string[]) {
  return navItems
    .map((item) => ({ ...item, children: item.children?.filter((child) => canSee(child, permissions)) }))
    .filter((item) => canSee(item, permissions) || Boolean(item.children?.length));
}
