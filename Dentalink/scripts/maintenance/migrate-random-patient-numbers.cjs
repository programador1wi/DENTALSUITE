const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
const envPath = path.resolve(__dirname, '../../.env');
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

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateRandom6DigitNumber(usedNumbers) {
  while (true) {
    const candidate = crypto.randomInt(100000, 1000000);
    if (!usedNumbers.has(candidate)) {
      usedNumbers.add(candidate);
      return candidate;
    }
  }
}

async function main() {
  console.log('Reading existing patients...');
  const allPatients = await prisma.patient.findMany({
    select: { id: true, patientNumber: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${allPatients.length} total patients.`);

  const usedNumbers = new Set();
  // Collect any existing numbers >= 100000
  for (const p of allPatients) {
    if (p.patientNumber && p.patientNumber >= 100000) {
      usedNumbers.add(p.patientNumber);
    }
  }

  // Patients to update (those with patientNumber < 100000 or null)
  const toUpdate = allPatients.filter(p => !p.patientNumber || p.patientNumber < 100000);
  console.log(`Patients needing 6-digit random number: ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log('All patients already have 6-digit numbers.');
    return;
  }

  // Generate unique 6-digit random numbers for all of them
  const updates = toUpdate.map(patient => {
    const newNumber = generateRandom6DigitNumber(usedNumbers);
    return {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      oldNumber: patient.patientNumber,
      newNumber
    };
  });

  console.log('Applying updates in transaction...');
  await prisma.$transaction(
    updates.map(u =>
      prisma.patient.update({
        where: { id: u.id },
        data: { patientNumber: u.newNumber }
      })
    )
  );

  console.log('Successfully updated all patients with random 6-digit numbers:');
  updates.slice(0, 10).forEach(u => {
    console.log(`  - Patient ${u.name} (ID ${u.id}): ${u.oldNumber} -> ${u.newNumber}`);
  });
  if (updates.length > 10) {
    console.log(`  ... and ${updates.length - 10} more.`);
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
