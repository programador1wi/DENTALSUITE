import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PriceListItemStatus, PriceListScopeType, PriceListStatus } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";

export type PriceListReportOption = {
  id: string;
  code: string;
  name: string;
  currency: string;
  versionNumber: number;
};

type ResolvedPriceListReportOption = PriceListReportOption & { versionId: string };

type PriceListReportParameters = Record<string, unknown> & {
  branchId?: string;
  branchName?: string;
  priceListId?: string;
  priceListName?: string;
  priceListCode?: string;
  priceListVersionId?: string;
  priceListVersionNumber?: number;
  priceListCurrency?: string;
};

@Injectable()
export class PriceListReportService {
  constructor(private readonly prisma: PrismaService) {}

  async options(actor: AuthUser, branchId: string): Promise<PriceListReportOption[]> {
    await this.authorizedBranch(actor, branchId);
    const options = await this.availableOptions(actor, branchId);
    return options.map(({ versionId: _versionId, ...option }) => option);
  }

  private async availableOptions(actor: AuthUser, branchId: string): Promise<ResolvedPriceListReportOption[]> {
    const now = new Date();
    const lists = await this.prisma.priceList.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        status: PriceListStatus.ACTIVE,
        OR: [
          { branchAssignments: { some: { branchId, isActive: true } } },
          { isDefault: true },
          {
            versionsV2: {
              some: {
                status: PriceListStatus.ACTIVE,
                scopes: {
                  some: {
                    isActive: true,
                    OR: [
                      { scopeType: PriceListScopeType.BRANCH, scopeKey: branchId },
                      { scopeType: PriceListScopeType.ORGANIZATION, scopeKey: actor.organizationId }
                    ]
                  }
                }
              }
            }
          }
        ],
        versionsV2: {
          some: {
            status: PriceListStatus.ACTIVE,
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
            AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
            items: {
              some: {
                status: PriceListItemStatus.ACTIVE,
                procedure: { isActive: true }
              }
            }
          }
        }
      },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        isDefault: true,
        branchAssignments: {
          where: { branchId, isActive: true },
          select: { id: true }
        },
        versionsV2: {
          where: {
            status: PriceListStatus.ACTIVE,
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
            AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
            items: {
              some: {
                status: PriceListItemStatus.ACTIVE,
                procedure: { isActive: true }
              }
            }
          },
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            currency: true,
            scopes: {
              where: { isActive: true },
              select: { scopeType: true, scopeKey: true }
            }
          }
        }
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }]
    });

    return lists.flatMap((list) => {
      const legacyApplicable = list.isDefault || list.branchAssignments.length > 0;
      const version = list.versionsV2.find(
        (candidate) =>
          legacyApplicable ||
          candidate.scopes.some(
            (scope) =>
              (scope.scopeType === PriceListScopeType.BRANCH && scope.scopeKey === branchId) ||
              (scope.scopeType === PriceListScopeType.ORGANIZATION && scope.scopeKey === actor.organizationId)
          )
      );
      return version
        ? [{
            id: list.id,
            code: list.code,
            name: list.name,
            currency: String(version.currency ?? list.currency),
            versionId: version.id,
            versionNumber: version.versionNumber
          }]
        : [];
    });
  }

  async prepareSelection(actor: AuthUser, input: Record<string, unknown>): Promise<PriceListReportParameters> {
    const branchId = String(input.branchId ?? "").trim();
    const priceListId = String(input.priceListId ?? "").trim();
    if (!branchId || !priceListId) throw new BadRequestException("Selecciona los campos obligatorios.");

    const branch = await this.authorizedBranch(actor, branchId);
    const options = await this.availableOptions(actor, branchId);
    const option = options.find((row) => row.id === priceListId);
    if (!option) {
      throw new BadRequestException("El arancel no esta vigente o no esta asignado a la sucursal seleccionada.");
    }

    return {
      ...input,
      branchId,
      branchName: branch.name,
      priceListId: option.id,
      priceListName: option.name,
      priceListCode: option.code,
      priceListVersionId: option.versionId,
      priceListVersionNumber: option.versionNumber,
      priceListCurrency: option.currency
    };
  }

  async rows(actor: AuthUser, input: Record<string, unknown>) {
    const prepared = input.priceListVersionId
      ? (input as PriceListReportParameters)
      : await this.prepareSelection(actor, input);
    const branchId = String(prepared.branchId ?? "");
    const priceListId = String(prepared.priceListId ?? "");
    const versionId = String(prepared.priceListVersionId ?? "");
    const branch = await this.authorizedBranch(actor, branchId);

    const version = await this.prisma.priceListVersion.findFirst({
      where: { id: versionId, priceListId, organizationId: actor.organizationId },
      include: {
        priceList: {
          include: {
            branchAssignments: { where: { branchId, isActive: true }, select: { id: true } }
          }
        },
        scopes: { where: { isActive: true } }
      }
    });
    if (!version) throw new BadRequestException("La version seleccionada del arancel ya no esta disponible.");

    const applicable =
      version.priceList.isDefault ||
      version.priceList.branchAssignments.length > 0 ||
      version.scopes.some(
        (scope) =>
          (scope.scopeType === PriceListScopeType.BRANCH && scope.scopeKey === branchId) ||
          (scope.scopeType === PriceListScopeType.ORGANIZATION && scope.scopeKey === actor.organizationId)
      );
    if (!applicable) throw new ForbiddenException("El arancel ya no esta asignado a la sucursal seleccionada.");

    const items = await this.prisma.priceListVersionItem.findMany({
      where: {
        organizationId: actor.organizationId,
        priceListVersionId: version.id,
        status: PriceListItemStatus.ACTIVE,
        procedure: { isActive: true }
      },
      include: {
        displayCategory: true,
        procedure: { include: { category: true } },
        procedureVariant: true
      }
    });
    if (!items.length) throw new BadRequestException("El arancel seleccionado no tiene tratamientos activos.");

    const ordered = [...items].sort((left, right) => {
      const leftCategory = left.displayCategory ?? left.procedure.category;
      const rightCategory = right.displayCategory ?? right.procedure.category;
      return (
        leftCategory.sortOrder - rightCategory.sortOrder ||
        leftCategory.name.localeCompare(rightCategory.name, "es") ||
        left.procedure.displayId - right.procedure.displayId ||
        left.procedure.code.localeCompare(right.procedure.code, "es") ||
        left.procedure.name.localeCompare(right.procedure.name, "es") ||
        (left.procedureVariant?.name ?? "").localeCompare(right.procedureVariant?.name ?? "", "es")
      );
    });

    return {
      selection: {
        branchId,
        branchName: prepared.branchName ? String(prepared.branchName) : branch.name,
        priceListId,
        priceListName: prepared.priceListName ? String(prepared.priceListName) : version.priceList.name,
        priceListCode: prepared.priceListCode ? String(prepared.priceListCode) : version.priceList.code,
        priceListVersionId: version.id,
        priceListVersionNumber: Number(prepared.priceListVersionNumber ?? version.versionNumber),
        priceListCurrency: String(prepared.priceListCurrency ?? version.currency)
      },
      rows: ordered.map((item) => ({
        Sucursal: prepared.branchName ? String(prepared.branchName) : branch.name,
        Arancel: prepared.priceListName ? String(prepared.priceListName) : version.priceList.name,
        "Versión": Number(prepared.priceListVersionNumber ?? version.versionNumber),
        "Categoría": (item.displayCategory ?? item.procedure.category).name,
        "Código": item.procedure.code,
        Tratamiento: item.procedure.name,
        Variante: item.procedureVariant?.name ?? "",
        Precio: Number(item.basePrice),
        Moneda: String(version.currency),
        "Costo laboratorio": Number(item.laboratoryCost),
        "Permite descuento": item.allowDiscount ? "Sí" : "No",
        "Descuento máximo (%)": Number(item.maxDiscountPercent)
      }))
    };
  }

  fileBaseName(branchName: string, priceListName: string) {
    const slug = (value: string) =>
      value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    return `listado-precios-${slug(branchName)}-${slug(priceListName)}`;
  }

  private async authorizedBranch(actor: AuthUser, branchId: string) {
    if (!branchId || !actor.branchIds.includes(branchId)) {
      throw new ForbiddenException("Sucursal fuera del alcance autorizado.");
    }
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId: actor.organizationId,
        status: "ACTIVE",
        isActive: true,
        deletedAt: null
      },
      select: { id: true, name: true }
    });
    if (!branch) throw new ForbiddenException("Sucursal no disponible.");
    return branch;
  }
}
