const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// The duplicate Specialty model is right after RadiographyAnalysis
const duplicateRegex = /model Specialty \{\s+id[\s\S]*?@@index\(\[organizationId\]\)\s+\}/g;

let matchCount = 0;
schema = schema.replace(duplicateRegex, (match) => {
  matchCount++;
  // We want to keep the FIRST one, and remove the SECOND one.
  if (matchCount === 2) {
    return '';
  }
  
  // For the first one, ensure it has treatmentPlans TreatmentPlan[]
  if (matchCount === 1) {
    if (!match.includes('treatmentPlans')) {
        return match.replace('@@index([organizationId])', 'treatmentPlans TreatmentPlan[]\n\n  @@index([organizationId])');
    }
  }
  return match;
});

fs.writeFileSync(schemaPath, schema);
console.log('Schema duplicate Specialty fixed.');
