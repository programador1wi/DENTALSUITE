const fs = require('fs');
const file = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/payments/payments.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/await this.ensurePaymentMethod\(actor, dto.paymentMethodId\);/g, "if (dto.paymentMethodId) await this.ensurePaymentMethod(actor, dto.paymentMethodId);");
code = code.replace(/amount: this.toDecimal\(dto.amount\)/g, "amount: this.toDecimal(dto.amount || 0)");
code = code.replace(/p\.paymentMethod\./g, "p.paymentMethod?.");
code = code.replace(/payment\.paymentMethod\./g, "payment.paymentMethod?.");
code = code.replace(/allocation\.payment\.paymentMethod\./g, "allocation.payment.paymentMethod?.");

fs.writeFileSync(file, code);

const file2 = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/reports/reports.service.ts';
let code2 = fs.readFileSync(file2, 'utf8');
code2 = code2.replace(/payment\.paymentMethod\./g, "payment.paymentMethod?.");
fs.writeFileSync(file2, code2);

const file3 = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/reports/reports-analytics.service.ts';
let code3 = fs.readFileSync(file3, 'utf8');
code3 = code3.replace(/row\.paymentMethod\./g, "row.paymentMethod?.");
fs.writeFileSync(file3, code3);

const file4 = 'C:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/api/src/modules/settings/settings.service.ts';
let code4 = fs.readFileSync(file4, 'utf8');
code4 = code4.replace(/allocation\.payment\.paymentMethod\./g, "allocation.payment.paymentMethod?.");
fs.writeFileSync(file4, code4);
