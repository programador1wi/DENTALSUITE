const fs = require('fs');
const file = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { toDecimal, sumDecimals, isDecimalEqual }')) {
  code = `import { toDecimal, sumDecimals, isDecimalEqual } from "./utils/monetary.util";\n` + code;
}

code = code.replace(/allocations\.reduce\(\(totals, allocation\) => \{/g, 'allocations.reduce<Record<string, Prisma.Decimal>>((totals, allocation) => {');

code = code.replace(/p\.paymentMethodId,/g, "p.paymentMethodId || '',");

fs.writeFileSync(file, code);
