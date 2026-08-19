import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProfilePage } from "./profile-page";

const updateProfileMutation = vi.hoisted(() => vi.fn());
const changePasswordMutation = vi.hoisted(() => vi.fn());
const logoutMutation = vi.hoisted(() => vi.fn());
const setActiveBranchIdMock = vi.hoisted(() => vi.fn());

let mockUserData: any = null;

vi.mock("@/features/auth/hooks/use-me", () => ({
  useMeQuery: () => ({
    data: mockUserData,
    isLoading: false,
    isError: false,
    error: null
  }),
  useUpdateProfileMutation: () => ({
    isPending: false,
    mutateAsync: updateProfileMutation
  }),
  useChangePasswordMutation: () => ({
    isPending: false,
    mutateAsync: changePasswordMutation
  })
}));

vi.mock("@/features/settings/organization/hooks/use-organization", () => ({
  useOrganizationSettings: () => ({
    data: {
      organizationName: "Clínica Dental Warner",
      legalName: "Dental Warner S.A. de C.V.",
      taxId: "DWA200101XYZ",
      phone: "+52 55 5555 1234",
      email: "contacto@dentalwarner.com",
      address: "Av. Reforma 100, CDMX"
    },
    isLoading: false
  })
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({
    data: [
      { id: "branch_1", name: "Sucursal León Valle", code: "LEO-01" },
      { id: "branch_2", name: "Sucursal Durango", code: "DUR-02" }
    ],
    isLoading: false
  })
}));

vi.mock("@/stores/branch.store", () => ({
  useBranchStore: () => ({
    activeBranchId: "branch_1",
    setActiveBranchId: setActiveBranchIdMock
  })
}));

vi.mock("@/features/auth/hooks/use-logout", () => ({
  useLogout: () => ({
    isPending: false,
    mutate: logoutMutation
  })
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    updateProfileMutation.mockReset().mockResolvedValue({});
    changePasswordMutation.mockReset().mockResolvedValue({});
    logoutMutation.mockReset();
    setActiveBranchIdMock.mockReset();

    mockUserData = {
      id: "usr_12345",
      organizationId: "org_98765",
      organizationName: "Clínica Dental Warner",
      organization: {
        id: "org_98765",
        name: "Clínica Dental Warner",
        legalName: "Dental Warner S.A. de C.V.",
        taxId: "DWA200101XYZ",
        phone: "+52 55 5555 1234",
        email: "contacto@dentalwarner.com",
        address: "Av. Reforma 100, CDMX"
      },
      email: "admin@dentalwarner.local",
      firstName: "System",
      lastName: "Admin",
      phone: "+52 55 9876 5432",
      roleIds: ["role_1"],
      roleNames: ["SUPER_ADMIN"],
      permissions: [
        "appointments.read",
        "appointments.create",
        "patients.read",
        "clinical.read",
        "payments.read",
        "system.manage_all"
      ],
      branchIds: ["branch_1", "branch_2"],
      branches: [
        { id: "branch_1", name: "Sucursal León Valle", code: "LEO-01", isPrimary: true },
        { id: "branch_2", name: "Sucursal Durango", code: "DUR-02", isPrimary: false }
      ],
      status: "ACTIVE"
    };
  });

  it("renders hero profile info, full name, role badge and organization name correctly for SUPER_ADMIN", () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "System Admin" })).toBeInTheDocument();
    expect(screen.getByText("admin@dentalwarner.local")).toBeInTheDocument();
    expect(screen.getAllByText("SUPER_ADMIN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clínica Dental Warner").length).toBeGreaterThan(0);
    expect(screen.getByText("ACTIVO")).toBeInTheDocument();
  });

  it("switches tabs and displays assigned branches for SUPER_ADMIN", () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const branchesTabButton = screen.getByRole("button", { name: /Sucursales/i });
    fireEvent.click(branchesTabButton);

    expect(screen.getByText("Sucursal León Valle")).toBeInTheDocument();
    expect(screen.getByText("Sucursal Durango")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Sede Activa en Sesión")).toBeInTheDocument();
  });

  it("switches tabs and displays role permissions grouped for SUPER_ADMIN", () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const permissionsTabButton = screen.getByRole("button", { name: /Roles y Permisos/i });
    fireEvent.click(permissionsTabButton);

    expect(screen.getByText("Roles y Matriz de Permisos")).toBeInTheDocument();
    expect(screen.getByText("appointments.read")).toBeInTheDocument();
    expect(screen.getByText("patients.read")).toBeInTheDocument();
  });

  it("allows submitting personal profile updates", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/^Nombre/i);
    fireEvent.change(nameInput, { target: { value: "Carlos" } });

    const submitBtn = screen.getByRole("button", { name: "Guardar Cambios" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateProfileMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Carlos"
        })
      );
    });
  });

  it("displays organization corporate details for SUPER_ADMIN", () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const orgTabButton = screen.getByRole("button", { name: /Organización/i });
    fireEvent.click(orgTabButton);

    expect(screen.getByText("Información de la Organización")).toBeInTheDocument();
    expect(screen.getByText("Dental Warner S.A. de C.V.")).toBeInTheDocument();
    expect(screen.getByText("DWA200101XYZ")).toBeInTheDocument();
  });

  it("hides administrative tabs (Sucursales, Roles y Permisos, Organización) for regular non-admin users", () => {
    mockUserData = {
      id: "usr_99999",
      organizationId: "org_98765",
      organizationName: "Clínica Dental Warner",
      email: "recepcion@dentalwarner.local",
      firstName: "Ana",
      lastName: "Gómez",
      phone: "+52 55 1111 2222",
      roleIds: ["role_recep"],
      roleNames: ["RECEPCIONISTA"],
      permissions: ["appointments.read", "appointments.create", "patients.read"],
      branchIds: ["branch_1"],
      branches: [{ id: "branch_1", name: "Sucursal León Valle", code: "LEO-01", isPrimary: true }],
      status: "ACTIVE"
    };

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Ana Gómez" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Datos Personales/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seguridad y Acceso/i })).toBeInTheDocument();

    // Administrative tabs must NOT be present
    expect(screen.queryByRole("button", { name: /Sucursales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Roles y Permisos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Organización/i })).not.toBeInTheDocument();

    // Quick info adapts to regular user context
    expect(screen.getByText("Sede de Atención")).toBeInTheDocument();
    expect(screen.getByText("Rol Principal")).toBeInTheDocument();
  });

  it("allows SUPER_ADMIN to toggle Preview As Standard User mode on demand", () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // Initial state: all 5 tabs exist
    expect(screen.getByRole("button", { name: /Sucursales/i })).toBeInTheDocument();
    const previewBtn = screen.getByRole("button", { name: /Visualizar como Usuario Estándar/i });
    expect(previewBtn).toBeInTheDocument();

    // Click to simulate standard user
    fireEvent.click(previewBtn);

    // Admin tabs disappear, simulation banner appears
    expect(screen.getByText("Modo de Simulación Activo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sucursales/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Roles y Permisos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Organización/i })).not.toBeInTheDocument();

    // Restore to real SuperAdmin view
    const restoreBtn = screen.getByRole("button", { name: /Restaurar Vista Super Admin/i });
    fireEvent.click(restoreBtn);

    // Admin tabs reappear
    expect(screen.getByRole("button", { name: /Sucursales/i })).toBeInTheDocument();
  });
});

