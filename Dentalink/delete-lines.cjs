const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'packages/database/prisma/schema.prisma');
let schemaLines = fs.readFileSync(schemaPath, 'utf8').split('\n');

const newLines = [];
let skip = false;

for (let i = 0; i < schemaLines.length; i++) {
    const line = schemaLines[i];
    
    if (i >= 2343 && line.startsWith('model Specialty {')) {
        skip = true;
    }
    
    if (!skip) {
        newLines.push(line);
    }
    
    if (skip && line.startsWith('}')) {
        skip = false;
        // Also skip the next empty line if there is one
        if (i + 1 < schemaLines.length && schemaLines[i+1].trim() === '') {
             i++;
        }
    }
}

fs.writeFileSync(schemaPath, newLines.join('\n'));
console.log('Lines deleted.');
