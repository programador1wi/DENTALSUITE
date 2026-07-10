import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/types/auth";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (payload: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
      hasPermission: (permission) => {
        const permissions = get().user?.permissions ?? [];
        return permissions.includes("system.manage_all") || permissions.includes(permission);
      }
    }),
    {
      name: "dentalwarner-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

export const authStoreApi = useAuthStore;
