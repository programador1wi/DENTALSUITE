import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";

const CATALOG_SELECT = { id: true, name: true } as const;

const DEFAULT_MATERIALS = ["NiTi", "Acero (SS)", "TMA", "CuNiTi", "Estetico (Teflon/Epoxy)"] as const;

const DEFAULT_ARCH_SIZES = [
  ".012",
  ".014",
  ".016",
  ".018",
  ".020",
  ".016 x .016",
  ".016 x .022",
  ".017 x .025",
  ".018 x .025",
  ".019 x .025",
  ".021 x .025"
] as const;

@Injectable()
export class OrthodonticCatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaterials(organizationId: string) {
    const materials = await this.prisma.orthodonticMaterial.findMany({
      where: { organizationId, isActive: true },
      select: CATALOG_SELECT,
      orderBy: { name: "asc" }
    });

    if (materials.length === 0) {
      return this.seedMaterials(organizationId);
    }

    return materials;
  }

  async getArchSizes(organizationId: string) {
    const sizes = await this.prisma.orthodonticArchSize.findMany({
      where: { organizationId, isActive: true },
      select: CATALOG_SELECT,
      orderBy: { name: "asc" }
    });

    if (sizes.length === 0) {
      return this.seedArchSizes(organizationId);
    }

    return sizes;
  }

  private async seedMaterials(organizationId: string) {
    await this.prisma.orthodonticMaterial.createMany({
      data: DEFAULT_MATERIALS.map((name) => ({ organizationId, name })),
      skipDuplicates: true
    });

    return this.prisma.orthodonticMaterial.findMany({
      where: { organizationId, isActive: true },
      select: CATALOG_SELECT,
      orderBy: { name: "asc" }
    });
  }

  private async seedArchSizes(organizationId: string) {
    await this.prisma.orthodonticArchSize.createMany({
      data: DEFAULT_ARCH_SIZES.map((name) => ({ organizationId, name })),
      skipDuplicates: true
    });

    return this.prisma.orthodonticArchSize.findMany({
      where: { organizationId, isActive: true },
      select: CATALOG_SELECT,
      orderBy: { name: "asc" }
    });
  }
}
