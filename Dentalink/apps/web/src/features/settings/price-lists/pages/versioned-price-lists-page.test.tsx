import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionedPriceListsPage } from "./versioned-price-lists-page";
import type { PriceListHistory, PriceListVersionV2 } from "../services/versioned-price-lists.service";

const mockState = vi.hoisted(() => ({
  validate: vi.fn(),
  publish: vi.fn(),
  history: {
    priceList: { id: "list-1", code: "BASE", name: "Tarifario Base" },
    latestVersion: null as PriceListVersionV2 | null,
    activeVersion: null as PriceListVersionV2 | null,
    publicationPreview: { newItemsCount: 1 },
    versions: [] as PriceListHistory["versions"],
    events: [] as PriceListHistory["events"],
    pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }
  }
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams("listId=list-1"), vi.fn()]
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <header><h1>{title}</h1><p>{description}</p></header>
  )
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    user: { organizationId: "org-1" },
    hasPermission: () => true
  })
}));

vi.mock("@/features/settings/procedures/hooks/use-procedures", () => ({
  useProcedures: () => ({ data: [], isLoading: false, isError: false }),
  useProcedureCategories: () => ({ data: [], isLoading: false, isError: false }),
  useProcedureMutations: () => ({ createProcedure: { mutateAsync: vi.fn(), isPending: false } })
}));

vi.mock("../hooks/use-price-lists", () => ({
  usePriceListAvailabilityMatrix: () => ({ data: { branches: [] }, isLoading: false, isError: false })
}));

vi.mock("../hooks/use-versioned-price-lists", () => ({
  useVersionedPriceLists: () => ({ data: [priceListFixture()], isLoading: false, isError: false }),
  useVersionItems: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  usePriceListHistory: () => ({
    data: mockState.history,
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  }),
  useVersionedPriceMutations: () => ({
    createList: { mutateAsync: vi.fn(), isPending: false },
    createVersion: { mutateAsync: vi.fn(), isPending: false },
    saveItem: { mutateAsync: vi.fn(), isPending: false },
    updateItem: { mutateAsync: vi.fn(), isPending: false },
    deactivateItem: { mutateAsync: vi.fn(), isPending: false },
    validate: { mutateAsync: mockState.validate, isPending: false },
    publish: { mutateAsync: mockState.publish, isPending: false }
  })
}));

describe("VersionedPriceListsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const draft = versionFixture({ id: "version-3", versionNumber: 3, status: "DRAFT", treatmentItems: 0 });
    const active = versionFixture({
      id: "version-2",
      versionNumber: 2,
      status: "ACTIVE",
      treatmentItems: 4,
      publishedAt: "2026-07-01T12:00:00.000Z",
      checksum: "abc123"
    });
    mockState.history.latestVersion = draft;
    mockState.history.activeVersion = active;
    mockState.history.versions = [draft, active];
    mockState.history.events = [
      {
        id: "event-1",
        entity: "PriceListVersion",
        entityId: "version-2",
        action: "price_list.published",
        reason: "Actualización anual",
        correlationId: "corr-1",
        oldValue: { status: "DRAFT" },
        newValue: { status: "ACTIVE" },
        createdAt: "2026-07-01T12:00:00.000Z",
        actor: { id: "user-1", firstName: "Ada", lastName: "Admin", email: "ada@example.test" }
      }
    ];
    mockState.history.pagination = { page: 1, pageSize: 50, total: 1, totalPages: 1 };
    mockState.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    mockState.publish.mockResolvedValue(active);
  });

  it("shows immutable versions and human audit events", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Historial/i }));

    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText("Versión publicada")).toBeInTheDocument();
    expect(screen.getAllByText(/Ada Admin/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Actualización anual/).length).toBeGreaterThan(0);
  });

  it("warns that publishing does not mutate treatments and previews the replaced version", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Previsualizar y publicar/i }));

    expect(await screen.findByText("Esta publicación no modificará tratamientos existentes.")).toBeInTheDocument();
    expect(screen.getByText("Versión que será reemplazada")).toBeInTheDocument();
    expect(screen.getByText("Tratamientos que conservan precio histórico")).toBeInTheDocument();
    await waitFor(() => expect(mockState.validate).toHaveBeenCalledWith("version-3"));
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <VersionedPriceListsPage />
    </QueryClientProvider>
  );
}

function priceListFixture() {
  return {
    id: "list-1",
    code: "BASE",
    name: "Tarifario Base",
    description: null,
    currency: "MXN" as const,
    status: "DRAFT" as const,
    priority: 0,
    version: 3,
    currentVersion: 3,
    validFrom: null,
    validTo: null,
    versionsV2: [versionFixture({ id: "version-3", versionNumber: 3, status: "DRAFT", treatmentItems: 0 })]
  };
}

function versionFixture({
  id,
  versionNumber,
  status,
  treatmentItems,
  publishedAt = null,
  checksum = null
}: {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "ACTIVE";
  treatmentItems: number;
  publishedAt?: string | null;
  checksum?: string | null;
}): PriceListVersionV2 {
  return {
    id,
    versionNumber,
    version: 1,
    status,
    validFrom: null,
    validTo: null,
    currency: "MXN",
    publishedAt,
    publishedById: status === "ACTIVE" ? "user-1" : null,
    publishedBy: status === "ACTIVE" ? { id: "user-1", firstName: "Ada", lastName: "Admin", email: "ada@example.test" } : null,
    changeSummary: status === "ACTIVE" ? "Actualización anual" : "Nueva prestación",
    previousVersionId: status === "DRAFT" ? "version-2" : null,
    checksum,
    createdAt: "2026-06-01T12:00:00.000Z",
    scopes: [],
    _count: { items: status === "DRAFT" ? 4 : 3, treatmentItems }
  };
}
