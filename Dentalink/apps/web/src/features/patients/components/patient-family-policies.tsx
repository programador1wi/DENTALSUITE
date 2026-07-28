import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  History,
  Search,
  ShieldCheck,
  ShieldX,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import {
  useTreatmentPlan,
  useTreatmentPlans,
} from "@/features/treatments/hooks/use-treatments";
import { useAuthStore } from "@/stores/auth.store";
import {
  useFamilyPolicyMutations,
  usePatientPolicies,
  usePatientPolicyDetail,
  usePolicyCoverageMutations,
  usePolicyProducts,
} from "../hooks/use-family-policies";
import type {
  FamilyPolicyDetail,
  FamilyPolicySummary,
  PolicyProduct,
  PolicyStatus,
} from "../services/family-policies.service";
import type { FamilyGroup } from "../services/patient-identity.service";

type Props = {
  patientId: string;
  patientName: string;
  familyGroup?: FamilyGroup;
  compactHeader?: boolean;
};

const STATUS_LABELS: Record<PolicyStatus, string> = {
  DRAFT: "Borrador",
  PENDING_PAYMENT: "Pendiente de pago",
  PAID_PENDING_ACTIVATION: "Pagada, pendiente de inicio",
  ACTIVE: "Activa",
  WAITING_PERIOD: "Periodo de espera",
  SUSPENDED: "Suspendida",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
  REPLACED: "Reemplazada",
};
const TYPE_LABELS = {
  INDIVIDUAL: "Individual",
  DUAL: "Dual",
  FAMILY: "Familiar",
} as const;
const ROLE_LABELS: Record<string, string> = {
  HOLDER: "Titular",
  BENEFICIARY: "Beneficiario",
};
const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Pago parcial",
  PAID: "Pagada",
  REFUNDED: "Reembolsada",
};
type Filter = "ACTIVE" | "PENDING" | "HISTORY" | "ALL";

export function PatientFamilyPolicies({
  patientId,
  patientName,
  familyGroup,
  compactHeader = false,
}: Props) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRead = hasPermission("family_policies.read");
  const canCreate = hasPermission("family_policies.create");
  const canPay =
    hasPermission("family_policies.activate") &&
    hasPermission("payments.create");
  const policies = usePatientPolicies(patientId, canRead);
  const products = usePolicyProducts(canRead && canCreate);
  const paymentMethods = usePaymentMethods(undefined, "true", canPay);
  const mutations = useFamilyPolicyMutations(patientId);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [detailNumber, setDetailNumber] = useState<string>();
  const [contracting, setContracting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([
    patientId,
  ]);
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [contractedPrice, setContractedPrice] = useState("");
  const [paymentPolicy, setPaymentPolicy] = useState<FamilyPolicySummary>();
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const selectedProduct = products.data?.find(
    (product) => product.id === selectedProductId,
  );
  const allPolicies = policies.data?.items ?? [];

  const visiblePolicies = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    return allPolicies.filter((policy) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "ACTIVE" && policy.status === "ACTIVE") ||
        (filter === "PENDING" &&
          [
            "DRAFT",
            "PENDING_PAYMENT",
            "PAID_PENDING_ACTIVATION",
            "WAITING_PERIOD",
          ].includes(policy.status)) ||
        (filter === "HISTORY" &&
          ["EXPIRED", "CANCELLED", "REPLACED"].includes(policy.status));
      if (!matchesFilter) return false;
      if (!needle) return true;
      return [
        policy.policyNumber,
        policy.familyNumber,
        policy.product.name,
        policy.holder.name,
        policy.origin.branchName,
        policy.origin.brandName,
      ].some((value) => value?.toLocaleLowerCase("es").includes(needle));
    });
  }, [allPolicies, filter, search]);

  if (!canRead) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-3">
          <ShieldX className="h-5 w-5 text-amber-700" />
          <div>
            <p className="font-semibold text-slate-900">
              Sin permiso para consultar pólizas
            </p>
            <p className="text-sm text-slate-600">
              Ver la ficha no concede acceso a contratos ni consumos.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const selectProduct = (product: PolicyProduct) => {
    setSelectedProductId(product.id);
    setContractedPrice(
      Number(product.basePrice) > 0 ? String(product.basePrice) : "",
    );
    setSelectedMemberIds([patientId]);
  };
  const toggleMember = (memberPatientId: string) => {
    if (!selectedProduct || memberPatientId === patientId) return;
    setSelectedMemberIds((current) =>
      current.includes(memberPatientId)
        ? current.filter((id) => id !== memberPatientId)
        : current.length < selectedProduct.maximumMembers
          ? [...current, memberPatientId]
          : current,
    );
  };
  const submitContract = async () => {
    if (!selectedProduct || Number(contractedPrice) <= 0) return;
    await mutations.create.mutateAsync({
      policyProductId: selectedProduct.id,
      familyGroupId:
        selectedProduct.modality === "INDIVIDUAL" ? undefined : familyGroup?.id,
      holderPatientId: patientId,
      memberPatientIds: selectedMemberIds,
      effectiveFrom,
      contractedPrice: Number(contractedPrice),
      currency: selectedProduct.currency,
    });
    setContracting(false);
    setFilter("PENDING");
    setSelectedProductId("");
  };
  const openPayment = (policy: FamilyPolicySummary) => {
    setPaymentPolicy(policy);
    setPaymentAmount(String(Math.max(Number(policy.financial.balance), 0)));
    setPaymentMethodId(paymentMethods.data?.[0]?.id ?? "");
    setPaymentReference("");
  };
  const submitPayment = async () => {
    if (!paymentPolicy || !paymentMethodId || Number(paymentAmount) <= 0)
      return;
    await mutations.pay.mutateAsync({
      policyNumber: paymentPolicy.policyNumber,
      payload: {
        paymentMethodId,
        amount: Number(paymentAmount),
        reference: paymentReference || undefined,
        idempotencyKey: `policy-${paymentPolicy.policyNumber}-${crypto.randomUUID()}`,
      },
    });
    setPaymentPolicy(undefined);
  };
  const canSubmitContract = Boolean(
    selectedProduct &&
    Number(contractedPrice) > 0 &&
    selectedMemberIds.length >= selectedProduct.minimumMembers &&
    selectedMemberIds.length <= selectedProduct.maximumMembers &&
    (selectedProduct.modality === "INDIVIDUAL" || familyGroup),
  );

  return (
    <section className="space-y-4">
      {compactHeader ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Ficha del paciente
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Beneficios y coberturas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Consulta las pólizas, beneficios, coberturas y consumos asociados
              al paciente.
            </p>
          </div>
          {canCreate ? (
            <Button onClick={() => setContracting((value) => !value)}>
              {contracting ? "Cerrar contratación" : "Comprar póliza"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Contratos del paciente
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">
              Pólizas y participación
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Una póliza compartida aparece en cada ficha, respetando rol,
              vigencia y consumo propio.
            </p>
          </div>
          {canCreate ? (
            <Button onClick={() => setContracting((value) => !value)}>
              {contracting ? "Cerrar contratación" : "Comprar póliza"}
            </Button>
          ) : null}
        </div>
      )}

      {contracting ? (
        <ContractPanel
          patientId={patientId}
          patientName={patientName}
          familyGroup={familyGroup}
          products={products.data ?? []}
          selectedProduct={selectedProduct}
          selectedMemberIds={selectedMemberIds}
          effectiveFrom={effectiveFrom}
          contractedPrice={contractedPrice}
          saving={mutations.create.isPending}
          canSubmit={canSubmitContract}
          onSelectProduct={selectProduct}
          onToggleMember={toggleMember}
          onEffectiveFrom={setEffectiveFrom}
          onContractedPrice={setContractedPrice}
          onSubmit={() => void submitContract()}
        />
      ) : null}

      {paymentPolicy ? (
        <Card className="border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="font-semibold text-slate-900">
                Registrar pago · {paymentPolicy.policyNumber}
              </p>
              <p className="text-sm text-slate-600">
                La cobertura se habilita únicamente al validar el total.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Select
              value={paymentMethodId}
              onChange={(event) => setPaymentMethodId(event.target.value)}
            >
              <option value="">Método de pago</option>
              {paymentMethods.data?.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
            />
            <Input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="Referencia opcional"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPaymentPolicy(undefined)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={
                !paymentMethodId ||
                Number(paymentAmount) <= 0 ||
                mutations.pay.isPending
              }
              onClick={() => void submitPayment()}
            >
              Confirmar pago
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Filtrar pólizas"
        >
          {(
            [
              ["ACTIVE", "Activas", policies.data?.summary.active ?? 0],
              ["PENDING", "Pendientes", policies.data?.summary.pending ?? 0],
              ["HISTORY", "Historial", policies.data?.summary.history ?? 0],
              ["ALL", "Todas", allPolicies.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${filter === value ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-950"}`}
            >
              {label}{" "}
              <span className="ml-1 text-xs text-slate-400">{count}</span>
            </button>
          ))}
        </div>
        {allPolicies.length > 1 ? (
          <label className="relative block w-full lg:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar póliza, titular o sucursal"
            />
          </label>
        ) : null}
      </div>

      {policies.isLoading ? <PolicySkeleton /> : null}
      {policies.isError ? (
        <Card className="border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-900">
            No fue posible cargar los beneficios y coberturas.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => void policies.refetch()}
          >
            Reintentar
          </Button>
        </Card>
      ) : null}
      {!policies.isLoading &&
      !policies.isError &&
      visiblePolicies.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">
            {allPolicies.length
              ? "No hay pólizas que coincidan con el filtro."
              : "No hay beneficios o pólizas asociados a este paciente."}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Crear un grupo familiar no genera cobertura automáticamente.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {visiblePolicies.map((policy) => (
          <PolicyCard
            key={policy.policyNumber}
            policy={policy}
            canPay={canPay}
            onDetail={() => setDetailNumber(policy.policyNumber)}
            onPay={() => openPayment(policy)}
          />
        ))}
      </div>
      <PolicyDetailModal
        patientId={patientId}
        policyNumber={detailNumber}
        onClose={() => setDetailNumber(undefined)}
      />
    </section>
  );
}

function PolicyCard({
  policy,
  canPay,
  onDetail,
  onPay,
}: {
  policy: FamilyPolicySummary;
  canPay: boolean;
  onDetail: () => void;
  onPay: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                value={STATUS_LABELS[policy.status]}
                tone={statusTone(policy.status)}
              />
              <Badge value={TYPE_LABELS[policy.product.type]} tone="brand" />
            </div>
            <h4 className="mt-3 truncate text-lg font-semibold text-slate-950">
              {policy.product.name}
            </h4>
            <p className="mt-1 font-mono text-sm font-semibold text-blue-700">
              {policy.policyNumber}
            </p>
          </div>
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${policy.coverageSummary.available ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
          >
            <ShieldCheck className="h-5 w-5" />
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
        <Fact
          label="Participación"
          value={
            ROLE_LABELS[policy.patientParticipation.role] ??
            policy.patientParticipation.role
          }
        />
        <Fact label="Titular" value={policy.holder.name} />
        <Fact label="Familia" value={policy.familyNumber ?? "No aplica"} mono />
        <Fact
          label="Integrantes"
          value={`${policy.members.current} de ${policy.members.maximum}`}
        />
        <Fact
          label="Vigencia"
          value={`${shortDate(policy.period.startsAt)} — ${shortDate(policy.period.expiresAt)}`}
        />
        <Fact label="Sucursal" value={policy.origin.branchName} />
      </div>
      <div className="grid grid-cols-3 border-y border-slate-100 bg-slate-50/80 px-4 py-3 text-center">
        <Metric label="Reglas" value={policy.coverageSummary.activeRules} />
        <Metric
          label="Cubierto usado"
          value={money(
            policy.coverageSummary.coveredAmountUsed,
            policy.financial.currency,
          )}
        />
        <Metric
          label="Saldo póliza"
          value={money(policy.financial.balance, policy.financial.currency)}
          warning={Number(policy.financial.balance) > 0}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <p className="text-xs font-medium text-slate-500">
          Pago:{" "}
          {PAYMENT_LABELS[policy.financial.status] ?? policy.financial.status}
        </p>
        <div className="flex gap-2">
          {canPay && ["DRAFT", "PENDING_PAYMENT"].includes(policy.status) ? (
            <Button size="sm" variant="secondary" onClick={onPay}>
              <CreditCard className="h-4 w-4" /> Registrar pago
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onDetail}>
            Ver detalle <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

type ContractProps = {
  patientId: string;
  patientName: string;
  familyGroup?: FamilyGroup;
  products: PolicyProduct[];
  selectedProduct?: PolicyProduct;
  selectedMemberIds: string[];
  effectiveFrom: string;
  contractedPrice: string;
  saving: boolean;
  canSubmit: boolean;
  onSelectProduct: (product: PolicyProduct) => void;
  onToggleMember: (id: string) => void;
  onEffectiveFrom: (value: string) => void;
  onContractedPrice: (value: string) => void;
  onSubmit: () => void;
};
function ContractPanel(props: ContractProps) {
  const {
    patientId,
    patientName,
    familyGroup,
    products,
    selectedProduct,
    selectedMemberIds,
  } = props;
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-slate-950 px-5 py-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
          Nueva contratación
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Titular: {patientName}. Cobertura inicia solo después de pago y reglas
          de vigencia.
        </p>
      </div>
      <div className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          {products.map((product) => {
            const disabled = product.modality !== "INDIVIDUAL" && !familyGroup;
            const selected = selectedProduct?.id === product.id;
            return (
              <button
                key={product.id}
                type="button"
                disabled={disabled}
                onClick={() => props.onSelectProduct(product)}
                className={`relative rounded-xl border p-4 text-left transition ${selected ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-400"} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {selected ? (
                  <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-700" />
                ) : null}
                <p className="font-mono text-xs font-bold text-slate-400">
                  {product.productCode}
                </p>
                <p className="mt-2 font-semibold text-slate-950">
                  {product.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {product.minimumMembers === product.maximumMembers
                    ? `${product.maximumMembers} persona${product.maximumMembers === 1 ? "" : "s"}`
                    : `${product.minimumMembers} a ${product.maximumMembers} personas`}
                </p>
                {disabled ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Requiere grupo familiar
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
        {selectedProduct ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Inicio de vigencia
                <Input
                  className="mt-1"
                  type="date"
                  value={props.effectiveFrom}
                  onChange={(event) =>
                    props.onEffectiveFrom(event.target.value)
                  }
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Precio contratado ({selectedProduct.currency})
                <Input
                  className="mt-1"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={props.contractedPrice}
                  onChange={(event) =>
                    props.onContractedPrice(event.target.value)
                  }
                />
              </label>
            </div>
            <div>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    Integrantes cubiertos
                  </p>
                  <p className="text-xs text-slate-500">
                    Titular cuenta dentro del límite.
                  </p>
                </div>
                <p className="text-sm font-bold text-blue-700">
                  {selectedMemberIds.length} de {selectedProduct.maximumMembers}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
                  <span>
                    <b className="block text-sm">{patientName}</b>
                    <small className="text-emerald-700">Titular</small>
                  </span>
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                </div>
                {selectedProduct.modality !== "INDIVIDUAL"
                  ? familyGroup?.members
                      .filter((member) => member.patientId !== patientId)
                      .map((member) => {
                        const selected = selectedMemberIds.includes(
                          member.patientId,
                        );
                        return (
                          <button
                            key={member.id}
                            type="button"
                            disabled={
                              !selected &&
                              selectedMemberIds.length >=
                                selectedProduct.maximumMembers
                            }
                            onClick={() =>
                              props.onToggleMember(member.patientId)
                            }
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left ${selected ? "border-blue-300 bg-blue-50" : "border-slate-200"} disabled:opacity-40`}
                          >
                            <span>
                              <b className="block text-sm">
                                {member.patient.firstName}{" "}
                                {member.patient.lastName}
                              </b>
                              <small className="text-slate-500">
                                {member.relationship ?? "Integrante"}
                              </small>
                            </span>
                            {selected ? (
                              <Check className="h-4 w-4 text-blue-700" />
                            ) : null}
                          </button>
                        );
                      })
                  : null}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!props.canSubmit || props.saving}
              onClick={props.onSubmit}
            >
              Crear borrador y número de póliza
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function PolicyDetailModal({
  patientId,
  policyNumber,
  onClose,
}: {
  patientId: string;
  policyNumber?: string;
  onClose: () => void;
}) {
  const query = usePatientPolicyDetail(patientId, policyNumber);
  const canApply = useAuthStore((state) =>
    state.hasPermission("family_policies.coverage.apply"),
  );
  return (
    <Modal
      open={Boolean(policyNumber)}
      title={policyNumber ? `Póliza ${policyNumber}` : "Detalle de póliza"}
      size="xl"
      onClose={onClose}
    >
      {query.isLoading ? <PolicySkeleton /> : null}
      {query.isError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          No fue posible cargar el detalle.
        </p>
      ) : null}
      {query.data ? (
        <PolicyDetailContent
          policy={query.data}
          patientId={patientId}
          canApply={canApply}
        />
      ) : null}
    </Modal>
  );
}

function PolicyDetailContent({
  policy,
  patientId,
  canApply,
}: {
  policy: FamilyPolicyDetail;
  patientId: string;
  canApply: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl bg-slate-950 p-4 text-white md:grid-cols-4">
        <DarkFact label="Producto" value={policy.product.name} />
        <DarkFact label="Estado" value={STATUS_LABELS[policy.status]} />
        <DarkFact
          label="Participación"
          value={
            policy.patientParticipation
              ? (ROLE_LABELS[policy.patientParticipation.role] ??
                policy.patientParticipation.role)
              : "Administrativa"
          }
        />
        <DarkFact
          label="Vigencia"
          value={`${shortDate(policy.period.startsAt)} — ${shortDate(policy.period.expiresAt)}`}
        />
      </div>
      <Section
        title="Titular y origen"
        icon={<UsersRound className="h-4 w-4" />}
      >
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <Fact label="Titular" value={policy.holder.name} />
          <Fact
            label="Contacto"
            value={policy.holder.phone ?? policy.holder.email ?? "Sin contacto"}
          />
          <Fact
            label="Sucursal"
            value={`${policy.origin.brandName ? `${policy.origin.brandName} · ` : ""}${policy.origin.branchName}`}
          />
        </div>
      </Section>
      <Section
        title={`Integrantes (${policy.members.filter((member) => !member.removedAt).length} de ${policy.product.maximumMembers})`}
        icon={<UsersRound className="h-4 w-4" />}
      >
        <div className="divide-y divide-slate-100">
          {policy.members.map((member, index) => (
            <div
              key={`${member.name}-${index}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{member.name}</p>
                <p className="text-slate-500">
                  {ROLE_LABELS[member.role] ?? member.role} ·{" "}
                  {member.relationship ?? "Sin parentesco"}
                </p>
              </div>
              <Badge
                value={member.removedAt ? "Retirado" : member.status}
                tone={member.removedAt ? "danger" : "success"}
              />
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Coberturas y límites"
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        {!policy.coverages.length ? (
          <p className="text-sm text-slate-500">
            Producto sin reglas de cobertura configuradas. No puede aplicarse a
            tratamientos.
          </p>
        ) : (
          <div className="space-y-3">
            {policy.coverages.map((coverage, index) => (
              <div
                key={`${coverage.name}-${index}`}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {coverage.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {coverage.procedure?.name ??
                        coverage.category ??
                        "Cobertura general"}
                    </p>
                  </div>
                  <Badge value={coverageLabel(coverage)} tone="brand" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Fact
                    label="Usos"
                    value={
                      coverage.annualUseLimit == null
                        ? `${coverage.usedCount} utilizados`
                        : `${coverage.usedCount} usados · ${coverage.remainingUses} disponibles`
                    }
                  />
                  <Fact
                    label="Monto utilizado"
                    value={money(
                      coverage.usedAmount,
                      policy.financial.currency,
                    )}
                  />
                  <Fact
                    label="Espera"
                    value={
                      coverage.waitingPeriodDays
                        ? `${coverage.waitingPeriodDays} días`
                        : "Sin espera"
                    }
                  />
                  <Fact
                    label="Autorización"
                    value={
                      coverage.requiresAuthorization
                        ? "Requerida"
                        : "No requerida"
                    }
                  />
                </div>
                {coverage.exclusions ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Exclusiones: {coverage.exclusions}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Compra y pagos" icon={<CreditCard className="h-4 w-4" />}>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Fact
            label="Precio"
            value={money(
              policy.financial.contractedPrice,
              policy.financial.currency,
            )}
          />
          <Fact
            label="Pagado"
            value={money(
              policy.financial.paidAmount,
              policy.financial.currency,
            )}
          />
          <Fact
            label="Saldo"
            value={money(policy.financial.balance, policy.financial.currency)}
          />
          <Fact
            label="Estado"
            value={
              PAYMENT_LABELS[policy.financial.status] ?? policy.financial.status
            }
          />
        </div>
      </Section>
      <Section title="Consumos" icon={<History className="h-4 w-4" />}>
        {!policy.usages.length ? (
          <p className="text-sm text-slate-500">
            Sin consumos registrados para este paciente.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {policy.usages.map((usage, index) => (
              <div
                key={`${usage.appliedAt}-${index}`}
                className="grid gap-2 py-3 text-sm md:grid-cols-4"
              >
                <Fact label="Prestación" value={usage.procedure} />
                <Fact label="Fecha" value={shortDate(usage.appliedAt)} />
                <Fact
                  label="Cubierto"
                  value={money(usage.coveredAmount, policy.financial.currency)}
                />
                <Fact
                  label="Copago"
                  value={money(usage.copayAmount, policy.financial.currency)}
                />
              </div>
            ))}
          </div>
        )}
      </Section>
      {canApply && policy.status === "ACTIVE" ? (
        <UseInTreatmentPanel patientId={patientId} policy={policy} />
      ) : null}
      <Section
        title="Documentos e historial"
        icon={<FileText className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            {policy.documents.length ? (
              policy.documents.map((document) => (
                <a
                  key={`${document.type}-${document.name}`}
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-700"
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {document.name}
                </a>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Sin documentos vinculados.
              </p>
            )}
          </div>
          <div className="space-y-2">
            {policy.history.slice(0, 8).map((event, index) => (
              <div
                key={`${event.createdAt}-${index}`}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {auditLabel(event.action)}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {shortDate(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function UseInTreatmentPanel({
  patientId,
  policy,
}: {
  patientId: string;
  policy: FamilyPolicyDetail;
}) {
  const plans = useTreatmentPlans({ patientId }, true);
  const [planId, setPlanId] = useState("");
  const [itemId, setItemId] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const plan = useTreatmentPlan(planId);
  const coverage = usePolicyCoverageMutations(patientId, policy.policyNumber);
  const simulation = coverage.simulate.data;
  const selectPlan = (value: string) => {
    setPlanId(value);
    setItemId("");
    coverage.simulate.reset();
  };
  const selectItem = (value: string) => {
    setItemId(value);
    coverage.simulate.reset();
  };
  return (
    <Section
      title="Usar en tratamiento"
      icon={<CalendarDays className="h-4 w-4" />}
    >
      <p className="mb-3 text-sm text-slate-500">
        La simulación no consume límites. La aplicación confirmada registra el
        consumo y su copago en la prestación.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Select
          value={planId}
          onChange={(event) => selectPlan(event.target.value)}
        >
          <option value="">Seleccionar plan</option>
          {plans.data
            ?.filter(
              (candidate) =>
                !["CANCELLED", "COMPLETED", "REJECTED"].includes(
                  candidate.status,
                ),
            )
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.branch.name}
              </option>
            ))}
        </Select>
        <Select
          value={itemId}
          onChange={(event) => selectItem(event.target.value)}
          disabled={!planId || plan.isLoading}
        >
          <option value="">Seleccionar prestación</option>
          {plan.data?.items
            ?.filter(
              (item) => !["CANCELLED", "COMPLETED"].includes(item.status),
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.procedure?.name ?? "Prestación"} ·{" "}
                {money(
                  item.finalPrice ?? item.total,
                  item.priceCurrency ?? policy.financial.currency,
                )}
              </option>
            ))}
        </Select>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          disabled={!itemId || coverage.simulate.isPending}
          onClick={() => coverage.simulate.mutate(itemId)}
        >
          Simular cobertura
        </Button>
      </div>
      {simulation ? (
        <div
          className={`mt-4 rounded-xl border p-4 ${simulation.canApply ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}
        >
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <Fact
              label="Valor normal"
              value={money(simulation.normalAmount, simulation.currency)}
            />
            <Fact
              label="Cubierto"
              value={money(simulation.coveredAmount, simulation.currency)}
            />
            <Fact
              label="Copago"
              value={money(simulation.copayAmount, simulation.currency)}
            />
          </div>
          {simulation.blockingReasons.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-amber-800">
              {simulation.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {simulation.requiresAuthorization ? (
            <Input
              className="mt-3"
              value={authorizationCode}
              onChange={(event) => setAuthorizationCode(event.target.value)}
              placeholder="Código de autorización requerido"
            />
          ) : null}
          {simulation.canApply ? (
            <div className="mt-3 flex justify-end">
              <Button
                disabled={
                  coverage.apply.isPending ||
                  (simulation.requiresAuthorization &&
                    !authorizationCode.trim())
                }
                onClick={() =>
                  coverage.apply.mutate({
                    treatmentPlanItemId: itemId,
                    authorizationCode: authorizationCode || undefined,
                  })
                }
              >
                Confirmar aplicación
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

function PolicySkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-label="Cargando pólizas">
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function DarkFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-medium text-slate-800 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 px-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-xs font-semibold ${warning ? "text-amber-700" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}
function statusTone(
  status: PolicyStatus,
): "default" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (
    [
      "DRAFT",
      "PENDING_PAYMENT",
      "PAID_PENDING_ACTIVATION",
      "WAITING_PERIOD",
    ].includes(status)
  )
    return "warning";
  if (["CANCELLED", "EXPIRED"].includes(status)) return "danger";
  return "default";
}
function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
function coverageLabel(coverage: FamilyPolicyDetail["coverages"][number]) {
  if (coverage.type === "FULL") return "100 %";
  if (coverage.type === "PERCENTAGE") return `${Number(coverage.value)} %`;
  return `Hasta ${Number(coverage.value).toLocaleString("es-MX")}`;
}
function auditLabel(action: string) {
  return (
    (
      {
        create_draft: "Póliza creada",
        pay_and_activate: "Pago y activación",
        register_partial_payment: "Pago parcial",
        apply_coverage: "Cobertura aplicada",
        reverse_coverage: "Cobertura revertida",
        cancel: "Póliza cancelada",
      } as Record<string, string>
    )[action] ?? action.replaceAll("_", " ")
  );
}
