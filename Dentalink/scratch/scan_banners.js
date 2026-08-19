const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', 'dist', '.git'].includes(file)) {
        walk(fullPath, fileList);
      }
    } else if (/\.(tsx|jsx|ts|js)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = walk('apps/web/src');
const bannerMatches = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const isAlertComponent = /<Alert\b/.test(line);
    const isAdHocNotice = /<(div|section|aside|p)\b[^>]*className=[^>]*((bg-amber|bg-yellow|bg-orange|bg-red|bg-emerald|bg-blue|bg-indigo|bg-sky)-50|status-(warning|danger|success)-bg|bg-\[var\(--status-)/.test(line) &&
      /(border|rounded|p-|px-|py-)/.test(line);
    
    if (isAlertComponent || isAdHocNotice) {
      if (!file.endsWith('.test.tsx') && !file.includes('alert.tsx') && !file.includes('badge.tsx') && !file.includes('styles.css')) {
        bannerMatches.push({
          file: file.replace(/\\/g, '/'),
          line: i + 1,
          code: line.trim()
        });
      }
    }
  });
});

console.log('Total banner/callout matches:', bannerMatches.length);
bannerMatches.forEach((m, idx) => console.log(`${idx + 1}. [${m.file}:${m.line}]\n   ${m.code}\n`));
