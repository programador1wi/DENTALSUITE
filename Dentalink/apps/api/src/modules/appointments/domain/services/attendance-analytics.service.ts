import { Injectable } from "@nestjs/common";
import { PrismaClient, AppointmentStatus } from "@prisma/client";
import { PrismaService } from "../../../../database/prisma.service";

export type ConfidenceLevel = "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";

export interface AttendanceProbabilities {
  attended: number;
  rescheduled: number;
  noShow: number;
}

export interface AttendanceTotals {
  attended: number;
  rescheduled: number;
  noShow: number;
  totalValid: number;
}

export interface RecentAppointment {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  outcome: "ATTENDED" | "RESCHEDULED" | "NO_SHOW";
}

export interface PatientAttendanceStats {
  patientId: string;
  sampleSize: number;
  totals: AttendanceTotals;
  probabilities: AttendanceProbabilities;
  confidence: ConfidenceLevel;
  recentAppointments: RecentAppointment[];
}

@Injectable()
export class AttendanceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the historical attendance statistics for a given patient.
   * Utilizes Laplace smoothing and temporal decay for probability calculation.
   */
  async getPatientAttendanceStats(patientId: string, tenantId?: string): Promise<PatientAttendanceStats> {
    const validStatuses = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
      AppointmentStatus.CANCELLED_RESCHEDULED,
    ];

    // Get up to 50 historical appointments that reached a final resolution
    const history = await this.prisma.appointment.findMany({
      where: {
        patientId,
        status: { in: validStatuses },
        endAt: { lt: new Date() },
        ...(tenantId ? { organizationId: tenantId } : {}),
      },
      orderBy: { startAt: "desc" },
      take: 50,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    });

    const totals: AttendanceTotals = {
      attended: 0,
      rescheduled: 0,
      noShow: 0,
      totalValid: history.length,
    };

    let attendedScore = 0;
    let rescheduledScore = 0;
    let noShowScore = 0;

    const now = new Date().getTime();
    const threeMonthsMs = 3 * 30 * 24 * 60 * 60 * 1000;
    const twelveMonthsMs = 12 * 30 * 24 * 60 * 60 * 1000;

    const recentAppointments: RecentAppointment[] = [];

    for (const appt of history) {
      const outcome = this.mapStatusToOutcome(appt.status);
      if (!outcome) continue;

      recentAppointments.push({
        id: appt.id,
        startAt: appt.startAt.toISOString(),
        endAt: appt.endAt.toISOString(),
        status: appt.status,
        outcome,
      });

      // Base counting
      if (outcome === "ATTENDED") totals.attended++;
      else if (outcome === "RESCHEDULED") totals.rescheduled++;
      else if (outcome === "NO_SHOW") totals.noShow++;

      // Temporal decay weighting
      const ageMs = now - appt.startAt.getTime();
      let weight = 0.5; // Older than 12 months
      if (ageMs <= threeMonthsMs) {
        weight = 1.5; // Last 3 months
      } else if (ageMs <= twelveMonthsMs) {
        weight = 1.0; // 3 to 12 months
      }

      if (outcome === "ATTENDED") attendedScore += weight;
      else if (outcome === "RESCHEDULED") rescheduledScore += weight;
      else if (outcome === "NO_SHOW") noShowScore += weight;
    }

    // Laplace Smoothing (alpha = 1)
    const alpha = 1;
    const totalCategories = 3;
    const denominator = attendedScore + rescheduledScore + noShowScore + (alpha * totalCategories);

    const probAttended = (attendedScore + alpha) / denominator;
    const probRescheduled = (rescheduledScore + alpha) / denominator;
    const probNoShow = (noShowScore + alpha) / denominator;

    // Normalize probabilities slightly to ensure exactly 100% mathematically
    const totalProb = probAttended + probRescheduled + probNoShow;
    
    const probabilities: AttendanceProbabilities = {
      attended: Math.round((probAttended / totalProb) * 100),
      rescheduled: Math.round((probRescheduled / totalProb) * 100),
      noShow: Math.round((probNoShow / totalProb) * 100),
    };

    // Correct rounding errors (ensure sum is 100)
    const diff = 100 - (probabilities.attended + probabilities.rescheduled + probabilities.noShow);
    if (diff !== 0) {
      probabilities.attended += diff; // Add remainder to the highest probability generally, or just attended
    }

    return {
      patientId,
      sampleSize: history.length,
      totals,
      probabilities,
      confidence: this.calculateConfidence(history.length),
      recentAppointments,
    };
  }

  private mapStatusToOutcome(status: AppointmentStatus): "ATTENDED" | "RESCHEDULED" | "NO_SHOW" | null {
    if (status === AppointmentStatus.COMPLETED) return "ATTENDED";
    if (status === AppointmentStatus.NO_SHOW) return "NO_SHOW";
    if (status === AppointmentStatus.RESCHEDULED || status === AppointmentStatus.CANCELLED_RESCHEDULED) return "RESCHEDULED";
    return null;
  }

  private calculateConfidence(sampleSize: number): ConfidenceLevel {
    if (sampleSize <= 2) return "INSUFFICIENT";
    if (sampleSize <= 5) return "LOW";
    if (sampleSize <= 10) return "MEDIUM";
    return "HIGH";
  }
}
