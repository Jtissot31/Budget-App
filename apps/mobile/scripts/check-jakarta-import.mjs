import fs from 'fs';
import path from 'path';

const root = path.resolve('c:/Users/emime/projects/BudgetTracker/apps/mobile');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

for (const f of walk(root)) {
  const t = fs.readFileSync(f, 'utf8');
  if (!t.includes('jakartaSemiboldText')) continue;
  const themeImport = t.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/constants\/theme['"]/);
  const pjImport = /jakartaSemiboldText/.test(t) && /from\s*['"]@\/constants\/plusJakartaFonts['"]/.test(t);
  const ok = (themeImport && themeImport[1].includes('jakartaSemiboldText')) || pjImport;
  if (!ok) {
    console.log(path.relative(root, f));
  }
}
