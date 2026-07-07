const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. New Models
const newModels = `
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

model PaymentInstallmentAllocation {
  id            String   @id @default(cuid())
  paymentId     String
  payment       Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  installmentId String
  installment   Installment @relation(fields: [installmentId], references: [id], onDelete: Cascade)
  amount        Decimal  @db.Decimal(10, 2)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([paymentId, installmentId])
  @@index([paymentId])
  @@index([installmentId])
}

model TreatmentPlanPause {
  id              String        @id @default(cuid())
  treatmentPlanId String
  treatmentPlan   TreatmentPlan @relation(fields: [treatmentPlanId], references: [id], onDelete: Cascade)
  startDate       DateTime      @default(now())
  endDate         DateTime?
  reason          String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([treatmentPlanId])
}
`;

if (!schema.includes('TreatmentPlanKind')) {
  schema += newModels;
}

// 2. ClinicalDocument
schema = schema.replace(
  /model ClinicalDocument \{([\s\S]*?)content\s+String([\s\S]*?)\}/,
  (match, p1, p2) => {
    let newBlock = `model ClinicalDocument {${p1}content                  Json${p2}}`;
    if (!newBlock.includes('treatmentPlanId')) {
      newBlock = newBlock.replace(
        '  appointmentId            String?',
        `  appointmentId            String?\n  treatmentPlanId            String?\n  treatmentPlan              TreatmentPlan?             @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)`
      );
    }
    return newBlock;
  }
);

// 3. ClinicalDocumentTemplate
schema = schema.replace(
  /model ClinicalDocumentTemplate \{([\s\S]*?)content\s+String([\s\S]*?)\}/,
  `model ClinicalDocumentTemplate {$1content                  Json$2}`
);

// 4. Payment
schema = schema.replace(
  /model Payment \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('installmentAllocations')) {
       return match.replace(
         '  installments           Installment[]',
         '  installments           Installment[]\n  installmentAllocations PaymentInstallmentAllocation[]'
       );
    }
    return match;
  }
);

// 5. Installment
schema = schema.replace(
  /model Installment \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('paymentAllocations')) {
       return match.replace(
         '  paidAt            DateTime?',
         '  paidAt            DateTime?\n  paymentAllocations PaymentInstallmentAllocation[]'
       );
    }
    return match;
  }
);

// 6. TreatmentPlan
schema = schema.replace(
  /model TreatmentPlan \{([\s\S]*?)\}/,
  (match, p1) => {
    let block = match;
    if (!block.includes('pauses')) {
       block = block.replace(
         '  items                 TreatmentPlanItem[]',
         '  items                 TreatmentPlanItem[]\n  pauses                TreatmentPlanPause[]'
       );
    }
    if (!block.includes('specialtyId')) {
       block = block.replace(
         '  professional          Professional               @relation(fields: [professionalId], references: [id], onDelete: Restrict)',
         '  professional          Professional               @relation(fields: [professionalId], references: [id], onDelete: Restrict)\n  kind                  TreatmentPlanKind          @default(GENERAL)\n  orthodonticProfile    OrthodonticTreatmentProfile?\n  specialtyId           String?\n  specialty             Specialty?                 @relation(fields: [specialtyId], references: [id], onDelete: SetNull)\n  specialtySnapshotName String?'
       );
    }
    return block;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('perfect schema fix done');
