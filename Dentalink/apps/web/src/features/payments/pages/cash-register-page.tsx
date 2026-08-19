import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, FileDown, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { usePermissions } from "@/hooks/use-permissions";
import { CollectionSummaryChart } from "../components/collection-summary-chart";
import { CashRegisterDetailModal } from "../components/cash-register-detail-modal";
import {
  useCashRegisters,
  usePaymentsMutations,
  useCashCollectionSummary,
  useCashBoxSummary,
  useCashPaymentsByPeriod,
  useCashPaymentsByProfessional
} from "../hooks/use-payments";
import type {
  CashRegister,
  CashRegisterDetail,
  CashRegisterMovement,
  CashRegisterStatus
} from "../services/payments.service";
import { APP_ROUTES } from "@/lib/routes";

const cashTabs = [
  { to: APP_ROUTES.cashRegister.open, label: "Cajas abiertas" },
  { to: APP_ROUTES.cashRegister.closed, label: "Cajas cerradas" },
  { to: APP_ROUTES.cashRegister.reports, label: "Reportes" },
  { to: APP_ROUTES.cashRegister.search, label: "Buscar caja" }
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
  const responsible = register.responsibleUser ?? register.openedBy;
  return `${responsible.firstName} ${responsible.lastName}`.trim() || "CAJA";
}

function personName(person?: { firstName?: string; lastName?: string } | null) {
  if (!person) return "-";
  return `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || "-";
}

function publicCashNumber(register: Pick<CashRegister, "publicNumber">) {
  return `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
}

function cashRegisterSearchLabel(register: CashRegister) {
  return `${publicCashNumber(register)} · ${userName(register)} · ${register.branch.name}`;
}

function paymentAgreement(movement: CashRegisterMovement) {
  const payment = movement.payment;
  if (!payment) return "-";

  const allocationAgreement = payment.allocations?.find(
    (allocation) => allocation.treatmentPlanItem?.agreement?.name
  )?.treatmentPlanItem?.agreement?.name;
  const planName = payment.allocations?.[0]?.treatmentPlanItem?.treatmentPlan?.name;

  return allocationAgreement ?? payment.patient.agreement?.name ?? planName ?? "Sin convenio";
}

export function CashRegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const isClosed = location.pathname.endsWith("/closed") || location.pathname.endsWith("/cerradas");
  const isReports = location.pathname.endsWith("/reports") || location.pathname.endsWith("/reportes");
  const isSearch = location.pathname.endsWith("/search") || location.pathname.endsWith("/buscar");
  const status: CashRegisterStatus | undefined =
    isReports || isSearch ? undefined : isClosed ? "CLOSED" : "OPEN";

  const user = useAuthStore((state) => state.user);
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const [branchId, setBranchId] = useState("");
  const [openFormVisible, setOpenFormVisible] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingRegister, setClosingRegister] = useState<CashRegister | null>(null);
  const [closeAmount, setCloseAmount] = useState("");
  const [closingCarryover, setClosingCarryover] = useState("0");
  const [closingNotes, setClosingNotes] = useState("");
  const [search, setSearch] = useState("");
  const [openedFrom, setOpenedFrom] = useState("");
  const [closedFrom, setClosedFrom] = useState("");
  const [selectedRegisterNumber, setSelectedRegisterNumber] = useState<string | null>(null);

  const branches = useBranches(undefined, "ACTIVE");
  const selectedBranchId = isSearch ? branchId || activeBranchId : activeBranchId;
  const activeBranch = useMemo(
    () => branches.data?.find((branch) => branch.id === activeBranchId),
    [branches.data, activeBranchId]
  );
  const cashRegisters = useCashRegisters({
    branchId: selectedBranchId || undefined,
    status,
    search: search || undefined,
    openedFrom: openedFrom || undefined,
    closedFrom: closedFrom || undefined
  });
  const previousSessions = useCashRegisters({ branchId: activeBranchId || undefined, status: "CLOSED" });
  const mutations = usePaymentsMutations();
  const canOpen = hasPermission("cash_register.open") || hasPermission("system.manage_all");
  const canClose = hasPermission("cash_register.close") || hasPermission("system.manage_all");

  const rows = useMemo(() => {
    const source = cashRegisters.data ?? [];
    if (!search) return source;
    const term = search.toLowerCase();
    return source.filter(
      (register) =>
        userName(register).toLowerCase().includes(term) ||
        publicCashNumber(register).toLowerCase().includes(term) ||
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
      {
        registerId: closingRegister.id,
        closingAmount: Number(closeAmount),
        closingCarryover: Number(closingCarryover),
        expectedVersion: closingRegister.version,
        notes: closingNotes.trim() || undefined
      },
      {
        onSuccess: () => {
          setClosingRegister(null);
          setCloseAmount("");
          setClosingCarryover("0");
          setClosingNotes("");
        }
      }
    );
  };

  const actions = (
    <Button
      type="button"
      onClick={() => setOpenFormVisible((visible) => !visible)}
      disabled={!activeBranchId || !canOpen}
    >
      + Abrir caja
    </Button>
  );

  if (cashRegisters.isError) return <ErrorState message={cashRegisters.error.message} />;

  return (
    <WarnerSuitePanel>
      <div className="px-3 pt-3 text-right text-sm">
        <button
          type="button"
          data-allow-multiline
          className="max-w-full whitespace-normal text-right font-medium text-[var(--text-brand)] hover:text-[var(--action-brand-hover)] hover:underline"
          onClick={() => navigate(APP_ROUTES.settings.paymentMethods)}
        >
          Configurar medios de pago para reportería y efectivo físico
        </button>
      </div>
      <ModuleTabs tabs={cashTabs} actions={actions} />

      <div className="p-3">
        <Alert
          variant="warning"
          size="sm"
          dismissible
          title="Atención"
          className="mb-4"
        >
          Los pagos reflejados en los resúmenes de estas secciones{" "}
          <strong className="font-semibold text-amber-950">no incluyen</strong> los pagos recibidos mediante descuentos por planilla.
        </Alert>

        {openFormVisible && (
          <form
            className="mb-[var(--space-4)] flex flex-wrap items-end gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-4)]"
            onSubmit={handleOpen}
          >
            <label className="w-full text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)] sm:w-auto">
              Sucursal
              <span className="mt-1 flex min-h-10 min-w-0 items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] font-[var(--weight-bold)] text-[var(--text-primary)] sm:min-w-[300px]">
                {activeBranch ? `Suc. ${activeBranch.name}` : "Seleccione sucursal en el encabezado"}
              </span>
            </label>
            <label className="w-full text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)] sm:w-auto">
              Usuario
              <span className="mt-1 flex min-h-10 min-w-0 items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] font-[var(--weight-bold)] text-[var(--text-primary)] sm:min-w-[220px]">
                {personName(user)}
              </span>
            </label>
            <label className="text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)]">
              Saldo anterior
              <span className="mt-1 flex h-10 w-[160px] items-center justify-end rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 font-semibold tabular-nums text-[var(--text-primary)]">
                {money(
                  previousSessions.data?.[0]?.closingCarryover ??
                    previousSessions.data?.[0]?.closingAmount ??
                    0
                )}
              </span>
            </label>
            <label className="text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)]">
              Abono inicial
              <input
                className="mt-1 block h-10 w-[160px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] text-right tabular-nums text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition-shadow"
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={!activeBranchId || mutations.openCashRegister.isPending}>
              Abrir caja
            </Button>
          </form>
        )}

        {isClosed && (
          <div className="mb-5 space-y-3">
            <h1 className="font-sans text-2xl font-bold text-[var(--text-primary)]">Cajas Cerradas</h1>
            <Card className="flex flex-wrap items-end gap-4 p-[var(--space-4)]">
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                Usuario:
                <EntitySearchBox
                  className="mt-1 w-full sm:w-[255px]"
                  inputClassName="h-10 rounded-[var(--radius-control)] border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-sm)] text-[var(--text-primary)]"
                  placeholder="Buscar usuario"
                  value={search}
                  onValueChange={setSearch}
                  items={search.trim() ? rows : []}
                  onSelect={(register) => {
                    setSearch(publicCashNumber(register));
                    navigate(APP_ROUTES.cashRegister.detail(publicCashNumber(register)));
                  }}
                  getItemKey={(register) => register.id}
                  emptyMessage="Sin cajas encontradas"
                  renderItem={(register) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {cashRegisterSearchLabel(register)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                        {dateTime(register.openedAt)}
                      </p>
                    </div>
                  )}
                />
              </label>
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                Fecha apertura desde:
                <input
                  type="date"
                  value={openedFrom}
                  onChange={(event) => setOpenedFrom(event.target.value)}
                  className="mt-1 block h-10 w-[160px] rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-center text-[var(--text-sm)] text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none"
                />
              </label>
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                Fecha cierre desde:
                <input
                  type="date"
                  value={closedFrom}
                  onChange={(event) => setClosedFrom(event.target.value)}
                  className="mt-1 block h-10 w-[160px] rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-center text-[var(--text-sm)] text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none"
                />
              </label>
              <Button type="button" size="sm">
                Filtrar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setOpenedFrom("");
                  setClosedFrom("");
                }}
              >
                × Quitar filtros
              </Button>
            </Card>
          </div>
        )}

        {isSearch && (
          <Card className="mb-4 flex flex-wrap items-center gap-3 p-[var(--space-4)]">
            <EntitySearchBox
              className="w-full sm:w-[320px]"
              inputClassName="h-10 rounded-[var(--radius-control)] border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-sm)] text-[var(--text-primary)]"
              placeholder="Buscar por folio, usuario, paciente o referencia"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? rows : []}
              onSelect={(register) => {
                setSearch(publicCashNumber(register));
                navigate(APP_ROUTES.cashRegister.detail(publicCashNumber(register)));
              }}
              getItemKey={(register) => register.id}
              emptyMessage="Sin cajas encontradas"
              renderItem={(register) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {cashRegisterSearchLabel(register)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                    {register.status} · {dateTime(register.openedAt)}
                  </p>
                </div>
              )}
            />
            <select
              aria-label="Sucursal de la caja"
              className="h-10 w-full min-w-0 max-w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[var(--text-sm)] text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none sm:w-auto"
              value={branchId || activeBranchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                if (event.target.value) setActiveBranchId(event.target.value);
              }}
            >
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Card>
        )}

        {isReports ? (
          <CashReports />
        ) : cashRegisters.isLoading ? (
          <LoadingState message="Cargando cajas..." />
        ) : !rows.length ? (
          <EmptyState title="Sin cajas" description="No hay cajas para los filtros seleccionados." />
        ) : (
          <CashTable
            rows={rows}
            closed={isClosed || isSearch}
            canClose={canClose}
            onClose={setClosingRegister}
            onDetail={(register) => setSelectedRegisterNumber(publicCashNumber(register))}
          />
        )}

        {closingRegister && (
          <form
            className="mt-[var(--space-4)] flex flex-wrap items-end gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-4)]"
            onSubmit={handleClose}
          >
            <div>
              <p className="text-[var(--text-sm)] font-[var(--weight-bold)] text-[var(--text-primary)]">
                Cerrar caja de {userName(closingRegister)}
              </p>
              <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                Saldo esperado: {money(closingRegister.expectedClosing ?? closingRegister.openingAmount)}
              </p>
            </div>
            <label className="text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)]">
              Efectivo contado
              <input
                className="mt-1 block h-10 w-[160px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] text-right tabular-nums text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition-shadow"
                type="number"
                min="0"
                step="0.01"
                value={closeAmount}
                onChange={(event) => setCloseAmount(event.target.value)}
              />
            </label>
            <label className="text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)]">
              Saldo que queda
              <input
                className="mt-1 block h-10 w-[160px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] text-right tabular-nums text-[var(--text-primary)]"
                type="number"
                min="0"
                max={closeAmount || undefined}
                step="0.01"
                value={closingCarryover}
                onChange={(event) => setClosingCarryover(event.target.value)}
              />
            </label>
            <label className="min-w-[260px] flex-1 text-[var(--text-sm)] text-[var(--text-primary)] font-[var(--weight-medium)]">
              Motivo u observaciones
              <input
                className="mt-1 block h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)]"
                value={closingNotes}
                onChange={(event) => setClosingNotes(event.target.value)}
                placeholder="Obligatorio si existe diferencia"
              />
            </label>
            <Button type="submit" disabled={mutations.closeCashRegister.isPending}>
              Cerrar caja
            </Button>
            <Button type="button" variant="ghost" onClick={() => setClosingRegister(null)}>
              Cancelar
            </Button>
          </form>
        )}

        <CashRegisterDetailModal
          open={Boolean(selectedRegisterNumber)}
          registerId={selectedRegisterNumber}
          onClose={() => setSelectedRegisterNumber(null)}
        />
      </div>
    </WarnerSuitePanel>
  );
}

function CashTable({
  rows,
  closed,
  canClose,
  onClose,
  onDetail
}: {
  rows: CashRegister[];
  closed: boolean;
  canClose: boolean;
  onClose: (register: CashRegister) => void;
  onDetail: (register: CashRegister) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="grid gap-3 2xl:hidden">
        {rows.map((register) => {
          const diff = Number(register.differenceAmount ?? 0);
          const income = Number(register.incomeTotal ?? 0);
          const expense = Number(register.expenseTotal ?? 0);
          const closingVal = closed
            ? Number(register.closingCarryover ?? register.closingAmount ?? 0)
            : Number(register.expectedClosing ?? register.openingAmount ?? 0);

          return (
            <article key={register.id} className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-2xs">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-[var(--text-primary)]" title={userName(register)}>{userName(register)}</h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]" title={register.branch.name}>{register.branch.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onDetail(register)} className="h-auto p-0 text-xs text-[var(--text-brand)] hover:bg-transparent hover:underline">
                  Ver detalle <Search className="h-3 w-3" />
                </Button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-[var(--border-default)] py-3 text-sm">
                <div><dt className="text-xs text-[var(--text-secondary)]">Apertura</dt><dd className="mt-0.5 font-medium tabular-nums">{date(register.openedAt)}</dd></div>
                {closed ? <div><dt className="text-xs text-[var(--text-secondary)]">Cierre</dt><dd className="mt-0.5 font-medium tabular-nums">{date(register.closedAt)}</dd></div> : null}
                <div><dt className="text-xs text-[var(--text-secondary)]">Abonos</dt><dd className="mt-0.5 font-mono font-semibold tabular-nums">{money(income)}</dd></div>
                <div><dt className="text-xs text-[var(--text-secondary)]">Gastos</dt><dd className="mt-0.5 font-mono font-semibold tabular-nums">{money(expense)}</dd></div>
                <div><dt className="text-xs text-[var(--text-secondary)]">{closed ? "Saldo cierre" : "Acumulado"}</dt><dd className="mt-0.5 font-mono font-semibold tabular-nums">{money(closingVal)}</dd></div>
                {closed ? <div><dt className="text-xs text-[var(--text-secondary)]">Diferencia</dt><dd className="mt-0.5 font-mono font-semibold tabular-nums">{money(diff)}</dd></div> : null}
              </dl>
              {!closed && canClose ? (
                <div className="mt-3 flex justify-end"><Button variant="secondary" size="sm" onClick={() => onClose(register)}>Cerrar caja</Button></div>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xs 2xl:block">
      <table className="w-full border-collapse font-sans text-[var(--text-sm)]">
        <thead>
          <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <th className="border-r border-[var(--border-default)] px-3.5 py-3 whitespace-nowrap">Usuario</th>
            <th className="border-r border-[var(--border-default)] px-3.5 py-3 whitespace-nowrap">Sucursal</th>
            <th className="border-r border-[var(--border-default)] px-3.5 py-3 whitespace-nowrap">Apertura</th>
            {closed && <th className="border-r border-[var(--border-default)] px-3.5 py-3 whitespace-nowrap">Cierre</th>}
            <th className="border-r border-[var(--border-default)] px-3.5 py-3 whitespace-nowrap">Acciones</th>
            <th className="border-r border-[var(--border-default)] px-3.5 py-3 text-right whitespace-nowrap">Abonos</th>
            <th className="border-r border-[var(--border-default)] px-3.5 py-3 text-right whitespace-nowrap">Gastos</th>
            <th className={`px-3.5 py-3 text-right whitespace-nowrap ${closed || (!closed && canClose) ? "border-r border-[var(--border-default)]" : ""}`}>
              {closed ? "Saldo cierre" : "Acumulado"}
            </th>
            {closed && <th className={`px-3.5 py-3 text-right whitespace-nowrap ${!closed && canClose ? "border-r border-[var(--border-default)]" : ""}`}>Diferencia</th>}
            {!closed && canClose && <th className="px-3.5 py-3 whitespace-nowrap text-center">Acción</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-default)] bg-[var(--bg-surface)]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={closed ? 9 : canClose ? 8 : 7} className="px-4 py-8 text-center text-xs text-[var(--text-tertiary)]">
                No existen registros registrados en este periodo.
              </td>
            </tr>
          ) : (
            rows.map((register) => {
              const diff = Number(register.differenceAmount ?? 0);
              const income = Number(register.incomeTotal ?? 0);
              const expense = Number(register.expenseTotal ?? 0);
              const closingVal = closed
                ? Number(register.closingCarryover ?? register.closingAmount ?? 0)
                : Number(register.expectedClosing ?? register.openingAmount ?? 0);

              return (
                <tr key={register.id} className="transition-colors hover:bg-[var(--bg-subtle)]/50">
                  <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {userName(register)}
                  </td>
                  <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                    {register.branch.name}
                  </td>
                  <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 whitespace-nowrap text-[var(--text-secondary)] tabular-nums text-xs">
                    {date(register.openedAt)}
                  </td>
                  {closed && (
                    <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 whitespace-nowrap text-[var(--text-secondary)] tabular-nums text-xs">
                      {date(register.closedAt)}
                    </td>
                  )}
                  <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDetail(register)}
                      className="h-auto p-0 font-medium text-[var(--text-brand)] hover:underline hover:bg-transparent text-xs inline-flex items-center gap-1"
                    >
                      Ver detalle <Search className="h-3 w-3" />
                    </Button>
                  </td>
                  <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 text-right tabular-nums font-mono text-xs text-[var(--text-primary)]">
                    {money(income)}
                  </td>
                  <td className="border-r border-[var(--border-default)] px-3.5 py-2.5 text-right tabular-nums font-mono text-xs text-[var(--text-secondary)]">
                    {money(expense)}
                  </td>
                  <td className={`px-3.5 py-2.5 text-right tabular-nums font-mono font-semibold text-xs text-[var(--text-primary)] ${closed || (!closed && canClose) ? "border-r border-[var(--border-default)]" : ""}`}>
                    {money(closingVal)}
                  </td>
                  {closed && (
                    <td className={`px-3.5 py-2.5 text-right whitespace-nowrap ${!closed && canClose ? "border-r border-[var(--border-default)]" : ""}`}>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-semibold tabular-nums border ${
                          diff < 0
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                            : diff > 0
                              ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]"
                        }`}
                      >
                        {money(diff)}
                      </span>
                    </td>
                  )}
                  {!closed && canClose && (
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onClose(register)}
                        className="h-7 px-2.5 text-xs rounded"
                      >
                        Cerrar caja
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export function CashRegisterDetailPanel({ register }: { register: CashRegisterDetail }) {
  const statusTone = register.status === "OPEN" ? "success" : "default";
  const saldoInicialTotal = Number(register.openingAmount ?? 0);
  const paymentTransactions = register.movements.filter(
    (movement) => movement.payment && movement.type === "INCOME" && movement.payment.status !== "VOIDED"
  );
  const expenseMovements = register.movements.filter((movement) => movement.type === "EXPENSE");
  const refundMovements = register.movements.filter((movement) => movement.type === "REFUND");
  const voidMovements = register.movements.filter((movement) => movement.type === "PAYMENT_VOID");
  const adjustmentMovements = register.movements.filter((movement) =>
    ["ADJUSTMENT", "MANUAL_INCOME", "MANUAL_EXPENSE", "WITHDRAWAL"].includes(movement.type)
  );
  const displayedExpected = register.expectedCashBalance ?? register.expectedClosing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3">
        <div>
          <p className="text-xl font-bold text-[var(--text-primary)]">
            Total caja {publicCashNumber(register)}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">(recaudado + saldo inicial - gastos)</p>
        </div>
        <p className="text-3xl font-bold text-[var(--text-success)]">{money(displayedExpected)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge
            value={
              register.status === "OPEN"
                ? "Caja abierta"
                : register.status === "CLOSING"
                  ? "En cierre"
                  : "Caja cerrada"
            }
            tone={register.status === "CLOSING" ? "warning" : statusTone}
          />
          <span className="text-sm text-[var(--text-secondary)]">{register.branch.name}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <table className="w-full border-collapse font-body text-sm">
          <tbody>
            <DetailRow
              label="Usuario"
              value={userName(register)}
              secondaryLabel="Sucursal"
              secondaryValue={register.branch.name}
            />
            <DetailRow
              label="Fecha apertura"
              value={dateTime(register.openedAt)}
              secondaryLabel="Apertura realizada por"
              secondaryValue={personName(register.openedBy)}
            />
            {register.status === "CLOSED" && (
              <DetailRow
                label="Fecha cierre"
                value={dateTime(register.closedAt)}
                secondaryLabel="Cierre realizado por"
                secondaryValue={personName(register.closedBy)}
              />
            )}
            <DetailRow label="Saldo anterior" value={money(register.previousBalance)} />
            <DetailRow
              label="Abono inicial"
              value={money(register.initialDeposit ?? register.openingTotal)}
            />
            <DetailRow label="Saldo inicial total" value={money(saldoInicialTotal)} strong />
            {register.paymentMethodTotals.map((method) => (
              <DetailRow
                key={`${method.name}-${method.type}`}
                label={`${method.name} (cantidad: ${method.count})`}
                value={money(method.amount)}
              />
            ))}
            <DetailRow label="Cobrado" value={money(register.incomeTotal)} strong />
            <DetailRow label="Gastos (-)" value={money(register.expenseTotal)} danger />
            <DetailRow label="Devoluciones (-)" value={money(register.refundTotal)} danger />
            {Number(register.voidTotal ?? 0) > 0 && (
              <DetailRow label="Pagos anulados (-)" value={money(register.voidTotal)} danger />
            )}
            {register.adjustmentTotal !== 0 && (
              <DetailRow label="Ajustes" value={money(register.adjustmentTotal)} />
            )}
            <DetailRow label="Efectivo esperado" value={money(displayedExpected)} strong />
            {register.status === "CLOSED" ? (
              <>
                <DetailRow label="Efectivo declarado" value={money(register.declaredCashBalance)} />
                <DetailRow
                  label="Saldo dejado en caja"
                  value={money(register.closingCarryover ?? register.closingAmount)}
                />
                <DetailRow label="Monto retirado" value={money(register.withdrawnAmount)} />
                <DetailRow
                  label="Diferencia"
                  value={money(register.differenceAmount)}
                  danger={Number(register.differenceAmount ?? 0) !== 0}
                  strong
                />
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-center font-sans text-sm font-bold text-[var(--text-brand-strong)]">
          Transacciones de la caja
        </div>
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse font-body text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left font-sans font-semibold text-[var(--text-secondary)]">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Nombre paciente</th>
                <th className="px-3 py-2.5">Medio de pago</th>
                <th className="px-3 py-2.5">Convenio</th>
                <th className="px-3 py-2.5">Vencimiento</th>
                <th className="px-3 py-2.5"># referencia</th>
                <th className="border border-slate-200 px-2 py-3">Factura</th>
                <th className="border border-slate-200 px-2 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {paymentTransactions.map((movement) => {
                const payment = movement.payment;
                if (!payment) return null;
                const amount =
                  movement.direction === "OUT" ? Number(movement.amount) * -1 : Number(movement.amount);
                return (
                  <tr key={movement.id}>
                    <td className="border border-slate-200 px-2 py-3 text-slate-500">
                      {payment.paymentNumber ? String(payment.paymentNumber).padStart(6, "0") : "SIN-NÚMERO"}
                    </td>
                    <td className="border border-slate-200 px-2 py-3 font-semibold text-[var(--text-brand)]">
                      {payment.patient.documentNumber ? `${payment.patient.documentNumber} ` : ""}
                      {personName(payment.patient)}
                    </td>
                    <td className="border border-slate-200 px-2 py-3">
                      {movement.paymentMethod?.name ?? payment.paymentMethod.name}
                    </td>
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
                  <td
                    className="border border-slate-200 px-3 py-8 text-center text-sm text-slate-500"
                    colSpan={8}
                  >
                    No hay pagos asociados a esta caja.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CashMovementTable
        title="Gastos asociados"
        rows={expenseMovements}
        emptyMessage="No hay gastos asociados a esta caja."
      />
      <CashMovementTable
        title="Devoluciones"
        rows={refundMovements}
        emptyMessage="No hay devoluciones asociadas a esta caja."
      />
      <VoidedPaymentsTable rows={voidMovements} />
      <CashMovementTable
        title="Ajustes y retiros"
        rows={adjustmentMovements}
        emptyMessage="No hay ajustes ni retiros asociados a esta caja."
      />

      <section className="border border-slate-200">
        <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          Auditoría
        </h3>
        {register.audit.length ? (
          <ol className="divide-y divide-slate-100">
            {register.audit.map((event) => (
              <li key={event.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[180px_1fr_220px]">
                <time className="text-slate-500">{dateTime(event.createdAt)}</time>
                <span className="font-semibold text-slate-700">
                  {event.action.replaceAll("_", " ")} · {event.entity}
                </span>
                <span className="text-slate-500 sm:text-right">{event.actorName}</span>
                {event.reason ? (
                  <p className="text-slate-500 sm:col-start-2 sm:col-span-2">{event.reason}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No hay eventos de auditoría asociados.
          </p>
        )}
      </section>
    </div>
  );
}

function VoidedPaymentsTable({ rows }: { rows: CashRegisterMovement[] }) {
  const groupedRows = Array.from(
    rows.reduce((groups, movement) => {
      const payment = movement.payment;
      if (!payment) return groups;
      const current = groups.get(payment.id);
      const methodName = movement.paymentMethod?.name ?? payment.paymentMethod.name;
      if (current) {
        current.amount += Number(movement.amount);
        if (!current.methods.includes(methodName)) current.methods.push(methodName);
        return groups;
      }
      groups.set(payment.id, {
        movement,
        payment,
        amount: Number(movement.amount),
        methods: [methodName]
      });
      return groups;
    }, new Map<string, { movement: CashRegisterMovement; payment: NonNullable<CashRegisterMovement["payment"]>; amount: number; methods: string[] }>())
  ).map(([, row]) => row);

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <h3 className="border-b border-[var(--border-default)] bg-[var(--status-danger-bg)] px-4 py-3 text-center text-sm font-bold text-[var(--text-danger)]">
        Pagos anulados de la caja
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left font-semibold text-[var(--text-secondary)]">
              <th className="px-3 py-2.5"># Pago</th>
              <th className="px-3 py-2.5">Nombre paciente</th>
              <th className="px-3 py-2.5">Eliminación</th>
              <th className="px-3 py-2.5">Eliminado por</th>
              <th className="px-3 py-2.5">Medio</th>
              <th className="px-3 py-2.5">Comentario</th>
              <th className="px-3 py-2.5 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {groupedRows.map(({ movement, payment, amount, methods }) => (
              <tr key={payment.id} className="align-top">
                <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                  {payment.paymentNumber
                    ? `PAG-${String(payment.paymentNumber).padStart(6, "0")}`
                    : "Sin número"}
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--text-brand)]">
                  {payment.patient.documentNumber ? `${payment.patient.documentNumber} · ` : ""}
                  {personName(payment.patient)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-[var(--text-secondary)]">
                  {dateTime(payment.voidedAt ?? movement.createdAt)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-[var(--text-secondary)]">
                  {personName(payment.voidedBy ?? movement.createdBy)}
                </td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">{methods.join(", ")}</td>
                <td className="max-w-[420px] px-3 py-3 leading-relaxed text-[var(--text-primary)]">
                  {payment.voidReason ?? movement.voidReason ?? movement.description ?? "Sin comentario"}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--text-danger)]">
                  {money(amount)}
                </td>
              </tr>
            ))}
            {!groupedRows.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-[var(--text-secondary)]" colSpan={7}>
                  No hay pagos anulados asociados a esta caja.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CashMovementTable({
  title,
  rows,
  emptyMessage
}: {
  title: string;
  rows: CashRegisterMovement[];
  emptyMessage: string;
}) {
  return (
    <section className="border border-slate-200">
      <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="border border-slate-200 px-2 py-2">Fecha</th>
              <th className="border border-slate-200 px-2 py-2">Número</th>
              <th className="border border-slate-200 px-2 py-2">Detalle</th>
              <th className="border border-slate-200 px-2 py-2">Medio</th>
              <th className="border border-slate-200 px-2 py-2">Responsable</th>
              <th className="border border-slate-200 px-2 py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((movement) => {
              const number = movement.expense
                ? `GAS-${String(movement.expense.publicNumber).padStart(6, "0")}`
                : movement.payment?.paymentNumber
                  ? `PAG-${String(movement.payment.paymentNumber).padStart(6, "0")}`
                  : movement.refund
                    ? "DEVOLUCIÓN"
                    : movement.type;
              const detail =
                movement.expense?.description ??
                movement.refund?.reason ??
                movement.voidReason ??
                movement.description ??
                "-";
              const signedAmount =
                movement.direction === "OUT" ? Number(movement.amount) * -1 : Number(movement.amount);
              return (
                <tr key={movement.id}>
                  <td className="border border-slate-200 px-2 py-2">{dateTime(movement.createdAt)}</td>
                  <td className="border border-slate-200 px-2 py-2 font-semibold text-slate-700">{number}</td>
                  <td className="border border-slate-200 px-2 py-2">{detail}</td>
                  <td className="border border-slate-200 px-2 py-2">
                    {movement.paymentMethod?.name ?? movement.payment?.paymentMethod.name ?? "-"}
                  </td>
                  <td className="border border-slate-200 px-2 py-2">{personName(movement.createdBy)}</td>
                  <td
                    className={`border border-slate-200 px-2 py-2 text-right font-semibold ${signedAmount < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {money(signedAmount)}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td className="border border-slate-200 px-3 py-6 text-center text-slate-500" colSpan={6}>
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
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
    <tr
      className={`border-b border-[var(--border-default)] ${strong ? "bg-[var(--bg-subtle)] font-bold" : ""}`}
    >
      <td className="w-[28%] px-3 py-2 font-semibold text-[var(--text-secondary)]">{label}</td>
      <td
        className={`px-3 py-2 text-right ${danger ? "font-bold text-[var(--text-danger)]" : "text-[var(--text-primary)]"}`}
      >
        {value}
      </td>
      {secondaryLabel ? (
        <>
          <td className="w-[24%] px-3 py-2 font-semibold text-[var(--text-secondary)]">{secondaryLabel}</td>
          <td className="px-3 py-2 text-right text-[var(--text-primary)]">{secondaryValue}</td>
        </>
      ) : (
        <td className="px-3 py-2" colSpan={2} />
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

  const handleSelectReport = useCallback((value: ReportType | "excel-export") => {
    setIsDropdownOpen(false);
    if (value === "excel-export") {
      setShowExcelModal(true);
    } else {
      setSelectedReport(value);
    }
  }, []);

  return (
    <div>
      {/* ── Dropdown de tipo de reporte ─────────────────────── */}
      <div className="relative mb-5 block max-w-full sm:inline-block" ref={dropdownRef}>
        <button
          type="button"
          data-allow-multiline
          onClick={() => setIsDropdownOpen((open) => !open)}
          className="flex min-h-10 w-full max-w-full items-center justify-between gap-2 whitespace-normal rounded border border-slate-300 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto sm:justify-start sm:px-5"
        >
          {selectedLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-[min(370px,calc(100vw-2rem))] rounded border border-slate-200 bg-white py-1 shadow-xl">
            {/* Grupo 1 */}
            {reportOptions.slice(0, 2).map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-allow-multiline
                onClick={() => handleSelectReport(opt.value)}
                className={`block w-full whitespace-normal px-5 py-2 text-left text-sm ${
                  opt.value === selectedReport
                    ? "bg-[var(--action-brand)] font-semibold text-white"
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
                data-allow-multiline
                onClick={() => handleSelectReport(opt.value)}
                className={`block w-full whitespace-normal px-5 py-2 text-left text-sm ${
                  opt.value === selectedReport
                    ? "bg-[var(--action-brand)] font-semibold text-white"
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
                data-allow-multiline
                onClick={() => handleSelectReport(opt.value)}
                className="block w-full whitespace-normal px-5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
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
      {selectedReport === "payments-by-professional" && (
        <PaymentsByProfessionalView branchId={activeBranchId} />
      )}

      {/* ── Modal Excel ──────────────────────────────────────── */}
      <ExcelExportModal
        open={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        branchId={activeBranchId}
      />
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
  if (!data)
    return <EmptyState title="Sin datos" description="No hay datos de recaudación para esta sucursal." />;
  if (data.byDay.length === 0)
    return (
      <EmptyState title="Sin movimientos" description="No se registraron pagos en los últimos 10 días." />
    );

  return <CollectionSummaryChart data={data} />;
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
  useEffect(() => {
    setFetchEnabled(false);
  }, [dateFrom, dateTo]);

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
          className="flex h-10 items-center gap-2 rounded bg-[var(--action-brand)] px-5 font-semibold text-white hover:bg-[var(--action-brand-hover)] disabled:opacity-60"
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
                  <th className="border border-slate-200 px-4 py-2 text-right font-semibold text-[var(--text-brand)]">
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
                    <td className="border border-slate-200 px-4 py-2 text-right font-semibold">
                      {money(row.amount)}
                    </td>
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
  useEffect(() => {
    setFetchEnabled(false);
  }, [dateFrom, dateTo]);

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
                  <XAxis
                    dataKey="date"
                    tickFormatter={tickFormatter}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
                    }
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [money(Number(value)), "Recaudado"]}
                    labelFormatter={(label: unknown) => formatDate(String(label))}
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
                  {[
                    "# Pago",
                    "Fecha",
                    "Paciente",
                    "Responsable",
                    "# Documento",
                    "Tipo pago",
                    "Medio pago",
                    "Total"
                  ].map((h) => (
                    <th key={h} className="border border-slate-200 px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.data.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2 text-slate-500">
                      {p.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {new Date(p.date).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 font-semibold uppercase text-[#0784d8]">
                      {p.patient}
                    </td>
                    <td className="border border-slate-200 px-3 py-2 uppercase">{p.responsible}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{p.documentNumber}</td>
                    <td className="border border-slate-200 px-3 py-2">{p.paymentType}</td>
                    <td className="border border-slate-200 px-3 py-2">{p.paymentMethod}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                      {money(p.total)}
                    </td>
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

  const professionals = useProfessionals(undefined, "true", {
    branchId: branchId || undefined,
    pageSize: 100
  });
  const report = useCashPaymentsByProfessional({ branchId, dateFrom, dateTo, professionalId }, fetchEnabled);

  const handleGenerate = () => {
    if (professionalId) setFetchEnabled(true);
  };
  useEffect(() => {
    setFetchEnabled(false);
  }, [dateFrom, dateTo, professionalId]);

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
                  <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                    {money(row.amount)}
                  </td>
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
                <td
                  className="border border-slate-200 px-3 py-8 text-center text-sm text-[#49ad50]"
                  colSpan={6}
                >
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
function ExcelExportModal({
  open,
  onClose,
  branchId
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
}) {
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
