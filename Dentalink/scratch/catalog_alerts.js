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
const results = [];

files.forEach(file => {
  if (file.endsWith('.test.tsx') || file.includes('alert.tsx') || file.includes('badge.tsx') || file.includes('styles.css')) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (
      trimmed.includes('<Alert ') ||
      (/(bg-amber-50|bg-yellow-50|bg-orange-50|status-warning-bg|bg-amber-100|bg-red-50|status-danger-bg|bg-emerald-50|bg-sky-50|bg-blue-50)/i.test(trimmed) &&
       /(border|rounded)/i.test(trimmed) &&
       /(p-|px-|py-)/i.test(trimmed) &&
       !/(<button|<input|<span|<Badge|<td|<tr)/i.test(trimmed))
    ) {
      // get next few lines for context
      const contextLines = lines.slice(i, Math.min(lines.length, i + 6)).map(l => l.trim()).join(' ');
      results.push({
        file: file.replace(/\\/g, '/').replace(/^apps\/web\/src\//, ''),
        line: i + 1,
        code: trimmed,
        context: contextLines.substring(0, 160)
      });
    }
  });
});

console.log(JSON.stringify(results, null, 2));
