const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'apps/web/src/features/agenda/components/appointment-modal.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("SEARCH FOR 'handleProfessionalChange':");
lines.forEach((line, index) => {
  if (line.includes('handleProfessionalChange')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
