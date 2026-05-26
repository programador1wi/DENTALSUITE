import { http } from "@/lib/api/http-client";

export type PriceListItem = {
  id: string;
  procedureId: string;
  price: string;
  currency: "MXN" | "USD" | "EUR";
  procedure: { id: string; code: string; name: string };
};

export type PriceList = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  items: PriceListItem[];
};

export type PriceListPayload = {
  name: string;
  description?: string;
  isDefault?: boolean;
  items?: { procedureId: string; price: string; currency?: "MXN" | "USD" | "EUR" }[];
};

export async function listPriceLists(params?: { search?: string; active?: string }) {
  const { data } = await http.get<PriceList[]>("/price-lists", { params });
  return data;
}

export async function createPriceList(payload: PriceListPayload) {
  const { data } = await http.post<PriceList>("/price-lists", payload);
  return data;
}

export async function updatePriceList(id: string, payload: Partial<PriceListPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<PriceList>(`/price-lists/${id}`, payload);
  return data;
}

export async function deactivatePriceList(id: string) {
  const { data } = await http.patch<PriceList>(`/price-lists/${id}/deactivate`);
  return data;
}
