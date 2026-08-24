import { lazy, Suspense } from "react";
import { Navigate, Outlet, createBrowserRouter, isRouteErrorResponse, useLocation, useParams, useRouteError } from "react-router-dom";
import { PublicLayout } from "@/app/layouts/public-layout";
import { PrivateLayout } from "@/app/layouts/private-layout";
import { AuthorizedHomeRedirect, RequireAnyPermission, RequireAuth, RequireGuest, RequirePermissions } from "./guards";
import { APP_ROUTES } from "@/lib/routes";

const AgendaPage = lazy(() => import("@/features/agenda/pages/agenda-page").then(m => ({ default: m.AgendaPage })));
const AgendaViewPage = lazy(() => import("@/features/agenda/pages/agenda-view-page").then(m => ({ default: m.AgendaViewPage })));
const AgendaPrintPage = lazy(() => import("@/features/agenda/pages/agenda-print-page").then(m => ({ default: m.AgendaPrintPage })));
const ReprogrammingPage = lazy(() => import("@/features/agenda/pages/reprogramming-page").then(m => ({ default: m.ReprogrammingPage })));
const LoginPage = lazy(() => import("@/features/auth/pages/login-page").then(m => ({ default: m.LoginPage })));
const ClinicalDocumentsPage = lazy(() => import("@/features/clinical/pages/clinical-documents-page").then(m => ({ default: m.ClinicalDocumentsPage })));
const ClinicalEvolutionsPage = lazy(() => import("@/features/clinical/pages/clinical-evolutions-page").then(m => ({ default: m.ClinicalEvolutionsPage })));
const ClinicalHistoryPage = lazy(() => import("@/features/clinical/pages/clinical-history-page").then(m => ({ default: m.ClinicalHistoryPage })));
const ClinicalMedicalHistoryPage = lazy(() => import("@/features/clinical/pages/clinical-medical-history-page").then(m => ({ default: m.ClinicalMedicalHistoryPage })));
const ClinicalOdontogramPage = lazy(() => import("@/features/clinical/pages/clinical-odontogram-page").then(m => ({ default: m.ClinicalOdontogramPage })));
const ClinicalPeriodontogramPage = lazy(() => import("@/features/clinical/pages/clinical-periodontogram-page").then(m => ({ default: m.ClinicalPeriodontogramPage })));
const ClinicalPrescriptionsPage = lazy(() => import("@/features/clinical/pages/clinical-prescriptions-page").then(m => ({ default: m.ClinicalPrescriptionsPage })));
const CollectionDetailPage = lazy(() => import("@/features/collections/pages/collection-detail-page").then(m => ({ default: m.CollectionDetailPage })));
const CollectionsPage = lazy(() => import("@/features/collections/pages/collections-page").then(m => ({ default: m.CollectionsPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/pages/dashboard-page").then(m => ({ default: m.DashboardPage })));
const HealthCenterPage = lazy(() => import("@/features/health-center/pages/health-center-page").then(m => ({ default: m.HealthCenterPage })));
const InventoryMovementsPage = lazy(() => import("@/features/labs-inventory/pages/inventory-movements-page").then(m => ({ default: m.InventoryMovementsPage })));
const InventoryPage = lazy(() => import("@/features/labs-inventory/pages/inventory-page").then(m => ({ default: m.InventoryPage })));
const LabOrdersPage = lazy(() => import("@/features/labs-inventory/pages/lab-orders-page").then(m => ({ default: m.LabOrdersPage })));
const LabProceduresPage = lazy(() => import("@/features/labs-inventory/pages/lab-procedures-page").then(m => ({ default: m.LabProceduresPage })));
const LabsPage = lazy(() => import("@/features/labs-inventory/pages/labs-page").then(m => ({ default: m.LabsPage })));
const IntegrationsPage = lazy(() => import("@/features/integrations/pages/integrations-page").then(m => ({ default: m.IntegrationsPage })));
const EmailMarketingPage = lazy(() => import("@/features/email-marketing/pages/email-marketing-page").then(m => ({ default: m.EmailMarketingPage })));
const SurveyManagementPage = lazy(() => import("@/features/surveys/pages/survey-management-page").then(m => ({ default: m.SurveyManagementPage })));
const PublicSurveyPage = lazy(() => import("@/features/surveys/pages/public-survey-page").then(m => ({ default: m.PublicSurveyPage })));
const ReportsAppointmentsPage = lazy(() => import("@/features/reports/pages/reports-appointments-page").then(m => ({ default: m.ReportsAppointmentsPage })));
const ReportsChartsPage = lazy(() => import("@/features/reports/pages/reports-charts-page").then(m => ({ default: m.ReportsChartsPage })));
const ReportsExcelPage = lazy(() => import("@/features/reports/pages/reports-excel-page").then(m => ({ default: m.ReportsExcelPage })));
const ReportsFinancialPage = lazy(() => import("@/features/reports/pages/reports-financial-page").then(m => ({ default: m.ReportsFinancialPage })));
const ReportsPage = lazy(() => import("@/features/reports/pages/reports-page").then(m => ({ default: m.ReportsPage })));
const ReportsPatientsPage = lazy(() => import("@/features/reports/pages/reports-patients-page").then(m => ({ default: m.ReportsPatientsPage })));
const ReportsPerformancePage = lazy(() => import("@/features/reports/pages/reports-performance-page").then(m => ({ default: m.ReportsPerformancePage })));
const ReportsProfessionalsPage = lazy(() => import("@/features/reports/pages/reports-professionals-page").then(m => ({ default: m.ReportsProfessionalsPage })));
const ReportsTreatmentsPage = lazy(() => import("@/features/reports/pages/reports-treatments-page").then(m => ({ default: m.ReportsTreatmentsPage })));
const ConsentTemplatesSettingsPage = lazy(() => import("@/features/settings/consent-templates/pages/consent-templates-settings-page").then(m => ({ default: m.ConsentTemplatesSettingsPage })));
const ProfilePage = lazy(() => import("@/features/settings/profile/pages/profile-page").then(m => ({ default: m.ProfilePage })));
const NovedadesPage = lazy(() => import("@/features/novedades").then(m => ({ default: m.NovedadesPage })));
const UsersPage = lazy(() => import("@/features/settings/users/pages/users-page").then(m => ({ default: m.UsersPage })));
const AccessUsersBlockPage = lazy(() => import("@/features/settings/users/pages/users-blocks-page").then(m => ({ default: m.AccessUsersBlockPage })));
const AgendaUsersBlockPage = lazy(() => import("@/features/settings/users/pages/users-blocks-page").then(m => ({ default: m.AgendaUsersBlockPage })));
const UsersBulkContractsPage = lazy(() => import("@/features/settings/users/pages/users-bulk-contracts-page").then(m => ({ default: m.UsersBulkContractsPage })));
const RolesPage = lazy(() => import("@/features/settings/roles/pages/roles-page").then(m => ({ default: m.RolesPage })));
const RoleDetailPage = lazy(() => import("@/features/settings/roles/pages/role-detail-page").then(m => ({ default: m.RoleDetailPage })));
const OrganizationSettingsPage = lazy(() => import("@/features/settings/organization/pages/organization-settings-page").then(m => ({ default: m.OrganizationSettingsPage })));
const OrganizationLogoSettingsPage = lazy(() => import("@/features/settings/organization/pages/organization-logo-settings-page").then(m => ({ default: m.OrganizationLogoSettingsPage })));
const BranchesSettingsPage = lazy(() => import("@/features/settings/branches/pages/branches-settings-page").then(m => ({ default: m.BranchesSettingsPage })));
const SpecialtiesSettingsPage = lazy(() => import("@/features/settings/specialties/pages/specialties-settings-page").then(m => ({ default: m.SpecialtiesSettingsPage })));
const AgendaOnlineTab = lazy(() => import("@/features/settings/online-scheduling/pages/agenda-online-tab").then(m => ({ default: m.AgendaOnlineTab })));
const AgendaExpressTab = lazy(() => import("@/features/settings/online-scheduling/pages/agenda-express-tab").then(m => ({ default: m.AgendaExpressTab })));
const OnlineSchedulesTab = lazy(() => import("@/features/settings/online-scheduling/pages/online-schedules-tab").then(m => ({ default: m.OnlineSchedulesTab })));
const CampaignsTab = lazy(() => import("@/features/settings/online-scheduling/pages/campaigns-tab").then(m => ({ default: m.CampaignsTab })));
const DashboardTab = lazy(() => import("@/features/settings/online-scheduling/pages/dashboard-tab").then(m => ({ default: m.DashboardTab })));
const ChairsSettingsPage = lazy(() => import("@/features/settings/chairs/pages/chairs-settings-page").then(m => ({ default: m.ChairsSettingsPage })));
const PaymentMethodsSettingsPage = lazy(() => import("@/features/settings/payment-methods/pages/payment-methods-settings-page").then(m => ({ default: m.PaymentMethodsSettingsPage })));
const ProceduresSettingsPage = lazy(() => import("@/features/settings/procedures/pages/procedures-settings-page").then(m => ({ default: m.ProceduresSettingsPage })));
const PriceListsSettingsPage = lazy(() => import("@/features/settings/price-lists/pages/price-lists-settings-page").then(m => ({ default: m.PriceListsSettingsPage })));
const FinancialInstitutionsSettingsPage = lazy(() => import("@/features/settings/financial-institutions/pages/financial-institutions-settings-page").then(m => ({ default: m.FinancialInstitutionsSettingsPage })));
const ClinicalDocumentTemplatesSettingsPage = lazy(() => import("@/features/settings/clinical-document-templates/pages/clinical-document-templates-settings-page").then(m => ({ default: m.ClinicalDocumentTemplatesSettingsPage })));
const AgreementsSettingsPage = lazy(() => import("@/features/settings/admin-workflows/pages/agreements-settings-page").then(m => ({ default: m.AgreementsSettingsPage })));
const ExpensesSettingsPage = lazy(() => import("@/features/settings/admin-workflows/pages/expenses-settings-page").then(m => ({ default: m.ExpensesSettingsPage })));
const PayrollSettingsPage = lazy(() => import("@/features/settings/admin-workflows/pages/payroll-settings-page").then(m => ({ default: m.PayrollSettingsPage })));
const PlansServicesSettingsPage = lazy(() => import("@/features/settings/admin-workflows/pages/plans-services-settings-page").then(m => ({ default: m.PlansServicesSettingsPage })));
const PatientClinicalPage = lazy(() => import("@/features/patients/pages/patient-clinical-page").then(m => ({ default: m.PatientClinicalPage })));
const PatientConsentsPage = lazy(() => import("@/features/patients/pages/patient-consents-page").then(m => ({ default: m.PatientConsentsPage })));
const PatientDetailPage = lazy(() => import("@/features/patients/pages/patient-detail-page").then(m => ({ default: m.PatientDetailPage })));
const PatientFilesPage = lazy(() => import("@/features/patients/pages/patient-files-page").then(m => ({ default: m.PatientFilesPage })));
const PatientNewPage = lazy(() => import("@/features/patients/pages/patient-new-page").then(m => ({ default: m.PatientNewPage })));
const PatientMergePage = lazy(() => import("@/features/patients/pages/patient-merge-page").then(m => ({ default: m.PatientMergePage })));
const PatientIdentityQualityPage = lazy(() => import("@/features/patients/pages/patient-identity-quality-page").then(m => ({ default: m.PatientIdentityQualityPage })));
const PatientPaymentsPage = lazy(() => import("@/features/patients/pages/patient-payments-page").then(m => ({ default: m.PatientPaymentsPage })));
const PatientBillingLayout = lazy(() => import("@/features/patients/pages/patient-billing-layout").then(m => ({ default: m.PatientBillingLayout })));
const PaymentsView = lazy(() => import("@/features/patients/pages/billing-views/payments-view").then(m => ({ default: m.PaymentsView })));
const IssuedDocumentsView = lazy(() => import("@/features/patients/pages/billing-views/issued-documents-view").then(m => ({ default: m.IssuedDocumentsView })));
const CoverageLayout = lazy(() => import("@/features/patients/pages/billing-views/coverages-view").then(m => ({ default: m.CoverageLayout })));
const OnlineBenefitsView = lazy(() => import("@/features/patients/pages/billing-views/coverages-view").then(m => ({ default: m.OnlineBenefitsView })));
const ReimbursementRequestsView = lazy(() => import("@/features/patients/pages/billing-views/coverages-view").then(m => ({ default: m.ReimbursementRequestsView })));
const RefundsView = lazy(() => import("@/features/patients/pages/billing-views/refunds-view").then(m => ({ default: m.RefundsView })));
const VoidedPaymentsView = lazy(() => import("@/features/patients/pages/billing-views/voided-payments-view").then(m => ({ default: m.VoidedPaymentsView })));
const PatientBalanceView = lazy(() => import("@/features/patients/pages/billing-views/patient-balance-view").then(m => ({ default: m.PatientBalanceView })));
const PatientProfilePage = lazy(() => import("@/features/patients/pages/patient-profile-page").then(m => ({ default: m.PatientProfilePage })));
const PatientTreatmentNewPage = lazy(() => import("@/features/patients/pages/patient-treatment-new-page").then(m => ({ default: m.PatientTreatmentNewPage })));
const PatientTreatmentsPage = lazy(() => import("@/features/patients/pages/patient-treatments-page").then(m => ({ default: m.PatientTreatmentsPage })));
const PatientsAnalysisPage = lazy(() => import("@/features/patients/pages/patients-analysis-page").then(m => ({ default: m.PatientsAnalysisPage })));
const PatientsConfigurationPage = lazy(() => import("@/features/patients/pages/patients-configuration-page").then(m => ({ default: m.PatientsConfigurationPage })));
const PatientsOrthodontiaPage = lazy(() => import("@/features/patients/pages/patients-orthodontia-page").then(m => ({ default: m.PatientsOrthodontiaPage })));
const PatientsPage = lazy(() => import("@/features/patients/pages/patients-page").then(m => ({ default: m.PatientsPage })));
const CrmTasksLayout = lazy(() => import("@/features/crm/tasks/components/crm-tasks-layout").then(m => ({ default: m.CrmTasksLayout })));
const CrmTasksPage = lazy(() => import("@/features/crm/tasks/pages/crm-tasks-page").then(m => ({ default: m.CrmTasksPage })));
const CrmTasksStatisticsPage = lazy(() => import("@/features/crm/tasks/pages/crm-tasks-statistics-page").then(m => ({ default: m.CrmTasksStatisticsPage })));
const CrmTasksConfigurationPage = lazy(() => import("@/features/crm/tasks/pages/crm-tasks-configuration-page").then(m => ({ default: m.CrmTasksConfigurationPage })));
const AccountsReceivablePage = lazy(() => import("@/features/payments/pages/accounts-receivable-page").then(m => ({ default: m.AccountsReceivablePage })));
const CashRegisterPage = lazy(() => import("@/features/payments/pages/cash-register-page").then(m => ({ default: m.CashRegisterPage })));
const CashRegisterDetailPage = lazy(() => import("@/features/payments/pages/cash-register-detail-page").then(m => ({ default: m.CashRegisterDetailPage })));
const InstallmentsPage = lazy(() => import("@/features/payments/pages/installments-page").then(m => ({ default: m.InstallmentsPage })));
const PaymentsPage = lazy(() => import("@/features/payments/pages/payments-page").then(m => ({ default: m.PaymentsPage })));
const PaymentLinksPage = lazy(() => import("@/features/payments/pages/payment-links-page").then(m => ({ default: m.PaymentLinksPage })));
const CancelledPendingPaymentsPage = lazy(() => import("@/features/payments/pages/cancelled-pending-payments-page").then(m => ({ default: m.CancelledPendingPaymentsPage })));
const PaymentSettlementsPage = lazy(() => import("@/features/payments/pages/payment-settlements-page").then(m => ({ default: m.PaymentSettlementsPage })));
const PaymentDailyReceiptPage = lazy(() => import("@/features/payments/pages/payment-daily-receipt-page").then(m => ({ default: m.PaymentDailyReceiptPage })));
const PaymentReceiptPage = lazy(() => import("@/features/payments/pages/payment-receipt-page").then(m => ({ default: m.PaymentReceiptPage })));
const BudgetsPage = lazy(() => import("@/features/treatments/pages/budgets-page").then(m => ({ default: m.BudgetsPage })));
const TreatmentPlansPage = lazy(() => import("@/features/treatments/pages/treatment-plans-page").then(m => ({ default: m.TreatmentPlansPage })));
const PublicBookingPage = lazy(() => import("@/features/public-booking/pages/public-booking-page").then(m => ({ default: m.PublicBookingPage })));
const ConfirmAppointmentPage = lazy(() => import("@/features/public-booking/pages/confirm-appointment-page").then(m => ({ default: m.ConfirmAppointmentPage })));
const CompletePatientProfilePage = lazy(() => import("@/features/public-booking/pages/complete-patient-profile-page").then(m => ({ default: m.CompletePatientProfilePage })));
const MobilePhotographicUploadPage = lazy(() => import("@/features/treatments/pages/mobile-photographic-upload-page").then(m => ({ default: m.MobilePhotographicUploadPage })));

function PublicShell() {
  return (
    <PublicLayout>
      <Suspense fallback={<RouteLoadingFallback />}><Outlet /></Suspense>
    </PublicLayout>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60dvh] w-full min-w-0 items-center justify-center" role="status" aria-label="Cargando módulo">
      <div className="h-8 w-8 animate-spin rounded-[var(--radius-full)] border-4 border-[var(--border-default)] border-t-[var(--text-brand)]" />
    </div>
  );
}

function PrivateShell() {
  return (
    <PrivateLayout>
      <Suspense fallback={<RouteLoadingFallback />}><Outlet /></Suspense>
    </PrivateLayout>
  );
}

function ReceiptShell() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <Suspense fallback={<RouteLoadingFallback />}><Outlet /></Suspense>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold">404</h1>
        <p className="mb-8 text-xl text-slate-600">La página que buscas no existe.</p>
        <a href="/" className="inline-flex rounded-lg bg-[var(--action-primary)] px-6 py-3 font-semibold text-white hover:bg-[var(--action-primary-hover)] transition-colors">Volver al inicio</a>
      </div>
    </div>
  );
}

function AppRouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const message = status === 404
    ? "La página solicitada no existe o cambió de ubicación."
    : "No fue posible cargar esta pantalla. Puede ser un fallo temporal de conexión o de carga del módulo.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] p-4" data-route-error>
      <section className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-danger)]">
          {status ? `Error ${status}` : "Pantalla no disponible"}
        </p>
        <h1 className="mt-2 text-[var(--text-xl)] font-semibold text-[var(--text-primary)]">No pudimos completar la carga</h1>
        <p className="mt-2 text-[var(--text-sm)] leading-6 text-[var(--text-secondary)]">{message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--action-primary)] px-4 text-[var(--text-sm)] font-semibold text-white hover:bg-[var(--action-primary-hover)]"
            onClick={() => window.location.reload()}
          >
            Reintentar carga
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 text-[var(--text-sm)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            Volver al inicio
          </a>
        </div>
      </section>
    </main>
  );
}

function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function RedirectPatientWithSearch({ to }: { to: string }) {
  const { id = "" } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/pacientes/${id}/${to}${search}`} replace />;
}

function RedirectDynamicParam({ builder }: { builder: (params: Record<string, string | undefined>, search: string) => string }) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={builder(params, search)} replace />;
}

export const router = createBrowserRouter([
  // Guest Public Routes
  {
    element: <RequireGuest />,
    errorElement: <AppRouteErrorPage />,
    children: [
      {
        element: <PublicShell />,
        children: [
          { path: "/iniciar-sesion", element: <LoginPage /> },
          // Legacy redirect
          { path: "/login", element: <RedirectWithSearch to="/iniciar-sesion" /> }
        ]
      }
    ]
  },
  // Public Tokenized Routes
  {
    element: <PublicShell />,
    errorElement: <AppRouteErrorPage />,
    children: [
      { path: "/reservar/:slug", element: <PublicBookingPage /> },
      { path: "/confirmar-cita", element: <ConfirmAppointmentPage /> },
      { path: "/completar-perfil", element: <CompletePatientProfilePage /> },
      { path: "/movil/subida-fotos/:token", element: <MobilePhotographicUploadPage /> },
      { path: "/publico/encuestas/responder/:token", element: <PublicSurveyPage /> },

      // Legacy English redirects
      { path: "/book/:slug", element: <RedirectDynamicParam builder={(p, s) => `/reservar/${p.slug ?? ""}${s}`} /> },
      { path: "/confirm-appointment", element: <RedirectWithSearch to="/confirmar-cita" /> },
      { path: "/complete-patient-profile", element: <RedirectWithSearch to="/completar-perfil" /> },
      { path: "/mobile/photographic-upload/:token", element: <RedirectDynamicParam builder={(p, s) => `/movil/subida-fotos/${p.token ?? ""}${s}`} /> },
      { path: "/public/surveys/respond/:token", element: <RedirectDynamicParam builder={(p, s) => `/publico/encuestas/responder/${p.token ?? ""}${s}`} /> }
    ]
  },
  // Authenticated Private Routes
  {
    element: <RequireAuth />,
    errorElement: <AppRouteErrorPage />,
    children: [
      // Print / Receipt Shells
      {
        element: <RequirePermissions required={["appointments.read"]} />,
        children: [
          {
            element: <ReceiptShell />,
            children: [
              { path: "/agenda/imprimir", element: <AgendaPrintPage /> },
              // Legacy redirect
              { path: "/agenda/print", element: <RedirectWithSearch to="/agenda/imprimir" /> }
            ]
          }
        ]
      },
      {
        element: <RequirePermissions required={["payments.read"]} />,
        children: [
          {
            element: <ReceiptShell />,
            children: [
              { path: "/pagos/:paymentNumber/recibo", element: <PaymentReceiptPage /> },
              { path: "/pacientes/:id/pagos/recibo-diario", element: <PaymentDailyReceiptPage /> },

              // Legacy redirects
              { path: "/payments/:paymentNumber/receipt", element: <RedirectDynamicParam builder={(p, s) => `/pagos/${p.paymentNumber ?? ""}/recibo${s}`} /> },
              { path: "/patients/:id/payments/daily-receipt", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/pagos/recibo-diario${s}`} /> }
            ]
          }
        ]
      },
      // Private Main Layout
      {
        element: <PrivateShell />,
        children: [
          { path: "/", element: <AuthorizedHomeRedirect /> },
          {
            element: <RequirePermissions required={["dashboard.read"]} />,
            children: [
              { path: "/panel", element: <DashboardPage /> },
              { path: "/dashboard", element: <RedirectWithSearch to="/panel" /> }
            ]
          },
          { path: "/configuracion/perfil", element: <ProfilePage /> },
          { path: "/settings/profile", element: <RedirectWithSearch to="/configuracion/perfil" /> },
          { path: "/perfil", element: <RedirectWithSearch to="/configuracion/perfil" /> },
          { path: "/novedades", element: <NovedadesPage /> },

          // Centro de salud
          {
            element: <RequirePermissions required={["health_center.view"]} />,
            children: [
              { path: "/centro-salud", element: <HealthCenterPage /> },
              { path: "/health-center", element: <RedirectWithSearch to="/centro-salud" /> }
            ]
          },

          // Configuración general
          {
            element: <RequirePermissions required={["settings.read"]} />,
            children: [
              { path: "/configuracion/organizacion", element: <OrganizationSettingsPage /> },
              { path: "/configuracion/logotipo", element: <OrganizationLogoSettingsPage /> },
              { path: "/configuracion/bancos", element: <FinancialInstitutionsSettingsPage /> },
              { path: "/configuracion/convenios", element: <AgreementsSettingsPage /> },
              { path: "/configuracion/gastos", element: <ExpensesSettingsPage /> },
              { path: "/configuracion/nominas", element: <PayrollSettingsPage /> },
              { path: "/configuracion/planes-servicios", element: <PlansServicesSettingsPage /> },

              // Legacy settings redirects
              { path: "/settings/organization", element: <RedirectWithSearch to="/configuracion/organizacion" /> },
              { path: "/settings/logo", element: <RedirectWithSearch to="/configuracion/logotipo" /> },
              { path: "/settings/banks", element: <RedirectWithSearch to="/configuracion/bancos" /> },
              { path: "/settings/agreements", element: <RedirectWithSearch to="/configuracion/convenios" /> },
              { path: "/settings/expenses", element: <RedirectWithSearch to="/configuracion/gastos" /> },
              { path: "/settings/payroll", element: <RedirectWithSearch to="/configuracion/nominas" /> },
              { path: "/settings/plans", element: <RedirectWithSearch to="/configuracion/planes-servicios" /> }
            ]
          },
          {
            element: <RequirePermissions required={["branches.read"]} />,
            children: [
              { path: "/configuracion/sucursales", element: <BranchesSettingsPage /> },
              { path: "/settings/branches", element: <RedirectWithSearch to="/configuracion/sucursales" /> }
            ]
          },
          {
            element: <RequireAnyPermission required={["users.read", "professionals.read"]} />,
            children: [
              { path: "/configuracion/profesionales", element: <Navigate to="/configuracion/usuarios?kind=CLINICAL" replace /> },
              { path: "/settings/professionals", element: <Navigate to="/configuracion/usuarios?kind=CLINICAL" replace /> }
            ]
          },
          {
            element: <RequirePermissions required={["specialties.read"]} />,
            children: [
              { path: "/configuracion/especialidades", element: <SpecialtiesSettingsPage /> },
              { path: "/settings/specialties", element: <RedirectWithSearch to="/configuracion/especialidades" /> }
            ]
          },
          {
            element: <RequirePermissions required={["schedules.read"]} />,
            children: [
              { path: "/configuracion/agenda-online", element: <AgendaOnlineTab /> },
              { path: "/configuracion/agenda-online/express", element: <AgendaExpressTab /> },
              { path: "/configuracion/agenda-online/horarios", element: <OnlineSchedulesTab /> },
              { path: "/configuracion/agenda-online/campanas", element: <CampaignsTab /> },
              { path: "/configuracion/agenda-online/panel", element: <DashboardTab /> },

              // Legacy scheduling redirects
              { path: "/settings/online-scheduling", element: <RedirectWithSearch to="/configuracion/agenda-online" /> },
              { path: "/settings/online-scheduling/express", element: <RedirectWithSearch to="/configuracion/agenda-online/express" /> },
              { path: "/settings/schedules", element: <RedirectWithSearch to="/configuracion/agenda-online/horarios" /> },
              { path: "/settings/online-scheduling/schedules", element: <RedirectWithSearch to="/configuracion/agenda-online/horarios" /> },
              { path: "/settings/online-scheduling/campaigns", element: <RedirectWithSearch to="/configuracion/agenda-online/campanas" /> },
              { path: "/settings/online-scheduling/dashboard", element: <RedirectWithSearch to="/configuracion/agenda-online/panel" /> }
            ]
          },
          {
            element: <RequirePermissions required={["chairs.read"]} />,
            children: [
              { path: "/configuracion/sillones", element: <ChairsSettingsPage /> },
              { path: "/settings/chairs", element: <RedirectWithSearch to="/configuracion/sillones" /> }
            ]
          },
          {
            element: <RequirePermissions required={["payment_methods.read"]} />,
            children: [
              { path: "/configuracion/medios-pago", element: <PaymentMethodsSettingsPage /> },
              { path: "/settings/payment-methods", element: <RedirectWithSearch to="/configuracion/medios-pago" /> }
            ]
          },
          {
            element: <RequirePermissions required={["procedures.read"]} />,
            children: [
              { path: "/configuracion/procedimientos", element: <ProceduresSettingsPage /> },
              { path: "/settings/procedures", element: <RedirectWithSearch to="/configuracion/procedimientos" /> }
            ]
          },
          {
            element: <RequirePermissions required={["price_lists.read"]} />,
            children: [
              { path: "/configuracion/listas-precios", element: <PriceListsSettingsPage /> },
              { path: "/configuracion/listas-precios/categorias/:categoryId", element: <PriceListsSettingsPage /> },
              { path: "/configuracion/listas-precios/categories/:categoryId", element: <RedirectDynamicParam builder={(p, s) => `${APP_ROUTES.settings.priceListCategory(p.categoryId ?? "")}${s}`} /> },

              // Legacy price-list redirects
              { path: "/settings/price-lists", element: <RedirectWithSearch to="/configuracion/listas-precios" /> },
              { path: "/settings/price-lists/categories/:categoryId", element: <RedirectDynamicParam builder={(p, s) => `/configuracion/listas-precios/categorias/${p.categoryId ?? ""}${s}`} /> }
            ]
          },
          {
            element: <RequirePermissions required={["consent_templates.read"]} />,
            children: [
              { path: "/configuracion/plantillas-consentimiento", element: <ConsentTemplatesSettingsPage /> },
              { path: "/settings/consent-templates", element: <RedirectWithSearch to="/configuracion/plantillas-consentimiento" /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read", "clinical.templates.manage"]} />,
            children: [
              { path: "/configuracion/documentos-clinicos", element: <ClinicalDocumentTemplatesSettingsPage /> },
              { path: "/settings/clinical-documents", element: <RedirectWithSearch to="/configuracion/documentos-clinicos" /> }
            ]
          },

          // Pacientes
          {
            element: <RequirePermissions required={["patient_duplicates.review"]} />,
            children: [
              { path: "/pacientes/calidad-datos", element: <PatientIdentityQualityPage /> },
              { path: "/patients/data-quality", element: <RedirectWithSearch to="/pacientes/calidad-datos" /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.merge"]} />,
            children: [
              { path: "/pacientes/fusion", element: <PatientMergePage /> },
              { path: "/patients/merge", element: <RedirectWithSearch to="/pacientes/fusion" /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read"]} />,
            children: [
              { path: "/pacientes", element: <PatientsPage /> },
              { path: "/pacientes/configuracion", element: <PatientsConfigurationPage /> },
              { path: "/pacientes/analisis", element: <PatientsAnalysisPage /> },
              { path: "/pacientes/ortodoncia", element: <PatientsOrthodontiaPage /> },
              { path: "/pacientes/nuevo", element: <PatientNewPage /> },
              { path: "/pacientes/:id", element: <PatientDetailPage /> },
              { path: "/pacientes/:id/perfil", element: <PatientProfilePage /> },
              { path: "/pacientes/:id/perfil/coberturas", element: <PatientProfilePage /> },
              { path: "/pacientes/:id/perfil/comentarios", element: <PatientProfilePage /> },
              { path: "/pacientes/:id/perfil/tareas", element: <PatientProfilePage /> },
              { path: "/pacientes/:id/perfil/correos", element: <PatientProfilePage /> },
              { path: "/pacientes/:id/tratamientos/nuevo", element: <PatientTreatmentNewPage /> },

              // Legacy redirects
              { path: "/patients", element: <RedirectWithSearch to="/pacientes" /> },
              { path: "/patients/configuration", element: <RedirectWithSearch to="/pacientes/configuracion" /> },
              { path: "/patients/analysis", element: <RedirectWithSearch to="/pacientes/analisis" /> },
              { path: "/patients/orthodontia", element: <RedirectWithSearch to="/pacientes/ortodoncia" /> },
              { path: "/patients/new", element: <RedirectWithSearch to="/pacientes/nuevo" /> },
              { path: "/patients/:id", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}${s}`} /> },
              { path: "/patients/:id/profile", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/perfil${s}`} /> },
              { path: "/patients/:id/profile/benefits-coverages", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/perfil/coberturas${s}`} /> },
              { path: "/patients/:id/profile/comments", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/perfil/comentarios${s}`} /> },
              { path: "/patients/:id/profile/tasks", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/perfil/tareas${s}`} /> },
              { path: "/patients/:id/profile/emails", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/perfil/correos${s}`} /> },
              { path: "/patients/:id/crm", element: <RedirectPatientWithSearch to="perfil/tareas" /> },
              { path: "/patients/:id/treatments/new", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/tratamientos/nuevo${s}`} /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read", "appointments.read"]} />,
            children: [
              { path: "/pacientes/:id/perfil/citas", element: <PatientProfilePage /> },
              { path: "/pacientes/:id/citas", element: <RedirectPatientWithSearch to="perfil/citas" /> },

              // Legacy
              { path: "/patients/:id/profile/appointments", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/perfil/citas${s}`} /> },
              { path: "/patients/:id/appointments", element: <RedirectPatientWithSearch to="perfil/citas" /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read", "treatment_plans.read"]} />,
            children: [
              { path: "/pacientes/:id/tratamientos", element: <PatientTreatmentsPage /> },
              { path: "/patients/:id/treatments", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/tratamientos${s}`} /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read", "payments.read"]} />,
            children: [
              {
                path: "/pacientes/:id/facturacion",
                element: <PatientBillingLayout />,
                children: [
                  { index: true, element: <Navigate to="pagos" replace /> },
                  { path: "pagos", element: <PaymentsView /> },
                  { path: "documentos", element: <IssuedDocumentsView /> },
                  { path: "cobertura", element: <Navigate to="../coberturas/reembolsos" replace /> },
                  {
                    path: "coberturas",
                    element: <CoverageLayout />,
                    children: [
                      { index: true, element: <Navigate to="reembolsos" replace /> },
                      { path: "reembolsos", element: <ReimbursementRequestsView /> },
                      { path: "beneficios-online", element: <OnlineBenefitsView /> },
                      // Legacy sub-routes
                      { path: "online-benefits", element: <Navigate to="../beneficios-online" replace /> }
                    ]
                  },
                  { path: "devoluciones", element: <RefundsView /> },
                  { path: "anulados", element: <VoidedPaymentsView /> },
                  { path: "saldo", element: <PatientBalanceView /> },

                  // Legacy nested paths inside billing
                  { path: "payments", element: <Navigate to="../pagos" replace /> },
                  { path: "documents", element: <Navigate to="../documentos" replace /> },
                  { path: "refunds", element: <Navigate to="../devoluciones" replace /> },
                  { path: "deleted", element: <Navigate to="../anulados" replace /> },
                  { path: "voided-payments", element: <Navigate to="../anulados" replace /> },
                  { path: "balance", element: <Navigate to="../saldo" replace /> }
                ]
              },
              // Legacy patient billing redirect
              { path: "/patients/:id/billing/*", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/facturacion${s}`} /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read", "payments.create"]} />,
            children: [
              { path: "/pacientes/:id/pagos", element: <PatientPaymentsPage /> },
              { path: "/patients/:id/payments", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/pagos${s}`} /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read", "files.read"]} />,
            children: [
              { path: "/pacientes/:id/clinica/archivos", element: <PatientFilesPage /> },
              { path: "/pacientes/:id/archivos", element: <RedirectPatientWithSearch to="clinica/archivos" /> },
              { path: "/patients/:id/clinical/files", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/archivos${s}`} /> },
              { path: "/patients/:id/files", element: <RedirectPatientWithSearch to="clinica/archivos" /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read", "consents.read"]} />,
            children: [
              { path: "/pacientes/:id/clinica/consentimientos", element: <PatientConsentsPage /> },
              { path: "/pacientes/:id/consentimientos", element: <RedirectPatientWithSearch to="clinica/consentimientos" /> },
              { path: "/patients/:id/clinical/consents", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/consentimientos${s}`} /> },
              { path: "/patients/:id/consents", element: <RedirectPatientWithSearch to="clinica/consentimientos" /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read"]} />,
            children: [
              { path: "/pacientes/:id/clinica", element: <PatientClinicalPage /> },
              { path: "/pacientes/:id/clinica/historia", element: <ClinicalHistoryPage /> },
              { path: "/pacientes/:id/clinica/evoluciones", element: <ClinicalEvolutionsPage /> },
              { path: "/pacientes/:id/clinica/anamnesis", element: <ClinicalMedicalHistoryPage /> },
              { path: "/pacientes/:id/clinica/recetas", element: <ClinicalPrescriptionsPage /> },
              { path: "/pacientes/:id/clinica/documentos", element: <ClinicalDocumentsPage /> },
              { path: "/pacientes/:id/clinica/odontograma", element: <ClinicalOdontogramPage /> },
              { path: "/pacientes/:id/clinica/periodontograma", element: <ClinicalPeriodontogramPage /> },

              // Legacy clinical redirects
              { path: "/patients/:id/clinical", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica${s}`} /> },
              { path: "/patients/:id/clinical/history", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/historia${s}`} /> },
              { path: "/patients/:id/clinical/evolutions", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/evoluciones${s}`} /> },
              { path: "/patients/:id/clinical/medical-history", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/anamnesis${s}`} /> },
              { path: "/patients/:id/clinical/prescriptions", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/recetas${s}`} /> },
              { path: "/patients/:id/clinical/documents", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/documentos${s}`} /> },
              { path: "/patients/:id/clinical/odontogram", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/odontograma${s}`} /> },
              { path: "/patients/:id/clinical/periodontogram", element: <RedirectDynamicParam builder={(p, s) => `/pacientes/${p.id ?? ""}/clinica/periodontograma${s}`} /> }
            ]
          },

          // Agenda
          {
            element: <RequirePermissions required={["appointments.read"]} />,
            children: [
              { path: "/agenda", element: <AgendaPage /> },
              { path: "/agenda/lista", element: <AgendaViewPage view="list" /> },
              { path: "/agenda/dia", element: <AgendaViewPage view="day" /> },
              { path: "/agenda/semana", element: <AgendaViewPage view="week" /> },
              { path: "/agenda/mes", element: <AgendaViewPage view="month" /> },
              { path: "/agenda/reprogramacion", element: <ReprogrammingPage /> },

              // Legacy agenda redirects
              { path: "/agenda/list", element: <RedirectWithSearch to="/agenda/lista" /> },
              { path: "/agenda/day", element: <RedirectWithSearch to="/agenda/dia" /> },
              { path: "/agenda/week", element: <RedirectWithSearch to="/agenda/semana" /> },
              { path: "/agenda/month", element: <RedirectWithSearch to="/agenda/mes" /> },
              { path: "/agenda/waiting-room", element: <Navigate to="/agenda/reprogramacion" replace /> },
              { path: "/agenda/reprogramming", element: <RedirectWithSearch to="/agenda/reprogramacion" /> }
            ]
          },

          // Tratamientos y Presupuestos
          {
            element: <RequirePermissions required={["treatment_plans.read"]} />,
            children: [
              { path: "/planes-tratamiento", element: <TreatmentPlansPage /> },
              { path: "/treatment-plans", element: <RedirectWithSearch to="/planes-tratamiento" /> }
            ]
          },
          {
            element: <RequirePermissions required={["budgets.read"]} />,
            children: [
              { path: "/presupuestos", element: <BudgetsPage /> },
              { path: "/budgets", element: <RedirectWithSearch to="/presupuestos" /> }
            ]
          },

          // Pagos
          {
            element: <RequirePermissions required={["payments.read"]} />,
            children: [
              { path: "/pagos", element: <PaymentsPage /> },
              { path: "/pagos/tpv", element: <PaymentLinksPage /> },
              { path: "/pagos/anulados-pendientes", element: <CancelledPendingPaymentsPage /> },

              // Legacy
              { path: "/payments", element: <RedirectWithSearch to="/pagos" /> },
              { path: "/payments/tpv", element: <RedirectWithSearch to="/pagos/tpv" /> },
              { path: "/payments/cancelled-pending", element: <RedirectWithSearch to="/pagos/anulados-pendientes" /> }
            ]
          },
          {
            element: <RequirePermissions required={["payment_settlements.read"]} />,
            children: [
              { path: "/liquidaciones-pagos", element: <PaymentSettlementsPage /> },
              { path: "/payment-settlements", element: <RedirectWithSearch to="/liquidaciones-pagos" /> }
            ]
          },

          // Cajas
          {
            element: <RequirePermissions required={["cash_register.read"]} />,
            children: [
              { path: "/cajas", element: <Navigate to="/cajas/abiertas" replace /> },
              { path: "/cajas/abiertas", element: <CashRegisterPage /> },
              { path: "/cajas/cerradas", element: <CashRegisterPage /> },
              { path: "/cajas/reportes", element: <CashRegisterPage /> },
              { path: "/cajas/buscar", element: <CashRegisterPage /> },
              { path: "/cajas/:registerNumber", element: <CashRegisterDetailPage /> },

              // Legacy cash-register redirects
              { path: "/cash-register", element: <Navigate to="/cajas/abiertas" replace /> },
              { path: "/cash-register/open", element: <RedirectWithSearch to="/cajas/abiertas" /> },
              { path: "/cash-register/closed", element: <RedirectWithSearch to="/cajas/cerradas" /> },
              { path: "/cash-register/reports", element: <RedirectWithSearch to="/cajas/reportes" /> },
              { path: "/cash-register/search", element: <RedirectWithSearch to="/cajas/buscar" /> },
              { path: "/cash-register/:registerNumber", element: <RedirectDynamicParam builder={(p, s) => `/cajas/${p.registerNumber ?? ""}${s}`} /> }
            ]
          },

          { path: "/payroll", element: <RedirectWithSearch to="/configuracion/nominas" /> },

          // Cobranzas y Cuentas por cobrar
          {
            element: <RequirePermissions required={["accounts_receivable.read"]} />,
            children: [
              { path: "/cuentas-por-cobrar", element: <AccountsReceivablePage /> },
              { path: "/accounts-receivable", element: <RedirectWithSearch to="/cuentas-por-cobrar" /> }
            ]
          },
          {
            element: <RequirePermissions required={["installments.read"]} />,
            children: [
              { path: "/cuotas", element: <InstallmentsPage /> },
              { path: "/installments", element: <RedirectWithSearch to="/cuotas" /> }
            ]
          },
          {
            element: <RequirePermissions required={["collections.read"]} />,
            children: [
              { path: "/morosidad", element: <CollectionsPage /> },
              { path: "/morosidad/:id", element: <CollectionDetailPage /> },

              // Legacy
              { path: "/collections", element: <RedirectWithSearch to="/morosidad" /> },
              { path: "/collections/:id", element: <RedirectDynamicParam builder={(p, s) => `/morosidad/${p.id ?? ""}${s}`} /> }
            ]
          },

          // Laboratorios e Inventario
          {
            element: <RequirePermissions required={["lab_providers.read"]} />,
            children: [
              { path: "/laboratorios", element: <LabsPage /> },
              { path: "/laboratorios/habilitados", element: <LabsPage enabledOnly /> },
              { path: "/labs", element: <RedirectWithSearch to="/laboratorios" /> },
              { path: "/labs/enabled", element: <RedirectWithSearch to="/laboratorios/habilitados" /> }
            ]
          },
          {
            element: <RequirePermissions required={["procedures.read", "price_lists.read"]} />,
            children: [
              { path: "/laboratorios/procedimientos", element: <LabProceduresPage /> },
              { path: "/labs/procedures", element: <RedirectWithSearch to="/laboratorios/procedimientos" /> }
            ]
          },
          {
            element: <RequirePermissions required={["lab_orders.read"]} />,
            children: [
              { path: "/laboratorios/ordenes", element: <LabOrdersPage /> },
              { path: "/labs/orders", element: <RedirectWithSearch to="/laboratorios/ordenes" /> }
            ]
          },
          {
            element: <RequirePermissions required={["inventory.read"]} />,
            children: [
              { path: "/inventario", element: <InventoryPage /> },
              { path: "/inventory", element: <RedirectWithSearch to="/inventario" /> }
            ]
          },
          {
            element: <RequirePermissions required={["inventory.movements.read"]} />,
            children: [
              { path: "/inventario/movimientos", element: <InventoryMovementsPage /> },
              { path: "/inventory/movements", element: <RedirectWithSearch to="/inventario/movimientos" /> }
            ]
          },

          // Reportes
          {
            element: <RequirePermissions required={["reports.read"]} />,
            children: [
              { path: "/reportes", element: <ReportsPage /> },
              { path: "/reportes/desempeno", element: <ReportsPerformancePage /> },
              { path: "/reportes/excel", element: <ReportsExcelPage /> },
              { path: "/reportes/graficos", element: <ReportsChartsPage /> },
              { path: "/reportes/citas", element: <ReportsAppointmentsPage /> },
              { path: "/reportes/pacientes", element: <ReportsPatientsPage /> },
              { path: "/reportes/tratamientos", element: <ReportsTreatmentsPage /> },
              { path: "/reportes/financiero", element: <ReportsFinancialPage /> },
              { path: "/reportes/profesionales", element: <ReportsProfessionalsPage /> },

              // Legacy reports
              { path: "/reports", element: <RedirectWithSearch to="/reportes" /> },
              { path: "/reports/performance", element: <RedirectWithSearch to="/reportes/desempeno" /> },
              { path: "/reports/excel", element: <RedirectWithSearch to="/reportes/excel" /> },
              { path: "/reports/charts", element: <RedirectWithSearch to="/reportes/graficos" /> },
              { path: "/reports/appointments", element: <RedirectWithSearch to="/reportes/citas" /> },
              { path: "/reports/patients", element: <RedirectWithSearch to="/reportes/pacientes" /> },
              { path: "/reports/treatments", element: <RedirectWithSearch to="/reportes/tratamientos" /> },
              { path: "/reports/financial", element: <RedirectWithSearch to="/reportes/financiero" /> },
              { path: "/reports/professionals", element: <RedirectWithSearch to="/reportes/profesionales" /> }
            ]
          },

          // CRM
          {
            element: <RequirePermissions required={["integrations.surveys.read"]} />,
            children: [
              { path: "/crm/encuestas", element: <Navigate to="/crm/encuestas/lista" replace /> },
              { path: "/crm/encuestas/lista", element: <SurveyManagementPage /> },
              { path: "/crm/encuestas/:surveyId/editar", element: <SurveyManagementPage /> },
              { path: "/crm/encuestas/configuracion-envio", element: <SurveyManagementPage /> },
              { path: "/crm/encuestas/resultados", element: <SurveyManagementPage /> },

              // Legacy
              { path: "/crm/surveys", element: <Navigate to="/crm/encuestas/lista" replace /> },
              { path: "/crm/surveys/list", element: <RedirectWithSearch to="/crm/encuestas/lista" /> },
              { path: "/crm/surveys/:surveyId/edit", element: <RedirectDynamicParam builder={(p, s) => `/crm/encuestas/${p.surveyId ?? ""}/editar${s}`} /> },
              { path: "/crm/surveys/send-config", element: <RedirectWithSearch to="/crm/encuestas/configuracion-envio" /> },
              { path: "/crm/surveys/results", element: <RedirectWithSearch to="/crm/encuestas/resultados" /> }
            ]
          },
          {
            element: <RequirePermissions required={["integrations.communications.read"]} />,
            children: [
              { path: "/integraciones", element: <IntegrationsPage /> },
              { path: "/integrations", element: <RedirectWithSearch to="/integraciones" /> },
              {
                path: "/crm/email-marketing",
                element: <Navigate to="/crm/email-marketing/reportes" replace />
              },
              { path: "/crm/email-marketing/reportes", element: <EmailMarketingPage /> },
              { path: "/crm/email-marketing/reportes/:reportCode", element: <EmailMarketingPage /> },
              {
                path: "/crm/email-marketing/reportes/:reportCode/campana",
                element: <EmailMarketingPage />
              },
              { path: "/crm/email-marketing/campanas", element: <EmailMarketingPage /> },
              { path: "/crm/email-marketing/plantillas", element: <EmailMarketingPage /> },
              { path: "/crm/email-marketing/configuracion", element: <EmailMarketingPage /> },

              // Legacy
              { path: "/crm/email-marketing/reports", element: <RedirectWithSearch to="/crm/email-marketing/reportes" /> },
              { path: "/crm/email-marketing/reports/:reportCode", element: <RedirectDynamicParam builder={(p, s) => `/crm/email-marketing/reportes/${p.reportCode ?? ""}${s}`} /> },
              { path: "/crm/email-marketing/reports/:reportCode/campaign", element: <RedirectDynamicParam builder={(p, s) => `/crm/email-marketing/reportes/${p.reportCode ?? ""}/campana${s}`} /> },
              { path: "/crm/email-marketing/campaigns", element: <RedirectWithSearch to="/crm/email-marketing/campanas" /> },
              { path: "/crm/email-marketing/templates", element: <RedirectWithSearch to="/crm/email-marketing/plantillas" /> },
              { path: "/crm/email-marketing/settings", element: <RedirectWithSearch to="/crm/email-marketing/configuracion" /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.tasks.read"]} />,
            children: [
              {
                path: "/crm/tareas",
                element: <CrmTasksLayout />,
                children: [
                  { index: true, element: <CrmTasksPage /> },
                  { path: "estadisticas", element: <CrmTasksStatisticsPage /> },
                  { path: "configuracion", element: <CrmTasksConfigurationPage /> },
                  // Legacy sub-routes
                  { path: "statistics", element: <Navigate to="../estadisticas" replace /> },
                  { path: "configuration", element: <Navigate to="../configuracion" replace /> }
                ]
              },
              // Legacy CRM tasks redirect
              { path: "/crm/tasks/*", element: <RedirectWithSearch to="/crm/tareas" /> }
            ]
          },

          // Usuarios y Roles en Configuración
          {
            element: <RequireAnyPermission required={["users.read", "professionals.read"]} />,
            children: [
              { path: "/configuracion/usuarios", element: <UsersPage /> },
              { path: "/settings/users", element: <RedirectWithSearch to="/configuracion/usuarios" /> }
            ]
          },
          {
            element: <RequirePermissions required={["users.update"]} />,
            children: [
              { path: "/configuracion/usuarios/bloqueos/acceso", element: <AccessUsersBlockPage /> },
              { path: "/settings/users/blocks/access", element: <RedirectWithSearch to="/configuracion/usuarios/bloqueos/acceso" /> }
            ]
          },
          {
            element: <RequirePermissions required={["appointments.create", "professionals.read"]} />,
            children: [
              { path: "/configuracion/usuarios/bloqueos/agenda", element: <AgendaUsersBlockPage /> },
              { path: "/settings/users/blocks/agenda", element: <RedirectWithSearch to="/configuracion/usuarios/bloqueos/agenda" /> }
            ]
          },
          {
            element: <RequirePermissions required={["professionals.read", "professionals.update"]} />,
            children: [
              { path: "/configuracion/usuarios/contratos/masivos", element: <UsersBulkContractsPage /> },
              { path: "/settings/users/contracts/bulk", element: <RedirectWithSearch to="/configuracion/usuarios/contratos/masivos" /> }
            ]
          },
          {
            element: <RequirePermissions required={["roles.read"]} />,
            children: [
              { path: "/configuracion/roles", element: <RolesPage /> },
              { path: "/configuracion/usuarios/perfiles", element: <RolesPage /> },
              { path: "/configuracion/roles/:id", element: <RoleDetailPage /> },

              // Legacy
              { path: "/settings/roles", element: <RedirectWithSearch to="/configuracion/roles" /> },
              { path: "/settings/users/profiles", element: <RedirectWithSearch to="/configuracion/usuarios/perfiles" /> },
              { path: "/settings/roles/:id", element: <RedirectDynamicParam builder={(p, s) => `/configuracion/roles/${p.id ?? ""}${s}`} /> }
            ]
          }
        ]
      }
    ]
  },
  { path: "*", element: <NotFoundPage />, errorElement: <AppRouteErrorPage /> }
]);
