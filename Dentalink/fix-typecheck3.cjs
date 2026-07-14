const fs = require('fs');

// payments.service.ts
const psFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let psCode = fs.readFileSync(psFile, 'utf8');
psCode = psCode.replace(/p\.paymentMethod\?\.name,/g, "p.paymentMethod?.name || '',");
psCode = psCode.replace(/p\.paymentMethod\?\.type,/g, "p.paymentMethod?.type || '',");
psCode = psCode.replace(/payment\.paymentMethodId,/g, "payment.paymentMethodId || '',");
psCode = psCode.replace(/row\.paymentMethodId,/g, "row.paymentMethodId || '',");
psCode = psCode.replace(/p\.paymentMethodId,/g, "p.paymentMethodId || '',");
fs.writeFileSync(psFile, psCode);

// reports.service.ts
const rsFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/reports/reports.service.ts';
let rsCode = fs.readFileSync(rsFile, 'utf8');
rsCode = rsCode.replace(/const methodKey = payment\.paymentMethodId;/g, "const methodKey = payment.paymentMethodId || 'none';");
fs.writeFileSync(rsFile, rsCode);

// reports-analytics.service.ts
const rasFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/reports/reports-analytics.service.ts';
let rasCode = fs.readFileSync(rasFile, 'utf8');
rasCode = rasCode.replace(/method: row\.paymentMethod\?\.name,/g, "method: row.paymentMethod?.name || null,");
fs.writeFileSync(rasFile, rasCode);
