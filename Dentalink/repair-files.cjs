const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model FileAttachment \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('treatmentPlanId')) {
       return match.replace(
         '  professional        Professional?           @relation("ProfessionalFileAttachments", fields: [professionalId], references: [id], onDelete: SetNull)',
         '  professional        Professional?           @relation("ProfessionalFileAttachments", fields: [professionalId], references: [id], onDelete: SetNull)\n  treatmentPlanId     String?\n  treatmentPlan       TreatmentPlan?          @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)'
       );
    }
    return match;
  }
);

schema = schema.replace(
  /model TreatmentPlan \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('fileAttachments')) {
       return match.replace(
         '  clinicalDocuments     ClinicalDocument[]',
         '  clinicalDocuments     ClinicalDocument[]\n  fileAttachments       FileAttachment[]'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('FileAttachment relation fixed');
