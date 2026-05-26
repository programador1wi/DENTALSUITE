import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import type { AuthResponse, LoginPayload } from "@/types/auth";
import { login } from "../services/auth.service";

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  return useMutation<AuthResponse, Error, LoginPayload>({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (response) => {
      setSession(response);
      toast.success("Sesión iniciada");
      navigate("/agenda/list", { replace: true });
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo iniciar sesión");
    }
  });
}
