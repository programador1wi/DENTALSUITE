import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClinicalDocumentTemplate,
  deactivateClinicalDocumentTemplate,
  listClinicalDocumentTemplates,
  updateClinicalDocumentTemplate,
  type ClinicalDocumentTemplatePayload
} from "../services/clinical-document-templates.service";

export function useClinicalDocumentTemplatesSettings(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "clinical-document-templates", search, active],
    queryFn: () => listClinicalDocumentTemplates({ search, active })
  });
}

function useInvalidateClinicalDocumentTemplates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["settings", "clinical-document-templates"] });
    queryClient.invalidateQueries({ queryKey: ["clinical"] });
  };
}

export function useCreateClinicalDocumentTemplateSettings() {
  const invalidate = useInvalidateClinicalDocumentTemplates();
  return useMutation({ mutationFn: createClinicalDocumentTemplate, onSuccess: invalidate });
}

export function useUpdateClinicalDocumentTemplateSettings() {
  const invalidate = useInvalidateClinicalDocumentTemplates();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ClinicalDocumentTemplatePayload> & { isActive?: boolean } }) =>
      updateClinicalDocumentTemplate(id, payload),
    onSuccess: invalidate
  });
}

export function useDeactivateClinicalDocumentTemplateSettings() {
  const invalidate = useInvalidateClinicalDocumentTemplates();
  return useMutation({ mutationFn: deactivateClinicalDocumentTemplate, onSuccess: invalidate });
}
