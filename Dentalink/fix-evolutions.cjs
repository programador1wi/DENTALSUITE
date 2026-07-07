const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model ClinicalEvolution \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('treatmentPlan       TreatmentPlan?')) {
       return match.replace(
         '  treatmentPlanId     String?',
         '  treatmentPlanId     String?\n  treatmentPlan       TreatmentPlan?              @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)'
       );
    }
    return match;
  }
);

schema = schema.replace(
  /model TreatmentPlan \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('clinicalEvolutions  ClinicalEvolution[]')) {
       return match.replace(
         '  items                 TreatmentPlanItem[]',
         '  items                 TreatmentPlanItem[]\n  clinicalEvolutions    ClinicalEvolution[]'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('ClinicalEvolution relation fixed');
