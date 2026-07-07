const fs = require('fs');
const path = require('path');

// Read .env file in root
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      branchId: true,
      branch: { select: { name: true } }
    },
    take: 10
  });
  console.log("PATIENTS IN DATABASE:");
  console.log(JSON.stringify(patients, null, 2));

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true }
  });
  console.log("BRANCHES IN DATABASE:");
  console.log(branches);
}

main().catch(e => {
  console.error(e);
}).finally(() => {
  prisma.$disconnect();
});
