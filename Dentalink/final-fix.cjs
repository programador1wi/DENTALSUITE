const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Undo the wrong edit in User
schema = schema.replace(
`  specialtyClinicalTemplates     SpecialtyClinicalTemplate[]
  treatmentPlans             TreatmentPlan[]

  @@index([organizationId, isActive])`,
`  specialtyClinicalTemplates     SpecialtyClinicalTemplate[]

  @@index([organizationId, isActive])`
);

// Add treatmentPlans to Specialty
const specialtyBlock = `model Specialty {
  id                         String                      @id @default(cuid())
  organizationId             String
  organization               Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name                       String                      @unique
  description                String?
  active                     Boolean                     @default(true)
  color                      String?
  createdAt                  DateTime                    @default(now())
  updatedAt                  DateTime                    @updatedAt
  specialtyClinicalTemplates SpecialtyClinicalTemplate[]
  treatmentPlans             TreatmentPlan[]

  @@index([organizationId])
}`;

schema = schema.replace(/model Specialty \{[\s\S]*?@@index\(\[organizationId\]\)\n\}/, specialtyBlock);

fs.writeFileSync(schemaPath, schema);
console.log('Schema fixed successfully.');
