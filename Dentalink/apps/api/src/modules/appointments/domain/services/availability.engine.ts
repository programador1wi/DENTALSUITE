import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../../database/prisma.service";
import { AuthUser } from "../../../../common/types/auth-user";

@Injectable()
export class AvailabilityEngine {
  constructor(private readonly prisma: PrismaService) {}

  async isDateHoliday(organizationId: string, branchId: string, dateIso: string): Promise<boolean> {
    const holidays = await this.prisma.holiday.findMany({
      where: {
        organizationId,
        isActive: true,
        date: dateIso,
        OR: [{ branchId: null }, { branchId }]
      }
    });
    return holidays.length > 0;
  }
}
