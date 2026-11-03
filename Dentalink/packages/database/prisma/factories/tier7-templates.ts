import { PrismaClient, Specialty } from "@prisma/client";

export async function seedTier7Templates(prisma: PrismaClient, orgId: string, specialties: Specialty[]) {
  console.log("🌱 [Tier 7] Seeding Templates...");

  const odon = specialties.find(s => s.name.toLowerCase().includes("general")) || specialties[0];
  if (!odon) return;

  const templatesData = [
    {
      name: "Evolución Estándar",
      content: "<p>Se presenta paciente asintomático.</p><p>Se realiza profilaxis y aplicación de flúor.</p><p>Indicaciones dadas.</p>"
    },
    {
      name: "Evolución Endodoncia",
      content: "<p>Apertura cameral.</p><p>Conductometría.</p><p>Instrumentación y medicación intraconducto.</p><p>Sellado temporal.</p>"
    },
    {
      name: "Evolución Ortodoncia",
      content: "<p>Cambio de ligaduras y arco.</p><p>Reactivación de fuerzas.</p><p>Buena higiene oral.</p>"
    }
  ];

  for (const t of templatesData) {
    const existing = await prisma.specialtyClinicalTemplate.findFirst({
      where: { specialtyId: odon.id, name: t.name }
    });
    
    if (!existing) {
      await prisma.specialtyClinicalTemplate.create({
        data: {
          specialtyId: odon.id,
          type: "EVOLUTION",
          name: t.name,
          content: t.content,
          isActive: true
        }
      });
    }
  }
}
