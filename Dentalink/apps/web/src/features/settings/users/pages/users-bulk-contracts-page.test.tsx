import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersBulkContractsPage } from "./users-bulk-contracts-page";

const previewMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  data: undefined,
  isPending: false,
  isError: false,
  error: null
}));

const applyMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false
}));

const branches = [
  {
    id: "branch-norte",
    code: "NORTE-1",
    name: "Sucursal Norte",
    status: "ACTIVE",
    zone: { id: "zone-norte", code: "NORTE", name: "Norte" }
  },
  {
    id: "branch-dj",
    code: "DJ-1",
    name: "Dental J.Warner Central",
    status: "ACTIVE",
    zone: { id: "zone-dj", code: "DJWARNER", name: "DJWarner" }
  }
];

const professionals = [
  {
    id: "pro-dj",
    firstName: "Dora",
    lastName: "Warner",
    commissionRate: "40",
    isActive: true,
    specialties: [{ id: "specialty-general", name: "General" }],
    branches: [{ id: "branch-dj", name: "Dental J.Warner Central" }]
  },
  {
    id: "pro-norte",
    firstName: "Nora",
    lastName: "Norte",
    commissionRate: "40",
    isActive: true,
    specialties: [{ id: "specialty-general", name: "General" }],
    branches: [{ id: "branch-norte", name: "Sucursal Norte" }]
  }
];

const priceLists = [
  {
    id: "price-dj",
    name: "Arancel DJ 2026",
    isDefault: true,
    isActive: true,
    branchAssignments: [
      {
        id: "assignment-dj",
        branchId: "branch-dj",
        priceListId: "price-dj",
        type: "BASE",
        isDefault: true,
        isActive: true,
        branch: {
          id: "branch-dj",
          code: "DJ-1",
          name: "Dental J.Warner Central",
          priceLists: [],
          zone: { id: "zone-dj", code: "DJWARNER", name: "DJWarner", isActive: true }
        }
      }
    ],
    categories: [
      {
        id: "plc-dj",
        priceListId: "price-dj",
        procedureCategoryId: "cat-dj",
        name: "General DJ",
        sortOrder: 1,
        isActive: true,
        items: [
          {
            id: "item-dj",
            procedureId: "proc-dj",
            priceListCategoryId: "plc-dj",
            price: "500",
            labCost: "0",
            allowsDiscount: true,
            currency: "MXN",
            procedure: {
              id: "proc-dj",
              categoryId: "cat-dj",
              displayId: 1,
              code: "DJ01",
              name: "Limpieza Warner",
              type: "CLINICAL",
              defaultDuration: 30,
              requiresTooth: false,
              requiresSurface: false,
              requiresLab: false,
              requiresOdontogramSymbol: false,
              isActive: true
            }
          }
        ]
      }
    ],
    items: []
  },
  {
    id: "price-norte",
    name: "Arancel Norte 2026",
    isDefault: true,
    isActive: true,
    branchAssignments: [
      {
        id: "assignment-norte",
        branchId: "branch-norte",
        priceListId: "price-norte",
        type: "BASE",
        isDefault: true,
        isActive: true,
        branch: {
          id: "branch-norte",
          code: "NORTE-1",
          name: "Sucursal Norte",
          priceLists: [],
          zone: { id: "zone-norte", code: "NORTE", name: "Norte", isActive: true }
        }
      }
    ],
    categories: [],
    items: []
  }
];

vi.mock("../components/users-module-nav", () => ({
  UsersModuleNav: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock("@/stores/branch.store", () => ({
  useBranchStore: (selector: (state: { activeBranchId: string }) => string) => selector({ activeBranchId: "branch-dj" })
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({
    data: branches,
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/settings/price-lists/hooks/use-price-lists", () => ({
  usePriceLists: () => ({
    data: priceLists,
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/settings/professionals/hooks/use-professionals", () => ({
  useProfessionals: () => ({
    data: professionals,
    isLoading: false,
    isError: false,
    error: null
  }),
  useBulkUpdateProfessionalContracts: () => applyMutation,
  useBulkProfessionalContractPreview: () => previewMutation
}));

describe("UsersBulkContractsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewMutation.mutateAsync.mockResolvedValue({
      professionals: 1,
      branches: 1,
      scopes: 1,
      contractsToCreate: 1,
      currentContractsToClose: 0,
      otherContractsToClose: 0,
      fixedAmounts: 1,
      categoryRates: 1,
      priceListId: "price-dj",
      priceListName: "Arancel DJ 2026",
      zoneCodes: ["DJWARNER"],
      warnings: []
    });
  });

  it("builds the preview payload from the selected DJWARNER zone, price list, fixed amount and category", async () => {
    render(<UsersBulkContractsPage />);

    expect(screen.getByText("Dental J.Warner Central")).toBeInTheDocument();
    expect(screen.getByText("Sucursal Norte")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Seleccionar Dora en Dental J.Warner Central"));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    fireEvent.click(screen.getByRole("button", { name: "Sin arancel" }));
    fireEvent.click(screen.getByRole("button", { name: /Arancel DJ 2026/i }));
    expect(screen.getByText(/Limpieza Warner/i)).toBeInTheDocument();
    expect(screen.queryByText("Arancel Norte 2026")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/DJ01 - Limpieza Warner/i));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    await waitFor(() => expect(previewMutation.mutateAsync).toHaveBeenCalled());
    expect(previewMutation.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targets: [{ professionalId: "pro-dj", branchIds: ["branch-dj"] }],
        commissionRate: 45,
        priceListId: "price-dj",
        fixedAmounts: [
          {
            procedureId: "proc-dj",
            priceListId: "price-dj",
            amount: 500,
            currency: "MXN"
          }
        ],
        categoryRates: [{ procedureCategoryId: "cat-dj", rate: 70 }],
        keepPrevious: true,
        removeOtherBranches: false
      })
    );
  });
});
