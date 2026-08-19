const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Fix the wrong type reference in PaymentInstallmentAllocation
schema = schema.replace(
  '  installment   PaymentInstallment @relation(fields: [installmentId], references: [id], onDelete: Cascade)',
  '  installment   Installment @relation(fields: [installmentId], references: [id], onDelete: Cascade)'
);

// Add the opposite relation field to Installment
schema = schema.replace(
  /model Installment \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!p1.includes('paymentAllocations')) {
       return match.replace(
         '  payments        Payment[]',
         '  payments        Payment[]\n  paymentAllocations PaymentInstallmentAllocation[]'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('Installment relations fixed.');
