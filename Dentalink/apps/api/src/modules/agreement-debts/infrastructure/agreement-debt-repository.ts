import { NotFoundException } from "@nestjs/common";
import { AuthUser } from "../../../common/types/auth-user";
import { PrismaService } from "../../../database/prisma.service";

export async function findRequiredAgreement(
  prisma: PrismaService,
  actor: AuthUser,
  agreementId: string
) {
  const agreement = await prisma.agreement.findFirst({
    where: { id: agreementId, organizationId: actor.organizationId },
    include: { company: true }
  });
  if (!agreement) throw new NotFoundException("Convenio no encontrado");
  return agreement;
}
