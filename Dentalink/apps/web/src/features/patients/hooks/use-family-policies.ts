import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  applyFamilyPolicyCoverage,
  createFamilyPolicy,
  getPatientPolicyDetail,
  listPatientPolicies,
  listPolicyProducts,
  registerFamilyPolicyPayment,
  simulateFamilyPolicyCoverage,
} from "../services/family-policies.service";

export function usePolicyProducts(enabled = true) {
  return useQuery({
    queryKey: ["family-policy-products"],
    queryFn: listPolicyProducts,
    enabled,
  });
}

export function usePolicyCoverageMutations(
  patientId: string,
  policyNumber: string,
) {
  const queryClient = useQueryClient();
  return {
    simulate: useMutation({
      mutationFn: (treatmentPlanItemId: string) =>
        simulateFamilyPolicyCoverage(policyNumber, {
          patientId,
          treatmentPlanItemId,
        }),
      onError: (error: Error) => toast.error(error.message),
    }),
    apply: useMutation({
      mutationFn: ({
        treatmentPlanItemId,
        authorizationCode,
      }: {
        treatmentPlanItemId: string;
        authorizationCode?: string;
      }) =>
        applyFamilyPolicyCoverage(policyNumber, {
          patientId,
          treatmentPlanItemId,
          authorizationCode,
          idempotencyKey: `policy-usage-${policyNumber}-${treatmentPlanItemId}-${crypto.randomUUID()}`,
        }),
      onSuccess: () => {
        toast.success("Cobertura aplicada al tratamiento");
        void queryClient.invalidateQueries({
          queryKey: ["family-policies", patientId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["family-policy-detail", patientId, policyNumber],
        });
        void queryClient.invalidateQueries({
          queryKey: ["treatment-plans", { patientId }],
        });
      },
      onError: (error: Error) => toast.error(error.message),
    }),
  };
}

export function usePatientPolicies(patientId: string, enabled = true) {
  return useQuery({
    queryKey: ["family-policies", patientId],
    queryFn: () => listPatientPolicies(patientId),
    enabled,
  });
}

export function usePatientPolicyDetail(
  patientId: string,
  policyNumber?: string,
) {
  return useQuery({
    queryKey: ["family-policy-detail", patientId, policyNumber],
    queryFn: () => getPatientPolicyDetail(patientId, policyNumber as string),
    enabled: Boolean(patientId && policyNumber),
  });
}

export function useFamilyPolicyMutations(patientId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["family-policies", patientId] });
  return {
    create: useMutation({
      mutationFn: createFamilyPolicy,
      onSuccess: () => {
        toast.success("Borrador de póliza creado");
        void refresh();
      },
      onError: (error: Error) => toast.error(error.message),
    }),
    pay: useMutation({
      mutationFn: ({
        policyNumber,
        payload,
      }: {
        policyNumber: string;
        payload: Parameters<typeof registerFamilyPolicyPayment>[1];
      }) => registerFamilyPolicyPayment(policyNumber, payload),
      onSuccess: (policy) => {
        toast.success(
          policy.status === "ACTIVE"
            ? "Pago registrado y póliza activada"
            : "Pago parcial registrado",
        );
        void refresh();
      },
      onError: (error: Error) => toast.error(error.message),
    }),
  };
}
