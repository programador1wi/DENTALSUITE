import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { OrthodonticProgressService } from "./orthodontic-progress.service";
import { Readable } from "stream";
import { AppointmentsService } from "../appointments/appointments.service";
import { OrthodonticsReportQueryDto, ScheduleOrthodonticControlDto } from "./dto/orthodontics.dto";

@Injectable()
export class OrthodonticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: OrthodonticProgressService,
    private readonly appointmentsService: AppointmentsService
  ) {}

  async getPatientsReport(user: AuthUser, query: OrthodonticsReportQueryDto) {
      const { page = 1, limit = 20, branchId, status, professionalId, search, delayStatus } = query;
      const pagination = resolvePagination({ page, pageSize: limit });

      const where: Prisma.TreatmentPlanWhereInput = {
        organizationId: user.organizationId,
        kind: "ORTHODONTICS",
        branchId: branchScope(user, branchId),
        orthodonticProfile: { isNot: null }
      };

      if (status) {
        where.status = status;
      }

      if (professionalId) {
        where.professionalId = professionalId;
      }

      if (search) {
        where.patient = {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ]
        };
      }

      if (delayStatus) {
        where.orthodonticProgressSnapshots = {
          some: { progressStatus: delayStatus }
        };
      }

      const [items, total] = await Promise.all([
        this.prisma.treatmentPlan.findMany({
          where,
          include: {
            patient: true,
            professional: true,
            branch: true,
            orthodonticProfile: true,
            orthodonticProgressSnapshots: {
              orderBy: { calculatedAt: 'desc' },
              take: 1
            }
          },
          skip: pagination.skip,
          take: pagination.take
        }),
        this.prisma.treatmentPlan.count({ where })
      ]);

      const progressByTreatment = await this.progressService.getProgressSummaries(items.map((item) => item.id));
      const data = items.map((item) => {
        const progress = progressByTreatment.get(item.id);
        if (!progress) throw new NotFoundException("Treatment plan not found");
        return {
          id: item.id,
          branchName: item.branch?.name || null,
          ...progress
        };
      });

      return {
        data,
        meta: {
          total,
          page: pagination.page,
          lastPage: Math.ceil(total / pagination.pageSize) || 1
        }
      };
  }

  async getPatientsReportSummary(user: AuthUser, query: OrthodonticsReportQueryDto) {
      const where: Prisma.TreatmentPlanWhereInput = {
        organizationId: user.organizationId,
        kind: "ORTHODONTICS",
        branchId: branchScope(user, query.branchId),
        orthodonticProfile: { isNot: null }
      };

      const activeWhere: Prisma.TreatmentPlanWhereInput = {
        ...where,
        status: { in: ["ACCEPTED", "IN_PROGRESS"] }
      };

      const now = new Date();
      const date1YearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const date6YearsAgo = new Date(now.getFullYear() - 6, now.getMonth(), now.getDate());
      const date12YearsAgo = new Date(now.getFullYear() - 12, now.getMonth(), now.getDate());

      const [
        activePatients,
        delayedPatients,
        withoutFutureAppointment,
        age1to6,
        age6to12,
        ageOver12,
        missingBirthDate
      ] = await Promise.all([
        this.prisma.treatmentPlan.count({ where: activeWhere }),
        
        this.prisma.orthodonticProgressSnapshot.count({
          where: {
            treatment: activeWhere,
            progressStatus: "DELAYED"
          }
        }),
        
        this.prisma.treatmentPlan.count({
          where: {
            ...activeWhere,
            appointments: {
              none: {
                status: { in: ["SCHEDULED", "CONFIRMED", "PENDING_CONFIRMATION", "ARRIVED", "WAITING_ROOM"] },
                startAt: { gt: new Date() }
              }
            }
          }
        }),
        
        this.prisma.treatmentPlan.count({
          where: { ...activeWhere, patient: { birthDate: { lte: date1YearAgo, gt: date6YearsAgo } } }
        }),
        this.prisma.treatmentPlan.count({
          where: { ...activeWhere, patient: { birthDate: { lte: date6YearsAgo, gt: date12YearsAgo } } }
        }),
        this.prisma.treatmentPlan.count({
          where: { ...activeWhere, patient: { birthDate: { lte: date12YearsAgo } } }
        }),
        this.prisma.treatmentPlan.count({
          where: { ...activeWhere, patient: { birthDate: null } }
        })
      ]);

      return {
        activePatients,
        delayedPatients,
        withoutFutureAppointment,
        age1to6,
        age6to12,
        ageOver12,
        missingBirthDate
      };
  }

  async exportPatientsReportStream(user: AuthUser, query: OrthodonticsReportQueryDto) {
    const items = await this.prisma.treatmentPlan.findMany({
      where: {
        organizationId: user.organizationId,
        kind: "ORTHODONTICS",
        branchId: branchScope(user, query.branchId),
        orthodonticProfile: { isNot: null }
      },
      include: {
        patient: true,
        professional: true,
        orthodonticProfile: true
      }
    });
    
    const stream = new Readable({
      read() {}
    });

    // CSV Header
    stream.push("Paciente,Edad,Movil,Profesional,Inicio,Controles,Estado\n");

    for (const item of items) {
      const patientName = `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`.trim();
      const age = item.patient?.birthDate ? new Date().getFullYear() - item.patient.birthDate.getFullYear() : '';
      const mobile = item.patient?.phone || '';
      const prof = item.professional
        ? `${item.professional.firstName} ${item.professional.lastName}`.trim()
        : '';
      const start = item.orthodonticProfile?.startDate ? item.orthodonticProfile.startDate.toISOString().split('T')[0] : '';
      const controls = item.orthodonticProfile?.plannedControls || '';
      
      const row = [patientName, age, mobile, prof, start, controls, item.status]
        .map((value) => this.csvCell(value))
        .join(",") + "\n";
      stream.push(row);
    }
    
    stream.push(null);
    return stream;
  }

  async createAppointmentDraft(user: AuthUser, treatmentId: string, dto: ScheduleOrthodonticControlDto) {
    const treatment = await this.prisma.treatmentPlan.findFirst({
      where: {
        id: treatmentId,
        organizationId: user.organizationId,
        branchId: branchScope(user)
      },
      select: { id: true, branchId: true, patientId: true }
    });

    if (!treatment) {
      throw new NotFoundException("Treatment plan not found");
    }

    if (dto.branchId && dto.branchId !== treatment.branchId) {
      throw new BadRequestException("La sucursal debe coincidir con la del tratamiento");
    }

    const durationMinutes = dto.durationMinutes ?? 15;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);
    return this.appointmentsService.create(user, {
      branchId: treatment.branchId,
      patientId: treatment.patientId,
      professionalId: dto.professionalId,
      chairId: dto.chairId,
      treatmentPlanId: treatment.id,
      title: "Control de Ortodoncia",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      durationMinutes
    });
  }

  async recalculateProgress(user: AuthUser, treatmentId: string) {
    const treatment = await this.prisma.treatmentPlan.findFirst({
      where: {
        id: treatmentId,
        organizationId: user.organizationId,
        branchId: branchScope(user)
      },
      select: { id: true }
    });
    if (!treatment) throw new NotFoundException("Treatment plan not found");
    return this.progressService.recalculateTreatmentProgress(treatmentId);
  }

  private csvCell(value: string | number) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }
}
