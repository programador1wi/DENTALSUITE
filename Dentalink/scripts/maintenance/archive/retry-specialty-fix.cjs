const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

if (!schema.includes('treatmentPlans             TreatmentPlan[]')) {
    const specialtyStart = schema.indexOf('model Specialty {');
    const specialtyEnd = schema.indexOf('}', specialtyStart);
    let specialtyBlock = schema.substring(specialtyStart, specialtyEnd + 1);
    
    specialtyBlock = specialtyBlock.replace(
        /  @@index\(\[organizationId\]\)\r?\n\}/,
        `  treatmentPlans             TreatmentPlan[]\n\n  @@index([organizationId])\n}`
    );
    
    schema = schema.substring(0, specialtyStart) + specialtyBlock + schema.substring(specialtyEnd + 1);
}

fs.writeFileSync(schemaPath, schema);
console.log('Specialty relation fixed.');
