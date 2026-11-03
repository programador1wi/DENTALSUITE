import { OrthodonticCatalogsService } from "./orthodontic-catalogs.service";

describe("OrthodonticCatalogsService", () => {
  it("lists active materials scoped to the organization", async () => {
    const rows = [{ id: "mat-1", name: "NiTi" }];
    const prisma = {
      orthodonticMaterial: {
        findMany: jest.fn().mockResolvedValue(rows),
        createMany: jest.fn()
      }
    };
    const service = new OrthodonticCatalogsService(prisma as never);

    await expect(service.getMaterials("org-1")).resolves.toEqual(rows);

    expect(prisma.orthodonticMaterial.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    expect(prisma.orthodonticMaterial.createMany).not.toHaveBeenCalled();
  });

  it("seeds default materials when an organization has no active catalog", async () => {
    const seededRows = [
      { id: "mat-1", name: "Acero (SS)" },
      { id: "mat-2", name: "NiTi" }
    ];
    const prisma = {
      orthodonticMaterial: {
        findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(seededRows),
        createMany: jest.fn().mockResolvedValue({ count: 5 })
      }
    };
    const service = new OrthodonticCatalogsService(prisma as never);

    await expect(service.getMaterials("org-1")).resolves.toEqual(seededRows);

    expect(prisma.orthodonticMaterial.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { organizationId: "org-1", name: "NiTi" },
        { organizationId: "org-1", name: "Acero (SS)" }
      ]),
      skipDuplicates: true
    });
    expect(prisma.orthodonticMaterial.findMany).toHaveBeenLastCalledWith({
      where: { organizationId: "org-1", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
  });

  it("seeds default arch sizes when an organization has no active catalog", async () => {
    const seededRows = [
      { id: "size-1", name: ".012" },
      { id: "size-2", name: ".014" }
    ];
    const prisma = {
      orthodonticArchSize: {
        findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(seededRows),
        createMany: jest.fn().mockResolvedValue({ count: 11 })
      }
    };
    const service = new OrthodonticCatalogsService(prisma as never);

    await expect(service.getArchSizes("org-1")).resolves.toEqual(seededRows);

    expect(prisma.orthodonticArchSize.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { organizationId: "org-1", name: ".012" },
        { organizationId: "org-1", name: ".019 x .025" }
      ]),
      skipDuplicates: true
    });
    expect(prisma.orthodonticArchSize.findMany).toHaveBeenLastCalledWith({
      where: { organizationId: "org-1", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
  });
});
