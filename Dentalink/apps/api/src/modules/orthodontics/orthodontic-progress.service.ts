import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrthodonticProgressStatus } from '@prisma/client';

@Injectable()
export class OrthodonticProgressService {
  constructor(private readonly prisma: PrismaService) {}

  public async getProgressSummary(treatmentId: string, cutoffDate: Date = new Date()) {
    const treatment = await this.prisma.treatmentPlan.findUnique({
      where: { id: treatmentId },
      include: {
        patient: true,
        professional: true,
        orthodonticProfile: true,
        orthodonticControls: {
          where: { 
            status: 'COMPLETED'
          },
        },
        _count: {
          select: {
            clinicalEvolutions: {
              where: { annulledAt: null }
            }
          }
        },
        clinicalEvolutions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        appointments: {
          where: {
            status: { in: ['SCHEDULED', 'CONFIRMED', 'PENDING_CONFIRMATION', 'ARRIVED', 'WAITING_ROOM'] },
            startAt: { gt: new Date() }
          },
          orderBy: { startAt: 'asc' },
          take: 1,
        },
        pauses: true
      },
    });

    if (!treatment || !treatment.orthodonticProfile) {
      throw new Error('Treatment or OrthodonticProfile not found');
    }

    const calendarProgress = this.calculateCalendarProgressSync(treatment, cutoffDate);
    const controlProgress = this.calculateControlProgressSync(treatment);
    const progressDifference = this.calculateProgressDifferenceSync(calendarProgress.percentage, controlProgress.percentage);
    const lastEvolution = this.getLastOrthodonticEvolutionSync(treatment);
    const nextControl = this.getNextControlSync(treatment);

    return {
      patientId: treatment.patientId,
      patientName: treatment.patient?.firstName || "",
      patientLastName: treatment.patient?.lastName || "",
      patientGender: treatment.patient?.gender || "",
      patientAge: treatment.patient?.birthDate ? new Date().getFullYear() - treatment.patient.birthDate.getFullYear() : 0,
      patientMobile: treatment.patient?.phone || null,
      professionalName: treatment.professional?.firstName ? `${treatment.professional.firstName} ${treatment.professional.lastName}` : "No asignado",
      treatmentId: treatment.id,
      treatmentPlanId: treatment.id,
      treatmentName: treatment.name || "Ortodoncia",
      orthodonticTreatmentId: treatment.orthodonticProfile.id,
      branchId: treatment.branchId,
      status: treatment.status,
      calendarProgress,
      controlProgress,
      progressDifference,
      lastEvolution,
      nextControl,
      calculatedAt: new Date(),
      calculationVersion: '2.0'
    };
  }

  private calculateCalendarProgressSync(treatment: any, cutoffDate: Date) {
    const { startDate, estimatedMonths } = treatment.orthodonticProfile;
    const { pauses } = treatment;

    if (!startDate) {
      return {
        elapsedPeriods: 0,
        plannedPeriods: estimatedMonths || null,
        percentage: null,
        startedAt: null,
        isExceeded: false,
        isCalculable: false
      };
    }

    if (!estimatedMonths || estimatedMonths <= 0) {
      return {
        elapsedPeriods: 0,
        plannedPeriods: estimatedMonths || null,
        percentage: null,
        startedAt: startDate,
        isExceeded: false,
        isCalculable: false
      };
    }

    // Calculate total ms between startDate and cutoffDate
    const totalMs = Math.max(0, cutoffDate.getTime() - startDate.getTime());

    // Calculate paused ms overlapping with this period
    let pausedMs = 0;
    for (const p of pauses) {
      const pStart = p.startDate.getTime();
      const pEnd = p.endDate ? p.endDate.getTime() : cutoffDate.getTime();

      const overlapStart = Math.max(pStart, startDate.getTime());
      const overlapEnd = Math.min(pEnd, cutoffDate.getTime());

      if (overlapEnd > overlapStart) {
        pausedMs += (overlapEnd - overlapStart);
      }
    }

    const activeMs = Math.max(0, totalMs - pausedMs);
    const msInMonth = 1000 * 60 * 60 * 24 * 30.4368;
    const elapsedPeriods = activeMs / msInMonth;

    const percentage = (elapsedPeriods / estimatedMonths) * 100;

    return {
      elapsedPeriods,
      plannedPeriods: estimatedMonths,
      percentage,
      startedAt: startDate,
      isExceeded: percentage > 100,
      isCalculable: true
    };
  }

  private calculateControlProgressSync(treatment: any) {
    const { estimatedControls } = treatment.orthodonticProfile;
    const { orthodonticControls } = treatment;

    const completedControls = orthodonticControls?.length 
      || treatment._count?.clinicalEvolutions 
      || treatment.clinicalEvolutions?.length 
      || 0;

    if (!estimatedControls || estimatedControls <= 0) {
      return {
        completedControls,
        plannedControls: estimatedControls || null,
        percentage: null,
        displayPercentage: null,
        isCalculable: false
      };
    }

    const percentage = (completedControls / estimatedControls) * 100;

    return {
      completedControls,
      plannedControls: estimatedControls,
      percentage,
      displayPercentage: Math.round(percentage),
      isCalculable: true
    };
  }

  private calculateProgressDifferenceSync(calendarPercentage: number | null, controlPercentage: number | null) {
    if (calendarPercentage === null || controlPercentage === null) {
      return {
        percentagePoints: null,
        displayValue: null,
        status: 'NOT_CALCULABLE'
      };
    }

    // Using control_progress - calendar_progress as requested
    const diff = controlPercentage - calendarPercentage;
    const diffDisplay = Math.round(diff);

    let status = 'ON_TRACK';
    if (diff < -0.5) status = 'DELAYED';
    else if (diff > 0.5) status = 'AHEAD';

    return {
      percentagePoints: diff,
      displayValue: diffDisplay,
      status
    };
  }

  private getLastOrthodonticEvolutionSync(treatment: any) {
    const { clinicalEvolutions } = treatment;
    if (!clinicalEvolutions || clinicalEvolutions.length === 0) {
      return null;
    }
    const last = clinicalEvolutions[0];
    return {
      id: last.id,
      summary: last.note || last.description || 'Evolución',
      performedAt: last.createdAt
    };
  }

  private getNextControlSync(treatment: any) {
    const { orthodonticProfile, appointments } = treatment;
    
    const suggestedAt = orthodonticProfile.nextControlAt || null; // Wait, is it nextControlAt? I need to verify field name. Let me use nextControlAt if exists. Or startDate + frequency.
    // I will verify field names in schema soon.

    const scheduledAppointment = appointments && appointments.length > 0 ? appointments[0] : null;

    return {
      suggestedAt,
      scheduledAppointmentId: scheduledAppointment ? scheduledAppointment.id : null,
      scheduledAt: scheduledAppointment ? scheduledAppointment.startAt : null
    };
  }

  // The requested methods (exposed externally)
  public async calculateCalendarProgress(treatmentId: string, cutoffDate: Date = new Date()) {
    const treatment = await this.prisma.treatmentPlan.findUnique({
      where: { id: treatmentId },
      include: { orthodonticProfile: true, pauses: true }
    });
    if (!treatment) return null;
    return this.calculateCalendarProgressSync(treatment, cutoffDate);
  }

  public async calculateControlProgress(treatmentId: string) {
    const treatment = await this.prisma.treatmentPlan.findUnique({
      where: { id: treatmentId },
      include: { 
        orthodonticProfile: true, 
        orthodonticControls: { where: { status: 'COMPLETED' } },
        _count: { select: { clinicalEvolutions: { where: { annulledAt: null } } } }
      }
    });
    if (!treatment) return null;
    return this.calculateControlProgressSync(treatment);
  }

  public async calculateProgressDifference(treatmentId: string, cutoffDate: Date = new Date()) {
    const cal = await this.calculateCalendarProgress(treatmentId, cutoffDate);
    const ctrl = await this.calculateControlProgress(treatmentId);
    if (!cal || !ctrl) return null;
    return this.calculateProgressDifferenceSync(cal.percentage, ctrl.percentage);
  }

  public async getLastOrthodonticEvolution(treatmentId: string) {
    const treatment = await this.prisma.treatmentPlan.findUnique({
      where: { id: treatmentId },
      include: { clinicalEvolutions: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });
    if (!treatment) return null;
    return this.getLastOrthodonticEvolutionSync(treatment);
  }

  public async getNextSuggestedControl(treatmentId: string) {
    const treatment = await this.prisma.treatmentPlan.findUnique({
      where: { id: treatmentId },
      include: { orthodonticProfile: true }
    });
    if (!treatment) return null;
    return treatment.orthodonticProfile?.nextControlAt || null;
  }

  public async getNextScheduledAppointment(treatmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        treatmentPlanId: treatmentId,
        status: { in: ['SCHEDULED', 'CONFIRMED', 'PENDING_CONFIRMATION', 'ARRIVED', 'WAITING_ROOM'] },
        startAt: { gt: new Date() }
      },
      orderBy: { startAt: 'asc' }
    });
    return appointment;
  }

  public async recalculateTreatmentProgress(treatmentId: string, cutoffDate: Date = new Date()) {
    // Left for backwards compatibility if needed elsewhere
    return this.getProgressSummary(treatmentId, cutoffDate);
  }
}
