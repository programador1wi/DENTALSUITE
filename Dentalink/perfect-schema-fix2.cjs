const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model ClinicalDocument \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('treatmentPlanId')) {
       return match.replace(
         '  template    ClinicalDocumentTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)',
         '  template    ClinicalDocumentTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)\n  treatmentPlanId  String?\n  treatmentPlan    TreatmentPlan?            @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)'
       );
    }
    return match;
  }
);

schema = schema.replace(
  /model OrthodonticTreatmentProfile \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('estimatedControls')) {
       return match.replace(
         '  diagnosis        Json?',
         '  diagnosis        Json?\n  estimatedControls Int?\n  lastUpperArch    String?\n  lastLowerArch    String?\n  nextControlAt    DateTime?\n  nextRadiographyAt DateTime?\n  hygieneStatus    String?\n  alert            String?\n  indications      String?\n  elastics         String?\n  planNotes        String?'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('Fixed missing fields in ClinicalDocument and OrthodonticTreatmentProfile');
