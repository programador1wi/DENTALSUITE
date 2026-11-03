import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuthUser } from "../../../common/types/auth-user";
import { PrismaService } from "../../../database/prisma.service";

export type RequestAuditContext = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function writeAgreementDebtAudit(
  client: Prisma.TransactionClient | PrismaService,
  actor: AuthUser,
  context: RequestAuditContext,
  event: {
    action: string;
    entity: string;
    entityId?: string;
    branchId?: string;
    reason?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  }
) {
  await client.auditLog.create({
    data: {
      organizationId: actor.organizationId,
      branchId: event.branchId,
      userId: actor.id,
      actorUserId: actor.id,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      reason: event.reason,
      before: event.before,
      after: event.after,
      oldValue: event.before,
      newValue: event.after,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId?.trim() || randomUUID()
    }
  });
}
