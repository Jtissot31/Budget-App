import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', '.expo-diagnostic-bundle', '.expo-export-test', '.expo-export-test2', '.expo-export-android-test', '.expo-export-check', '.expo-export-check3', '.expo-export-ios-test', '.expo-export-test', '.expo-radius-check', '.expo-syntax-verify']);

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.expo-')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx?|json)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const REPLACEMENTS = [
  ['@/constants/interFonts', '@/constants/plusJakartaFonts'],
  ["from './interFonts'", "from './plusJakartaFonts'"],
  ["from '@/constants/interFonts'", "from '@/constants/plusJakartaFonts'"],
  ['interExtraBoldText', 'jakartaExtraBoldText'],
  ['interSemiboldText', 'jakartaSemiboldText'],
  ['interRegularText', 'jakartaRegularText'],
  ['interMediumText', 'jakartaMediumText'],
  ['interBoldText', 'jakartaBoldText'],
  ['dmSerifRegularText', 'jakartaExtraBoldText'],
  ['DMSerifDisplay_400Regular', 'PlusJakartaSans_800ExtraBold'],
  ['DMSans_500Medium', 'PlusJakartaSans_500Medium'],
  ['DMSans_400Regular', 'PlusJakartaSans_400Regular'],
  ['Inter_800ExtraBold', 'PlusJakartaSans_800ExtraBold'],
  ['Inter_700Bold', 'PlusJakartaSans_700Bold'],
  ['Inter_600SemiBold', 'PlusJakartaSans_600SemiBold'],
  ['Inter_500Medium', 'PlusJakartaSans_500Medium'],
  ['Inter_400Regular', 'PlusJakartaSans_400Regular'],
];

function migrateFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (rel === 'scripts/migrate-jakarta-typography.mjs') return false;
  if (rel === 'constants/interFonts.ts' || rel === 'constants/dmSerifFonts.ts') return false;
  if (rel === 'package-lock.json') return false;

  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;

  for (const [from, to] of REPLACEMENTS) {
    src = src.split(from).join(to);
  }

  if (src !== original) {
    fs.writeFileSync(filePath, src);
    return true;
  }
  return false;
}

const changed = [];
for (const file of walk(ROOT)) {
  if (migrateFile(file)) changed.push(path.relative(ROOT, file));
}

console.log(`Updated ${changed.length} files`);
for (const f of changed.sort()) console.log(`  ${f}`);
