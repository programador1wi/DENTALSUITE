import { FormEvent, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Building2, ClipboardList, Check, Eye, Pencil, Calendar, DollarSign, Info, Tag, Globe, Lock, Sliders, FileText, ShieldCheck, Receipt, Users, Plus, Copy, Play, Power, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { hasRequiredPermissions } from "@/components/layout/navigation";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { usePriceLists } from "@/features/settings/price-lists/hooks/use-price-lists";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import { AgreementsDebtsPage } from "./agreements-debts-page";
import {
  useAgreements,
  useAssignAgreementPatients,
  useCreateAgreement,
  useDeactivateAgreement,
  useAgreementPreview,
  useCancelAgreement,
  useDuplicateAgreement,
  usePublishAgreement,
  useUpdateAgreement
} from "../hooks/use-admin-workflows";
import type { Agreement } from "../services/admin-workflows.service";
import { useAuthStore } from "@/stores/auth.store";

const AGREEMENTS_V2_ENABLED = import.meta.env.VITE_AGREEMENTS_V2_ENABLED !== "false";

const typeLabels: Record<Agreement["type"], string> = {
  CORPORATE: "Corporativo",
  INSURANCE: "Aseguradora",
  MEMBERSHIP: "Membresía",
  PAYROLL: "Descuento en Nómina",
  OTHER: "Otro"
};

type AgreementForm = {
  id?: string;
  name: string;
  entityName: string;
  type: "CORPORATE" | "INSURANCE" | "MEMBERSHIP" | "PAYROLL" | "OTHER";
  startsAt: string;
  endsAt: string;
  description: string;
  priceListId: string;
  discountPercent: string;
  coveragePercent: string;
  copayAmount: string;
  coverageLimitAmount: string;
  branchIds: string[];
  appliesToLabs: boolean;
  appliesToOtherCategories: boolean;
  payrollDiscount: boolean;
  isPublic: boolean;
};

const emptyForm: AgreementForm = {
  name: "",
  entityName: "",
  type: "CORPORATE",
  startsAt: "",
  endsAt: "",
  description: "",
  priceListId: "",
  discountPercent: "0",
  coveragePercent: "0",
  copayAmount: "0",
  coverageLimitAmount: "",
  branchIds: [],
  appliesToLabs: false,
  appliesToOtherCategories: false,
  payrollDiscount: false,
  isPublic: true
};

function AgreementActionsMenu({
  agreement,
  onEdit,
  onDuplicate,
  onPublish,
  onCancel,
  onDeactivate
}: {
  agreement: Agreement;
  onEdit: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const toggleMenu = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 176) });
    }
    setOpen((value) => !value);
  };

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={containerRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Acciones de ${agreement.name}`}
        aria-expanded={open}
        onClick={toggleMenu}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-slate-600 hover:bg-[var(--bg-subtle)] transition-all active:scale-95"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed z-[1600] min-w-44 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-card-hover)]"
        >

          <button
            type="button"
            role="menuitem"
            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            onClick={() => run(onDuplicate)}
          >
            Duplicar
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={agreement.status === "ACTIVE" || agreement.status === "CANCELLED"}
            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => run(onPublish)}
          >
            Activar
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={agreement.status === "CANCELLED"}
            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--text-danger)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => run(onCancel)}
          >
            Cancelar
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!agreement.isActive}
            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--text-danger)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => run(onDeactivate)}
          >
            Desactivar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AgreementsSettingsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canReadDetails = hasRequiredPermissions(permissions, "agreements.read");
  const canManage = hasRequiredPermissions(permissions, "agreements.manage");
  const canPublish = hasRequiredPermissions(permissions, "agreements.publish");
  const canAssign = hasRequiredPermissions(permissions, "agreements.assign");
  const canReadBranches = hasRequiredPermissions(permissions, "branches.read");
  const canReadProcedures = hasRequiredPermissions(permissions, "procedures.read");
  const canReadPriceLists = hasRequiredPermissions(permissions, "price_lists.read");
  const canPreview = canReadDetails && canReadBranches && canReadProcedures;
  const canUseRowActions = canReadDetails || canManage || canPublish;
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [form, setForm] = useState<AgreementForm>(emptyForm);
  const [assignAgreementId, setAssignAgreementId] = useState("");
  const [patientIds, setPatientIds] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [preview, setPreview] = useState({ id: "", branchId: "", procedureId: "" });
  const [selectedAgreementDetails, setSelectedAgreementDetails] = useState<Agreement | null>(null);
  const agreements = useAgreements(search || undefined, active || undefined);
  const allAgreements = useAgreements(undefined, undefined);
  const priceLists = usePriceLists(undefined, "true", undefined, canReadPriceLists);
  const branches = useBranches(undefined, "ACTIVE", canReadBranches);
  const procedures = useProcedures(undefined, "true", undefined, canReadProcedures);
  const createAgreement = useCreateAgreement();
  const updateAgreement = useUpdateAgreement();
  const deactivateAgreement = useDeactivateAgreement();
  const assignPatients = useAssignAgreementPatients();
  const publishAgreement = usePublishAgreement();
  const duplicateAgreement = useDuplicateAgreement();
  const cancelAgreement = useCancelAgreement();
  const previewAgreement = useAgreementPreview();

  if (!AGREEMENTS_V2_ENABLED) {
    return (
      <EmptyState
        title="Convenios no habilitados"
        description="Activa VITE_AGREEMENTS_V2_ENABLED y AGREEMENTS_V2_ENABLED durante el despliegue controlado."
      />
    );
  }

  const submitAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      entityName: form.entityName.trim() || undefined,
      type: form.type,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
      description: form.description.trim() || undefined,
      priceListId: form.priceListId || undefined,
      discountPercent: Number(form.discountPercent || 0),
      coveragePercent: Number(form.coveragePercent || 0),
      copayAmount: Number(form.copayAmount || 0),
      coverageLimitAmount: form.coverageLimitAmount ? Number(form.coverageLimitAmount) : undefined,
      branchIds: form.branchIds,
      categoryRules: [],
      procedureRules: [],
      appliesToLabs: form.appliesToLabs,
      appliesToOtherCategories: form.appliesToOtherCategories,
      payrollDiscount: form.payrollDiscount,
      isPublic: form.isPublic
    };
    if (form.id) await updateAgreement.mutateAsync({ id: form.id, payload });
    else await createAgreement.mutateAsync(payload);
    setForm(emptyForm);
    setAgreementModalOpen(false);
  };

  const editAgreement = (agreement: Agreement) => {
    const currentVersion = agreement.versions?.[0];
    setForm({
      id: agreement.id,
      name: agreement.name,
      entityName: agreement.entityName ?? "",
      type: agreement.type,
      startsAt: agreement.startsAt?.slice(0, 10) ?? "",
      endsAt: agreement.endsAt?.slice(0, 10) ?? "",
      description: agreement.description ?? "",
      priceListId: agreement.priceListId ?? "",
      discountPercent: agreement.discountPercent,
      coveragePercent: agreement.coveragePercent,
      copayAmount: agreement.copayAmount,
      coverageLimitAmount: agreement.coverageLimitAmount ?? "",
      branchIds: currentVersion?.branches?.map((branch) => branch.branchId) ?? [],
      appliesToLabs: agreement.appliesToLabs,
      appliesToOtherCategories: agreement.appliesToOtherCategories,
      payrollDiscount: agreement.payrollDiscount,
      isPublic: agreement.isPublic
    });
    setAgreementModalOpen(true);
  };

  const startNewAgreement = () => {
    setForm(emptyForm);
    setAgreementModalOpen(true);
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ids = patientIds
      .split(/[\s,]+/)
      .map((patientId) => patientId.trim())
      .filter(Boolean);
    if (!assignAgreementId || !ids.length) return;
    await assignPatients.mutateAsync({ id: assignAgreementId, patientIds: ids });
    setPatientIds("");
    setAssignmentModalOpen(false);
  };

  if (agreements.isLoading) return <LoadingState message="Cargando convenios..." />;
  if (agreements.isError) return <ErrorState message={agreements.error.message} />;

  const allAgreementsList = allAgreements.data ?? agreements.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Convenios"
        description="Convenios con arancel, descuento y asignación de pacientes."
        helpText="Un convenio vincula pacientes con un listado de precios o un descuento administrativo para presupuestos y cobros."
      />

      {activeTab === "list" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setActive("")}
            className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
              active === ""
                ? "border-[var(--text-brand)] bg-[var(--bg-brand-light)]/40 shadow-xs ring-1 ring-[var(--text-brand)]"
                : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Convenios</span>
              <Building2 className={`h-4 w-4 ${active === "" ? "text-[var(--text-brand)]" : "text-slate-400"}`} />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{allAgreementsList.length}</span>
              {active === "" && (
                <span className="text-[10px] font-semibold text-[var(--text-brand)] uppercase">Ver todos</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActive("true")}
            className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
              active === "true"
                ? "border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500"
                : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Convenios Activos</span>
              <ShieldCheck className={`h-4 w-4 ${active === "true" ? "text-emerald-600" : "text-slate-400"}`} />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                {allAgreementsList.filter((a) => a.status === "ACTIVE" || a.isActive).length}
              </span>
              {active === "true" && (
                <span className="text-[10px] font-semibold text-emerald-600 uppercase">Filtrando activos</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActive("false")}
            className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
              active === "false"
                ? "border-amber-500 bg-amber-50/50 shadow-xs ring-1 ring-amber-500"
                : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Inactivos / Cancelados</span>
              <Tag className={`h-4 w-4 ${active === "false" ? "text-amber-600" : "text-slate-400"}`} />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-700 tabular-nums">
                {allAgreementsList.filter((a) => a.status !== "ACTIVE" && !a.isActive).length}
              </span>
              {active === "false" && (
                <span className="text-[10px] font-semibold text-amber-600 uppercase">Filtrando inactivos</span>
              )}
            </div>
          </button>

          <div className="flex flex-col justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pacientes Afiliados</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {allAgreementsList.reduce((acc, a) => acc + (a._count?.patients ?? 0), 0)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Asignados</span>
            </div>
          </div>
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={[
              { key: "list", label: "Listar convenios" },
              { key: "debts", label: "$ Reporte deudas" }
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          {activeTab === "list" ? (
            <div className="flex flex-wrap items-center gap-2">
              {canAssign ? (
                <Button type="button" variant="secondary" onClick={() => setAssignmentModalOpen(true)}>
                  <Users className="mr-1.5 h-4 w-4" />
                  Asignar pacientes
                </Button>
              ) : null}
              {canPreview ? (
                <Button type="button" variant="secondary" onClick={() => setPreviewModalOpen(true)}>
                  <Receipt className="mr-1.5 h-4 w-4" />
                  Previsualizar precio
                </Button>
              ) : null}
              {canManage ? (
                <Button onClick={startNewAgreement}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Agregar convenio
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {activeTab === "list" && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[var(--border-default)]">
            <div className="flex-1 min-w-[260px]">
              <EntitySearchBox
                placeholder="Buscar convenio por nombre o empresa..."
                value={search}
                onValueChange={setSearch}
                items={search.trim() ? (agreements.data ?? []) : []}
                onSelect={(agreement) => {
                  setSearch(agreement.name);
                  if (canManage) editAgreement(agreement);
                  else if (canReadDetails) setSelectedAgreementDetails(agreement);
                }}
                getItemKey={(agreement) => agreement.id}
                emptyMessage="Sin convenios encontrados"
                renderItem={(agreement) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{agreement.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {agreement.description || `${agreement.discountPercent}% descuento`}
                    </p>
                  </div>
                )}
              />
            </div>
            <div className="w-48">
              <Select value={active} onChange={(event) => setActive(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="true">Solo activos</option>
                <option value="false">Solo inactivos</option>
              </Select>
            </div>
          </div>
        )}
      </Card>

      {activeTab === "list" ? (
        <div className="space-y-4">
          <Modal
            open={canManage && agreementModalOpen}
            title={form.id ? "Editar convenio" : "Agregar convenio"}
            onClose={() => setAgreementModalOpen(false)}
            size="2xl"
          >
            <Card>
              <h3 className="mb-3 text-base font-semibold text-slate-900">Datos del convenio</h3>
              <form className="grid gap-3 lg:grid-cols-2" onSubmit={submitAgreement}>
                <label className="text-sm text-slate-700">
                  Nombre
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Entidad relacionada
                  <Input
                    value={form.entityName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, entityName: event.target.value }))
                    }
                    placeholder="Empresa, aseguradora o asociación"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Tipo
                  <Select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as AgreementForm["type"]
                      }))
                    }
                  >
                    <option value="CORPORATE">Corporativo</option>
                    <option value="INSURANCE">Aseguradora</option>
                    <option value="MEMBERSHIP">Membresía</option>
                    <option value="PAYROLL">Nómina</option>
                    <option value="OTHER">Otro</option>
                  </Select>
                </label>
                <label className="text-sm text-slate-700">
                  Descuento general (%)
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.discountPercent}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, discountPercent: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Cobertura (%)
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.coveragePercent}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, coveragePercent: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Copago por prestación
                  <Input
                    type="number"
                    min="0"
                    value={form.copayAmount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, copayAmount: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Límite de cobertura
                  <Input
                    type="number"
                    min="0"
                    value={form.coverageLimitAmount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, coverageLimitAmount: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Inicio de vigencia
                  <Input
                    type="date"
                    value={form.startsAt}
                    onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Fin de vigencia
                  <Input
                    type="date"
                    value={form.endsAt}
                    onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                  />
                </label>
                <label className="text-sm text-slate-700 lg:row-span-2">
                  Descripción
                  <Textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.appliesToLabs}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, appliesToLabs: event.target.checked }))
                      }
                    />
                    Aplica a laboratorio
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.appliesToOtherCategories}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, appliesToOtherCategories: event.target.checked }))
                      }
                    />
                    Aplica a categorias extra
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.payrollDiscount}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, payrollDiscount: event.target.checked }))
                      }
                    />
                    Considerar en nomina
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, isPublic: event.target.checked }))
                      }
                    />
                    Visible para pacientes
                  </label>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Sucursales habilitadas</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            branchIds: branches.data?.map((b) => b.id) ?? []
                          }))
                        }
                        className="text-xs font-medium text-[var(--text-brand)] hover:underline"
                      >
                        Seleccionar todas
                      </button>
                      <span className="text-xs text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            branchIds: []
                          }))
                        }
                        className="text-xs font-medium text-slate-500 hover:underline"
                      >
                        Desmarcar todas
                      </button>
                    </div>
                  </div>
                  <div className="grid max-h-48 gap-2 overflow-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2 md:grid-cols-3">
                    {branches.data?.map((branch) => {
                      const isSelected = form.branchIds.includes(branch.id);
                      return (
                        <div
                          key={branch.id}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              branchIds: isSelected
                                ? current.branchIds.filter((id) => id !== branch.id)
                                : [...current.branchIds, branch.id]
                            }))
                          }
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all duration-200 select-none ${
                            isSelected
                              ? "border-[var(--text-brand)] bg-[var(--bg-subtle)] shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                              isSelected
                                ? "bg-[var(--text-brand)] text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-800">{branch.name}</p>
                            <p className="text-[10px] text-slate-500 capitalize">
                              {branch.status === "ACTIVE" ? "Activo" : branch.status}
                            </p>
                          </div>
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                              isSelected
                                ? "border-[var(--text-brand)] bg-[var(--text-brand)] text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Arancel / listado de precios</label>
                    <p className="text-xs text-slate-500">
                      El convenio toma sus prestaciones y precios desde el arancel seleccionado.
                    </p>
                  </div>
                  <div className="grid max-h-56 gap-2 overflow-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2">
                    {/* Option: Sin arancel */}
                    <div
                      onClick={() => setForm((current) => ({ ...current, priceListId: "" }))}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all duration-200 select-none ${
                        !form.priceListId
                          ? "border-[var(--text-brand)] bg-[var(--bg-subtle)] shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                          !form.priceListId
                            ? "bg-[var(--text-brand)] text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">Sin arancel</p>
                        <p className="text-[10px] text-slate-500">
                          Usar solo descuento general
                        </p>
                      </div>
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                          !form.priceListId
                            ? "border-[var(--text-brand)] bg-[var(--text-brand)] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {!form.priceListId && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>

                    {/* Price list options */}
                    {priceLists.data?.map((list) => {
                      const isSelected = form.priceListId === list.id;
                      const itemCount = list.items?.length ?? 0;
                      const categoryCount = list.categories?.length ?? 0;
                      return (
                        <div
                          key={list.id}
                          onClick={() => setForm((current) => ({ ...current, priceListId: list.id }))}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all duration-200 select-none ${
                            isSelected
                              ? "border-[var(--text-brand)] bg-[var(--bg-subtle)] shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                              isSelected
                                ? "bg-[var(--text-brand)] text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-800">{list.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {itemCount} prestaciones · {categoryCount} categorías
                            </p>
                          </div>
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                              isSelected
                                ? "border-[var(--text-brand)] bg-[var(--text-brand)] text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 lg:col-span-2">
                  <Button type="submit" disabled={createAgreement.isPending || updateAgreement.isPending}>
                    {form.id ? "Actualizar" : "Crear convenio"}
                  </Button>
                  {form.id ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setForm(emptyForm);
                        setAgreementModalOpen(false);
                      }}
                    >
                      Cancelar edicion
                    </Button>
                  ) : null}
                </div>
              </form>
            </Card>
          </Modal>

          <Modal
            open={canAssign && assignmentModalOpen}
            title="Asignar pacientes"
            onClose={() => setAssignmentModalOpen(false)}
            size="lg"
          >
            <Card>
              <h3 className="mb-3 text-base font-semibold text-slate-900">Asignar pacientes</h3>
              <form
                className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr_auto]"
                onSubmit={submitAssignment}
              >
                <Select
                  value={assignAgreementId}
                  onChange={(event) => setAssignAgreementId(event.target.value)}
                >
                  <option value="">Selecciona convenio</option>
                  {agreements.data
                    ?.filter((agreement) => agreement.isActive)
                    .map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>
                        {agreement.name}
                      </option>
                    ))}
                </Select>
                <Input
                  placeholder="IDs de pacientes separados por coma o espacio"
                  value={patientIds}
                  onChange={(event) => setPatientIds(event.target.value)}
                />
                <Button type="submit" disabled={assignPatients.isPending}>
                  Asignar
                </Button>
              </form>
            </Card>
          </Modal>

          <Modal
            open={canPreview && previewModalOpen}
            title="Previsualizar precio"
            onClose={() => setPreviewModalOpen(false)}
            size="lg"
          >
            <Card className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Previsualizar precio antes de usar el convenio
                </h3>
                <p className="text-sm text-slate-500">
                  Calcula precio normal, preferencial, cobertura y total del paciente sin modificar planes.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Select
                  value={preview.id}
                  onChange={(event) => setPreview((value) => ({ ...value, id: event.target.value }))}
                >
                  <option value="">Convenio</option>
                  {agreements.data?.map((agreement) => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreement.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={preview.branchId}
                  onChange={(event) => setPreview((value) => ({ ...value, branchId: event.target.value }))}
                >
                  <option value="">Sucursal</option>
                  {branches.data?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={preview.procedureId}
                  onChange={(event) => setPreview((value) => ({ ...value, procedureId: event.target.value }))}
                >
                  <option value="">Prestación</option>
                  {procedures.data?.map((procedure) => (
                    <option key={procedure.id} value={procedure.id}>
                      {procedure.code} - {procedure.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  disabled={
                    !preview.id || !preview.branchId || !preview.procedureId || previewAgreement.isPending
                  }
                  onClick={() => previewAgreement.mutate(preview)}
                >
                  Calcular
                </Button>
              </div>
              {previewAgreement.data ? (
                <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-4">
                  <span>Normal: ${previewAgreement.data.normalPrice}</span>
                  <span>Aplicado: ${previewAgreement.data.appliedPrice}</span>
                  <span>Cobertura: ${previewAgreement.data.coverageAmount}</span>
                  <strong>Paciente: ${previewAgreement.data.patientTotal}</strong>
                </div>
              ) : null}
            </Card>
          </Modal>

          <AgreementDetailsViewModal
            agreement={canReadDetails ? selectedAgreementDetails : null}
            onClose={() => setSelectedAgreementDetails(null)}
          />

          <DataTable
            rows={agreements.data ?? []}
            tableClassName="w-full border-collapse [&_th]:border-r-0 [&_td]:border-r-0 [&_th]:bg-slate-50/80 [&_th]:text-[11px] [&_th]:tracking-wider [&_th]:uppercase [&_th]:text-slate-500 [&_tr]:border-b [&_tr]:border-slate-100 hover:[&_tr]:bg-slate-50/60 transition-colors"
            containerClassName="border border-[var(--border-default)] rounded-xl overflow-hidden shadow-2xs"
            empty={
              <EmptyState
                title="Sin convenios"
                description={canManage
                  ? "Crea el primer convenio para asociar aranceles a pacientes."
                  : "No hay convenios disponibles con los filtros actuales."}
              />
            }
            columns={[
              {
                key: "entityName",
                title: "EMPRESA / CONVENIO",
                headerClassName: "border-r-0 text-left py-3 px-4",
                cellClassName: "border-r-0 py-3.5 px-4",
                render: (row) => {
                  const typeLabel = typeLabels[row.type] || row.type;
                  const displayName = row.entityName || row.name;
                  const secondaryName = row.entityName && row.name !== row.entityName ? row.name : null;
                  return (
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80 shadow-2xs">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-semibold text-slate-900 text-sm leading-snug truncate">{displayName}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {secondaryName ? (
                            <span className="text-xs text-slate-500 truncate">{secondaryName}</span>
                          ) : null}
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                            {typeLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
              },
              {
                key: "startsAt",
                title: "VIGENCIA",
                headerClassName: "border-r-0 py-3 px-4",
                cellClassName: "border-r-0 py-3.5 px-4 whitespace-nowrap text-xs",
                render: (row) => {
                  if (!row.startsAt && !row.endsAt) {
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2.5 py-1 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Sin límite de vigencia
                      </span>
                    );
                  }
                  const startStr = row.startsAt
                    ? new Date(row.startsAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                    : "Indefinido";
                  const endStr = row.endsAt
                    ? new Date(row.endsAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                    : "Indefinido";
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200/60 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {startStr} — {endStr}
                    </span>
                  );
                }
              },
              {
                key: "discountPercent",
                title: "CONDICIONES",
                headerClassName: "border-r-0 py-3 px-4",
                cellClassName: "border-r-0 py-3.5 px-4 whitespace-nowrap",
                render: (row) => (
                  <div className="flex flex-col gap-1">
                    {Number(row.discountPercent) > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/50 w-fit tabular-nums">
                        <Tag className="h-3 w-3 text-emerald-500" />
                        {Number(row.discountPercent).toFixed(1)}% desc.
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Arancel directo</span>
                    )}
                    {Number(row.copayAmount) > 0 ? (
                      <span className="text-[11px] text-slate-500 font-medium tabular-nums pl-1">
                        Copago: ${Number(row.copayAmount).toLocaleString("es-MX")}
                      </span>
                    ) : Number(row.coveragePercent) > 0 ? (
                      <span className="text-[11px] text-slate-500 font-medium tabular-nums pl-1">
                        Cobertura: {Number(row.coveragePercent)}%
                      </span>
                    ) : null}
                  </div>
                )
              },
              {
                key: "status",
                title: "ESTADO",
                headerClassName: "border-r-0 text-center py-3 px-4",
                cellClassName: "border-r-0 text-center py-3.5 px-4 w-28",
                render: (row) => {
                  const isAct = row.status === "ACTIVE" || row.isActive;
                  const isCanc = row.status === "CANCELLED";
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                        isAct
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : isCanc
                            ? "bg-rose-50 text-rose-700 border-rose-200/60"
                            : "bg-amber-50 text-amber-700 border-amber-200/60"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isAct ? "bg-emerald-500" : isCanc ? "bg-rose-500" : "bg-amber-500"
                        }`}
                      />
                      {isAct ? "Activo" : isCanc ? "Cancelado" : "Inactivo"}
                    </span>
                  );
                }
              },
              {
                key: "_count",
                title: "PACIENTES",
                headerClassName: "border-r-0 text-center py-3 px-4",
                cellClassName: "border-r-0 text-center py-3.5 px-4 w-28",
                render: (row) => (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60 tabular-nums">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>{row._count?.patients ?? 0}</span>
                  </span>
                )
              },
              {
                key: "name",
                title: canUseRowActions ? "ACCIONES" : "",
                headerClassName: "border-r-0 text-right py-3 px-4",
                cellClassName: canUseRowActions
                  ? "border-r-0 text-right py-3.5 px-4 min-w-[160px]"
                  : "border-r-0 p-0 w-0",
                mobileHidden: !canUseRowActions,
                render: (row) => {
                  const isAct = row.status === "ACTIVE" || row.isActive;
                  const isCanc = row.status === "CANCELLED";
                  if (!canUseRowActions) return null;
                  return (
                    <div className="flex items-center justify-end gap-1">
                      {canReadDetails ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAgreementDetails(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                          aria-label="Ver detalles"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => editAgreement(row)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95"
                            aria-label="Editar convenio"
                            title="Editar convenio"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateAgreement.mutate(row.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95"
                            aria-label="Duplicar convenio"
                            title="Duplicar convenio"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {isAct ? (
                            <button
                              type="button"
                              onClick={() => deactivateAgreement.mutate(row.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 transition-all active:scale-95"
                              aria-label="Desactivar convenio"
                              title="Desactivar convenio"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isCanc}
                              onClick={() => cancelAgreement.mutate(row.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
                              aria-label="Cancelar convenio"
                              title="Cancelar convenio"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      ) : null}
                      {canPublish && !isAct ? (
                        <button
                          type="button"
                          disabled={isCanc}
                          onClick={() => publishAgreement.mutate({ id: row.id, version: row.version })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
                          aria-label="Activar convenio"
                          title="Activar convenio"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  );
                }
              }
            ]}
          />
        </div>
      ) : (
        <AgreementsDebtsPage />
      )}
    </div>
  );
}

function AgreementDetailsViewModal({
  agreement,
  onClose
}: {
  agreement: Agreement | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"summary" | "branches" | "config">("summary");
  const [branchSearch, setBranchSearch] = useState("");

  if (!agreement) return null;

  const branches = agreement.versions?.[0]?.branches ?? [];
  const filteredBranches = branches.filter((b) =>
    (b.branch?.name ?? b.branchId).toLowerCase().includes(branchSearch.toLowerCase())
  );

  const typeLabels: Record<Agreement["type"], string> = {
    CORPORATE: "Corporativo",
    INSURANCE: "Aseguradora",
    MEMBERSHIP: "Membresía",
    PAYROLL: "Descuento en Nómina",
    OTHER: "Otro"
  };

  return (
    <Modal open={Boolean(agreement)} title="" onClose={onClose} size="xl">
      <div className="-m-6 overflow-hidden rounded-xl bg-slate-50">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden bg-slate-900 p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2.5 py-0.5 text-xs font-bold text-sky-300 backdrop-blur-xs border border-sky-400/20">
                  <Tag className="h-3 w-3" /> {typeLabels[agreement.type] || agreement.type}
                </span>
                <Badge
                  value={agreement.status === "ACTIVE" ? "Activo" : agreement.status === "CANCELLED" ? "Cancelado" : "Borrador"}
                  tone={agreement.status === "ACTIVE" ? "success" : agreement.status === "CANCELLED" ? "danger" : "warning"}
                />
                {agreement.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30">
                    ★ Predeterminado
                  </span>
                ) : null}
                {agreement.isPublic ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700">
                    <Globe className="h-3 w-3 text-emerald-400" /> Público
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-700">
                    <Lock className="h-3 w-3" /> Privado
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">{agreement.name}</h2>
              {agreement.entityName ? (
                <p className="text-xs text-slate-300 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-sky-400" /> {agreement.entityName}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-400">Versión actual</span>
              <p className="text-lg font-bold text-sky-400">v{agreement.version}</p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 backdrop-blur-xs sm:grid-cols-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Descuento general</p>
              <p className="truncate text-base font-bold text-emerald-400">{Number(agreement.discountPercent).toFixed(1)}%</p>
            </div>
            <div className="min-w-0 border-l border-slate-800 pl-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cobertura</p>
              <p className="truncate text-base font-bold text-sky-400">{Number(agreement.coveragePercent).toFixed(1)}%</p>
            </div>
            <div className="min-w-0 border-l border-slate-800 pl-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Copago fijo</p>
              <p className="truncate text-base font-bold text-white">${Number(agreement.copayAmount).toFixed(2)}</p>
            </div>
            <div className="min-w-0 border-l border-slate-800 pl-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sucursales</p>
              <p className="truncate text-base font-bold text-amber-300">{branches.length ? `${branches.length} activas` : "Todas"}</p>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs font-semibold transition-colors ${
              tab === "summary"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="h-4 w-4" /> Resumen & Reglas Financieras
          </button>
          <button
            type="button"
            onClick={() => setTab("branches")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-colors ${
              tab === "branches"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="h-4 w-4" /> Sucursales ({branches.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("config")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-colors ${
              tab === "config"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders className="h-4 w-4" /> Configuración & Cobertura
          </button>
        </div>

        {/* Modal Tab Body */}
        <div className="p-6 space-y-4">
          {tab === "summary" && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Financial Rules */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Reglas Financieras</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Tarifario / Arancel:</span>
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {agreement.priceList?.name || "Sin arancel - Descuento directo"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Descuento general:</span>
                    <span className="font-bold text-emerald-700">{Number(agreement.discountPercent).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Porcentaje de Cobertura:</span>
                    <span className="font-bold text-sky-700">{Number(agreement.coveragePercent).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Copago por prestación:</span>
                    <span className="font-bold text-slate-900">${Number(agreement.copayAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Límite de cobertura:</span>
                    <span className="font-bold text-slate-900">
                      {agreement.coverageLimitAmount ? `$${Number(agreement.coverageLimitAmount).toFixed(2)}` : "Sin límite"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Entity & Validity */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Info className="h-4 w-4 text-sky-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Entidad & Vigencia</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Empresa / Entidad:</span>
                    <span className="font-semibold text-slate-900">{agreement.entityName || "Sin entidad"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Tipo de convenio:</span>
                    <span className="font-semibold text-slate-900">{typeLabels[agreement.type] || agreement.type}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Fecha de Inicio:</span>
                    <span className="font-medium text-slate-800">
                      {agreement.startsAt
                        ? new Date(agreement.startsAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
                        : "Sin fecha de inicio"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Fecha de Fin:</span>
                    <span className="font-medium text-slate-800">
                      {agreement.endsAt
                        ? new Date(agreement.endsAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
                        : "Vigencia Indefinida"}
                    </span>
                  </div>
                </div>
                {agreement.description ? (
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-xs text-slate-600 italic">
                    "{agreement.description}"
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tab === "branches" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-500">
                  {branches.length} sucursales autorizadas para operar este convenio.
                </p>
                <div className="w-64">
                  <Input
                    placeholder="Buscar sucursal..."
                    className="h-8 text-xs"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredBranches.length ? (
                <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                  {filteredBranches.map((b) => (
                    <div
                      key={b.branchId}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs hover:border-sky-300 transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {b.branch?.name || `Sucursal ID: ${b.branchId}`}
                        </p>
                        <p className="text-[10px] text-slate-500">Habilitada</p>
                      </div>
                      <Check className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={branches.length === 0 ? "Aplica a nivel general" : "Sin coincidencias"}
                  description={
                    branches.length === 0
                      ? "No hay restricción de sucursal; disponible en todas las clínicas de la organización."
                      : "No se encontraron sucursales con ese término de búsqueda."
                  }
                />
              )}
            </div>
          )}

          {tab === "config" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border p-4 space-y-1.5 ${agreement.appliesToLabs ? "border-sky-200 bg-sky-50/50" : "border-slate-200 bg-white opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Laboratorio</span>
                  <Badge value={agreement.appliesToLabs ? "Habilitado" : "No aplica"} tone={agreement.appliesToLabs ? "brand" : "default"} />
                </div>
                <p className="text-[11px] text-slate-500">Aplica descuento y arancel a trabajos de laboratorio protésico.</p>
              </div>

              <div className={`rounded-xl border p-4 space-y-1.5 ${agreement.appliesToOtherCategories ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Categorías Extra</span>
                  <Badge value={agreement.appliesToOtherCategories ? "Habilitado" : "No aplica"} tone={agreement.appliesToOtherCategories ? "brand" : "default"} />
                </div>
                <p className="text-[11px] text-slate-500">Extiende reglas tarifarias a categorías complementarias.</p>
              </div>

              <div className={`rounded-xl border p-4 space-y-1.5 ${agreement.payrollDiscount ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Descuento Nómina</span>
                  <Badge value={agreement.payrollDiscount ? "Habilitado" : "No aplica"} tone={agreement.payrollDiscount ? "success" : "default"} />
                </div>
                <p className="text-[11px] text-slate-500">Permite diferir cobro a cuenta corporativa para descuento directo por planilla.</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end border-t border-slate-200 bg-white px-6 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
