const fs = require('fs');
const file = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/packages/database/prisma/schema.prisma';
let schema = fs.readFileSync(file, 'utf8');

// 1. Add version to Patient
schema = schema.replace(
  /model Patient \{([\s\S]*?)createdAt              DateTime/m,
  'model Patient {$1version                Int               @default(1)\n  createdAt              DateTime'
);

// 2. Add version to TreatmentPlanItem
schema = schema.replace(
  /model TreatmentPlanItem \{([\s\S]*?)createdAt           DateTime/m,
  'model TreatmentPlanItem {$1version             Int               @default(1)\n  createdAt           DateTime'
);

// 3. Add inverse relations to PaymentMethod
schema = schema.replace(
  /payments       Payment\[\]\n  createdAt/m,
  'payments       Payment[]\n  paymentSplits  PaymentMethodSplit[]\n  createdAt'
);

// 4. Add inverse relations to FinancialInstitution
schema = schema.replace(
  /payments       Payment\[\]\n  createdAt/m,
  'payments       Payment[]\n  paymentSplits  PaymentMethodSplit[]\n  createdAt'
);

// 5. Update Payment model
schema = schema.replace(
  /model Payment \{([\s\S]*?)paymentMethodId        String\n  paymentMethod          PaymentMethod                  @relation\(fields: \[paymentMethodId\], references: \[id\], onDelete: Restrict\)\n  financialInstitutionId String\?\n  financialInstitution   FinancialInstitution\?          @relation\(fields: \[financialInstitutionId\], references: \[id\], onDelete: SetNull\)([\s\S]*?)allocations            PaymentAllocation\[\]([\s\S]*?)@@index\(\[financialInstitutionId\]\)\n\}/m,
  `model Payment {$1paymentMethodId        String?
  paymentMethod          PaymentMethod?                 @relation(fields: [paymentMethodId], references: [id], onDelete: Restrict)
  financialInstitutionId String?
  financialInstitution   FinancialInstitution?          @relation(fields: [financialInstitutionId], references: [id], onDelete: SetNull)$2idempotencyKey         String?
  allocations            PaymentAllocation[]
  splits                 PaymentMethodSplit[]
  idempotencyRecord      PaymentIdempotency?            $3@@unique([organizationId, idempotencyKey])
  @@index([financialInstitutionId])
}`
);

// Add inverse relations to Organization for Idempotency
schema = schema.replace(
  /paymentLinks               PaymentLink\[\]/m,
  'paymentLinks               PaymentLink[]\n  paymentIdempotency         PaymentIdempotency[]'
);


// 6. Append PaymentMethodSplit and PaymentIdempotency
schema += `
model PaymentMethodSplit {
  id                     String                @id @default(cuid())
  paymentId              String
  payment                Payment               @relation(fields: [paymentId], references: [id], onDelete: Restrict)
  paymentMethodId        String
  paymentMethod          PaymentMethod         @relation(fields: [paymentMethodId], references: [id], onDelete: Restrict)
  amount                 Decimal               @db.Decimal(10, 2)
  financialInstitutionId String?
  financialInstitution   FinancialInstitution? @relation(fields: [financialInstitutionId], references: [id], onDelete: SetNull)
  reference              String?
  externalTransactionId  String?
  authorizationCode      String?
  lastFour               String?
  provider               String?
  status                 PaymentStatus         @default(RECEIVED)
  metadata               Json?
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt

  @@index([paymentId])
  @@index([paymentMethodId])
}

model PaymentIdempotency {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  idempotencyKey String
  requestHash    String
  paymentId      String?      @unique
  payment        Payment?     @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  status         String
  expiresAt      DateTime
  createdAt      DateTime     @default(now())

  @@unique([organizationId, idempotencyKey])
}
`;

fs.writeFileSync(file, schema);
