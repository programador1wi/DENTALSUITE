import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersPage } from "./users-page";

const mockBranches = [
  { id: "b-1", name: "Dental + Suc. León Valle", code: "LV", status: "ACTIVE", zone: { id: "z-1", code: "NORTE", name: "Zona Norte" } },
  { id: "b-2", name: "Dental + Suc. Durango", code: "DGO", status: "ACTIVE", zone: { id: "z-1", code: "NORTE", name: "Zona Norte" } },
  { id: "b-3", name: "Dental + Suc. Cancún", code: "CUN", status: "ACTIVE", zone: { id: "z-2", code: "SUR", name: "Zona Sur" } },
  { id: "b-4", name: "Dental + Suc. Playa Del Carmen", code: "PDC", status: "ACTIVE", zone: { id: "z-2", code: "SUR", name: "Zona Sur" } }
];

const mockRoles = [
  { id: "role-1", name: "Caja", code: "cashier", permissions: [] }
];

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({ data: mockBranches, isLoading: false }),
  normalizeName: (str: string) =>
    (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}));

vi.mock("../hooks/use-collaborators", () => ({
  useCollaboratorsQuery: () => ({ data: { items: [], total: 0 }, isLoading: false, refetch: vi.fn() }),
  useCreateCollaborator: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateProfessionalAccess: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock("../hooks/use-users", () => ({
  useUpdateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeactivateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReactivateUser: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock("@/features/settings/roles/hooks/use-roles", () => ({
  useRolesQuery: () => ({ data: mockRoles, isLoading: false })
}));

vi.mock("@/features/settings/specialties/hooks/use-specialties", () => ({
  useSpecialties: () => ({ data: [], isLoading: false })
}));

vi.mock("@/features/settings/professionals/hooks/use-professionals", () => ({
  useProfessionals: () => ({ data: [], isLoading: false }),
  useCreateProfessional: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProfessional: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeactivateProfessional: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTransferProfessionalBranch: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock("@/features/settings/chairs/hooks/use-chairs", () => ({
  useChairs: () => ({ data: [], isLoading: false })
}));

vi.mock("@/features/settings/schedules/hooks/use-schedules", () => ({
  useUpdateProfessionalAgendaConfig: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ can: () => true })
}));

vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector: any) => selector({ user: { id: "user-test", permissions: ["organization.manage_all"] } })
}));

vi.mock("@/stores/branch.store", () => ({
  useBranchStore: (selector: any) => selector({ activeBranchId: "b-1" })
}));

describe("UsersPage branch search and selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters branches dynamically and allows bulk marking/unmarking without losing hidden selections", () => {
    render(
      <MemoryRouter initialEntries={["/settings/users?newCollaborator=professional"]}>
        <UsersPage />
      </MemoryRouter>
    );

    // Initial state: checkboxes should exist
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. León Valle" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. Cancún" })).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Buscar sucursal por nombre/i);

    // 1. Search for "Cancun" (insensible to accents and casing)
    fireEvent.change(searchInput, { target: { value: "cancun" } });

    // Cancun should be visible, Leon Valle should NOT be visible
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. Cancún" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Dental + Suc. León Valle" })).not.toBeInTheDocument();

    // 2. Click "Marcar visibles" to check Cancun
    const markVisiblesBtn = screen.getByRole("button", { name: /Marcar visibles/i });
    fireEvent.click(markVisiblesBtn);

    // Badge should show 2 seleccionadas (initial active branch b-1 + Cancun b-3)
    expect(screen.getByText(/2 seleccionadas/i)).toBeInTheDocument();

    // 3. Clear search using clear button (X) or emptying input
    fireEvent.change(searchInput, { target: { value: "" } });

    // Both should now be visible again
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. León Valle" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. Cancún" })).toBeInTheDocument();
    expect(screen.getByText(/2 seleccionadas/i)).toBeInTheDocument();

    // 4. Search by Zone "SUR"
    fireEvent.change(searchInput, { target: { value: "SUR" } });
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. Cancún" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Dental + Suc. Playa Del Carmen" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Dental + Suc. León Valle" })).not.toBeInTheDocument();

    // 5. Search for non-existent branch
    fireEvent.change(searchInput, { target: { value: "inexistente 999" } });
    expect(screen.getByText(/No se encontraron sucursales para "inexistente 999"/i)).toBeInTheDocument();
  });
});
