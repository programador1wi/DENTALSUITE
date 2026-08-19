import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBranch, deactivateBranch, listBranches, updateBranch, type BranchPayload } from "../services/branches.service";
import { useAuthStore } from "@/stores/auth.store";

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s+]/g, "")  // remove special characters except spaces and +
    .trim()
    .replace(/\s+/g, " ");
}

export const ORDERED_NAMES = [
  "Dental + Suc. León Valle",
  "Dental + Suc. Durango",
  "Dental + Suc. Condesa",
  "Dental + Suc. Puerto Vallarta",
  "Dental + Suc. San Luis Potosí",
  "Dental + Suc. Aguascalientes",
  "Dental + Suc. Cancún",
  "Dental + Suc. Playa del Carmen",
  "Dental + Suc. San Luis Río",
  "Dental + Suc. León",
  "Dental + Suc. Mexicali",
  "Dental + Suc. Campeche",
  "Dental + Suc. Mérida",
  "Dental + Suc. Xalapa",
  "Dental + Suc. Atlixco",
  "Dental + Suc. Tuxpan",
  "Dental + Suc. Córdoba Veracruz",
  "Dental + Suc. Comitán",
  "Dental + Suc. Tonalá",
  "Dental + Suc. Pachuca",
  "Dental + Suc. Villahermosa",
  "DX-RAY TUXTLA",
  "Dental + Suc. San Cristóbal",
  "Dental + Suc. Tapachula",
  "Dental + Suc. Guadalajara",
  "Dental + Suc. Tuxtla",
  "Dental J.Warner Villahermosa",
  "Dental+ Pachuca Select",
  "Dental + Suc Laureles",
  "Dental + Suc. Villaflores",
  "Dental J.Warner Paulino Navarro",
  "Dental + Real Del Bosque",
  "Dental J.Warner 9NA SUR",
  "Dental J.Warner ESPECIALIDADES TUXTLA"
].map(normalizeName);

export function sortBranches<T extends { name: string }>(branches: T[]): T[] {
  return [...branches].sort((a, b) => {
    const normA = normalizeName(a.name);
    const normB = normalizeName(b.name);
    
    let indexA = ORDERED_NAMES.indexOf(normA);
    let indexB = ORDERED_NAMES.indexOf(normB);
    
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    
    if (indexA !== indexB) {
      return indexA - indexB;
    }
    
    return a.name.localeCompare(b.name);
  });
}

export function useBranches(search?: string, status?: string, enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["settings", "branches", search, status, accessToken],
    queryFn: async () => {
      const data = await listBranches({ search, status });
      return sortBranches(data);
    },
    enabled: Boolean(accessToken) && enabled
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BranchPayload) => createBranch(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "branches"] })
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BranchPayload> & { status?: "ACTIVE" | "INACTIVE" } }) =>
      updateBranch(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "branches"] })
  });
}

export function useDeactivateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateBranch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "branches"] })
  });
}
