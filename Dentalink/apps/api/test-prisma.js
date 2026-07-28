const { PrismaClient } = require("../../node_modules/@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const total = await prisma.treatmentPlan.count({
      where: {
        kind: "ORTHODONTICS"
      }
    });
    console.log("Total:", total);
    
    const items = await prisma.treatmentPlan.findMany({
      where: { kind: "ORTHODONTICS" },
      include: {
        patient: true,
        professional: true,
        branch: true,
        orthodonticProfile: true,
        orthodonticProgressSnapshots: {
          orderBy: { calculatedAt: "desc" },
          take: 1
        }
      },
      take: 1
    });
    console.log("Items:", items.length);
    
    const delayed = await prisma.orthodonticProgressSnapshot.count({
      where: {
        treatment: { kind: "ORTHODONTICS" },
        progressStatus: "DELAYED"
      }
    });
    console.log("Delayed count:", delayed);
    
  } catch (e) {
    console.error("PRISMA ERROR:", e);
  }
  await prisma.$disconnect();
}
main();
