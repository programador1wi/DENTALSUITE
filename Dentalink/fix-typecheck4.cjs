const fs = require('fs');

const psFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let psCode = fs.readFileSync(psFile, 'utf8');
psCode = psCode.replace(/p\.paymentMethod\?\.name \|\| '',/g, "p.paymentMethod?.name || '',");
psCode = psCode.replace(/p\.paymentMethod\?\.type \|\| '',/g, "p.paymentMethod?.type || '',");
psCode = psCode.replace(/p\.paymentMethod\?\.name,/g, "p.paymentMethod?.name || '',");
psCode = psCode.replace(/p\.paymentMethod\?\.type,/g, "p.paymentMethod?.type || '',");
fs.writeFileSync(psFile, psCode);

const rsFile = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/reports/reports.service.ts';
let rsCode = fs.readFileSync(rsFile, 'utf8');
rsCode = rsCode.replace(/method: payment\.paymentMethod\?\.name,/g, "method: payment.paymentMethod?.name || 'Unknown',");
fs.writeFileSync(rsFile, rsCode);
