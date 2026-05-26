export type ApiErrorShape = {
  statusCode?: number;
  message?: string | string[];
  path?: string;
  timestamp?: string;
};
