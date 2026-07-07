const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model OrthodonticMaterial \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('organizationId')) {
       return match.replace(
         '  name      String   @unique',
         '  organizationId String\n  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  name      String   @unique'
       );
    }
    return match;
  }
);

schema = schema.replace(
  /model OrthodonticArchSize \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('organizationId')) {
       return match.replace(
         '  name      String   @unique',
         '  organizationId String\n  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  name      String   @unique'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('Fixed missing organizationId');
