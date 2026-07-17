import axios from "axios";
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

http.interceptors.response.use(
  (response) => {
    if (response.config.responseType !== "blob") {
      assertApiResponseContract(response.data, response.headers["content-type"]);
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      authStoreApi.getState().clearSession();
    }
    throw parseApiError(error);
  }
);
