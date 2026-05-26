import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";
import { usePermissions } from "@/hooks/use-permissions";
import { useState } from "react";

type NavItem = {
  to: string;
  label: string;
  requiredPermission?: string;
  icon: React.ReactNode;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

// SVG Icon Helpers
const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
    </svg>
  ),
  agenda: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  patients: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  treatments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  budgets: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-6 2h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  payments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  cash: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 8H7m5 10H7m5 0h5m-5-10v10m-3-1v1m3-1h3m-3-3v3m0-6v3" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  generic: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
};

const navigationSections: NavSection[] = [
  {
    title: "MÃ³dulos Principales",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: icons.dashboard },
      { to: "/agenda", label: "Agenda Citas", requiredPermission: "appointments.read", icon: icons.agenda },
      { to: "/patients", label: "Pacientes", requiredPermission: "patients.read", icon: icons.patients }
    ]
  },
  {
    title: "Tratamientos y Finanzas",
    items: [
      { to: "/treatment-plans", label: "Planes ClÃ­nicos", requiredPermission: "treatment_plans.read", icon: icons.treatments },
      { to: "/budgets", label: "Presupuestos", requiredPermission: "budgets.read", icon: icons.budgets },
      { to: "/payments", label: "Registro de Pagos", requiredPermission: "payments.read", icon: icons.payments },
      { to: "/cash-register", label: "Caja de Sucursal", requiredPermission: "cash_register.read", icon: icons.cash },
      { to: "/payroll", label: "Liquidaciones", icon: icons.generic },
      { to: "/accounts-receivable", label: "Cuentas por Cobrar", requiredPermission: "accounts_receivable.read", icon: icons.generic },
      { to: "/installments", label: "Cuotas de Financiamiento", requiredPermission: "installments.read", icon: icons.generic },
      { to: "/collections", label: "GestiÃ³n de Morosidad", requiredPermission: "collections.read", icon: icons.generic }
    ]
  },
  {
    title: "Laboratorio e Inventario",
    items: [
      { to: "/labs", label: "Laboratorios", requiredPermission: "lab_providers.read", icon: icons.generic },
      { to: "/labs/orders", label: "Órdenes Laboratorio", requiredPermission: "lab_orders.read", icon: icons.generic },
      { to: "/inventory", label: "Inventario", requiredPermission: "inventory.read", icon: icons.generic },
      { to: "/inventory/movements", label: "Movimientos Stock", requiredPermission: "inventory.movements.read", icon: icons.generic }
    ]
  },
  {
    title: "Reportes",
    items: [
      { to: "/reports", label: "Centro de Reportes", requiredPermission: "reports.read", icon: icons.generic },
      { to: "/reports/appointments", label: "Reporte Agenda", requiredPermission: "reports.read", icon: icons.generic },
      { to: "/reports/patients", label: "Reporte Pacientes", requiredPermission: "reports.read", icon: icons.generic },
      { to: "/reports/treatments", label: "Reporte Tratamientos", requiredPermission: "reports.read", icon: icons.generic },
      { to: "/reports/financial", label: "Reporte Financiero", requiredPermission: "reports.read", icon: icons.generic },
      { to: "/reports/professionals", label: "Reporte Profesionales", requiredPermission: "reports.read", icon: icons.generic }
    ]
  },
  {
    title: "Configuraciones",
    items: [
      { to: "/settings/organization", label: "OrganizaciÃ³n", requiredPermission: "settings.read", icon: icons.settings },
      { to: "/settings/branches", label: "Sucursales", requiredPermission: "branches.read", icon: icons.generic },
      { to: "/settings/professionals", label: "Profesionales", requiredPermission: "professionals.read", icon: icons.generic },
      { to: "/settings/specialties", label: "Especialidades", requiredPermission: "specialties.read", icon: icons.generic },
      { to: "/settings/online-scheduling", label: "Agenda Online", requiredPermission: "schedules.read", icon: icons.generic },
      { to: "/settings/chairs", label: "Sillones ClÃ­nicos", requiredPermission: "chairs.read", icon: icons.generic },
      { to: "/settings/payment-methods", label: "MÃ©todos de Pago", requiredPermission: "payment_methods.read", icon: icons.generic },
      { to: "/settings/procedures", label: "CatÃ¡logo Procedimientos", requiredPermission: "procedures.read", icon: icons.generic },
      { to: "/settings/price-lists", label: "Listas de Precios", requiredPermission: "price_lists.read", icon: icons.generic },
      { to: "/settings/consent-templates", label: "Plantillas Consentimientos", requiredPermission: "consent_templates.read", icon: icons.generic },
      { to: "/settings/profile", label: "Mi Perfil de Usuario", icon: icons.generic },
      { to: "/settings/users", label: "Usuarios Sistema", requiredPermission: "users.read", icon: icons.generic },
      { to: "/settings/roles", label: "Roles y Permisos", requiredPermission: "roles.read", icon: icons.generic }
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    Configuraciones: true // Colapsado por defecto para evitar sobrecarga visual
  });

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  return (
    <aside className="min-h-screen w-80 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Dentalwarner Platform</p>
          <h2 className="text-base font-bold text-white tracking-tight">Consola Corporativa</h2>
        </div>
      </div>

      {/* Nav Scroll Area */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-7 custom-scrollbar">
        {navigationSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.requiredPermission || hasPermission(item.requiredPermission)
          );

          if (visibleItems.length === 0) return null;

          const isCollapsed = collapsedSections[section.title];

          return (
            <div key={section.title} className="space-y-2">
              {/* Section Divider / Title */}
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-2 py-1 hover:text-slate-300 transition"
              >
                <span>{section.title}</span>
                <svg
                  className={cn("w-3 h-3 transition-transform", isCollapsed ? "rotate-0" : "rotate-90")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Section Items */}
              {!isCollapsed && (
                <div className="space-y-1 transition-all duration-200">
                  {visibleItems.map((item) => {
                    const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150",
                          active
                            ? "bg-brand-500 text-white shadow-md shadow-brand-500/10 font-semibold scale-[1.02]"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        )}
                      >
                        <span className={cn(active ? "text-white" : "text-slate-400")}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 text-center">
        VersiÃ³n 0.1.0 (Managed SaaS)
      </div>
    </aside>
  );
}


