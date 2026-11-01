const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) files.push(...walk(p));
    else if (p.endsWith('.jsx') || p.endsWith('.tsx') || p.endsWith('.js')) files.push(p);
  });
  return files;
}

const allFiles = walk(path.join(__dirname, '../frontend-react/src'));

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('t(')) return;

  const lines = content.split('\n');
  let firstFuncLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export default function') || lines[i].includes('export function') || lines[i].match(/^function\s+[A-Z]/)) {
      firstFuncLine = i;
      break;
    }
  }

  if (firstFuncLine !== -1) {
    for (let i = 0; i < firstFuncLine; i++) {
      if (lines[i].includes('t(')) {
        console.log(`⚠️ FOUND OUTSIDE FUNCTION: ${path.relative(__dirname, file)}:${i + 1} -> ${lines[i].trim()}`);
      }
    }
  }
});
console.log('Checked all files for pre-function t() calls.');
