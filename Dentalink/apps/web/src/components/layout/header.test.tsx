import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/auth";
import { authStoreApi } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { novedadesStoreApi } from "@/features/novedades";
import { Header } from "./header";

const branchMocks = vi.hoisted(() => ({
  useBranches: vi.fn()
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: branchMocks.useBranches,
  normalizeName: (name: string) => name.toLowerCase()
}));

vi.mock("@/features/auth/hooks/use-logout", () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock("@/features/patients/components/patient-search-box", () => ({
  PatientSearchBox: () => <div data-testid="patient-search">Buscar pacientes</div>
}));

function userWith(permissions: string[], branches?: AuthUser["branches"]): AuthUser {
  const branchList = branches ?? [{ id: "branch-1", name: "Sucursal asignada", isPrimary: true }];
  return {
    id: "user-1",
    organizationId: "org-1",
    organization: { id: "org-1", name: "Clinica" },
    email: "user@example.com",
    firstName: "Usuario",
    lastName: "Prueba",
    roleIds: ["role-1"],
    roleNames: ["PRUEBA"],
    permissions,
    branchIds: branchList.map((b) => b.id),
    branches: branchList
  };
}

describe("Header permission visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    branchMocks.useBranches.mockReset();
    branchMocks.useBranches.mockReturnValue({ data: undefined });
    authStoreApi.setState({ user: null, accessToken: null, refreshToken: null });
    useBranchStore.setState({ activeBranchId: undefined });
  });

  it("does not expose empty administration or patient search without permissions", () => {
    authStoreApi.setState({ user: userWith([]) });

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.queryByText("Administracion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("patient-search")).not.toBeInTheDocument();
    expect(branchMocks.useBranches).toHaveBeenCalledWith(undefined, "ACTIVE", false);
  });

  it("shows only authorized settings entries and enables their supporting query", () => {
    authStoreApi.setState({ user: userWith(["admin.agreements.manage", "branches.read"]) });

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Administracion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Convenios").length).toBeGreaterThan(0);
    expect(screen.queryByText("Inventario")).not.toBeInTheDocument();
    expect(screen.queryByTestId("patient-search")).not.toBeInTheDocument();
    expect(branchMocks.useBranches).toHaveBeenCalledWith(undefined, "ACTIVE", true);
  });
});

describe("Header Branch & Zone Selector", () => {
  beforeEach(() => {
    localStorage.clear();
    branchMocks.useBranches.mockReset();
    authStoreApi.setState({ user: null, accessToken: null, refreshToken: null });
    useBranchStore.setState({ activeBranchId: undefined });
  });

  it("renders branches directly without zone selection when user has branches in only ONE zone", () => {
    const singleZoneBranches = [
      { id: "b-1", name: "Sucursal Norte 1", zone: { id: "z-1", code: "NORTE", name: "Zona Norte" } },
      { id: "b-2", name: "Sucursal Norte 2", zone: { id: "z-1", code: "NORTE", name: "Zona Norte" } }
    ];

    authStoreApi.setState({
      user: userWith(["branches.read"], singleZoneBranches as any)
    });
    branchMocks.useBranches.mockReturnValue({ data: singleZoneBranches });
    useBranchStore.setState({ activeBranchId: "b-1" });

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // Open branch switcher dropdown
    const switcherButton = screen.getByRole("button", { name: /Sucursal Norte 1/i });
    fireEvent.click(switcherButton);

    // Should NOT show "Selecciona una Zona"
    expect(screen.queryByText(/Selecciona una Zona/i)).not.toBeInTheDocument();

    // Should show both branches directly
    expect(screen.getAllByText("Sucursal Norte 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sucursal Norte 2")).toBeInTheDocument();
  });

  it("renders zone selector when user has branches in MULTIPLE distinct zones", () => {
    const multiZoneBranches = [
      { id: "b-1", name: "Sucursal Norte 1", zone: { id: "z-1", code: "NORTE", name: "Zona Norte" } },
      { id: "b-2", name: "Sucursal Sur 1", zone: { id: "z-2", code: "SUR", name: "Zona Sur" } }
    ];

    authStoreApi.setState({
      user: userWith(["branches.read"], multiZoneBranches as any)
    });
    branchMocks.useBranches.mockReturnValue({ data: multiZoneBranches });
    useBranchStore.setState({ activeBranchId: "b-1" });

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // Open branch switcher dropdown
    const switcherButton = screen.getByRole("button", { name: /Sucursal Norte 1/i });
    fireEvent.click(switcherButton);

    // Should show "Selecciona una Zona" and zone buttons
    expect(screen.getByText(/Selecciona una Zona/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^NORTE$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^SUR$/i })).toBeInTheDocument();

    // Branches shouldn't be visible before selecting a zone
    expect(screen.queryByText("Sucursal Sur 1")).not.toBeInTheDocument();

    // Click on SUR zone
    fireEvent.click(screen.getByRole("button", { name: /^SUR$/i }));

    // Now SUR branches should be visible and back button to Zonas exists
    expect(screen.getByText("Sucursal Sur 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zonas/i })).toBeInTheDocument();
  });
});

describe("Header Novedades Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    novedadesStoreApi.setState({
      isOpen: false,
      readIds: []
    });
    authStoreApi.setState({ user: userWith([]) });
    useBranchStore.setState({ activeBranchId: undefined });
  });

  it("renders Novedades button and opens NovedadesDrawer on click", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const novedadesButton = screen.getByRole("button", { name: /Novedades/i });
    expect(novedadesButton).toBeInTheDocument();

    // Before clicking, drawer is closed
    expect(novedadesStoreApi.getState().isOpen).toBe(false);

    // Click novedades button
    fireEvent.click(novedadesButton);

    // Drawer should open
    expect(novedadesStoreApi.getState().isOpen).toBe(true);
    expect(screen.getByText("Novedades y Actualizaciones")).toBeInTheDocument();
  });
});
