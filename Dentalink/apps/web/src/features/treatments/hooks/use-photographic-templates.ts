import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  completePhotographicSession,
  createMobilePhotographicUpload,
  createPhotographicLink,
  createPhotographicSession,
  dismissPhotographicReminder,
  listPhotographicAvailableLinks,
  listPhotographicTemplates,
  removePhotographicLink,
  updatePhotographicImageTransformations,
  updatePhotographicPolicy,
  updatePhotographicSession,
  updatePhotographicSlot,
  uploadPhotographicImage,
  voidPhotographicImage,
  voidPhotographicSession,
  type CreatePhotographicSessionPayload,
  type PhotographicFrequency,
  type PhotographicImageTransformations,
  type PhotographicLinkedEntityType
} from "../services/photographic-templates.service";

export function usePhotographicTemplates(treatmentPlanId: string, enabled = true, polling = false) {
  return useQuery({
    queryKey: ["photographic-templates", treatmentPlanId],
    queryFn: () => listPhotographicTemplates(treatmentPlanId),
    enabled: Boolean(treatmentPlanId) && enabled,
    refetchInterval: polling ? 3000 : false
  });
}

export function usePhotographicAvailableLinks(treatmentPlanId: string, enabled = true) {
  return useQuery({
    queryKey: ["photographic-links", treatmentPlanId],
    queryFn: () => listPhotographicAvailableLinks(treatmentPlanId),
    enabled: Boolean(treatmentPlanId) && enabled
  });
}

export function usePhotographicTemplateMutations(treatmentPlanId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["photographic-templates", treatmentPlanId] });
  const onError = (error: Error) => toast.error(error.message);

  return {
    createSession: useMutation({
      mutationFn: (payload: CreatePhotographicSessionPayload) =>
        createPhotographicSession(treatmentPlanId, payload),
      onSuccess: () => {
        toast.success("Plantilla fotografica creada");
        refresh();
      },
      onError
    }),
    updateSession: useMutation({
      mutationFn: ({
        sessionId,
        payload
      }: {
        sessionId: string;
        payload: Partial<CreatePhotographicSessionPayload> & { version: number };
      }) => updatePhotographicSession(sessionId, payload),
      onSuccess: () => {
        toast.success("Plantilla actualizada");
        refresh();
      },
      onError
    }),
    uploadImage: useMutation({
      mutationFn: uploadPhotographicImage,
      onSuccess: () => {
        toast.success("Fotografia procesada");
        refresh();
      },
      onError
    }),
    editImage: useMutation({
      mutationFn: ({
        imageId,
        version,
        transformations
      }: {
        imageId: string;
        version: number;
        transformations: PhotographicImageTransformations;
      }) => updatePhotographicImageTransformations(imageId, { version, ...transformations }),
      onSuccess: () => {
        toast.success("Edicion no destructiva guardada");
        refresh();
      },
      onError
    }),
    voidImage: useMutation({
      mutationFn: ({ imageId, version, reason }: { imageId: string; version: number; reason: string }) =>
        voidPhotographicImage(imageId, { version, reason }),
      onSuccess: () => {
        toast.success("Fotografia anulada; original conservado");
        refresh();
      },
      onError
    }),
    completeSession: useMutation({
      mutationFn: ({ sessionId, version }: { sessionId: string; version: number }) =>
        completePhotographicSession(sessionId, version),
      onSuccess: () => {
        toast.success("Plantilla marcada como completa");
        refresh();
      },
      onError
    }),
    voidSession: useMutation({
      mutationFn: ({ sessionId, version, reason }: { sessionId: string; version: number; reason: string }) =>
        voidPhotographicSession(sessionId, { version, reason }),
      onSuccess: () => {
        toast.success("Plantilla anulada; imagenes conservadas");
        refresh();
      },
      onError
    }),
    createLink: useMutation({
      mutationFn: ({
        sessionId,
        linkedEntityType,
        linkedEntityId
      }: {
        sessionId: string;
        linkedEntityType: PhotographicLinkedEntityType;
        linkedEntityId: string;
      }) => createPhotographicLink(sessionId, { linkedEntityType, linkedEntityId }),
      onSuccess: () => {
        toast.success("Vinculo clinico creado");
        refresh();
      },
      onError
    }),
    removeLink: useMutation({
      mutationFn: ({ linkId, reason }: { linkId: string; reason: string }) =>
        removePhotographicLink(linkId, reason),
      onSuccess: () => {
        toast.success("Vinculo retirado");
        refresh();
      },
      onError
    }),
    updatePolicy: useMutation({
      mutationFn: ({
        frequency,
        customIntervalDays
      }: {
        frequency: PhotographicFrequency;
        customIntervalDays?: number | null;
      }) => updatePhotographicPolicy(treatmentPlanId, { frequency, customIntervalDays }),
      onSuccess: () => {
        toast.success("Frecuencia fotografica actualizada");
        refresh();
      },
      onError
    }),
    updateSlot: useMutation({
      mutationFn: ({
        slotId,
        version,
        label,
        isRequired
      }: {
        slotId: string;
        version: number;
        label: string;
        isRequired: boolean;
      }) => updatePhotographicSlot(slotId, { version, label, isRequired }),
      onSuccess: () => {
        toast.success("Posicion fotografica actualizada");
        refresh();
      },
      onError
    }),
    dismissReminder: useMutation({
      mutationFn: (until?: string) => dismissPhotographicReminder(treatmentPlanId, until),
      onSuccess: refresh,
      onError
    }),
    createMobileUpload: useMutation({
      mutationFn: createMobilePhotographicUpload,
      onError
    })
  };
}
