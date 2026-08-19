import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { OrthodonticProgressService } from "./orthodontic-progress.service";
import { Readable } from "stream";
import * as fs from "fs";

@Injectable()
export class OrthodonticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: OrthodonticProgressService
  ) {}

  async getPatientsReport(user: AuthUser, query: any) {
    try {
      const { page = 1, limit = 20, branchId, status, professionalId, search, delayStatus } = query;
      const pagination = resolvePagination({ page: Number(page), pageSize: Number(limit) });

      const where: any = {
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

      const data = await Promise.all(items.map(async item => {
        const progress = await this.progressService.getProgressSummary(item.id);
        
        return {
          id: item.id,
          branchName: item.branch?.name || null,
          ...progress
        };
      }));

      return {
        data,
        meta: {
          total,
          page: pagination.page,
          lastPage: Math.ceil(total / pagination.pageSize) || 1
        }
      };
    } catch (e: any) {
      fs.writeFileSync('ortho-error.log', e.stack || e.message);
      throw e;
    }
  }

  async getPatientsReportSummary(user: AuthUser, query: any) {
    try {
      const where: any = {
        kind: "ORTHODONTICS",
        branchId: branchScope(user, query.branchId),
        orthodonticProfile: { isNot: null }
      };

      const activeWhere = {
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
    } catch (e: any) {
      fs.writeFileSync('ortho-error-summary.log', e.stack || e.message);
      throw e;
    }
  }

  async exportPatientsReportStream(user: AuthUser, query: any) {
    const items = await this.prisma.treatmentPlan.findMany({
      where: {
        kind: "ORTHODONTICS",
        branchId: branchScope(user, query.branchId),
        orthodonticProfile: { isNot: null }
      },
      include: {
        patient: true,
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
      const prof = "ID: " + item.professionalId; // Professional details would normally be joined
      const start = item.orthodonticProfile?.startDate ? item.orthodonticProfile.startDate.toISOString().split('T')[0] : '';
      const controls = item.orthodonticProfile?.plannedControls || '';
      
      const row = `"${patientName}","${age}","${mobile}","${prof}","${start}","${controls}","${item.status}"\n`;
      stream.push(row);
    }
    
    stream.push(null);
    return stream;
  }

  async createAppointmentDraft(user: AuthUser, treatmentId: string, dto: any) {
    const treatment = await this.prisma.treatmentPlan.findUnique({
      where: { id: treatmentId },
      include: { orthodonticProfile: true }
    });

    if (!treatment) {
      throw new NotFoundException("Treatment plan not found");
    }

    const durationMinutes = dto.durationMinutes || 15;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);

    // 1. Validar disponibilidad real (Idempotencia en lógica de negocio para no solapar)
    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: dto.professionalId,
        status: { in: ["SCHEDULED", "CONFIRMED", "ARRIVED", "WAITING_ROOM", "IN_PROGRESS", "PENDING_CONFIRMATION"] },
        OR: [
          { startAt: { lt: endAt }, endAt: { gt: startAt } }
        ]
      }
    });

    if (overlapping) {
      throw new ConflictException("El profesional no tiene disponibilidad en el horario seleccionado (solapamiento).");
    }

    // 2. Crear cita
    const appointment = await this.prisma.appointment.create({
      data: {
        organizationId: treatment.organizationId,
        branchId: dto.branchId || treatment.branchId,
        patientId: treatment.patientId,
        professionalId: dto.professionalId,
        startAt,
        endAt,
        durationMinutes,
        status: "SCHEDULED",
        treatmentPlanId: treatment.id,
        title: "Control de Ortodoncia",
        createdById: user.id
      }
    });

    // 3. Registrar auditoría (Phase 21)
    await this.prisma.auditLog.create({
      data: {
        organizationId: treatment.organizationId,
        branchId: appointment.branchId,
        userId: user.id,
        action: "CREATE_ORTHODONTIC_APPOINTMENT",
        entity: "Appointment",
        entityId: appointment.id,
        after: {
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          professionalId: appointment.professionalId
        }
      }
    });

    // 4. Actualizar el progreso para que el snapshot refleje la nueva cita agendada
    await this.progressService.recalculateTreatmentProgress(treatmentId);

    return appointment;
  }

  async recalculateProgress(user: AuthUser, treatmentId: string) {
    return this.progressService.recalculateTreatmentProgress(treatmentId);
  }
}
