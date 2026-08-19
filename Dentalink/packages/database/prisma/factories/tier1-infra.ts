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
      where: {
        organizationId: org.id,
        OR: [
          { code: roleDef.code },
          { name: roleDef.name }
        ]
      },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: org.id,
          name: roleDef.name,
          code: roleDef.code,
          description: roleDef.description,
          isSystem: true,
          isActive: true,
        },
      });
    } else {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          name: roleDef.name,
          code: roleDef.code,
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

  // 5. Branches (Matrix + 3 physical clinics)
  console.log("   - Syncing branches...");
  const branches: Branch[] = [];
  const branchConfigs = [
    { name: "Matriz Insurgentes", code: "MATRIZ", zoneId: zoneCentral.id, phone: "5551234567", email: "insurgentes@dentalwarner.com", address: "Av. Insurgentes Sur 1234, Col. Del Valle" },
    { name: "Sucursal Polanco", code: "POLANCO", zoneId: zoneCentral.id, phone: "5551234568", email: "polanco@dentalwarner.com", address: "Av. Horacio 456, Col. Polanco" },
    { name: "Sucursal Norte", code: "NORTE", zoneId: zoneNorte.id, phone: "5551234569", email: "norte@dentalwarner.com", address: "Av. Montevideo 789, Col. Lindavista" },
    { name: "Sucursal Sur", code: "SUR", zoneId: zoneSur.id, phone: "5551234570", email: "sur@dentalwarner.com", address: "Calz. de Tlalpan 2345, Col. Portales" },
  ];

  for (const cfg of branchConfigs) {
    let branch = await prisma.branch.findFirst({ where: { organizationId: org.id, code: cfg.code } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          organizationId: org.id,
          brandId: brand.id,
          zoneId: cfg.zoneId,
          name: cfg.name,
          code: cfg.code,
          phone: cfg.phone,
          email: cfg.email,
          address: cfg.address,
          city: "Ciudad de México",
          state: "CDMX",
          country: "MX",
          isActive: true,
          agendaIntervalMinutes: 15,
          agendaStartHour: 9,
          agendaEndHour: 19,
        },
      });
    }
    branches.push(branch);
  }

  // Ensure Admin User exists
  console.log("   - Syncing system admin...");
  const adminRole = await prisma.role.findFirst({
    where: {
      organizationId: org.id,
      OR: [
        { code: "super_admin" },
        { name: "Super Administrador" },
        { name: "SUPER_ADMIN" }
      ]
    }
  });
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
