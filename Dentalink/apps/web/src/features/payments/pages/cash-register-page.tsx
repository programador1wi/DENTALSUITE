import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Printer, ChevronDown, FileDown, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import {
  useCashRegisterDetail,
  useCashRegisters,
  usePaymentsMutations,
  useCashCollectionSummary,
  useCashBoxSummary,
  useCashPaymentsByPeriod,
  useCashPaymentsByProfessional
} from "../hooks/use-payments";
import type { CashRegister, CashRegisterDetail, CashRegisterMovement, CashRegisterStatus } from "../services/payments.service";


const cashTabs = [
  { to: "/cash-register/open", label: "Cajas abiertas" },
  { to: "/cash-register/closed", label: "Cajas cerradas" },
  { to: "/cash-register/reports", label: "Reportes" },
  { to: "/cash-register/search", label: "Buscar caja" }
];

function money(value: string | number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function date(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function userName(register: CashRegister) {
  return `${register.openedBy.firstName} ${register.openedBy.lastName}`.trim() || "CAJA";
}

function personName(person?: { firstName?: string; lastName?: string } | null) {
  return `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim() || "-";
}

function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

function cashRegisterSearchLabel(register: CashRegister) {
  return `${shortId(register.id)} · ${userName(register)} · ${register.branch.name}`;
}

function paymentAgreement(movement: CashRegisterMovement) {
  const payment = movement.payment;
  if (!payment) return "-";

  const allocationAgreement = payment.allocations.find((allocation) => allocation.treatmentPlanItem.agreement?.name)
    ?.treatmentPlanItem.agreement?.name;
  const planName = payment.allocations[0]?.treatmentPlanItem.treatmentPlan.name;

  return allocationAgreement ?? payment.patient.agreement?.name ?? planName ?? "Sin convenio";
}

export function CashRegisterPage() {
  const location = useLocation();
  const isClosed = location.pathname.endsWith("/closed");
  const isReports = location.pathname.endsWith("/reports");
  const isSearch = location.pathname.endsWith("/search");
  const status: CashRegisterStatus | "" = isReports || isSearch ? "" : isClosed ? "CLOSED" : "OPEN";

  const user = useAuthStore((state) => state.user);
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const [branchId, setBranchId] = useState("");
  const [openFormVisible, setOpenFormVisible] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingRegister, setClosingRegister] = useState<CashRegister | null>(null);
  const [closeAmount, setCloseAmount] = useState("");
  const [search, setSearch] = useState("");
  const [detailRegisterId, setDetailRegisterId] = useState<string | null>(null);

  const branches = useBranches(undefined, "ACTIVE");
  const selectedBranchId = isSearch ? branchId || activeBranchId : activeBranchId;
  const activeBranch = useMemo(
    () => branches.data?.find((branch) => branch.id === activeBranchId),
    [branches.data, activeBranchId]
  );
  const cashRegisters = useCashRegisters({ branchId: selectedBranchId || undefined, status, search: search || undefined });
  const detail = useCashRegisterDetail(detailRegisterId);
  const mutations = usePaymentsMutations();

  const rows = useMemo(() => {
    const source = cashRegisters.data ?? [];
    if (!search) return source;
    const term = search.toLowerCase();
    return source.filter(
      (register) =>
        userName(register).toLowerCase().includes(term) ||
        register.id.toLowerCase().includes(term) ||
        register.branch.name.toLowerCase().includes(term)
    );
  }, [cashRegisters.data, search]);

  useEffect(() => {
    if (branchId && activeBranchId && branchId !== activeBranchId) {
      setBranchId("");
    }
  }, [activeBranchId, branchId]);

  const handleOpen = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeBranchId || Number(openingAmount) < 0) return;
    mutations.openCashRegister.mutate(
      { branchId: activeBranchId, openingAmount: Number(openingAmount) },
      {
        onSuccess: () => {
          setOpenFormVisible(false);
          setOpeningAmount("0");
        }
      }
    );
  };

  const handleClose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!closingRegister || Number(closeAmount) < 0) return;
    mutations.closeCashRegister.mutate(
      { registerId: closingRegister.id, closingAmount: Number(closeAmount) },
      {
        onSuccess: () => {
          setClosingRegister(null);
          setCloseAmount("");
        }
      }
    );
  };

  const actions = (
    <button
      type="button"
      onClick={() => setOpenFormVisible((visible) => !visible)}
      className="rounded bg-[#49ad50] px-4 py-2 text-lg font-bold text-white shadow-sm hover:bg-[#3d9944] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={!activeBranchId}
    >
      + Abrir caja
    </button>
  );

  if (cashRegisters.isError) return <ErrorState message={cashRegisters.error.message} />;

  return (
    <WarnerSuitePanel>
      <div className="px-3 pt-3 text-right text-sm text-slate-500">
        Configurar medios de pago a considerar en reporteria de esta seccion
      </div>
      <ModuleTabs tabs={cashTabs} actions={actions} />

      <div className="p-3">
        <div className="mb-3 rounded border border-sky-200 bg-sky-100 px-4 py-3 text-sm text-sky-800">
          <strong>Atencion:</strong> Los pagos reflejados en los resumenes presentes en estas secciones <strong>no reflejan</strong> los pagos recibidos de descuentos por planilla.
        </div>

        {openFormVisible && (
          <form className="mb-4 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-3" onSubmit={handleOpen}>
            <label className="text-sm">
              Sucursal
              <span className="mt-1 flex h-10 min-w-[300px] items-center rounded border border-slate-300 bg-white px-3 font-semibold text-slate-700">
                {activeBranch ? `Suc. ${activeBranch.name}` : "Seleccione sucursal en el encabezado"}
              </span>
            </label>
            <label className="text-sm">
              Usuario
              <span className="mt-1 flex h-10 min-w-[220px] items-center rounded border border-slate-300 bg-white px-3 font-semibold text-slate-700">
                {personName(user)}
              </span>
            </label>
            <label className="text-sm">
              Saldo inicial
              <input className="mt-1 block h-10 w-[160px] rounded border border-slate-300 px-3" type="number" min="0" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
            </label>
            <button className="h-10 rounded bg-[#0784d8] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!activeBranchId || mutations.openCashRegister.isPending}>
              Abrir caja
            </button>
          </form>
        )}

        {isClosed && (
          <div className="mb-5">
            <h1 className="mb-3 text-[26px] font-bold text-slate-700">Cajas Cerradas</h1>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm">
                Usuario:
                <EntitySearchBox
                  className="mt-1 w-[255px]"
                  inputClassName="h-11 rounded border-slate-300 text-lg"
                  placeholder="Buscar usuario"
                  value={search}
                  onValueChange={setSearch}
                  items={search.trim() ? rows : []}
                  onSelect={(register) => {
                    setSearch(shortId(register.id));
                    setDetailRegisterId(register.id);
                  }}
                  getItemKey={(register) => register.id}
                  emptyMessage="Sin cajas encontradas"
                  renderItem={(register) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{cashRegisterSearchLabel(register)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{dateTime(register.openedAt)}</p>
                    </div>
                  )}
                />
              </label>
              <label className="text-sm">
                Fecha apertura:
                <input className="mt-1 block h-11 w-[145px] rounded border border-slate-300 px-3 text-center text-slate-400" placeholder="fecha" />
              </label>
              <label className="text-sm">
                Fecha cierre:
                <input className="mt-1 block h-11 w-[145px] rounded border border-slate-300 px-3 text-center text-slate-400" placeholder="fecha" />
              </label>
              <button className="h-9 rounded bg-[#42a6c9] px-4 font-bold text-white">Filtrar</button>
              <button className="h-9 text-[#0784d8]" onClick={() => setSearch("")} type="button">x Quitar filtros</button>
            </div>
          </div>
        )}

        {isSearch && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <EntitySearchBox
              className="w-[320px]"
              inputClassName="rounded border-slate-300"
              placeholder="Buscar caja por usuario, sucursal o ID"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? rows : []}
              onSelect={(register) => {
                setSearch(shortId(register.id));
                setDetailRegisterId(register.id);
              }}
              getItemKey={(register) => register.id}
              emptyMessage="Sin cajas encontradas"
              renderItem={(register) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{cashRegisterSearchLabel(register)}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{register.status} · {dateTime(register.openedAt)}</p>
                </div>
              )}
            />
            <select
              className="h-10 rounded border border-slate-300 px-3"
              value={branchId || activeBranchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                if (event.target.value) setActiveBranchId(event.target.value);
              }}
            >
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        )}

        {isReports ? (
          <CashReports />
        ) : cashRegisters.isLoading ? (
          <LoadingState message="Cargando cajas..." />
        ) : !rows.length ? (
          <EmptyState title="Sin cajas" description="No hay cajas para los filtros seleccionados." />
        ) : (
          <CashTable rows={rows} closed={isClosed || isSearch} onClose={setClosingRegister} onDetail={setDetailRegisterId} />
        )}

        {closingRegister && (
          <form className="mt-4 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-3" onSubmit={handleClose}>
            <div>
              <p className="text-sm font-bold">Cerrar caja de {userName(closingRegister)}</p>
              <p className="text-xs text-slate-500">Saldo esperado: {money(closingRegister.expectedClosing ?? closingRegister.openingAmount)}</p>
            </div>
            <label className="text-sm">
              Saldo cierre
              <input className="mt-1 block h-10 w-[160px] rounded border border-slate-300 px-3" type="number" min="0" value={closeAmount} onChange={(event) => setCloseAmount(event.target.value)} />
            </label>
            <button className="h-10 rounded bg-[#0784d8] px-5 font-bold text-white" disabled={mutations.closeCashRegister.isPending}>
              Cerrar caja
            </button>
            <button className="h-10 px-3 text-[#0784d8]" type="button" onClick={() => setClosingRegister(null)}>
              Cancelar
            </button>
          </form>
        )}
      </div>

      <Modal open={Boolean(detailRegisterId)} title="Detalle de caja" onClose={() => setDetailRegisterId(null)} size="2xl">
        {detail.isLoading ? <LoadingState message="Cargando detalle de caja..." /> : null}
        {detail.isError ? <ErrorState message={detail.error.message} /> : null}
        {detail.data ? <CashRegisterDetailPanel register={detail.data} /> : null}
      </Modal>
    </WarnerSuitePanel>
  );
}

function CashTable({
  rows,
  closed,
  onClose,
  onDetail
}: {
  rows: CashRegister[];
  closed: boolean;
  onClose: (register: CashRegister) => void;
  onDetail: (registerId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-white text-left text-slate-700">
            <th className="border border-slate-200 px-3 py-3">Usuario</th>
            <th className="border border-slate-200 px-3 py-3">Apertura</th>
            {closed && <th className="border border-slate-200 px-3 py-3">Cierre</th>}
            <th className="border border-slate-200 px-3 py-3">Detalle</th>
            <th className="border border-slate-200 px-3 py-3 text-right">Saldo anterior</th>
            <th className="border border-slate-200 px-3 py-3 text-right">Saldo inicial</th>
            <th className="border border-slate-200 px-3 py-3 text-right">{closed ? "Saldo cierre" : "Acumulado"}</th>
            {!closed && <th className="border border-slate-200 px-3 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((register) => (
            <tr key={register.id}>
              <td className="border border-slate-200 px-3 py-3 uppercase">{userName(register)}</td>
              <td className="border border-slate-200 px-3 py-3">{date(register.openedAt)}</td>
              {closed && <td className="border border-slate-200 px-3 py-3">{date(register.closedAt)}</td>}
              <td className="border border-slate-200 px-3 py-3">
                <button className="inline-flex items-center gap-1 text-[#0784d8] hover:underline" type="button" onClick={() => onDetail(register.id)}>
                  ver detalle <Search className="h-3.5 w-3.5" />
                </button>
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right">{money(register.previousBalance ?? 0)}</td>
              <td className="border border-slate-200 px-3 py-3 text-right">{money(register.openingAmount)}</td>
              <td className="border border-slate-200 px-3 py-3 text-right">{money(closed ? register.closingAmount : register.expectedClosing ?? register.openingAmount)}</td>
              {!closed && (
                <td className="border border-slate-200 px-3 py-3 text-right">
                  <button className="text-[#0784d8]" type="button" onClick={() => onClose(register)}>Cerrar</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashRegisterDetailPanel({ register }: { register: CashRegisterDetail }) {
  const statusTone = register.status === "OPEN" ? "success" : "default";
  const saldoInicialTotal = Number(register.previousBalance ?? 0) + Number(register.openingTotal ?? register.openingAmount ?? 0);
  const paymentTransactions = register.movements.filter((movement) => movement.payment && (movement.type === "INCOME" || movement.type === "REFUND"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xl font-bold text-slate-700">Total caja #{shortId(register.id)}</p>
          <p className="text-xs text-slate-500">(recaudado + saldo inicial - gastos)</p>
        </div>
        <p className="text-3xl font-bold text-emerald-600">{money(register.expectedClosing)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge value={register.status === "OPEN" ? "Caja abierta" : "Caja cerrada"} tone={statusTone} />
          <span className="text-sm text-slate-500">{register.branch.name}</span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-2 rounded bg-[#0784d8] px-3 text-sm font-semibold text-white hover:bg-[#0c6fb5]"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      <div className="overflow-hidden border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <DetailRow label="Usuario" value={userName(register)} secondaryLabel="Sucursal" secondaryValue={register.branch.name} />
            <DetailRow label="Fecha apertura" value={dateTime(register.openedAt)} secondaryLabel="Apertura realizada por" secondaryValue={personName(register.openedBy)} />
            {register.status === "CLOSED" && (
              <DetailRow label="Fecha cierre" value={dateTime(register.closedAt)} secondaryLabel="Cierre realizado por" secondaryValue={personName(register.closedBy)} />
            )}
            <DetailRow label="Saldo anterior" value={money(register.previousBalance)} />
            <DetailRow label="Abono inicial" value={money(register.openingTotal)} />
            <DetailRow label="Saldo inicial total" value={money(saldoInicialTotal)} strong />
            {register.paymentMethodTotals.map((method) => (
              <DetailRow key={`${method.name}-${method.type}`} label={`${method.name} (cantidad: ${method.count})`} value={money(method.amount)} />
            ))}
            <DetailRow label="Cobrado" value={money(register.incomeTotal)} strong />
            <DetailRow label="Gastos (-)" value={money(register.expenseTotal)} danger />
            <DetailRow label="Devoluciones (-)" value={money(register.refundTotal)} danger />
            {register.adjustmentTotal !== 0 && <DetailRow label="Ajustes" value={money(register.adjustmentTotal)} />}
            <DetailRow label="Total caja (recaudado + saldo inicial - gastos)" value={money(register.expectedClosing)} strong />
          </tbody>
        </table>
      </div>

      <div className="border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">
          Transacciones de la caja
        </div>
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="bg-white text-left text-slate-700">
                <th className="border border-slate-200 px-2 py-3">#</th>
                <th className="border border-slate-200 px-2 py-3">Nombre paciente</th>
                <th className="border border-slate-200 px-2 py-3">Medio de pago</th>
                <th className="border border-slate-200 px-2 py-3">Convenio</th>
                <th className="border border-slate-200 px-2 py-3">Vencimiento</th>
                <th className="border border-slate-200 px-2 py-3"># referencia</th>
                <th className="border border-slate-200 px-2 py-3">Factura</th>
                <th className="border border-slate-200 px-2 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {paymentTransactions.map((movement) => {
                const payment = movement.payment;
                if (!payment) return null;
                const amount = movement.type === "REFUND" ? Number(movement.amount) * -1 : Number(movement.amount);
                return (
                  <tr key={movement.id}>
                    <td className="border border-slate-200 px-2 py-3 text-slate-500">{shortId(payment.id)}</td>
                    <td className="border border-slate-200 px-2 py-3 font-semibold text-[#0784d8]">
                      {payment.patient.documentNumber ? `${payment.patient.documentNumber} ` : ""}
                      {personName(payment.patient)}
                    </td>
                    <td className="border border-slate-200 px-2 py-3">{payment.paymentMethod.name}</td>
                    <td className="border border-slate-200 px-2 py-3">{paymentAgreement(movement)}</td>
                    <td className="border border-slate-200 px-2 py-3">{date(payment.paidAt)}</td>
                    <td className="border border-slate-200 px-2 py-3">{payment.reference || "-"}</td>
                    <td className="border border-slate-200 px-2 py-3">-</td>
                    <td className="border border-slate-200 px-2 py-3 text-right">{money(amount)}</td>
                  </tr>
                );
              })}
              {!paymentTransactions.length && (
                <tr>
                  <td className="border border-slate-200 px-3 py-8 text-center text-sm text-slate-500" colSpan={8}>
                    No hay pagos asociados a esta caja.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  secondaryLabel,
  secondaryValue,
  strong,
  danger
}: {
  label: string;
  value: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <tr className={strong ? "bg-slate-50 font-bold" : ""}>
      <td className="w-[28%] border border-slate-200 px-3 py-2 font-semibold text-slate-600">{label}</td>
      <td className={`border border-slate-200 px-3 py-2 text-right ${danger ? "font-bold text-red-600" : "text-slate-700"}`}>{value}</td>
      {secondaryLabel ? (
        <>
          <td className="w-[24%] border border-slate-200 px-3 py-2 font-semibold text-slate-600">{secondaryLabel}</td>
          <td className="border border-slate-200 px-3 py-2 text-right text-slate-700">{secondaryValue}</td>
        </>
      ) : (
        <td className="border border-slate-200 px-3 py-2" colSpan={2} />
      )}
    </tr>
  );
}

function CashReports() {
  type ReportType = "collection-summary" | "box-summary" | "payments-by-period" | "payments-by-professional";

  const { activeBranchId } = useBranchStore();
  const [selectedReport, setSelectedReport] = useState<ReportType>("collection-summary");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const reportOptions: { value: ReportType | "excel-export"; label: string }[] = [
    { value: "collection-summary", label: "Resumen de recaudación últimos 10 días" },
    { value: "box-summary", label: "Resumen cajas" },
    { value: "payments-by-period", label: "Pagos recibidos por período" },
    { value: "payments-by-professional", label: "Pagos recibidos por período por profesional" },
    { value: "excel-export", label: "Resumen excel de cajas entre dos fechas" }
  ];

  const selectedLabel = reportOptions.find((opt) => opt.value === selectedReport)?.label ?? "Reportes";

  const handleSelectReport = useCallback(
    (value: ReportType | "excel-export") => {
      setIsDropdownOpen(false);
      if (value === "excel-export") {
        setShowExcelModal(true);
      } else {
        setSelectedReport(value);
      }
    },
    []
  );

  return (
    <div>
      {/* ── Dropdown de tipo de reporte ─────────────────────── */}
      <div className="relative mb-5 inline-block" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen((open) => !open)}
          className="flex items-center gap-2 rounded border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {selectedLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-[370px] rounded border border-slate-200 bg-white py-1 shadow-xl">
            {/* Grupo 1 */}
            {reportOptions.slice(0, 2).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectReport(opt.value)}
                className={`block w-full px-5 py-2 text-left text-sm ${
                  opt.value === selectedReport
                    ? "bg-[#0784d8] font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            {/* Grupo 2 */}
            {reportOptions.slice(2, 4).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectReport(opt.value)}
                className={`block w-full px-5 py-2 text-left text-sm ${
                  opt.value === selectedReport
                    ? "bg-[#0784d8] font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            {/* Grupo 3 */}
            {reportOptions.slice(4).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectReport(opt.value)}
                className="block w-full px-5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Contenido dinámico según reporte seleccionado ──── */}
      {selectedReport === "collection-summary" && <CollectionSummaryView branchId={activeBranchId} />}
      {selectedReport === "box-summary" && <BoxSummaryView branchId={activeBranchId} />}
      {selectedReport === "payments-by-period" && <PaymentsByPeriodView branchId={activeBranchId} />}
      {selectedReport === "payments-by-professional" && <PaymentsByProfessionalView branchId={activeBranchId} />}

      {/* ── Modal Excel ──────────────────────────────────────── */}
      <ExcelExportModal open={showExcelModal} onClose={() => setShowExcelModal(false)} branchId={activeBranchId} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista 1: Resumen de recaudación últimos 10 días
// ──────────────────────────────────────────────────────────────────────────────
function CollectionSummaryView({ branchId }: { branchId: string }) {
  const report = useCashCollectionSummary({ branchId });

  if (report.isLoading) return <LoadingState message="Cargando resumen..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  const data = report.data;
  if (!data) return <EmptyState title="Sin datos" description="No hay datos de recaudación para esta sucursal." />;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

  const tickFormatter = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

  const totalColor = "#c0392b";

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-slate-700">
          Total del <strong>{formatDate(data.dateFrom)}</strong> al <strong>{formatDate(data.dateTo)}</strong>
        </p>
        <p className="text-3xl font-bold" style={{ color: totalColor }}>
          {money(data.total)}
        </p>
      </div>
      {data.byDay.length === 0 ? (
        <EmptyState title="Sin movimientos" description="No se registraron pagos en los últimos 10 días." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.byDay} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis
              tickFormatter={(v) => `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
              tick={{ fontSize: 11, fill: "#64748b" }}
              width={80}
            />
            <Tooltip
              formatter={(value: any) => [money(Number(value)), "Recaudado"]}
              labelFormatter={(label: any) => formatDate(String(label))}
              contentStyle={{ borderRadius: 6, border: "1px solid #e2e8f0" }}
            />
            <Bar dataKey="amount" fill="#49ad50" radius={[3, 3, 0, 0]} maxBarSize={60} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista 2: Resumen cajas
// ──────────────────────────────────────────────────────────────────────────────
function BoxSummaryView({ branchId }: { branchId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [fetchEnabled, setFetchEnabled] = useState(false);

  const report = useCashBoxSummary({ branchId, dateFrom, dateTo }, fetchEnabled);

  const handleShow = () => setFetchEnabled(true);

  // Cuando cambian las fechas, deshabilitamos para forzar re-fetch al dar click
  useEffect(() => { setFetchEnabled(false); }, [dateFrom, dateTo]);

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-4 text-xl font-bold text-slate-800">Resumen de cajas</h2>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Desde
          <input
            type="date"
            className="mt-1 block h-10 rounded border border-slate-300 px-3 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-600">
          Hasta
          <input
            type="date"
            className="mt-1 block h-10 rounded border border-slate-300 px-3 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={handleShow}
          disabled={report.isFetching}
          className="flex h-10 items-center gap-2 rounded bg-[#0784d8] px-5 font-semibold text-white hover:bg-[#0c6fb5] disabled:opacity-60"
        >
          {report.isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          Mostrar
        </button>
      </div>

      {report.isLoading && fetchEnabled && <LoadingState message="Cargando resumen..." />}
      {report.isError && <ErrorState message={report.error.message} />}
      {report.data && (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Pagos correspondientes a <strong>{report.data.patientsCount}</strong> pacientes
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="border border-slate-200 px-4 py-2 font-semibold">Tipo</th>
                  <th className="border border-slate-200 px-4 py-2 font-semibold">Medio</th>
                  <th className="border border-slate-200 px-4 py-2 font-semibold">Cantidad movimiento</th>
                  <th className="border border-slate-200 px-4 py-2 text-right font-semibold text-[#0784d8]">
                    Total: {money(report.data.total)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.data.rows.map((row) => (
                  <tr key={row.method} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-4 py-2 text-[#c0392b]">{row.type}</td>
                    <td className="border border-slate-200 px-4 py-2 text-[#c0392b]">{row.method}</td>
                    <td className="border border-slate-200 px-4 py-2">{row.count}</td>
                    <td className="border border-slate-200 px-4 py-2 text-right font-semibold">{money(row.amount)}</td>
                  </tr>
                ))}
                {report.data.rows.length === 0 && (
                  <tr>
                    <td className="border border-slate-200 px-4 py-8 text-center text-slate-400" colSpan={4}>
                      No hay movimientos en el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!report.data && !report.isLoading && (
        <p className="text-sm text-slate-400">Selecciona un rango de fechas y haz click en "Mostrar".</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista 3: Pagos recibidos por período
// ──────────────────────────────────────────────────────────────────────────────
function PaymentsByPeriodView({ branchId }: { branchId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [fetchEnabled, setFetchEnabled] = useState(false);

  const report = useCashPaymentsByPeriod({ branchId, dateFrom, dateTo }, fetchEnabled);

  const handleGenerate = () => setFetchEnabled(true);
  useEffect(() => { setFetchEnabled(false); }, [dateFrom, dateTo]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  const tickFormatter = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <p className="text-lg font-bold text-slate-700">Total pagos</p>
        <span className="text-sm text-slate-500">del</span>
        <input
          type="date"
          className="h-9 rounded border border-slate-300 px-2 text-sm"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className="text-sm text-slate-500">al</span>
        <input
          type="date"
          className="h-9 rounded border border-slate-300 px-2 text-sm"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={report.isFetching}
          className="flex h-9 items-center gap-1.5 rounded bg-[#49ad50] px-4 font-semibold text-white hover:bg-[#3d9944] disabled:opacity-60"
        >
          {report.isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          Generar ▶
        </button>
        {report.data && (
          <p className="ml-auto text-2xl font-bold text-[#c0392b]">{money(report.data.total)}</p>
        )}
      </div>

      {report.isLoading && fetchEnabled && <LoadingState message="Generando reporte..." />}
      {report.isError && <ErrorState message={report.error.message} />}

      {report.data && (
        <>
          {/* Gráfico */}
          {report.data.byDay.length > 0 && (
            <div className="mb-5">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.data.byDay} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    tickFormatter={(v) => `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: any) => [money(Number(value)), "Recaudado"]}
                    labelFormatter={(label: any) => formatDate(String(label))}
                    contentStyle={{ borderRadius: 6, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="amount" fill="#49ad50" radius={[3, 3, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla de pagos */}
          <p className="mb-2 text-sm font-semibold text-slate-600">
            Pagos del periodo {formatDate(report.data.dateFrom)} al {formatDate(report.data.dateTo)}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  {["# Pago", "Fecha", "Paciente", "Responsable", "# Documento", "Tipo pago", "Medio pago", "Total"].map((h) => (
                    <th key={h} className="border border-slate-200 px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.data.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2 text-slate-500">{p.id.slice(-6).toUpperCase()}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {new Date(p.date).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 font-semibold uppercase text-[#0784d8]">{p.patient}</td>
                    <td className="border border-slate-200 px-3 py-2 uppercase">{p.responsible}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{p.documentNumber}</td>
                    <td className="border border-slate-200 px-3 py-2">{p.paymentType}</td>
                    <td className="border border-slate-200 px-3 py-2">{p.paymentMethod}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-semibold">{money(p.total)}</td>
                  </tr>
                ))}
                {report.data.payments.length === 0 && (
                  <tr>
                    <td className="border border-slate-200 px-3 py-8 text-center text-slate-400" colSpan={8}>
                      No hay pagos en el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!report.data && !report.isLoading && (
        <p className="text-sm text-slate-400">Selecciona un rango de fechas y haz click en "Generar".</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista 4: Pagos por período por profesional
// ──────────────────────────────────────────────────────────────────────────────
function PaymentsByProfessionalView({ branchId }: { branchId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [professionalId, setProfessionalId] = useState("");
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [showMethodSummary, setShowMethodSummary] = useState(false);

  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const report = useCashPaymentsByProfessional({ branchId, dateFrom, dateTo, professionalId }, fetchEnabled);

  const handleGenerate = () => { if (professionalId) setFetchEnabled(true); };
  useEffect(() => { setFetchEnabled(false); }, [dateFrom, dateTo, professionalId]);

  // Agrupar por método de pago para el resumen
  const methodSummary = useMemo(() => {
    if (!report.data) return [];
    const map = new Map<string, { method: string; count: number; amount: number }>();
    for (const p of report.data.payments) {
      const current = map.get(p.paymentMethod) ?? { method: p.paymentMethod, count: 0, amount: 0 };
      current.count += 1;
      current.amount += p.amount;
      map.set(p.paymentMethod, current);
    }
    return [...map.values()];
  }, [report.data]);

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      {/* Header con selector de profesional y fechas */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-600">Pagos período de</p>
          <select
            className="h-9 min-w-[220px] rounded border border-slate-300 px-3 text-sm"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">-- Seleccione un profesional --</option>
            {professionals.data?.map((prof) => (
              <option key={prof.id} value={prof.id}>
                {prof.firstName} {prof.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm text-slate-500">
            del
            <input
              type="date"
              className="ml-1 h-9 rounded border border-slate-300 px-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-500">
            al
            <input
              type="date"
              className="ml-1 h-9 rounded border border-slate-300 px-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!professionalId || report.isFetching}
            className="flex h-9 items-center gap-1.5 rounded bg-[#49ad50] px-4 font-semibold text-white hover:bg-[#3d9944] disabled:opacity-50"
          >
            {report.isFetching ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            Generar ▶
          </button>
        </div>
      </div>

      {/* Mostrar/Ocultar resumen tipos de pago */}
      <button
        type="button"
        className="mb-3 text-sm text-[#0784d8] hover:underline"
        onClick={() => setShowMethodSummary((s) => !s)}
      >
        Mostrar/Esconder resumen de tipos de pago
      </button>

      {/* Resumen de tipos de pago (colapsable) */}
      {showMethodSummary && report.data && methodSummary.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-700">
                <th className="border border-slate-200 px-3 py-2">Medio de pago</th>
                <th className="border border-slate-200 px-3 py-2">Cantidad</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {methodSummary.map((row) => (
                <tr key={row.method}>
                  <td className="border border-slate-200 px-3 py-2">{row.method}</td>
                  <td className="border border-slate-200 px-3 py-2">{row.count}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-semibold">{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.isLoading && fetchEnabled && <LoadingState message="Generando reporte..." />}
      {report.isError && <ErrorState message={report.error.message} />}

      {/* Tabla de pagos */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white text-left text-slate-700">
              <th className="border border-slate-200 px-3 py-2 font-semibold">#</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold"># Trat.</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">Medio de pago</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">Nombre paciente</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">Recepción</th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                {report.data ? `Total: ${money(report.data.total)}` : "Monto"}
              </th>
            </tr>
          </thead>
          <tbody>
            {report.data?.payments.map((p) => (
              <tr key={p.number} className="hover:bg-slate-50">
                <td className="border border-slate-200 px-3 py-2 text-slate-500">{p.number}</td>
                <td className="border border-slate-200 px-3 py-2 text-[#0784d8]">{p.treatmentNumber}</td>
                <td className="border border-slate-200 px-3 py-2">{p.paymentMethod}</td>
                <td className="border border-slate-200 px-3 py-2 font-semibold uppercase">{p.patientName}</td>
                <td className="border border-slate-200 px-3 py-2 uppercase">{p.reception}</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{money(p.amount)}</td>
              </tr>
            ))}
            {(!report.data || report.data.payments.length === 0) && (
              <tr>
                <td className="border border-slate-200 px-3 py-8 text-center text-sm text-[#49ad50]" colSpan={6}>
                  ↑ Seleccione un profesional e intervalo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal Excel: Resumen de cajas entre dos fechas
// ──────────────────────────────────────────────────────────────────────────────
function ExcelExportModal({ open, onClose, branchId }: { open: boolean; onClose: () => void; branchId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!dateFrom || !dateTo) return;
    setIsDownloading(true);
    try {
      const { getCashBoxSummary } = await import("../services/payments.service");
      const data = await getCashBoxSummary({ branchId, dateFrom, dateTo });

      // Generamos CSV con los datos
      const rows = [
        ["Tipo", "Medio de pago", "Cantidad movimientos", "Total"],
        ...data.rows.map((r) => [r.type, r.method, String(r.count), String(r.amount)]),
        ["", "", "TOTAL", String(data.total)]
      ];
      const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumen-cajas-${dateFrom}-${dateTo}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error("Error al descargar reporte:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal open={open} title="Resumen de Cajas" onClose={onClose} size="md">
      <div className="space-y-5 p-2">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            DESDE
            <input
              type="date"
              className="mt-1 block h-10 w-full rounded border border-slate-300 px-3 text-sm font-normal"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            HASTA
            <input
              type="date"
              className="mt-1 block h-10 w-full rounded border border-slate-300 px-3 text-sm font-normal"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || !dateFrom || !dateTo}
            className="flex items-center gap-2 rounded bg-[#49ad50] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3d9944] disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {isDownloading ? "Descargando..." : "Descargar reporte"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

