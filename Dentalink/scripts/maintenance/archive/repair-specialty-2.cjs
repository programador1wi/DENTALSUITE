const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model Specialty \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('treatmentPlans')) {
       return match.replace(
         '  organizations   OrganizationSpecialty[]',
         '  organizations   OrganizationSpecialty[]\n  treatmentPlans  TreatmentPlan[]'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('Specialty relation fixed');
