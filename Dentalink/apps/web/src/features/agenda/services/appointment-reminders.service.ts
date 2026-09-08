import { http } from "@/lib/api/http-client";

export type ReminderStage = "FIRST_48H" | "FINAL_24H";
export type ReminderOperation = {
  id: string;
  appointmentId: string;
  appointmentStartAt: string;
  stage: ReminderStage;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  sentAt: string | null;
  failureCode: string | null;
  errorMessage: string | null;
  appointmentStatus: string;
  branch: { id: string; name: string; timezone: string | null };
  patient: { id: string; firstName: string; lastName: string } | null;
};

export type ReminderPolicy = {
  enabled: boolean;
  firstOffsetHours: number;
  finalOffsetHours: number;
  sendWindowStartMinutes: number;
  sendWindowEndMinutes: number;
  retryDelaysMinutes: number[];
  maxAttempts: number;
};

export type BranchReminderPolicy = {
  enabled?: boolean | null;
  firstOffsetHours?: number | null;
  finalOffsetHours?: number | null;
  sendWindowStartMinutes?: number | null;
  sendWindowEndMinutes?: number | null;
};

export type ReminderSettings = {
  policy: ReminderPolicy;
  branches: Array<{
    id: string;
    name: string;
    timezone: string | null;
    appointmentReminderPolicy: BranchReminderPolicy | null;
  }>;
};

export const appointmentRemindersService = {
  async list(params: URLSearchParams) {
    const { data } = await http.get<{
      items: ReminderOperation[];
      total: number;
      page: number;
      pageSize: number;
      summary: Record<string, number>;
    }>(`/appointments/reminder-operations?${params.toString()}`);
    return data;
  },
  async settings() {
    const { data } = await http.get<ReminderSettings>("/settings/appointment-reminders");
    return data;
  },
  async updatePolicy(policy: ReminderPolicy) {
    const { data } = await http.put<ReminderPolicy>("/settings/appointment-reminders", policy);
    return data;
  },
  async updateBranch(branchId: string, policy: BranchReminderPolicy) {
    const { data } = await http.put(`/settings/appointment-reminders/branches/${branchId}`, policy);
    return data;
  },
  async testEmail() {
    const { data } = await http.post("/settings/appointment-reminders/test-email", {});
    return data;
  },
  async retry(id: string) {
    const { data } = await http.post(`/appointments/reminder-operations/${id}/retry`);
    return data;
  },
  async resolve(id: string, resolution: "MARK_SENT" | "MARK_NOT_SENT_AND_RETRY", reason: string) {
    const { data } = await http.post(`/appointments/reminder-operations/${id}/resolve`, {
      resolution,
      reason
    });
    return data;
  }
};
