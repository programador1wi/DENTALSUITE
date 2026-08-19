import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/auth";
import { authStoreApi } from "@/stores/auth.store";
import { AgreementsSettingsPage } from "./agreements-settings-page";

const auxiliaryMocks = vi.hoisted(() => ({
  useBranches: vi.fn(),
  usePriceLists: vi.fn(),
  useProcedures: vi.fn()
}));

const agreementMocks = vi.hoisted(() => ({
  useAgreements: vi.fn()
}));

const hookFactories = vi.hoisted(() => ({
  idleMutation: () => ({
    data: undefined,
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn()
  })
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: auxiliaryMocks.useBranches
}));

vi.mock("@/features/settings/price-lists/hooks/use-price-lists", () => ({
  usePriceLists: auxiliaryMocks.usePriceLists
}));

vi.mock("@/features/settings/procedures/hooks/use-procedures", () => ({
  useProcedures: auxiliaryMocks.useProcedures
}));

vi.mock("../hooks/use-admin-workflows", () => ({
  useAgreements: agreementMocks.useAgreements,
  useAssignAgreementPatients: hookFactories.idleMutation,
  useCreateAgreement: hookFactories.idleMutation,
  useDeactivateAgreement: hookFactories.idleMutation,
  useAgreementPreview: hookFactories.idleMutation,
  useCancelAgreement: hookFactories.idleMutation,
  useDuplicateAgreement: hookFactories.idleMutation,
  usePublishAgreement: hookFactories.idleMutation,
  useUpdateAgreement: hookFactories.idleMutation
}));

vi.mock("./agreements-debts-page", () => ({
  AgreementsDebtsPage: () => <div>Reporte de deudas</div>
}));

function userWith(permissions: string[]): AuthUser {
  return {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "Usuario",
    lastName: "Prueba",
    roleIds: ["role-1"],
    roleNames: ["PRUEBA"],
    permissions,
    branchIds: ["branch-1"]
  };
}

describe("AgreementsSettingsPage permissions", () => {
  beforeEach(() => {
    localStorage.clear();
    authStoreApi.setState({ user: userWith(["settings.read"]), accessToken: null, refreshToken: null });
    agreementMocks.useAgreements.mockReset();
    agreementMocks.useAgreements.mockReturnValue({ data: [], isLoading: false, isError: false });
    for (const mock of Object.values(auxiliaryMocks)) {
      mock.mockReset();
      mock.mockReturnValue({ data: [] });
    }
  });

  it("keeps read-only listing available without mounting forbidden actions or lookups", () => {
    render(<AgreementsSettingsPage />);

    expect(screen.getByText("Convenios")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Asignar pacientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Previsualizar precio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar convenio/i })).not.toBeInTheDocument();
    expect(auxiliaryMocks.useBranches).toHaveBeenCalledWith(undefined, "ACTIVE", false);
    expect(auxiliaryMocks.useProcedures).toHaveBeenCalledWith(undefined, "true", undefined, false);
    expect(auxiliaryMocks.usePriceLists).toHaveBeenCalledWith(undefined, "true", undefined, false);
  });
});
