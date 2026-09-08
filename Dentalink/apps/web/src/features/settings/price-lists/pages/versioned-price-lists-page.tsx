import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Edit3,
  FileClock,
  FlaskConical,
  FolderOpen,
  History,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Tag,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
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
import {
  auditActionLabel,
  auditItems,
  buildPriceItemDiffs,
  cleanAuditEntries,
  fieldLabels,
  historyDate,
  money,
  normalizeAuditRecord,
  procedureDisplayId,
  statusLabel,
  statusTone
} from "./versioned-price-list-page-model";

const emptyWizard = {
  code: "",
  name: "",
  description: "",
  currency: "MXN" as Currency,
  validFrom: "",
  validTo: "",
  branchIds: [] as string[],
  basePriceListId: "",
  copyPrices: true,
  copyDiscounts: true,
  copyCosts: true
};

const emptyItem = {
  procedureId: "",
  procedureCode: "",
  procedureName: "",
  basePrice: "0.00",
  laboratoryCost: "0.00",
  internalCost: "0.00",
  allowDiscount: true,
  maxDiscountPercent: "100.00"
};

const typeLabel = {
  CLINICAL: "Acción Clínica",
  LAB: "De Laboratorio",
  MIXED: "Mixta"
};

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

  const can = (permission: string) =>
    hasPermission(permission) || hasPermission(legacyPermission[permission] ?? "__none__") || hasPermission("organization.manage_all");

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

  const selected = useMemo(
    () => lists.data?.find((list) => list.id === selectedId) ?? lists.data?.[0] ?? null,
    [lists.data, selectedId]
  );
  const latestVersion = selected?.versionsV2[0];
  const history = usePriceListHistory(selected?.id);
  const items = useVersionItems(latestVersion?.id);
  const versionItems = items.data ?? [];

  const activeCategories = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const allProcedures = procedures.data ?? [];
    return (procedureCategories.data ?? [])
      .filter((category) => (section === "lab" ? category.type === "LAB" : category.type !== "LAB"))
      .map((category) => {
        const configuredItems = versionItems.filter((item) => item.procedure.category.id === category.id);
        const catalogProcedures = allProcedures.filter((procedure) => procedure.category.id === category.id);
        return { category, configuredItems, catalogProcedures };
      })
      .filter(({ category, configuredItems, catalogProcedures }) => {
        if (!needle) return true;
        return (
          category.name.toLowerCase().includes(needle) ||
          configuredItems.some((item) =>
            `${procedureDisplayId(item.procedure.displayId)} ${item.procedure.code} ${item.procedure.name}`
              .toLowerCase()
              .includes(needle)
          ) ||
          catalogProcedures.some((procedure) =>
            `${procedureDisplayId(procedure.displayId)} ${procedure.code} ${procedure.name}`
              .toLowerCase()
              .includes(needle)
          )
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
    .filter((procedure) => (section === "lab" ? procedure.type === "LAB" : procedure.type !== "LAB"))
    .sort((left, right) => left.name.localeCompare(right.name));

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
    navigate(`${APP_ROUTES.settings.priceListCategory(categoryId)}${priceListSearch()}`);
  };

  const openCategoriesRoute = (overrides?: { listId?: string; section?: "clinical" | "lab"; includeInactive?: boolean }, replace = false) => {
    navigate(`${APP_ROUTES.settings.priceLists}${priceListSearch(overrides)}`, { replace });
  };

  const changeSection = (nextSection: "clinical" | "lab") => {
    setSection(nextSection);
    openCategoriesRoute({ section: nextSection });
  };

  const changeSelectedList = (nextListId: string) => {
    setSelectedId(nextListId);
    if (selectedCategoryId) {
      navigate(`${APP_ROUTES.settings.priceListCategory(selectedCategoryId)}${priceListSearch({ listId: nextListId })}`, { replace: true });
    } else {
      openCategoriesRoute({ listId: nextListId }, true);
    }
  };

  const changeIncludeInactive = (nextIncludeInactive: boolean) => {
    setIncludeInactive(nextIncludeInactive);
    if (selectedCategoryId) {
      navigate(`${APP_ROUTES.settings.priceListCategory(selectedCategoryId)}${priceListSearch({ includeInactive: nextIncludeInactive })}`, { replace: true });
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
      const inferredType =
        Number(itemForm.laboratoryCost) > 0 ? "MIXED" : section === "lab" ? "LAB" : "CLINICAL";
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
    setImportRows(
      lines
        .map((line) => {
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
        })
        .filter((row) => row.code)
    );
    setImportFileName(file.name);
    setImportPreview(null);
  };

  const validateImport = async () => {
    if (!selected || !latestVersion || !importRows.length) return;
    setImportPreview(
      await createPriceImport({
        priceListId: selected.id,
        priceListVersionId: latestVersion.id,
        fileName: importFileName,
        idempotencyKey: crypto.randomUUID(),
        rows: importRows
      })
    );
  };

  const applyImport = async () => {
    if (!importPreview) return;
    const applied = await applyPriceImport(importPreview.id);
    setImportPreview(applied);
    await items.refetch();
    await queryClient.invalidateQueries({ queryKey: ["settings", "versioned-price-lists"] });
    setMessage(`Importacion aplicada: ${applied.summary?.applied ?? importRows.length} filas.`);
  };

  const totalCatalogProcedures = activeCategories.reduce((acc, cat) => acc + cat.catalogProcedures.length, 0);
  const totalConfiguredProcedures = activeCategories.reduce((acc, cat) => acc + cat.configuredItems.length, 0);
  const overallCoverage = totalCatalogProcedures > 0 ? Math.round((totalConfiguredProcedures / totalCatalogProcedures) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Listado de precios"
        description="Aranceles versionados, vigentes por sucursal y con trazabilidad histórica completa."
        helpText="Publicar congela precios y garantiza inmutabilidad histórica. Para cambiar un arancel activo, crea una nueva versión borrador."
      />

      {message ? (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="rounded p-1 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
            aria-label="Cerrar mensaje"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Unified Master Card */}
      {selected && latestVersion ? (
        <Card className="overflow-hidden border border-[var(--border-default)] bg-[var(--bg-surface)] p-0 shadow-sm">
          {/* 1. Header: List Selector & Actions Tier */}
          <div className="border-b border-[var(--border-default)] bg-white px-5 py-4 space-y-3">
            {/* Top Tier: Price List Selector + Badges (Left) & Primary CTAs (Right) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Selector + Version & Status */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-full sm:w-80">
                  <Select
                    value={selected?.id ?? ""}
                    onChange={(event) => changeSelectedList(event.target.value)}
                    className="h-9 text-xs font-bold text-slate-900 border-slate-300 bg-slate-50/70 hover:bg-slate-100/70 focus:bg-white"
                  >
                    {(lists.data ?? []).map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.code} · {list.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Badge value={`v${latestVersion.versionNumber}`} tone="brand" />
                <Badge value={statusLabel[latestVersion.status]} tone={statusTone(latestVersion.status)} dot />
              </div>

              {/* Right: Primary CTAs (Nuevo Listado & Publicar) */}
              <div className="flex items-center gap-2 shrink-0">
                {latestVersion.status !== "DRAFT" && can("price_list.edit_draft") ? (
                  <Button variant="secondary" size="sm" onClick={createNextVersion} className="h-8 text-xs font-medium">
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Editar próxima versión
                  </Button>
                ) : null}
                {latestVersion.status === "DRAFT" && can("price_list.publish") ? (
                  <Button size="sm" onClick={openPublication} className="h-8 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Previsualizar y publicar
                  </Button>
                ) : null}
                {can("price_list.create") ? (
                  <Button size="sm" onClick={() => setWizardOpen(true)} className="h-8 text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo listado
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Bottom Tier: Metadata Chips (Left) & Secondary Utilities (Right) */}
            <div className="flex flex-col gap-3 pt-1 border-t border-slate-100 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Metadata Micro-Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                  <Tag className="h-3 w-3 text-slate-400" />
                  {selected.code}
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  <Coins className="h-3 w-3 text-slate-400" />
                  {latestVersion.currency}
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  <Layers className="h-3 w-3 text-slate-400" />
                  {latestVersion._count.items} prestaciones configuradas
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  {latestVersion.scopes.length ? `${latestVersion.scopes.length} sucursales asignadas` : "Toda la organización"}
                </span>
              </div>

              {/* Right: Operational Tools (Historial, Plantillas, Importar, Nueva Prestación) */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {can("price_template.view") ? (
                  <Button variant="secondary" size="sm" onClick={() => setTemplatesOpen(true)} className="h-7 text-xs font-medium px-2.5">
                    <FileClock className="h-3.5 w-3.5 mr-1" /> Plantillas
                  </Button>
                ) : null}
                {can("price_list.import") && latestVersion?.status === "DRAFT" ? (
                  <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} className="h-7 text-xs font-medium px-2.5">
                    <Upload className="h-3.5 w-3.5 mr-1" /> Importar CSV
                  </Button>
                ) : null}
                {can("price_list.view") ? (
                  <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)} className="h-7 text-xs font-medium px-2.5">
                    <History className="h-3.5 w-3.5 mr-1" /> Historial
                  </Button>
                ) : null}
                {latestVersion.status === "DRAFT" && can("price_list.edit_draft") ? (
                  <Button variant="secondary" size="sm" onClick={() => openNewItem(selectedCategory?.id)} className="h-7 text-xs font-medium px-2.5">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nueva prestación
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {/* 2. Sub-Toolbar: Section Tabs, Search Filter & Inactive Toggle */}
          <div className="border-b border-[var(--border-default)] bg-slate-50/60 px-5 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left: Section Segmented Controls */}
              <div className="inline-flex rounded-lg bg-slate-200/80 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => changeSection("clinical")}
                  className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    section === "clinical"
                      ? "bg-white text-[var(--action-primary)] shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>De acciones clínicas</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeSection("lab")}
                  className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    section === "lab"
                      ? "bg-white text-[var(--action-primary)] shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  <span>De laboratorio</span>
                </button>
              </div>

              {/* Right: Search Filter & Inactive Checkbox */}
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center md:max-w-xl md:justify-end">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="h-9 pl-9 pr-8 text-xs bg-white"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por categoría, código o prestación..."
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 shrink-0">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(event) => changeIncludeInactive(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--action-primary)] focus:ring-[var(--focus-ring)]"
                  />
                  <span>Mostrar inactivos</span>
                </label>
              </div>
            </div>
          </div>

          {/* Body: Categories List or Category Procedure Items */}
          <div className="min-w-0">
            {!selectedCategory ? (
              <div>
                {/* Summary / Coverage Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{activeCategories.length}</span>
                    <span>categorías en esta sección</span>
                    <span className="text-slate-300">|</span>
                    <span className="font-medium text-slate-700">
                      {totalConfiguredProcedures} de {totalCatalogProcedures} prestaciones tarifadas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cobertura total:</span>
                    <span className={`font-bold ${overallCoverage === 100 ? "text-emerald-700" : overallCoverage > 0 ? "text-blue-700" : "text-slate-500"}`}>
                      {overallCoverage}%
                    </span>
                  </div>
                </div>

                {/* Categories Modern Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Categoría</th>
                        <th className="w-48 px-4 py-3">Tipo</th>
                        <th className="w-64 px-4 py-3">Cobertura de Precios</th>
                        <th className="w-36 px-4 py-3 text-center">Estado</th>
                        <th className="w-32 px-5 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCategories.map(({ category, configuredItems, catalogProcedures }) => {
                        const configuredCount = configuredItems.length;
                        const catalogCount = catalogProcedures.length;
                        const percent = catalogCount > 0 ? Math.round((configuredCount / catalogCount) * 100) : (configuredCount > 0 ? 100 : 0);
                        const isComplete = percent === 100 && catalogCount > 0;
                        const isPartial = percent > 0 && percent < 100;
                        const isEmpty = percent === 0;

                        return (
                          <tr
                            key={category.id}
                            onClick={() => openCategoryRoute(category.id)}
                            className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                          >
                            {/* Category Name & Info */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[var(--action-primary)] transition-transform group-hover:scale-105 group-hover:bg-blue-100">
                                  {category.type === "LAB" ? (
                                    <FlaskConical className="h-4 w-4" />
                                  ) : (
                                    <Stethoscope className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-900 transition-colors group-hover:text-[var(--action-primary)]">
                                    {category.name}
                                  </span>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {catalogCount} {catalogCount === 1 ? "prestación en catálogo" : "prestaciones en catálogo"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Procedure Type Badge */}
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                                  category.type === "LAB"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200/70"
                                    : "bg-blue-50 text-blue-700 border border-blue-200/70"
                                }`}
                              >
                                {category.type === "LAB" ? (
                                  <FlaskConical className="h-3 w-3" />
                                ) : (
                                  <Stethoscope className="h-3 w-3" />
                                )}
                                {typeLabel[category.type] ?? category.type}
                              </span>
                            </td>

                            {/* Progress & Coverage */}
                            <td className="px-4 py-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700 tabular-nums">
                                    {configuredCount} / {catalogCount}
                                  </span>
                                  <span
                                    className={`font-semibold tabular-nums ${
                                      isComplete ? "text-emerald-700" : isPartial ? "text-blue-700" : "text-slate-400"
                                    }`}
                                  >
                                    {percent}%
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isComplete
                                        ? "bg-emerald-500"
                                        : isPartial
                                        ? "bg-blue-500"
                                        : "bg-slate-300"
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Coverage Status Badge */}
                            <td className="px-4 py-4 text-center">
                              {catalogCount === 0 ? (
                                <Badge value="Sin catálogo" tone="default" />
                              ) : isComplete ? (
                                <Badge value="Completa" tone="success" dot />
                              ) : isPartial ? (
                                <Badge value="Parcial" tone="warning" dot />
                              ) : (
                                <Badge value="Sin tarifar" tone="danger" dot />
                              )}
                            </td>

                            {/* Action Button */}
                            <td className="px-5 py-4 text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCategoryRoute(category.id);
                                }}
                                className="h-8 px-3 text-xs font-medium text-slate-700 transition-all group-hover:border-[var(--action-primary)] group-hover:bg-[var(--action-primary)] group-hover:text-white"
                              >
                                <span>Entrar</span>
                                <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Empty State */}
                {!procedureCategories.isLoading && !activeCategories.length ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No se encontraron categorías</h4>
                    <p className="mt-1 text-xs text-slate-500 max-w-sm">
                      {search
                        ? `No hay categorías que coincidan con la búsqueda "${search}".`
                        : "No hay categorías registradas para esta sección en el catálogo."}
                    </p>
                    {search ? (
                      <Button variant="secondary" size="sm" onClick={() => setSearch("")} className="mt-4 text-xs">
                        Limpiar búsqueda
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              /* Selected Category Detail: Procedure Items Table */
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-slate-50/70 px-5 py-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => openCategoriesRoute()}
                      className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--action-primary)] hover:underline"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Volver a categorías
                    </button>
                    <h4 className="text-sm font-bold text-slate-900">
                      {selected.name} <span className="text-slate-400">/</span> {selectedCategory.name}
                    </h4>
                  </div>
                  {latestVersion.status === "DRAFT" && can("price_list.edit_draft") ? (
                    <Button size="sm" onClick={() => openNewItem(selectedCategory.id)} className="h-8 text-xs font-semibold">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo producto
                    </Button>
                  ) : null}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="w-[110px] px-4 py-3">ID</th>
                        <th className="w-[120px] px-4 py-3">Código</th>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Permite descuento</th>
                        <th className="w-[130px] px-4 py-3 text-center">Máx. dscto.</th>
                        <th className="px-4 py-3 text-right">Precio final</th>
                        <th className="px-4 py-3 text-right">Costo laboratorio</th>
                        <th className="px-4 py-3 text-right">Opciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedCategoryItems.map((item) => {
                        if (itemOpen && editingItem?.id === item.id) {
                          return (
                            <tr key={item.id} className="border-t border-[var(--border-default)] bg-amber-50/40">
                              <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                {procedureDisplayId(item.procedure.displayId)}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--action-primary)]">
                                {item.procedure.code}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-800">{item.procedure.name}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={itemForm.allowDiscount}
                                    onChange={(e) => setItemForm({ ...itemForm, allowDiscount: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-[var(--action-primary)]"
                                  />
                                  <span className="text-xs font-medium">{itemForm.allowDiscount ? "Sí" : "No"}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {itemForm.allowDiscount ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Input
                                      type="number"
                                      min={0.01}
                                      max={100}
                                      step={0.01}
                                      value={itemForm.maxDiscountPercent}
                                      onChange={(e) => setItemForm({ ...itemForm, maxDiscountPercent: e.target.value })}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="h-8 w-20 px-1.5 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                      aria-label="Máximo de descuento permitido"
                                    />
                                    <span className="text-xs font-semibold text-slate-500">%</span>
                                  </div>
                                ) : (
                                  <span className="block text-center text-xs text-slate-400">No permitido</span>
                                )}
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
                          <tr key={item.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{procedureDisplayId(item.procedure.displayId)}</td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--action-primary)]">{item.procedure.code}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {item.procedure.name}
                              {item.procedure.requiresLab && Number(item.laboratoryCost) === 0 ? (
                                <p className="mt-0.5 text-xs font-normal text-amber-700">Requiere laboratorio sin costo configurado</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={item.allowDiscount} readOnly className="h-4 w-4 rounded border-slate-300 text-emerald-600 pointer-events-none" />
                                {item.allowDiscount ? (
                                  <span className="text-xs font-semibold text-emerald-700">Permite descuento</span>
                                ) : (
                                  <span className="text-xs font-medium text-slate-400">Sin descuento</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              {item.allowDiscount ? (
                                <span className="font-semibold text-slate-900">{Number(item.maxDiscountPercent).toFixed(2)} %</span>
                              ) : (
                                <span className="text-xs text-slate-400">No permitido</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{money(item.basePrice, latestVersion.currency)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col text-right">
                                <span className="font-medium text-slate-800">{money(item.laboratoryCost, latestVersion.currency)}</span>
                                {Number(item.internalCost) > 0 && (
                                  <span className="text-[10px] text-slate-500">Cost. int: {money(item.internalCost, latestVersion.currency)}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {latestVersion.status === "DRAFT" && can("price_list.edit_draft") ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditItem(item)}
                                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-[var(--action-primary)] hover:bg-blue-50/50 hover:text-[var(--action-primary)]"
                                    title="Editar valores de la prestación"
                                    aria-label="Editar"
                                  >
                                    <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deactivateItem(item)}
                                    disabled={mutations.deactivateItem.isPending}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-2xs transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                    title="Desactivar prestación de este borrador"
                                    aria-label="Desactivar"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {itemOpen && !editingItem ? (
                        <tr className="border-t border-[var(--border-default)] bg-emerald-50/30">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">-</td>
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

                                  const found = procedureOptions.find(
                                    (p) =>
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
                                className="h-8 text-xs"
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
                                className="h-4 w-4 rounded border-slate-300 text-[var(--action-primary)]"
                              />
                              <span className="text-xs font-medium">{itemForm.allowDiscount ? "Sí" : "No"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {itemForm.allowDiscount ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  min={0.01}
                                  max={100}
                                  step={0.01}
                                  value={itemForm.maxDiscountPercent}
                                  onChange={(e) => setItemForm({ ...itemForm, maxDiscountPercent: e.target.value })}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="h-8 w-20 px-1.5 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  aria-label="Máximo de descuento permitido"
                                />
                                <span className="text-xs font-semibold text-slate-500">%</span>
                              </div>
                            ) : (
                              <span className="block text-center text-xs text-slate-400">No permitido</span>
                            )}
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

                      {!items.isLoading && !selectedCategoryItems.length && (!itemOpen || editingItem) ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                            Categoría sin prestaciones configuradas en esta versión.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center text-slate-500">No existen listados versionados configurados.</Card>
      )}

      {/* Wizard Modal */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title={`Nuevo listado · Paso ${wizardStep} de 6`} size="lg">
        <div className="mb-5 grid grid-cols-6 gap-1">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className={`h-1.5 rounded-full ${step <= wizardStep ? "bg-[var(--action-primary)]" : "bg-slate-200"}`} />
          ))}
        </div>
        {wizardStep === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Código
              <Input value={wizard.code} onChange={(e) => setWizard({ ...wizard, code: e.target.value })} />
            </label>
            <label className="text-sm">
              Nombre
              <Input value={wizard.name} onChange={(e) => setWizard({ ...wizard, name: e.target.value })} />
            </label>
            <label className="text-sm sm:col-span-2">
              Descripción
              <Textarea value={wizard.description} onChange={(e) => setWizard({ ...wizard, description: e.target.value })} />
            </label>
            <label className="text-sm">
              Moneda
              <Select value={wizard.currency} onChange={(e) => setWizard({ ...wizard, currency: e.target.value as Currency })}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </label>
          </div>
        ) : null}
        {wizardStep === 2 ? (
          <div>
            <p className="mb-3 text-sm text-slate-500">Sin selección se aplicará a toda la organización. Selecciona sucursales para limitar alcance.</p>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {availability.data?.branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={wizard.branchIds.includes(branch.id)}
                    onChange={(e) =>
                      setWizard({
                        ...wizard,
                        branchIds: e.target.checked ? [...wizard.branchIds, branch.id] : wizard.branchIds.filter((id) => id !== branch.id)
                      })
                    }
                  />{" "}
                  {branch.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {wizardStep === 3 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Inicio vigencia
              <Input type="datetime-local" value={wizard.validFrom} onChange={(e) => setWizard({ ...wizard, validFrom: e.target.value })} />
            </label>
            <label className="text-sm">
              Fin vigencia
              <Input type="datetime-local" value={wizard.validTo} onChange={(e) => setWizard({ ...wizard, validTo: e.target.value })} />
            </label>
          </div>
        ) : null}
        {wizardStep === 4 ? (
          <div>
            <p className="mb-3 text-sm text-slate-500">La copia reutiliza definiciones clínicas; no duplica prestaciones.</p>
            <label className="text-sm">
              Lista base opcional
              <Select value={wizard.basePriceListId} onChange={(event) => setWizard({ ...wizard, basePriceListId: event.target.value })}>
                <option value="">Crear vacía</option>
                {(lists.data ?? []).map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.code} · {list.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : null}
        {wizardStep === 5 ? (
          <div className="space-y-3 text-sm">
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={wizard.copyPrices}
                disabled={!wizard.basePriceListId}
                onChange={(event) => setWizard({ ...wizard, copyPrices: event.target.checked })}
              />{" "}
              Copiar prestaciones y precios
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={wizard.copyDiscounts}
                disabled={!wizard.basePriceListId}
                onChange={(event) => setWizard({ ...wizard, copyDiscounts: event.target.checked })}
              />{" "}
              Copiar reglas de descuento
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={wizard.copyCosts}
                disabled={!wizard.basePriceListId}
                onChange={(event) => setWizard({ ...wizard, copyCosts: event.target.checked })}
              />{" "}
              Copiar costos internos y laboratorio
            </label>
            <p className="text-xs text-slate-500">La operación usa idempotency-key y conserva source_item_id.</p>
          </div>
        ) : null}
        {wizardStep === 6 ? (
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">Previsualización</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <dt className="text-slate-500">Listado</dt>
              <dd className="font-semibold text-slate-900">
                {wizard.code} · {wizard.name}
              </dd>
              <dt className="text-slate-500">Moneda</dt>
              <dd className="font-semibold text-slate-900">{wizard.currency}</dd>
              <dt className="text-slate-500">Alcance</dt>
              <dd className="font-semibold text-slate-900">
                {wizard.branchIds.length ? `${wizard.branchIds.length} sucursales` : "Organización"}
              </dd>
              <dt className="text-slate-500">Estado inicial</dt>
              <dd className="font-semibold text-slate-900">Borrador</dd>
            </dl>
          </div>
        ) : null}
        <div className="mt-6 flex justify-between">
          <Button variant="secondary" disabled={wizardStep === 1} onClick={() => setWizardStep((step) => step - 1)}>
            Anterior
          </Button>
          {wizardStep < 6 ? (
            <Button disabled={wizardStep === 1 && (!wizard.code.trim() || !wizard.name.trim())} onClick={() => setWizardStep((step) => step + 1)}>
              Continuar
            </Button>
          ) : (
            <Button onClick={submitWizard} disabled={mutations.createList.isPending}>
              Guardar borrador
            </Button>
          )}
        </div>
      </Modal>

      {/* Templates Modal */}
      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Plantillas de prestaciones" size="lg">
        <div className="space-y-4">
          {templates.isLoading ? (
            <LoadingState />
          ) : (
            (templates.data ?? []).map((template) => (
              <div key={template.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    v{template.version} · {template.sections.reduce((total, sec) => total + sec.items.length, 0)} prestaciones
                  </p>
                </div>
                <Badge value={template.status} tone={template.status === "ACTIVE" ? "success" : "warning"} />
              </div>
            ))
          )}
          {!templates.isLoading && !templates.data?.length ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay plantillas configuradas.</p>
          ) : null}
          {can("price_template.manage") && items.data?.length ? (
            <div className="border-t border-slate-200 pt-4">
              <label className="text-sm">
                Crear desde versión seleccionada
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nombre de plantilla" />
              </label>
              <div className="mt-3 flex justify-end">
                <Button onClick={saveTemplate} disabled={!templateName.trim()}>
                  Guardar plantilla borrador
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar listado de precios" size="lg">
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center">
            <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--action-primary)]" />
            <Input type="file" accept=".csv,text/csv" onChange={(event) => readImportFile(event.target.files?.[0])} />
            <p className="mt-2 text-xs text-slate-500">CSV con code, name, price, currency, laboratoryCost, internalCost y discount.</p>
          </div>
          {importRows.length ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {importFileName}: {importRows.length} filas normalizadas. Aún no se ha modificado el arancel.
            </div>
          ) : null}
          {importPreview ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge value={importPreview.status} tone={importPreview.status === "READY" || importPreview.status === "APPLIED" ? "success" : "danger"} />
                <span className="text-sm font-medium text-slate-700">{importPreview.summary?.errors ?? 0} errores</span>
              </div>
              {importPreview.errors?.map((error) => (
                <p key={error.id} className="text-sm text-red-700">
                  {error.code}: {error.message}
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={validateImport} disabled={!importRows.length}>
              Validar y previsualizar
            </Button>
            <Button onClick={applyImport} disabled={importPreview?.status !== "READY"}>
              Confirmar importación
            </Button>
          </div>
        </div>
      </Modal>

      {/* History & Audit Modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historial de versiones y eventos" size="2xl">
        {history.isLoading ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState message={history.error.message} />
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Versiones registradas</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Versión</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Publicación</th>
                      <th className="px-3 py-2">Autor</th>
                      <th className="px-3 py-2 text-right">Prestaciones</th>
                      <th className="px-3 py-2 text-right">Tratamientos</th>
                      <th className="px-3 py-2">Resumen de cambios</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(history.data?.versions ?? []).map((version) => (
                      <tr key={version.id} className="align-top hover:bg-slate-50">
                        <td className="px-3 py-3 font-semibold text-slate-900">v{version.versionNumber}</td>
                        <td className="px-3 py-3">
                          <Badge value={statusLabel[version.status]} tone={statusTone(version.status)} />
                        </td>
                        <td className="px-3 py-3 text-slate-600">{historyDate(version.publishedAt ?? version.createdAt)}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {version.publishedBy ? `${version.publishedBy.firstName} ${version.publishedBy.lastName}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-800">{version._count.items}</td>
                        <td className="px-3 py-3 text-right font-medium text-slate-800">{version._count.treatmentItems}</td>
                        <td className="max-w-[280px] px-3 py-3">
                          <p className="font-medium text-slate-800">{version.changeSummary || "Versión registrada sin notas"}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Eventos auditados</h3>
              <div className="space-y-2">
                {(history.data?.events ?? []).map((event) => (
                  <article key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{auditActionLabel[event.action] ?? event.action}</p>
                        <p className="text-xs text-slate-500">
                          {event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "Sistema"} · {historyDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                    {event.reason ? <p className="mt-2 text-slate-700">Motivo: {event.reason}</p> : null}
                    {event.oldValue !== undefined || event.newValue !== undefined ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-[var(--action-primary)] hover:underline">
                          Ver valores (anterior vs nuevo)
                        </summary>
                        <AuditDiffViewer oldValue={event.oldValue} newValue={event.newValue} />
                      </details>
                    ) : null}
                  </article>
                ))}
                {!history.data?.events.length ? <p className="py-6 text-center text-sm text-slate-500">No hay eventos para este listado.</p> : null}
              </div>
            </section>
          </div>
        )}
      </Modal>

      {/* Publish Modal */}
      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Previsualizar publicación" size="lg">
        {!validation ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            <Alert variant="warning" size="sm">
              Esta publicación no modificará tratamientos existentes.
            </Alert>
            <Alert
              variant={validation.valid ? "success" : "danger"}
              size="sm"
              title={validation.valid ? "Validación aprobada" : "Publicación bloqueada"}
            >
              {validation.valid
                ? "La lista de precios es consistente y puede publicarse de forma inmutable."
                : "Corrige los errores indicados a continuación para poder publicar."}
            </Alert>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <dt className="text-slate-500">Versión que será reemplazada</dt>
              <dd className="font-semibold text-slate-900">
                {history.data?.activeVersion ? `v${history.data.activeVersion.versionNumber}` : "Ninguna"}
              </dd>
              <dt className="text-slate-500">Tratamientos que conservan precio histórico</dt>
              <dd className="font-semibold text-slate-900">{history.data?.activeVersion?._count.treatmentItems ?? 0}</dd>
              <dt className="text-slate-500">Prestaciones nuevas en catálogo</dt>
              <dd className="font-semibold text-slate-900">{history.data?.publicationPreview.newItemsCount ?? 0}</dd>
            </dl>
            {validation.errors.map((issue) => (
              <p key={issue.code} className="text-sm font-medium text-red-700">
                {issue.code}: {issue.message}
              </p>
            ))}
            {validation.warnings.map((issue) => (
              <p key={issue.code} className="text-sm font-medium text-amber-700">
                {issue.code}: {issue.message}
              </p>
            ))}
            <label className="block text-sm">
              Resumen de cambios
              <Textarea value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPublishOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!validation.valid || !changeSummary.trim() || mutations.publish.isPending} onClick={publish}>
                Publicar versión inmutable
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AuditDiffViewer({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const oldObj = normalizeAuditRecord(oldValue);
  const newObj = normalizeAuditRecord(newValue);

  const formatSimpleValue = (key: string, val: unknown) => {
    if (val === null || val === undefined || val === "") return <span className="text-slate-400 font-normal italic">Sin registro</span>;
    if (typeof val === "boolean") return <Badge value={val ? "Sí" : "No"} tone={val ? "success" : "default"} />;
    if (key === "status" && typeof val === "string") {
      const label = statusLabel[val as PriceListStatus] ?? val;
      return <Badge value={label} tone={statusTone(val as PriceListStatus)} />;
    }
    if (key === "currency" && typeof val === "string") {
      return <span className="font-semibold text-slate-800">{val}</span>;
    }
    if ((key === "basePrice" || key === "laboratoryCost" || key === "internalCost") && (typeof val === "number" || typeof val === "string")) {
      return <span className="font-semibold text-slate-800">${Number(val).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>;
    }
    if (key === "maxDiscountPercent" && (typeof val === "number" || typeof val === "string")) {
      return <span className="font-semibold text-slate-800">{val}%</span>;
    }
    if (Array.isArray(val)) {
      return <span className="text-slate-700 font-medium">{val.length} elementos</span>;
    }
    if (typeof val === "object") {
      return <span className="text-slate-500 italic">Configuración avanzada</span>;
    }
    return <span className="font-semibold text-slate-800">{String(val)}</span>;
  };

  const oldEntries = cleanAuditEntries(oldObj);
  const newEntries = cleanAuditEntries(newObj);

  const oldItems = auditItems(oldObj);
  const newItems = auditItems(newObj);

  const hasItems = oldItems.length > 0 || newItems.length > 0;

  const itemDiffs = useMemo(() => {
    if (!hasItems) return [];
    return buildPriceItemDiffs(oldItems, newItems);
  }, [oldItems, newItems, hasItems]);

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Versión</span>
          <div className="mt-1 flex items-center gap-2">
            {oldObj.versionNumber ? <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">v{String(oldObj.versionNumber)}</span> : null}
            {oldObj.versionNumber && newObj.versionNumber ? <span className="text-slate-400 font-bold">➔</span> : null}
            {newObj.versionNumber ? <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">v{String(newObj.versionNumber)}</span> : <span className="text-xs text-slate-400">Sin versión</span>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado</span>
          <div className="mt-1 flex items-center gap-2">
            {oldObj.status ? <Badge value={statusLabel[oldObj.status as PriceListStatus] ?? oldObj.status} tone="default" /> : null}
            {oldObj.status && newObj.status ? <span className="text-slate-400 font-bold">➔</span> : null}
            {newObj.status ? <Badge value={statusLabel[newObj.status as PriceListStatus] ?? newObj.status} tone={statusTone(newObj.status as PriceListStatus)} /> : <span className="text-xs text-slate-400">-</span>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Catálogo de Prestaciones</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">{String(oldItems.length || oldObj.itemCount || 0)} ítems</span>
            <span className="text-slate-400 font-bold">➔</span>
            <span className="text-xs font-bold text-emerald-700">{String(newItems.length || newObj.itemCount || 0)} ítems</span>
          </div>
        </div>
      </div>

      {(oldEntries.length > 0 || newEntries.length > 0) && (
        <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
          <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-700 border-b border-slate-200">
            Atributos modificados
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from(new Set([...oldEntries.map((e) => e[0]), ...newEntries.map((e) => e[0])])).map((key) => {
              const label = fieldLabels[key] || key.replace(/([A-Z])/g, " $1");
              const valOld = oldObj[key];
              const valNew = newObj[key];
              return (
                <div key={key} className="grid grid-cols-3 gap-2 px-3 py-2 hover:bg-slate-50/50">
                  <span className="font-medium text-slate-500 capitalize">{label}</span>
                  <div className="text-slate-600">{formatSimpleValue(key, valOld)}</div>
                  <div className="text-slate-900 font-semibold">{formatSimpleValue(key, valNew)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasItems && (
        <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-2 font-semibold text-slate-700 border-b border-slate-200">
            <span>Prestaciones afectadas ({itemDiffs.length})</span>
            <span className="text-[11px] font-normal text-slate-500">Mostrando cambios de precios y catálogo</span>
          </div>
          {itemDiffs.length > 0 ? (
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {itemDiffs.map((diff, idx) => (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    {diff.code ? <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">{diff.code}</span> : null}
                    <span className="font-medium text-slate-800">{diff.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {diff.type === "ADDED" && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-bold text-emerald-700 text-[11px]">
                        + Nuevo (${diff.newPrice ?? 0})
                      </span>
                    )}
                    {diff.type === "REMOVED" && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2 py-0.5 font-bold text-red-700 text-[11px]">
                        - Removido (${diff.oldPrice ?? 0})
                      </span>
                    )}
                    {diff.type === "MODIFIED" && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 line-through">${diff.oldPrice}</span>
                        <span className="font-bold text-emerald-700">${diff.newPrice}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-slate-400 italic">
              Todas las prestaciones mantuvieron el mismo precio y estado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
