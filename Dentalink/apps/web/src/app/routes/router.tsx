import { Navigate, Outlet, createBrowserRouter, useLocation, useParams } from "react-router-dom";
import { PublicLayout } from "@/app/layouts/public-layout";
import { PrivateLayout } from "@/app/layouts/private-layout";
import { RequireAuth, RequireGuest, RequirePermissions } from "./guards";
import { AgendaPage } from "@/features/agenda/pages/agenda-page";
import { AgendaViewPage } from "@/features/agenda/pages/agenda-view-page";
import { WaitingRoomPage } from "@/features/agenda/pages/waiting-room-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterOrganizationPage } from "@/features/auth/pages/register-organization-page";
import { ClinicalDocumentsPage } from "@/features/clinical/pages/clinical-documents-page";
import { ClinicalEvolutionsPage } from "@/features/clinical/pages/clinical-evolutions-page";
import { ClinicalHistoryPage } from "@/features/clinical/pages/clinical-history-page";
import { ClinicalMedicalHistoryPage } from "@/features/clinical/pages/clinical-medical-history-page";
import { ClinicalOdontogramPage } from "@/features/clinical/pages/clinical-odontogram-page";
import { ClinicalPeriodontogramPage } from "@/features/clinical/pages/clinical-periodontogram-page";
import { ClinicalPrescriptionsPage } from "@/features/clinical/pages/clinical-prescriptions-page";
import { CollectionDetailPage } from "@/features/collections/pages/collection-detail-page";
import { CollectionsPage } from "@/features/collections/pages/collections-page";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";
import { InventoryMovementsPage } from "@/features/labs-inventory/pages/inventory-movements-page";
import { InventoryPage } from "@/features/labs-inventory/pages/inventory-page";
import { LabOrdersPage } from "@/features/labs-inventory/pages/lab-orders-page";
import { LabProceduresPage } from "@/features/labs-inventory/pages/lab-procedures-page";
import { LabsPage } from "@/features/labs-inventory/pages/labs-page";
import { ReportsAppointmentsPage } from "@/features/reports/pages/reports-appointments-page";
import { ReportsFinancialPage } from "@/features/reports/pages/reports-financial-page";
import { ReportsPage } from "@/features/reports/pages/reports-page";
import { ReportsPatientsPage } from "@/features/reports/pages/reports-patients-page";
import { ReportsProfessionalsPage } from "@/features/reports/pages/reports-professionals-page";
import { ReportsTreatmentsPage } from "@/features/reports/pages/reports-treatments-page";
import { ConsentTemplatesSettingsPage } from "@/features/settings/consent-templates/pages/consent-templates-settings-page";
import { ProfilePage } from "@/features/settings/profile/pages/profile-page";
import { UsersPage } from "@/features/settings/users/pages/users-page";
import { AccessUsersBlockPage, AgendaUsersBlockPage } from "@/features/settings/users/pages/users-blocks-page";
import { UsersBulkContractsPage } from "@/features/settings/users/pages/users-bulk-contracts-page";
import { RolesPage } from "@/features/settings/roles/pages/roles-page";
import { RoleDetailPage } from "@/features/settings/roles/pages/role-detail-page";
import { OrganizationSettingsPage } from "@/features/settings/organization/pages/organization-settings-page";
import { OrganizationLogoSettingsPage } from "@/features/settings/organization/pages/organization-logo-settings-page";
import { BranchesSettingsPage } from "@/features/settings/branches/pages/branches-settings-page";
import { ProfessionalsSettingsPage } from "@/features/settings/professionals/pages/professionals-settings-page";
import { SpecialtiesSettingsPage } from "@/features/settings/specialties/pages/specialties-settings-page";
import { AgendaOnlineTab } from "@/features/settings/online-scheduling/pages/agenda-online-tab";
import { AgendaExpressTab } from "@/features/settings/online-scheduling/pages/agenda-express-tab";
import { OnlineSchedulesTab } from "@/features/settings/online-scheduling/pages/online-schedules-tab";
import { CampaignsTab } from "@/features/settings/online-scheduling/pages/campaigns-tab";
import { DashboardTab } from "@/features/settings/online-scheduling/pages/dashboard-tab";
import { ChairsSettingsPage } from "@/features/settings/chairs/pages/chairs-settings-page";
import { PaymentMethodsSettingsPage } from "@/features/settings/payment-methods/pages/payment-methods-settings-page";
import { ProceduresSettingsPage } from "@/features/settings/procedures/pages/procedures-settings-page";
import { PriceListsSettingsPage } from "@/features/settings/price-lists/pages/price-lists-settings-page";
import { FinancialInstitutionsSettingsPage } from "@/features/settings/financial-institutions/pages/financial-institutions-settings-page";
import { ClinicalDocumentTemplatesSettingsPage } from "@/features/settings/clinical-document-templates/pages/clinical-document-templates-settings-page";
import { AgreementsSettingsPage } from "@/features/settings/admin-workflows/pages/agreements-settings-page";
import { ExpensesSettingsPage } from "@/features/settings/admin-workflows/pages/expenses-settings-page";
import { PayrollSettingsPage } from "@/features/settings/admin-workflows/pages/payroll-settings-page";
import { PlansServicesSettingsPage } from "@/features/settings/admin-workflows/pages/plans-services-settings-page";
import { PatientClinicalPage } from "@/features/patients/pages/patient-clinical-page";
import { PatientConsentsPage } from "@/features/patients/pages/patient-consents-page";
import { PatientDetailPage } from "@/features/patients/pages/patient-detail-page";
import { PatientFilesPage } from "@/features/patients/pages/patient-files-page";
import { PatientNewPage } from "@/features/patients/pages/patient-new-page";
import { PatientMergePage } from "@/features/patients/pages/patient-merge-page";
import { PatientPaymentsPage } from "@/features/patients/pages/patient-payments-page";
import { PatientBillingPage } from "@/features/patients/pages/patient-billing-page";
import { PatientProfilePage } from "@/features/patients/pages/patient-profile-page";
import { PatientTreatmentNewPage } from "@/features/patients/pages/patient-treatment-new-page";
import { PatientTreatmentsPage } from "@/features/patients/pages/patient-treatments-page";
import { PatientsAnalysisPage } from "@/features/patients/pages/patients-analysis-page";
import { PatientsConfigurationPage } from "@/features/patients/pages/patients-configuration-page";
import { PatientsOrthodontiaPage } from "@/features/patients/pages/patients-orthodontia-page";
import { PatientsPage } from "@/features/patients/pages/patients-page";
import { AccountsReceivablePage } from "@/features/payments/pages/accounts-receivable-page";
import { CashRegisterPage } from "@/features/payments/pages/cash-register-page";
import { InstallmentsPage } from "@/features/payments/pages/installments-page";
import { PaymentsPage } from "@/features/payments/pages/payments-page";
import { PaymentLinksPage } from "@/features/payments/pages/payment-links-page";
import { CancelledPendingPaymentsPage } from "@/features/payments/pages/cancelled-pending-payments-page";
import { BudgetsPage } from "@/features/treatments/pages/budgets-page";
import { TreatmentPlansPage } from "@/features/treatments/pages/treatment-plans-page";
import { PublicBookingPage } from "@/features/public-booking/pages/public-booking-page";

function PublicShell() {
  return (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  );
}

function PrivateShell() {
  return (
    <PrivateLayout>
      <Outlet />
    </PrivateLayout>
  );
}

function NotFoundPage() {
  return <Navigate to="/agenda/list" replace />;
}

function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function RedirectPatientWithSearch({ to }: { to: string }) {
  const { id = "" } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/patients/${id}/${to}${search}`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      {
        element: <PublicShell />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register-organization", element: <RegisterOrganizationPage /> }
        ]
      }
    ]
  },
  {
    element: <PublicShell />,
    children: [
      { path: "/book/:slug", element: <PublicBookingPage /> }
    ]
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <PrivateShell />,
        children: [
          { path: "/", element: <Navigate to="/agenda/list" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/settings/profile", element: <ProfilePage /> },

          {
            element: <RequirePermissions required={["settings.read"]} />,
            children: [
              { path: "/settings/organization", element: <OrganizationSettingsPage /> },
              { path: "/settings/logo", element: <OrganizationLogoSettingsPage /> },
              { path: "/settings/banks", element: <FinancialInstitutionsSettingsPage /> },
              { path: "/settings/agreements", element: <AgreementsSettingsPage /> },
              { path: "/settings/expenses", element: <ExpensesSettingsPage /> },
              { path: "/settings/payroll", element: <PayrollSettingsPage /> },
              { path: "/settings/plans", element: <PlansServicesSettingsPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["branches.read"]} />,
            children: [{ path: "/settings/branches", element: <BranchesSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["professionals.read"]} />,
            children: [{ path: "/settings/professionals", element: <ProfessionalsSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["specialties.read"]} />,
            children: [{ path: "/settings/specialties", element: <SpecialtiesSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["schedules.read"]} />,
            children: [
              { path: "/settings/online-scheduling", element: <AgendaOnlineTab /> },
              { path: "/settings/online-scheduling/express", element: <AgendaExpressTab /> },
              { path: "/settings/schedules", element: <RedirectWithSearch to="/settings/online-scheduling/schedules" /> },
              { path: "/settings/online-scheduling/schedules", element: <OnlineSchedulesTab /> },
              { path: "/settings/online-scheduling/campaigns", element: <CampaignsTab /> },
              { path: "/settings/online-scheduling/dashboard", element: <DashboardTab /> },
            ]
          },
          {
            element: <RequirePermissions required={["chairs.read"]} />,
            children: [{ path: "/settings/chairs", element: <ChairsSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["payment_methods.read"]} />,
            children: [{ path: "/settings/payment-methods", element: <PaymentMethodsSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["procedures.read"]} />,
            children: [{ path: "/settings/procedures", element: <ProceduresSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["price_lists.read"]} />,
            children: [{ path: "/settings/price-lists", element: <PriceListsSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["consent_templates.read"]} />,
            children: [{ path: "/settings/consent-templates", element: <ConsentTemplatesSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["clinical.read", "clinical.templates.manage"]} />,
            children: [{ path: "/settings/clinical-documents", element: <ClinicalDocumentTemplatesSettingsPage /> }]
          },
          {
            element: <RequirePermissions required={["patients.read"]} />,
            children: [
              { path: "/patients", element: <PatientsPage /> },
              { path: "/patients/configuration", element: <PatientsConfigurationPage /> },
              { path: "/patients/analysis", element: <PatientsAnalysisPage /> },
              { path: "/patients/orthodontia", element: <PatientsOrthodontiaPage /> },
              { path: "/patients/new", element: <PatientNewPage /> },
              { path: "/patients/merge", element: <PatientMergePage /> },
              { path: "/patients/:id", element: <PatientDetailPage /> },
              { path: "/patients/:id/profile", element: <PatientProfilePage /> },
              { path: "/patients/:id/profile/comments", element: <PatientProfilePage /> },
              { path: "/patients/:id/profile/tasks", element: <PatientProfilePage /> },
              { path: "/patients/:id/profile/emails", element: <PatientProfilePage /> },
              { path: "/patients/:id/crm", element: <RedirectPatientWithSearch to="profile/tasks" /> },
              { path: "/patients/:id/treatments/new", element: <PatientTreatmentNewPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read", "appointments.read"]} />,
            children: [
              { path: "/patients/:id/profile/appointments", element: <PatientProfilePage /> },
              { path: "/patients/:id/appointments", element: <RedirectPatientWithSearch to="profile/appointments" /> }
            ]
          },
          {
            element: <RequirePermissions required={["patients.read", "treatment_plans.read"]} />,
            children: [{ path: "/patients/:id/treatments", element: <PatientTreatmentsPage /> }]
          },
          {
            element: <RequirePermissions required={["patients.read", "payments.read"]} />,
            children: [
              { path: "/patients/:id/billing", element: <PatientBillingPage /> },
              { path: "/patients/:id/billing/documents", element: <PatientBillingPage /> },
              { path: "/patients/:id/billing/coverage", element: <PatientBillingPage /> },
              { path: "/patients/:id/billing/refunds", element: <PatientBillingPage /> },
              { path: "/patients/:id/billing/deleted", element: <PatientBillingPage /> },
              { path: "/patients/:id/billing/balance", element: <PatientBillingPage /> },
              { path: "/patients/:id/payments", element: <PatientPaymentsPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read", "files.read"]} />,
            children: [
              { path: "/patients/:id/clinical/files", element: <PatientFilesPage /> },
              { path: "/patients/:id/files", element: <RedirectPatientWithSearch to="clinical/files" /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read", "consents.read"]} />,
            children: [
              { path: "/patients/:id/clinical/consents", element: <PatientConsentsPage /> },
              { path: "/patients/:id/consents", element: <RedirectPatientWithSearch to="clinical/consents" /> }
            ]
          },
          {
            element: <RequirePermissions required={["clinical.read"]} />,
            children: [
              { path: "/patients/:id/clinical", element: <PatientClinicalPage /> },
              { path: "/patients/:id/clinical/history", element: <ClinicalHistoryPage /> },
              { path: "/patients/:id/clinical/evolutions", element: <ClinicalEvolutionsPage /> },
              { path: "/patients/:id/clinical/medical-history", element: <ClinicalMedicalHistoryPage /> },
              { path: "/patients/:id/clinical/prescriptions", element: <ClinicalPrescriptionsPage /> },
              { path: "/patients/:id/clinical/documents", element: <ClinicalDocumentsPage /> },
              { path: "/patients/:id/clinical/odontogram", element: <ClinicalOdontogramPage /> },
              { path: "/patients/:id/clinical/periodontogram", element: <ClinicalPeriodontogramPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["appointments.read"]} />,
            children: [
              { path: "/agenda", element: <AgendaPage /> },
              { path: "/agenda/list", element: <AgendaViewPage view="list" /> },
              { path: "/agenda/day", element: <AgendaViewPage view="day" /> },
              { path: "/agenda/week", element: <AgendaViewPage view="week" /> },
              { path: "/agenda/month", element: <AgendaViewPage view="month" /> },
              { path: "/agenda/waiting-room", element: <WaitingRoomPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["treatment_plans.read"]} />,
            children: [{ path: "/treatment-plans", element: <TreatmentPlansPage /> }]
          },
          {
            element: <RequirePermissions required={["budgets.read"]} />,
            children: [{ path: "/budgets", element: <BudgetsPage /> }]
          },
          {
            element: <RequirePermissions required={["payments.read"]} />,
            children: [
              { path: "/payments", element: <PaymentsPage /> },
              { path: "/payments/tpv", element: <PaymentLinksPage /> },
              { path: "/payments/cancelled-pending", element: <CancelledPendingPaymentsPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["cash_register.read"]} />,
            children: [
              { path: "/cash-register", element: <Navigate to="/cash-register/open" replace /> },
              { path: "/cash-register/open", element: <CashRegisterPage /> },
              { path: "/cash-register/closed", element: <CashRegisterPage /> },
              { path: "/cash-register/reports", element: <CashRegisterPage /> },
              { path: "/cash-register/search", element: <CashRegisterPage /> }
            ]
          },
          { path: "/payroll", element: <RedirectWithSearch to="/settings/payroll" /> },
          {
            element: <RequirePermissions required={["accounts_receivable.read"]} />,
            children: [{ path: "/accounts-receivable", element: <AccountsReceivablePage /> }]
          },
          {
            element: <RequirePermissions required={["installments.read"]} />,
            children: [{ path: "/installments", element: <InstallmentsPage /> }]
          },
          {
            element: <RequirePermissions required={["collections.read"]} />,
            children: [
              { path: "/collections", element: <CollectionsPage /> },
              { path: "/collections/:id", element: <CollectionDetailPage /> }
            ]
          },
          {
            element: <RequirePermissions required={["lab_providers.read"]} />,
            children: [
              { path: "/labs", element: <LabsPage /> },
              { path: "/labs/enabled", element: <LabsPage enabledOnly /> }
            ]
          },
          {
            element: <RequirePermissions required={["procedures.read", "price_lists.read"]} />,
            children: [{ path: "/labs/procedures", element: <LabProceduresPage /> }]
          },
          {
            element: <RequirePermissions required={["lab_orders.read"]} />,
            children: [{ path: "/labs/orders", element: <LabOrdersPage /> }]
          },
          {
            element: <RequirePermissions required={["inventory.read"]} />,
            children: [{ path: "/inventory", element: <InventoryPage /> }]
          },
          {
            element: <RequirePermissions required={["inventory.movements.read"]} />,
            children: [{ path: "/inventory/movements", element: <InventoryMovementsPage /> }]
          },
          {
            element: <RequirePermissions required={["reports.read"]} />,
            children: [
              { path: "/reports", element: <ReportsPage /> },
              { path: "/reports/appointments", element: <ReportsAppointmentsPage /> },
              { path: "/reports/patients", element: <ReportsPatientsPage /> },
              { path: "/reports/treatments", element: <ReportsTreatmentsPage /> },
              { path: "/reports/financial", element: <ReportsFinancialPage /> },
              { path: "/reports/professionals", element: <ReportsProfessionalsPage /> }
            ]
          },

          {
            element: <RequirePermissions required={["users.read"]} />,
            children: [{ path: "/settings/users", element: <UsersPage /> }]
          },
          {
            element: <RequirePermissions required={["users.update"]} />,
            children: [{ path: "/settings/users/blocks/access", element: <AccessUsersBlockPage /> }]
          },
          {
            element: <RequirePermissions required={["appointments.create", "professionals.read"]} />,
            children: [{ path: "/settings/users/blocks/agenda", element: <AgendaUsersBlockPage /> }]
          },
          {
            element: <RequirePermissions required={["professionals.read", "professionals.update"]} />,
            children: [{ path: "/settings/users/contracts/bulk", element: <UsersBulkContractsPage /> }]
          },
          {
            element: <RequirePermissions required={["roles.read"]} />,
            children: [
              { path: "/settings/roles", element: <RolesPage /> },
              { path: "/settings/users/profiles", element: <RolesPage /> },
              { path: "/settings/roles/:id", element: <RoleDetailPage /> }
            ]
          }
        ]
      }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
]);
