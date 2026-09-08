import type { DeveloperApiPlan, DeveloperApiScope } from "@dentalwarner/shared";

export type AuthM2MClient = {
  actorType: "API_KEY";
  apiKeyId: string;
  organizationId: string;
  scopes: DeveloperApiScope[];
  plan: DeveloperApiPlan;
  requestsPerMinute: number;
  branchScope: "ALL" | "SELECTED";
  branchIds: string[];
  networkScope: "ANY" | "ALLOWLIST";
  name: string;
  keyPrefix: string;
  clientIp: string;
};
