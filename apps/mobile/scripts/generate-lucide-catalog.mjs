import fs from 'node:fs';
import path from 'node:path';

const iconsDir = path.join(process.cwd(), 'node_modules/lucide-react-native/dist/cjs/icons');
const files = fs.readdirSync(iconsDir).filter((file) => file.endsWith('.js') && !file.endsWith('.map'));

function toPascalCase(file) {
  return file
    .replace(/\.js$/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const entries = files
  .map((file) => {
    const base = file.replace(/\.js$/, '');
    const name = toPascalCase(file);
    return { name, base };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const output = `// Auto-generated — run: node scripts/generate-lucide-catalog.mjs
import type { LucideIcon } from 'lucide-react-native';
${entries.map((entry) => `import ${entry.name}Icon from 'lucide-react-native/dist/cjs/icons/${entry.base}.js';`).join('\n')}

export type LucideCatalogEntry = {
  name: string;
  Icon: LucideIcon;
};

export const LUCIDE_ICON_CATALOG: LucideCatalogEntry[] = [
${entries.map((entry) => `  { name: '${entry.name}', Icon: (${entry.name}Icon as LucideIcon | { default: LucideIcon }).default ?? ${entry.name}Icon },`).join('\n')}
];
`;

const outPath = path.join(process.cwd(), 'lib/lucideIconCatalog.generated.ts');
fs.writeFileSync(outPath, output);
console.log(`Generated ${entries.length} icons -> ${outPath}`);
