import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addConsentSignature,
  createConsentTemplate,
  createConsentTemplateVersion,
  createPatientConsent,
  deactivateConsentTemplate,
  deletePatientFile,
  downloadConsentPdf,
  duplicateConsentTemplate,
  finalizeConsent,
  getConsentAudit,
  getConsentEvidence,
  getPatientRadiographyAnalysis,
  listConsentTemplateAudit,
  listConsentTemplates,
  listConsentTemplateVersions,
  listConsentVariables,
  listPatientConsents,
  listPatientFiles,
  previewConsentTemplate,
  publishConsentTemplate,
  savePatientRadiographyAnalysis,
  updateConsentFields,
  updateConsentTemplate,
  uploadPatientBinaryFile,
  uploadPatientFile,
  voidConsent,
  type Consent,
  type ConsentTemplate,
  type ConsentTemplateDraft,
  type FileAttachment
} from "../services/documents.service";

export function usePatientFiles(patientId: string, category?: string, treatmentPlanId?: string) {
  return useQuery({
    queryKey: ["patient-files", patientId, category, treatmentPlanId],
    queryFn: () => listPatientFiles(patientId, { category: category || undefined, treatmentPlanId: treatmentPlanId || undefined }),
    enabled: Boolean(patientId)
  });
}

export function useConsentTemplates(params: {
  search?: string;
  status?: ConsentTemplate["status"];
  branchId?: string;
  scopeType?: ConsentTemplate["scopeType"];
} = {}) {
  return useQuery({
    queryKey: ["consent-templates", params],
    queryFn: () => listConsentTemplates(params)
  });
}

export function useConsentVariables() {
  return useQuery({
    queryKey: ["consent-variables"],
    queryFn: listConsentVariables,
    staleTime: 30 * 60 * 1000
  });
}

export function usePatientConsents(patientId: string, status?: Consent["status"]) {
  return useQuery({
    queryKey: ["patient-consents", patientId, status],
    queryFn: () => listPatientConsents(patientId, { status }),
    enabled: Boolean(patientId)
  });
}

export function useConsentTemplateVersions(templateId: string) {
  return useQuery({
    queryKey: ["consent-template-versions", templateId],
    queryFn: () => listConsentTemplateVersions(templateId),
    enabled: Boolean(templateId)
  });
}

export function useConsentTemplateAudit(templateId: string) {
  return useQuery({
    queryKey: ["consent-template-audit", templateId],
    queryFn: () => listConsentTemplateAudit(templateId),
    enabled: Boolean(templateId)
  });
}

export function useConsentEvidence(consentId: string) {
  return useQuery({
    queryKey: ["consent-evidence", consentId],
    queryFn: () => getConsentEvidence(consentId),
    enabled: Boolean(consentId)
  });
}

export function useConsentAudit(consentId: string) {
  return useQuery({
    queryKey: ["consent-audit", consentId],
    queryFn: () => getConsentAudit(consentId),
    enabled: Boolean(consentId)
  });
}

export function usePatientRadiographyAnalysis(patientId: string, fileId?: string) {
  return useQuery({
    queryKey: ["patient-radiography-analysis", patientId, fileId],
    queryFn: () => getPatientRadiographyAnalysis(patientId, fileId ?? ""),
    enabled: Boolean(patientId && fileId)
  });
}

export function useRadiographyAnalysisMutations() {
  const queryClient = useQueryClient();
  const onError = (error: Error) => toast.error(error.message);

  return {
    savePatientRadiographyAnalysis: useMutation({
      mutationFn: ({
        patientId,
        fileId,
        findings,
        status
      }: {
        patientId: string;
        fileId: string;
        findings: Parameters<typeof savePatientRadiographyAnalysis>[2]["findings"];
        status?: "DRAFT" | "CONFIRMED";
      }) => savePatientRadiographyAnalysis(patientId, fileId, { findings, status }),
      onSuccess: (analysis, variables) => {
        toast.success("Análisis RX guardado");
        queryClient.setQueryData(["patient-radiography-analysis", variables.patientId, variables.fileId], analysis);
      },
      onError
    })
  };
}

export function useDocumentsMutations() {
  const queryClient = useQueryClient();
  const invalidateConsents = () => {
    queryClient.invalidateQueries({ queryKey: ["consent-templates"] });
    queryClient.invalidateQueries({ queryKey: ["consent-template-versions"] });
    queryClient.invalidateQueries({ queryKey: ["consent-template-audit"] });
    queryClient.invalidateQueries({ queryKey: ["patient-consents"] });
    queryClient.invalidateQueries({ queryKey: ["consent-evidence"] });
    queryClient.invalidateQueries({ queryKey: ["consent-audit"] });
  };
  const upsertPatientFile = (patientId: string, file: FileAttachment) => {
    queryClient.setQueryData<FileAttachment[]>(["patient-files", patientId, undefined], (current) => {
      if (!current) return [file];
      return [file, ...current.filter((item) => item.id !== file.id)];
    });
    queryClient.invalidateQueries({ queryKey: ["patient-files", patientId] });
  };
  const onError = (error: Error) => toast.error(error.message);

  return {
    uploadPatientFile: useMutation({
      mutationFn: ({
        patientId,
        fileName,
        originalName,
        mimeType,
        size,
        url,
        category,
        treatmentPlanId
      }: {
        patientId: string;
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
        category: string;
        treatmentPlanId?: string;
      }) => uploadPatientFile(patientId, { fileName, originalName, mimeType, size, url, category, treatmentPlanId }),
      onSuccess: (file, variables) => {
        toast.success("Archivo registrado");
        upsertPatientFile(variables.patientId, file);
      },
      onError
    }),
    uploadPatientBinaryFile: useMutation({
      mutationFn: ({ patientId, file, category, treatmentPlanId }: { patientId: string; file: File; category: string; treatmentPlanId?: string }) =>
        uploadPatientBinaryFile(patientId, { file, category, treatmentPlanId }),
      onSuccess: (file, variables) => {
        toast.success("Archivo subido");
        upsertPatientFile(variables.patientId, file);
      },
      onError
    }),
    deletePatientFile: useMutation({
      mutationFn: ({ patientId, fileId, reason }: { patientId: string; fileId: string; reason: string }) =>
        deletePatientFile(patientId, fileId, { reason }),
      onSuccess: (_, variables) => {
        toast.success("Archivo eliminado");
        queryClient.setQueryData<FileAttachment[]>(["patient-files", variables.patientId, undefined], (current) => {
          return current?.filter((item) => item.id !== variables.fileId) || [];
        });
        queryClient.invalidateQueries({ queryKey: ["patient-files", variables.patientId] });
      },
      onError
    }),
    previewConsentTemplate: useMutation({
      mutationFn: previewConsentTemplate,
      onError
    }),
    createConsentTemplate: useMutation({
      mutationFn: createConsentTemplate,
      onSuccess: () => {
        toast.success("Borrador creado");
        invalidateConsents();
      },
      onError
    }),
    updateConsentTemplate: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: ConsentTemplateDraft & { expectedVersion: number } }) =>
        updateConsentTemplate(id, payload),
      onSuccess: () => {
        toast.success("Borrador guardado");
        invalidateConsents();
      },
      onError
    }),
    publishConsentTemplate: useMutation({
      mutationFn: ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        publishConsentTemplate(id, expectedVersion),
      onSuccess: () => {
        toast.success("Versión publicada");
        invalidateConsents();
      },
      onError
    }),
    newConsentTemplateVersion: useMutation({
      mutationFn: ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        createConsentTemplateVersion(id, expectedVersion),
      onSuccess: () => {
        toast.success("Nueva versión en borrador creada");
        invalidateConsents();
      },
      onError
    }),
    duplicateConsentTemplate: useMutation({
      mutationFn: duplicateConsentTemplate,
      onSuccess: () => {
        toast.success("Plantilla duplicada");
        invalidateConsents();
      },
      onError
    }),
    deactivateConsentTemplate: useMutation({
      mutationFn: ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        deactivateConsentTemplate(id, expectedVersion),
      onSuccess: () => {
        toast.success("Plantilla deshabilitada");
        invalidateConsents();
      },
      onError
    }),
    createPatientConsent: useMutation({
      mutationFn: ({ patientId, ...payload }: Parameters<typeof createPatientConsent>[1] & { patientId: string }) =>
        createPatientConsent(patientId, payload),
      onSuccess: () => {
        toast.success("Consentimiento generado");
        invalidateConsents();
      },
      onError
    }),
    updateConsentFields: useMutation({
      mutationFn: ({ consentId, values, expectedVersion }: { consentId: string; values: Record<string, unknown>; expectedVersion: number }) =>
        updateConsentFields(consentId, values, expectedVersion),
      onSuccess: () => {
        toast.success("Datos del consentimiento actualizados");
        invalidateConsents();
      },
      onError
    }),
    addConsentSignature: useMutation({
      mutationFn: ({ consentId, payload }: { consentId: string; payload: Parameters<typeof addConsentSignature>[1] }) =>
        addConsentSignature(consentId, payload),
      onSuccess: () => {
        toast.success("Firma registrada con evidencia");
        invalidateConsents();
      },
      onError
    }),
    finalizeConsent: useMutation({
      mutationFn: ({ consentId, expectedVersion, documentHash }: { consentId: string; expectedVersion: number; documentHash: string }) =>
        finalizeConsent(consentId, expectedVersion, documentHash),
      onSuccess: () => {
        toast.success("Consentimiento finalizado");
        invalidateConsents();
      },
      onError
    }),
    voidConsent: useMutation({
      mutationFn: ({
        consentId,
        expectedVersion,
        reason,
        currentPassword
      }: {
        consentId: string;
        expectedVersion: number;
        reason: string;
        currentPassword: string;
      }) => voidConsent(consentId, expectedVersion, reason, currentPassword),
      onSuccess: () => {
        toast.success("Consentimiento anulado; original conservado");
        invalidateConsents();
      },
      onError
    }),
    downloadConsentPdf: useMutation({
      mutationFn: async ({ consentId, fileName }: { consentId: string; fileName: string }) => {
        const blob = await downloadConsentPdf(consentId);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      onSuccess: () => toast.success("PDF descargado"),
      onError
    })
  };
}
