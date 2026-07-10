import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAiRequest,
  createChatMessage,
  createCommunicationJob,
  createDocumentRequirement,
  createImportJob,
  createSurvey,
  createTelemedicineSession,
  listAiRequests,
  listChatMessages,
  listCommunicationJobs,
  listDocumentRequirements,
  listImportJobs,
  listPaymentWebhookEvents,
  listSurveys,
  listTelemedicineSessions,
  queueCommunicationJob,
  recordMessageDelivery,
  satisfyDocumentRequirement,
  sendSurvey,
  updateImportJob,
  updateTelemedicineStatus,
  waiveDocumentRequirement,
  type AiRequestStatus,
  type AiUseCase,
  type CommunicationChannel,
  type CommunicationJobStatus,
  type CreateAiRequestPayload,
  type CreateChatMessagePayload,
  type CreateCommunicationJobPayload,
  type CreateDocumentRequirementPayload,
  type CreateImportJobPayload,
  type CreateSurveyPayload,
  type CreateTelemedicineSessionPayload,
  type DocumentRequirementStatus,
  type ImportJobStatus,
  type ImportJobType,
  type MessageDeliveryStatus,
  type SurveyStatus,
  type SurveyType,
  type TelemedicineSessionStatus,
  type UpdateImportJobPayload
} from "../services/integrations.service";

export function useCommunicationJobs(params?: {
  status?: CommunicationJobStatus;
  channel?: CommunicationChannel;
  patientId?: string;
}) {
  return useQuery({
    queryKey: ["integrations", "communication-jobs", params],
    queryFn: () => listCommunicationJobs(params)
  });
}

export function useSurveys(params?: { status?: SurveyStatus; type?: SurveyType; patientId?: string }) {
  return useQuery({
    queryKey: ["integrations", "surveys", params],
    queryFn: () => listSurveys(params)
  });
}

export function useChatMessages(params?: { patientId?: string; threadKey?: string }) {
  return useQuery({
    queryKey: ["integrations", "chat", params],
    queryFn: () => listChatMessages(params)
  });
}

export function useTelemedicineSessions(params?: { status?: TelemedicineSessionStatus; patientId?: string }) {
  return useQuery({
    queryKey: ["integrations", "telemedicine", params],
    queryFn: () => listTelemedicineSessions(params)
  });
}

export function useImportJobs(params?: { type?: ImportJobType; status?: ImportJobStatus }) {
  return useQuery({
    queryKey: ["integrations", "import-jobs", params],
    queryFn: () => listImportJobs(params)
  });
}

export function useDocumentRequirements(params?: { status?: DocumentRequirementStatus; patientId?: string }) {
  return useQuery({
    queryKey: ["integrations", "document-requirements", params],
    queryFn: () => listDocumentRequirements(params)
  });
}

export function usePaymentWebhookEvents(params?: { provider?: string; paymentLinkId?: string }) {
  return useQuery({
    queryKey: ["integrations", "payment-webhooks", params],
    queryFn: () => listPaymentWebhookEvents(params)
  });
}

export function useAiRequests(params?: { useCase?: AiUseCase; status?: AiRequestStatus; patientId?: string }) {
  return useQuery({
    queryKey: ["integrations", "ai-requests", params],
    queryFn: () => listAiRequests(params)
  });
}

export function useIntegrationMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["integrations"] });
  const onError = (error: Error) => toast.error(error.message);

  return {
    createCommunicationJob: useMutation({
      mutationFn: (payload: CreateCommunicationJobPayload) => createCommunicationJob(payload),
      onSuccess: invalidate,
      onError
    }),
    queueCommunicationJob: useMutation({
      mutationFn: (id: string) => queueCommunicationJob(id),
      onSuccess: invalidate,
      onError
    }),
    recordMessageDelivery: useMutation({
      mutationFn: ({ id, status }: { id: string; status: MessageDeliveryStatus }) => recordMessageDelivery(id, status),
      onSuccess: invalidate,
      onError
    }),
    createSurvey: useMutation({
      mutationFn: (payload: CreateSurveyPayload) => createSurvey(payload),
      onSuccess: invalidate,
      onError
    }),
    sendSurvey: useMutation({
      mutationFn: (id: string) => sendSurvey(id),
      onSuccess: invalidate,
      onError
    }),
    createChatMessage: useMutation({
      mutationFn: (payload: CreateChatMessagePayload) => createChatMessage(payload),
      onSuccess: invalidate,
      onError
    }),
    createTelemedicineSession: useMutation({
      mutationFn: (payload: CreateTelemedicineSessionPayload) => createTelemedicineSession(payload),
      onSuccess: invalidate,
      onError
    }),
    updateTelemedicineStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: TelemedicineSessionStatus }) =>
        updateTelemedicineStatus(id, status),
      onSuccess: invalidate,
      onError
    }),
    createImportJob: useMutation({
      mutationFn: (payload: CreateImportJobPayload) => createImportJob(payload),
      onSuccess: invalidate,
      onError
    }),
    updateImportJob: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: UpdateImportJobPayload }) => updateImportJob(id, payload),
      onSuccess: invalidate,
      onError
    }),
    createDocumentRequirement: useMutation({
      mutationFn: (payload: CreateDocumentRequirementPayload) => createDocumentRequirement(payload),
      onSuccess: invalidate,
      onError
    }),
    satisfyDocumentRequirement: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: { clinicalDocumentId?: string; consentId?: string; fileAttachmentId?: string };
      }) => satisfyDocumentRequirement(id, payload),
      onSuccess: invalidate,
      onError
    }),
    waiveDocumentRequirement: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => waiveDocumentRequirement(id, reason),
      onSuccess: invalidate,
      onError
    }),
    createAiRequest: useMutation({
      mutationFn: (payload: CreateAiRequestPayload) => createAiRequest(payload),
      onSuccess: invalidate,
      onError
    })
  };
}
