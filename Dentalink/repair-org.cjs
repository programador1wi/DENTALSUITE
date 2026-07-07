const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model Organization \{([\s\S]*?)\}/,
  (match, p1) => {
    if (!match.includes('orthodonticMaterials')) {
       return match.replace(
         '  createdAt        DateTime          @default(now())',
         '  orthodonticMaterials  OrthodonticMaterial[]\n  orthodonticArchSizes  OrthodonticArchSize[]\n  createdAt        DateTime          @default(now())'
       );
    }
    return match;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log('Organization relation fixed');
