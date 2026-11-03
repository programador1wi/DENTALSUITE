export type ApiErrorShape = {
  statusCode?: number;
  message?: string | string[];
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
  path?: string;
  timestamp?: string;
};
