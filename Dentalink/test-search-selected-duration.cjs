const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'apps/web/src/features/agenda/components/appointment-modal.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("SEARCH FOR 'selectedDuration':");
lines.forEach((line, index) => {
  if (line.includes('selectedDuration')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
