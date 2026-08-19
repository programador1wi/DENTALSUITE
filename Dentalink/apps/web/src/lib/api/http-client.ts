import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ApiError, parseApiError } from "./error";
import { authStoreApi } from "@/stores/auth.store";

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
  headers: {
    "Content-Type": "application/json"
  }
});

http.interceptors.request.use((config) => {
  const token = authStoreApi.getState().accessToken;
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
      const refreshToken = authStoreApi.getState().refreshToken;

      // No refresh token available, clear session immediately
      if (!refreshToken) {
        authStoreApi.getState().clearSession();
        throw parseApiError(error);
      }

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
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${baseURL}/auth/refresh`,
          { refreshToken }
        );

        authStoreApi.getState().setSession({
          user: authStoreApi.getState().user!,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        });

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

