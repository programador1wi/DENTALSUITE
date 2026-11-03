import { http } from "@/lib/api/http-client";

export type DeveloperApiScope =
  | "patients:read"
  | "patients:write"
  | "appointments:read"
  | "appointments:write"
  | "budgets:read"
  | "pricing:read";
export type ApiKeyStatus = "ACTIVE" | "EXPIRING" | "ROTATING" | "EXPIRED" | "REVOKED";
export type BranchScope = "ALL" | "SELECTED";
export type NetworkScope = "ANY" | "ALLOWLIST";

export type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string | null;
  scopes: DeveloperApiScope[];
  status: ApiKeyStatus;
  branchScope: BranchScope;
  branchIds: string[];
  networkScope: NetworkScope;
  allowedIps: string[];
  expiresAt: string | null;
  rotationEndsAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type ApiKeyOptions = {
  scopes: Array<{ value: DeveloperApiScope; label: string; description: string }>;
  branches: Array<{ id: string; name: string }>;
  plan: "STANDARD" | "PRO" | "ENTERPRISE";
  requestsPerMinute: number;
};

export type ApiKeyFormPayload = {
  name: string;
  scopes: DeveloperApiScope[];
  branchScope: BranchScope;
  branchIds: string[];
  networkScope: NetworkScope;
  allowedIps: string[];
};
export type CreateApiKeyPayload = ApiKeyFormPayload & { expiresInDays: 30 | 60 | 90 };
export type UpdateApiKeyPayload = Partial<ApiKeyFormPayload>;
export type SecretResponse = { credential: ApiKey; secret: string; shownOnce: true };
export type ApiKeysPage = {
  items: ApiKey[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type ApiKeyListParams = { status?: ApiKeyStatus; search?: string; page?: number; pageSize?: number };

export async function listApiKeys(params: ApiKeyListParams): Promise<ApiKeysPage> {
  const { data } = await http.get<ApiKeysPage>("/settings/api-keys", { params });
  return data;
}

export async function getApiKeyOptions(): Promise<ApiKeyOptions> {
  const { data } = await http.get<ApiKeyOptions>("/settings/api-keys/options");
  return data;
}

export async function getApiKey(id: string): Promise<ApiKey> {
  const { data } = await http.get<ApiKey>(`/settings/api-keys/${id}`);
  return data;
}

export async function createApiKey(payload: CreateApiKeyPayload): Promise<SecretResponse> {
  const { data } = await http.post<SecretResponse>("/settings/api-keys", payload);
  return data;
}

export async function updateApiKey(id: string, payload: UpdateApiKeyPayload): Promise<ApiKey> {
  const { data } = await http.patch<ApiKey>(`/settings/api-keys/${id}`, payload);
  return data;
}

export async function rotateApiKey(id: string): Promise<SecretResponse> {
  const { data } = await http.post<SecretResponse>(`/settings/api-keys/${id}/rotate`);
  return data;
}

export async function revokeApiKey(id: string): Promise<ApiKey> {
  const { data } = await http.post<ApiKey>(`/settings/api-keys/${id}/revoke`);
  return data;
}
