import fs from 'fs';
import path from 'path';

const p = path.resolve(import.meta.dirname, '../components/TransactionInsightCard.tsx');
let src = fs.readFileSync(p, 'utf8');

src = src.replace(
  /import \{ jakartaExtraBoldText \} from '@\/constants\/dmSerifFonts';\r+\n/,
  '',
);

const beforeTheme = src.split("from '@/constants/theme'")[0] ?? '';
if (!beforeTheme.includes('jakartaExtraBoldText,')) {
  src = src.replace(
    /  jakartaBoldText,\r+\n  jakartaMediumText,/,
    '  jakartaBoldText,\r\n  jakartaExtraBoldText,\r\n  jakartaMediumText,',
  );
}

fs.writeFileSync(p, src);
console.log('dmSerifFonts remaining:', src.includes('dmSerifFonts'));
console.log(src.split(/\r?\n/).slice(0, 20).join('\n'));
