import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type BranchStore = {
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
};

export const useBranchStore = create<BranchStore>()(
  persist(
    (set) => ({
      activeBranchId: "",
      setActiveBranchId: (id: string) => set({ activeBranchId: id }),
    }),
    {
      name: "dentalwarner-active-branch",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
