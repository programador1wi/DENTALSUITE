import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Eye,
  FileSearch,
  Landmark,
  RefreshCw,
  UsersRound
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { useCashRegisters } from "@/features/payments/hooks/use-payments";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import {
  useAgreementDebtDetails,
  useAgreementDebts,
  useCreateCompanyPayment
} from "../hooks/use-admin-workflows";
import {
  exportAgreementDebts,
  type AgreementBranchDebt,
  type AgreementDebt,
  type AgreementDebtDetail,
  type AgreementDebtReportParams
} from "../services/admin-workflows.service";

type DebtSelection = AgreementDebt | AgreementBranchDebt;

const today = () => new Date().toISOString().slice(0, 10);

const emptyFilters: AgreementDebtReportParams = {
  cutoffDate: today(),
  scope: "AUTHORIZED",
  page: 1,
  pageSize: 100
};

export function AgreementsDebtsPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("agreements.debt_report.read") || hasPermission("settings.read");
  const canCreatePayment =
    hasPermission("agreements.payments.create") || hasPermission("settings.update");
  const canApprovePayment =
    hasPermission("agreements.payments.approve") || hasPermission("settings.update");
  const canExport =
    hasPermission("agreements.reports.export") || hasPermission("settings.read");
  const [draftFilters, setDraftFilters] = useState<AgreementDebtReportParams>(emptyFilters);
  const [filters, setFilters] = useState<AgreementDebtReportParams>(emptyFilters);
  const [detailSelection, setDetailSelection] = useState<DebtSelection | null>(null);
  const [paymentSelection, setPaymentSelection] = useState<DebtSelection | null>(null);
  const [exporting, setExporting] = useState(false);
  const report = useAgreementDebts(filters, canRead);

  const agreements = report.data?.filters.agreements ?? [];
  const filteredAgreements = draftFilters.companyId
    ? agreements.filter((agreement) => agreement.companyId === draftFilters.companyId)
    : agreements;

  const consult = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...draftFilters, page: 1 });
  };

  const download = async () => {
    setExporting(true);
    try {
      const blob = await exportAgreementDebts(filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `deudas-convenios-${filters.cutoffDate}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Reporte exportado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible exportar el reporte");
    } finally {
      setExporting(false);
    }
  };

  if (!canRead) {
    return <ErrorState message="No tienes permiso para consultar el reporte de deudas por convenio." />;
  }
  if (report.isLoading && !report.data) return <LoadingState message="Calculando deudas empresariales..." />;
  if (report.isError && !report.data)
    return <ErrorState message={report.error.message || "No fue posible calcular el reporte"} />;

  const data = report.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reporte de deudas"
        description="Cargos que empresas asociadas a convenios deben entregar a la clínica. No modifica la deuda particular del paciente."
        helpText="La fecha de corte incluye cuotas con vencimiento hasta ese día y descuenta únicamente pagos empresariales confirmados y aplicados."
      />

      <Card className="overflow-hidden border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.94),rgba(255,255,255,0.98)_58%,rgba(236,253,245,0.72))] p-0">
        <form onSubmit={consult} className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                <CalendarDays className="h-4 w-4" /> Corte contable
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Consulta por identidad, no por nombre: empresa, convenio, sucursal y moneda.
              </p>
            </div>
            {data?.reconciliation.matches ? (
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Consolidado conciliado con sucursales
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-6">
            <Field label="Fecha de corte">
              <Input
                type="date"
                required
                value={draftFilters.cutoffDate}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, cutoffDate: event.target.value }))
                }
              />
            </Field>
            <Field label="Empresa">
              <Select
                value={draftFilters.companyId ?? ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    companyId: event.target.value || undefined,
                    agreementId: undefined
                  }))
                }
              >
                <option value="">Todas</option>
                {data?.filters.companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.legalName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Convenio">
              <Select
                value={draftFilters.agreementId ?? ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    agreementId: event.target.value || undefined
                  }))
                }
              >
                <option value="">Todos</option>
                {filteredAgreements.map((agreement) => (
                  <option key={agreement.id} value={agreement.id}>{agreement.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Sucursal">
              <Select
                value={draftFilters.branchId ?? ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    branchId: event.target.value || undefined
                  }))
                }
              >
                <option value="">Sucursales autorizadas</option>
                {data?.filters.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda">
              <Select
                value={draftFilters.currencyId ?? ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    currencyId: (event.target.value || undefined) as AgreementDebtReportParams["currencyId"]
                  }))
                }
              >
                <option value="">Todas</option>
                {data?.filters.currencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </Select>
            </Field>
            <Field label="Alcance">
              <Select
                value={draftFilters.scope ?? "AUTHORIZED"}
                disabled={!data?.filters.canViewAllBranches}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    scope: event.target.value as "AUTHORIZED" | "ALL"
                  }))
                }
              >
                <option value="AUTHORIZED">Mis sucursales</option>
                <option value="ALL">Toda la organización</option>
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-sky-100 pt-4">
            {canExport ? (
              <Button type="button" variant="secondary" onClick={() => void download()} disabled={exporting}>
                <Download className="h-4 w-4" /> {exporting ? "Exportando..." : "Exportar CSV"}
              </Button>
            ) : null}
            <Button type="submit" disabled={report.isFetching}>
              <RefreshCw className={`h-4 w-4 ${report.isFetching ? "animate-spin" : ""}`} />
              {report.isFetching ? "Calculando..." : "Consultar"}
            </Button>
          </div>
        </form>
      </Card>

      {data ? <SummaryBand data={data.totals} byCurrency={data.totalsByCurrency} cutoffDate={data.cutoffDate} /> : null}

      <DebtSection
        title="Deudas consolidadas"
        eyebrow="Empresa + convenio + moneda"
        icon={<Building2 className="h-5 w-5" />}
        emptyReason={data?.diagnostics.emptyReason}
        futureChargeCount={data?.diagnostics.futureChargeCount ?? 0}
      >
        <DataTable
          rows={(data?.consolidated ?? []) as Array<AgreementDebt & Record<string, unknown>>}
          tableClassName="min-w-[1180px]"
          containerClassName="max-h-[520px]"
          empty={<DebtEmptyState reason={data?.diagnostics.emptyReason} futureCount={data?.diagnostics.futureChargeCount ?? 0} />}
          columns={[
            { key: "companyName", title: "Empresa", wrap: true, render: (row) => <IdentityCell primary={row.companyName} secondary={row.agreementName} /> },
            { key: "currency", title: "Moneda", render: (row) => <Badge value={row.currency} tone="brand" /> },
            { key: "generatedCharges", title: "Cargos", render: (row) => <Money value={row.generatedCharges} currency={row.currency} /> },
            { key: "totalPaid", title: "Pagado", render: (row) => <Money value={row.totalPaid} currency={row.currency} muted /> },
            { key: "outstandingDebt", title: "Deuda pendiente", render: (row) => <Money value={row.outstandingDebt} currency={row.currency} strong /> },
            { key: "patientCount", title: "Pacientes", render: (row) => String(row.patientCount) },
            { key: "chargeCount", title: "N.º cargos", render: (row) => String(row.chargeCount) },
            { key: "oldestCharge", title: "Más antiguo", render: (row) => formatDate(row.oldestCharge) },
            { key: "state", title: "Estado", render: (row) => <DebtState state={row.state} /> },
            {
              key: "id",
              title: "Acciones",
              render: (row) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetailSelection(row)}><Eye className="h-4 w-4" /> Detalle</Button>
                  {canCreatePayment && row.outstandingDebt > 0 ? (
                    <Button size="sm" onClick={() => setPaymentSelection(row)}>Registrar pago</Button>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      </DebtSection>

      <DebtSection
        title="Deudas por sucursal"
        eyebrow="Empresa + convenio + sucursal + moneda"
        icon={<Landmark className="h-5 w-5" />}
        emptyReason={data?.diagnostics.emptyReason}
        futureChargeCount={data?.diagnostics.futureChargeCount ?? 0}
      >
        <DataTable
          rows={(data?.byBranch ?? []) as Array<AgreementBranchDebt & Record<string, unknown>>}
          tableClassName="min-w-[1080px]"
          containerClassName="max-h-[520px]"
          empty={<DebtEmptyState reason={data?.diagnostics.emptyReason} futureCount={data?.diagnostics.futureChargeCount ?? 0} branch />}
          columns={[
            { key: "companyName", title: "Empresa", wrap: true, render: (row) => <IdentityCell primary={row.companyName} secondary={row.agreementName} /> },
            { key: "branchName", title: "Sucursal", wrap: true },
            { key: "currency", title: "Moneda", render: (row) => <Badge value={row.currency} tone="brand" /> },
            { key: "generatedCharges", title: "Cargos", render: (row) => <Money value={row.generatedCharges} currency={row.currency} /> },
            { key: "totalPaid", title: "Pagado", render: (row) => <Money value={row.totalPaid} currency={row.currency} muted /> },
            { key: "outstandingDebt", title: "Deuda", render: (row) => <Money value={row.outstandingDebt} currency={row.currency} strong /> },
            { key: "state", title: "Estado", render: (row) => <DebtState state={row.state} /> },
            {
              key: "id",
              title: "Acciones",
              render: (row) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetailSelection(row)}><Eye className="h-4 w-4" /> Detalle</Button>
                  {canCreatePayment && row.outstandingDebt > 0 ? (
                    <Button size="sm" onClick={() => setPaymentSelection(row)}>Registrar pago</Button>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      </DebtSection>

      <DebtDetailsModal selection={detailSelection} filters={filters} onClose={() => setDetailSelection(null)} />
      <CompanyPaymentModal
        selection={paymentSelection}
        reportFilters={filters}
        canApprove={canApprovePayment}
        onClose={() => setPaymentSelection(null)}
      />
    </div>
  );
}

function SummaryBand({ data, byCurrency, cutoffDate }: { data: { patients: number; charges: number }; byCurrency: Array<{ currency: string; generatedCharges: number; paid: number; debt: number }>; cutoffDate: string }) {
  const items = [
    ...byCurrency.map((total) => ({ label: `Deuda ${total.currency}`, value: money(total.debt, total.currency), secondary: `${money(total.generatedCharges, total.currency)} cargos · ${money(total.paid, total.currency)} aplicado`, icon: CircleDollarSign, accent: total.debt > 0 })),
    { label: "Pacientes", value: String(data.patients), secondary: "Afiliados con cargos al corte", icon: UsersRound, accent: false },
    { label: "Cuotas", value: String(data.charges), secondary: `Incluidas al ${formatDate(cutoffDate)}`, icon: FileSearch, accent: false }
  ];
  return (
    <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:border-r lg:border-b-0">
          <div className={`rounded-lg p-2 ${item.accent ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-700"}`}><item.icon className="h-4 w-4" /></div>
          <div className="min-w-0"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="truncate text-sm font-bold text-slate-900">{item.value}</p><p className="truncate text-[11px] text-slate-500">{item.secondary}</p></div>
        </div>
      ))}
      <span className="sr-only">Fecha de corte {cutoffDate}</span>
    </div>
  );
}

function DebtSection({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: React.ReactNode; emptyReason?: string | null; futureChargeCount: number; children: React.ReactNode }) {
  return (
    <Card className="p-0">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="rounded-lg bg-slate-900 p-2 text-white">{icon}</div>
        <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">{eyebrow}</p><h3 className="text-lg font-semibold text-slate-950">{title}</h3></div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function DebtEmptyState({ reason, futureCount, branch = false }: { reason?: "FUTURE_CHARGES" | "NO_CHARGES" | null; futureCount: number; branch?: boolean }) {
  if (reason === "FUTURE_CHARGES") {
    return <EmptyState title="Sin deuda al corte" description={`Existen ${futureCount} cargos con vencimiento posterior. Cambia la fecha de corte para incluirlos.`} />;
  }
  return <EmptyState title={branch ? "No se han generado cobros para ninguna sucursal" : "Sin cargos empresariales"} description="Genera el descuento por planilla desde el plan de tratamiento de un paciente afiliado." />;
}

function DebtDetailsModal({ selection, filters, onClose }: { selection: DebtSelection | null; filters: AgreementDebtReportParams; onClose: () => void }) {
  const [patient, setPatient] = useState("");
  const [status, setStatus] = useState("");
  const [folio, setFolio] = useState("");
  const detailParams = useMemo(() => ({
    ...filters,
    agreementId: undefined,
    companyId: selection?.companyId,
    branchId: "branchId" in (selection ?? {}) ? (selection as AgreementBranchDebt).branchId : filters.branchId,
    currencyId: selection?.currency,
    patient: patient || undefined,
    status: status || undefined,
    folio: folio || undefined
  }), [filters, selection, patient, status, folio]);
  const details = useAgreementDebtDetails(selection?.agreementId, detailParams, Boolean(selection));
  useEffect(() => { if (!selection) { setPatient(""); setStatus(""); setFolio(""); } }, [selection]);
  return (
    <Modal open={Boolean(selection)} title="Detalle de deuda empresarial" onClose={onClose} size="2xl">
      <div className="space-y-4">
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4"><p className="font-semibold text-slate-950">{selection?.companyName}</p><p className="text-sm text-slate-600">{selection?.agreementName} · {selection?.currency}</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Paciente o expediente"><Input value={patient} onChange={(event) => setPatient(event.target.value)} placeholder="Buscar..." /></Field>
          <Field label="Estado"><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="OVERDUE">Vencido</option><option value="PENDING">Pendiente</option><option value="PARTIALLY_PAID">Pago parcial</option><option value="PAID">Pagado</option></Select></Field>
          <Field label="Folio"><Input value={folio} onChange={(event) => setFolio(event.target.value)} placeholder="ADE-..." /></Field>
        </div>
        {details.isLoading ? <LoadingState message="Cargando cargos..." /> : details.isError ? <ErrorState message={details.error.message} /> : (
          <DataTable
            rows={(details.data?.rows ?? []) as Array<AgreementDebtDetail & Record<string, unknown>>}
            tableClassName="min-w-[1200px]"
            containerClassName="max-h-[480px]"
            empty={<EmptyState title="Sin cargos con estos filtros" description="Ajusta paciente, estado o folio." />}
            columns={[
              { key: "folio", title: "Folio" },
              { key: "patient", title: "Paciente", wrap: true, render: (row) => <IdentityCell primary={row.patient} secondary={row.expediente} /> },
              { key: "treatment", title: "Tratamiento", wrap: true, render: (row) => <IdentityCell primary={row.procedure} secondary={row.treatment} /> },
              { key: "installmentNumber", title: "Cuota" },
              { key: "dueDate", title: "Vencimiento", render: (row) => formatDate(row.dueDate) },
              { key: "branch", title: "Sucursal", render: (row) => row.branch.name },
              { key: "originalAmount", title: "Original", render: (row) => <Money value={row.originalAmount} currency={row.currency} /> },
              { key: "paid", title: "Pagado", render: (row) => <Money value={row.paid} currency={row.currency} muted /> },
              { key: "balance", title: "Saldo", render: (row) => <Money value={row.balance} currency={row.currency} strong /> },
              { key: "status", title: "Estado", render: (row) => <ChargeState status={row.status} /> },
              { key: "overdueDays", title: "Días vencido", render: (row) => row.overdueDays ? `${row.overdueDays} días` : "—" }
            ]}
          />
        )}
      </div>
    </Modal>
  );
}

function CompanyPaymentModal({ selection, reportFilters, canApprove, onClose }: { selection: DebtSelection | null; reportFilters: AgreementDebtReportParams; canApprove: boolean; onClose: () => void }) {
  const createPayment = useCreateCompanyPayment();
  const paymentMethods = usePaymentMethods(undefined, "true", Boolean(selection));
  const institutions = useFinancialInstitutions(undefined, "true");
  const cashRegisters = useCashRegisters({ status: "OPEN" });
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [financialInstitutionId, setFinancialInstitutionId] = useState("");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [cashRegisterId, setCashRegisterId] = useState("");
  const [notes, setNotes] = useState("");
  const [strategy, setStrategy] = useState<"AUTO_DUE_DATE" | "MANUAL" | "PROPORTIONAL">("AUTO_DUE_DATE");
  const [selectedCharges, setSelectedCharges] = useState<string[]>([]);
  const detailParams = useMemo(() => ({
    cutoffDate: reportFilters.cutoffDate,
    page: 1,
    pageSize: 200,
    branchId: selection && "branchId" in selection ? selection.branchId : reportFilters.branchId,
    currencyId: selection?.currency,
    scope: reportFilters.scope ?? "AUTHORIZED"
  }), [reportFilters, selection]);
  const details = useAgreementDebtDetails(selection?.agreementId, detailParams, Boolean(selection));

  useEffect(() => {
    if (!selection) return;
    setAmount(selection.outstandingDebt.toFixed(2));
    setPaymentDate(today());
    setPaymentMethodId(paymentMethods.data?.[0]?.id ?? "");
    setFinancialInstitutionId("");
    setReference("");
    setProofUrl("");
    setCashRegisterId("");
    setNotes("");
    setStrategy("AUTO_DUE_DATE");
    setSelectedCharges([]);
  }, [selection, paymentMethods.data]);

  const branchId = selection && "branchId" in selection ? selection.branchId : reportFilters.branchId;
  const availableRegisters = (cashRegisters.data ?? []).filter((register) =>
    (!branchId || register.branchId === branchId) && register.currency === selection?.currency
  );
  const applicableRows = (details.data?.rows ?? []).filter((row) => row.balance > 0);
  const manualTotal = applicableRows.filter((row) => selectedCharges.includes(row.id)).reduce((sum, row) => sum + row.balance, 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selection) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return toast.error("Ingresa un monto válido");
    if (numericAmount > selection.outstandingDebt) return toast.error("El monto supera la deuda del grupo seleccionado");
    if (strategy === "MANUAL" && !selectedCharges.length) return toast.error("Selecciona al menos un cargo");
    if (strategy === "MANUAL" && numericAmount > manualTotal) return toast.error("El monto supera el saldo de los cargos seleccionados");
    await createPayment.mutateAsync({
      agreementId: selection.agreementId,
      idempotencyKey: crypto.randomUUID(),
      payload: {
        branchId,
        paymentDate,
        amount: numericAmount,
        currencyId: selection.currency,
        paymentMethodId: paymentMethodId || undefined,
        financialInstitutionId: financialInstitutionId || undefined,
        reference: reference || undefined,
        proofUrl: proofUrl || undefined,
        cashRegisterId: cashRegisterId || undefined,
        notes: notes || undefined,
        allocationStrategy: strategy,
        chargeIds: strategy === "MANUAL" ? selectedCharges : undefined,
        confirm: canApprove
      }
    });
    onClose();
  };

  return (
    <Modal open={Boolean(selection)} title="Recibir pago de empresa" onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 sm:grid-cols-3">
          <Result label="Empresa" value={selection?.companyName ?? "—"} />
          <Result label="Convenio" value={selection?.agreementName ?? "—"} />
          <Result label="Deuda disponible" value={money(selection?.outstandingDebt ?? 0, selection?.currency ?? "MXN")} strong />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fecha del pago"><Input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></Field>
          <Field label={`Monto (${selection?.currency ?? "MXN"})`}><Input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
          <Field label="Medio de pago"><Select required value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}><option value="">Seleccionar</option>{paymentMethods.data?.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</Select></Field>
          <Field label="Banco"><Select value={financialInstitutionId} onChange={(event) => setFinancialInstitutionId(event.target.value)}><option value="">No aplica</option>{institutions.data?.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</Select></Field>
          <Field label="Referencia"><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transferencia, depósito o folio" /></Field>
          <Field label="Comprobante (URL)"><Input type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https://..." /></Field>
          <Field label="Caja"><Select value={cashRegisterId} onChange={(event) => setCashRegisterId(event.target.value)} disabled={!branchId}><option value="">Sin asociar a caja</option>{availableRegisters.map((register) => <option key={register.id} value={register.id}>Caja #{register.publicNumber} · {register.branch.name}</option>)}</Select></Field>
          <Field label="Aplicación"><Select value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)}><option value="AUTO_DUE_DATE">Automática por vencimiento</option><option value="MANUAL">Selección manual</option><option value="PROPORTIONAL">Proporcional</option></Select></Field>
        </div>
        {strategy === "MANUAL" ? (
          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><p className="text-sm font-semibold text-slate-900">Cargos a aplicar</p><span className="text-xs font-semibold text-slate-600">Seleccionado: {money(manualTotal, selection?.currency ?? "MXN")}</span></div>
            <div className="max-h-56 space-y-1 overflow-y-auto p-2">
              {applicableRows.map((row) => (
                <label key={row.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                  <span className="flex items-center gap-3"><input type="checkbox" checked={selectedCharges.includes(row.id)} onChange={(event) => setSelectedCharges((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /><span><span className="block text-sm font-medium text-slate-900">{row.patient} · cuota {row.installmentNumber}</span><span className="block text-xs text-slate-500">{row.folio} · vence {formatDate(row.dueDate)}</span></span></span>
                  <Money value={row.balance} currency={row.currency} strong />
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <Field label="Observaciones"><textarea className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        {!canApprove ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">El pago se guardará como borrador porque no tienes permiso de aprobación.</p> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={createPayment.isPending}>{createPayment.isPending ? "Registrando..." : canApprove ? "Registrar y aplicar" : "Guardar borrador"}</Button></div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5"><span className="block text-xs font-semibold text-slate-700">{label}</span>{children}</label>;
}

function Result({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{label}</p><p className={`${strong ? "text-lg" : "text-sm"} font-bold text-slate-950`}>{value}</p></div>;
}

function IdentityCell({ primary, secondary }: { primary: string; secondary: string }) {
  return <div className="min-w-[170px]"><p className="font-semibold text-slate-950">{primary}</p><p className="text-xs text-slate-500">{secondary}</p></div>;
}

function Money({ value, currency, strong = false, muted = false }: { value: number; currency: string; strong?: boolean; muted?: boolean }) {
  return <span className={`${strong ? "font-bold text-slate-950" : "font-medium"} ${muted ? "text-emerald-700" : "text-slate-700"}`}>{money(value, currency)}</span>;
}

function DebtState({ state }: { state: AgreementDebt["state"] }) {
  const map = { OUTSTANDING: ["Pendiente", "warning"], PAID: ["Pagada", "success"], ADJUSTED_ZERO: ["Cero por ajuste", "default"], NO_CHARGES: ["Sin cargos", "default"], FUTURE_CHARGES: ["Cargos futuros", "brand"] } as const;
  const [value, tone] = map[state];
  return <Badge value={value} tone={tone} />;
}

function ChargeState({ status }: { status: AgreementDebtDetail["status"] }) {
  const labels: Record<AgreementDebtDetail["status"], string> = { SCHEDULED: "Programado", PENDING: "Pendiente", OVERDUE: "Vencido", PARTIALLY_PAID: "Pago parcial", PAID: "Pagado", CANCELLED: "Cancelado", REVERSED: "Revertido" };
  const tone = status === "PAID" ? "success" : status === "OVERDUE" ? "danger" : status === "PARTIALLY_PAID" || status === "PENDING" ? "warning" : "default";
  return <Badge value={labels[status]} tone={tone} />;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
