import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { logout } from "../services/auth.service";

export function useLogout() {
  const navigate = useNavigate();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation<{ success: boolean }, Error>({
    mutationFn: () => logout(refreshToken ?? undefined),
    onSuccess: () => {
      clearSession();
      toast.success("Sesi�n finalizada");
      navigate("/login", { replace: true });
    },
    onError: (error) => {
      clearSession();
      toast.error(error.message || "Sesi�n finalizada con advertencias");
      navigate("/login", { replace: true });
    }
  });
}
