import { FormEvent, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Building2, ClipboardList, Check, Eye, Pencil, Calendar, DollarSign, Info } from "lucide-react";
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

const AGREEMENTS_V2_ENABLED = import.meta.env.VITE_AGREEMENTS_V2_ENABLED === "true";

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
  const priceLists = usePriceLists(undefined, "true");
  const branches = useBranches(undefined, "ACTIVE");
  const procedures = useProcedures(undefined, "true");
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Convenios"
        description="Convenios con arancel, descuento y asignación de pacientes."
        helpText="Un convenio vincula pacientes con un listado de precios o un descuento administrativo para presupuestos y cobros."
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={[
              { key: "list", label: "Listar" },
              { key: "debts", label: "$ Reporte deudas" }
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          {activeTab === "list" ? <Button onClick={startNewAgreement}>Agregar convenio</Button> : null}
        </div>

        {activeTab === "list" && (
          <div className="grid gap-3 md:grid-cols-3">
            <EntitySearchBox
              placeholder="Buscar convenio"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? (agreements.data ?? []) : []}
              onSelect={(agreement) => {
                setSearch(agreement.name);
                editAgreement(agreement);
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
            <Select value={active} onChange={(event) => setActive(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <Button type="button" variant="secondary" onClick={() => setAssignmentModalOpen(true)}>
                Asignar pacientes
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPreviewModalOpen(true)}>
                Previsualizar precio
              </Button>
            </div>
          </div>
        )}
      </Card>

      {activeTab === "list" ? (
        <div className="space-y-4">
          <Modal
            open={agreementModalOpen}
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
            open={assignmentModalOpen}
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
            open={previewModalOpen}
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

          <Modal
            open={!!selectedAgreementDetails}
            title="Detalles del convenio"
            onClose={() => setSelectedAgreementDetails(null)}
            size="lg"
          >
            {selectedAgreementDetails ? (
              <Card className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedAgreementDetails.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Versión actual: {selectedAgreementDetails.version}
                    </p>
                  </div>
                  <Badge
                    value={selectedAgreementDetails.status}
                    tone={
                      selectedAgreementDetails.status === "ACTIVE"
                        ? "success"
                        : selectedAgreementDetails.status === "CANCELLED"
                          ? "danger"
                          : "warning"
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* General Info */}
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Info className="h-3.5 w-3.5" />
                      Información General
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      <div>
                        <span className="text-slate-500">Empresa/Entidad: </span>
                        <strong className="text-slate-800">
                          {selectedAgreementDetails.entityName || "Sin entidad"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Tipo de convenio: </span>
                        <strong className="text-slate-800 capitalize">
                          {selectedAgreementDetails.type === "CORPORATE"
                            ? "Corporativo"
                            : selectedAgreementDetails.type === "INSURANCE"
                              ? "Aseguradora"
                              : selectedAgreementDetails.type === "MEMBERSHIP"
                                ? "Membresía"
                                : selectedAgreementDetails.type === "PAYROLL"
                                  ? "Nómina"
                                  : "Otro"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Visibilidad: </span>
                        <strong className="text-slate-800">
                          {selectedAgreementDetails.isPublic ? "Público para pacientes" : "Privado (interno)"}
                        </strong>
                      </div>
                      {selectedAgreementDetails.description && (
                        <div className="mt-1 border-t border-slate-200/60 pt-1">
                          <span className="block text-[11px] text-slate-400">Descripción:</span>
                          <p className="text-xs text-slate-600 italic">
                            {selectedAgreementDetails.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Rules */}
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <DollarSign className="h-3.5 w-3.5" />
                      Reglas Financieras
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      <div>
                        <span className="text-slate-500">Arancel/Listado: </span>
                        <strong className="text-slate-800">
                          {selectedAgreementDetails.priceList?.name || "Sin arancel - descuento directo"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Descuento general: </span>
                        <strong className="text-slate-800">
                          {Number(selectedAgreementDetails.discountPercent).toFixed(2)}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Cobertura: </span>
                        <strong className="text-slate-800">
                          {Number(selectedAgreementDetails.coveragePercent).toFixed(2)}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Copago por prestación: </span>
                        <strong className="text-slate-800">
                          ${Number(selectedAgreementDetails.copayAmount).toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Límite de cobertura: </span>
                        <strong className="text-slate-800">
                          {selectedAgreementDetails.coverageLimitAmount
                            ? `$${Number(selectedAgreementDetails.coverageLimitAmount).toFixed(2)}`
                            : "Sin límite"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Validity Period */}
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3 md:col-span-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Calendar className="h-3.5 w-3.5" />
                      Vigencia y Configuración Extra
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      <div>
                        <span className="text-slate-500">Inicio: </span>
                        <strong className="text-slate-800">
                          {selectedAgreementDetails.startsAt
                            ? new Date(selectedAgreementDetails.startsAt).toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                              })
                            : "Sin fecha de inicio"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Fin: </span>
                        <strong className="text-slate-800">
                          {selectedAgreementDetails.endsAt
                            ? new Date(selectedAgreementDetails.endsAt).toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                              })
                            : "Sin fecha de fin"}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200/60 pt-2.5">
                      {selectedAgreementDetails.appliesToLabs && (
                        <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          Aplica a laboratorio
                        </span>
                      )}
                      {selectedAgreementDetails.appliesToOtherCategories && (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          Aplica a categorías extra
                        </span>
                      )}
                      {selectedAgreementDetails.payrollDiscount && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Descuento en nómina
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Branches */}
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3 md:col-span-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Building2 className="h-3.5 w-3.5" />
                      Sucursales Habilitadas
                    </h4>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedAgreementDetails.versions?.[0]?.branches?.length ? (
                        selectedAgreementDetails.versions[0].branches.map((b) => (
                          <span
                            key={b.branchId}
                            className="rounded-full bg-slate-200/60 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {b.branch?.name || `Sucursal ID: ${b.branchId}`}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs italic text-slate-400">
                          Ninguna sucursal habilitada (aplica a nivel general)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => setSelectedAgreementDetails(null)}
                  >
                    Cerrar detalles
                  </Button>
                </div>
              </Card>
            ) : null}
          </Modal>

          <DataTable
            rows={agreements.data ?? []}
            empty={
              <EmptyState
                title="Sin convenios"
                description="Crea el primer convenio para asociar aranceles a pacientes."
              />
            }
            columns={[
              {
                key: "id",
                title: "# Id",
                cellClassName: "w-20 text-[var(--text-secondary)]",
                render: (row) => row.id.slice(-6).toUpperCase()
              },
              {
                key: "entityName",
                title: "Empresa",
                render: (row) => (
                  <div className="min-w-52">
                    <p className="font-medium text-[var(--text-brand)]">{row.entityName || row.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{row.name}</p>
                  </div>
                )
              },
              {
                key: "startsAt",
                title: "Fecha afiliación",
                render: (row) =>
                  row.startsAt
                    ? new Date(row.startsAt).toLocaleDateString("es-MX", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                      })
                    : "Sin vigencia"
              },
              {
                key: "discountPercent",
                title: "Convenio",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <span>{Number(row.discountPercent).toFixed(2)}%</span>
                    <Badge
                      value={row.status}
                      tone={
                        row.status === "ACTIVE"
                          ? "success"
                          : row.status === "CANCELLED"
                            ? "danger"
                            : "warning"
                      }
                    />
                  </div>
                )
              },
              {
                key: "_count",
                title: "Pacientes",
                cellClassName: "text-center",
                render: (row) => String(row._count.patients)
              },
              {
                key: "name",
                title: "Acciones",
                cellClassName: "w-32",
                render: (row) => (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedAgreementDetails(row)}
                      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-brand)] hover:bg-[var(--bg-subtle)] transition-all active:scale-95"
                      aria-label="Ver detalles"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editAgreement(row)}
                      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                      aria-label="Editar convenio"
                      title="Editar convenio"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <AgreementActionsMenu
                      agreement={row}
                      onEdit={() => editAgreement(row)}
                      onDuplicate={() => duplicateAgreement.mutate(row.id)}
                      onPublish={() => publishAgreement.mutate({ id: row.id, version: row.version })}
                      onCancel={() => cancelAgreement.mutate(row.id)}
                      onDeactivate={() => deactivateAgreement.mutate(row.id)}
                    />
                  </div>
                )
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
