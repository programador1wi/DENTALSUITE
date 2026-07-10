const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.organization.findFirst().then(async (org) => {
  if (!org) {
    console.log("No organization found!");
    return;
  }
  console.log("Found organization:", org.id, org.name);
  const dummyBase64 = "data:image/jpeg;base64," + "A".repeat(500 * 1024); // 500KB string
  try {
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        logoUrl: dummyBase64
      }
    });
    console.log("Success! Updated logoUrl length:", updated.logoUrl.length);
  } catch (err) {
    console.error("Prisma error:", err);
  }
}).finally(() => prisma.$disconnect());
