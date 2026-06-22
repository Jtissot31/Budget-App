import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, src) {
  fs.writeFileSync(path.join(ROOT, rel), src);
}

// TransactionInsightCard — drop dmSerifFonts import
{
  let src = read('components/TransactionInsightCard.tsx');
  src = src.replace(
    /import \{ jakartaExtraBoldText \} from '@\/constants\/dmSerifFonts';\r?\n\r?\n/,
    '',
  );
  src = src.replace(
    /import \{ dmSerifRegularText \} from '@\/constants\/dmSerifFonts';\r?\n\r?\n/,
    '',
  );
  if (!src.includes('jakartaExtraBoldText')) {
    src = src.replace(
      '  jakartaBoldText,\n\n  jakartaMediumText,',
      '  jakartaBoldText,\n\n  jakartaExtraBoldText,\n\n  jakartaMediumText,',
    );
  }
  write('components/TransactionInsightCard.tsx', src);
}

// FloatingTabBar — import jakartaSemiboldText
{
  let src = read('components/FloatingTabBar.tsx');
  if (!src.includes('jakartaSemiboldText,')) {
    src = src.replace(
      '  getFloatingTabBarBottomInset,\n  lightColors,',
      '  getFloatingTabBarBottomInset,\n  jakartaSemiboldText,\n  lightColors,',
    );
  }
  write('components/FloatingTabBar.tsx', src);
}

// index.tsx — fontWeight audit fixes
{
  let src = read('app/(tabs)/index.tsx');
  if (!src.includes('jakartaExtraBoldText,')) {
    src = src.replace(
      '  jakartaBoldText,\n  jakartaMediumText,\n  jakartaSemiboldText,',
      '  jakartaBoldText,\n  jakartaExtraBoldText,\n  jakartaMediumText,\n  jakartaSemiboldText,',
    );
  }
  src = src
    .replace(
      /health: \{\r?\n    flex: 1,\r?\n    minWidth: 0,\r?\n    fontSize: typography\.meta,\r?\n    fontWeight: '700',\r?\n    lineHeight: typography\.meta \+ 4,\r?\n    color: 'rgba\(245,245,245,0\.84\)',\r?\n  \},/,
      `health: {
    ...jakartaBoldText,
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    color: 'rgba(245,245,245,0.84)',
  },`,
    )
    .replace(
      /gaugeUsageLabel: \{\r?\n    fontSize: 28,\r?\n    fontWeight: '900',/,
      `gaugeUsageLabel: {
    ...jakartaExtraBoldText,
    fontSize: 28,`,
    )
    .replace(
      /gaugeEyebrow: \{\r?\n    fontSize: 10,\r?\n    fontWeight: '700',/,
      `gaugeEyebrow: {
    ...jakartaBoldText,
    fontSize: 10,`,
    )
    .replace(
      /gaugeAmountLabel: \{\r?\n    fontSize: 26,\r?\n    fontWeight: '900',/,
      `gaugeAmountLabel: {
    ...jakartaExtraBoldText,
    fontSize: 26,`,
    )
    .replace(
      /eyebrow: \{\r?\n    fontSize: typography\.micro,\r?\n    fontWeight: '600',/,
      `eyebrow: {
    ...jakartaSemiboldText,
    fontSize: typography.micro,`,
    )
    .replace(
      /balanceMint: \{\r?\n    marginTop: 8,\r?\n    fontSize: 30,\r?\n    fontWeight: '900',/,
      `balanceMint: {
    ...jakartaExtraBoldText,
    marginTop: 8,
    fontSize: 30,`,
    )
    .replace(
      /metricUnit: \{\r?\n    fontSize: typography\.dashboardGreeting,\r?\n    fontWeight: '800',/,
      `metricUnit: {
    ...jakartaExtraBoldText,
    fontSize: typography.dashboardGreeting,`,
    )
    .replace(
      /balanceWhite: \{\r?\n    marginTop: 8,\r?\n    fontSize: 30,\r?\n    fontWeight: '800',/,
      `balanceWhite: {
    ...jakartaExtraBoldText,
    marginTop: 8,
    fontSize: 30,`,
    );
  write('app/(tabs)/index.tsx', src);
}

// savings-goal-transactions.tsx
{
  let src = read('app/savings-goal-transactions.tsx');
  if (!src.includes('jakartaBoldText')) {
    src = src.replace(
      "import { radius, spacing, typography, type AppColors } from '@/constants/theme';",
      "import { jakartaBoldText, jakartaExtraBoldText, radius, spacing, typography, type AppColors } from '@/constants/theme';",
    );
  }
  src = src
    .replace(
      "sheetTitle: { fontSize: typography.dashboardGreeting, fontWeight: '800', letterSpacing: -0.4 },",
      'sheetTitle: { ...jakartaExtraBoldText, fontSize: typography.dashboardGreeting, letterSpacing: -0.4 },',
    )
    .replace(
      "sheetSubtitle: { fontSize: typography.meta, fontWeight: '700', letterSpacing: 0.1 },",
      'sheetSubtitle: { ...jakartaBoldText, fontSize: typography.meta, letterSpacing: 0.1 },',
    )
    .replace(
      "goalName: { fontSize: typography.screenTitle, fontWeight: '900', letterSpacing: -0.6 },",
      'goalName: { ...jakartaExtraBoldText, fontSize: typography.screenTitle, letterSpacing: -0.6 },',
    )
    .replace(
      "goalMeta: { fontSize: typography.caption, lineHeight: typography.caption + 5, fontWeight: '700' },",
      'goalMeta: { ...jakartaBoldText, fontSize: typography.caption, lineHeight: typography.caption + 5 },',
    )
    .replace(
      /summaryEyebrow: \{\r?\n      fontSize: typography\.micro,\r?\n      fontWeight: '700',/,
      `summaryEyebrow: {
      ...jakartaBoldText,
      fontSize: typography.micro,`,
    )
    .replace(
      /summaryAmount: \{\r?\n      fontSize: typography\.heroStat,\r?\n      fontWeight: '800',/,
      `summaryAmount: {
      ...jakartaExtraBoldText,
      fontSize: typography.heroStat,`,
    )
    .replace(
      /summaryCount: \{\r?\n      fontSize: typography\.caption,\r?\n      fontWeight: '800',/,
      `summaryCount: {
      ...jakartaExtraBoldText,
      fontSize: typography.caption,`,
    );
  write('app/savings-goal-transactions.tsx', src);
}

// wealth-asset-detail.tsx
{
  let src = read('app/wealth-asset-detail.tsx');
  src = src
    .replace(
      /sectionTitle: \{\r?\n    fontSize: typography\.caption,\r?\n    fontWeight: '800',\r?\n  \},/,
      `sectionTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.caption,
  },`,
    )
    .replace(
      /sectionMeta: \{\r?\n    fontSize: typography\.micro,\r?\n    fontWeight: '700',\r?\n  \},/,
      `sectionMeta: {
    ...jakartaBoldText,
    fontSize: typography.micro,
  },`,
    );
  write('app/wealth-asset-detail.tsx', src);
}

console.log('Targeted typography patches applied');
