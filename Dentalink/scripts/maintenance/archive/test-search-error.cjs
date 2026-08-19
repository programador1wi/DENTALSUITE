const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'apps/web/src/features/agenda/components/appointment-modal.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("SEARCH FOR 'calza con intervalos' or 'invalida':");
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('calza') || line.toLowerCase().includes('invalida')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
