import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import type { AuthResponse, RegisterOrganizationPayload } from "@/types/auth";
import { registerOrganization } from "../services/auth.service";

export function useRegisterOrganization() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  return useMutation<AuthResponse, Error, RegisterOrganizationPayload>({
    mutationFn: (payload: RegisterOrganizationPayload) => registerOrganization(payload),
    onSuccess: (response) => {
      setSession(response);
      toast.success("Organizaci�n registrada");
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo registrar la organizaci�n");
    }
  });
}
