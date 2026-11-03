import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addFamilyContact,
  addFamilyMember,
  createFamilyMemberPatient,
  createFamilyGrant,
  createFamilyGroup,
  getPatientIdentity,
  getPatientIdentityConfig,
  linkPatientPhone,
  updateFamilyMember,
  updatePatientIdentityConfig
} from "../services/patient-identity.service";

export function usePatientIdentity(patientId?: string) {
  return useQuery({
    queryKey: ["patient-identity", patientId],
    queryFn: () => getPatientIdentity(patientId as string),
    enabled: Boolean(patientId)
  });
}

export function usePatientIdentityConfig(enabled = true) {
  return useQuery({ queryKey: ["patient-identity-config"], queryFn: getPatientIdentityConfig, enabled });
}

export function usePatientIdentityConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePatientIdentityConfig,
    onSuccess: () => {
      toast.success("Configuración de identidad actualizada");
      void queryClient.invalidateQueries({ queryKey: ["patient-identity-config"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function usePatientIdentityMutations(patientId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["patient-identity", patientId] });
  const success = (message: string) => {
    toast.success(message);
    void refresh();
  };
  const failure = (error: Error) => toast.error(error.message);

  return {
    linkPhone: useMutation({
      mutationFn: linkPatientPhone,
      onSuccess: () => success("Medio de contacto vinculado"),
      onError: failure
    }),
    createGroup: useMutation({
      mutationFn: createFamilyGroup,
      onSuccess: () => success("Grupo familiar creado"),
      onError: failure
    }),
    addMember: useMutation({
      mutationFn: ({
        groupId,
        payload
      }: {
        groupId: string;
        payload: Parameters<typeof addFamilyMember>[1];
      }) => addFamilyMember(groupId, payload),
      onSuccess: () => success("Integrante agregado"),
      onError: failure
    }),
    createMemberPatient: useMutation({
      mutationFn: ({
        groupId,
        payload
      }: {
        groupId: string;
        payload: Parameters<typeof createFamilyMemberPatient>[1];
      }) => createFamilyMemberPatient(groupId, payload),
      onSuccess: () => success("Integrante nuevo creado"),
      onError: failure
    }),
    updateMember: useMutation({
      mutationFn: ({
        groupId,
        memberId,
        payload
      }: {
        groupId: string;
        memberId: string;
        payload: Parameters<typeof updateFamilyMember>[2];
      }) => updateFamilyMember(groupId, memberId, payload),
      onSuccess: () => success("Consentimiento familiar actualizado"),
      onError: failure
    }),
    addContact: useMutation({
      mutationFn: ({
        groupId,
        payload
      }: {
        groupId: string;
        payload: Parameters<typeof addFamilyContact>[1];
      }) => addFamilyContact(groupId, payload),
      onSuccess: () => success("Contacto familiar agregado"),
      onError: failure
    }),
    grant: useMutation({
      mutationFn: ({
        groupId,
        payload
      }: {
        groupId: string;
        payload: Parameters<typeof createFamilyGrant>[1];
      }) => createFamilyGrant(groupId, payload),
      onSuccess: () => success("Permiso de agendamiento actualizado"),
      onError: failure
    })
  };
}
