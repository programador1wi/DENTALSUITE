import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Copy, Edit3, FileClock, History, Plus, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useProcedureCategories, useProcedures, useProcedureMutations } from "@/features/settings/procedures/hooks/use-procedures";
import { usePriceListAvailabilityMatrix } from "../hooks/use-price-lists";
import { usePriceListHistory, useVersionedPriceLists, useVersionItems, useVersionedPriceMutations } from "../hooks/use-versioned-price-lists";
import {
  applyPriceImport,
  copyPriceItems,
  createPriceImport,
  createPriceTemplateFromItems,
  listPriceTemplates,
  type Currency,
  type PriceImportV2,
  type PriceListStatus,
  type PriceListVersionItemV2
} from "../services/versioned-price-lists.service";

const statusLabel: Record<PriceListStatus, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programado",
  ACTIVE: "Activo",
  SUPERSEDED: "Reemplazado",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado"
};

function statusTone(status: PriceListStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "DRAFT" || status === "SCHEDULED") return "warning" as const;
  return "default" as const;
}

function money(value: string, currency: Currency) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value));
}

function procedureDisplayId(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "-";
  return String(Number(value)).padStart(6, "0");
}

function historyDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const auditActionLabel: Record<string, string> = {
  "price_list.created": "Listado creado",
  "price_list.version_created": "Borrador creado",
  "price_list.version_superseded": "Versión reemplazada",
  "price_list.published": "Versión publicada",
  "price_list_item.deactivated": "Prestación desactivada",
  "price_import.applied": "Importación aplicada",
  "price_import.reverted": "Importación revertida",
  "treatment_plan.repriced": "Tratamiento recalculado"
};

const emptyWizard = { code: "", name: "", description: "", currency: "MXN" as Currency, validFrom: "", validTo: "", branchIds: [] as string[], basePriceListId: "", copyPrices: true, copyDiscounts: true, copyCosts: true };
const emptyItem = { procedureId: "", procedureCode: "", procedureName: "", basePrice: "0.00", laboratoryCost: "0.00", internalCost: "0.00", allowDiscount: true, maxDiscountPercent: "100.00" };
const typeLabel = { CLINICAL: "Accion Clinica", LAB: "De Laboratorio", MIXED: "Mixta" };

export function VersionedPriceListsPage() {
  const { user, hasPermission } = usePermissions();
  const navigate = useNavigate();
  const { categoryId: routeCategoryId } = useParams();
  const [urlSearchParams] = useSearchParams();
  const legacyPermission: Record<string, string> = {
    "price_list.create": "price_lists.create",
    "price_list.edit_draft": "price_lists.update",
    "price_list.publish": "price_lists.update",
    "price_list.view": "price_lists.read",
    "price_list.import": "price_lists.update",
    "price_template.view": "price_lists.read",
    "price_template.manage": "price_lists.update"
  };
  const can = (permission: string) => hasPermission(permission) || hasPermission(legacyPermission[permission] ?? "__none__") || hasPermission("system.manage_all");
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(urlSearchParams.get("includeInactive") === "true");
  const [selectedId, setSelectedId] = useState(urlSearchParams.get("listId") ?? "");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState(emptyWizard);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingItem, setEditingItem] = useState<PriceListVersionItemV2 | null>(null);
  const [procedureSearchText, setProcedureSearchText] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(routeCategoryId ?? "");
  const [section, setSection] = useState<"clinical" | "lab">(urlSearchParams.get("section") === "lab" ? "lab" : "clinical");
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: Array<{ code: string; message: string }>; warnings: Array<{ code: string; message: string }> } | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<PriceImportV2 | null>(null);
  const [importRows, setImportRows] = useState<Array<{ code: string; name?: string; price: string; currency: Currency; laboratoryCost?: string; internalCost?: string; allowDiscount?: boolean; maxDiscountPercent?: string }>>([]);
  const [importFileName, setImportFileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const lists = useVersionedPriceLists("", includeInactive);
  const availability = usePriceListAvailabilityMatrix();
  const procedures = useProcedures("", "true");
  const procedureCategories = useProcedureCategories("", "true");
  const mutations = useVersionedPriceMutations();
  const procedureMutations = useProcedureMutations();
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ["settings", "price-templates"], queryFn: listPriceTemplates, enabled: templatesOpen });
  const selected = useMemo(() => lists.data?.find((list) => list.id === selectedId) ?? lists.data?.[0] ?? null, [lists.data, selectedId]);
  const latestVersion = selected?.versionsV2[0];
  const history = usePriceListHistory(selected?.id);
  const items = useVersionItems(latestVersion?.id);
  const versionItems = items.data ?? [];
  const activeCategories = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const allProcedures = procedures.data ?? [];
    return (procedureCategories.data ?? [])
      .filter((category) => section === "lab" ? category.type === "LAB" : category.type !== "LAB")
      .map((category) => {
        const configuredItems = versionItems.filter((item) => item.procedure.category.id === category.id);
        const catalogProcedures = allProcedures.filter((procedure) => procedure.category.id === category.id);
        return { category, configuredItems, catalogProcedures };
      })
      .filter(({ category, configuredItems, catalogProcedures }) => {
        if (!needle) return true;
        return (
          category.name.toLowerCase().includes(needle) ||
          configuredItems.some((item) => `${procedureDisplayId(item.procedure.displayId)} ${item.procedure.code} ${item.procedure.name}`.toLowerCase().includes(needle)) ||
          catalogProcedures.some((procedure) => `${procedureDisplayId(procedure.displayId)} ${procedure.code} ${procedure.name}`.toLowerCase().includes(needle))
        );
      })
      .sort((left, right) => left.category.sortOrder - right.category.sortOrder || left.category.name.localeCompare(right.category.name));
  }, [procedureCategories.data, procedures.data, search, section, versionItems]);
  const selectedCategory = (procedureCategories.data ?? []).find((category) => category.id === selectedCategoryId) ?? null;
  const selectedCategoryItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return versionItems
      .filter((item) => !selectedCategoryId || item.procedure.category.id === selectedCategoryId)
      .filter((item) => !needle || `${procedureDisplayId(item.procedure.displayId)} ${item.procedure.code} ${item.procedure.name}`.toLowerCase().includes(needle))
      .sort((left, right) => left.procedure.name.localeCompare(right.procedure.name));
  }, [search, selectedCategoryId, versionItems]);
  const procedureOptions = (procedures.data ?? [])
    .filter((procedure) => !selectedCategoryId || procedure.category.id === selectedCategoryId)
    .filter((procedure) => section === "lab" ? procedure.type === "LAB" : procedure.type !== "LAB")
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedProcedure = procedureOptions.find((p) => p.id === itemForm.procedureId);

  useEffect(() => {
    if (!selectedId && lists.data?.[0]) setSelectedId(lists.data[0].id);
  }, [lists.data, selectedId]);

  useEffect(() => {
    setSelectedCategoryId(routeCategoryId ?? "");
  }, [routeCategoryId]);

  const priceListSearch = (overrides?: { listId?: string; section?: "clinical" | "lab"; includeInactive?: boolean }) => {
    const params = new URLSearchParams();
    const nextListId = overrides?.listId ?? selected?.id ?? selectedId;
    const nextSection = overrides?.section ?? section;
    const nextIncludeInactive = overrides?.includeInactive ?? includeInactive;
    if (nextListId) params.set("listId", nextListId);
    if (nextSection !== "clinical") params.set("section", nextSection);
    if (nextIncludeInactive) params.set("includeInactive", "true");
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const openCategoryRoute = (categoryId: string) => {
    navigate(`/settings/price-lists/categories/${categoryId}${priceListSearch()}`);
  };

  const openCategoriesRoute = (overrides?: { listId?: string; section?: "clinical" | "lab"; includeInactive?: boolean }, replace = false) => {
    navigate(`/settings/price-lists${priceListSearch(overrides)}`, { replace });
  };

  const changeSection = (nextSection: "clinical" | "lab") => {
    setSection(nextSection);
    openCategoriesRoute({ section: nextSection });
  };

  const changeSelectedList = (nextListId: string) => {
    setSelectedId(nextListId);
    if (selectedCategoryId) {
      navigate(`/settings/price-lists/categories/${selectedCategoryId}${priceListSearch({ listId: nextListId })}`, { replace: true });
    } else {
      openCategoriesRoute({ listId: nextListId }, true);
    }
  };

  const changeIncludeInactive = (nextIncludeInactive: boolean) => {
    setIncludeInactive(nextIncludeInactive);
    if (selectedCategoryId) {
      navigate(`/settings/price-lists/categories/${selectedCategoryId}${priceListSearch({ includeInactive: nextIncludeInactive })}`, { replace: true });
    } else {
      openCategoriesRoute({ includeInactive: nextIncludeInactive }, true);
    }
  };

  if (lists.isLoading) return <LoadingState />;
  if (lists.isError) return <ErrorState message="No fue posible cargar listados versionados" />;

  const submitWizard = async () => {
    if (!user) return;
    try {
      const scopes = wizard.branchIds.length
        ? wizard.branchIds.map((scopeKey) => ({ scopeType: "BRANCH" as const, scopeKey }))
        : [{ scopeType: "ORGANIZATION" as const, scopeKey: user.organizationId }];
      const created = await mutations.createList.mutateAsync({
        code: wizard.code,
        name: wizard.name,
        description: wizard.description || undefined,
        currency: wizard.currency,
        validFrom: wizard.validFrom || undefined,
        validTo: wizard.validTo || undefined,
        basePriceListId: wizard.basePriceListId || undefined,
        scopes
      });
      if (wizard.basePriceListId) {
        const base = lists.data?.find((list) => list.id === wizard.basePriceListId);
        if (base?.versionsV2[0] && created.versionsV2[0]) {
          await copyPriceItems({
            targetListId: created.id,
            sourceVersionId: base.versionsV2[0].id,
            targetVersionId: created.versionsV2[0].id,
            updatePrices: wizard.copyPrices,
            copyDiscounts: wizard.copyDiscounts,
            copyCosts: wizard.copyCosts
          });
        }
      }
      setSelectedId(created.id);
      setWizardOpen(false);
      setWizard(emptyWizard);
      setWizardStep(1);
      setMessage("Borrador creado. Valida prestaciones antes de publicar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible crear listado");
    }
  };

  const openPublication = async () => {
    if (!latestVersion) return;
    setPublishOpen(true);
    setValidation(null);
    const result = await mutations.validate.mutateAsync(latestVersion.id);
    setValidation(result);
  };

  const publish = async () => {
    if (!latestVersion) return;
    await mutations.publish.mutateAsync({ version: latestVersion, changeSummary });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["treatment-plan-price-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["settings", "versioned-price-lists", "history", selected?.id] })
    ]);
    setPublishOpen(false);
    setMessage("Version publicada. Versiones anteriores permanecen inmutables.");
  };

  const createNextVersion = async () => {
    if (!selected) return;
    await mutations.createVersion.mutateAsync(selected);
    setMessage("Nueva version borrador creada desde version vigente.");
  };

  const openNewItem = (categoryId?: string) => {
    if (categoryId) setSelectedCategoryId(categoryId);
    setEditingItem(null);
    setItemForm(emptyItem);
    setProcedureSearchText("");
    setItemOpen(true);
  };

  const openEditItem = (item: PriceListVersionItemV2) => {
    setSelectedCategoryId(item.procedure.category.id);
    setEditingItem(item);
    setItemForm({
      procedureId: item.procedureId,
      procedureCode: item.procedure.code,
      procedureName: item.procedure.name,
      basePrice: item.basePrice,
      laboratoryCost: item.laboratoryCost,
      internalCost: item.internalCost,
      allowDiscount: item.allowDiscount,
      maxDiscountPercent: item.maxDiscountPercent
    });
    setItemOpen(true);
  };

  const saveItem = async () => {
    if (!latestVersion) return;
    
    let procedureId = itemForm.procedureId;
    
    if (!procedureId && itemForm.procedureCode.trim() && itemForm.procedureName.trim() && selectedCategory) {
      const inferredType = Number(itemForm.laboratoryCost) > 0
        ? "MIXED"
        : (section === "lab" ? "LAB" : "CLINICAL");
      const procedurePayload = {
        categoryId: selectedCategory.id,
        code: itemForm.procedureCode.trim(),
        name: itemForm.procedureName.trim(),
        type: inferredType as any,
        defaultDuration: 30,
        requiresTooth: false,
        requiresSurface: false,
        requiresLab: inferredType !== "CLINICAL" || Number(itemForm.laboratoryCost) > 0
      };
      
      const createdProcedure = await procedureMutations.createProcedure.mutateAsync(procedurePayload);
      procedureId = createdProcedure.id;
    }
    
    if (!procedureId) return;

    const payload = {
      procedureId,
      basePrice: itemForm.basePrice,
      laboratoryCost: itemForm.laboratoryCost,
      internalCost: itemForm.internalCost,
      allowDiscount: itemForm.allowDiscount,
      maxDiscountPercent: itemForm.allowDiscount ? itemForm.maxDiscountPercent : "0.00",
      expectedVersion: editingItem?.version
    };
    if (editingItem) {
      await mutations.updateItem.mutateAsync({ itemId: editingItem.id, payload });
    } else {
      await mutations.saveItem.mutateAsync({ versionId: latestVersion.id, payload });
    }
    setItemOpen(false);
    setEditingItem(null);
    setItemForm(emptyItem);
    await items.refetch();
  };

  const deactivateItem = async (item: PriceListVersionItemV2) => {
    await mutations.deactivateItem.mutateAsync({ itemId: item.id, expectedVersion: item.version });
    await items.refetch();
    setMessage("Prestacion desactivada en el borrador. Versiones publicadas no fueron modificadas.");
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !items.data?.length) return;
    await createPriceTemplateFromItems({
      name: templateName.trim(),
      branchIds: latestVersion?.scopes.filter((scope) => scope.scopeType === "BRANCH").map((scope) => scope.scopeKey) ?? [],
      sections: [{ name: selected?.name ?? "Prestaciones", items: items.data.map((item) => ({ procedureId: item.procedureId, quantity: "1" })) }]
    });
    setTemplateName("");
    await templates.refetch();
    setMessage("Plantilla creada como borrador sin vincular planes existentes.");
  };

  const readImportFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const headers = (lines.shift() ?? "").split(",").map((value) => value.trim().toLowerCase());
    const at = (cells: string[], name: string) => cells[headers.indexOf(name)]?.trim();
    setImportRows(lines.map((line) => {
      const cells = line.split(",");
      return {
        code: at(cells, "code") ?? at(cells, "codigo") ?? "",
        name: at(cells, "name") ?? at(cells, "nombre"),
        price: at(cells, "price") ?? at(cells, "precio") ?? "0",
        currency: (at(cells, "currency") ?? at(cells, "moneda") ?? latestVersion?.currency ?? "MXN") as Currency,
        laboratoryCost: at(cells, "laboratorycost") ?? at(cells, "costo laboratorio") ?? "0",
        internalCost: at(cells, "internalcost") ?? at(cells, "costo interno") ?? "0",
        allowDiscount: !["false", "no", "0"].includes((at(cells, "allowdiscount") ?? at(cells, "descuento") ?? "true").toLowerCase()),
        maxDiscountPercent: at(cells, "maxdiscountpercent") ?? "100"
      };
    }).filter((row) => row.code));
    setImportFileName(file.name);
    setImportPreview(null);
  };

  const validateImport = async () => {
    if (!selected || !latestVersion || !importRows.length) return;
    setImportPreview(await createPriceImport({
      priceListId: selected.id,
      priceListVersionId: latestVersion.id,
      fileName: importFileName,
      idempotencyKey: crypto.randomUUID(),
      rows: importRows
    }));
  };

  const applyImport = async () => {
    if (!importPreview) return;
    const applied = await applyPriceImport(importPreview.id);
    setImportPreview(applied);
    await items.refetch();
    await queryClient.invalidateQueries({ queryKey: ["settings", "versioned-price-lists"] });
    setMessage(`Importacion aplicada: ${applied.summary?.applied ?? importRows.length} filas.`);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Listado de precios" description="Aranceles versionados, vigentes por sucursal y con trazabilidad historica." helpText="Publicar congela precios. Para cambiar una version activa, crea una nueva version borrador." />
      {message ? <div className="rounded-md border border-[var(--border-brand)] bg-[var(--bg-brand-light)] px-4 py-3 text-sm text-[var(--text-brand-strong)]">{message}</div> : null}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
          <div className="flex items-center gap-1 text-sm">
            <button type="button" className="rounded-md bg-[var(--bg-brand-light)] px-3 py-2 font-semibold text-[var(--text-brand)]">Listado de precios</button>
            <button type="button" onClick={() => changeSection("clinical")} className={`px-3 py-2 ${section === "clinical" ? "font-semibold text-[var(--text-brand)]" : "text-[var(--text-secondary)]"}`}>De acciones clinicas</button>
            <button type="button" onClick={() => changeSection("lab")} className={`px-3 py-2 ${section === "lab" ? "font-semibold text-[var(--text-brand)]" : "text-[var(--text-secondary)]"}`}>De laboratorio</button>
          </div>
          {can("price_list.create") ? <Button size="sm" onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4" /> Nuevo listado</Button> : null}
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <Select value={selected?.id ?? ""} onChange={(event) => changeSelectedList(event.target.value)} containerClassName="max-w-[320px]">
            {(lists.data ?? []).map((list) => <option key={list.id} value={list.id}>{list.code} · {list.name}</option>)}
          </Select>
          <div className="relative min-w-[240px] flex-1 max-w-[360px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-secondary)]" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar categoria, prestacion o codigo" /></div>
          {can("price_template.view") ? <Button variant="secondary" size="sm" onClick={() => setTemplatesOpen(true)}><FileClock className="h-4 w-4" /> Plantillas</Button> : null}
          {can("price_list.import") && latestVersion?.status === "DRAFT" ? <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Importar</Button> : null}
        </div>
      </Card>

      {selected && latestVersion ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--text-brand-strong)]">{selected.name}</h3><Badge value={`v${latestVersion.versionNumber}`} tone="brand" /><Badge value={statusLabel[latestVersion.status]} tone={statusTone(latestVersion.status)} /></div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{selected.code} - {latestVersion.currency} - {latestVersion._count.items} prestaciones - {latestVersion.scopes.length} alcances</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("price_list.view") ? <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /> Historial</Button> : null}
              {latestVersion.status !== "DRAFT" && can("price_list.edit_draft") ? <Button variant="secondary" size="sm" onClick={createNextVersion}><Copy className="h-4 w-4" /> Editar proxima version</Button> : null}
              {latestVersion.status === "DRAFT" && can("price_list.edit_draft") ? <Button variant="secondary" size="sm" onClick={() => openNewItem(selectedCategory?.id)}><Plus className="h-4 w-4" /> Nueva prestacion</Button> : null}
              {latestVersion.status === "DRAFT" && can("price_list.publish") ? <Button size="sm" onClick={openPublication}><ShieldCheck className="h-4 w-4" /> Previsualizar y publicar</Button> : null}
            </div>
          </div>
          <div className="overflow-x-auto">
            {!selectedCategory ? (
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[var(--bg-subtle)] text-left"><tr><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Prestaciones</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
                <tbody>
                  {activeCategories.map(({ category, configuredItems, catalogProcedures }) => (
                    <tr key={category.id} className="border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openCategoryRoute(category.id)} className="inline-flex items-center gap-2 font-medium text-[var(--text-brand)]">
                          {category.name} <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{typeLabel[category.type]}</td>
                      <td className="px-4 py-3 text-right">{configuredItems.length} / {catalogProcedures.length}</td>
                      <td className="px-4 py-3 text-right"><Button variant="secondary" size="sm" onClick={() => openCategoryRoute(category.id)}>Entrar</Button></td>
                    </tr>
                  ))}
                  {!procedureCategories.isLoading && !activeCategories.length ? <tr><td colSpan={4} className="px-4 py-12 text-center text-[var(--text-secondary)]">No hay categorias para el filtro seleccionado.</td></tr> : null}
                </tbody>
              </table>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3">
                  <div>
                    <button type="button" onClick={() => openCategoriesRoute()} className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--text-brand)]"><ChevronLeft className="h-3.5 w-3.5" /> Volver a categorias</button>
                    <h4 className="font-semibold text-[var(--text-brand-strong)]">{selected.name} / {selectedCategory.name}</h4>
                  </div>
                  {latestVersion.status === "DRAFT" && can("price_list.edit_draft") ? <Button size="sm" onClick={() => openNewItem(selectedCategory.id)}><Plus className="h-4 w-4" /> Nuevo producto</Button> : null}
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[var(--bg-subtle)] text-left"><tr><th className="w-[110px] px-4 py-3">ID</th><th className="w-[120px] px-4 py-3">Codigo</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Permite descuento</th><th className="px-4 py-3 text-right">Precio final</th><th className="px-4 py-3 text-right">Costo laboratorio</th><th className="px-4 py-3 text-right">Opciones</th></tr></thead>
                  <tbody>
                    {selectedCategoryItems.map((item) => {
                      if (itemOpen && editingItem?.id === item.id) {
                        return (
                          <tr key={item.id} className="border-t border-[var(--border-default)] bg-amber-50/20">
                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                              {procedureDisplayId(item.procedure.displayId)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-brand)]">
                              {item.procedure.code}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {item.procedure.name}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={itemForm.allowDiscount}
                                  onChange={(e) => setItemForm({ ...itemForm, allowDiscount: e.target.checked })}
                                  className="h-4 w-4"
                                />
                                {itemForm.allowDiscount && (
                                  <Input
                                    inputMode="decimal"
                                    value={itemForm.maxDiscountPercent}
                                    onChange={(e) => setItemForm({ ...itemForm, maxDiscountPercent: e.target.value })}
                                    className="h-8 w-16 px-1.5 text-center text-xs"
                                    placeholder="%"
                                    title="Parametro heredado de descuento"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input
                                inputMode="decimal"
                                value={itemForm.basePrice}
                                onChange={(e) => setItemForm({ ...itemForm, basePrice: e.target.value })}
                                className="h-8 text-right font-semibold"
                              />
                            </td>
                            <td className="px-4 py-3">
                               <Input
                                 inputMode="decimal"
                                 value={itemForm.laboratoryCost}
                                 onChange={(e) => setItemForm({ ...itemForm, laboratoryCost: e.target.value })}
                                 className="h-8 text-right text-xs"
                                 placeholder="0.00"
                               />
                             </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  disabled={mutations.updateItem.isPending}
                                  onClick={saveItem}
                                  className="h-8 px-2.5 text-xs"
                                >
                                  Guardar
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setItemOpen(false);
                                    setEditingItem(null);
                                  }}
                                  className="h-8 px-2.5 text-xs"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]">
                          <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{procedureDisplayId(item.procedure.displayId)}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-brand)]">{item.procedure.code}</td>
                          <td className="px-4 py-3 font-medium">
                            {item.procedure.name}
                            {item.procedure.requiresLab && Number(item.laboratoryCost) === 0 ? <p className="mt-1 text-xs text-[var(--status-warning-text)]">Requiere laboratorio sin costo configurado</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={item.allowDiscount} readOnly className="h-4 w-4" />
                              {item.allowDiscount ? (
                                <span className="text-xs font-semibold text-emerald-700">Permite descuento</span>
                              ) : (
                                <span className="text-xs font-semibold text-[var(--text-secondary)]">No permite descuento</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{money(item.basePrice, latestVersion.currency)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col text-right">
                              <span>{money(item.laboratoryCost, latestVersion.currency)}</span>
                              {Number(item.internalCost) > 0 && (
                                <span className="text-[10px] text-[var(--text-secondary)]">Cost. int: {money(item.internalCost, latestVersion.currency)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {latestVersion.status === "DRAFT" && can("price_list.edit_draft") ? (
                              <div className="flex justify-end gap-2">
                                <Button variant="secondary" size="sm" onClick={() => openEditItem(item)}><Edit3 className="h-4 w-4" /></Button>
                                <Button variant="danger" size="sm" onClick={() => deactivateItem(item)} disabled={mutations.deactivateItem.isPending}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            ) : <span className="text-[var(--text-secondary)]">-</span>}
                          </td>
                        </tr>
                      );
                    })}

                    {itemOpen && !editingItem ? (
                      <tr className="border-t border-[var(--border-default)] bg-emerald-50/20">
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">-</td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={itemForm.procedureCode}
                            onChange={(e) => setItemForm({ ...itemForm, procedureCode: e.target.value })}
                            placeholder="Código"
                            className="h-8 w-24 font-mono text-xs text-slate-800"
                            disabled={Boolean(itemForm.procedureId)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <Input
                              type="text"
                              value={itemForm.procedureName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemForm({ ...itemForm, procedureName: val });
                                
                                const found = procedureOptions.find((p) =>
                                  `${procedureDisplayId(p.displayId)} - ${p.code} - ${p.name}`.toLowerCase() === val.toLowerCase() ||
                                  `${p.code} - ${p.name}`.toLowerCase() === val.toLowerCase() ||
                                  p.name.toLowerCase() === val.toLowerCase()
                                );
                                if (found) {
                                  setItemForm((f) => ({
                                    ...f,
                                    procedureId: found.id,
                                    procedureCode: found.code,
                                    procedureName: found.name
                                  }));
                                } else {
                                  setItemForm((f) => ({
                                    ...f,
                                    procedureId: ""
                                  }));
                                }
                              }}
                              placeholder="Escribir para buscar o crear..."
                              list="procedure-datalist"
                              className="h-8"
                            />
                            <datalist id="procedure-datalist">
                              {procedureOptions.map((p) => (
                                <option key={p.id} value={`${procedureDisplayId(p.displayId)} - ${p.code} - ${p.name}`} />
                              ))}
                            </datalist>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={itemForm.allowDiscount}
                              onChange={(e) => setItemForm({ ...itemForm, allowDiscount: e.target.checked })}
                              className="h-4 w-4"
                            />
                            {itemForm.allowDiscount && (
                              <Input
                                inputMode="decimal"
                                value={itemForm.maxDiscountPercent}
                                onChange={(e) => setItemForm({ ...itemForm, maxDiscountPercent: e.target.value })}
                                className="h-8 w-16 px-1.5 text-center text-xs"
                                placeholder="%"
                                title="Parametro heredado de descuento"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Input
                            inputMode="decimal"
                            value={itemForm.basePrice}
                            onChange={(e) => setItemForm({ ...itemForm, basePrice: e.target.value })}
                            className="h-8 text-right font-semibold"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                           <Input
                             inputMode="decimal"
                             value={itemForm.laboratoryCost}
                             onChange={(e) => setItemForm({ ...itemForm, laboratoryCost: e.target.value })}
                             className="h-8 text-right text-xs"
                             placeholder="0.00"
                           />
                         </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              disabled={
                                (!itemForm.procedureId && (!itemForm.procedureCode.trim() || !itemForm.procedureName.trim())) ||
                                mutations.saveItem.isPending ||
                                procedureMutations.createProcedure.isPending
                              }
                              onClick={saveItem}
                              className="h-8 px-2.5 text-xs"
                            >
                              Guardar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setItemOpen(false);
                                setEditingItem(null);
                              }}
                              className="h-8 px-2.5 text-xs"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {!items.isLoading && !selectedCategoryItems.length && (!itemOpen || editingItem) ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-secondary)]">Categoria sin prestaciones configuradas en esta version.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : <Card className="p-10 text-center text-[var(--text-secondary)]">No existen listados versionados.</Card>}

      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={includeInactive} onChange={(event) => changeIncludeInactive(event.target.checked)} /> Mostrar archivados e inactivos</label>

      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title={`Nuevo listado · Paso ${wizardStep} de 6`} size="lg">
        <div className="mb-5 grid grid-cols-6 gap-1">{[1,2,3,4,5,6].map((step) => <div key={step} className={`h-1.5 rounded-full ${step <= wizardStep ? "bg-[var(--action-primary)]" : "bg-[var(--border-default)]"}`} />)}</div>
        {wizardStep === 1 ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Codigo<Input value={wizard.code} onChange={(e) => setWizard({ ...wizard, code: e.target.value })} /></label><label className="text-sm">Nombre<Input value={wizard.name} onChange={(e) => setWizard({ ...wizard, name: e.target.value })} /></label><label className="text-sm sm:col-span-2">Descripcion<Textarea value={wizard.description} onChange={(e) => setWizard({ ...wizard, description: e.target.value })} /></label><label className="text-sm">Moneda<Select value={wizard.currency} onChange={(e) => setWizard({ ...wizard, currency: e.target.value as Currency })}><option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option></Select></label></div> : null}
        {wizardStep === 2 ? <div><p className="mb-3 text-sm text-[var(--text-secondary)]">Sin seleccion se aplicara a toda organizacion. Selecciona sucursales para limitar alcance.</p><div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{availability.data?.branches.map((branch) => <label key={branch.id} className="flex items-center gap-2 rounded-md border border-[var(--border-default)] p-3 text-sm"><input type="checkbox" checked={wizard.branchIds.includes(branch.id)} onChange={(e) => setWizard({ ...wizard, branchIds: e.target.checked ? [...wizard.branchIds, branch.id] : wizard.branchIds.filter((id) => id !== branch.id) })} /> {branch.name}</label>)}</div></div> : null}
        {wizardStep === 3 ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Inicio vigencia<Input type="datetime-local" value={wizard.validFrom} onChange={(e) => setWizard({ ...wizard, validFrom: e.target.value })} /></label><label className="text-sm">Fin vigencia<Input type="datetime-local" value={wizard.validTo} onChange={(e) => setWizard({ ...wizard, validTo: e.target.value })} /></label></div> : null}
        {wizardStep === 4 ? <div><p className="mb-3 text-sm text-[var(--text-secondary)]">La copia reutiliza definiciones clinicas; no duplica prestaciones.</p><label className="text-sm">Lista base opcional<Select value={wizard.basePriceListId} onChange={(event) => setWizard({ ...wizard, basePriceListId: event.target.value })}><option value="">Crear vacia</option>{(lists.data ?? []).map((list) => <option key={list.id} value={list.id}>{list.code} · {list.name}</option>)}</Select></label></div> : null}
        {wizardStep === 5 ? <div className="space-y-3 text-sm"><label className="flex gap-2"><input type="checkbox" checked={wizard.copyPrices} disabled={!wizard.basePriceListId} onChange={(event) => setWizard({ ...wizard, copyPrices: event.target.checked })} /> Copiar prestaciones y precios</label><label className="flex gap-2"><input type="checkbox" checked={wizard.copyDiscounts} disabled={!wizard.basePriceListId} onChange={(event) => setWizard({ ...wizard, copyDiscounts: event.target.checked })} /> Copiar reglas de descuento</label><label className="flex gap-2"><input type="checkbox" checked={wizard.copyCosts} disabled={!wizard.basePriceListId} onChange={(event) => setWizard({ ...wizard, copyCosts: event.target.checked })} /> Copiar costos internos y laboratorio</label><p className="text-xs text-[var(--text-secondary)]">La operacion usa idempotency-key y conserva source_item_id.</p></div> : null}
        {wizardStep === 6 ? <div className="rounded-md bg-[var(--bg-subtle)] p-4 text-sm"><p className="font-semibold">Previsualizacion</p><dl className="mt-3 grid grid-cols-2 gap-2"><dt>Listado</dt><dd>{wizard.code} · {wizard.name}</dd><dt>Moneda</dt><dd>{wizard.currency}</dd><dt>Alcance</dt><dd>{wizard.branchIds.length ? `${wizard.branchIds.length} sucursales` : "Organizacion"}</dd><dt>Estado inicial</dt><dd>Borrador</dd></dl></div> : null}
        <div className="mt-6 flex justify-between"><Button variant="secondary" disabled={wizardStep === 1} onClick={() => setWizardStep((step) => step - 1)}>Anterior</Button>{wizardStep < 6 ? <Button disabled={wizardStep === 1 && (!wizard.code.trim() || !wizard.name.trim())} onClick={() => setWizardStep((step) => step + 1)}>Continuar</Button> : <Button onClick={submitWizard} disabled={mutations.createList.isPending}>Guardar borrador</Button>}</div>
      </Modal>



      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Plantillas de prestaciones" size="lg">
        <div className="space-y-4">
          {templates.isLoading ? <LoadingState /> : (templates.data ?? []).map((template) => (
            <div key={template.id} className="flex items-center justify-between rounded-md border border-[var(--border-default)] p-3">
              <div><p className="font-medium">{template.name}</p><p className="text-xs text-[var(--text-secondary)]">v{template.version} · {template.sections.reduce((total, section) => total + section.items.length, 0)} prestaciones</p></div>
              <Badge value={template.status} tone={template.status === "ACTIVE" ? "success" : "warning"} />
            </div>
          ))}
          {!templates.isLoading && !templates.data?.length ? <p className="py-6 text-center text-sm text-[var(--text-secondary)]">No hay plantillas configuradas.</p> : null}
          {can("price_template.manage") && items.data?.length ? <div className="border-t border-[var(--border-default)] pt-4"><label className="text-sm">Crear desde version seleccionada<Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nombre de plantilla" /></label><div className="mt-3 flex justify-end"><Button onClick={saveTemplate} disabled={!templateName.trim()}>Guardar plantilla borrador</Button></div></div> : null}
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar listado de precios" size="lg">
        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-[var(--border-default)] p-5 text-center"><Upload className="mx-auto mb-2 h-6 w-6 text-[var(--text-brand)]" /><Input type="file" accept=".csv,text/csv" onChange={(event) => readImportFile(event.target.files?.[0])} /><p className="mt-2 text-xs text-[var(--text-secondary)]">CSV con code, name, price, currency, laboratoryCost, internalCost y discount.</p></div>
          {importRows.length ? <div className="rounded-md bg-[var(--bg-subtle)] p-3 text-sm">{importFileName}: {importRows.length} filas normalizadas. Aun no se ha modificado el arancel.</div> : null}
          {importPreview ? <div className="space-y-2"><div className="flex items-center gap-2"><Badge value={importPreview.status} tone={importPreview.status === "READY" || importPreview.status === "APPLIED" ? "success" : "danger"} /><span className="text-sm">{importPreview.summary?.errors ?? 0} errores</span></div>{importPreview.errors?.map((error) => <p key={error.id} className="text-sm text-red-700">{error.code}: {error.message}</p>)}</div> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={validateImport} disabled={!importRows.length}>Validar y previsualizar</Button><Button onClick={applyImport} disabled={importPreview?.status !== "READY"}>Confirmar importacion</Button></div>
        </div>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historial de versiones y eventos" size="2xl">
        {history.isLoading ? <LoadingState /> : history.isError ? <ErrorState message={history.error.message} /> : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Versiones</h3>
              <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-subtle)] text-left text-xs text-[var(--text-secondary)]"><tr><th className="px-3 py-2">Versión</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Publicación</th><th className="px-3 py-2">Autor</th><th className="px-3 py-2 text-right">Prestaciones</th><th className="px-3 py-2 text-right">Tratamientos</th><th className="px-3 py-2">Resumen / checksum</th></tr></thead>
                  <tbody>
                    {(history.data?.versions ?? []).map((version) => (
                      <tr key={version.id} className="border-t border-[var(--border-default)] align-top">
                        <td className="px-3 py-3 font-semibold">v{version.versionNumber}</td>
                        <td className="px-3 py-3"><Badge value={statusLabel[version.status]} tone={statusTone(version.status)} /></td>
                        <td className="px-3 py-3 text-[var(--text-secondary)]">{historyDate(version.publishedAt ?? version.createdAt)}</td>
                        <td className="px-3 py-3 text-[var(--text-secondary)]">{version.publishedBy ? `${version.publishedBy.firstName} ${version.publishedBy.lastName}` : "—"}</td>
                        <td className="px-3 py-3 text-right">{version._count.items}</td>
                        <td className="px-3 py-3 text-right">{version._count.treatmentItems}</td>
                        <td className="max-w-[280px] px-3 py-3"><p>{version.changeSummary ?? "Sin resumen"}</p>{version.checksum ? <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-secondary)]" title={version.checksum}>{version.checksum}</p> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Eventos auditados</h3>
              <div className="space-y-2">
                {(history.data?.events ?? []).map((event) => (
                  <article key={event.id} className="rounded-md border border-[var(--border-default)] p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-semibold text-[var(--text-primary)]">{auditActionLabel[event.action] ?? event.action}</p><p className="text-xs text-[var(--text-secondary)]">{event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "Sistema"} · {historyDate(event.createdAt)}</p></div>
                      {event.correlationId ? <span className="font-mono text-[10px] text-[var(--text-secondary)]">{event.correlationId}</span> : null}
                    </div>
                    {event.reason ? <p className="mt-2 text-[var(--text-secondary)]">Motivo: {event.reason}</p> : null}
                    {event.oldValue !== undefined || event.newValue !== undefined ? <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-[var(--text-brand)]">Ver valores anterior y nuevo</summary><pre className="mt-2 max-h-52 overflow-auto rounded bg-[var(--bg-subtle)] p-2 text-[10px]">{JSON.stringify({ anterior: event.oldValue, nuevo: event.newValue }, null, 2)}</pre></details> : null}
                  </article>
                ))}
                {!history.data?.events.length ? <p className="py-6 text-center text-sm text-[var(--text-secondary)]">No hay eventos para este listado.</p> : null}
              </div>
            </section>
          </div>
        )}
      </Modal>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Previsualizar publicacion" size="lg">
        {!validation ? <LoadingState /> : <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">Esta publicación no modificará tratamientos existentes.</div>
          <div className={`rounded-md border p-4 ${validation.valid ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}><div className="flex items-center gap-2 font-semibold">{validation.valid ? <CheckCircle2 className="h-5 w-5 text-green-700" /> : <CalendarClock className="h-5 w-5 text-red-700" />}{validation.valid ? "Validacion aprobada" : "Publicacion bloqueada"}</div></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-sm">
            <dt className="text-[var(--text-secondary)]">Versión que será reemplazada</dt><dd className="font-semibold">{history.data?.activeVersion ? `v${history.data.activeVersion.versionNumber}` : "Ninguna"}</dd>
            <dt className="text-[var(--text-secondary)]">Tratamientos que conservan precio histórico</dt><dd className="font-semibold">{history.data?.activeVersion?._count.treatmentItems ?? 0}</dd>
            <dt className="text-[var(--text-secondary)]">Prestaciones nuevas en catálogo</dt><dd className="font-semibold">{history.data?.publicationPreview.newItemsCount ?? 0}</dd>
          </dl>
          {validation.errors.map((issue) => <p key={issue.code} className="text-sm text-red-700">{issue.code}: {issue.message}</p>)}
          {validation.warnings.map((issue) => <p key={issue.code} className="text-sm text-amber-700">{issue.code}: {issue.message}</p>)}
          <label className="block text-sm">Resumen de cambios<Textarea value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPublishOpen(false)}>Cancelar</Button><Button disabled={!validation.valid || !changeSummary.trim() || mutations.publish.isPending} onClick={publish}>Publicar version inmutable</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
