import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createConsentTemplate,
  createPatientConsent,
  deactivateConsentTemplate,
  getConsentPdf,
  getPatientRadiographyAnalysis,
  listConsentTemplates,
  listPatientConsents,
  listPatientFiles,
  deletePatientFile,
  savePatientRadiographyAnalysis,
  signConsent,
  updateConsentTemplate,
  uploadPatientBinaryFile,
  uploadPatientFile,
  type FileAttachment
} from "../services/documents.service";

export function usePatientFiles(patientId: string, category?: string) {
  return useQuery({
    queryKey: ["patient-files", patientId, category],
    queryFn: () => listPatientFiles(patientId, { category: category || undefined }),
    enabled: Boolean(patientId)
  });
}

export function useConsentTemplates(search?: string, active?: string) {
  return useQuery({
    queryKey: ["consent-templates", search, active],
    queryFn: () => listConsentTemplates({ search, active })
  });
}

export function usePatientConsents(patientId: string, status?: "DRAFT" | "SIGNED" | "CANCELLED") {
  return useQuery({
    queryKey: ["patient-consents", patientId, status],
    queryFn: () => listPatientConsents(patientId, { status }),
    enabled: Boolean(patientId)
  });
}

export function useConsentPdf(consentId: string) {
  return useQuery({
    queryKey: ["consent-pdf", consentId],
    queryFn: () => getConsentPdf(consentId),
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
        toast.success("Analisis RX guardado");
        queryClient.setQueryData(["patient-radiography-analysis", variables.patientId, variables.fileId], analysis);
      },
      onError
    })
  };
}

export function useDocumentsMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["patient-files"] });
    queryClient.invalidateQueries({ queryKey: ["consent-templates"] });
    queryClient.invalidateQueries({ queryKey: ["patient-consents"] });
    queryClient.invalidateQueries({ queryKey: ["consent-pdf"] });
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
        category
      }: {
        patientId: string;
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
        category: string;
      }) => uploadPatientFile(patientId, { fileName, originalName, mimeType, size, url, category }),
      onSuccess: (file, variables) => {
        toast.success("Archivo registrado");
        upsertPatientFile(variables.patientId, file);
      },
      onError
    }),
    uploadPatientBinaryFile: useMutation({
      mutationFn: ({ patientId, file, category }: { patientId: string; file: File; category: string }) =>
        uploadPatientBinaryFile(patientId, { file, category }),
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
    createConsentTemplate: useMutation({
      mutationFn: createConsentTemplate,
      onSuccess: () => {
        toast.success("Plantilla creada");
        invalidate();
      },
      onError
    }),
    updateConsentTemplate: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: Partial<{ name: string; content: string; procedureId: string | null; isActive: boolean }>;
      }) => updateConsentTemplate(id, payload),
      onSuccess: () => {
        toast.success("Plantilla actualizada");
        invalidate();
      },
      onError
    }),
    deactivateConsentTemplate: useMutation({
      mutationFn: (id: string) => deactivateConsentTemplate(id),
      onSuccess: () => {
        toast.success("Plantilla desactivada");
        invalidate();
      },
      onError
    }),
    createPatientConsent: useMutation({
      mutationFn: ({
        patientId,
        templateId,
        treatmentPlanId,
        appointmentId
      }: {
        patientId: string;
        templateId: string;
        treatmentPlanId?: string;
        appointmentId?: string;
      }) => createPatientConsent(patientId, { templateId, treatmentPlanId, appointmentId }),
      onSuccess: () => {
        toast.success("Consentimiento generado");
        invalidate();
      },
      onError
    }),
    signConsent: useMutation({
      mutationFn: ({
        consentId,
        signerName,
        signerType,
        signatureData,
        ipAddress
      }: {
        consentId: string;
        signerName: string;
        signerType: string;
        signatureData: string;
        ipAddress?: string;
      }) => signConsent(consentId, { signerName, signerType, signatureData, ipAddress }),
      onSuccess: () => {
        toast.success("Consentimiento firmado");
        invalidate();
      },
      onError
    })
  };
}
