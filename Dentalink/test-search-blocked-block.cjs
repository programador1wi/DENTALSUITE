const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'apps/web/src/features/agenda/components/calendar-view.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("SEARCH FOR 'BlockedAppointmentBlock':");
lines.forEach((line, index) => {
  if (line.includes('BlockedAppointmentBlock')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
