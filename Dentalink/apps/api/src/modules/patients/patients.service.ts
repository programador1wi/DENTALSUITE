import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type PatientStatus } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { AddPatientAlertDto } from "./dto/add-patient-alert.dto";
import { AddPatientNoteDto } from "./dto/add-patient-note.dto";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { PatientQueryDto } from "./dto/patient-query.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { MergePatientsDto } from "./dto/merge-patients.dto";

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: PatientQueryDto) {
    const { skip, take } = resolvePagination(query);
    const where: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status as PatientStatus } : {}),
      branchId: branchScope(actor, query.branchId),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { documentNumber: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.hasDebt === "true" ? { status: "DEBTOR" } : {}),
      ...(query.isNew === "true"
        ? {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        : {}),
      ...(query.withoutFutureAppointment === "true"
        ? {
            appointments: {
              none: {
                startAt: { gte: new Date() },
                status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
              }
            }
          }
        : {})
    };

    const rows = await this.prisma.patient.findMany({
      where,
      skip,
      take,
      include: {
        branch: true,
        medicalAlerts: { where: { isActive: true } },
        appointments: {
          where: {
            startAt: { gte: new Date() },
            status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
          },
          orderBy: { startAt: "asc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
        id: row.id,
        branchId: row.branchId,
        branchName: row.branch.name,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        status: row.status,
        createdAt: row.createdAt,
        hasDebt: row.status === "DEBTOR",
        hasFutureAppointment: row.appointments.length > 0,
        isNew: row.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        hasCriticalAlert: row.medicalAlerts.some((alert) => ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase()))
      }));
  }

  async search(actor: AuthUser, q?: string, phone?: string, email?: string, documentNumber?: string) {
    const rows = await this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        branchId: { in: actor.branchIds },
        OR: [
          q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { documentNumber: { contains: q, mode: "insensitive" } }
                ]
              }
            : undefined,
          phone ? { phone } : undefined,
          email ? { email: email.toLowerCase().trim() } : undefined,
          documentNumber ? { documentNumber } : undefined
        ].filter(Boolean) as Prisma.PatientWhereInput[]
      },
      take: 20,
      orderBy: { createdAt: "desc" }
    });

    return rows;
  }

  async findOne(actor: AuthUser, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null },
      include: {
        branch: true,
        agreement: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
            priceList: { select: { id: true, name: true, isDefault: true } }
          }
        },
        contacts: true,
        address: true,
        medicalAlerts: { orderBy: { createdAt: "desc" } },
        notes: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!patient) throw new NotFoundException("Patient not found");

    const [timeline, nextAppointment, lastAppointment] = await Promise.all([
      this.getTimelineInternal(actor, id),
      this.prisma.appointment.findFirst({
        where: {
          patientId: id,
          organizationId: actor.organizationId,
          startAt: { gte: new Date() },
          status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
        },
        orderBy: { startAt: "asc" }
      }),
      this.prisma.appointment.findFirst({
        where: {
          patientId: id,
          organizationId: actor.organizationId,
          startAt: { lt: new Date() }
        },
        orderBy: { startAt: "desc" }
      })
    ]);

    return {
      ...patient,
      summary: {
        nextAppointment: nextAppointment?.startAt ?? null,
        lastAppointment: lastAppointment?.startAt ?? null,
        balance: 0,
        activeTreatments: 0,
        hasCriticalAlert: patient.medicalAlerts.some((alert) =>
          ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase())
        )
      },
      timeline
    };
  }

  async create(actor: AuthUser, dto: CreatePatientDto) {
    await this.validateBranch(actor, dto.branchId);

    const potentialDuplicates = await this.findPotentialDuplicates(actor, {
      phone: dto.phone,
      email: dto.email,
      documentNumber: dto.documentNumber
    });

    const patient = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          gender: dto.gender?.trim(),
          documentType: dto.documentType?.trim(),
          documentNumber: dto.documentNumber?.trim(),
          email: dto.email?.toLowerCase().trim(),
          phone: dto.phone?.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          occupation: dto.occupation?.trim(),
          referredBy: dto.referredBy?.trim(),
          source: dto.source?.trim(),
          status: (dto.status as PatientStatus | undefined) ?? "ACTIVE"
        }
      });

      if (dto.contacts?.length) {
        await tx.patientContact.createMany({
          data: dto.contacts.map((contact) => ({
            patientId: created.id,
            name: contact.name.trim(),
            relationship: contact.relationship?.trim(),
            phone: contact.phone?.trim(),
            email: contact.email?.toLowerCase().trim(),
            isEmergencyContact: contact.isEmergencyContact ?? false
          }))
        });
      }

      if (dto.address) {
        await tx.patientAddress.create({
          data: {
            patientId: created.id,
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          }
        });
      }

      if (dto.medicalAlerts?.length) {
        await tx.patientMedicalAlert.createMany({
          data: dto.medicalAlerts.map((alert) => ({
            patientId: created.id,
            type: alert.type.trim(),
            description: alert.description.trim(),
            severity: alert.severity.trim(),
            isActive: alert.isActive ?? true
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: created.id,
          action: "create",
          after: {
            firstName: created.firstName,
            lastName: created.lastName,
            email: created.email,
            phone: created.phone,
            documentNumber: created.documentNumber
          }
        }
      });

      return created;
    });

    return {
      patient: await this.findOne(actor, patient.id),
      potentialDuplicates
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdatePatientDto) {
    const current = await this.prisma.patient.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null },
      include: { contacts: true, address: true, medicalAlerts: true }
    });

    if (!current) throw new NotFoundException("Patient not found");
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);

    const potentialDuplicates = await this.findPotentialDuplicates(
      actor,
      {
        phone: dto.phone ?? current.phone ?? undefined,
        email: dto.email ?? current.email ?? undefined,
        documentNumber: dto.documentNumber ?? current.documentNumber ?? undefined
      },
      id
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          gender: dto.gender?.trim(),
          documentType: dto.documentType?.trim(),
          documentNumber: dto.documentNumber?.trim(),
          email: dto.email?.toLowerCase().trim(),
          phone: dto.phone?.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          occupation: dto.occupation?.trim(),
          referredBy: dto.referredBy?.trim(),
          source: dto.source?.trim(),
          status: dto.status as PatientStatus | undefined
        }
      });

      if (dto.contacts) {
        await tx.patientContact.deleteMany({ where: { patientId: id } });
        if (dto.contacts.length) {
          await tx.patientContact.createMany({
            data: dto.contacts.map((contact) => ({
              patientId: id,
              name: contact.name.trim(),
              relationship: contact.relationship?.trim(),
              phone: contact.phone?.trim(),
              email: contact.email?.toLowerCase().trim(),
              isEmergencyContact: contact.isEmergencyContact ?? false
            }))
          });
        }
      }

      if (dto.address) {
        await tx.patientAddress.upsert({
          where: { patientId: id },
          create: {
            patientId: id,
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          },
          update: {
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          }
        });
      }

      if (dto.medicalAlerts) {
        await tx.patientMedicalAlert.deleteMany({ where: { patientId: id } });
        if (dto.medicalAlerts.length) {
          await tx.patientMedicalAlert.createMany({
            data: dto.medicalAlerts.map((alert) => ({
              patientId: id,
              type: alert.type.trim(),
              description: alert.description.trim(),
              severity: alert.severity.trim(),
              isActive: alert.isActive ?? true
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: id,
          action: "update_sensitive",
          before: {
            firstName: current.firstName,
            lastName: current.lastName,
            birthDate: current.birthDate,
            gender: current.gender,
            documentType: current.documentType,
            documentNumber: current.documentNumber,
            email: current.email,
            phone: current.phone,
            alternatePhone: current.alternatePhone
          },
          after: {
            firstName: dto.firstName ?? current.firstName,
            lastName: dto.lastName ?? current.lastName,
            birthDate: dto.birthDate ?? current.birthDate,
            gender: dto.gender ?? current.gender,
            documentType: dto.documentType ?? current.documentType,
            documentNumber: dto.documentNumber ?? current.documentNumber,
            email: dto.email ?? current.email,
            phone: dto.phone ?? current.phone,
            alternatePhone: dto.alternatePhone ?? current.alternatePhone
          }
        }
      });
    });

    return {
      patient: await this.findOne(actor, id),
      potentialDuplicates
    };
  }

  async softDelete(actor: AuthUser, id: string) {
    const current = await this.prisma.patient.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null }
    });

    if (!current) throw new NotFoundException("Patient not found");

    await this.prisma.patient.update({
      where: { id },
      data: {
        status: "INACTIVE",
        deletedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Patient",
        entityId: id,
        action: "soft_delete",
        before: {
          status: current.status,
          deletedAt: current.deletedAt
        },
        after: {
          status: "INACTIVE",
          deletedAt: new Date().toISOString()
        }
      }
    });

    return { success: true };
  }

  async addNote(actor: AuthUser, patientId: string, dto: AddPatientNoteDto) {
    await this.ensurePatientExists(actor, patientId);

    const note = await this.prisma.patientNote.create({
      data: {
        patientId,
        userId: actor.id,
        note: dto.note.trim(),
        isPrivate: dto.isPrivate ?? false
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PatientNote",
        entityId: note.id,
        action: "create",
        after: {
          patientId,
          isPrivate: note.isPrivate
        }
      }
    });

    return note;
  }

  async addAlert(actor: AuthUser, patientId: string, dto: AddPatientAlertDto) {
    await this.ensurePatientExists(actor, patientId);

    const alert = await this.prisma.patientMedicalAlert.create({
      data: {
        patientId,
        type: dto.type.trim(),
        description: dto.description.trim(),
        severity: dto.severity.trim(),
        isActive: dto.isActive ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PatientMedicalAlert",
        entityId: alert.id,
        action: "create",
        after: {
          patientId,
          type: alert.type,
          severity: alert.severity,
          isActive: alert.isActive
        }
      }
    });

    return alert;
  }

  async timeline(actor: AuthUser, patientId: string) {
    await this.ensurePatientExists(actor, patientId);
    return this.getTimelineInternal(actor, patientId);
  }

  async merge(actor: AuthUser, dto: MergePatientsDto) {
    const targetPatientId = dto.targetPatientId.trim();
    const sourcePatientId = dto.sourcePatientId.trim();
    if (!targetPatientId || !sourcePatientId || targetPatientId === sourcePatientId) {
      throw new BadRequestException("Select two different patients");
    }

    const [target, source] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: targetPatientId, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null }
      }),
      this.prisma.patient.findFirst({
        where: { id: sourcePatientId, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null }
      })
    ]);
    if (!target || !source) throw new NotFoundException("Patient not found");

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.patientContact.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.patientMedicalAlert.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.patientNote.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.appointment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.medicalCondition.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.allergy.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.medication.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.clinicalEvolution.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.prescription.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.clinicalDocument.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.odontogramRecord.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.toothCondition.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.toothProcedure.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.periodontalChart.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.treatmentPlan.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.budget.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.payment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.paymentLink.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.installmentPlan.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.installment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.refund.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.collectionCase.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.fileAttachment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.consent.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.labOrder.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })
      ]);

      const [targetAddress, targetMedicalHistory] = await Promise.all([
        tx.patientAddress.findUnique({ where: { patientId: target.id } }),
        tx.medicalHistory.findUnique({ where: { patientId: target.id } })
      ]);
      if (!targetAddress) {
        await tx.patientAddress.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      }
      if (!targetMedicalHistory) {
        await tx.medicalHistory.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      }

      await tx.patient.update({
        where: { id: target.id },
        data: {
          agreementId: target.agreementId ?? source.agreementId
        }
      });
      await tx.patient.update({
        where: { id: source.id },
        data: {
          status: "INACTIVE",
          deletedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: target.id,
          action: "merge",
          after: {
            targetPatientId: target.id,
            sourcePatientId: source.id
          }
        }
      });
    });

    return this.findOne(actor, target.id);
  }

  private async getTimelineInternal(actor: AuthUser, patientId: string) {
    const [notes, alerts, patient] = await Promise.all([
      this.prisma.patientNote.findMany({
        where: { patientId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.patientMedicalAlert.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.patient.findFirst({
        where: { id: patientId, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
        select: { createdAt: true }
      })
    ]);

    if (!patient) throw new NotFoundException("Patient not found");

    const events = [
      {
        type: "PATIENT_CREATED",
        date: patient.createdAt,
        payload: {}
      },
      ...notes.map((note) => ({
        type: "NOTE",
        date: note.createdAt,
        payload: {
          id: note.id,
          note: note.note,
          isPrivate: note.isPrivate,
          user: note.user
        }
      })),
      ...alerts.map((alert) => ({
        type: "ALERT",
        date: alert.createdAt,
        payload: {
          id: alert.id,
          type: alert.type,
          description: alert.description,
          severity: alert.severity,
          isActive: alert.isActive
        }
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return events;
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });

    if (!branch) throw new BadRequestException("Invalid branchId");
  }

  private async ensurePatientExists(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null },
      select: { id: true }
    });

    if (!patient) throw new NotFoundException("Patient not found");
  }

  private async findPotentialDuplicates(
    actor: AuthUser,
    fields: { phone?: string; email?: string; documentNumber?: string },
    excludeId?: string
  ) {
    const conditions: Prisma.PatientWhereInput[] = [];

    if (fields.phone?.trim()) {
      conditions.push({ phone: fields.phone.trim() });
    }

    if (fields.email?.trim()) {
      conditions.push({ email: fields.email.toLowerCase().trim() });
    }

    if (fields.documentNumber?.trim()) {
      conditions.push({ documentNumber: fields.documentNumber.trim() });
    }

    if (!conditions.length) return [];

    return this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: conditions
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        documentNumber: true,
        createdAt: true,
        status: true
      },
      take: 10,
      orderBy: { createdAt: "desc" }
    });
  }
}
