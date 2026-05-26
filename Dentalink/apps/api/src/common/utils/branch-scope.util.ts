import { ForbiddenException } from "@nestjs/common";
import { AuthUser } from "../types/auth-user";

export function assertBranchAccess(actor: AuthUser, branchId?: string) {
  if (!branchId) return;
  if (!actor.branchIds.includes(branchId)) {
    throw new ForbiddenException("Branch access denied");
  }
}

export function branchScope(actor: AuthUser, requestedBranchId?: string) {
  assertBranchAccess(actor, requestedBranchId);
  return requestedBranchId ? requestedBranchId : { in: actor.branchIds };
}
