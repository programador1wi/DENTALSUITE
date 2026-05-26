import { http } from "@/lib/api/http-client";

export type CollectionCaseStatus =
  | "PENDING"
  | "CONTACTED"
  | "PROMISE_TO_PAY"
  | "PAID"
  | "UNCOLLECTIBLE"
  | "CANCELLED";

export type CollectionCase = {
  id: string;
  patientId: string;
  installmentId?: string | null;
  treatmentPlanId?: string | null;
  amountDue: string;
  daysOverdue: number;
  status: CollectionCaseStatus;
  assignedToId: string;
  lastContactAt?: string | null;
  nextContactAt?: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string; branchId: string };
  assignedTo: { id: string; firstName: string; lastName: string };
  installment?: { id: string; dueDate: string; amount: string; paidAmount: string; status: string } | null;
  treatmentPlan?: { id: string; name: string; status: string } | null;
  activities: Array<{
    id: string;
    channel: string;
    result: string;
    notes?: string | null;
    nextActionAt?: string | null;
    createdAt: string;
    user: { id: string; firstName: string; lastName: string };
  }>;
};

export async function listCollectionCases(params?: {
  patientId?: string;
  assignedToId?: string;
  branchId?: string;
  status?: CollectionCaseStatus;
}) {
  const { data } = await http.get<CollectionCase[]>("/collections", { params });
  return data;
}

export async function getCollectionCase(id: string) {
  const { data } = await http.get<CollectionCase>(`/collections/${id}`);
  return data;
}

export async function detectOverdueCases(payload?: { minDaysOverdue?: number; branchId?: string; assignedToId?: string }) {
  const { data } = await http.post<{ scanned: number; created: number }>("/collections/detect-overdue", payload ?? {});
  return data;
}

export async function createCollectionCase(payload: {
  patientId: string;
  installmentId?: string;
  treatmentPlanId?: string;
  amountDue: number;
  daysOverdue: number;
  assignedToId: string;
  status?: CollectionCaseStatus;
  nextContactAt?: string;
}) {
  const { data } = await http.post<CollectionCase>("/collections", payload);
  return data;
}

export async function updateCollectionCaseStatus(id: string, status: CollectionCaseStatus) {
  const { data } = await http.patch<CollectionCase>(`/collections/${id}/status`, { status });
  return data;
}

export async function assignCollectionCase(id: string, assignedToId: string) {
  const { data } = await http.patch<CollectionCase>(`/collections/${id}/assign`, { assignedToId });
  return data;
}

export async function addCollectionActivity(
  id: string,
  payload: { channel: string; result: string; notes?: string; nextActionAt?: string }
) {
  const { data } = await http.post<CollectionCase>(`/collections/${id}/activities`, payload);
  return data;
}
