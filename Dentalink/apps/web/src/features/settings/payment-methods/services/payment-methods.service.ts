import { http } from "@/lib/api/http-client";

export type PaymentMethod = {
  id: string;
  name: string;
  type: "CASH" | "CARD" | "TRANSFER" | "DEPOSIT" | "ONLINE" | "CREDIT" | "OTHER";
  isActive: boolean;
};

export type PaymentMethodPayload = {
  name: string;
  type: "CASH" | "CARD" | "TRANSFER" | "DEPOSIT" | "ONLINE" | "CREDIT" | "OTHER";
};

export async function listPaymentMethods(params?: { search?: string; active?: string }) {
  const { data } = await http.get<PaymentMethod[]>("/payment-methods", { params });
  return data;
}

export async function createPaymentMethod(payload: PaymentMethodPayload) {
  const { data } = await http.post<PaymentMethod>("/payment-methods", payload);
  return data;
}

export async function updatePaymentMethod(id: string, payload: Partial<PaymentMethodPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<PaymentMethod>(`/payment-methods/${id}`, payload);
  return data;
}

export async function deactivatePaymentMethod(id: string) {
  const { data } = await http.patch<PaymentMethod>(`/payment-methods/${id}/deactivate`);
  return data;
}
