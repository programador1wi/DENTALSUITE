import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { NovedadesState, ReleaseItem } from "../types";
import defaultReleases from "../data/releases.json";

export const useNovedadesStore = create<NovedadesState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      releases: defaultReleases as ReleaseItem[],
      readIds: [],

      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),

      markAllAsRead: () => {
        const { releases } = get();
        const allIds = releases.map((r) => r.id);
        set({ readIds: allIds });
      },

      markAsRead: (id: string) => {
        const { readIds } = get();
        if (readIds.includes(id)) return;
        set({ readIds: [...readIds, id] });
      },

      getUnreadCount: () => {
        const { releases, readIds } = get();
        return releases.filter((r) => !readIds.includes(r.id)).length;
      },

      isRead: (id: string) => {
        const { readIds } = get();
        return readIds.includes(id);
      }
    }),
    {
      name: "dentalink-novedades-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ readIds: state.readIds })
    }
  )
);

export const novedadesStoreApi = useNovedadesStore;
