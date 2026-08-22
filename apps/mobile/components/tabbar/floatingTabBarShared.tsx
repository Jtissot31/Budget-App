/**
 * Shared constants + small presentational pieces for FloatingTabBar (native + web).
 */
import { useEffect, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppIcon } from '@/components/icons/AppIcon';
import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';
import { pressableCompactMotionStyle } from '@/constants/motionKit';
import { radius, spacing } from '@/constants/theme';
import { uiEvents } from '@/lib/events';

export const PILL_BORDER_RADIUS = 999;
export const TAB_ICON_SIZE = 21;
export const TAB_ICON_SIZE_ACTIVE = 24;

export const ROUTE_ICONS: Record<
  string,
  {
    outline: keyof typeof MaterialCommunityIcons.glyphMap;
    filled: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  index: { outline: 'home-outline', filled: 'home' },
  transactions: { outline: 'swap-horizontal', filled: 'swap-horizontal' },
  accounts: { outline: 'wallet-outline', filled: 'wallet' },
  budgets: { outline: 'chart-pie-outline', filled: 'chart-pie' },
  goals: { outline: 'calendar-month-outline', filled: 'calendar-month' },
};

export const ROUTE_LABELS: Record<string, string> = {
  index: 'Accueil',
  transactions: 'Transactions',
  accounts: 'Comptes',
  budgets: 'Budget',
  goals: 'Agenda',
  settings: 'Réglages',
};

export const HIDDEN_ROUTES = new Set(['settings', 'widgets']);

function normalizeAppPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  return pathname.replace(/\/+$/, '') || '/';
}

/** Analyse dépenses overlay — hide + / voice FABs; keep them on the Transactions tab. */
export function isTransactionsInsightsPath(pathname: string | null | undefined): boolean {
  return normalizeAppPathname(pathname) === '/transactions-insights';
}

/** Bibliothèque / détail de stratégies — browse page, no add-transaction FAB. */
export function isPlansExplorePath(pathname: string | null | undefined): boolean {
  const normalized = normalizeAppPathname(pathname);
  if (!normalized) return false;
  return (
    normalized === '/plans/explore' ||
    normalized.startsWith('/plans/template/') ||
    normalized === '/plans/create' ||
    /^\/plans\/[^/]+$/.test(normalized)
  );
}

/** Analyse abonnements overlay — same FAB policy as dépenses insights. */
export function isSubscriptionsInsightsPath(pathname: string | null | undefined): boolean {
  return normalizeAppPathname(pathname) === '/subscriptions-insights';
}

/** Full-page transaction detail — hide + FAB; it overlaps the receipt attach section. */
export function isTransactionDetailPath(pathname: string | null | undefined): boolean {
  const normalized = normalizeAppPathname(pathname);
  if (!normalized) return false;
  return normalized === '/transaction-detail' || normalized.startsWith('/transaction-detail/');
}

/** Recurring payment detail route (if opened as a page instead of the Agenda sheet). */
export function isPaymentDetailPath(pathname: string | null | undefined): boolean {
  const normalized = normalizeAppPathname(pathname);
  if (!normalized) return false;
  return normalized === '/payment-detail' || normalized.startsWith('/payment-detail/');
}

/** Receipt scan chooser — hide + FAB so it doesn’t cover the two capture actions. */
export function isScanPath(pathname: string | null | undefined): boolean {
  return normalizeAppPathname(pathname) === '/scan';
}

/** Merchant receipts list — browse-only; scan FAB overlaps the receipt rows. */
export function isMerchantReceiptsPath(pathname: string | null | undefined): boolean {
  return normalizeAppPathname(pathname) === '/merchant-receipts';
}

export function shouldHideTransactionsTabFabs(pathname: string | null | undefined): boolean {
  return (
    isTransactionsInsightsPath(pathname) ||
    isSubscriptionsInsightsPath(pathname) ||
    isPlansExplorePath(pathname) ||
    isTransactionDetailPath(pathname) ||
    isPaymentDetailPath(pathname) ||
    isScanPath(pathname) ||
    isMerchantReceiptsPath(pathname)
  );
}

/** Hide + FAB / speed-dial on analysis, receipts list, transaction detail, scan, and agenda payment detail overlay. */
export function useShouldHideTabFabs(pathname: string | null | undefined): boolean {
  const [agendaPaymentDetailOpen, setAgendaPaymentDetailOpen] = useState(false);

  useEffect(
    () => uiEvents.subscribeAgendaPaymentDetailOpen(setAgendaPaymentDetailOpen),
    [],
  );

  return shouldHideTransactionsTabFabs(pathname) || agendaPaymentDetailOpen;
}

export type HistoryAddTransactionType = 'expense' | 'income' | 'transfer';

export const HISTORY_FAB_OPTION_ICON_COLOR = '#FFFFFF';

export const HISTORY_FAB_ADD_ACTIONS: {
  type: HistoryAddTransactionType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}[] = [
  {
    type: 'transfer',
    label: 'Virement',
    icon: 'swap-horizontal-outline',
    accessibilityLabel: 'Ajouter un virement',
  },
  {
    type: 'expense',
    label: 'Dépense',
    icon: 'arrow-down-circle-outline',
    accessibilityLabel: 'Ajouter une dépense',
  },
  {
    type: 'income',
    label: 'Revenu',
    icon: 'cash-outline',
    accessibilityLabel: 'Ajouter un revenu',
  },
];

export const FAB_STACK_OFFSET_ADD = 104;
export const HISTORY_FAB_MAIN_SIZE = 54;
export const HISTORY_FAB_OPTION_ROW_HEIGHT = 44;
export const HISTORY_FAB_ARC_RADIUS = 125;
export const HISTORY_FAB_ARC_ANGLES_DEG = [195, 163, 121] as const;
export const HISTORY_FAB_OPTION_PILL_WIDTH = 132;
export const HISTORY_FAB_ARC_STAGGER_MS = 55;
export const AGENDA_FAB_OPTION_PILL_WIDTH = 132;

export const AGENDA_FAB_ADD_ACTIONS: {
  variant: RecurringPaymentAddVariant;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}[] = [
  {
    variant: 'subscription',
    label: 'Abonnement',
    icon: 'repeat-outline',
    accessibilityLabel: 'Ajouter un abonnement',
  },
  {
    variant: 'bill',
    label: 'Paiements',
    icon: 'document-text-outline',
    accessibilityLabel: 'Ajouter un paiement récurrent',
  },
  {
    variant: 'income',
    label: 'Revenus',
    icon: 'trending-up-outline',
    accessibilityLabel: 'Ajouter un revenu récurrent',
  },
];

export function getHistoryFabArcOffsets(angleDeg: number, arcRadius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    right: -arcRadius * Math.cos(rad) - HISTORY_FAB_OPTION_PILL_WIDTH / 2,
    bottom: arcRadius * Math.sin(rad) - HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
  };
}

export function getAgendaFabArcOffsets(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    right: -r * Math.cos(rad) - AGENDA_FAB_OPTION_PILL_WIDTH / 2,
    bottom: r * Math.sin(rad) - HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
  };
}

export function PlusFabIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2Z"
      />
    </Svg>
  );
}

type TabButtonProps = {
  tabLabel: string;
  focused: boolean;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  onPress: () => void;
};

export function TabButton({ tabLabel, focused, iconName, iconColor, onPress }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [tabStyles.tabSlot, pressableCompactMotionStyle(pressed)]}
      accessibilityRole="tab"
      accessibilityLabel={tabLabel}
      accessibilityState={{ selected: focused }}
    >
      <View style={tabStyles.tabInner}>
        <AppIcon
          family="material-community"
          name={iconName}
          size={focused ? TAB_ICON_SIZE_ACTIVE : TAB_ICON_SIZE}
          color={iconColor}
          focused={focused}
        />
      </View>
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.lg,
  },
});
