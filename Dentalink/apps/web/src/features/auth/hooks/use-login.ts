import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import type { AuthResponse, LoginPayload } from "@/types/auth";
import { login } from "../services/auth.service";
import { clearPrivateQueryState } from "@/app/providers/query-client";

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const setActiveBranchId = useBranchStore((state) => state.setActiveBranchId);
  const navigate = useNavigate();

  return useMutation<AuthResponse, Error, LoginPayload>({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: async (response) => {
      await clearPrivateQueryState();
      setSession(response);
      setActiveBranchId("");
      toast.success("Sesión iniciada");
      navigate("/", { replace: true });
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo iniciar sesión");
    }
  });
}
