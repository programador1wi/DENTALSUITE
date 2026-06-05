import { FormEvent, useMemo, useState } from "react";
import { Search, Printer } from "lucide-react";
import { useLocation } from "react-router-dom";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useCashRegisterDetail, useCashRegisters, usePaymentsMutations } from "../hooks/use-payments";
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
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
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
            <select className="h-10 rounded border border-slate-300 px-3" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        )}

        {isReports ? (
          <CashReports registers={rows} />
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

function CashReports({ registers }: { registers: CashRegister[] }) {
  const totalInitial = registers.reduce((sum, register) => sum + Number(register.openingAmount ?? 0), 0);
  const totalExpected = registers.reduce((sum, register) => sum + Number(register.expectedClosing ?? register.closingAmount ?? 0), 0);

  return (
    <div>
      <div className="relative mb-4 inline-block">
        <button className="border border-slate-300 bg-white px-6 py-3 text-slate-600">Reportes v</button>
        <div className="absolute left-0 top-full z-10 w-[370px] border border-slate-300 bg-white py-2 shadow-lg">
          {[
            "Resumen de recaudacion ultimos 10 dias",
            "Resumen cajas",
            "Pagos recibidos por periodo",
            "Pagos recibidos por periodo por profesional",
            "Resumen excel de cajas entre dos fechas"
          ].map((item) => (
            <button key={item} className="block w-full px-6 py-2 text-left text-slate-700 hover:bg-slate-50" type="button">{item}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Resumen cajas</p>
          <p className="text-3xl font-bold text-[#0784d8]">{registers.length}</p>
        </div>
        <div className="border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Saldo inicial</p>
          <p className="text-3xl font-bold text-[#0784d8]">{money(totalInitial)}</p>
        </div>
        <div className="border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Acumulado</p>
          <p className="text-3xl font-bold text-[#0784d8]">{money(totalExpected)}</p>
        </div>
      </div>
    </div>
  );
}
