import { http } from "@/lib/api/http-client";

export type CrmTaskStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type CrmTaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type CrmTaskOrigin = "MANUAL" | "AUTOMATIC";
export type CrmTaskDelayUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
export type CrmTaskType = "COBRANZA" | "CAPTURA" | "CONTROL" | "CITA" | "PERSONALIZADA";

export type CrmTaskUser = { id: string; firstName: string; lastName: string; email?: string | null };

export type CrmTask = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId: string;
  type: CrmTaskType;
  title: string;
  detail: string;
  dueDate?: string | null;
  priority: CrmTaskPriority;
  origin: CrmTaskOrigin;
  sourceType?: string | null;
  sourceId?: string | null;
  trigger?: string | null;
  assignedToId?: string | null;
  assignedTo?: CrmTaskUser | null;
  createdBy: CrmTaskUser;
  completedBy?: CrmTaskUser | null;
  cancelledBy?: CrmTaskUser | null;
  status: CrmTaskStatus;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  version: number;
  patient: { id: string; firstName: string; lastName: string; branchId: string };
  branch: { id: string; name: string; timezone?: string | null };
  createdAt: string;
  updatedAt: string;
};

export type CrmTasksQuery = {
  branchId: string;
  date?: string;
  overdue?: "true" | "false";
  search?: string;
  status?: CrmTaskStatus;
  type?: CrmTaskType;
  assignedToId?: string;
  origin?: CrmTaskOrigin;
  page?: number;
  pageSize?: number;
  sortBy?: "dueDate" | "createdAt" | "updatedAt" | "title" | "priority";
  sortOrder?: "asc" | "desc";
};

export type CrmTasksResponse = {
  items: CrmTask[];
  total: number;
  overdueCount: number;
  page: number;
  pageSize: number;
};

export type CrmTaskPayload = {
  branchId: string;
  patientId: string;
  type: CrmTaskType;
  title: string;
  detail: string;
  dueAt?: string;
  priority?: CrmTaskPriority;
  assignedToId?: string;
};

export type CrmTaskHistoryEntry = {
  id: string;
  taskId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actorUser?: CrmTaskUser | null;
  createdAt: string;
};

export type CrmTaskStatistics = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  cancelled: number;
  completionRate: number;
  metricDefinition: string;
  byType: Array<{ type: string; count: number }>;
  byAssignee: Array<{ assignedToId?: string | null; name: string; count: number }>;
};

export type CrmTaskConfiguration = {
  id?: string | null;
  branchId: string;
  type: Exclude<CrmTaskType, "PERSONALIZADA">;
  enabled: boolean;
  delayValue: number;
  delayUnit: CrmTaskDelayUnit;
  defaultAssignedToId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CrmTaskConfigurationInput = Pick<
  CrmTaskConfiguration,
  "type" | "enabled" | "delayValue" | "delayUnit" | "defaultAssignedToId"
>;

export async function listCrmTasks(params: CrmTasksQuery) {
  const { data } = await http.get<CrmTasksResponse>("/crm/tasks", { params });
  return data;
}

export async function getCrmTask(id: string) {
  const { data } = await http.get<CrmTask>(`/crm/tasks/${id}`);
  return data;
}

export async function getCrmTaskHistory(id: string) {
  const { data } = await http.get<CrmTaskHistoryEntry[]>(`/crm/tasks/${id}/history`);
  return data;
}

export async function createCrmTask(payload: CrmTaskPayload, idempotencyKey: string) {
  const { data } = await http.post<CrmTask>("/crm/tasks", payload, {
    headers: { "Idempotency-Key": idempotencyKey }
  });
  return data;
}

export async function updateCrmTask(
  id: string,
  payload: {
    type?: CrmTaskType;
    title?: string;
    detail?: string;
    dueAt?: string | null;
    priority?: CrmTaskPriority;
    assignedToId?: string | null;
    version: number;
  }
) {
  const { data } = await http.patch<CrmTask>(`/crm/tasks/${id}`, payload);
  return data;
}

export async function completeCrmTask(id: string, version: number) {
  const { data } = await http.post<CrmTask>(`/crm/tasks/${id}/complete`, { version });
  return data;
}

export async function reopenCrmTask(id: string, version: number) {
  const { data } = await http.post<CrmTask>(`/crm/tasks/${id}/reopen`, { version });
  return data;
}

export async function cancelCrmTask(id: string, version: number, reason: string) {
  const { data } = await http.post<CrmTask>(`/crm/tasks/${id}/cancel`, { version, reason });
  return data;
}

export async function getCrmTaskStatistics(params: { branchId: string; month?: string }) {
  const { data } = await http.get<CrmTaskStatistics>("/crm/tasks/statistics", { params });
  return data;
}

export async function getCrmTaskConfiguration(branchId: string) {
  const { data } = await http.get<CrmTaskConfiguration[]>("/crm/tasks/configuration", { params: { branchId } });
  return data;
}

export async function updateCrmTaskConfiguration(branchId: string, items: CrmTaskConfigurationInput[]) {
  const { data } = await http.put<CrmTaskConfiguration[]>("/crm/tasks/configuration", { branchId, items });
  return data;
}

export function zonedLocalToIso(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = desired;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate += desired - represented;
  }
  return new Date(candidate).toISOString();
}
