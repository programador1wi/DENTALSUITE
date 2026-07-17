export const UNCATEGORIZED_BUDGET_CATEGORY_ID = "__uncategorized__";

export type TreatmentBudgetCatalogItem = {
  id: string;
  priceListCategoryId?: string | null;
  price: string | number | null;
  procedure: {
    code: string;
    name: string;
    displayId?: string | number | null;
    description?: string | null;
    isActive: boolean;
  };
};

export type TreatmentBudgetCatalogSource<T extends TreatmentBudgetCatalogItem> = {
  categories?: Array<{
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    sortOrder: number;
    items?: T[];
  }>;
  items?: T[];
};

export type TreatmentBudgetCatalogCategory<T extends TreatmentBudgetCatalogItem = TreatmentBudgetCatalogItem> = {
  id: string;
  name: string;
  description?: string | null;
  items: T[];
  isUncategorized?: boolean;
};

function isPricedProcedureItem(item: TreatmentBudgetCatalogItem) {
  return Boolean(item.procedure?.isActive && item.price !== null && item.price !== undefined);
}

function uniqueItems<T extends TreatmentBudgetCatalogItem>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function buildTreatmentBudgetCatalog<T extends TreatmentBudgetCatalogItem>(
  priceList: TreatmentBudgetCatalogSource<T> | null
): TreatmentBudgetCatalogCategory<T>[] {
  if (!priceList) return [];

  const categories = (priceList.categories ?? []).filter((category) => category.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeItems = (priceList.items ?? []).filter(isPricedProcedureItem);
  const itemsByCategoryId = new Map<string, T[]>();
  const usedItemIds = new Set<string>();

  activeItems.forEach((item) => {
    if (!item.priceListCategoryId) return;
    const rows = itemsByCategoryId.get(item.priceListCategoryId) ?? [];
    rows.push(item);
    itemsByCategoryId.set(item.priceListCategoryId, rows);
  });

  const catalog: TreatmentBudgetCatalogCategory<T>[] = categories.map((category) => {
    const directItems = itemsByCategoryId.get(category.id) ?? [];
    const nestedItems = (category.items ?? []).filter(isPricedProcedureItem);
    const items = uniqueItems([...directItems, ...nestedItems]);
    items.forEach((item) => usedItemIds.add(item.id));
    return { id: category.id, name: category.name, description: category.description, items };
  });

  const uncategorizedItems = activeItems.filter((item) => !usedItemIds.has(item.id));
  if (uncategorizedItems.length) {
    catalog.push({
      id: UNCATEGORIZED_BUDGET_CATEGORY_ID,
      name: "Sin categoria",
      items: uncategorizedItems,
      isUncategorized: true
    });
  }

  return catalog;
}

export function budgetCatalogCategoryMatchesSearch(
  category: TreatmentBudgetCatalogCategory,
  search: string
) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return (
    category.name.toLowerCase().includes(term) ||
    category.items.some((item) => budgetCatalogItemMatchesSearch(item, term))
  );
}

export function budgetCatalogItemMatchesSearch(item: TreatmentBudgetCatalogItem, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const procedure = item.procedure;
  return [procedure.code, procedure.name, String(procedure.displayId), procedure.description ?? ""].some((value) =>
    value.toLowerCase().includes(term)
  );
}
