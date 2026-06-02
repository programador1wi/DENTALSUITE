import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { logout } from "../services/auth.service";

export function useLogout() {
  const navigate = useNavigate();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setActiveBranchId = useBranchStore((state) => state.setActiveBranchId);
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error>({
    mutationFn: () => logout(refreshToken ?? undefined),
    onSuccess: () => {
      clearSession();
      setActiveBranchId("");
      queryClient.removeQueries({ queryKey: ["settings", "branches"] });
      toast.success("Sesi�n finalizada");
      navigate("/login", { replace: true });
    },
    onError: (error) => {
      clearSession();
      setActiveBranchId("");
      queryClient.removeQueries({ queryKey: ["settings", "branches"] });
      toast.error(error.message || "Sesi�n finalizada con advertencias");
      navigate("/login", { replace: true });
    }
  });
}
