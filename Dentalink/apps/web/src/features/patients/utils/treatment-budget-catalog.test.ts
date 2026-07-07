import { describe, expect, it } from "vitest";
import type { PriceList, PriceListItem } from "@/features/settings/price-lists/services/price-lists.service";
import {
  budgetCatalogCategoryMatchesSearch,
  budgetCatalogItemMatchesSearch,
  buildTreatmentBudgetCatalog,
  UNCATEGORIZED_BUDGET_CATEGORY_ID
} from "./treatment-budget-catalog";

describe("treatment budget catalog", () => {
  it("builds active price-list categories and keeps empty categories visible", () => {
    const priceList = priceListFixture({
      categories: [
        categoryFixture({
          id: "cat-surgery",
          name: "Cirugia",
          sortOrder: 2,
          items: [itemFixture({ id: "item-duplicate", procedureId: "proc-duplicate", categoryId: "cat-surgery", name: "Duplicado" })]
        }),
        categoryFixture({ id: "cat-operative", name: "Operatoria", sortOrder: 1 }),
        categoryFixture({ id: "cat-empty", name: "Ortodoncia", sortOrder: 3 })
      ],
      items: [
        itemFixture({ id: "item-operative", procedureId: "proc-operative", categoryId: "cat-operative", name: "Resina" }),
        itemFixture({ id: "item-duplicate", procedureId: "proc-duplicate", categoryId: "cat-surgery", name: "Duplicado" }),
        itemFixture({ id: "item-inactive", procedureId: "proc-inactive", categoryId: "cat-surgery", name: "Inactiva", isActive: false })
      ]
    });

    const catalog = buildTreatmentBudgetCatalog(priceList);

    expect(catalog.map((category) => category.name)).toEqual(["Operatoria", "Cirugia", "Ortodoncia"]);
    expect(catalog[0].items.map((item) => item.id)).toEqual(["item-operative"]);
    expect(catalog[1].items.map((item) => item.id)).toEqual(["item-duplicate"]);
    expect(catalog[2].items).toEqual([]);
  });

  it("places active priced items without an active category into Sin categoria", () => {
    const priceList = priceListFixture({
      categories: [categoryFixture({ id: "cat-inactive", name: "Inactiva", isActive: false })],
      items: [
        itemFixture({ id: "item-orphan", procedureId: "proc-orphan", categoryId: null, name: "General" }),
        itemFixture({ id: "item-inactive-category", procedureId: "proc-inactive-category", categoryId: "cat-inactive", name: "Categoria inactiva" })
      ]
    });

    const catalog = buildTreatmentBudgetCatalog(priceList);

    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe(UNCATEGORIZED_BUDGET_CATEGORY_ID);
    expect(catalog[0].items.map((item) => item.id)).toEqual(["item-orphan", "item-inactive-category"]);
  });

  it("searches categories and items by procedure code or name", () => {
    const item = itemFixture({ code: "END-01", name: "Endodoncia molar" });
    const category = { id: "cat", name: "Especialidades", items: [item] };

    expect(budgetCatalogCategoryMatchesSearch(category, "endo")).toBe(true);
    expect(budgetCatalogItemMatchesSearch(item, "END-01")).toBe(true);
    expect(budgetCatalogItemMatchesSearch(item, "resina")).toBe(false);
  });
});

function priceListFixture(overrides: Partial<PriceList>): PriceList {
  return {
    id: "price-list-1",
    name: "Arancel activo",
    isDefault: true,
    isActive: true,
    branchAssignments: [],
    categories: [],
    items: [],
    ...overrides
  };
}

function categoryFixture(overrides: Partial<PriceList["categories"][number]>): PriceList["categories"][number] {
  return {
    id: "cat-1",
    priceListId: "price-list-1",
    name: "Categoria",
    sortOrder: 0,
    isActive: true,
    items: [],
    ...overrides
  };
}

function itemFixture({
  id = "item-1",
  procedureId = "procedure-1",
  categoryId = "cat-1",
  code = "PROC-1",
  name = "Prestacion",
  price = "100",
  isActive = true,
  requiresTooth = false,
  requiresSurface = false
}: {
  id?: string;
  procedureId?: string;
  categoryId?: string | null;
  code?: string;
  name?: string;
  price?: string;
  isActive?: boolean;
  requiresTooth?: boolean;
  requiresSurface?: boolean;
}): PriceListItem {
  return {
    id,
    procedureId,
    priceListCategoryId: categoryId,
    price,
    labCost: "0",
    allowsDiscount: true,
    currency: "MXN",
    procedure: {
      id: procedureId,
      categoryId: "procedure-category-1",
      displayId: 1,
      code,
      name,
      type: "CLINICAL",
      defaultDuration: 30,
      requiresTooth,
      requiresSurface,
      requiresLab: false,
      requiresOdontogramSymbol: false,
      isActive
    }
  };
}
