import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

function patch(rel, fn) {
  const p = path.join(ROOT, rel);
  fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
}

patch('components/TransactionInsightCard.tsx', (src) => {
  src = src.replace(
    /import \{ jakartaExtraBoldText \} from '@\/constants\/dmSerifFonts';\r?\n\r?\n/,
    '',
  );
  src = src.replace(
    /import \{ dmSerifRegularText \} from '@\/constants\/dmSerifFonts';\r?\n\r?\n/,
    '',
  );
  if (!/from '@\/constants\/theme'/.test(src.split('jakartaExtraBoldText')[0] ?? '')) {
    src = src.replace(
      /  jakartaBoldText,\r?\n\r?\n  jakartaMediumText,/,
      '  jakartaBoldText,\n\n  jakartaExtraBoldText,\n\n  jakartaMediumText,',
    );
  }
  return src;
});

patch('components/FloatingTabBar.tsx', (src) => {
  if (!/import \{[^}]*jakartaSemiboldText[^}]*\} from '@\/constants\/theme'/.test(src)) {
    return src.replace(
      /  getFloatingTabBarBottomInset,\r?\n  lightColors,/,
      '  getFloatingTabBarBottomInset,\n  jakartaSemiboldText,\n  lightColors,',
    );
  }
  return src;
});

console.log('Fixed TransactionInsightCard + FloatingTabBar imports');
