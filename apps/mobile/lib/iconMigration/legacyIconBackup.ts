/**
 * Rollback reference — original vector icon identifiers before Lucide migration.
 * To revert a screen: replace AppIcon with the legacy component + name listed here.
 *
 * Generated manually for design-system migration (2026-06-20).
 */

export type LegacyIconFamily = 'ionicons' | 'material-community' | 'material';

export type LegacyIconRef = {
  family: LegacyIconFamily;
  name: string;
};

/** Tab bar — FloatingTabBar.tsx */
export const TAB_BAR_ICONS_BACKUP = {
  index: { outline: 'home-outline', filled: 'home' },
  transactions: { outline: 'receipt-text-outline', filled: 'receipt-text' },
  accounts: { outline: 'wallet-outline', filled: 'wallet' },
  goals: { outline: 'compass-outline', filled: 'compass' },
  budgets: { outline: 'chart-pie-outline', filled: 'chart-pie' },
} as const satisfies Record<string, { outline: string; filled: string }>;

/** Dashboard header — app/(tabs)/index.tsx */
export const DASHBOARD_HEADER_ICONS_BACKUP = {
  lucideCatalog: { family: 'ionicons', name: 'grid-outline' } satisfies LegacyIconRef,
  settings: { family: 'ionicons', name: 'settings-outline' } satisfies LegacyIconRef,
} as const;

/** HomeInsightCard.tsx */
export const HOME_INSIGHT_ICONS_BACKUP = {
  badge: { family: 'material', name: 'auto-awesome' } satisfies LegacyIconRef,
  alert: { family: 'material-community', name: 'alert-circle-outline' } satisfies LegacyIconRef,
} as const;

/** HomeAvailableNowHero.tsx */
export const HOME_HERO_ICONS_BACKUP = {
  eye: { family: 'material-community', name: 'eye-outline' } satisfies LegacyIconRef,
  eyeOff: { family: 'material-community', name: 'eye-off-outline' } satisfies LegacyIconRef,
} as const;

/** Tab bar goals — legacy compass → Lucide Compass */
export const TAB_BAR_GOALS_BACKUP = {
  outline: 'compass-outline',
  filled: 'compass',
  lucide: 'Compass',
} as const;

/** PaycheckAllocationWidget.tsx */
export const PAYCHECK_WIDGET_ICONS_BACKUP = {
  chevron: { family: 'ionicons', name: 'chevron-forward' } satisfies LegacyIconRef,
} as const;

/** PaycheckAllocationScreen.tsx */
export const PAYCHECK_SCREEN_ICONS_BACKUP = {
  back: { family: 'ionicons', name: 'chevron-back' } satisfies LegacyIconRef,
  arrow: { family: 'ionicons', name: 'arrow-forward' } satisfies LegacyIconRef,
  check: { family: 'ionicons', name: 'checkmark' } satisfies LegacyIconRef,
  confirm: { family: 'ionicons', name: 'checkmark-circle' } satisfies LegacyIconRef,
} as const;
