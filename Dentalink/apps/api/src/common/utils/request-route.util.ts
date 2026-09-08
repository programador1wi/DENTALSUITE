export type RequestRouteLike = {
  baseUrl?: string;
  path?: string;
  route?: { path?: string | string[] };
};

export function requestRouteTemplate(request: RequestRouteLike) {
  const routePath = Array.isArray(request.route?.path)
    ? request.route?.path[0]
    : request.route?.path;
  const value = routePath
    ? `${request.baseUrl ?? ""}/${routePath}`
    : request.path ?? "/unknown";
  return value
    .replace(/\/{2,}/g, "/")
    .split("?")[0]
    .replace(/["\\\n\r]/g, "_");
}
