import axios, { AxiosError, CanceledError, InternalAxiosRequestConfig } from "axios";
import { ApiError, parseApiError } from "./error";
import { authStoreApi } from "@/stores/auth.store";
import type { AuthResponse } from "@/types/auth";
import { clearPrivateQueryState } from "@/app/providers/query-client";

const DEFAULT_API_URL = "http://127.0.0.1:3001/api/v1";

export function resolveApiBaseUrl(configuredUrl: string | undefined, isDevelopment: boolean) {
  const baseUrl = configuredUrl || DEFAULT_API_URL;
  if (!isDevelopment) return baseUrl;

  return baseUrl.replace(/^http:\/\/localhost:3001(?=\/|$)/i, "http://127.0.0.1:3001");
}

export function assertApiResponseContract(payload: unknown, contentType?: unknown) {
  const isHtmlContentType =
    typeof contentType === "string" && contentType.toLowerCase().includes("text/html");
  const looksLikeHtml =
    typeof payload === "string" && /^\s*(?:<!doctype html|<html\b)/i.test(payload);

  if (!isHtmlContentType && !looksLikeHtml) return;

  throw new ApiError(
    "La URL de la API apunta al servidor web. Verifica VITE_API_URL y que la API este disponible.",
    502
  );
}

const baseURL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV);

export const http = axios.create({
  baseURL,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshPromise: Promise<AuthResponse> | null = null;
type SessionMessage =
  | { type: "refreshed"; at: number; data: AuthResponse }
  | { type: "logout"; at: number };
const refreshChannel = typeof BroadcastChannel === "undefined"
  ? null
  : new BroadcastChannel("dentalink-session-v1");
let lastCrossTabRefresh: Extract<SessionMessage, { type: "refreshed" }> | null = null;

async function applyRefreshedSession(data: AuthResponse) {
  const current = authStoreApi.getState().user;
  if (current && (current.id !== data.user.id || current.organizationId !== data.user.organizationId)) {
    await clearPrivateQueryState();
  }
  authStoreApi.getState().setSession({ user: data.user, accessToken: data.accessToken });
}

refreshChannel?.addEventListener("message", (event: MessageEvent<SessionMessage>) => {
  if (event.data.type === "refreshed") {
    lastCrossTabRefresh = event.data;
    void applyRefreshedSession(event.data.data);
  } else if (event.data.type === "logout") {
    authStoreApi.getState().clearSession();
    void clearPrivateQueryState();
  }
});

export function broadcastSessionCleared() {
  refreshChannel?.postMessage({ type: "logout", at: Date.now() } satisfies SessionMessage);
}

export function tokenExpiresSoon(token: string, toleranceSeconds = 30) {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return false;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000) + toleranceSeconds;
  } catch {
    return false;
  }
}

export async function refreshSessionFromCookie() {
  if (refreshPromise) return refreshPromise;
  const requestedAt = Date.now();
  const performRefresh = async () => {
    if (lastCrossTabRefresh && lastCrossTabRefresh.at >= requestedAt) return lastCrossTabRefresh.data;
    const { data } = await axios.post<AuthResponse>(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 15_000 }
    );
    const message = { type: "refreshed", at: Date.now(), data } as const;
    lastCrossTabRefresh = message;
    refreshChannel?.postMessage(message);
    return data;
  };
  const locks = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & {
        locks?: { request: <T>(name: string, callback: () => Promise<T>) => Promise<T> };
      }).locks;
  refreshPromise = (locks
    ? locks.request("dentalink-refresh-session", performRefresh)
    : performRefresh())
    .then(async (data) => {
      await applyRefreshedSession(data);
      return data;
    })
    .catch((error) => {
      authStoreApi.getState().clearSession();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function refreshBeforeRequest() {
  const data = await refreshSessionFromCookie();
  return data.accessToken;
}

http.interceptors.request.use(async (config: InternalAxiosRequestConfig & { _sessionEpoch?: number }) => {
  config._sessionEpoch = authStoreApi.getState().sessionEpoch;
  let token = authStoreApi.getState().accessToken;
  const isAuthRequest = config.url?.includes("/auth/login") || config.url?.includes("/auth/refresh");
  if (token && !isAuthRequest && tokenExpiresSoon(token)) {
    token = await refreshBeforeRequest();
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Silent token refresh on 401 ---
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  for (const promise of pendingQueue) {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  }
  pendingQueue = [];
}

http.interceptors.response.use(
  (response) => {
    const request = response.config as InternalAxiosRequestConfig & { _sessionEpoch?: number };
    const isIdentityRequest = request.url?.includes("/auth/login") || request.url?.includes("/auth/refresh");
    if (!isIdentityRequest && request._sessionEpoch !== authStoreApi.getState().sessionEpoch) {
      throw new CanceledError("Respuesta descartada porque cambió la sesión");
    }
    if (response.config.responseType !== "blob") {
      assertApiResponseContract(response.data, response.headers["content-type"]);
    }
    return response;
  },
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh for 401 responses that have not already been retried
    // and that are NOT the refresh endpoint itself (avoid infinite loop)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      // If another refresh is already in flight, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return http(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const data = await refreshSessionFromCookie();

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);

        return http(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        authStoreApi.getState().clearSession();
        throw parseApiError(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Non-401 errors or already retried: propagate normally
    throw parseApiError(error);
  }
);

