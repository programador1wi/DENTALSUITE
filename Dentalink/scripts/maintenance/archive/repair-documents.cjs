const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model TreatmentPlan \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('clinicalDocuments')) {
       return match.replace(
         '  items                 TreatmentPlanItem[]',
         '  items                 TreatmentPlanItem[]\n  clinicalDocuments     ClinicalDocument[]'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('ClinicalDocument relation fixed');
