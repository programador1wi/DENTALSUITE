import { useMemo, useState } from "react";
import { CalendarDays, Check, CreditCard, FileKey2, ShieldCheck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth.store";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import {
  useFamilyPolicyMutations,
  usePatientPolicies,
  usePolicyProducts
} from "../hooks/use-family-policies";
import type { FamilyPolicy, PolicyProduct } from "../services/family-policies.service";
import type { FamilyGroup } from "../services/patient-identity.service";

type Props = {
  patientId: string;
  patientName: string;
  familyGroup?: FamilyGroup;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_PAYMENT: "Pago pendiente",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada"
};

function statusTone(status: FamilyPolicy["status"]): "default" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT" || status === "PENDING_PAYMENT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "default";
}

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

export function PatientFamilyPolicies({ patientId, patientName, familyGroup }: Props) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRead = hasPermission("family_policies.read");
  const canCreate = hasPermission("family_policies.create");
  const canActivate = hasPermission("family_policies.activate") && hasPermission("payments.create");
  const products = usePolicyProducts(canRead);
  const policies = usePatientPolicies(patientId, canRead);
  const paymentMethods = usePaymentMethods(undefined, "true", canActivate);
  const mutations = useFamilyPolicyMutations(patientId);
  const [contracting, setContracting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([patientId]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [contractedPrice, setContractedPrice] = useState("");
  const [paymentPolicy, setPaymentPolicy] = useState<FamilyPolicy | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const selectedProduct = products.data?.find((product) => product.id === selectedProductId);
  const familyMembers = familyGroup?.members ?? [];
  const selectedCount = selectedMemberIds.length;
  const availableSpaces = selectedProduct ? selectedProduct.maximumMembers - selectedCount : 0;
  const canSubmit = Boolean(
    selectedProduct &&
    Number(contractedPrice) > 0 &&
    selectedCount >= selectedProduct.minimumMembers &&
    selectedCount <= selectedProduct.maximumMembers &&
    (selectedProduct.maximumMembers === 1 || familyGroup)
  );
  const activePolicies = useMemo(
    () => policies.data?.filter((policy) => policy.status === "ACTIVE") ?? [],
    [policies.data]
  );

  if (!canRead) {
    return <p className="text-sm text-slate-500">No tienes permiso para consultar pólizas.</p>;
  }

  const selectProduct = (product: PolicyProduct) => {
    setSelectedProductId(product.id);
    setContractedPrice(Number(product.basePrice) > 0 ? String(product.basePrice) : "");
    setSelectedMemberIds([patientId]);
  };

  const toggleMember = (memberPatientId: string) => {
    if (!selectedProduct || memberPatientId === patientId) return;
    setSelectedMemberIds((current) => {
      if (current.includes(memberPatientId)) return current.filter((id) => id !== memberPatientId);
      if (current.length >= selectedProduct.maximumMembers) return current;
      return [...current, memberPatientId];
    });
  };

  const createPolicy = async () => {
    if (!selectedProduct || !canSubmit) return;
    await mutations.create.mutateAsync({
      policyProductId: selectedProduct.id,
      familyGroupId: selectedProduct.maximumMembers > 1 ? familyGroup?.id : undefined,
      holderPatientId: patientId,
      memberPatientIds: selectedMemberIds,
      effectiveFrom,
      contractedPrice: Number(contractedPrice),
      currency: selectedProduct.currency
    });
    setContracting(false);
    setSelectedProductId("");
    setSelectedMemberIds([patientId]);
    setContractedPrice("");
  };

  const openPayment = (policy: FamilyPolicy) => {
    const paid = policy.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    setPaymentPolicy(policy);
    setPaymentAmount(String(Math.max(Number(policy.contractedPrice) - paid, 0)));
    setPaymentMethodId(paymentMethods.data?.[0]?.id ?? "");
    setPaymentReference("");
  };

  const registerPayment = async () => {
    if (!paymentPolicy || !paymentMethodId || Number(paymentAmount) <= 0) return;
    await mutations.pay.mutateAsync({
      policyId: paymentPolicy.id,
      payload: {
        paymentMethodId,
        amount: Number(paymentAmount),
        reference: paymentReference || undefined,
        idempotencyKey: `policy-${paymentPolicy.id}-${Date.now()}`
      }
    });
    setPaymentPolicy(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileKey2 className="h-4 w-4 text-[var(--text-brand)]" />
            <h4 className="font-semibold text-slate-900">Pólizas del paciente</h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Familia y cobertura son independientes: solo integrantes listados en póliza están cubiertos.
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => setContracting((value) => !value)}>
            {contracting ? "Cerrar contratación" : "Contratar póliza"}
          </Button>
        ) : null}
      </div>

      {contracting ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Nueva contratación
            </p>
            <p className="mt-1 text-sm text-slate-300">Titular fijo: {patientName}</p>
          </div>
          <div className="space-y-5 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              {products.data?.map((product) => {
                const unavailable = product.maximumMembers > 1 && !familyGroup;
                const selected = selectedProductId === product.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={unavailable}
                    onClick={() => selectProduct(product)}
                    className={`relative rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-emerald-500 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {selected ? (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-600 p-1 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {product.productCode}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {product.minimumMembers === product.maximumMembers
                        ? `${product.maximumMembers} persona${product.maximumMembers === 1 ? "" : "s"}`
                        : `${product.minimumMembers} a ${product.maximumMembers} personas`}
                    </p>
                    {unavailable ? (
                      <p className="mt-2 text-[11px] text-amber-700">Requiere grupo familiar</p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selectedProduct ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-600">
                    Inicio de vigencia
                    <Input
                      className="mt-1"
                      type="date"
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Precio contratado ({selectedProduct.currency})
                    <Input
                      className="mt-1"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={contractedPrice}
                      onChange={(event) => setContractedPrice(event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Beneficiarios cubiertos</p>
                      <p className="text-xs text-slate-500">
                        Titular permanece seleccionado y cuenta como espacio.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {selectedCount} de {selectedProduct.maximumMembers} integrantes seleccionados
                      </p>
                      <p className="text-xs text-emerald-700">
                        {availableSpaces === 0
                          ? "Sin espacios disponibles"
                          : `${availableSpaces} espacio${availableSpaces === 1 ? "" : "s"} disponible${availableSpaces === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{patientName}</p>
                        <p className="text-xs text-emerald-700">Titular · selección obligatoria</p>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    {selectedProduct.maximumMembers > 1
                      ? familyMembers
                          .filter((member) => member.patientId !== patientId)
                          .map((member) => {
                            const selected = selectedMemberIds.includes(member.patientId);
                            const blocked = !selected && selectedCount >= selectedProduct.maximumMembers;
                            return (
                              <button
                                key={member.id}
                                type="button"
                                disabled={blocked}
                                onClick={() => toggleMember(member.patientId)}
                                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                                  selected
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                } disabled:cursor-not-allowed disabled:opacity-45`}
                              >
                                <span>
                                  <span className="block text-sm font-semibold text-slate-900">
                                    {member.patient.firstName} {member.patient.lastName}
                                  </span>
                                  <span className="block text-xs text-slate-500">
                                    {member.relationship || "Integrante familiar"}
                                  </span>
                                </span>
                                <span
                                  className={`grid h-5 w-5 place-items-center rounded-md border ${
                                    selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                                  }`}
                                >
                                  {selected ? <Check className="h-3 w-3" /> : null}
                                </span>
                              </button>
                            );
                          })
                      : null}
                  </div>
                  {selectedCount < selectedProduct.minimumMembers ? (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      Selecciona al menos {selectedProduct.minimumMembers} integrantes para esta modalidad.
                    </p>
                  ) : null}
                </div>

                <Button
                  className="w-full"
                  disabled={!canSubmit || mutations.create.isPending}
                  onClick={() => void createPolicy()}
                >
                  Crear borrador con número de póliza
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {paymentPolicy ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-semibold text-slate-900">
              Registrar pago · {paymentPolicy.policyNumber}
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Caja registrará ingreso y cargo de póliza. Cobertura se activa al liquidar total.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
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
            <Button variant="secondary" size="sm" onClick={() => setPaymentPolicy(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!paymentMethodId || Number(paymentAmount) <= 0 || mutations.pay.isPending}
              onClick={() => void registerPayment()}
            >
              Registrar pago
            </Button>
          </div>
        </div>
      ) : null}

      {policies.isLoading ? <p className="text-sm text-slate-500">Cargando pólizas…</p> : null}
      {!policies.isLoading && !policies.data?.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <UsersRound className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Sin pólizas registradas</p>
          <p className="mt-1 text-xs text-slate-500">
            Crear grupo familiar no crea cobertura automáticamente.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {policies.data?.map((policy) => (
          <article key={policy.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-bold text-slate-900">{policy.policyNumber}</p>
                  <Badge
                    value={STATUS_LABELS[policy.status] ?? policy.status}
                    tone={statusTone(policy.status)}
                  />
                  <Badge value={policy.policyProduct.name} tone="brand" />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                  {shortDate(policy.effectiveFrom)} — {shortDate(policy.effectiveUntil)} ·{" "}
                  {policy.members.length} de {policy.policyProduct.maximumMembers} cubiertos
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Titular: {policy.holderPatient.firstName} {policy.holderPatient.lastName}
                  {policy.familyGroup ? ` · ${policy.familyGroup.familyCode}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-slate-900">
                  {money(policy.contractedPrice, policy.currency)}
                </p>
                <p className="text-xs text-slate-500">Pago: {policy.paymentStatus}</p>
                {canActivate && ["DRAFT", "PENDING_PAYMENT"].includes(policy.status) ? (
                  <Button className="mt-2" size="sm" variant="secondary" onClick={() => openPayment(policy)}>
                    Registrar pago
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {activePolicies.length > 1 ? (
        <p className="text-xs text-amber-700">
          Paciente aparece en más de una póliza activa; revisar solapamiento comercial.
        </p>
      ) : null}
    </section>
  );
}
