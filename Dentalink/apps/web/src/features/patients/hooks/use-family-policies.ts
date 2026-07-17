import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createFamilyPolicy,
  listPatientPolicies,
  listPolicyProducts,
  registerFamilyPolicyPayment
} from "../services/family-policies.service";

export function usePolicyProducts(enabled = true) {
  return useQuery({
    queryKey: ["family-policy-products"],
    queryFn: listPolicyProducts,
    enabled
  });
}

export function usePatientPolicies(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ["family-policies", patientId],
    queryFn: () => listPatientPolicies(patientId),
    enabled
  });
}

export function useFamilyPolicyMutations(patientId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family-policies", patientId] });
  return {
    create: useMutation({
      mutationFn: createFamilyPolicy,
      onSuccess: () => {
        toast.success("Borrador de póliza creado");
        void refresh();
      },
      onError: (error: Error) => toast.error(error.message)
    }),
    pay: useMutation({
      mutationFn: ({
        policyId,
        payload
      }: {
        policyId: string;
        payload: Parameters<typeof registerFamilyPolicyPayment>[1];
      }) => registerFamilyPolicyPayment(policyId, payload),
      onSuccess: (policy) => {
        toast.success(
          policy.status === "ACTIVE" ? "Pago registrado y póliza activada" : "Pago parcial registrado"
        );
        void refresh();
      },
      onError: (error: Error) => toast.error(error.message)
    })
  };
}
