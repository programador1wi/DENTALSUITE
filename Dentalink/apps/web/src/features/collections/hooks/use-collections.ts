import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCollectionActivity,
  assignCollectionCase,
  createCollectionCase,
  detectOverdueCases,
  getCollectionCase,
  listCollectionCases,
  updateCollectionCaseStatus,
  type CollectionCaseStatus
} from "../services/collections.service";

export function useCollectionCases(params?: {
  patientId?: string;
  assignedToId?: string;
  branchId?: string;
  status?: CollectionCaseStatus;
}) {
  return useQuery({
    queryKey: ["collections", params],
    queryFn: () => listCollectionCases(params)
  });
}

export function useCollectionCase(id: string) {
  return useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollectionCase(id),
    enabled: Boolean(id)
  });
}

export function useCollectionMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["collections"] });
    queryClient.invalidateQueries({ queryKey: ["collection"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  return {
    detectOverdue: useMutation({
      mutationFn: detectOverdueCases,
      onSuccess: (result) => {
        toast.success(`Deteccion completada: ${result.created} casos nuevos`);
        invalidate();
      },
      onError
    }),
    createCase: useMutation({
      mutationFn: createCollectionCase,
      onSuccess: () => {
        toast.success("Caso creado");
        invalidate();
      },
      onError
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: CollectionCaseStatus }) => updateCollectionCaseStatus(id, status),
      onSuccess: () => {
        toast.success("Estado actualizado");
        invalidate();
      },
      onError
    }),
    assignCase: useMutation({
      mutationFn: ({ id, assignedToId }: { id: string; assignedToId: string }) => assignCollectionCase(id, assignedToId),
      onSuccess: () => {
        toast.success("Caso asignado");
        invalidate();
      },
      onError
    }),
    addActivity: useMutation({
      mutationFn: ({
        id,
        channel,
        result,
        notes,
        nextActionAt
      }: {
        id: string;
        channel: string;
        result: string;
        notes?: string;
        nextActionAt?: string;
      }) => addCollectionActivity(id, { channel, result, notes, nextActionAt }),
      onSuccess: () => {
        toast.success("Actividad registrada");
        invalidate();
      },
      onError
    })
  };
}
