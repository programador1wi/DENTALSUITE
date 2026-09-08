import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Plus,
  Receipt,
  Search,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  budgetCatalogCategoryMatchesSearch,
  budgetCatalogItemMatchesSearch,
  buildTreatmentBudgetCatalog,
  flatSearchBudgetCatalog
} from "@/features/patients/utils/treatment-budget-catalog";
import type {
  TreatmentPlanDetail,
  TreatmentPriceCatalog,
  TreatmentPriceCatalogItem
} from "@/features/treatments/services/treatments.service";
import { fdiLabel, money, numberValue, surfaceLabel } from "./treatment-modal-helpers";

export function BudgetProcedureDrawer({
  open,
  plan,
  agreementName,
  priceList,
  selectedTooth,
  selectedSurface,
  addedItemsCount,
  addingItem,
  creatingBudget,
  onClose,
  onAddItem,
  onCreateBudget
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  agreementName?: string | null;
  priceList: TreatmentPriceCatalog | null;
  selectedTooth: string;
  selectedSurface: string;
  addedItemsCount: number;
  addingItem: boolean;
  creatingBudget: boolean;
  onClose: () => void;
  onAddItem: (item: TreatmentPriceCatalogItem) => Promise<void>;
  onCreateBudget: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const catalog = useMemo(() => buildTreatmentBudgetCatalog(priceList), [priceList]);
  const selectedCategory = catalog.find((category) => category.id === categoryId) ?? null;
  const filteredCategories = catalog.filter((category) =>
    budgetCatalogCategoryMatchesSearch(category, search)
  );
  const filteredItems =
    selectedCategory?.items.filter((item) => budgetCatalogItemMatchesSearch(item, search)) ?? [];
  const flatResults = useMemo(
    () => (categoryId === "" && search.trim() ? flatSearchBudgetCatalog(catalog, search) : []),
    [catalog, search, categoryId]
  );
  const isInFlatSearchMode = categoryId === "" && search.trim() !== "" && flatResults.length > 0;
  const planItemCount = Math.max(plan?.items.length ?? 0, addedItemsCount);
  const canCreateBudget = Boolean(planItemCount);
  const selectedPieceLabel = selectedTooth
    ? `Pieza ${fdiLabel(selectedTooth)} - ${
        selectedSurface ? `Cara ${surfaceLabel(selectedSurface).toLowerCase()}` : "Pieza completa"
      }`
    : "Sin piezas seleccionadas";
  const drawerTitle = selectedCategory ? `Productos de ${selectedCategory.name}` : "Definir procedimiento";

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setCategoryId("");
  }, [open, priceList?.id]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <button
        type="button"
        aria-label="Cerrar definicion de procedimiento"
        className="absolute inset-0 bg-[#042C53]/35 backdrop-blur-[4px] transition-opacity duration-200"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-procedure-drawer-title"
        className="relative z-10 flex h-full w-full max-w-[440px] flex-col bg-white border-r border-slate-200 shadow-2xl transition-all duration-200"
      >
        <header className="flex min-h-[78px] shrink-0 items-center justify-between bg-white border-b border-slate-100 px-5 py-4 text-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            {selectedCategory ? (
              <button
                type="button"
                aria-label="Volver a categorias"
                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100"
                onClick={() => setCategoryId("")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <Receipt className="h-5 w-5 shrink-0 text-[#185FA5]" />
            )}
            <div className="min-w-0">
              <h2 id="budget-procedure-drawer-title" className="truncate text-base font-bold text-[#0C447C]">
                {drawerTitle}
              </h2>
              <div className="mt-1 flex items-center gap-2 flex-wrap min-w-0">
                {agreementName ? (
                  <span className="bg-[#E6F1FB] text-[#0C447C] px-2 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-[150px]">
                    {agreementName}
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    Sin convenio
                  </span>
                )}
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                  {priceList?.name ?? "Sin arancel"}
                  {priceList?.activeVersion ? ` · v${priceList.activeVersion.number}` : ""}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="relative shrink-0 border-b border-slate-100 px-4 py-3 bg-slate-50/50">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm bg-white shadow-none focus-visible:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]/20"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={selectedCategory ? "Buscar prestaciones..." : "Buscar por código, nombre o categoría..."}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/30">
          {selectedCategory ? (
            <div className="p-4">
              {filteredItems.length ? (
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-4 bg-white border border-slate-200/80 rounded-lg shadow-sm transition hover:border-slate-300"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
                            {item.procedure.code}
                          </span>
                          {item.procedure.requiresTooth ? (
                            <Badge value="Requiere pieza" tone={selectedTooth ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresSurface ? (
                            <Badge value="Requiere superficie" tone={selectedSurface ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresLab ? <Badge value="Laboratorio" tone="default" /> : null}
                        </div>
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.procedure.name}
                          </p>
                          {item.procedure.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {item.procedure.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between gap-3">
                        <div className="whitespace-nowrap text-right text-base font-bold text-[#0C447C]">
                          {money(numberValue(item.price))}
                          <span className="mt-1 block text-[10px] font-medium text-slate-500">
                            v{item.version.number} · {item.currency}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-[#185FA5] text-[#185FA5] hover:bg-[#E6F1FB] px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60"
                          disabled={addingItem}
                          onClick={() => void onAddItem(item)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Cargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-16 text-center text-sm text-slate-500 bg-white border border-slate-200/80 rounded-lg shadow-sm">
                  {selectedCategory.items.length
                    ? "No hay productos con ese filtro en esta categoría."
                    : "Esta categoría del arancel no tiene productos configurados."}
                </div>
              )}
            </div>
          ) : catalog.length ? (
            <div className="p-4 space-y-3">
              {isInFlatSearchMode ? (
                <div className="space-y-3">
                  {flatResults.map(({ item, categoryId, categoryName }) => (
                    <div
                      key={`${categoryId}-${item.id}`}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-4 bg-white border border-slate-200/80 rounded-lg shadow-sm transition hover:border-slate-300"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
                            {item.procedure.code}
                          </span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-[150px]">
                            {categoryName}
                          </span>
                          {item.procedure.requiresTooth ? (
                            <Badge value="Requiere pieza" tone={selectedTooth ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresSurface ? (
                            <Badge value="Requiere superficie" tone={selectedSurface ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresLab ? <Badge value="Laboratorio" tone="default" /> : null}
                        </div>
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.procedure.name}
                          </p>
                          {item.procedure.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {item.procedure.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between gap-3">
                        <div className="whitespace-nowrap text-right text-base font-bold text-[#0C447C]">
                          {money(numberValue(item.price))}
                          <span className="mt-1 block text-[10px] font-medium text-slate-500">
                            v{item.version.number} · {item.currency}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-[#185FA5] text-[#185FA5] hover:bg-[#E6F1FB] px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60"
                          disabled={addingItem}
                          onClick={() => void onAddItem(item)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Cargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {filteredCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 text-left bg-white border border-slate-200/80 rounded-lg shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200"
                      onClick={() => setCategoryId(category.id)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{category.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {category.items.length
                            ? `${category.items.length} productos`
                            : "Sin productos configurados"}
                          {category.description ? ` · ${category.description}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                  {!filteredCategories.length ? (
                    <div className="px-6 py-16 text-center text-sm text-slate-500 bg-white border border-slate-200/80 rounded-lg shadow-sm">
                      {search.trim() ? "No se encontraron prestaciones con ese código o nombre." : "No hay categorías con ese filtro."}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="bg-white border border-slate-200/80 rounded-lg p-8 shadow-sm max-w-sm">
                <FolderOpen className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Sin categorías en el convenio</p>
                <p className="mt-1 text-xs text-slate-500">
                  Configura categorías en el catálogo asociado al convenio para navegar productos desde aquí.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                Piezas seleccionadas
              </p>
              <p className="truncate text-sm font-semibold text-slate-700">{selectedPieceLabel}</p>
              <p className="mt-0.5 text-xs text-slate-500">Prestaciones en el plan: {planItemCount}</p>
            </div>
            <Button
              className="bg-[#10B981] hover:bg-[#059669] text-white shadow-sm font-semibold text-sm border-0"
              disabled={!canCreateBudget || creatingBudget}
              onClick={() => void onCreateBudget()}
            >
              <Receipt className="mr-1.5 h-4 w-4" />
              Crear presupuesto
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
