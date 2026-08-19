const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Add relations to Organization
if (!schema.includes('orthodonticMaterials')) {
    schema = schema.replace(
        /  @@index\(\[isActive\]\)\r?\n  @@index\(\[status\]\)\r?\n\}/,
        `  orthodonticMaterials             OrthodonticMaterial[]
  orthodonticArchSizes             OrthodonticArchSize[]

  @@index([isActive])
  @@index([status])
}`
    );
}

// 2. Add fields to TreatmentPlan
if (!schema.includes('kind                  TreatmentPlanKind')) {
    schema = schema.replace(
        /  name                  String\r?\n  description           String\?/,
        `  kind                  TreatmentPlanKind          @default(GENERAL)
  specialtyId           String?
  specialty             Specialty?                 @relation(fields: [specialtyId], references: [id], onDelete: SetNull)
  specialtySnapshotName String?
  orthodonticProfile    OrthodonticTreatmentProfile?
  name                  String
  description           String?`
    );
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema regex retry applied.');
