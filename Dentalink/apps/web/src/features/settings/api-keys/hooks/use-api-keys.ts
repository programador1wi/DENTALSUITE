import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createApiKey,
  getApiKey,
  getApiKeyOptions,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  updateApiKey,
  type ApiKeyListParams,
  type CreateApiKeyPayload,
  type UpdateApiKeyPayload
} from "../services/api-keys.service";

export const API_KEYS_QUERY_KEY = ["settings", "api-keys"] as const;

export function useApiKeys(params: ApiKeyListParams, enabled = true) {
  return useQuery({ queryKey: [...API_KEYS_QUERY_KEY, params], queryFn: () => listApiKeys(params), enabled });
}

export function useApiKeyOptions(enabled = true) {
  return useQuery({ queryKey: [...API_KEYS_QUERY_KEY, "options"], queryFn: getApiKeyOptions, enabled });
}

export function useApiKey(id?: string, enabled = true) {
  return useQuery({
    queryKey: [...API_KEYS_QUERY_KEY, "detail", id],
    queryFn: () => (id ? getApiKey(id) : Promise.reject(new Error("ID de credencial requerido"))),
    enabled: Boolean(id) && enabled
  });
}

function mutationWithInvalidation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  return function useCredentialMutation() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY }) });
  };
}

export const useCreateApiKey = mutationWithInvalidation<CreateApiKeyPayload, Awaited<ReturnType<typeof createApiKey>>>(createApiKey);
export const useUpdateApiKey = mutationWithInvalidation<{ id: string; payload: UpdateApiKeyPayload }, Awaited<ReturnType<typeof updateApiKey>>>(
  ({ id, payload }) => updateApiKey(id, payload)
);
export const useRotateApiKey = mutationWithInvalidation<string, Awaited<ReturnType<typeof rotateApiKey>>>(rotateApiKey);
export const useRevokeApiKey = mutationWithInvalidation<string, Awaited<ReturnType<typeof revokeApiKey>>>(revokeApiKey);
