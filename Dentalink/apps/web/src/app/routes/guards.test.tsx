import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/auth";
import { authStoreApi } from "@/stores/auth.store";
import { RequireAuth, RequirePermissions } from "./guards";

const authMocks = vi.hoisted(() => ({
  me: vi.fn()
}));

const toastMocks = vi.hoisted(() => ({
  warning: vi.fn()
}));

vi.mock("@/features/auth/services/auth.service", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth/services/auth.service")>(
    "@/features/auth/services/auth.service"
  );
  return { ...actual, me: authMocks.me };
});

vi.mock("sonner", () => ({
  toast: toastMocks
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

function testClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("route permission guards", () => {
  beforeEach(() => {
    localStorage.clear();
    authMocks.me.mockReset();
    toastMocks.warning.mockReset();
    authStoreApi.setState({ user: null, accessToken: null, refreshToken: null });
  });

  it("redirects a forbidden direct URL to the first authorized module and warns once", async () => {
    authStoreApi.setState({ user: userWith(["patients.read"]) });
    const router = createMemoryRouter(
      [
        {
          path: "/configuracion/convenios",
          element: <RequirePermissions required={["settings.read"]} />,
          children: [{ index: true, element: <div>Convenios protegidos</div> }]
        },
        { path: "/pacientes", element: <div>Pacientes autorizados</div> },
        { path: "/configuracion/perfil", element: <div>Perfil</div> }
      ],
      { initialEntries: ["/configuracion/convenios"] }
    );

    render(
      <QueryClientProvider client={testClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Pacientes autorizados")).toBeInTheDocument();
    expect(screen.queryByText("Convenios protegidos")).not.toBeInTheDocument();
    expect(toastMocks.warning).toHaveBeenCalledTimes(1);
  });

  it("does not render stale permissions while auth/me is pending", async () => {
    let resolveCurrentUser!: (user: AuthUser) => void;
    authMocks.me.mockReturnValue(new Promise<AuthUser>((resolve) => {
      resolveCurrentUser = resolve;
    }));
    authStoreApi.setState({
      user: userWith(["settings.read"]),
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });

    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [
            {
              path: "/configuracion/convenios",
              element: <RequirePermissions required={["settings.read"]} />,
              children: [{ index: true, element: <div>Convenios protegidos</div> }]
            },
            { path: "/pacientes", element: <div>Pacientes autorizados</div> },
            { path: "/configuracion/perfil", element: <div>Perfil</div> }
          ]
        }
      ],
      { initialEntries: ["/configuracion/convenios"] }
    );

    render(
      <QueryClientProvider client={testClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Validando sesi/i)).toBeInTheDocument();
    expect(screen.queryByText("Convenios protegidos")).not.toBeInTheDocument();

    await act(async () => resolveCurrentUser(userWith(["patients.read"])));

    expect(await screen.findByText("Pacientes autorizados")).toBeInTheDocument();
    expect(authStoreApi.getState().user?.permissions).toEqual(["patients.read"]);
    await waitFor(() => expect(toastMocks.warning).toHaveBeenCalledTimes(1));
  });
});
