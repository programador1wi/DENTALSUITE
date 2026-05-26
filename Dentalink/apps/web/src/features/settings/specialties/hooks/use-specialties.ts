import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSpecialtyAppointmentReason,
  createSpecialtyClinicalTemplate,
  createSpecialty,
  deactivateSpecialty,
  listSpecialtyAppointmentReasons,
  listSpecialtyClinicalTemplates,
  listSpecialties,
  updateSpecialtyAppointmentReason,
  updateSpecialtyClinicalTemplate,
  updateSpecialty,
  type SpecialtyAppointmentReasonPayload,
  type SpecialtyClinicalTemplatePayload,
  type SpecialtyClinicalTemplateType,
  type SpecialtyPayload
} from "../services/specialties.service";

export function useSpecialties(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "specialties", search, active],
    queryFn: () => listSpecialties({ search, active })
  });
}

export function useCreateSpecialty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SpecialtyPayload) => createSpecialty(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "specialties"] })
  });
}

export function useUpdateSpecialty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SpecialtyPayload> & { isActive?: boolean } }) =>
      updateSpecialty(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "specialties"] })
  });
}

export function useDeactivateSpecialty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSpecialty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "specialties"] })
  });
}

export function useSpecialtyClinicalTemplates(specialtyId?: string, type?: SpecialtyClinicalTemplateType) {
  return useQuery({
    queryKey: ["settings", "specialties", specialtyId, "clinical-templates", type],
    queryFn: () => listSpecialtyClinicalTemplates(specialtyId ?? "", { type }),
    enabled: Boolean(specialtyId)
  });
}

export function useCreateSpecialtyClinicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ specialtyId, payload }: { specialtyId: string; payload: SpecialtyClinicalTemplatePayload }) =>
      createSpecialtyClinicalTemplate(specialtyId, payload),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ["settings", "specialties", variables.specialtyId, "clinical-templates"] })
  });
}

export function useUpdateSpecialtyClinicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      specialtyId,
      templateId,
      payload
    }: {
      specialtyId: string;
      templateId: string;
      payload: Partial<Omit<SpecialtyClinicalTemplatePayload, "type">> & { isActive?: boolean };
    }) => updateSpecialtyClinicalTemplate(specialtyId, templateId, payload),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ["settings", "specialties", variables.specialtyId, "clinical-templates"] })
  });
}

export function useSpecialtyAppointmentReasons(specialtyId?: string) {
  return useQuery({
    queryKey: ["settings", "specialties", specialtyId, "appointment-reasons"],
    queryFn: () => listSpecialtyAppointmentReasons(specialtyId ?? ""),
    enabled: Boolean(specialtyId)
  });
}

export function useCreateSpecialtyAppointmentReason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ specialtyId, payload }: { specialtyId: string; payload: SpecialtyAppointmentReasonPayload }) =>
      createSpecialtyAppointmentReason(specialtyId, payload),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ["settings", "specialties", variables.specialtyId, "appointment-reasons"] })
  });
}

export function useUpdateSpecialtyAppointmentReason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      specialtyId,
      reasonId,
      payload
    }: {
      specialtyId: string;
      reasonId: string;
      payload: Partial<SpecialtyAppointmentReasonPayload> & { isActive?: boolean };
    }) => updateSpecialtyAppointmentReason(specialtyId, reasonId, payload),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ["settings", "specialties", variables.specialtyId, "appointment-reasons"] })
  });
}
