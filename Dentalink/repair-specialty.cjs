const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const specInjection = `  @@index([organizationId])
  treatmentPlans TreatmentPlan[]
}`;

schema = schema.replace('  @@index([organizationId])\n}', specInjection);

fs.writeFileSync(schemaPath, schema);
console.log('Specialty repaired successfully.');
