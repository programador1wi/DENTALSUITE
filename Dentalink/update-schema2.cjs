const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /  installments           Installment\[\]\r?\n  createdAt              DateTime              @default\(now\(\)\)/,
  '  installments           Installment[]\n  installmentAllocations PaymentInstallmentAllocation[]\n  createdAt              DateTime              @default(now())'
);

schema = schema.replace(
  /  paidAt            DateTime\?\r?\n  createdAt         DateTime          @default\(now\(\)\)/,
  '  paidAt            DateTime?\n  paymentAllocations PaymentInstallmentAllocation[]\n  createdAt         DateTime          @default(now())'
);

fs.writeFileSync(schemaPath, schema);
console.log('Fixed Payment and Installment with regex for line endings');
