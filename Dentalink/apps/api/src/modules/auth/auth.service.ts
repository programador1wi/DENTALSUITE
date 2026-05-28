import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

const PERMISSION_TEMPLATES = [
  ["system.manage_all", "Manage all", "Global administration", "system"],
  ["dashboard.read", "Read dashboard", "View dashboard", "dashboard"],
  ["users.read", "Read users", "View users", "users"],
  ["users.create", "Create users", "Create users", "users"],
  ["users.update", "Update users", "Update users", "users"],
  ["users.deactivate", "Deactivate users", "Deactivate users", "users"],
  ["roles.read", "Read roles", "View roles", "roles"],
  ["roles.create", "Create roles", "Create roles", "roles"],
  ["roles.update", "Update roles", "Update roles", "roles"],
  ["roles.deactivate", "Deactivate roles", "Deactivate roles", "roles"],
  ["permissions.read", "Read permissions", "View permissions", "permissions"],
  ["permissions.create", "Create permissions", "Create permissions", "permissions"],
  ["permissions.update", "Update permissions", "Update permissions", "permissions"],
  ["permissions.deactivate", "Deactivate permissions", "Deactivate permissions", "permissions"],
  ["branches.read", "Read branches", "View branches", "branches"],
  ["branches.create", "Create branches", "Create branches", "branches"],
  ["branches.update", "Update branches", "Update branches", "branches"],
  ["branches.deactivate", "Deactivate branches", "Deactivate branches", "branches"],
  ["settings.read", "Read settings", "View settings", "settings"],
  ["settings.update", "Update settings", "Update settings", "settings"],
  ["specialties.read", "Read specialties", "View specialties", "specialties"],
  ["specialties.create", "Create specialties", "Create specialties", "specialties"],
  ["specialties.update", "Update specialties", "Update specialties", "specialties"],
  ["specialties.deactivate", "Deactivate specialties", "Deactivate specialties", "specialties"],
  ["professionals.read", "Read professionals", "View professionals", "professionals"],
  ["professionals.create", "Create professionals", "Create professionals", "professionals"],
  ["professionals.update", "Update professionals", "Update professionals", "professionals"],
  ["professionals.deactivate", "Deactivate professionals", "Deactivate professionals", "professionals"],
  ["schedules.read", "Read schedules", "View schedules", "schedules"],
  ["schedules.create", "Create schedules", "Create schedules", "schedules"],
  ["schedules.update", "Update schedules", "Update schedules", "schedules"],
  ["schedules.deactivate", "Deactivate schedules", "Deactivate schedules", "schedules"],
  ["chairs.read", "Read chairs", "View chairs", "chairs"],
  ["chairs.create", "Create chairs", "Create chairs", "chairs"],
  ["chairs.update", "Update chairs", "Update chairs", "chairs"],
  ["chairs.deactivate", "Deactivate chairs", "Deactivate chairs", "chairs"],
  ["payment_methods.read", "Read payment methods", "View payment methods", "payment_methods"],
  ["payment_methods.create", "Create payment methods", "Create payment methods", "payment_methods"],
  ["payment_methods.update", "Update payment methods", "Update payment methods", "payment_methods"],
  [
    "payment_methods.deactivate",
    "Deactivate payment methods",
    "Deactivate payment methods",
    "payment_methods"
  ],
  [
    "procedure_categories.read",
    "Read procedure categories",
    "View procedure categories",
    "procedure_categories"
  ],
  [
    "procedure_categories.create",
    "Create procedure categories",
    "Create procedure categories",
    "procedure_categories"
  ],
  [
    "procedure_categories.update",
    "Update procedure categories",
    "Update procedure categories",
    "procedure_categories"
  ],
  [
    "procedure_categories.deactivate",
    "Deactivate procedure categories",
    "Deactivate procedure categories",
    "procedure_categories"
  ],
  ["procedures.read", "Read procedures", "View procedures", "procedures"],
  ["procedures.create", "Create procedures", "Create procedures", "procedures"],
  ["procedures.update", "Update procedures", "Update procedures", "procedures"],
  ["procedures.deactivate", "Deactivate procedures", "Deactivate procedures", "procedures"],
  ["price_lists.read", "Read price lists", "View price lists", "price_lists"],
  ["price_lists.create", "Create price lists", "Create price lists", "price_lists"],
  ["price_lists.update", "Update price lists", "Update price lists", "price_lists"],
  ["price_lists.deactivate", "Deactivate price lists", "Deactivate price lists", "price_lists"],
  ["patients.read", "Read patients", "View patients", "patients"],
  ["patients.create", "Create patients", "Create patients", "patients"],
  ["patients.update", "Update patients", "Update patients", "patients"],
  ["patients.deactivate", "Deactivate patients", "Deactivate patients", "patients"],
  ["patients.notes.create", "Create patient notes", "Create patient notes", "patients"],
  ["patients.alerts.create", "Create patient alerts", "Create patient alerts", "patients"],
  ["appointments.read", "Read appointments", "View appointments", "appointments"],
  ["appointments.create", "Create appointments", "Create appointments", "appointments"],
  ["appointments.update", "Update appointments", "Update appointments", "appointments"],
  ["appointments.cancel", "Cancel appointments", "Cancel appointments", "appointments"],
  ["appointments.status.update", "Update appointment status", "Update appointment status", "appointments"],
  ["appointments.overbook", "Overbook appointments", "Allow appointment overbooking", "appointments"],
  ["appointments.block", "Block appointment slots", "Block appointment slots", "appointments"],
  ["clinical.read", "Read clinical record", "View clinical record", "clinical"],
  ["clinical.history.update", "Update medical history", "Update medical history", "clinical"],
  ["clinical.evolutions.create", "Create clinical evolutions", "Create clinical evolutions", "clinical"],
  ["clinical.evolutions.sign", "Sign clinical evolutions", "Sign clinical evolutions", "clinical"],
  ["clinical.prescriptions.create", "Create prescriptions", "Create prescriptions", "clinical"],
  ["clinical.documents.create", "Create clinical documents", "Create clinical documents", "clinical"],
  [
    "clinical.templates.manage",
    "Manage clinical templates",
    "Manage clinical document templates",
    "clinical"
  ],
  ["clinical.odontogram.read", "Read odontogram", "View odontogram and tooth history", "clinical"],
  ["clinical.odontogram.write", "Write odontogram", "Create and update odontogram records", "clinical"],
  [
    "clinical.periodontogram.read",
    "Read periodontogram",
    "View periodontal charts and comparisons",
    "clinical"
  ],
  ["clinical.periodontogram.write", "Write periodontogram", "Create periodontal charts", "clinical"],
  ["treatment_plans.read", "Read treatment plans", "View treatment plans", "treatment_plans"],
  ["treatment_plans.create", "Create treatment plans", "Create treatment plans", "treatment_plans"],
  ["treatment_plans.update", "Update treatment plans", "Update treatment plans", "treatment_plans"],
  [
    "treatment_plans.status.update",
    "Update treatment plan item status",
    "Update treatment plan item status",
    "treatment_plans"
  ],
  [
    "treatment_plans.alternatives.manage",
    "Manage treatment plan alternatives",
    "Manage treatment plan alternatives",
    "treatment_plans"
  ],
  ["budgets.read", "Read budgets", "View budgets", "budgets"],
  ["budgets.create", "Create budgets", "Generate budgets", "budgets"],
  ["budgets.update", "Update budgets", "Update budgets", "budgets"],
  ["budgets.send", "Send budgets", "Send budgets to patients", "budgets"],
  ["budgets.accept", "Accept budgets", "Accept budget and treatment plan", "budgets"],
  ["budgets.reject", "Reject budgets", "Reject budget", "budgets"],
  ["budgets.print", "Print budgets", "Print budget document", "budgets"],
  ["payments.read", "Read payments", "View payments and collections", "payments"],
  ["payments.create", "Create payments", "Register patient payments", "payments"],
  ["payments.allocate", "Allocate payments", "Allocate payments to treatment items", "payments"],
  ["payments.refund", "Refund payments", "Register payment refunds", "payments"],
  [
    "payments.override.closed_cash",
    "Override closed cash register",
    "Allow receiving payments without open cash register",
    "payments"
  ],
  ["payment_links.create", "Create payment links", "Create simulated online payment links", "payments"],
  ["installments.read", "Read installments", "View installment plans and installments", "installments"],
  ["installments.create", "Create installments", "Create installment plans", "installments"],
  ["installments.pay", "Pay installments", "Register installment payments", "installments"],
  ["cash_register.read", "Read cash register", "View cash register shifts and balances", "cash_register"],
  ["cash_register.open", "Open cash register", "Open cash register shift", "cash_register"],
  ["cash_register.close", "Close cash register", "Close cash register shift", "cash_register"],
  [
    "cash_register.close_any",
    "Close any cash register",
    "Close another user's cash register",
    "cash_register"
  ],
  ["cash_register.move", "Create cash movement", "Register manual cash movements", "cash_register"],
  [
    "accounts_receivable.read",
    "Read accounts receivable",
    "View outstanding balances and overdue installments",
    "accounts_receivable"
  ],
  ["collections.read", "Read collections", "View collection cases", "collections"],
  ["collections.create", "Create collections", "Create collection cases", "collections"],
  ["collections.detect", "Detect collections", "Detect overdue installments and create cases", "collections"],
  ["collections.update", "Update collections", "Update case status and assignment", "collections"],
  [
    "collections.activities.create",
    "Create collection activities",
    "Register collection calls/messages",
    "collections"
  ],
  ["files.read", "Read files", "View patient files and attachments", "documents"],
  ["files.upload", "Upload files", "Upload patient files and attachments", "documents"],
  ["consent_templates.read", "Read consent templates", "View consent templates", "documents"],
  ["consent_templates.create", "Create consent templates", "Create consent templates", "documents"],
  ["consent_templates.update", "Update consent templates", "Update consent templates", "documents"],
  [
    "consent_templates.deactivate",
    "Deactivate consent templates",
    "Deactivate consent templates",
    "documents"
  ],
  ["consents.read", "Read consents", "View generated consents", "documents"],
  ["consents.create", "Create consents", "Generate consents for patients", "documents"],
  ["consents.sign", "Sign consents", "Sign and lock consents", "documents"],
  ["consents.pdf", "Download consent PDF", "Download signed consent snapshot", "documents"],
  ["reports.read", "Read reports", "View dashboards and reports", "reports"],
  ["reports.export", "Export reports", "Export reports in CSV/XLSX", "reports"],
  ["lab_providers.read", "Read lab providers", "View laboratory providers", "labs"],
  ["lab_providers.create", "Create lab providers", "Create laboratory providers", "labs"],
  ["lab_providers.update", "Update lab providers", "Update laboratory providers", "labs"],
  ["lab_providers.deactivate", "Deactivate lab providers", "Deactivate laboratory providers", "labs"],
  ["lab_orders.read", "Read lab orders", "View laboratory orders", "labs"],
  ["lab_orders.create", "Create lab orders", "Create laboratory orders", "labs"],
  ["lab_orders.update", "Update lab orders", "Update laboratory order status", "labs"],
  ["lab_orders.cost.update", "Update lab order cost", "Update laboratory order costs", "labs"],
  ["lab_profitability.read", "Read lab profitability", "View treatment profitability with lab costs", "labs"],
  ["suppliers.read", "Read suppliers", "View suppliers", "inventory"],
  ["suppliers.create", "Create suppliers", "Create suppliers", "inventory"],
  ["suppliers.update", "Update suppliers", "Update suppliers", "inventory"],
  ["suppliers.deactivate", "Deactivate suppliers", "Deactivate suppliers", "inventory"],
  ["inventory.read", "Read inventory", "View inventory items", "inventory"],
  ["inventory.create", "Create inventory items", "Create inventory items", "inventory"],
  ["inventory.update", "Update inventory items", "Update inventory items", "inventory"],
  ["inventory.deactivate", "Deactivate inventory items", "Deactivate inventory items", "inventory"],
  ["inventory.movements.read", "Read inventory movements", "View inventory movements", "inventory"],
  ["inventory.movements.create", "Create inventory movements", "Create inventory movements", "inventory"],
  ["inventory.alerts.read", "Read inventory alerts", "View minimum stock alerts", "inventory"]
] as const;

const ROLE_TEMPLATES = [
  { name: "SUPER_ADMIN", permissions: PERMISSION_TEMPLATES.map(([key]) => key) },
  {
    name: "ADMIN",
    permissions: PERMISSION_TEMPLATES.map(([key]) => key).filter((key) => key !== "system.manage_all")
  },
  {
    name: "RECEPTIONIST",
    permissions: [
      "dashboard.read",
      "users.read",
      "branches.read",
      "professionals.read",
      "schedules.read",
      "patients.read",
      "patients.create",
      "patients.update",
      "patients.notes.create",
      "patients.alerts.create",
      "appointments.read",
      "appointments.create",
      "appointments.update",
      "appointments.cancel",
      "appointments.status.update",
      "appointments.block",
      "clinical.read",
      "clinical.history.update",
      "clinical.evolutions.create",
      "clinical.prescriptions.create",
      "clinical.documents.create",
      "clinical.odontogram.read",
      "clinical.periodontogram.read",
      "treatment_plans.read",
      "treatment_plans.create",
      "treatment_plans.update",
      "budgets.read",
      "budgets.create",
      "budgets.send",
      "budgets.print",
      "payments.read",
      "payments.create",
      "payments.allocate",
      "payment_links.create",
      "installments.read",
      "accounts_receivable.read",
      "collections.read",
      "collections.create",
      "collections.detect",
      "collections.activities.create",
      "files.read",
      "files.upload",
      "consent_templates.read",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "lab_providers.read",
      "lab_orders.read",
      "lab_orders.create",
      "inventory.read",
      "inventory.movements.read"
    ]
  },
  {
    name: "DENTIST",
    permissions: [
      "dashboard.read",
      "procedures.read",
      "price_lists.read",
      "patients.read",
      "patients.notes.create",
      "patients.alerts.create",
      "appointments.read",
      "appointments.status.update",
      "clinical.read",
      "clinical.history.update",
      "clinical.evolutions.create",
      "clinical.evolutions.sign",
      "clinical.prescriptions.create",
      "clinical.documents.create",
      "clinical.odontogram.read",
      "clinical.odontogram.write",
      "clinical.periodontogram.read",
      "clinical.periodontogram.write",
      "treatment_plans.read",
      "treatment_plans.create",
      "treatment_plans.update",
      "treatment_plans.status.update",
      "treatment_plans.alternatives.manage",
      "budgets.read",
      "budgets.create",
      "budgets.update",
      "budgets.send",
      "budgets.accept",
      "budgets.reject",
      "budgets.print",
      "payments.read",
      "payments.allocate",
      "accounts_receivable.read",
      "installments.read",
      "files.read",
      "files.upload",
      "consent_templates.read",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "lab_providers.read",
      "lab_orders.read",
      "lab_orders.create",
      "lab_orders.update",
      "lab_orders.cost.update",
      "lab_profitability.read",
      "inventory.read",
      "inventory.movements.read",
      "inventory.alerts.read"
    ]
  },
  {
    name: "CASHIER",
    permissions: [
      "dashboard.read",
      "payment_methods.read",
      "price_lists.read",
      "patients.read",
      "appointments.read",
      "payments.read",
      "payments.create",
      "payments.allocate",
      "payments.refund",
      "payment_links.create",
      "installments.read",
      "installments.create",
      "installments.pay",
      "cash_register.read",
      "cash_register.open",
      "cash_register.close",
      "cash_register.move",
      "accounts_receivable.read",
      "collections.read",
      "collections.create",
      "collections.detect",
      "collections.update",
      "collections.activities.create",
      "files.read",
      "files.upload",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "inventory.read",
      "inventory.movements.read",
      "inventory.movements.create",
      "inventory.alerts.read"
    ]
  },
  {
    name: "CEYE",
    permissions: [
      "dashboard.read",
      "branches.read",
      "patients.read",
      "appointments.read",
      "clinical.read",
      "professionals.read",
      "schedules.read",
      "chairs.read",
      "lab_providers.read",
      "lab_orders.read",
      "lab_orders.update",
      "suppliers.read",
      "inventory.read",
      "inventory.update",
      "inventory.movements.read",
      "inventory.movements.create",
      "inventory.alerts.read",
      "reports.read"
    ]
  },
  {
    name: "MANAGER",
    permissions: [
      "dashboard.read",
      "users.read",
      "roles.read",
      "branches.read",
      "settings.read",
      "specialties.read",
      "professionals.read",
      "schedules.read",
      "chairs.read",
      "payment_methods.read",
      "procedure_categories.read",
      "procedures.read",
      "price_lists.read",
      "patients.read",
      "patients.create",
      "patients.update",
      "patients.deactivate",
      "patients.notes.create",
      "patients.alerts.create",
      "appointments.read",
      "appointments.create",
      "appointments.update",
      "appointments.cancel",
      "appointments.status.update",
      "appointments.overbook",
      "appointments.block",
      "clinical.read",
      "clinical.history.update",
      "clinical.evolutions.create",
      "clinical.evolutions.sign",
      "clinical.prescriptions.create",
      "clinical.documents.create",
      "clinical.templates.manage",
      "clinical.odontogram.read",
      "clinical.odontogram.write",
      "clinical.periodontogram.read",
      "clinical.periodontogram.write",
      "treatment_plans.read",
      "treatment_plans.create",
      "treatment_plans.update",
      "treatment_plans.status.update",
      "treatment_plans.alternatives.manage",
      "budgets.read",
      "budgets.create",
      "budgets.update",
      "budgets.send",
      "budgets.accept",
      "budgets.reject",
      "budgets.print",
      "payments.read",
      "payments.create",
      "payments.allocate",
      "payments.refund",
      "payment_links.create",
      "installments.read",
      "installments.create",
      "installments.pay",
      "cash_register.read",
      "cash_register.open",
      "cash_register.close",
      "cash_register.move",
      "accounts_receivable.read",
      "collections.read",
      "collections.create",
      "collections.detect",
      "collections.update",
      "collections.activities.create",
      "files.read",
      "files.upload",
      "consent_templates.read",
      "consent_templates.create",
      "consent_templates.update",
      "consent_templates.deactivate",
      "consents.read",
      "consents.create",
      "consents.sign",
      "consents.pdf",
      "reports.read",
      "reports.export",
      "lab_providers.read",
      "lab_providers.create",
      "lab_providers.update",
      "lab_providers.deactivate",
      "lab_orders.read",
      "lab_orders.create",
      "lab_orders.update",
      "lab_orders.cost.update",
      "lab_profitability.read",
      "suppliers.read",
      "suppliers.create",
      "suppliers.update",
      "suppliers.deactivate",
      "inventory.read",
      "inventory.create",
      "inventory.update",
      "inventory.deactivate",
      "inventory.movements.read",
      "inventory.movements.create",
      "inventory.alerts.read"
    ]
  }
] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  async registerOrganization(dto: RegisterOrganizationDto, meta: RequestMeta) {
    const adminEmail = dto.adminEmail.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) {
      throw new ConflictException("Admin email already exists");
    }

    const organizationSlug = this.generateSlug(dto.organizationName);
    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          legalName: dto.legalName?.trim(),
          taxId: dto.taxId?.trim(),
          phone: dto.organizationPhone?.trim(),
          email: dto.organizationEmail?.toLowerCase().trim(),
          address: dto.organizationAddress?.trim(),
          slug: `${organizationSlug}-${randomUUID().slice(0, 8)}`,
          isActive: true,
          status: "ACTIVE"
        }
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: dto.branchName.trim(),
          phone: dto.branchPhone?.trim(),
          email: dto.branchEmail?.toLowerCase().trim(),
          address: dto.branchAddress?.trim(),
          city: dto.branchCity?.trim(),
          state: dto.branchState?.trim(),
          country: dto.branchCountry?.trim() ?? "MX",
          timezone: dto.branchTimezone?.trim() ?? "America/Mexico_City",
          code: "MAIN",
          isActive: true,
          status: "ACTIVE"
        }
      });

      await this.ensurePermissionTemplates(tx);
      const roles = await this.ensureOrganizationRoles(tx, organization.id);
      const superAdmin = roles.find((role) => role.name === "SUPER_ADMIN");
      if (!superAdmin) throw new Error("SUPER_ADMIN role was not created");

      const createdUser = await tx.user.create({
        data: {
          organizationId: organization.id,
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          email: adminEmail,
          phone: dto.adminPhone?.trim(),
          passwordHash,
          roleId: superAdmin.id,
          isActive: true,
          status: "ACTIVE"
        }
      });

      await tx.userRole.create({ data: { userId: createdUser.id, roleId: superAdmin.id } });
      await tx.userBranch.create({ data: { userId: createdUser.id, branchId: branch.id, isPrimary: true } });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          userId: createdUser.id,
          actorUserId: createdUser.id,
          action: "register_organization",
          entity: "Organization",
          entityId: organization.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            organizationName: organization.name,
            branchName: branch.name,
            adminEmail: createdUser.email
          },
          after: {
            organizationName: organization.name,
            branchName: branch.name,
            adminEmail: createdUser.email
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: this.authUserInclude()
      });
    });

    const tokens = await this.issueTokens(user.id, user.email, user.organizationId, meta);
    return { user: this.serializeUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: this.authUserInclude()
    });

    if (!user || !user.isActive || user.status !== "ACTIVE" || user.deletedAt) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokens(user.id, user.email, user.organizationId, meta);
    return {
      user: this.serializeUser(user),
      ...tokens
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const activeSessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: this.authUserInclude()
        }
      }
    });

    const matched = await this.findMatchingSession(activeSessions, refreshToken);
    if (!matched || !matched.user.isActive || matched.user.status !== "ACTIVE" || matched.user.deletedAt) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.session.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() }
    });

    const tokens = await this.issueTokens(
      matched.userId,
      matched.user.email,
      matched.user.organizationId,
      meta
    );
    return { user: this.serializeUser(matched.user), ...tokens };
  }

  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return { success: true };
    }

    const sessions = await this.prisma.session.findMany({ where: { userId, revokedAt: null } });
    const matched = await this.findMatchingSession(sessions, refreshToken);
    if (matched) {
      await this.prisma.session.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() }
      });
    }

    return { success: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    organizationId: string,
    meta: RequestMeta
  ): Promise<TokenPair> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const refreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, organizationId },
        {
          secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
          expiresIn: accessExpiresIn as JwtSignOptions["expiresIn"]
        }
      ),
      this.jwtService.signAsync(
        { sub: userId, email, organizationId, tokenId: refreshTokenId },
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
          expiresIn: refreshExpiresIn as JwtSignOptions["expiresIn"]
        }
      )
    ]);

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: await bcrypt.hash(refreshToken, 12),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + this.durationToMs(refreshExpiresIn))
      }
    });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private async findMatchingSession<T extends { refreshTokenHash: string }>(
    records: T[],
    plainToken: string
  ): Promise<T | null> {
    for (const record of records) {
      if (await bcrypt.compare(plainToken, record.refreshTokenHash)) {
        return record;
      }
    }
    return null;
  }

  private durationToMs(value: string): number {
    const match = /^(\d+)([mhd])$/.exec(value);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === "m") return amount * 60 * 1000;
    if (unit === "h") return amount * 60 * 60 * 1000;
    return amount * 24 * 60 * 60 * 1000;
  }

  private authUserInclude() {
    return {
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } }
            }
          }
        }
      },
      permissions: { include: { permission: true } },
      branches: true
    } as const;
  }

  private serializeUser(
    user: Prisma.UserGetPayload<{ include: ReturnType<AuthService["authUserInclude"]> }>
  ) {
    const roleNames = user.roles.map((entry) => entry.role.name);
    const roleIds = user.roles.map((entry) => entry.role.id);

    if (user.role && !roleIds.includes(user.role.id)) {
      roleIds.push(user.role.id);
      roleNames.push(user.role.name);
    }

    const permissions = new Set<string>();
    const permissionEntries = user.permissionsOverride
      ? user.permissions
      : [...(user.role?.permissions ?? []), ...user.roles.flatMap((roleEntry) => roleEntry.role.permissions)];

    for (const permissionEntry of permissionEntries) {
      const permission = permissionEntry.permission;
      if (permission.isActive && !permission.deletedAt) {
        permissions.add(permission.key ?? permission.code ?? "");
      }
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleIds,
      roleNames,
      permissions: [...permissions].filter(Boolean),
      branchIds: user.branches.map((branch) => branch.branchId)
    };
  }

  private generateSlug(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  private async ensurePermissionTemplates(tx: Prisma.TransactionClient) {
    for (const [key, name, description, module] of PERMISSION_TEMPLATES) {
      await tx.permission.upsert({
        where: { key },
        update: {
          name,
          description,
          module,
          code: key,
          action: key.split(".")[1] ?? "read",
          resource: key.split(".")[0] ?? module,
          isActive: true,
          isSystem: true
        },
        create: {
          key,
          name,
          description,
          module,
          code: key,
          action: key.split(".")[1] ?? "read",
          resource: key.split(".")[0] ?? module,
          isActive: true,
          isSystem: true
        }
      });
    }
  }

  private async ensureOrganizationRoles(tx: Prisma.TransactionClient, organizationId: string) {
    const roles: { id: string; name: string }[] = [];

    for (const template of ROLE_TEMPLATES) {
      const roleCode = template.name.toLowerCase();
      const existingRole = await tx.role.findFirst({
        where: {
          organizationId,
          OR: [{ name: template.name }, { code: roleCode }]
        }
      });

      const role = existingRole
        ? await tx.role.update({
            where: { id: existingRole.id },
            data: {
              name: template.name,
              description: template.name,
              isSystem: true,
              isActive: true,
              code: roleCode
            }
          })
        : await tx.role.create({
            data: {
              organizationId,
              name: template.name,
              description: template.name,
              isSystem: true,
              isActive: true,
              code: roleCode
            }
          });

      const permissions = await tx.permission.findMany({
        where: { key: { in: [...template.permissions] } },
        select: { id: true }
      });

      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
        skipDuplicates: true
      });

      roles.push({ id: role.id, name: role.name });
    }

    return roles;
  }
}
