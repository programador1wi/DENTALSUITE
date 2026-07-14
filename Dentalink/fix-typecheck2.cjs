const fs = require('fs');

// payments.service.ts
const psFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let psCode = fs.readFileSync(psFile, 'utf8');
psCode = psCode.replace(/this\.toDecimal\(dto\.amount\)/g, "this.toDecimal(dto.amount || 0)");
fs.writeFileSync(psFile, psCode);

// reports.service.ts
const rsFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/reports/reports.service.ts';
let rsCode = fs.readFileSync(rsFile, 'utf8');
rsCode = rsCode.replace(/row\.paymentMethod\./g, "row.paymentMethod?.");
rsCode = rsCode.replace(/payment\.paymentMethodId,/g, "payment.paymentMethodId || '',");
rsCode = rsCode.replace(/payment\.paymentMethod\.name/g, "payment.paymentMethod?.name");
fs.writeFileSync(rsFile, rsCode);
