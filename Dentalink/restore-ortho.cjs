const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const modelsToAdd = `
enum TreatmentPlanKind {
  GENERAL
  ORTHODONTICS
}

model OrthodonticMaterial {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
}

model OrthodonticArchSize {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
}

model OrthodonticTreatmentProfile {
  id               String        @id @default(cuid())
  treatmentPlanId  String        @unique
  treatmentPlan    TreatmentPlan @relation(fields: [treatmentPlanId], references: [id], onDelete: Cascade)
  startDate        DateTime?
  estimatedMonths  Int?
  diagnosis        Json?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
}
`;

if (!schema.includes('enum TreatmentPlanKind')) {
  schema += modelsToAdd;
}

schema = schema.replace(
  /model TreatmentPlan \{([\s\S]*?)specialtyId\s+String\?\r?\n/,
  (match, p1) => {
    if (!match.includes('TreatmentPlanKind')) {
      return `model TreatmentPlan {${p1}kind                  TreatmentPlanKind          @default(GENERAL)\n  orthodonticProfile    OrthodonticTreatmentProfile?\n  specialtyId           String?\n`;
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('Ortho models restored');
