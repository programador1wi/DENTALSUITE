import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { DentalinkPanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { useCashRegisters, usePaymentsMutations } from "../hooks/use-payments";
import type { CashRegister, CashRegisterStatus } from "../services/payments.service";

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

function userName(register: CashRegister) {
  return `${register.openedBy.firstName} ${register.openedBy.lastName}`.trim() || "CAJA";
}

export function CashRegisterPage() {
  const location = useLocation();
  const isClosed = location.pathname.endsWith("/closed");
  const isReports = location.pathname.endsWith("/reports");
  const isSearch = location.pathname.endsWith("/search");
  const status: CashRegisterStatus | "" = isReports || isSearch ? "" : isClosed ? "CLOSED" : "OPEN";

  const [branchId, setBranchId] = useState("");
  const [openFormVisible, setOpenFormVisible] = useState(false);
  const [openBranchId, setOpenBranchId] = useState("");
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingRegister, setClosingRegister] = useState<CashRegister | null>(null);
  const [closeAmount, setCloseAmount] = useState("");
  const [search, setSearch] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const cashRegisters = useCashRegisters({ branchId: branchId || undefined, status });
  const mutations = usePaymentsMutations();

  const rows = useMemo(() => {
    const source = cashRegisters.data ?? [];
    if (!search) return source;
    return source.filter((register) => userName(register).toLowerCase().includes(search.toLowerCase()) || register.id.toLowerCase().includes(search.toLowerCase()));
  }, [cashRegisters.data, search]);

  const handleOpen = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!openBranchId || Number(openingAmount) < 0) return;
    mutations.openCashRegister.mutate(
      { branchId: openBranchId, openingAmount: Number(openingAmount) },
      { onSuccess: () => setOpenFormVisible(false) }
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
      className="rounded bg-[#49ad50] px-4 py-2 text-lg font-bold text-white shadow-sm hover:bg-[#3d9944]"
    >
      + Abrir caja
    </button>
  );

  if (cashRegisters.isError) return <ErrorState message={cashRegisters.error.message} />;

  return (
    <DentalinkPanel>
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
              <select className="mt-1 block h-10 min-w-[260px] rounded border border-slate-300 px-3" value={openBranchId} onChange={(event) => setOpenBranchId(event.target.value)}>
                <option value="">Seleccione sucursal</option>
                {branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Saldo inicial
              <input className="mt-1 block h-10 w-[160px] rounded border border-slate-300 px-3" type="number" min="0" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
            </label>
            <button className="h-10 rounded bg-[#0784d8] px-5 font-bold text-white" disabled={!openBranchId || mutations.openCashRegister.isPending}>
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
                <input className="mt-1 block h-11 w-[255px] rounded border border-slate-300 px-3 text-lg" placeholder="Buscar usuario" value={search} onChange={(event) => setSearch(event.target.value)} />
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
            <input className="h-10 w-[320px] rounded border border-slate-300 px-3" placeholder="Buscar caja por usuario o ID" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="h-10 rounded border border-slate-300 px-3" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Todas las sucursales</option>
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
          <CashTable rows={rows} closed={isClosed || isSearch} onClose={setClosingRegister} />
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
    </DentalinkPanel>
  );
}

function CashTable({ rows, closed, onClose }: { rows: CashRegister[]; closed: boolean; onClose: (register: CashRegister) => void }) {
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
              <td className="border border-slate-200 px-3 py-3 text-[#0784d8]">ver detalle Q</td>
              <td className="border border-slate-200 px-3 py-3 text-right">{money(0)}</td>
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

function CashReports({ registers }: { registers: CashRegister[] }) {
  const totalInitial = registers.reduce((sum, register) => sum + Number(register.openingAmount ?? 0), 0);
  const totalExpected = registers.reduce((sum, register) => sum + Number(register.expectedClosing ?? register.closingAmount ?? 0), 0);

  return (
    <div>
      <div className="relative mb-4 inline-block">
        <button className="border border-slate-300 bg-white px-6 py-3 text-slate-600 shadow-sm">Reportes v</button>
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
