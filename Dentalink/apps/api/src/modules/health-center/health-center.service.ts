import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BranchBrandStatus, Prisma } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { CreateBranchDto } from "../branches/dto/create-branch.dto";
import { BranchesService } from "../branches/branches.service";
import { PrismaService } from "../../database/prisma.service";
import { CreateBrandDto, ListBrandsQueryDto, UpdateBrandDto } from "./dto/brand.dto";

const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

@Injectable()
export class HealthCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService
  ) {}

  async overview(actor: AuthUser, query: ListBrandsQueryDto) {
    const [organization, brands] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: actor.organizationId, deletedAt: null },
        select: { id: true, name: true, legalName: true, logoUrl: true, email: true, phone: true, address: true }
      }),
      this.listBrands(actor, query)
    ]);

    if (!organization) throw new NotFoundException("Organization not found");

    return {
      organization,
      brands,
      permissions: {
        canManage: this.hasAny(actor, ["health_center.manage", "brands.create", "brands.update"]),
        canCreateBrand: this.hasAny(actor, ["brands.create", "health_center.manage"]),
        canCreateBranch: this.hasAny(actor, ["branches.create", "health_center.manage"]),
        canAssignBrand: this.hasAny(actor, ["branches.assign_brand", "health_center.manage"]),
        canViewAllBranches: this.canViewAllBranches(actor)
      }
    };
  }

  async listBrands(actor: AuthUser, query: ListBrandsQueryDto = {}) {
    const branchWhere = this.visibleBranchWhere(actor);
    const status = query.status && query.status !== "ALL" ? (query.status as BranchBrandStatus) : undefined;
    const search = query.search?.trim();

    const brands = await this.prisma.branchBrand.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { shortName: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
                { domain: { contains: search, mode: "insensitive" } },
                { publicDomain: { contains: search, mode: "insensitive" } },
                { branches: { some: { ...branchWhere, name: { contains: search, mode: "insensitive" } } } },
                { branches: { some: { ...branchWhere, city: { contains: search, mode: "insensitive" } } } },
                { branches: { some: { ...branchWhere, state: { contains: search, mode: "insensitive" } } } },
                { branches: { some: { ...branchWhere, code: { contains: search, mode: "insensitive" } } } }
              ]
            }
          : {}),
        ...(this.canViewAllBranches(actor) ? {} : { branches: { some: branchWhere } })
      },
      include: {
        branches: {
          where: branchWhere,
          orderBy: { name: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            phone: true,
            countryCode: true,
            secondaryPhone: true,
            email: true,
            replyToEmail: true,
            website: true,
            address: true,
            exteriorNumber: true,
            interiorNumber: true,
            neighborhood: true,
            postalCode: true,
            municipality: true,
            references: true,
            city: true,
            state: true,
            country: true,
            timezone: true,
            agendaSlotMinutes: true,
            agendaStartHour: true,
            agendaEndHour: true,
            status: true,
            isActive: true,
            brandId: true,
            showInEmails: true,
            showInDocuments: true,
            showInOnlineScheduling: true,
            allowOnlineAppointments: true,
            allowNotifications: true
          }
        }
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });

    return brands.map((brand) => ({
      ...brand,
      branchCount: brand.branches.length
    }));
  }

  async getBrand(actor: AuthUser, id: string) {
    const brand = await this.prisma.branchBrand.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        ...(this.canViewAllBranches(actor) ? {} : { branches: { some: this.visibleBranchWhere(actor) } })
      },
      include: {
        branches: {
          where: this.visibleBranchWhere(actor),
          orderBy: { name: "asc" }
        }
      }
    });
    if (!brand) throw new NotFoundException("Brand not found");
    return { ...brand, branchCount: brand.branches.length };
  }

  async createBrand(actor: AuthUser, dto: CreateBrandDto) {
    const normalized = this.normalizeBrandInput(dto);

    await this.assertUniqueBrandFields(actor.organizationId, normalized.slug, normalized.domain, normalized.publicDomain);

    const brand = await this.prisma.$transaction(async (tx) => {
      if (normalized.isDefault) {
        await tx.branchBrand.updateMany({
          where: { organizationId: actor.organizationId, isDefault: true },
          data: { isDefault: false, updatedById: actor.id }
        });
      }

      const created = await tx.branchBrand.create({
        data: {
          organizationId: actor.organizationId,
          code: normalized.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
          ...normalized,
          isDefault: Boolean(normalized.isDefault),
          createdById: actor.id,
          updatedById: actor.id
        }
      });

      await this.audit(tx, actor, "BranchBrand", created.id, "create", undefined, created);
      return created;
    });

    return brand;
  }

  async updateBrand(actor: AuthUser, id: string, dto: UpdateBrandDto) {
    const current = await this.prisma.branchBrand.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!current) throw new NotFoundException("Brand not found");
    if (current.status === BranchBrandStatus.ARCHIVED) throw new BadRequestException("Archived brands must be restored before editing");

    const normalized = this.normalizeBrandInput(dto, current);
    await this.assertUniqueBrandFields(actor.organizationId, normalized.slug, normalized.domain, normalized.publicDomain, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (normalized.isDefault) {
        await tx.branchBrand.updateMany({
          where: { organizationId: actor.organizationId, id: { not: id }, isDefault: true },
          data: { isDefault: false, updatedById: actor.id }
        });
      }

      const row = await tx.branchBrand.update({
        where: { id },
        data: {
          ...normalized,
          updatedById: actor.id
        }
      });

      await this.audit(tx, actor, "BranchBrand", id, "update", current, row);
      return row;
    });

    return updated;
  }

  async archiveBrand(actor: AuthUser, id: string) {
    const current = await this.prisma.branchBrand.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { branches: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } } }
    });
    if (!current) throw new NotFoundException("Brand not found");
    if (current.isDefault) throw new BadRequestException("No puedes archivar la marca predeterminada.");
    if (current.branches.length > 0) throw new BadRequestException("No puedes archivar una marca con sucursales activas.");

    const updated = await this.prisma.branchBrand.update({
      where: { id },
      data: {
        status: BranchBrandStatus.ARCHIVED,
        isActive: false,
        archivedAt: new Date(),
        updatedById: actor.id
      }
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "BranchBrand",
        entityId: id,
        action: "archive",
        before: this.auditValue(current),
        after: this.auditValue(updated)
      }
    });
    return updated;
  }

  async restoreBrand(actor: AuthUser, id: string) {
    const current = await this.prisma.branchBrand.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!current) throw new NotFoundException("Brand not found");

    const updated = await this.prisma.branchBrand.update({
      where: { id },
      data: {
        status: BranchBrandStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
        updatedById: actor.id
      }
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "BranchBrand",
        entityId: id,
        action: "restore",
        before: this.auditValue(current),
        after: this.auditValue(updated)
      }
    });
    return updated;
  }

  async listBrandBranches(actor: AuthUser, id: string) {
    await this.getBrand(actor, id);
    return this.prisma.branch.findMany({
      where: {
        organizationId: actor.organizationId,
        brandId: id,
        deletedAt: null,
        ...this.visibleBranchWhere(actor)
      },
      include: { brand: true, zone: true },
      orderBy: { name: "asc" }
    });
  }

  async createBranchForBrand(actor: AuthUser, id: string, dto: CreateBranchDto) {
    const brand = await this.prisma.branchBrand.findFirst({
      where: { id, organizationId: actor.organizationId, status: BranchBrandStatus.ACTIVE }
    });
    if (!brand) throw new NotFoundException("Brand not found");
    return this.branchesService.create(actor, { ...dto, brandId: id });
  }

  private visibleBranchWhere(actor: AuthUser): Prisma.BranchWhereInput {
    return {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(this.canViewAllBranches(actor) ? {} : { id: { in: actor.branchIds } })
    };
  }

  private canViewAllBranches(actor: AuthUser) {
    return this.hasAny(actor, ["system.manage_all", "branches.view_all", "health_center.manage"]);
  }

  private hasAny(actor: AuthUser, permissions: string[]) {
    if (actor.permissions.includes("system.manage_all")) return true;
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  private normalizeBrandInput(
    dto: Partial<CreateBrandDto>,
    current?: {
      name: string;
      slug: string;
      legalName: string | null;
      shortName: string | null;
      description: string | null;
      logoUrl: string | null;
      logoStorageKey: string | null;
      primaryColor: string;
      secondaryColor: string;
      accentColor: string | null;
      domain: string | null;
      publicDomain: string | null;
      senderName: string | null;
      senderEmail: string | null;
      replyToEmail: string | null;
      phone: string | null;
      website: string | null;
      privacyNoticeUrl: string | null;
      isDefault: boolean;
    }
  ) {
    const name = dto.name?.trim() ?? current?.name;
    if (!name) throw new BadRequestException("El nombre de la marca es obligatorio.");
    const slug = this.normalizeSlug(dto.slug ?? current?.slug ?? name);
    const domain = dto.domain !== undefined ? this.normalizeDomain(dto.domain) : current?.domain ?? undefined;
    const publicDomain = dto.publicDomain !== undefined ? this.normalizeDomain(dto.publicDomain) : current?.publicDomain ?? undefined;

    return {
      name,
      legalName: dto.legalName !== undefined ? this.optionalText(dto.legalName) : current?.legalName ?? undefined,
      shortName: dto.shortName !== undefined ? this.optionalText(dto.shortName) : current?.shortName ?? undefined,
      slug,
      description: dto.description !== undefined ? this.optionalText(dto.description) : current?.description ?? undefined,
      logoUrl: dto.logoUrl !== undefined ? this.optionalText(dto.logoUrl) : current?.logoUrl ?? undefined,
      logoStorageKey: dto.logoStorageKey !== undefined ? this.optionalText(dto.logoStorageKey) : current?.logoStorageKey ?? undefined,
      primaryColor: dto.primaryColor ?? current?.primaryColor ?? "#0f766e",
      secondaryColor: dto.secondaryColor ?? current?.secondaryColor ?? "#0f172a",
      accentColor: dto.accentColor !== undefined ? dto.accentColor : current?.accentColor ?? undefined,
      domain,
      publicDomain,
      senderName: dto.senderName !== undefined ? this.optionalText(dto.senderName) : current?.senderName ?? undefined,
      senderEmail: dto.senderEmail !== undefined ? dto.senderEmail?.trim().toLowerCase() : current?.senderEmail ?? undefined,
      replyToEmail:
        dto.replyToEmail !== undefined ? dto.replyToEmail?.trim().toLowerCase() : current?.replyToEmail ?? undefined,
      phone: dto.phone !== undefined ? this.optionalText(dto.phone) : current?.phone ?? undefined,
      website: dto.website !== undefined ? this.optionalText(dto.website) : current?.website ?? undefined,
      privacyNoticeUrl:
        dto.privacyNoticeUrl !== undefined ? this.optionalText(dto.privacyNoticeUrl) : current?.privacyNoticeUrl ?? undefined,
      isDefault: dto.isDefault ?? current?.isDefault
    };
  }

  private async assertUniqueBrandFields(
    organizationId: string,
    slug: string,
    domain?: string,
    publicDomain?: string,
    excludedId?: string
  ) {
    const conflict = await this.prisma.branchBrand.findFirst({
      where: {
        organizationId,
        id: excludedId ? { not: excludedId } : undefined,
        OR: [
          { slug },
          ...(domain ? [{ domain }] : []),
          ...(publicDomain ? [{ publicDomain }] : [])
        ]
      }
    });
    if (conflict?.slug === slug) throw new BadRequestException("Ya existe una marca con este identificador.");
    if (conflict) throw new BadRequestException("Ya existe una marca con ese dominio.");
  }

  private normalizeSlug(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || slug.length < 2) throw new BadRequestException("El identificador de la marca no es valido.");
    return slug;
  }

  private normalizeDomain(value?: string) {
    const domain = value?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!domain) return undefined;
    if (!DOMAIN_REGEX.test(domain)) throw new BadRequestException("El dominio no tiene un formato valido.");
    return domain;
  }

  private optionalText(value?: string | null) {
    const text = value?.trim();
    return text || undefined;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    before?: unknown,
    after?: unknown
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity,
        entityId,
        action,
        before: before ? this.auditValue(before) : undefined,
        after: after ? this.auditValue(after) : undefined
      }
    });
  }

  private auditValue(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
