import { create } from "zustand";
import { hasEffectivePermission } from "@dentalwarner/shared";
import type { AuthUser } from "@/types/auth";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isSessionInitialized: boolean;
  sessionEpoch: number;
  setSession: (payload: { user: AuthUser; accessToken: string }) => void;
  setSessionInitialized: (initialized: boolean) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
};

// Remove tokens written by versions prior to the HttpOnly-cookie migration.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("dentalwarner-auth");
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isSessionInitialized: false,
  sessionEpoch: 0,
  setSession: ({ user, accessToken }) => set((state) => ({
    user,
    accessToken,
    isSessionInitialized: true,
    sessionEpoch: state.user &&
      (state.user.id !== user.id || state.user.organizationId !== user.organizationId)
        ? state.sessionEpoch + 1
        : state.sessionEpoch
  })),
  setSessionInitialized: (isSessionInitialized) => set({ isSessionInitialized }),
  setUser: (user) => set({ user }),
  clearSession: () => set((state) => ({
    user: null,
    accessToken: null,
    isSessionInitialized: true,
    sessionEpoch: state.sessionEpoch + 1
  })),
  hasPermission: (permission) => {
    const permissions = get().user?.permissions ?? [];
    return hasEffectivePermission(permissions, permission);
  }
}));

export const authStoreApi = useAuthStore;
