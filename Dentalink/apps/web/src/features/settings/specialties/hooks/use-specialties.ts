import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
  type SpecialtyClinicalTemplate,
  type SpecialtyClinicalTemplatePayload,
  type SpecialtyClinicalTemplateType,
  type SpecialtyPayload
} from "../services/specialties.service";

type SpecialtyReference = { id: string; name: string };

export type SpecialtyClinicalTemplateWithSpecialty = SpecialtyClinicalTemplate & {
  specialtyName: string;
};

export function useSpecialties(search?: string, active?: string, enabled = true) {
  return useQuery({
    queryKey: ["settings", "specialties", search, active],
    queryFn: () => listSpecialties({ search, active }),
    enabled
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

export function useSpecialtyClinicalTemplatesForSpecialties(
  specialties: SpecialtyReference[],
  type: SpecialtyClinicalTemplateType
) {
  const uniqueSpecialties = useMemo(() => {
    const seen = new Set<string>();
    return specialties.filter((specialty) => {
      if (!specialty.id || seen.has(specialty.id)) return false;
      seen.add(specialty.id);
      return true;
    });
  }, [specialties]);

  const queries = useQueries({
    queries: uniqueSpecialties.map((specialty) => ({
      queryKey: ["settings", "specialties", specialty.id, "clinical-templates", type, "active"],
      queryFn: () => listSpecialtyClinicalTemplates(specialty.id, { type, active: "true" }),
      enabled: Boolean(specialty.id)
    }))
  });

  const data = useMemo<SpecialtyClinicalTemplateWithSpecialty[]>(() => {
    return queries.flatMap((query, index) => {
      const specialty = uniqueSpecialties[index];
      if (!specialty) return [];
      return (query.data ?? [])
        .filter((template) => template.isActive)
        .map((template) => ({
          ...template,
          specialtyName: specialty.name
        }));
    });
  }, [queries, uniqueSpecialties]);

  return {
    data,
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error as Error | null | undefined
  };
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
