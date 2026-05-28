import axios from "axios";
import { parseApiError } from "./error";
import { authStoreApi } from "@/stores/auth.store";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";

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
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      authStoreApi.getState().clearSession();
    }
    throw parseApiError(error);
  }
);
