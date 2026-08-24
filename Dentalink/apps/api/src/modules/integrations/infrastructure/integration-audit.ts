import { Prisma } from "@prisma/client";
import { AuthUser } from "../../../common/types/auth-user";
import { PrismaService } from "../../../database/prisma.service";

export type IntegrationAuditPayload = {
  entity: string;
  entityId?: string;
  action: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function writeIntegrationAudit(
  transaction: Prisma.TransactionClient | PrismaService,
  actor: AuthUser,
  payload: IntegrationAuditPayload
) {
  await transaction.auditLog.create({
    data: {
      organizationId: actor.organizationId,
      userId: actor.id,
      actorUserId: actor.id,
      entity: payload.entity,
      entityId: payload.entityId,
      action: payload.action,
      before: payload.before,
      after: payload.after
    }
  });
}
