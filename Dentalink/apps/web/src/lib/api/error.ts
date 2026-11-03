import type { AxiosError } from "axios";
import type { ApiErrorShape } from "@/types/common";

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;

  constructor(
    message: string,
    statusCode = 500,
    metadata?: { code?: string; details?: Record<string, unknown>; requestId?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = metadata?.code;
    this.details = metadata?.details;
    this.requestId = metadata?.requestId;
  }
}

export function parseApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<ApiErrorShape>;
  const statusCode = axiosError.response?.status ?? 500;
  const rawMessage = axiosError.response?.data?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(", ")
    : (rawMessage ?? axiosError.message ?? "Unexpected error");

  return new ApiError(message, statusCode, {
    code: axiosError.response?.data?.code,
    details: axiosError.response?.data?.details,
    requestId: axiosError.response?.data?.requestId
  });
}
