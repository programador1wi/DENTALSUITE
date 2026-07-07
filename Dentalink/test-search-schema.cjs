const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, 'packages/database/prisma/schema.prisma');
const content = fs.readFileSync(schemaPath, 'utf8');

const lines = content.split('\n');
let inPatientModel = false;
console.log("PATIENT MODEL FIELDS:");
lines.forEach((line) => {
  if (line.trim().startsWith('model Patient ')) {
    inPatientModel = true;
  }
  if (inPatientModel) {
    console.log(line);
    if (line.trim() === '}') {
      inPatientModel = false;
    }
  }
});
