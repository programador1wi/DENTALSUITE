import { http } from "@/lib/api/http-client";

export type Professional = {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  color?: string | null;
  commissionRate: string;
  isActive: boolean;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  agendaSlotMinutes?: number | null;
  defaultAppointmentDurationMinutes?: number | null;
  specialties: { id: string; name: string }[];
  branches: {
    id: string;
    name: string;
    agendaSlotMinutes?: number | null;
    defaultAppointmentDurationMinutes?: number | null;
    status?: "ACTIVE" | "PAUSED" | "ENDED";
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
    endedReason?: string | null;
  }[];
};

export type ProfessionalPayload = {
  userId?: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  phone?: string;
  email?: string;
  color?: string;
  commissionRate?: number;
  specialtyIds: string[];
  branchIds: string[];
};

export type ProfessionalBranchTransferPayload = {
  branchId: string;
  fromProfessionalId: string;
  toProfessionalId: string;
  effectiveAt?: string;
  moveFutureAppointments?: boolean;
  moveFutureBlocks?: boolean;
  copySchedules?: boolean;
  copyAgendaConfig?: boolean;
  endSourceAssignment?: boolean;
  notes?: string;
};

export type ProfessionalBranchTransferResult = {
  id: string;
  branchId: string;
  fromProfessionalId: string;
  toProfessionalId: string;
  effectiveAt: string;
  appointmentsTransferred: number;
  blocksTransferred: number;
  schedulesCopied: number;
};

export type ProfessionalDeactivationImpact = {
  professionalId: string;
  branchIds: string[];
  futureAppointments: number;
  futureBlocks: number;
  activeSchedules: number;
  canDeactivate: boolean;
};

export type BulkProfessionalContractPayload = {
  targets: { professionalId: string; branchIds: string[] }[];
  commissionRate: number;
  commissionBase: "clinical" | "lab" | "all";
  paymentDiscount: "no" | "yes" | "fixed";
  paymentCondition: "no_due_date" | "on_due" | "thirty_days";
  contractType: "performed_and_paid" | "performed";
  priceListId?: string;
  categoryRates?: { procedureCategoryId: string; rate: number }[];
  fixedAmounts?: { procedureId: string; priceListId?: string; amount: number; currency?: "MXN" | "USD" | "EUR" }[];
  removeOtherBranches?: boolean;
  keepPrevious?: boolean;
};

export type BulkProfessionalContractPreview = {
  professionals: number;
  branches: number;
  scopes: number;
  contractsToCreate: number;
  currentContractsToClose: number;
  otherContractsToClose: number;
  fixedAmounts: number;
  categoryRates: number;
  priceListId?: string | null;
  priceListName?: string | null;
  zoneCodes: string[];
  warnings: string[];
};

export type BulkProfessionalContractResult = {
  updatedProfessionals: number;
  updatedScopes: number;
  fixedAmounts: number;
  categoryRates: number;
  contracts: {
    id: string;
    professionalId: string;
    branchIds: string[];
    commissionRate: number;
    priceListId?: string | null;
    priceListName?: string | null;
    categoryRates: number;
    fixedAmounts: number;
  }[];
};

export async function listProfessionals(params?: {
  search?: string;
  active?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await http.get<Professional[]>("/professionals", { params });
  return data;
}

export async function createProfessional(payload: ProfessionalPayload) {
  const { data } = await http.post<Professional>("/professionals", payload);
  return data;
}

export async function updateProfessional(id: string, payload: Partial<ProfessionalPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<Professional>(`/professionals/${id}`, payload);
  return data;
}

export async function deactivateProfessional(id: string) {
  const { data } = await http.patch<Professional>(`/professionals/${id}/deactivate`);
  return data;
}

export async function getProfessionalDeactivationImpact(id: string, branchId?: string) {
  const { data } = await http.get<ProfessionalDeactivationImpact>(`/professionals/${id}/deactivation-impact`, {
    params: { branchId }
  });
  return data;
}

export async function transferProfessionalBranch(payload: ProfessionalBranchTransferPayload) {
  const { data } = await http.post<ProfessionalBranchTransferResult>("/professionals/branch-transfer", payload);
  return data;
}

export async function bulkUpdateProfessionalContracts(payload: BulkProfessionalContractPayload) {
  const { data } = await http.post<BulkProfessionalContractResult>("/professionals/contracts/bulk", payload);
  return data;
}

export async function previewBulkProfessionalContracts(payload: BulkProfessionalContractPayload) {
  const { data } = await http.post<BulkProfessionalContractPreview>("/professionals/contracts/bulk/preview", payload);
  return data;
}
