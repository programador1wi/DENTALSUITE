import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelCrmTask,
  completeCrmTask,
  createCrmTask,
  getCrmTask,
  getCrmTaskConfiguration,
  getCrmTaskHistory,
  getCrmTaskStatistics,
  listCrmTasks,
  reopenCrmTask,
  updateCrmTask,
  updateCrmTaskConfiguration,
  type CrmTaskConfigurationInput,
  type CrmTaskPayload,
  type CrmTasksQuery
} from "../services/crm-tasks.service";

export function useCrmTasks(params: CrmTasksQuery, enabled = true) {
  return useQuery({
    queryKey: ["crm-tasks", "list", params.branchId, params],
    queryFn: () => listCrmTasks(params),
    enabled: enabled && Boolean(params.branchId),
    placeholderData: (previous) => previous
  });
}

export function useCrmTask(id?: string) {
  return useQuery({
    queryKey: ["crm-tasks", "detail", id],
    queryFn: () => getCrmTask(id as string),
    enabled: Boolean(id)
  });
}

export function useCrmTaskHistory(id?: string) {
  return useQuery({
    queryKey: ["crm-tasks", "history", id],
    queryFn: () => getCrmTaskHistory(id as string),
    enabled: Boolean(id)
  });
}

export function useCrmTaskMutations(branchId: string) {
  const queryClient = useQueryClient();
  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ["crm-tasks", "list", branchId] });
    queryClient.invalidateQueries({ queryKey: ["crm-tasks", "statistics", branchId] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: ["crm-tasks", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["crm-tasks", "history", id] });
    }
  };
  const error = (value: Error) => toast.error(value.message);

  return {
    create: useMutation({
      mutationFn: ({ payload, idempotencyKey }: { payload: CrmTaskPayload; idempotencyKey: string }) =>
        createCrmTask(payload, idempotencyKey),
      onSuccess: () => {
        toast.success("Tarea creada");
        invalidate();
      },
      onError: error
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateCrmTask>[1] }) =>
        updateCrmTask(id, payload),
      onSuccess: (task) => {
        toast.success("Tarea actualizada");
        invalidate(task.id);
      },
      onError: error
    }),
    complete: useMutation({
      mutationFn: ({ id, version }: { id: string; version: number }) => completeCrmTask(id, version),
      onSuccess: (task) => {
        toast.success("Tarea completada");
        invalidate(task.id);
      },
      onError: error
    }),
    reopen: useMutation({
      mutationFn: ({ id, version }: { id: string; version: number }) => reopenCrmTask(id, version),
      onSuccess: (task) => {
        toast.success("Tarea reabierta");
        invalidate(task.id);
      },
      onError: error
    }),
    cancel: useMutation({
      mutationFn: ({ id, version, reason }: { id: string; version: number; reason: string }) =>
        cancelCrmTask(id, version, reason),
      onSuccess: (task) => {
        toast.success("Tarea cancelada");
        invalidate(task.id);
      },
      onError: error
    })
  };
}

export function useCrmTaskStatistics(branchId: string, month?: string) {
  return useQuery({
    queryKey: ["crm-tasks", "statistics", branchId, month],
    queryFn: () => getCrmTaskStatistics({ branchId, month }),
    enabled: Boolean(branchId)
  });
}

export function useCrmTaskConfiguration(branchId: string) {
  return useQuery({
    queryKey: ["crm-tasks", "configuration", branchId],
    queryFn: () => getCrmTaskConfiguration(branchId),
    enabled: Boolean(branchId)
  });
}

export function useUpdateCrmTaskConfiguration(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: CrmTaskConfigurationInput[]) => updateCrmTaskConfiguration(branchId, items),
    onSuccess: () => {
      toast.success("Configuración guardada");
      queryClient.invalidateQueries({ queryKey: ["crm-tasks", "configuration", branchId] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
