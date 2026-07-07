const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'packages/database/prisma/seed-professionals-agenda.ts');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log("SEARCH FOR 'BLOCKED' IN SEED:");
  lines.forEach((line, index) => {
    if (line.includes('BLOCKED')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log("Seed file not found at " + filePath);
}
