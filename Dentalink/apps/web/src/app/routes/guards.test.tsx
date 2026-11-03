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
    authStoreApi.setState({ user: null, accessToken: null, isSessionInitialized: true });
  });

  it("renders PermissionDeniedState when accessing a route without required permissions", async () => {
    authStoreApi.setState({ user: userWith(["patients.read"]) });
    const router = createMemoryRouter(
      [
        {
          path: "/configuracion/convenios",
          element: <RequirePermissions required={["settings.read"]} />,
          children: [{ index: true, element: <div>Convenios protegidos</div> }]
        }
      ],
      { initialEntries: ["/configuracion/convenios"] }
    );

    render(
      <QueryClientProvider client={testClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Acceso no autorizado")).toBeInTheDocument();
    expect(screen.queryByText("Convenios protegidos")).not.toBeInTheDocument();
  });

  it("renders protected content when user possesses required permissions", async () => {
    authStoreApi.setState({ user: userWith(["settings.read"]) });
    const router = createMemoryRouter(
      [
        {
          path: "/configuracion/convenios",
          element: <RequirePermissions required={["settings.read"]} />,
          children: [{ index: true, element: <div>Convenios protegidos</div> }]
        }
      ],
      { initialEntries: ["/configuracion/convenios"] }
    );

    render(
      <QueryClientProvider client={testClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Convenios protegidos")).toBeInTheDocument();
    expect(screen.queryByText("Acceso no autorizado")).not.toBeInTheDocument();
  });

  it("does not render protected content while auth/me is pending and displays loading state", async () => {
    let resolveCurrentUser!: (user: AuthUser) => void;
    authMocks.me.mockReturnValue(
      new Promise<AuthUser>((resolve) => {
        resolveCurrentUser = resolve;
      })
    );
    authStoreApi.setState({
      user: userWith(["settings.read"]),
      accessToken: "access-token"
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
            }
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

    await act(async () => resolveCurrentUser(userWith(["settings.read"])));

    expect(await screen.findByText("Convenios protegidos")).toBeInTheDocument();
    expect(authStoreApi.getState().user?.permissions).toEqual(["settings.read"]);
  });
});
