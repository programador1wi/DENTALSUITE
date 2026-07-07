const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. ClinicalDocument - Change String to Json, add treatmentPlan
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

// 2. ClinicalDocumentTemplate - Change String to Json
schema = schema.replace(
  /model ClinicalDocumentTemplate \{([\s\S]*?)content\s+String([\s\S]*?)\}/,
  `model ClinicalDocumentTemplate {$1content                  Json$2}`
);

// 3. TreatmentPlan - Add pauses
schema = schema.replace(
  /model TreatmentPlan \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('pauses')) {
       return match.replace(
         '  items                 TreatmentPlanItem[]',
         '  items                 TreatmentPlanItem[]\n  pauses                TreatmentPlanPause[]'
       );
    }
    return match;
  }
);

// 4. Payment - Add installmentAllocations
schema = schema.replace(
  /model Payment \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('installmentAllocations')) {
       return match.replace(
         '  invoices                 Invoice[]',
         '  invoices                 Invoice[]\n  installmentAllocations        PaymentInstallmentAllocation[]'
       );
    }
    return match;
  }
);

// 5. OrthodonticTreatmentProfile - Add diagnosis Json?
schema = schema.replace(
  /model OrthodonticTreatmentProfile \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('diagnosis')) {
       return match.replace(
         '  estimatedMonths   Int?',
         '  estimatedMonths   Int?\n  diagnosis         Json?'
       );
    }
    return match;
  }
);

// 6. Append models
const newModels = `
model PaymentInstallmentAllocation {
  id            String   @id @default(cuid())
  paymentId     String
  payment       Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  installmentId String
  installment   PaymentInstallment @relation(fields: [installmentId], references: [id], onDelete: Cascade)
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

if (!schema.includes('model PaymentInstallmentAllocation')) {
  schema += newModels;
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema structurally recovered successfully.');
