import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProfessionalBranchStatus } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateProfessionalScheduleDto } from "./dto/create-professional-schedule.dto";
import { UpdateProfessionalScheduleDto } from "./dto/update-professional-schedule.dto";
import { CreateProfessionalSpecialScheduleDto } from "./dto/create-professional-special-schedule.dto";
import { UpdateProfessionalSpecialScheduleDto } from "./dto/update-professional-special-schedule.dto";

const FIXED_END_TIMES_BY_DAY: Partial<Record<number, string>> = {
  1: "19:00",
  2: "19:00",
  3: "19:00",
  4: "19:00",
  5: "19:00",
  6: "15:00"
};
const MAX_SIMULTANEOUS_CHAIRS = 3;

@Injectable()
export class ProfessionalSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actor: AuthUser,
    professionalId?: string,
    branchId?: string,
    dayOfWeek?: string,
    active?: string,
    page?: number,
    pageSize?: number
  ) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const where: Prisma.ProfessionalScheduleWhereInput = {
      professional: { organizationId: actor.organizationId },
      ...(professionalId ? { professionalId } : {}),
      branchId: branchScope(actor, branchId),
      ...(dayOfWeek !== undefined ? { dayOfWeek: Number(dayOfWeek) } : {}),
      ...(active !== undefined ? { isActive: active === "true" } : {})
    };

    return this.prisma.professionalSchedule.findMany({
      where,
      skip,
      take,
      include: {
        professional: true,
        branch: true,
        chair: true
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const schedule = await this.prisma.professionalSchedule.findFirst({
      where: { id, branchId: branchScope(actor), professional: { organizationId: actor.organizationId } },
      include: { professional: true, branch: true, chair: true }
    });

    if (!schedule) throw new NotFoundException("Schedule not found");
    return schedule;
  }

  async create(actor: AuthUser, dto: CreateProfessionalScheduleDto) {
    await this.validateReferences(actor, dto.professionalId, dto.branchId, dto.chairId);
    this.validateSimultaneousChairs(dto.simultaneousChairs ?? 1);
    this.validateTimeRange(dto.startTime, dto.endTime, dto.breakStartTime, dto.breakEndTime);
    this.validateClinicEndTimePolicy(dto.dayOfWeek, dto.endTime);
    this.validateClinicBreakPolicy(dto.dayOfWeek, dto.breakStartTime, dto.breakEndTime);
    await this.validateInsideBranchHours(actor, dto.branchId, dto.startTime, dto.endTime);
    await this.ensureNoOverlap(actor, {
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime
    });
    if (dto.chairId) {
      await this.ensureNoChairOverlap(actor, {
        chairId: dto.chairId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime
      });
    }

    const schedule = await this.prisma.professionalSchedule.create({
      data: {
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        chairId: dto.chairId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStartTime: dto.breakStartTime,
        breakEndTime: dto.breakEndTime
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "ProfessionalSchedule",
        entityId: schedule.id,
        action: "create",
        after: {
          professionalId: schedule.professionalId,
          branchId: schedule.branchId,
          chairId: schedule.chairId,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime
        }
      }
    });

    return this.findOne(actor, schedule.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateProfessionalScheduleDto) {
    const current = await this.findOne(actor, id);

    const professionalId = dto.professionalId ?? current.professionalId;
    const branchId = dto.branchId ?? current.branchId;
    const chairId = "chairId" in dto ? dto.chairId ?? undefined : current.chairId ?? undefined;
    const dayOfWeek = dto.dayOfWeek ?? current.dayOfWeek;
    const startTime = dto.startTime ?? current.startTime;
    const endTime = dto.endTime ?? current.endTime;
    const breakStartTime = "breakStartTime" in dto ? dto.breakStartTime ?? undefined : current.breakStartTime ?? undefined;
    const breakEndTime = "breakEndTime" in dto ? dto.breakEndTime ?? undefined : current.breakEndTime ?? undefined;
    const simultaneousChairs = dto.simultaneousChairs ?? current.simultaneousChairs;
    const attendanceMode = dto.attendanceMode ?? current.attendanceMode;
    const isActive = dto.isActive ?? current.isActive;

    await this.validateReferences(actor, professionalId, branchId, chairId);
    this.validateSimultaneousChairs(simultaneousChairs);
    this.validateTimeRange(startTime, endTime, breakStartTime, breakEndTime);
    if (isActive) {
      this.validateClinicEndTimePolicy(dayOfWeek, endTime);
      this.validateClinicBreakPolicy(dayOfWeek, breakStartTime, breakEndTime);
    }
    await this.validateInsideBranchHours(actor, branchId, startTime, endTime);
    await this.ensureNoOverlap(actor, { professionalId, branchId, dayOfWeek, startTime, endTime }, id);
    if (chairId && isActive) {
      await this.ensureNoChairOverlap(actor, { chairId, dayOfWeek, startTime, endTime }, id);
    }

    await this.prisma.professionalSchedule.update({
      where: { id },
      data: {
        professionalId,
        branchId,
        chairId: "chairId" in dto ? dto.chairId : undefined,
        dayOfWeek,
        startTime,
        endTime,
        breakStartTime: "breakStartTime" in dto ? dto.breakStartTime : breakStartTime,
        breakEndTime: "breakEndTime" in dto ? dto.breakEndTime : breakEndTime,
        isActive: dto.isActive
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "ProfessionalSchedule",
        entityId: id,
        action: "update",
        after: {
            professionalId,
            branchId,
            chairId,
            dayOfWeek,
            startTime,
            endTime,
          simultaneousChairs,
          attendanceMode,
          isActive: dto.isActive
        }
      }
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  private async validateReferences(actor: AuthUser, professionalId: string, branchId: string, chairId?: string) {
    const now = new Date();
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        branches: {
          some: {
            branchId,
            status: ProfessionalBranchStatus.ACTIVE,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        }
      }
    });

    if (!professional) throw new BadRequestException("Invalid professionalId");

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        status: "ACTIVE",
        deletedAt: null
      }
    });

    if (!branch) throw new BadRequestException("Invalid branchId");

    if (chairId) {
      const chair = await this.prisma.chair.findFirst({
        where: {
          id: chairId,
          organizationId: actor.organizationId,
          branchId,
          isActive: true
        }
      });

      if (!chair) throw new BadRequestException("Invalid chairId for selected branch");
    }
  }

  private validateSimultaneousChairs(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_SIMULTANEOUS_CHAIRS) {
      throw new BadRequestException(`simultaneousChairs must be between 1 and ${MAX_SIMULTANEOUS_CHAIRS}`);
    }
  }

  private async validateInsideBranchHours(actor: AuthUser, branchId: string, startTime: string, endTime: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        status: "ACTIVE",
        deletedAt: null
      },
      select: { agendaStartHour: true, agendaEndHour: true }
    });

    if (!branch) throw new BadRequestException("Invalid branchId");
    const start = this.toMinutes(startTime);
    const end = this.toMinutes(endTime);
    const branchStart = branch.agendaStartHour * 60;
    const branchEnd = branch.agendaEndHour * 60;

    if (start < branchStart || end > branchEnd) {
      throw new BadRequestException("Schedule must be inside branch agenda hours");
    }
  }

  private validateTimeRange(startTime: string, endTime: string, breakStartTime?: string, breakEndTime?: string) {
    const start = this.toMinutes(startTime);
    const end = this.toMinutes(endTime);

    if (start >= end) throw new BadRequestException("startTime must be before endTime");

    if ((breakStartTime && !breakEndTime) || (!breakStartTime && breakEndTime)) {
      throw new BadRequestException("Both breakStartTime and breakEndTime are required");
    }

    if (breakStartTime && breakEndTime) {
      const breakStart = this.toMinutes(breakStartTime);
      const breakEnd = this.toMinutes(breakEndTime);
      if (breakStart >= breakEnd) throw new BadRequestException("breakStartTime must be before breakEndTime");
      if (breakStart < start || breakEnd > end) {
        throw new BadRequestException("Break must be inside the schedule range");
      }
    }
  }

  private validateClinicEndTimePolicy(dayOfWeek: number, endTime: string) {
    const expectedEndTime = FIXED_END_TIMES_BY_DAY[dayOfWeek];
    if (!expectedEndTime || endTime === expectedEndTime) return;

    throw new BadRequestException(`endTime must be ${expectedEndTime} for selected day`);
  }

  private validateClinicBreakPolicy(dayOfWeek: number, breakStartTime?: string, breakEndTime?: string) {
    if (dayOfWeek !== 6 || (!breakStartTime && !breakEndTime)) return;

    throw new BadRequestException("Saturday schedules must not include a break");
  }

  private async ensureNoOverlap(
    actor: AuthUser,
    candidate: { professionalId: string; branchId: string; dayOfWeek: number; startTime: string; endTime: string },
    excludeId?: string
  ) {
    const existing = await this.prisma.professionalSchedule.findMany({
      where: {
        professionalId: candidate.professionalId,
        branchId: candidate.branchId,
        dayOfWeek: candidate.dayOfWeek,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        professional: { organizationId: actor.organizationId }
      }
    });

    const candidateStart = this.toMinutes(candidate.startTime);
    const candidateEnd = this.toMinutes(candidate.endTime);

    const overlap = existing.some((row) => {
      const rowStart = this.toMinutes(row.startTime);
      const rowEnd = this.toMinutes(row.endTime);
      return candidateStart < rowEnd && candidateEnd > rowStart;
    });

    if (overlap) {
      throw new BadRequestException("Overlapping schedule for professional and branch");
    }
  }

  private async ensureNoChairOverlap(
    actor: AuthUser,
    candidate: { chairId: string; dayOfWeek: number; startTime: string; endTime: string },
    excludeId?: string
  ) {
    const existing = await this.prisma.professionalSchedule.findMany({
      where: {
        chairId: candidate.chairId,
        dayOfWeek: candidate.dayOfWeek,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        professional: { organizationId: actor.organizationId }
      }
    });

    const candidateStart = this.toMinutes(candidate.startTime);
    const candidateEnd = this.toMinutes(candidate.endTime);
    const overlap = existing.some((row) => {
      const rowStart = this.toMinutes(row.startTime);
      const rowEnd = this.toMinutes(row.endTime);
      return candidateStart < rowEnd && candidateEnd > rowStart;
    });


    if (overlap) {
      throw new BadRequestException("Overlapping schedule for chair");
    }
  }



  private toMinutes(value: string) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) throw new BadRequestException(`Invalid time format: ${value}. Expected HH:mm`);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  // --- SPECIAL SCHEDULES ---

  async findAllSpecial(
    actor: AuthUser,
    professionalId?: string,
    branchId?: string,
    date?: string,
    active?: string,
    page?: number,
    pageSize?: number
  ) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const where: Prisma.ProfessionalSpecialScheduleWhereInput = {
      professional: { organizationId: actor.organizationId },
      ...(professionalId ? { professionalId } : {}),
      branchId: branchScope(actor, branchId),
      ...(date ? { date } : {}),
      ...(active !== undefined ? { isActive: active === "true" } : {})
    };

    return this.prisma.professionalSpecialSchedule.findMany({
      where,
      skip,
      take,
      include: {
        professional: true,
        branch: true,
        chair: true
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    });
  }

  async findOneSpecial(actor: AuthUser, id: string) {
    const schedule = await this.prisma.professionalSpecialSchedule.findFirst({
      where: { id, branchId: branchScope(actor), professional: { organizationId: actor.organizationId } },
      include: { professional: true, branch: true, chair: true }
    });

    if (!schedule) throw new NotFoundException("Special Schedule not found");
    return schedule;
  }

  async createSpecial(actor: AuthUser, dto: CreateProfessionalSpecialScheduleDto) {
    await this.validateReferences(actor, dto.professionalId, dto.branchId, dto.chairId);
    this.validateSimultaneousChairs(dto.simultaneousChairs ?? 1);
    this.validateTimeRange(dto.startTime, dto.endTime, dto.breakStartTime, dto.breakEndTime);
    await this.validateInsideBranchHours(actor, dto.branchId, dto.startTime, dto.endTime);
    await this.ensureNoSpecialOverlap(actor, {
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime
    });
    if (dto.chairId) {
      await this.ensureNoChairSpecialOverlap(actor, {
        chairId: dto.chairId,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime
      });
    }

    const schedule = await this.prisma.professionalSpecialSchedule.create({
      data: {
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        chairId: dto.chairId,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStartTime: dto.breakStartTime,
        breakEndTime: dto.breakEndTime,
        simultaneousChairs: dto.simultaneousChairs ?? 1,
        attendanceMode: dto.attendanceMode
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "ProfessionalSpecialSchedule",
        entityId: schedule.id,
        action: "create",
        after: {
          professionalId: schedule.professionalId,
          branchId: schedule.branchId,
          chairId: schedule.chairId,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          simultaneousChairs: schedule.simultaneousChairs,
          attendanceMode: schedule.attendanceMode
        }
      }
    });

    return this.findOneSpecial(actor, schedule.id);
  }

  async updateSpecial(actor: AuthUser, id: string, dto: UpdateProfessionalSpecialScheduleDto) {
    const current = await this.findOneSpecial(actor, id);

    const professionalId = dto.professionalId ?? current.professionalId;
    const branchId = dto.branchId ?? current.branchId;
    const chairId = "chairId" in dto ? dto.chairId ?? undefined : current.chairId ?? undefined;
    const date = dto.date ?? current.date;
    const startTime = dto.startTime ?? current.startTime;
    const endTime = dto.endTime ?? current.endTime;
    const breakStartTime = "breakStartTime" in dto ? dto.breakStartTime ?? undefined : current.breakStartTime ?? undefined;
    const breakEndTime = "breakEndTime" in dto ? dto.breakEndTime ?? undefined : current.breakEndTime ?? undefined;
    const simultaneousChairs = dto.simultaneousChairs ?? current.simultaneousChairs;
    const attendanceMode = dto.attendanceMode ?? current.attendanceMode;
    const isActive = dto.isActive ?? current.isActive;

    await this.validateReferences(actor, professionalId, branchId, chairId);
    this.validateSimultaneousChairs(simultaneousChairs);
    this.validateTimeRange(startTime, endTime, breakStartTime, breakEndTime);
    await this.validateInsideBranchHours(actor, branchId, startTime, endTime);
    if (isActive) {
      await this.ensureNoSpecialOverlap(actor, { professionalId, branchId, date, startTime, endTime }, id);
      if (chairId) {
        await this.ensureNoChairSpecialOverlap(actor, { chairId, date, startTime, endTime }, id);
      }
    }

    await this.prisma.professionalSpecialSchedule.update({
      where: { id },
      data: {
        professionalId,
        branchId,
        chairId: "chairId" in dto ? dto.chairId : undefined,
        date,
        startTime,
        endTime,
        breakStartTime: "breakStartTime" in dto ? dto.breakStartTime : breakStartTime,
        breakEndTime: "breakEndTime" in dto ? dto.breakEndTime : breakEndTime,
        simultaneousChairs: dto.simultaneousChairs,
        attendanceMode: dto.attendanceMode,
        isActive: dto.isActive
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "ProfessionalSpecialSchedule",
        entityId: id,
        action: "update",
        after: {
          professionalId,
          branchId,
          chairId,
          date,
          startTime,
          endTime,
          simultaneousChairs,
          attendanceMode,
          isActive: dto.isActive
        }
      }
    });

    return this.findOneSpecial(actor, id);
  }

  async deactivateSpecial(actor: AuthUser, id: string) {
    return this.updateSpecial(actor, id, { isActive: false });
  }

  private async ensureNoSpecialOverlap(
    actor: AuthUser,
    candidate: { professionalId: string; branchId: string; date: string; startTime: string; endTime: string },
    excludeId?: string
  ) {
    const existing = await this.prisma.professionalSpecialSchedule.findMany({
      where: {
        professionalId: candidate.professionalId,
        branchId: candidate.branchId,
        date: candidate.date,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        professional: { organizationId: actor.organizationId }
      }
    });

    const candidateStart = this.toMinutes(candidate.startTime);
    const candidateEnd = this.toMinutes(candidate.endTime);

    const overlap = existing.some((row) => {
      const rowStart = this.toMinutes(row.startTime);
      const rowEnd = this.toMinutes(row.endTime);
      return candidateStart < rowEnd && candidateEnd > rowStart;
    });

    if (overlap) {
      throw new BadRequestException("Overlapping special schedule for professional and branch");
    }
  }

  private async ensureNoChairSpecialOverlap(
    actor: AuthUser,
    candidate: { chairId: string; date: string; startTime: string; endTime: string },
    excludeId?: string
  ) {
    const existing = await this.prisma.professionalSpecialSchedule.findMany({
      where: {
        chairId: candidate.chairId,
        date: candidate.date,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        professional: { organizationId: actor.organizationId }
      }
    });

    const candidateStart = this.toMinutes(candidate.startTime);
    const candidateEnd = this.toMinutes(candidate.endTime);
    const overlap = existing.some((row) => {
      const rowStart = this.toMinutes(row.startTime);
      const rowEnd = this.toMinutes(row.endTime);
      return candidateStart < rowEnd && candidateEnd > rowStart;
    });

    if (overlap) {
      throw new BadRequestException("Overlapping special schedule for selected chair");
    }
  }
}
