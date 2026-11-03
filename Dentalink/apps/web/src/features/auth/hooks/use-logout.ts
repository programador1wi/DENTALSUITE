import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { logout } from "../services/auth.service";
import { clearPrivateQueryState } from "@/app/providers/query-client";
import { broadcastSessionCleared } from "@/lib/api/http-client";

export function useLogout() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const setActiveBranchId = useBranchStore((state) => state.setActiveBranchId);

  return useMutation<{ success: boolean }, Error>({
    mutationFn: logout,
    onSuccess: async () => {
      clearSession();
      broadcastSessionCleared();
      setActiveBranchId("");
      await clearPrivateQueryState();
      toast.success("Sesión finalizada");
      navigate("/login", { replace: true });
    },
    onError: async (error) => {
      clearSession();
      broadcastSessionCleared();
      setActiveBranchId("");
      await clearPrivateQueryState();
      toast.error(error.message || "Sesión finalizada con advertencias");
      navigate("/login", { replace: true });
    }
  });
}
