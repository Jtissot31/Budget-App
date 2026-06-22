import type { LegacyIconFamily } from './legacyIconBackup';

export type LegacyIconKey = `${LegacyIconFamily}:${string}`;

function key(family: LegacyIconFamily, name: string): LegacyIconKey {
  return `${family}:${name}`;
}

/**
 * Maps legacy vector icon identifiers → Lucide icon names (PascalCase).
 * AppIcon only renders Lucide when the target name is in designSystemLucideSelection.json.
 */
export const LEGACY_TO_LUCIDE_MAP: Partial<Record<LegacyIconKey, string>> = {
  // Tab bar (Material Community)
  [key('material-community', 'home')]: 'House',
  [key('material-community', 'home-outline')]: 'House',
  [key('material-community', 'receipt-text')]: 'ReceiptText',
  [key('material-community', 'receipt-text-outline')]: 'ReceiptText',
  [key('material-community', 'wallet')]: 'Wallet',
  [key('material-community', 'wallet-outline')]: 'Wallet',
  [key('material-community', 'chart-pie')]: 'ChartPie',
  [key('material-community', 'chart-pie-outline')]: 'ChartPie',
  [key('material-community', 'flag')]: 'Goal',
  [key('material-community', 'flag-outline')]: 'Goal',

  // Ionicons — navigation & chrome
  [key('ionicons', 'chevron-up')]: 'ChevronUp',
  [key('ionicons', 'home-outline')]: 'House',

  // Actions
  [key('ionicons', 'search-outline')]: 'Search',
  [key('ionicons', 'scan-outline')]: 'ScanLine',
  [key('ionicons', 'filter-outline')]: 'ListFilter',
  [key('ionicons', 'filter')]: 'ListFilter',

  // Finance / accounts
  [key('ionicons', 'wallet-outline')]: 'Wallet',
  [key('ionicons', 'wallet')]: 'Wallet',
  [key('ionicons', 'business-outline')]: 'Store',
  [key('ionicons', 'receipt-outline')]: 'ReceiptText',
  [key('ionicons', 'cash-outline')]: 'HandCoins',
  [key('ionicons', 'swap-horizontal-outline')]: 'ArrowLeftRight',
  [key('ionicons', 'arrow-down-circle-outline')]: 'BanknoteArrowDown',
  [key('ionicons', 'trending-up-outline')]: 'TrendingUp',
  [key('ionicons', 'trending-down-outline')]: 'TrendingDown',
  [key('ionicons', 'pie-chart-outline')]: 'ChartPie',

  // People / contacts
  [key('ionicons', 'person-outline')]: 'ContactRound',
  [key('ionicons', 'person')]: 'ContactRound',
  [key('ionicons', 'person-add-outline')]: 'ContactRound',

  // AI / insights
  [key('ionicons', 'sparkles-outline')]: 'Brain',
  [key('material', 'auto-awesome')]: 'Brain',
  [key('material-community', 'sparkles')]: 'Brain',
  [key('material-community', 'alert-circle-outline')]: 'CircleAlert',

  // Paycheck / shields / cards
  [key('material-community', 'shield-outline')]: 'Shield',
  [key('material-community', 'shield-check-outline')]: 'ShieldCheck',
  [key('material-community', 'credit-card-outline')]: 'CreditCard',
  [key('material-community', 'home-outline')]: 'House',

  // Visibility
  [key('material-community', 'eye-outline')]: 'Eye',
  [key('material-community', 'eye-off-outline')]: 'EyeOff',

  // Upload / sync
  [key('ionicons', 'cloud-upload-outline')]: 'Upload',
  [key('ionicons', 'cloud-outline')]: 'CloudSync',
};

export function resolveLucideNameForLegacy(family: LegacyIconFamily, name: string): string | null {
  return LEGACY_TO_LUCIDE_MAP[`${family}:${name}`] ?? null;
}
