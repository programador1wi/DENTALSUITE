import { http } from "@/lib/api/http-client";

export type OnlineSchedulingCampaign = {
  id: string;
  code: string;
  name: string;
  professionalId?: string;
  professional?: { firstName: string; lastName: string };
};

export async function getCampaigns() {
  const { data } = await http.get<OnlineSchedulingCampaign[]>("/online-scheduling/campaigns");
  return data;
}

export async function createCampaign(dto: { code: string; name: string; professionalId?: string }) {
  const { data } = await http.post<OnlineSchedulingCampaign>("/online-scheduling/campaigns", dto);
  return data;
}

export async function deleteCampaign(id: string) {
  const { data } = await http.patch(`/online-scheduling/campaigns/${id}`);
  return data;
}

export async function getDashboardStats(period = '30', grain = 'day') {
  const { data } = await http.get(`/online-scheduling/dashboard/stats?period=${period}&grain=${grain}`);
  return data;
}
