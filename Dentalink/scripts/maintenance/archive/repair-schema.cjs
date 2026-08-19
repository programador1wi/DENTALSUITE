const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const tpInjection = `  professional          Professional               @relation(fields: [professionalId], references: [id], onDelete: Restrict)
  kind                  TreatmentPlanKind          @default(GENERAL)
  specialtyId           String?
  specialty             Specialty?                 @relation(fields: [specialtyId], references: [id], onDelete: SetNull)
  specialtySnapshotName String?
  orthodonticProfile    OrthodonticTreatmentProfile?`;

schema = schema.replace('  professional          Professional               @relation(fields: [professionalId], references: [id], onDelete: Restrict)', tpInjection);

const models = `
enum TreatmentPlanKind {
  GENERAL
  ORTHODONTICS
}

model OrthodonticTreatmentProfile {
  id                String        @id @default(cuid())
  treatmentPlanId   String        @unique
  treatmentPlan     TreatmentPlan @relation(fields: [treatmentPlanId], references: [id], onDelete: Cascade)
  startDate         DateTime?
  estimatedMonths   Int?
  estimatedControls Int?
  lastUpperArch     String?
  lastLowerArch     String?
  nextControlAt     DateTime?
  nextRadiographyAt DateTime?
  hygieneStatus     String?
  alert             String?
  indications       String?
  elastics          String?
  planNotes         String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}
`;

schema = schema + models;

fs.writeFileSync(schemaPath, schema);
console.log('Schema repaired successfully.');
