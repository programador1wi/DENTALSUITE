import fs from 'fs';
import path from 'path';

const srcDir = 'c:/Users/X/Documents/GitHub/DENTALSUITE/Dentalink/apps/web/src';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);
const report = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const fileDropdowns = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Ignore comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    
    // Check for HTML select
    if (trimmed.includes('<select') || trimmed.includes('</select>')) {
      fileDropdowns.push({ line: idx + 1, type: 'HTML <select>', text: trimmed });
    }
    // Check for custom Select
    if (trimmed.includes('<Select') && !trimmed.includes('import')) {
      fileDropdowns.push({ line: idx + 1, type: 'Custom <Select>', text: trimmed });
    }
    // Check for custom Dropdown
    if (trimmed.includes('<Dropdown') && !trimmed.includes('import')) {
      fileDropdowns.push({ line: idx + 1, type: 'Custom <Dropdown>', text: trimmed });
    }
  });

  if (fileDropdowns.length > 0) {
    const relativePath = path.relative(srcDir, file).replace(/\\/g, '/');
    report.push({ file: relativePath, dropdowns: fileDropdowns });
  }
});

let mdContent = '# Analysis of Dropdowns and Selects in the System\n\n';
mdContent += `Total files with dropdowns/selects: ${report.length}\n\n`;

report.forEach((item) => {
  mdContent += `### File: [${item.file}](file:///${srcDir}/${item.file})\n`;
  mdContent += '| Line | Type | Code Snippet |\n';
  mdContent += '| --- | --- | --- |\n';
  item.dropdowns.forEach((dd) => {
    const cleanText = dd.text.replace(/\|/g, '\\|');
    mdContent += `| ${dd.line} | ${dd.type} | \`${cleanText}\` |\n`;
  });
  mdContent += '\n';
});

fs.writeFileSync('C:/Users/X/.gemini/antigravity/brain/8b27b747-dfbc-4cc4-9fe9-dafbe3cee738/scratch/scan_results.md', mdContent);
console.log('Markdown report generated at C:/Users/X/.gemini/antigravity/brain/8b27b747-dfbc-4cc4-9fe9-dafbe3cee738/scratch/scan_results.md');
