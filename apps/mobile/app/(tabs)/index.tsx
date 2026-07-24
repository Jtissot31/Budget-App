import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { AppIcon } from '@/components/icons/AppIcon';
import { AlertCenterButton } from '@/components/AlertCenterButton';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  dashboardPalette,
  dashboardPaletteForTheme,
  FLOATING_NAV_CONTENT_PADDING,
  ICON_WELL_SIZE,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  interNumericExtraBoldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { PLAN_FINANCE_CONTAINER } from '@/constants/planFinanceKit';
import {
  MinimizedAlertCard,
  type DashboardAlertSeverity,
} from '@/components/MinimizedAlertCard';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { HomeInsightCardWithAI } from '@/components/dashboard/HomeInsightCardWithAI';
import { HomeAvailableNowHero } from '@/components/dashboard/HomeAvailableNowHero';
import { HomePlansCarousel } from '@/components/dashboard/HomePlansCarousel';
import { PaycheckAllocationWidget } from '@/components/PaycheckAllocationWidget';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { ensureDbReady } from '@/lib/init';
import {
  getRecentIncomeTransactions,
  getRecurringPayments,
  getSimulatedAccounts,
  getTransactionsSince,
} from '@/lib/db';
import {
  buildCheckingBalanceDailyValues,
  CHECKING_BALANCE_SPARKLINE_DAY_COUNT,
} from '@/lib/buildCheckingBalanceTrendSeries';
import { sumVisibleCheckingBalance } from '@/lib/homeCheckingBalance';
import { PAYCHECK_TRANSACTION_LOOKBACK_LIMIT, resolveNextPaycheckForAccount, resolvePaycheckForPaymentAlert } from '@/lib/estimatedPaycheck';
import {
  evaluateCheckingInsufficientFunds,
  type InsufficientFundsCheckingAlert,
} from '@/lib/insufficientFundsAlert';
import { dataEvents } from '@/lib/events';
import { getUserDisplayName } from '@/lib/userDisplay';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAlertCenter } from '@/hooks/useAlertCenter';
import {
  alertDetailRouteParams,
  alertSectionForKind,
  paymentAlertCenterId,
  paymentAlertKindFromTitle,
  type AlertCenterItem,
} from '@/lib/alerts';
import { creditUsedFromBalance } from '@/lib/creditLimitUtilization';
import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import {
  ALERT_TITLES,
  buildCreditLimitAlertTitle,
  buildLowFundsAlertTitle,
} from '@/lib/alertPresentation';
import {
  heroStatAmount,
  percentStat,
  rowLabel,
  rowValue,
} from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { syncWithServer } from '@/lib/sync';
import {
  buildPaycheckEntryMessage,
  disablePaycheckReminder,
  dismissPaycheckEntryPromptForToday,
  enablePaycheckReminder,
  findDuePaycheckEntryPrompt,
  loadAlertUiState,
  setAlertCollapsed as persistAlertCollapsed,
  type PaycheckEntryPrompt,
  type PaycheckReminderSchedule,
} from '@/lib/paycheckReminder';
import type { EstimatedPaycheck } from '@/lib/estimatedPaycheck';
import { useAppTheme } from '@/lib/themeContext';
import { PageTransition } from '@/components/PageTransition';
import type {
  RecurringPayment,
  RecurringPaymentKind,
  SimulatedAccount,
  Transaction,
} from '@/types';

type UpcomingPayment = {
  id?: string;
  name: string;
  amount: number;
  account: string;
  date: string;
  recurring: boolean;
  kind?: RecurringPaymentKind;
  accountId?: string;
  icon?: string;
  color?: string;
  logoUrl?: string | null;
};

/** Compte résolu (base de données ou fiches fictives) pour le jumelage paiements récurrents → solde / limite. */
type PaymentResolutionAccount = {
  id: string;
  name: string;
  balance: number;
  kind: SimulatedAccount['kind'];
  creditLimit?: number;
};

const UPCOMING_PAYMENTS: UpcomingPayment[] = [
  {
    name: 'Netflix',
    amount: 15.99,
    account: 'Visa · 9104',
    date: '2026-05-20',
    recurring: true,
    kind: 'payment',
    accountId: '3',
  },
  {
    name: 'Gym',
    amount: 49.99,
    account: 'Desjardins · 4521',
    date: '2026-05-25',
    recurring: true,
    kind: 'payment',
    accountId: '1',
  },
  {
    name: 'Assurance auto',
    amount: 180,
    account: 'Desjardins · 4521',
    date: '2026-05-28',
    recurring: true,
    kind: 'payment',
    accountId: '1',
  },
  {
    name: 'Loyer',
    amount: 1200,
    account: 'Desjardins · 4521',
    date: '2026-06-01',
    recurring: true,
    kind: 'payment',
    accountId: '1',
  },
];

function sparklineTransactionsSinceIso(dayCount: number = CHECKING_BALANCE_SPARKLINE_DAY_COUNT): string {
  const since = new Date();
  since.setDate(since.getDate() - (dayCount + 1));
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

const C = dashboardPalette;

const DASHBOARD_BOTTOM_PADDING = FLOATING_NAV_CONTENT_PADDING;

const PAYMENT_WARNING_TITLE_CHECKING = ALERT_TITLES.lowFunds;
const PAYMENT_SUCCESS_TITLE_CHECKING = 'Fonds disponibles';

function greetingLine() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonsoir';
  if (h < 12) return 'Bon matin';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

/** Once per app session — avoid replaying on tab remount / re-focus. */
let accueilGreetingEntrancePlayed = false;

const GREETING_ENTRANCE = {
  translateY: 10,
  durationMs: 600,
  delayMs: 80,
} as const;

function formatMoneyDetailed(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function formatUpcomingDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function daysUntil(isoDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

type AlertStatRow = {
  currentBalance: number;
  paymentAmount: number;
  afterAmount: number;
  afterLabel: string;
  kind: 'credit' | 'checking';
};

type DashboardAlertItem = {
  id: string;
  color: string;
  bg: string;
  severity?: DashboardAlertSeverity;
  title: string;
  body: string;
  date: string;
  accountName?: string;
  accountId?: string;
  paymentName?: string;
  paymentDateRaw?: Date;
  paycheckDateRaw?: Date;
  stats?: AlertStatRow;
  /** Dépôt de paie (estimé ou réel) avant ou le jour du paiement */
  paycheckBeforePayment?: boolean;
  paycheckIsEstimated?: boolean;
  collapsedSummary?: string;
};

function resolveDashboardAlertSeverity(alert: DashboardAlertItem): DashboardAlertSeverity {
  if (alert.severity) return alert.severity;
  const title = alert.title.toLowerCase();
  if (title.includes('objectif') || title.includes('atteint')) return 'success';
  if (title.includes('limite') || title.includes('crédit')) return 'danger';
  return 'warning';
}

function minimizedAlertSubtitle(alert: DashboardAlertItem): string {
  const name = alert.paymentName?.trim() || alert.accountName?.trim() || '';
  if (!name) return alert.date;
  return `${name} le ${alert.date}`;
}

function minimizedAlertBadgeAmount(alert: DashboardAlertItem): string {
  if (!alert.stats) return '';
  const { kind, paymentAmount, currentBalance, afterLabel } = alert.stats;
  if (kind === 'checking' || afterLabel === 'Manque') {
    const shortfall = Math.max(0, paymentAmount - currentBalance);
    return shortfall > 0 ? formatSignedDisplayMoney(-shortfall) : '';
  }
  return formatSignedDisplayMoney(-paymentAmount);
}

/** `AlertDiamondFill` from src/icons — React Native SVG. */
function AlertDiamondFillIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="m13.414 2.807l7.778 7.779a2 2 0 0 1 0 2.828l-7.778 7.778a2 2 0 0 1-2.828 0l-7.778-7.778a2 2 0 0 1 0-2.828l7.778-7.779a2 2 0 0 1 2.828 0ZM12.002 15a1 1 0 0 0-.119 1.993l.12.007a1 1 0 0 0 0-2ZM12 8a1.44 1.44 0 0 0-1.44 1.485l.01.135l.438 3.504a1 1 0 0 0 1.964.113l.02-.113l.438-3.504A1.441 1.441 0 0 0 12 8Z"
      />
    </Svg>
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getUpcomingPayments(
  recurringPayments: RecurringPayment[],
  resolutionPool: PaymentResolutionAccount[],
): UpcomingPayment[] {
  const persisted = recurringPayments
    .filter((payment) => payment.active)
    .map((payment) => {
      const resolved = resolvePaymentAccountForUpcoming(
        payment.accountLabel,
        payment.accountId,
        resolutionPool,
      );
      const displayAccount = resolved?.name?.trim() || payment.accountLabel;
      return {
        id: payment.id,
        name: payment.name,
        amount: payment.amount,
        account: displayAccount,
        date: payment.nextDate ?? nextMonthlyDate(payment.dueDay),
        recurring: true,
        kind: payment.kind,
        accountId: payment.accountId,
        icon: payment.icon,
        color: payment.color,
        logoUrl: payment.logoUrl ?? null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return persisted.length ? persisted : UPCOMING_PAYMENTS;
}

function nextMonthlyDate(dueDay?: number | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = Math.min(Math.max(dueDay ?? today.getDate(), 1), 28);
  const next = new Date(today.getFullYear(), today.getMonth(), day);
  if (next < today) next.setMonth(next.getMonth() + 1);
  return isoDate(next);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function normalizeAccountLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Partie « nom » avant un suffixe « · 1234 » (libellé du sélecteur récurrent). */
function primaryNormalizedAccountLabelKey(accountLabel: string) {
  const normalized = normalizeAccountLabel(accountLabel.trim());
  const beforeBullet = normalized.split(/\s*•\s*/)[0]?.trim() ?? normalized;
  return beforeBullet;
}

const LEGACY_MANUAL_ACCOUNT_ID_TO_KIND: Record<string, PaymentResolutionAccount['kind']> = {
  checking: 'checking',
  credit: 'credit',
  savings: 'savings',
};

function kindRankForResolution(kind: PaymentResolutionAccount['kind']) {
  if (kind === 'checking') return 0;
  if (kind === 'cash') return 1;
  if (kind === 'savings') return 2;
  if (kind === 'credit') return 3;
  return 4;
}

function sortPaymentResolutionPool(pool: PaymentResolutionAccount[]): PaymentResolutionAccount[] {
  return [...pool].sort(
    (a, b) =>
      kindRankForResolution(a.kind) - kindRankForResolution(b.kind) ||
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
}

function toPaymentResolutionAccounts(accounts: SimulatedAccount[]): PaymentResolutionAccount[] {
  if (accounts.length > 0) {
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      balance: account.balance,
      kind: account.kind,
      creditLimit: account.creditLimit,
    }));
  }
  return DASHBOARD_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    balance: account.balance,
    kind: account.kind,
    creditLimit: account.creditLimit,
  }));
}

function resolvePaymentAccountForUpcoming(
  accountLabel: string,
  accountId: string | undefined,
  pool: PaymentResolutionAccount[],
): PaymentResolutionAccount | undefined {
  const ordered = sortPaymentResolutionPool(pool);
  const rawId = accountId?.trim();

  if (rawId) {
    const byId = ordered.find((a) => a.id === rawId);
    if (byId) return byId;

    const legacyKind = LEGACY_MANUAL_ACCOUNT_ID_TO_KIND[rawId];
    if (legacyKind) {
      const byKind = ordered.find((a) => a.kind === legacyKind);
      if (byKind) return byKind;
    }
  }

  const label = normalizeAccountLabel(accountLabel);
  const labelKey = primaryNormalizedAccountLabelKey(accountLabel);

  const exactName = ordered.find((a) => normalizeAccountLabel(a.name) === labelKey);
  if (exactName) return exactName;

  const exactFullLabel = ordered.find((a) => normalizeAccountLabel(a.name) === label);
  if (exactFullLabel) return exactFullLabel;

  if (labelKey.length >= 3) {
    const uniqueByNamePrefix = ordered.filter(
      (a) =>
        normalizeAccountLabel(a.name) === labelKey ||
        normalizeAccountLabel(a.name).startsWith(`${labelKey} `),
    );
    if (uniqueByNamePrefix.length === 1) return uniqueByNamePrefix[0];
  }

  if (label.includes('cheque') || label.includes('cheq') || label.includes('courant')) {
    return ordered.find((a) => a.kind === 'checking');
  }
  if (label.includes('carte') || label.includes('credit')) {
    return ordered.find((a) => a.kind === 'credit');
  }
  if (label.includes('epargne')) {
    return ordered.find((a) => a.kind === 'savings');
  }

  return ordered.find(
    (a) =>
      normalizeAccountLabel(a.name).includes(label) ||
      (labelKey.length >= 4 && label.includes(normalizeAccountLabel(a.name))),
  );
}

type CreditPaymentRisk =
  | { shouldWarn: false }
  | {
      shouldWarn: true;
      reason: 'over_limit' | 'high_utilization';
      usedAfter: number;
      /** Crédit disponible après le paiement (peut être négatif si dépassement). */
      headroomAfter: number;
      creditLimit: number;
      overLimitBy: number;
    };

/**
 * Avertissement carte de crédit (pas la même règle que le dépôt / compte courant).
 * On projette la dette après le charge récurrent :
 * - Dépassement : creditUsed + paiement > limite
 * - Marge sous la limite ≤ 10 % après le paiement : (limite - detteProjetée) / limite ≤ 0,10
 *   ⇔ utilisation projetée ≥ 90 % (peu de crédit disponible restant).
 */
function evaluateCreditPaymentRisk(
  creditLimit: number,
  balance: number,
  paymentAmount: number,
): CreditPaymentRisk {
  if (creditLimit <= 0 || paymentAmount <= 0) return { shouldWarn: false };
  const creditUsed = creditUsedFromBalance(balance);
  const usedAfter = creditUsed + paymentAmount;
  const headroomAfter = creditLimit - usedAfter;
  const headroomRatioAfter = headroomAfter / creditLimit;

  if (usedAfter > creditLimit) {
    return {
      shouldWarn: true,
      reason: 'over_limit',
      usedAfter,
      headroomAfter,
      creditLimit,
      overLimitBy: Math.max(0, usedAfter - creditLimit),
    };
  }
  if (headroomRatioAfter <= 0.1) {
    return {
      shouldWarn: true,
      reason: 'high_utilization',
      usedAfter,
      headroomAfter: Math.max(0, headroomAfter),
      creditLimit,
      overLimitBy: 0,
    };
  }
  return { shouldWarn: false };
}

/**
 * Nom affiché sur la pastille d’alerte (solde ou limite) : utilise le compte résolu ;
 * carte de crédit en majuscules (accents conservés avec toUpperCase JavaScript).
 */
function insufficientFundsAlertPillLabel(
  resolvedAccount: PaymentResolutionAccount | undefined,
): string {
  if (!resolvedAccount) return '\u2014';
  const name = resolvedAccount.name.trim();
  if (!name) return '\u2014';
  if (resolvedAccount.kind === 'credit') return name.toUpperCase();
  return name;
}

/** Données de démonstration fixes (limite crédit) — aucune lecture/écriture DB. */
const MOCK_CREDIT_CARD_NAME = 'Visa · 4782';
/** Limite carte (démo). */
const MOCK_CREDIT_LIMIT = 5000;
/** Solde avant paiement (négatif = dette), 4350 $ dus. */
const MOCK_CREDIT_BALANCE_BEFORE = -4350;
/** Paiement a J+3 : 4350 + 450 = 4800 -> 96 % de la limite (bande rouge mock >= 95 %). */
const MOCK_CREDIT_PAYMENT_AMOUNT = 450;
/** Ex. zone orange 80-94,99 % (mockCreditUtilizationBarColor) : usedAfter / limite ~0,88 -> ajuster PAYMENT ou BALANCE. */
const MOCK_CREDIT_PAYMENT_NAME = 'Abonnement cloud';


const ALERT_BAR_H = 9;
const ALERT_MARKER_SIZE = 26;
const ALERT_MARKER_OUTER = ALERT_MARKER_SIZE + 4;
const ALERT_BAR_PADDING_V = 16; // space above bar for ▼ triangle

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isPaycheckOnOrBeforePayment(paymentDate: Date, paycheckDate: Date) {
  return startOfDay(paycheckDate).getTime() <= startOfDay(paymentDate).getTime();
}

function paycheckMetaFromTimeline(
  paymentDate: Date,
  paycheck: EstimatedPaycheck | null | undefined,
  fallbackPaycheckDate: Date,
) {
  const paycheckDate = paycheck?.date ?? fallbackPaycheckDate;
  return {
    paycheckBeforePayment: isPaycheckOnOrBeforePayment(paymentDate, paycheckDate),
    paycheckIsEstimated: paycheck ? paycheck.source !== 'actual' : true,
  };
}

function markerLeftOnTrack(xPx: number, trackWidth: number) {
  return Math.max(0, Math.min(trackWidth - ALERT_MARKER_OUTER, xPx - ALERT_MARKER_OUTER / 2));
}

/** Carte de crédit : solde affiché en négatif (−X$). */
function formatAlertCreditBalance(balance: number) {
  const signed = balance <= 0 ? balance : -Math.abs(balance);
  return formatSignedDisplayMoney(signed);
}

function formatAlertCheckingBalance(balance: number) {
  if (balance < 0) {
    return `${formatMoneyDetailed(Math.abs(balance))} dû`;
  }
  return formatMoneyDetailed(balance);
}

function dashboardAlertToCenterItem(alert: DashboardAlertItem): AlertCenterItem {
  const kind = paymentAlertKindFromTitle(alert.title);
  return {
    id: paymentAlertCenterId(alert.id),
    kind,
    section: alertSectionForKind(kind),
    severity: resolveDashboardAlertSeverity(alert) === 'danger' ? 'danger' : 'warning',
    title: alert.title,
    message: alert.body,
    timestamp: alert.paymentDateRaw?.toISOString() ?? new Date().toISOString(),
    read: true,
    accountId: alert.accountId,
    montant: alert.stats?.paymentAmount ?? null,
  };
}

function AlertCard({
  alert,
  today,
  collapsed,
  reminderEnabled,
  onToggleReminder,
  onOpenDetail,
  onCollapse,
}: {
  alert: DashboardAlertItem;
  today: Date;
  collapsed: boolean;
  reminderEnabled: boolean;
  onToggleReminder: () => void;
  onOpenDetail: () => void;
  onCollapse: () => void;
}) {
  const { isLight, colors } = useAppTheme();
  const palette = useMemo(() => dashboardPaletteForTheme(isLight), [isLight]);
  const muted = isLight ? palette.subtext : 'rgba(245,245,245,0.84)';
  const [barPx, setBarPx] = useState(0);
  const showBell = alert.paycheckBeforePayment === true;
  const todayNorm = startOfDay(today);
  const paymentDate = startOfDay(alert.paymentDateRaw ?? addDays(today, 4));
  const paycheckDate = startOfDay(alert.paycheckDateRaw ?? addDays(today, 14));
  const periodStart = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const periodEnd =
    paycheckDate.getTime() >= paymentDate.getTime() ? paycheckDate : startOfDay(addDays(paymentDate, 7));
  const totalMs = Math.max(periodEnd.getTime() - periodStart.getTime(), 1);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const todayPct = clamp((todayNorm.getTime() - periodStart.getTime()) / totalMs);
  const payPct = clamp((paymentDate.getTime() - periodStart.getTime()) / totalMs);
  const paycheckPct = clamp((paycheckDate.getTime() - periodStart.getTime()) / totalMs);

  const todayX = barPx * todayPct;
  const payX = barPx * payPct;
  const paycheckX = barPx * paycheckPct;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const startLabel    = fmtDate(periodStart);
  const endLabel      = fmtDate(periodEnd);
  const todayLabel    = fmtDate(today);
  const paymentLabel = fmtDate(paymentDate);
  const paycheckLabel = fmtDate(paycheckDate);

  const trackTop = ALERT_BAR_PADDING_V;
  const markerTop = trackTop + ALERT_BAR_H / 2 - ALERT_MARKER_OUTER / 2;

  if (collapsed) {
    return (
      <MinimizedAlertCard
        title={alert.title}
        subtitle={minimizedAlertSubtitle(alert)}
        badgeAmount={minimizedAlertBadgeAmount(alert)}
        severity={resolveDashboardAlertSeverity(alert)}
        showBell={showBell}
        reminderEnabled={reminderEnabled}
        accessibilityLabel={`Ouvrir l'alerte ${alert.title}`}
        onPress={() => {
          tapHaptic();
          onOpenDetail();
        }}
        onToggleReminder={() => {
          tapHaptic();
          onToggleReminder();
        }}
      />
    );
  }

  return (
    <PlanFinanceContainer style={aStyles.card}>
      <View style={aStyles.cardHeaderRow}>
        <View style={aStyles.cardTitleBlock}>
          <DashboardStatCard
            icon={<AlertDiamondFillIcon size={16} color={alert.color} />}
            label={alert.title.toUpperCase()}
            value={alert.accountName ?? alert.paymentName ?? alert.title}
            subtitle={alert.date}
            valueColor={palette.text}
          />
        </View>
        <View style={aStyles.cardHeaderActions}>
          {showBell ? (
            <Pressable
              onPress={() => {
                tapHaptic();
                onToggleReminder();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={reminderEnabled ? 'Désactiver le rappel de paie' : 'Rappel le jour de la paie'}
              style={aStyles.bellButton}
            >
              <AppIcon family="ionicons"
                name={reminderEnabled ? 'notifications' : 'notifications-outline'}
                size={20}
                color={reminderEnabled ? palette.warning : palette.subtext}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              tapHaptic();
              onCollapse();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Réduire l'alerte"
          >
            <AppIcon family="ionicons" name="chevron-up" size={18} color={palette.subtext} />
          </Pressable>
        </View>
      </View>

      <View style={[aStyles.bodyContainer, { backgroundColor: palette.iconBox }]}>
        <Text style={[aStyles.bodyText, { color: palette.text }]}>{alert.body}</Text>
      </View>

      {alert.stats ? (
        <View style={aStyles.statsRow}>
          <DashboardStatCard
            compact
            label="Solde actuel"
            value={
              alert.stats.kind === 'credit'
                ? formatAlertCreditBalance(alert.stats.currentBalance)
                : formatAlertCheckingBalance(alert.stats.currentBalance)
            }
            valueColor={colors.text}
          />
          <View style={aStyles.statDivider} />
          <DashboardStatCard
            compact
            label="Paiement"
            value={formatMoneyDetailed(alert.stats.paymentAmount)}
            valueColor={colors.text}
          />
        </View>
      ) : null}
      <View style={aStyles.timeline}>

        {/* Date labels */}
        <View style={aStyles.dateRow}>
          <Text style={[aStyles.dateLabel, { color: muted }]}>{startLabel}</Text>
          <Text style={[aStyles.dateLabel, { color: muted }]}>{endLabel}</Text>
        </View>

        {/* Bar zone — measured width, markers centered on dates */}
        <View
          style={[aStyles.barZone, { height: ALERT_BAR_PADDING_V + ALERT_BAR_H + ALERT_MARKER_OUTER / 2 + 8 }]}
          onLayout={(e) => setBarPx(e.nativeEvent.layout.width)}
        >
          {barPx > 0 && (
            <>
              {/* Today caret — aligned to today on the bar */}
              <View style={[aStyles.todayArrow, { left: Math.max(0, Math.min(barPx - 12, todayX - 6)), top: 0 }]}>
                <AppIcon family="ionicons" name="caret-down" size={12} color={palette.subtext} />
              </View>

              {/* Track — fill = elapsed time until today */}
              <View style={[aStyles.track, { top: trackTop }]}>
                <View style={[aStyles.fill, { width: todayX, backgroundColor: alert.color }]} />
              </View>

              {/* Warning — date du paiement récurrent */}
              <View
                style={[
                  aStyles.markerRing,
                  { left: markerLeftOnTrack(payX, barPx), top: markerTop, borderColor: alert.color },
                ]}
              >
                <View style={[aStyles.marker, { backgroundColor: alert.color }]}>
                  <AlertDiamondFillIcon size={16} color="#fff" />
                </View>
              </View>

              {/* Wallet — dépôt de paie estimé */}
              <View
                style={[
                  aStyles.markerRing,
                  { left: markerLeftOnTrack(paycheckX, barPx), top: markerTop, borderColor: palette.green },
                ]}
              >
                <View style={[aStyles.marker, { backgroundColor: palette.green }]}>
                  <AppIcon family="ionicons" name="wallet" size={14} color="#000" />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Legend */}
        <View style={aStyles.legend}>
          <View style={aStyles.legendRow}>
            <AppIcon family="ionicons" name="caret-down" size={12} color={palette.subtext} style={aStyles.legendIcon} />
            <Text style={[aStyles.legendText, { color: muted }]}>{`Aujourd'hui · ${todayLabel}`}</Text>
          </View>
          <View style={aStyles.legendRow}>
            <View style={{ width: 16, alignItems: 'center' }}>
              <AlertDiamondFillIcon size={14} color={alert.color} />
            </View>
            <Text style={[aStyles.legendText, { color: alert.color }]}>
              {alert.paymentName ?? 'Paiement'} · {paymentLabel}
            </Text>
          </View>
          <View style={aStyles.legendRow}>
            <AppIcon family="ionicons" name="wallet" size={12} color={palette.green} style={aStyles.legendIcon} />
            <Text style={[aStyles.legendText, { color: palette.green }]}>Dépôt de paie estimé · {paycheckLabel}</Text>
          </View>
        </View>
      </View>
    </PlanFinanceContainer>
  );
}

const aStyles = StyleSheet.create({
  bellButton: {
    padding: 4,
    flexShrink: 0,
  },
  card: {
    alignSelf: 'stretch',
    gap: spacing.lg,
    padding: PLAN_FINANCE_CONTAINER.padding.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: C.border,
  },
  bodyContainer: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bodyText: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
  },
  timeline: {
    gap: 6,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateLabel: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    color: 'rgba(245,245,245,0.84)',
  },
  barZone: {
    position: 'relative',
    overflow: 'visible',
  },
  todayArrow: {
    position: 'absolute',
  },
  todayArrowText: {
    ...jakartaBoldText,
    fontSize: 10,
    color: 'rgba(245,245,245,0.84)',
    lineHeight: 12,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ALERT_BAR_H,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  markerRing: {
    position: 'absolute',
    width: ALERT_MARKER_SIZE + 4,
    height: ALERT_MARKER_SIZE + 4,
    borderRadius: (ALERT_MARKER_SIZE + 4) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  marker: {
    width: ALERT_MARKER_SIZE,
    height: ALERT_MARKER_SIZE,
    borderRadius: ALERT_MARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    gap: 6,
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendIcon: {
    width: 14,
    textAlign: 'center',
  },
  legendText: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    color: 'rgba(245,245,245,0.84)',
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const dashPalette = useMemo(() => dashboardPaletteForTheme(isLight), [isLight]);
  const dashMuted = isLight ? dashPalette.subtext : 'rgba(245,245,245,0.84)';
  const scrollRef = useRef<ScrollView>(null);
  const [animateGreetingEntrance] = useState(() => {
    if (accueilGreetingEntrancePlayed) return false;
    accueilGreetingEntrancePlayed = true;
    return true;
  });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [displayName, setDisplayName] = useState('Jérémie');
  const [refreshing, setRefreshing] = useState(false);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alertReminders, setAlertReminders] = useState<Record<string, boolean>>({});
  const [alertCollapsed, setAlertCollapsed] = useState<Record<string, boolean>>({});
  const [reminderConfirmVisible, setReminderConfirmVisible] = useState(false);
  const [pendingReminderAlert, setPendingReminderAlert] = useState<Pick<
    DashboardAlertItem,
    'id' | 'paycheckDateRaw' | 'paymentName' | 'accountName' | 'accountId' | 'paycheckIsEstimated'
  > | null>(null);
  const [payEntryPrompt, setPayEntryPrompt] = useState<PaycheckEntryPrompt | null>(null);

  const {
    items: alertCenterItems,
    unreadCount: alertCenterUnreadCount,
    markRead: markAlertCenterRead,
    refresh: refreshAlertCenter,
  } = useAlertCenter({
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    enabled: isReady,
  });

  const openAlertDetail = useCallback(
    (item: AlertCenterItem) => {
      void markAlertCenterRead(item);
      router.push({
        pathname: '/alert-detail',
        params: alertDetailRouteParams(item),
      });
    },
    [markAlertCenterRead, router],
  );

  const paycheckReminderScheduleFromAlert = useCallback(
    (alertItem: Pick<
      DashboardAlertItem,
      'paycheckDateRaw' | 'paymentName' | 'accountName' | 'accountId' | 'paycheckIsEstimated'
    >): PaycheckReminderSchedule | undefined => {
      const paycheckDateKey = alertItem.paycheckDateRaw?.toISOString().slice(0, 10);
      if (!paycheckDateKey) return undefined;
      return {
        paycheckDateKey,
        paymentName: alertItem.paymentName ?? '',
        accountName: alertItem.accountName ?? '',
        accountId: alertItem.accountId,
        paycheckIsEstimated: alertItem.paycheckIsEstimated,
      };
    },
    [],
  );

  const applyPaycheckReminderEnabled = useCallback(
    async (
      alertItem: Pick<
        DashboardAlertItem,
        'id' | 'paycheckDateRaw' | 'paymentName' | 'accountName' | 'accountId' | 'paycheckIsEstimated'
      >,
    ) => {
      const schedule = paycheckReminderScheduleFromAlert(alertItem);
      await enablePaycheckReminder(alertItem.id, schedule);
      setAlertReminders((prev) => ({ ...prev, [alertItem.id]: true }));
      setAlertCollapsed((prev) => ({ ...prev, [alertItem.id]: true }));
    },
    [paycheckReminderScheduleFromAlert],
  );

  const checkPaycheckEntryPrompt = useCallback(async () => {
    const due = await findDuePaycheckEntryPrompt(['live', 'mock-credit']);
    setPayEntryPrompt(due);
  }, []);

  const handleTogglePaycheckReminder = useCallback(
    async (alertItem: DashboardAlertItem) => {
      const enabled = alertReminders[alertItem.id];
      if (enabled) {
        await disablePaycheckReminder(alertItem.id);
        setAlertReminders((prev) => ({ ...prev, [alertItem.id]: false }));
        if (payEntryPrompt?.alertId === alertItem.id) setPayEntryPrompt(null);
      } else if (alertItem.paycheckBeforePayment) {
        setPendingReminderAlert(alertItem);
        setReminderConfirmVisible(true);
      } else {
        await applyPaycheckReminderEnabled(alertItem);
        await checkPaycheckEntryPrompt();
      }
    },
    [alertReminders, applyPaycheckReminderEnabled, checkPaycheckEntryPrompt, payEntryPrompt?.alertId],
  );

  const confirmPaycheckReminder = useCallback(async () => {
    if (pendingReminderAlert) {
      tapHaptic();
      await applyPaycheckReminderEnabled(pendingReminderAlert);
      await checkPaycheckEntryPrompt();
    }
    setReminderConfirmVisible(false);
    setPendingReminderAlert(null);
  }, [pendingReminderAlert, applyPaycheckReminderEnabled, checkPaycheckEntryPrompt]);

  const cancelPaycheckReminderConfirm = useCallback(() => {
    setReminderConfirmVisible(false);
    setPendingReminderAlert(null);
  }, []);

  const dismissPayEntryPromptForToday = useCallback(async () => {
    if (payEntryPrompt) {
      await dismissPaycheckEntryPromptForToday(payEntryPrompt.alertId);
    }
    setPayEntryPrompt(null);
  }, [payEntryPrompt]);

  const openPayEntryFromPrompt = useCallback(async () => {
    if (!payEntryPrompt) return;
    tapHaptic();
    await dismissPaycheckEntryPromptForToday(payEntryPrompt.alertId);
    setPayEntryPrompt(null);
    router.push({
      pathname: '/add-transaction',
      params: {
        type: 'income',
        label: 'Paie',
        ...(payEntryPrompt.accountId ? { accountId: payEntryPrompt.accountId } : {}),
      },
    });
  }, [payEntryPrompt, router]);

  const handleExpandAlert = useCallback(async (alertId: string) => {
    await persistAlertCollapsed(alertId, false);
    setAlertCollapsed((prev) => ({ ...prev, [alertId]: false }));
  }, []);

  const handleCollapseAlert = useCallback(async (alertId: string) => {
    await persistAlertCollapsed(alertId, true);
    setAlertCollapsed((prev) => ({ ...prev, [alertId]: true }));
  }, []);

  const loadSparklineTransactions = useCallback(async () => {
    try {
      const loadedTransactions = await getTransactionsSince(sparklineTransactionsSinceIso());
      setTransactions(loadedTransactions);
    } catch (error) {
      console.warn('[Accueil] sparkline load failed', error);
    }
  }, []);

  const loadCore = useCallback(async () => {
    try {
      // Web JS memory DB + demo seed is fast; native may need a short wait for SQLite/seed.
      await Promise.race([
        ensureDbReady().catch((error: unknown) => {
          console.warn('[Accueil] ensureDbReady failed', error);
        }),
        new Promise<void>((resolve) =>
          setTimeout(resolve, Platform.OS === 'web' ? 8_000 : 4_000),
        ),
      ]);

      const loadRows = Promise.allSettled([
        getUserDisplayName(),
        getRecurringPayments(),
        getSimulatedAccounts(),
        getRecentIncomeTransactions(PAYCHECK_TRANSACTION_LOOKBACK_LIMIT),
      ]);

      const settled = await Promise.race([
        loadRows,
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), Platform.OS === 'web' ? 8_000 : 6_000),
        ),
      ]);

      if (settled === 'timeout') {
        console.warn('[Accueil] data load timed out — rendering with defaults');
        void loadRows.then(([nameResult, recurringResult, accountsResult, incomeResult]) => {
          if (nameResult.status === 'fulfilled') setDisplayName(nameResult.value);
          if (recurringResult.status === 'fulfilled') setRecurringPayments(recurringResult.value);
          if (accountsResult.status === 'fulfilled') setSimulatedAccounts(accountsResult.value);
          if (incomeResult.status === 'fulfilled') setIncomeTransactions(incomeResult.value);
        });
      } else {
        const [nameResult, recurringResult, accountsResult, incomeResult] = settled;
        if (nameResult.status === 'fulfilled') {
          setDisplayName(nameResult.value);
        } else {
          console.warn('[Accueil] display name load failed', nameResult.reason);
        }
        if (recurringResult.status === 'fulfilled') {
          setRecurringPayments(recurringResult.value);
        } else {
          console.warn('[Accueil] recurring payments load failed', recurringResult.reason);
        }
        if (accountsResult.status === 'fulfilled') {
          setSimulatedAccounts(accountsResult.value);
        } else {
          console.warn('[Accueil] accounts load failed', accountsResult.reason);
        }
        if (incomeResult.status === 'fulfilled') {
          setIncomeTransactions(incomeResult.value);
        } else {
          console.warn('[Accueil] income transactions load failed', incomeResult.reason);
        }
      }
    } catch (error) {
      console.warn('[Accueil] load failed', error);
    } finally {
      setIsReady(true);
    }
  }, []);

  const load = useCallback(async () => {
    await loadCore();
    void loadSparklineTransactions();
  }, [loadCore, loadSparklineTransactions]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useEffect(() => {
    void loadAlertUiState(['live', 'mock-credit']).then(({ reminders, collapsed }) => {
      setAlertReminders(reminders);
      setAlertCollapsed((prev) => ({ ...collapsed, ...prev }));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void checkPaycheckEntryPrompt();
  }, [isReady, alertReminders, checkPaycheckEntryPrompt]);

  // Skip thrashing Accueil when hopping between tabs within a few seconds.
  useRefreshOnFocus(load, { skipInitial: true, minIntervalMs: 8_000 });
  useRefreshOnFocus(checkPaycheckEntryPrompt, { skipInitial: true, minIntervalMs: 8_000 });
  useRefreshOnFocus(refreshAlertCenter, { skipInitial: true, minIntervalMs: 8_000 });
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncWithServer();
      await Promise.all([loadCore(), loadSparklineTransactions()]);
    } catch (error) {
      console.warn('[Accueil] refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  };

  const checkingBalance = useMemo(
    () => sumVisibleCheckingBalance(simulatedAccounts),
    [simulatedAccounts],
  );

  const checkingBalanceSeries = useMemo(
    () => buildCheckingBalanceDailyValues(simulatedAccounts, transactions),
    [simulatedAccounts, transactions],
  );

  const paymentResolutionPool = useMemo(
    () => toPaymentResolutionAccounts(simulatedAccounts),
    [simulatedAccounts],
  );

  const upcomingPayments = useMemo(
    () => getUpcomingPayments(recurringPayments, paymentResolutionPool),
    [recurringPayments, paymentResolutionPool],
  );

  if (!isReady) {
    return (
      <View style={[styles.screen, dashStyles.skeletonScreen, { backgroundColor: dashPalette.bg, paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <View style={dashStyles.skeletonGreeting} />
        <View style={dashStyles.skeletonCard} />
        <View style={[dashStyles.skeletonCard, { height: 48 }]} />
        <View style={dashStyles.skeletonCard} />
        <View style={dashStyles.skeletonCard} />
        <Text style={[dashStyles.skeletonHint, { color: dashMuted }]}>Chargement du tableau de bord…</Text>
      </View>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = isoDate(today);
  const sortedUpcomingPayments = [...upcomingPayments].sort((a, b) => a.date.localeCompare(b.date));
  const defaultNextPayment =
    sortedUpcomingPayments.find((payment) => payment.date >= todayIso) ?? sortedUpcomingPayments[0];

  let nextPayment = defaultNextPayment;
  let resolvedAccount = resolvePaymentAccountForUpcoming(
    nextPayment.account,
    nextPayment.accountId,
    paymentResolutionPool,
  );

  let nextPaymentShortfall = 0;
  let showInsufficientFundsWarning = false;
  let creditRiskActive: Extract<CreditPaymentRisk, { shouldWarn: true }> | null = null;
  let checkingFundsAlert: InsufficientFundsCheckingAlert | null = null;

  for (const candidate of sortedUpcomingPayments) {
    if (candidate.date < todayIso || candidate.kind === 'income' || !candidate.recurring) continue;

    const candidateAccount = resolvePaymentAccountForUpcoming(
      candidate.account,
      candidate.accountId,
      paymentResolutionPool,
    );
    if (!candidateAccount) continue;

    if (candidateAccount.kind === 'credit') {
      const creditLimit = candidateAccount.creditLimit;
      if (typeof creditLimit !== 'number' || creditLimit <= 0) continue;

      const risk = evaluateCreditPaymentRisk(creditLimit, candidateAccount.balance, candidate.amount);
      if (!risk.shouldWarn) continue;

      nextPayment = candidate;
      resolvedAccount = candidateAccount;
      showInsufficientFundsWarning = true;
      creditRiskActive = risk;
      checkingFundsAlert = null;
      break;
    }

    const candidatePaymentDate = new Date(`${candidate.date}T00:00:00`);
    const resolvedPaycheck = resolvePaycheckForPaymentAlert(
      candidate.accountId,
      recurringPayments,
      incomeTransactions,
      candidatePaymentDate,
      today,
    );
    const alert = evaluateCheckingInsufficientFunds(
      candidateAccount.balance,
      candidate.amount,
      candidatePaymentDate,
      resolvedPaycheck,
    );
    if (!alert) continue;

    nextPayment = candidate;
    resolvedAccount = candidateAccount;
    showInsufficientFundsWarning = true;
    creditRiskActive = null;
    checkingFundsAlert = alert;
    nextPaymentShortfall = alert.currentShortfall;
    break;
  }

  const isIncomeRecurring = nextPayment.kind === 'income';

  const nextPaymentAccountName = resolvedAccount?.name ?? nextPayment.account;
  const nextPaymentDate = new Date(`${nextPayment.date}T00:00:00`);
  const resolvedPaycheckForTimeline =
    checkingFundsAlert?.resolvedPaycheck ??
    resolvePaycheckForPaymentAlert(
      nextPayment.accountId,
      recurringPayments,
      incomeTransactions,
      nextPaymentDate,
      today,
    ) ??
    resolveNextPaycheckForAccount(nextPayment.accountId, recurringPayments, incomeTransactions, today);
  const estimatedPayDate = resolvedPaycheckForTimeline?.date ?? addDays(today, 14);
  const riskBeforePay = creditRiskActive
    ? nextPaymentDate.getTime() < estimatedPayDate.getTime() && !isIncomeRecurring
    : checkingFundsAlert
      ? !checkingFundsAlert.paycheckArrivesBeforePayment
      : false;

  const nextPaymentDisplayName = formatPersonDirectedPaymentLabel(nextPayment.name);

  const forecastShortfallMessage = (() => {
    if (creditRiskActive) {
      return creditRiskActive.reason === 'over_limit'
        ? `Ce paiement pourrait dépasser ta marge disponible. On peut l’ajuster avant l’échéance.`
        : 'Après ce paiement, il resterait peu de marge sur ta carte. Garder un coussin te laisse plus de flexibilité.';
    }
    if (checkingFundsAlert || (!creditRiskActive && showInsufficientFundsWarning)) {
      const shortfall = checkingFundsAlert?.currentShortfall ?? nextPaymentShortfall;
      const noPayFragment =
        checkingFundsAlert && !checkingFundsAlert.paycheckArrivesBeforePayment ? " Paie après l'échéance." : '';
      return `Il te manque ${formatMoneyDetailed(shortfall)} pour ${nextPaymentDisplayName}.${noPayFragment}`.trim();
    }
    return '';
  })();

  const mockCreditNextPaymentDate = addDays(today, 3);
  const mockCreditPaycheckDate = addDays(today, 1);
  const mockCreditOverLimitBody =
    'Après ce paiement, environ 96 % de ta limite serait utilisée. Tu as plusieurs façons de garder de la marge.';
  const livePaycheckMeta = paycheckMetaFromTimeline(nextPaymentDate, resolvedPaycheckForTimeline, estimatedPayDate);
  const liveAlertTitle = creditRiskActive
    ? buildCreditLimitAlertTitle(nextPayment.name)
    : buildLowFundsAlertTitle(nextPayment.name);
  const liveAccountLabel = resolvedAccount
    ? insufficientFundsAlertPillLabel(resolvedAccount)
    : nextPaymentAccountName;

  const dashboardAlerts: DashboardAlertItem[] = [];
  if (showInsufficientFundsWarning && forecastShortfallMessage) {
    dashboardAlerts.push({
      id: 'live',
      color: creditRiskActive ? dashPalette.red : dashPalette.warning,
      bg: creditRiskActive ? 'rgba(255,85,85,0.08)' : 'rgba(230,160,0,0.08)',
      severity: creditRiskActive ? 'danger' : 'warning',
      title: liveAlertTitle,
      body: forecastShortfallMessage,
      date: formatShortDate(nextPaymentDate),
      accountName: liveAccountLabel,
      accountId: nextPayment.accountId,
      paymentName: nextPaymentDisplayName,
      paymentDateRaw: nextPaymentDate,
      paycheckDateRaw: estimatedPayDate,
      collapsedSummary: `${liveAlertTitle} · ${forecastShortfallMessage}`,
      ...livePaycheckMeta,
      stats: {
        currentBalance: resolvedAccount?.balance ?? 0,
        paymentAmount: nextPayment.amount,
        afterAmount: (resolvedAccount?.balance ?? 0) - nextPayment.amount,
        afterLabel: creditRiskActive ? 'Après paiement' : 'Manque',
        kind: creditRiskActive ? 'credit' : 'checking',
      },
    });
  }
  dashboardAlerts.push(
    {
      id: 'mock-credit',
      color: dashPalette.red,
      bg: 'rgba(255,85,85,0.08)',
      severity: 'danger',
      title: buildCreditLimitAlertTitle(MOCK_CREDIT_PAYMENT_NAME),
      body: mockCreditOverLimitBody,
      date: formatShortDate(mockCreditNextPaymentDate),
      accountName: MOCK_CREDIT_CARD_NAME,
      paymentName: MOCK_CREDIT_PAYMENT_NAME,
      paymentDateRaw: mockCreditNextPaymentDate,
      paycheckDateRaw: mockCreditPaycheckDate,
      collapsedSummary: `${buildCreditLimitAlertTitle(MOCK_CREDIT_PAYMENT_NAME)} · ${mockCreditOverLimitBody}`,
      paycheckBeforePayment: true,
      paycheckIsEstimated: true,
      stats: {
        currentBalance: MOCK_CREDIT_BALANCE_BEFORE,
        paymentAmount: MOCK_CREDIT_PAYMENT_AMOUNT,
        afterAmount: MOCK_CREDIT_BALANCE_BEFORE - MOCK_CREDIT_PAYMENT_AMOUNT,
        afterLabel: 'Après paiement',
        kind: 'credit',
      },
    },
  );

  dashboardAlerts.sort((a, b) => {
    const aTime = a.paymentDateRaw?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.paymentDateRaw?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const primaryInsightFromHub =
    alertCenterItems
      .filter((item) => item.id.startsWith('payment-'))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0] ?? null;
  const primaryInsight =
    primaryInsightFromHub ??
    (dashboardAlerts[0] ? dashboardAlertToCenterItem(dashboardAlerts[0]) : null);

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: dashPalette.bg }]}>
    <LinearGradient
      colors={isLight ? ['rgba(0,168,84,0.06)', 'transparent'] : ['rgba(0,230,100,0.055)', 'transparent']}
      style={dashStyles.ambientGlow}
      pointerEvents="none"
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    />
    <ScrollView
      ref={scrollRef}
      style={[styles.screen, { backgroundColor: dashPalette.bg }]}
      contentContainerStyle={[
        dashStyles.scrollContent,
        {
          paddingTop: insets.top + SCREEN_TOP_GUTTER,
          paddingBottom: insets.bottom + DASHBOARD_BOTTOM_PADDING,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.greetingBlock}>
        <View style={styles.headerRow}>
          <MotiView
            from={
              animateGreetingEntrance && !reduceMotion
                ? { opacity: 0, translateY: GREETING_ENTRANCE.translateY }
                : { opacity: 1, translateY: 0 }
            }
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: 'timing',
              duration: GREETING_ENTRANCE.durationMs,
              delay: GREETING_ENTRANCE.delayMs,
              easing: Easing.out(Easing.cubic),
            }}
            style={styles.greetingMotion}
          >
            <Text
              style={[styles.greeting, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {greetingLine()}, {displayName}
            </Text>
          </MotiView>
          <View style={styles.headerActions}>
            <AlertCenterButton
              unreadCount={alertCenterUnreadCount}
              onPress={() => router.push('/alert-center')}
            />
            <Pressable
              onPress={() => {
                tapHaptic();
                router.push('/settings');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les réglages"
              style={({ pressed }) => [
                styles.headerIconButton,
                { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
                pressed && styles.pressed,
              ]}
            >
              <AppIcon family="ionicons" name="settings-outline" size={21} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={dashStyles.sectionFirst}>
        <HomeAvailableNowHero
          checkingBalance={checkingBalance}
          checkingBalanceSeries={checkingBalanceSeries}
        />
      </View>

      {primaryInsight ? (
        <View style={dashStyles.sectionAfterHero}>
          <HomeInsightCardWithAI
            insight={primaryInsight}
            onPress={() => openAlertDetail(primaryInsight)}
          />
        </View>
      ) : null}

      <View style={dashStyles.sectionBlock}>
        <PaycheckAllocationWidget />
      </View>

      <View style={dashStyles.sectionBlock}>
        <HomePlansCarousel />
      </View>

    </ScrollView>
    </View>

    <ThemedConfirmModal
      visible={reminderConfirmVisible}
      title="Rappel activé"
      message="Le rappel est bien activé. Tu seras averti le jour de ta prochaine paie."
      confirmLabel="Compris"
      icon="notifications"
      onConfirm={() => void confirmPaycheckReminder()}
      onCancel={cancelPaycheckReminderConfirm}
    />

    <ThemedConfirmModal
      visible={payEntryPrompt !== null}
      title="Dépôt de paie"
      message={payEntryPrompt ? buildPaycheckEntryMessage(payEntryPrompt) : ''}
      confirmLabel="Entrer ma paie"
      cancelLabel="Plus tard"
      icon="wallet-outline"
      onConfirm={() => void openPayEntryFromPrompt()}
      onCancel={() => void dismissPayEntryPromptForToday()}
    />

    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: PAGE_PADDING_HORIZONTAL, gap: spacing.xl },
  block: { gap: spacing.md },
  budgetSummaryOpen: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.md,
  },
  /** Shadow + chrome only — no overflow hidden (clips iOS shadow). */
  forecastSurface: {
    borderRadius: 24,
    borderWidth: 0,
  },
  forecastClip: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  greetingBlock: {
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    minWidth: 0,
  },
  greetingMotion: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    ...PAGE_TITLE_STYLE,
    color: C.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  health: {
    ...jakartaBoldText,
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    color: 'rgba(245,245,245,0.84)',
  },
  healthWarning: { color: 'rgba(255,235,226,0.82)' },
  pressed: { opacity: 0.72 },
  // ── New multi-ring gauge card ────────────────────────────────────────────
  gaugeCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  gaugeCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  gaugeWarnIcon: {
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  gaugeWarnIconPlaceholder: {
    height: 22,
  },
  gaugeUsageLabel: {
    ...interNumericExtraBoldText,
    fontSize: 28,
    letterSpacing: -0.4,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  gaugeEyebrow: {
    ...jakartaBoldText,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  gaugeSpacer: {
    height: 14,
  },
  gaugeAmountLabel: {
    ...interNumericExtraBoldText,
    fontSize: 26,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  balanceCol: { flex: 1, minWidth: 0, justifyContent: 'flex-start' },
  eyebrow: {
    ...jakartaSemiboldText,
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: 'rgba(245,245,245,0.84)',
    lineHeight: typography.micro + 4,
  },
  balanceMint: {
    ...interNumericExtraBoldText,
    marginTop: 8,
    fontSize: 30,
    color: C.green,
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
  },
  metricUnit: {
    ...interNumericExtraBoldText,
    fontSize: typography.dashboardGreeting,
    color: 'rgba(245,245,245,0.84)',
  },
  balanceWhite: {
    ...interNumericExtraBoldText,
    marginTop: 8,
    fontSize: 30,
    color: C.text,
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
  },
  aiInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aiDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },
  forecastInline: {
    gap: 12,
    paddingTop: 4,
    paddingBottom: 2,
  },
  /** Eyebrow + compte : colonne pour éviter que la pill chevauche le titre. */
  timelineAlertHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    minWidth: 0,
  },
  timelineAlertEyebrow: {
    flex: 0,
    flexShrink: 1,
    width: '100%',
  },
  simPreviewTag: {
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  simPreviewTagText: {
    fontSize: typography.micro - 2,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  balanceInsightPagerWrap: {
    gap: spacing.md,
    overflow: 'visible',
    marginBottom: spacing.lg,
  },
  balanceInsightPagerViewport: {
    alignSelf: 'center',
    overflow: 'visible',
  },
  balanceInsightPagerPages: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 4,
    paddingBottom: 18,
  },
  balanceInsightPage: {
    flexGrow: 0,
  },
  pagerDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  pagerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  balancePagerHint: {
    textAlign: 'center',
    fontSize: typography.micro - 1,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  shortfallCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  shortfallMessageColumn: {
    flex: 1,
    minWidth: 0,
    gap: 7,
    alignItems: 'stretch',
    flexShrink: 1,
    paddingTop: 1,
  },
  alertAccountPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginBottom: 1,
  },
  alertAccountPillText: {
    fontSize: typography.meta,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  alertAccountPillInCardHeader: {
    alignSelf: 'flex-start',
    marginBottom: 0,
    maxWidth: '100%',
    flexShrink: 0,
  },
  paymentAlertAccountStrip: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  shortfallIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shortfallText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: typography.caption + 5,
  },
  inlineEyebrow: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: 'rgba(245,245,245,0.84)',
  },
  forecastAmount: {
    flexShrink: 1,
    maxWidth: '48%',
    textAlign: 'right',
    color: 'rgba(245,245,245,0.84)',
    fontSize: typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timelineDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  timelineDateText: {
    color: 'rgba(245,245,245,0.84)',
    fontSize: typography.micro,
    fontWeight: '600',
  },
  timeline: {
    position: 'relative',
    marginTop: 2,
    marginHorizontal: 2,
  },
  timelineCompact: {
    height: 34,
  },
  timelineExpanded: {
    height: 70,
  },
  timelineTrackLayerCompact: {
    height: 34,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineTrackLayer: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 34,
    justifyContent: 'center',
  },
  timelineTodayUtilLabel: {
    position: 'absolute',
    top: 2,
    fontSize: typography.meta,
    fontWeight: '800',
    lineHeight: typography.meta + 4,
    fontVariant: ['tabular-nums'],
    transform: [{ translateX: '-50%' }],
    maxWidth: 72,
    textAlign: 'center',
  },
  timelineAfterPayUtilLabel: {
    position: 'absolute',
    top: 52,
    fontSize: typography.meta,
    fontWeight: '800',
    lineHeight: typography.meta + 4,
    fontVariant: ['tabular-nums'],
    transform: [{ translateX: '-50%' }],
    maxWidth: 72,
    textAlign: 'center',
  },
  timelineRail: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 10, 10, 0.08)',
  },
  timelineFill: {
    height: 8,
    borderRadius: radius.pill,
    position: 'absolute',
    left: 0,
    top: 13,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  timelineFillBand: {
    flex: 1,
    height: '100%',
  },
  todayMarker: {
    position: 'absolute',
    top: -2,
    width: 0,
    height: 0,
    marginLeft: -5,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.subtext,
    zIndex: 4,
  },
  iconMarker: {
    position: 'absolute',
    top: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.card,
    zIndex: 2,
  },
  paymentMarker: {
    backgroundColor: 'rgba(255,121,85,0.72)',
  },
  payMarker: {
    backgroundColor: 'rgba(0,168,84,0.9)',
  },
  timelineLegend: {
    gap: 8,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(0,168,84,0.62)',
  },
  legendLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 7,
  },
  legendPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendTodayMarker: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.subtext,
  },
  legendIconMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendPayMarker: {
    backgroundColor: 'rgba(0,168,84,0.9)',
  },
  legendLabel: {
    color: 'rgba(245,245,245,0.84)',
    fontSize: typography.micro,
    fontWeight: '700',
  },
  legendLabelRisk: { color: 'rgba(255,214,198,0.82)' },
  legendDotToday: { backgroundColor: C.subtext },
  legendDotPayment: { backgroundColor: 'rgba(255,196,160,0.85)' },
  legendDotPay: { backgroundColor: 'rgba(0,168,84,0.72)' },
  openSection: {
    gap: spacing.lg,
  },
  sectionEyebrow: {
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    color: 'rgba(245,245,245,0.84)',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 5,
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: radius.pill },
  alertText: { fontSize: typography.caption, fontWeight: '600', color: C.subtext, marginTop: 4 },
  captionMuted: { flex: 1, fontSize: typography.meta, fontWeight: '700', color: C.subtext, lineHeight: typography.meta + 4 },
  paymentPreview: {
    gap: 9,
  },
  paymentPreviewInner: {
    gap: 9,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minWidth: 0,
  },
  paymentIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paymentCopy: { flex: 1, minWidth: 0, gap: 3 },
  paymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  rowTitle: {
    ...rowLabel,
    fontWeight: '800',
    color: C.text,
  },
  paymentDateLine: { fontSize: typography.meta, fontWeight: '700', lineHeight: typography.meta + 4, flexShrink: 1 },
  rowSub: { fontSize: typography.meta, fontWeight: '700', color: C.subtext, marginTop: 2 },
  rowAmountStrong: {
    ...rowValue,
    flexShrink: 0,
    maxWidth: '40%',
    textAlign: 'right',
    color: C.text,
  },
  paymentWarningCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentWarningText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: typography.caption + 5,
  },
  paymentReadyCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentReadyText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: typography.caption + 5,
  },
  paymentMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  paymentMetaText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: typography.micro,
    fontWeight: '800',
    lineHeight: typography.micro + 4,
  },
  paymentAlertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    minWidth: 0,
  },
  paymentAlertText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    fontWeight: '700',
    lineHeight: typography.meta + 4,
  },
});

const dashStyles = StyleSheet.create({
  skeletonScreen: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: spacing.lg,
  },
  skeletonGreeting: {
    height: 38,
    width: '62%',
    borderRadius: 10,
    backgroundColor: C.border,
    opacity: 0.55,
    marginTop: spacing.xxl + spacing.lg,
  },
  skeletonCard: {
    height: 120,
    borderRadius: 16,
    backgroundColor: C.card,
    opacity: 0.45,
  },
  skeletonHint: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    color: 'rgba(245,245,245,0.84)',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  ambientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 420,
    height: 260,
    zIndex: 0,
  },
  scrollContent: Platform.select({
    web: {},
    default: { paddingHorizontal: PAGE_PADDING_HORIZONTAL },
  }),
  sectionFirst: {
    paddingTop: PAGE_TITLE_CONTENT_GAP,
    paddingBottom: 0,
  },
  sectionAfterHero: {
    paddingTop: spacing.md,
  },
  sectionBlock: {
    paddingTop: spacing.lg,
  },
  alertStack: {
    gap: spacing.sm,
  },
  alertNotificationDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  alertDots: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: C.border,
  },
  alertDotActive: {
    width: 18,
    backgroundColor: C.green,
  },
  alertDate: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    color: 'rgba(245,245,245,0.84)',
    marginTop: spacing.xs,
  },
  paymentSectionLabel: {
    marginBottom: spacing.lg,
  },
  paymentCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  paymentTitle: {
    ...jakartaBoldText,
    fontSize: typography.meta,
    color: C.text,
    letterSpacing: -0.1,
  },
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  paymentMeta: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    flex: 1,
    minWidth: 0,
    color: 'rgba(245,245,245,0.84)',
  },
  paymentAmountBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  paymentAmount: {
    ...rowValue,
    textAlign: 'right',
  },
  paymentAmountExpense: {
    color: C.red,
  },
  paymentAmountIncome: {
    color: C.green,
  },
  paymentBadge: {
    marginBottom: spacing.xs,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paymentBadgeExpense: {
    backgroundColor: 'rgba(230,160,0,0.14)',
  },
  paymentBadgeIncome: {
    backgroundColor: 'rgba(0,230,100,0.1)',
  },
  paymentBadgeText: {
    ...jakartaMediumText,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  paymentBadgeTextExpense: {
    color: C.warning,
  },
  paymentBadgeTextIncome: {
    color: C.green,
  },
});
