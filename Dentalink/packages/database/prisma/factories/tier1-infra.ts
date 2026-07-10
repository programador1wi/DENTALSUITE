import { PrismaClient, BranchStatus } from "@prisma/client";
import { permissionDefinitions, roleDefinitions } from "./permissions";
import bcrypt from "bcryptjs";

export async function seedTier1Infra(prisma: PrismaClient) {
  console.log("🌱 [Tier 1] Seeding Infrastructure...");

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: "dentalwarner" },
    update: {},
    create: {
      name: "Dental Warner",
      slug: "dentalwarner",
      legalName: "Dental Warner S.A. de C.V.",
      taxId: "DWA240101XYZ",
      email: "contacto@dentalwarner.com",
      phone: "+52 55 1234 5678",
      isActive: true,
    },
  });

  // 2. Permissions
  console.log("   - Syncing permissions...");
  const permissionIds = new Map<string, string>();
  for (const [key, name, description, module] of permissionDefinitions) {
    const perm = await prisma.permission.upsert({
      where: { key },
      update: { name, description, module },
      create: { key, name, description, module, isSystem: true, isActive: true },
    });
    permissionIds.set(key, perm.id);
  }

  // 3. Roles
  console.log("   - Syncing roles...");
  for (const roleDef of roleDefinitions) {
    let role = await prisma.role.findFirst({
      where: { organizationId: org.id, name: roleDef.name },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          isActive: true,
        },
      });
    }

    // Link permissions
    const validPermKeys = roleDef.permissionKeys.filter(k => permissionIds.has(k));
    
    // Clear existing to avoid duplicates, then insert
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: validPermKeys.map(k => ({
        roleId: role!.id,
        permissionId: permissionIds.get(k)!,
      })),
      skipDuplicates: true,
    });
  }

  // 4. Branch Brands and Zones
  const brand = await prisma.branchBrand.findFirst({ where: { code: "DW" }}) ?? await prisma.branchBrand.create({ data: { organizationId: org.id, name: "Dental Warner", code: "DW", isActive: true }});
  
  const zoneCentral = await prisma.branchZone.findFirst({ where: { code: "CENTRAL" }}) ?? await prisma.branchZone.create({ data: { organizationId: org.id, name: "Zona Centro", code: "CENTRAL", isActive: true } });
  const zoneNorte = await prisma.branchZone.findFirst({ where: { code: "NORTE" }}) ?? await prisma.branchZone.create({ data: { organizationId: org.id, name: "Zona Norte", code: "NORTE", isActive: true } });
  const zoneSur = await prisma.branchZone.findFirst({ where: { code: "SUR" }}) ?? await prisma.branchZone.create({ data: { organizationId: org.id, name: "Zona Sur", code: "SUR", isActive: true } });

  // 5. Branches
  console.log("   - Syncing branches...");
  const branchesData = [
    { name: "Matriz Centro", code: "MATRIZ", zoneId: zoneCentral.id },
    { name: "Sucursal Norte", code: "NORTE_01", zoneId: zoneNorte.id },
    { name: "Sucursal Sur", code: "SUR_01", zoneId: zoneSur.id },
  ];

  const branches = [];
  for (const b of branchesData) {
    let branch = await prisma.branch.findFirst({ where: { organizationId: org.id, code: b.code } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          organizationId: org.id,
          brandId: brand.id,
          zoneId: b.zoneId,
          name: b.name,
          code: b.code,
          city: "Ciudad de México",
          state: "CDMX",
          country: "MX",
          timezone: "America/Mexico_City",
          isActive: true,
          status: BranchStatus.ACTIVE,
          agendaSlotMinutes: 30,
          agendaStartHour: 9,
          agendaEndHour: 19,
        },
      });
    }
    branches.push(branch);
  }

  // Ensure Admin User exists
  console.log("   - Syncing system admin...");
  const adminRole = await prisma.role.findFirst({ where: { name: "SUPER_ADMIN", organizationId: org.id } });
  let admin = await prisma.user.findUnique({ where: { email: "admin@dentalwarner.local" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        organizationId: org.id,
        firstName: "System",
        lastName: "Admin",
        email: "admin@dentalwarner.local",
        passwordHash: await bcrypt.hash("Admin123!", 10),
        isActive: true,
        roleId: adminRole?.id,
      },
    });
  }

  return { org, branches, admin };
}
