const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const specialties = await prisma.specialty.findMany();
  const odon = specialties.find(s => s.name.toLowerCase().includes('general')) || specialties[0];
  
  if (!odon) {
    console.log('No specialty found');
    return;
  }

  const content = fs.readFileSync('C:/Users/X/Music/PLANTILLAS.txt', 'utf8');
  const blocks = content.split(/\n\s*\n/).filter(b => b.trim().length > 0);
  
  const templates = blocks.map((block) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const name = lines[0].replace(':', '').trim();
    const paragraphs = lines.slice(1).map(l => '<p>' + l + '</p>').join('');
    return {
      specialtyId: odon.id,
      type: 'EVOLUTION',
      name: name,
      content: paragraphs,
      isActive: true
    };
  });

  await prisma.specialtyClinicalTemplate.createMany({
    data: templates
  });
  console.log('Inserted templates into specialty:', odon.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
