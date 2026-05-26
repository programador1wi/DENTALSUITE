import type { AxiosError } from "axios";
import type { ApiErrorShape } from "@/types/common";

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export function parseApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<ApiErrorShape>;
  const statusCode = axiosError.response?.status ?? 500;
  const rawMessage = axiosError.response?.data?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(", ")
    : rawMessage ?? axiosError.message ?? "Unexpected error";

  return new ApiError(message, statusCode);
}
