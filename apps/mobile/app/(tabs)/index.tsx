import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  SECTION_TITLE_STYLE,
  interBoldText,
  interMediumText,
  interSemiboldText,
  radius,
  spacing,
  typography,
  type AppColors,
} from '@/constants/theme';
import { DashboardCard } from '@/components/DashboardCard';
import {
  MinimizedAlertCard,
  type DashboardAlertSeverity,
} from '@/components/MinimizedAlertCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { DashboardAccountBalanceCard } from '@/components/DashboardAccountBalanceCard';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { PaymentListRow } from '@/components/PaymentListRow';
import { TransactionAmountLabel, recurringPaymentAmountDirection } from '@/components/TransactionAmountLabel';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import {
  getDashboard,
  getLoans,
  getMerchantOverrides,
  getRecentIncomeTransactions,
  getRecurringPayments,
  getSetting,
  getSimulatedAccounts,
  setSetting,
} from '@/lib/db';
import { PAYCHECK_TRANSACTION_LOOKBACK_LIMIT, resolveNextPaycheckForAccount, resolvePaycheckForPaymentAlert } from '@/lib/estimatedPaycheck';
import {
  evaluateCheckingInsufficientFunds,
  type InsufficientFundsCheckingAlert,
} from '@/lib/insufficientFundsAlert';
import { dataEvents } from '@/lib/events';
import { getUserDisplayName } from '@/lib/userDisplay';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  creditLimitUtilizationBarColor,
  creditUsedFromBalance,
} from '@/lib/creditLimitUtilization';
import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { formatUpcomingStatusBadge } from '@/lib/paymentStatusBadge';
import {
  buildLoanByRecurringPaymentId,
  resolveRecurringPaymentDisplayIconById,
} from '@/lib/recurringPaymentPresentation';
import {
  heroStatAmount,
  percentStat,
  rowLabel,
  rowTitleTextProps,
  rowValue,
  singleLineAmountProps,
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
import {
  logoIconWellStyle,
  userPickedIconLogoSize,
} from '@/lib/userPickedIcon';
import { PageTransition } from '@/components/PageTransition';
import type {
  DashboardSummary,
  Loan,
  MerchantOverride,
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

const BALANCE_COMPARE_SETTING_KEY = 'dashboard_balance_compare_account_ids';

const C = dashboardPalette;

const DASHBOARD_BOTTOM_PADDING = 110;

const PAYMENT_WARNING_TITLE_CHECKING = 'Fonds insuffisants';
const PAYMENT_SUCCESS_TITLE_CHECKING = 'Fonds disponibles';
const PAYMENT_WARNING_TITLE_CREDIT_LIMIT = 'Limite de crédit';

type BalanceCompareAccount = Pick<
  SimulatedAccount,
  'id' | 'name' | 'balance' | 'institution' | 'last4' | 'kind' | 'creditLimit' | 'logoUrl'
>;

function getBalanceCompareAccountLogoUrl(account: BalanceCompareAccount): string | null {
  return (
    account.logoUrl ??
    getAccountLogoUrl(account.institution?.trim() || account.name) ??
    getAccountLogoUrl(account.name)
  );
}

function balanceCompareAccountInitial(account: BalanceCompareAccount) {
  const source = account.institution?.trim() || account.name.trim();
  const letter = source.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').charAt(0);
  return (letter || '?').toUpperCase();
}

/** Barre de comparaison : crédit = seuils Portefeuille ; sinon ≤0 danger, sinon primary. */
function balanceCompareProgressBarColor(
  account: BalanceCompareAccount,
  creditUtilPct: number | undefined,
  colors: AppColors,
  isLight: boolean,
): string {
  if (typeof creditUtilPct === 'number') {
    return creditLimitUtilizationBarColor(creditUtilPct, colors, isLight);
  }
  if (account.balance <= 0) return colors.danger;
  return colors.primary;
}

function greetingLine() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonsoir';
  if (h < 12) return 'Bon matin';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

function formatMoneyDetailed(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function toBalanceCompareAccounts(accounts: SimulatedAccount[]): BalanceCompareAccount[] {
  if (accounts.length) {
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      balance: account.balance,
      institution: account.institution,
      last4: account.last4,
      kind: account.kind,
      creditLimit: account.creditLimit,
      logoUrl: account.logoUrl,
    }));
  }

  return DASHBOARD_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    balance: account.balance,
    institution: account.domain,
    last4: account.number.replace(/\D/g, '').slice(-4),
    kind: account.kind,
    creditLimit: account.creditLimit,
    logoUrl: getAccountLogoUrl(account.domain) ?? getAccountLogoUrl(account.name) ?? undefined,
  }));
}

function parseBalanceCompareIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, 2);
  } catch {
    return [];
  }
}

function resolveBalanceCompareSelection(
  accounts: BalanceCompareAccount[],
  selectedIds: string[],
) {
  const picked = selectedIds
    .map((id) => accounts.find((account) => account.id === id))
    .filter((account): account is BalanceCompareAccount => Boolean(account));
  const fillers = accounts.filter((account) => !picked.some((pickedAccount) => pickedAccount.id === account.id));
  return [...picked, ...fillers].slice(0, 2);
}

function formatAccountMeta(account: BalanceCompareAccount) {
  if (account.institution && account.last4) return `${account.institution} · ${account.last4}`;
  if (account.last4) return `****${account.last4}`;
  return account.institution ?? 'Compte disponible';
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

function AlertCard({
  alert,
  today,
  collapsed,
  reminderEnabled,
  onToggleReminder,
  onExpand,
  onCollapse,
}: {
  alert: DashboardAlertItem;
  today: Date;
  collapsed: boolean;
  reminderEnabled: boolean;
  onToggleReminder: () => void;
  onExpand: () => void;
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
        onPress={() => {
          tapHaptic();
          onExpand();
        }}
        onToggleReminder={() => {
          tapHaptic();
          onToggleReminder();
        }}
      />
    );
  }

  return (
    <DashboardCard style={aStyles.card}>
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
              <Ionicons
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
            <Ionicons name="chevron-up" size={18} color={palette.subtext} />
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
                <Ionicons name="caret-down" size={12} color={palette.subtext} />
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
                  <Ionicons name="wallet" size={14} color="#000" />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Legend */}
        <View style={aStyles.legend}>
          <View style={aStyles.legendRow}>
            <Ionicons name="caret-down" size={12} color={palette.subtext} style={aStyles.legendIcon} />
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
            <Ionicons name="wallet" size={12} color={palette.green} style={aStyles.legendIcon} />
            <Text style={[aStyles.legendText, { color: palette.green }]}>Dépôt de paie estimé · {paycheckLabel}</Text>
          </View>
        </View>
      </View>
    </DashboardCard>
  );
}

const aStyles = StyleSheet.create({
  bellButton: {
    padding: 4,
    flexShrink: 0,
  },
  card: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
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
    ...interMediumText,
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
    ...interMediumText,
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
    ...interBoldText,
    fontSize: 10,
    color: 'rgba(245,245,245,0.84)',
    lineHeight: 12,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ALERT_BAR_H,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 99,
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
    ...interMediumText,
    fontSize: typography.micro,
    color: 'rgba(245,245,245,0.84)',
  },
});

function BalanceCompareAccountAvatar({
  account,
  size = 32,
  colors,
}: {
  account: BalanceCompareAccount;
  size?: number;
  colors: AppColors;
}) {
  const { isLight } = useAppTheme();
  const logoUrl = useMemo(() => getBalanceCompareAccountLogoUrl(account), [account]);
  const urls = useMemo(() => (logoUrl ? [logoUrl] : []), [logoUrl]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [giveUp, setGiveUp] = useState(false);
  const uri = urls[sourceIndex];
  const showLogo = Boolean(uri) && !giveUp;
  const initial = balanceCompareAccountInitial(account);
  const logoSize = userPickedIconLogoSize(size);
  const fallbackTint =
    account.kind === 'credit'
      ? colors.warning
      : account.kind === 'savings'
        ? colors.primaryAlt
        : colors.primary;

  useEffect(() => {
    setSourceIndex(0);
    setGiveUp(false);
  }, [urls]);

  return (
    <View style={[styles.balanceCompareIcon, logoIconWellStyle(size, isLight)]}>
      {showLogo && uri ? (
        <Image
          source={{ uri }}
          style={{ width: logoSize, height: logoSize }}
          contentFit="contain"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => {
            if (sourceIndex < urls.length - 1) {
              setSourceIndex((i) => i + 1);
            } else {
              setGiveUp(true);
            }
          }}
        />
      ) : (
        <Text style={[styles.balanceCompareIconInitial, { color: fallbackTint, fontSize: size * 0.38 }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const balanceSelectorMaxHeight = Math.min(windowHeight * 0.82, windowHeight - insets.top - 24);
  const { colors, isLight } = useAppTheme();
  const dashPalette = useMemo(() => dashboardPaletteForTheme(isLight), [isLight]);
  const dashMuted = isLight ? dashPalette.subtext : 'rgba(245,245,245,0.84)';
  const scrollRef = useRef<ScrollView>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
  const [displayName, setDisplayName] = useState('Jérémie');
  const [refreshing, setRefreshing] = useState(false);
  const [balanceAccountOptions, setBalanceAccountOptions] = useState<BalanceCompareAccount[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [selectedBalanceAccountIds, setSelectedBalanceAccountIds] = useState<string[]>([]);
  const [draftBalanceAccountIds, setDraftBalanceAccountIds] = useState<string[]>([]);
  const [balanceSelectorVisible, setBalanceSelectorVisible] = useState(false);
  const [alertReminders, setAlertReminders] = useState<Record<string, boolean>>({});
  const [alertCollapsed, setAlertCollapsed] = useState<Record<string, boolean>>({});
  const [reminderConfirmVisible, setReminderConfirmVisible] = useState(false);
  const [pendingReminderAlert, setPendingReminderAlert] = useState<Pick<
    DashboardAlertItem,
    'id' | 'paycheckDateRaw' | 'paymentName' | 'accountName' | 'accountId' | 'paycheckIsEstimated'
  > | null>(null);
  const [payEntryPrompt, setPayEntryPrompt] = useState<PaycheckEntryPrompt | null>(null);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

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

  const load = useCallback(async () => {
    const [dash, name, recurring, overrides, loadedSimulatedAccounts, storedBalanceIds, incomeTx, loadedLoans] =
      await Promise.all([
        getDashboard(),
        getUserDisplayName(),
        getRecurringPayments(),
        getMerchantOverrides(),
        getSimulatedAccounts(),
        getSetting(BALANCE_COMPARE_SETTING_KEY, ''),
        getRecentIncomeTransactions(PAYCHECK_TRANSACTION_LOOKBACK_LIMIT),
        getLoans(),
      ]);
    const compareAccounts = toBalanceCompareAccounts(loadedSimulatedAccounts);
    const storedIds = parseBalanceCompareIds(storedBalanceIds);

    setData(dash);
    setDisplayName(name);
    setRecurringPayments(recurring);
    setLoans(loadedLoans);
    setIncomeTransactions(incomeTx);
    setMerchantOverrides(overrides);
    setSimulatedAccounts(loadedSimulatedAccounts);
    setBalanceAccountOptions(compareAccounts);
    setSelectedBalanceAccountIds(resolveBalanceCompareSelection(compareAccounts, storedIds).map((account) => account.id));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data !== null) {
      setLoadTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn('[Boot] dashboard data still null after 2s — showing skeleton');
      setLoadTimedOut(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useEffect(() => {
    void loadAlertUiState(['live', 'mock-credit']).then(({ reminders, collapsed }) => {
      setAlertReminders(reminders);
      setAlertCollapsed((prev) => ({ ...collapsed, ...prev }));
    });
  }, []);

  useEffect(() => {
    if (!data) return;
    void checkPaycheckEntryPrompt();
  }, [data, alertReminders, checkPaycheckEntryPrompt]);

  useRefreshOnFocus(load);
  useRefreshOnFocus(checkPaycheckEntryPrompt);
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncWithServer();
    await load();
    setRefreshing(false);
  };

  const balanceCompareAccounts = useMemo(
    () => resolveBalanceCompareSelection(balanceAccountOptions, selectedBalanceAccountIds),
    [balanceAccountOptions, selectedBalanceAccountIds],
  );

  const openBalanceSelector = useCallback(() => {
    tapHaptic();
    setDraftBalanceAccountIds(balanceCompareAccounts.map((account) => account.id));
    setBalanceSelectorVisible(true);
  }, [balanceCompareAccounts]);

  const toggleDraftBalanceAccount = useCallback((accountId: string) => {
    setDraftBalanceAccountIds((current) => {
      if (current.includes(accountId)) {
        return current.filter((id) => id !== accountId);
      }
      if (current.length >= 2) {
        return [current[1], accountId];
      }
      return [...current, accountId];
    });
  }, []);

  const saveBalanceSelection = useCallback(async () => {
    if (draftBalanceAccountIds.length !== 2) return;

    tapHaptic();
    setSelectedBalanceAccountIds(draftBalanceAccountIds);
    setBalanceSelectorVisible(false);
    await setSetting(BALANCE_COMPARE_SETTING_KEY, JSON.stringify(draftBalanceAccountIds));
  }, [draftBalanceAccountIds]);

  const paymentResolutionPool = useMemo(
    () => toPaymentResolutionAccounts(simulatedAccounts),
    [simulatedAccounts],
  );

  const loanByRecurringPaymentId = useMemo(
    () => buildLoanByRecurringPaymentId(loans),
    [loans],
  );

  const upcomingPayments = useMemo(
    () => getUpcomingPayments(recurringPayments, paymentResolutionPool),
    [recurringPayments, paymentResolutionPool],
  );

  if (!data) {
    if (!loadTimedOut) {
      return <View style={[styles.screen, { backgroundColor: dashPalette.bg }]} />;
    }
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
  const daysToNextPayment = daysUntil(nextPayment.date);
  const nextPaymentStatusBadge = formatUpcomingStatusBadge(daysToNextPayment);
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
  const linkedNextPayment = nextPayment.id
    ? recurringPayments.find((payment) => payment.id === nextPayment.id)
    : undefined;
  const nextPaymentIcon = linkedNextPayment
    ? resolveRecurringPaymentDisplayIconById(linkedNextPayment, loanByRecurringPaymentId)
    : nextPayment.icon && nextPayment.icon !== 'repeat-outline'
      ? nextPayment.icon
      : isIncomeRecurring
        ? 'cash-outline'
        : 'card-outline';
  const nextPaymentTint = nextPayment.color ?? (isIncomeRecurring ? colors.success : colors.warning);

  const forecastShortfallMessage = (() => {
    if (creditRiskActive) {
      return creditRiskActive.reason === 'over_limit'
        ? 'Ce paiement dépasse ta limite.'
        : 'Moins de 10 % de marge après ce paiement.';
    }
    if (checkingFundsAlert || (!creditRiskActive && showInsufficientFundsWarning)) {
      const shortfall = checkingFundsAlert?.currentShortfall ?? nextPaymentShortfall;
      const noPayFragment =
        checkingFundsAlert && !checkingFundsAlert.paycheckArrivesBeforePayment ? " Paie après l'échéance." : '';
      return `Il manque ${formatMoneyDetailed(shortfall)} pour le paiement de ${nextPaymentDisplayName}.${noPayFragment}`.trim();
    }
    return '';
  })();

  const mockCreditNextPaymentDate = addDays(today, 3);
  const mockCreditPaycheckDate = addDays(today, 1);
  const mockCreditOverLimitBody = `96 % de ta limite atteinte après ce paiement.`;
  const livePaycheckMeta = paycheckMetaFromTimeline(nextPaymentDate, resolvedPaycheckForTimeline, estimatedPayDate);
  const liveAlertTitle = creditRiskActive ? PAYMENT_WARNING_TITLE_CREDIT_LIMIT : PAYMENT_WARNING_TITLE_CHECKING;
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
      title: PAYMENT_WARNING_TITLE_CREDIT_LIMIT,
      body: mockCreditOverLimitBody,
      date: formatShortDate(mockCreditNextPaymentDate),
      accountName: MOCK_CREDIT_CARD_NAME,
      paymentName: MOCK_CREDIT_PAYMENT_NAME,
      paymentDateRaw: mockCreditNextPaymentDate,
      paycheckDateRaw: mockCreditPaycheckDate,
      collapsedSummary: `${PAYMENT_WARNING_TITLE_CREDIT_LIMIT} · ${mockCreditOverLimitBody}`,
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
      style={styles.screen}
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
          <Text
            style={[styles.greeting, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {greetingLine()}, {displayName}
        </Text>
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
            <Ionicons name="settings-outline" size={21} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={dashStyles.sectionFirst}>
        <View style={dashStyles.sectionHeaderRow}>
          <DashboardSectionLabel>Alertes</DashboardSectionLabel>
          {dashboardAlerts.length > 0 ? (
            <View style={[dashStyles.alertNotificationDot, { backgroundColor: colors.danger }]} />
          ) : null}
        </View>

        <View style={dashStyles.alertStack}>
          {dashboardAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              today={today}
              collapsed={alertCollapsed[alert.id] ?? false}
              reminderEnabled={alertReminders[alert.id] ?? false}
              onToggleReminder={() => void handleTogglePaycheckReminder(alert)}
              onExpand={() => void handleExpandAlert(alert.id)}
              onCollapse={() => void handleCollapseAlert(alert.id)}
            />
          ))}
        </View>
      </View>

      <View style={[dashStyles.section, { borderTopColor: dashPalette.border }]}>
        <View style={dashStyles.sectionHeaderRow}>
          <View>
            <DashboardSectionLabel>2 comptes favoris</DashboardSectionLabel>
            <Text style={[dashStyles.sectionTitle, { color: dashPalette.text }]}>Mes soldes</Text>
          </View>
          <Pressable
            onPress={openBalanceSelector}
            accessibilityRole="button"
            accessibilityLabel="Choisir les comptes à comparer"
            style={dashStyles.chooseButton}
          >
            <Text style={[dashStyles.chooseButtonText, { color: dashMuted }]}>⇄ Choisir</Text>
          </Pressable>
        </View>

        <View style={dashStyles.accountsList}>
          {balanceCompareAccounts.map((account) => (
            <DashboardAccountBalanceCard
              key={account.id}
              account={account}
              logoUrl={getBalanceCompareAccountLogoUrl(account)}
              onPress={
                simulatedAccounts.length
                  ? () => {
                      tapHaptic();
                      router.push({ pathname: '/account-detail', params: { accountId: account.id } });
                    }
                  : undefined
              }
            />
          ))}
        </View>
      </View>

      <View style={[dashStyles.section, { borderTopColor: dashPalette.border }]}>
        <DashboardSectionLabel style={dashStyles.paymentSectionLabel}>Prochain paiement</DashboardSectionLabel>
        <PaymentListRow
          avatar={
            <UserPickedIconWell
              icon={nextPaymentIcon}
              color={nextPaymentTint}
              size={48}
              logoUrl={nextPayment.logoUrl}
              wellGlyphWhite={nextPayment.recurring}
            />
          }
          title={nextPaymentDisplayName}
          meta={nextPaymentAccountName}
          statusBadge={{
            label: nextPaymentStatusBadge,
            variant: isIncomeRecurring ? 'upcomingIncome' : 'upcoming',
          }}
          amount={
            <TransactionAmountLabel
              amount={formatRecurringPaymentAmount(nextPayment.amount, nextPayment.kind ?? 'payment')}
              direction={recurringPaymentAmountDirection(nextPayment.kind ?? 'payment')}
              color={isIncomeRecurring ? colors.success : colors.text}
            />
          }
        />
      </View>

      <Modal
        visible={balanceSelectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBalanceSelectorVisible(false)}
      >
        <Pressable
          style={[styles.selectorOverlay, { paddingBottom: Math.max(18, insets.bottom + 10) }]}
          onPress={() => setBalanceSelectorVisible(false)}
        >
          <Pressable
            style={[
              styles.selectorSheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                maxHeight: balanceSelectorMaxHeight,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.selectorHeader}>
              <View style={styles.selectorTitleBlock}>
                <Text style={[styles.selectorEyebrow, { color: colors.textMuted }]} {...rowTitleTextProps}>
                  Comparaison des soldes
                </Text>
                <Text style={[styles.selectorTitle, { color: colors.text }]} {...rowTitleTextProps}>
                  Choisir 2 comptes
                </Text>
              </View>
              <Pressable
                onPress={() => setBalanceSelectorVisible(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Fermer la sélection"
                style={({ pressed }) => [
                  styles.selectorClose,
                  { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.selectorListScroll}
              contentContainerStyle={styles.selectorListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {balanceAccountOptions.map((account) => {
                const selectedIndex = draftBalanceAccountIds.indexOf(account.id);
                const isSelected = selectedIndex >= 0;

                return (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      tapHaptic();
                      toggleDraftBalanceAccount(account.id);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [
                      styles.selectorAccountRow,
                      {
                        backgroundColor: isSelected ? colors.surface : 'transparent',
                        borderColor: isSelected ? colors.borderStrong : colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <BalanceCompareAccountAvatar account={account} colors={colors} size={32} />
                    <View style={styles.selectorAccountCopy}>
                      <Text
                        style={[styles.selectorAccountName, { color: colors.text }]}
                        {...rowTitleTextProps}
                      >
                        {account.name}
                      </Text>
                      <Text style={[styles.selectorAccountMeta, { color: colors.textMuted }]} {...rowTitleTextProps}>
                        {formatAccountMeta(account)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.selectorAccountAmount,
                        {
                          color:
                            account.balance < 0 && account.kind !== 'credit'
                              ? colors.danger
                              : colors.textSecondary,
                        },
                      ]}
                      {...singleLineAmountProps}
                    >
                      {account.balance < 0 ? '−' : ''}
                      {formatMoneyDetailed(Math.abs(account.balance))}
                    </Text>
                    <View
                      style={[
                        styles.selectorCheck,
                        {
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                          borderColor: isSelected ? colors.primary : colors.borderStrong,
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Text style={[styles.selectorCheckText, { color: colors.background }]}>{selectedIndex + 1}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={saveBalanceSelection}
              disabled={draftBalanceAccountIds.length !== 2}
              accessibilityRole="button"
              accessibilityState={{ disabled: draftBalanceAccountIds.length !== 2 }}
              style={({ pressed }) => [
                styles.selectorDone,
                {
                  backgroundColor: draftBalanceAccountIds.length === 2 ? colors.primary : colors.surface,
                  opacity: draftBalanceAccountIds.length === 2 ? 1 : 0.58,
                },
                pressed && draftBalanceAccountIds.length === 2 && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.selectorDoneText,
                  { color: draftBalanceAccountIds.length === 2 ? colors.background : colors.textMuted },
                ]}
              >
                Afficher ces soldes
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  balanceCompareOuter: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  balanceCompareInner: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 18,
  },
  balanceCompareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  balanceCompareTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  balanceCompareTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  balanceCompareAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  balanceCompareActionText: {
    fontSize: typography.micro,
    fontWeight: '800',
  },
  balanceCompareChart: {
    gap: 17,
  },
  balanceInsightPagerCard: {
    width: '100%',
  },
  balanceCompareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  balanceCompareRowBody: {
    flex: 1,
    minWidth: 0,
    gap: 9,
  },
  balanceCompareIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  balanceCompareIconInitial: {
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  balanceCompareRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  balanceCompareAccountCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  balanceCompareAccountName: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: typography.caption + 5,
  },
  balanceCompareAccountMeta: {
    fontSize: typography.micro,
    fontWeight: '700',
    lineHeight: typography.micro + 4,
  },
  balanceCompareAmountBlock: {
    flexShrink: 0,
    maxWidth: '40%',
    alignItems: 'flex-end',
    gap: 4,
  },
  balanceCompareAmount: {
    textAlign: 'right',
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: -0.25,
    fontVariant: ['tabular-nums'],
  },
  balanceCompareCreditUtil: {
    fontSize: typography.micro,
    fontWeight: '800',
    lineHeight: typography.micro + 3,
    fontVariant: ['tabular-nums'],
  },
  balanceCompareTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  balanceCompareFill: {
    height: '100%',
    borderRadius: 999,
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
  greeting: {
    flex: 1,
    minWidth: 0,
    ...PAGE_TITLE_STYLE,
    color: C.text,
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
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    fontWeight: '700',
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
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  gaugeEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  gaugeSpacer: {
    height: 14,
  },
  gaugeAmountLabel: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  balanceCol: { flex: 1, minWidth: 0, justifyContent: 'flex-start' },
  eyebrow: {
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: 'rgba(245,245,245,0.84)',
    lineHeight: typography.micro + 4,
  },
  balanceMint: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '900',
    color: C.green,
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
  },
  metricUnit: {
    fontSize: typography.dashboardGreeting,
    fontWeight: '800',
    color: 'rgba(245,245,245,0.84)',
  },
  balanceWhite: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '800',
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
    borderRadius: 999,
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
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: 'rgba(10, 10, 10, 0.08)',
  },
  timelineFill: {
    height: 8,
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: 999 },
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
    borderRadius: 999,
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
  selectorOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
  },
  selectorSheet: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    flexShrink: 0,
    paddingBottom: 12,
  },
  selectorTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 5,
    flexShrink: 1,
  },
  selectorEyebrow: {
    flexGrow: 0,
    flexShrink: 0,
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  selectorTitle: {
    fontSize: typography.dashboardGreeting,
    fontWeight: '900',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  selectorClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorListScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  selectorListContent: {
    gap: 9,
    paddingTop: 2,
    paddingBottom: 4,
  },
  selectorAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectorAccountCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    flexShrink: 1,
  },
  selectorAccountName: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: typography.caption + 5,
    flexShrink: 1,
  },
  selectorAccountMeta: {
    fontSize: typography.micro,
    fontWeight: '700',
    lineHeight: typography.micro + 4,
  },
  selectorAccountAmount: {
    flexShrink: 0,
    maxWidth: '40%',
    fontSize: typography.caption,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  selectorCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorCheckText: {
    fontSize: typography.micro,
    fontWeight: '900',
  },
  selectorDone: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 12,
    flexShrink: 0,
  },
  selectorDoneText: {
    fontSize: typography.caption,
    fontWeight: '900',
  },
});

const DASH_SECTION_BREAK = spacing.xxl + spacing.lg;

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
    ...interMediumText,
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
  scrollContent: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  sectionFirst: {
    paddingTop: PAGE_TITLE_CONTENT_GAP,
    paddingBottom: spacing.sm,
  },
  section: {
    paddingTop: DASH_SECTION_BREAK,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...SECTION_TITLE_STYLE,
    color: C.text,
    marginTop: spacing.xs,
  },
  chooseButton: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chooseButtonText: {
    ...interSemiboldText,
    fontSize: typography.micro,
    color: 'rgba(245,245,245,0.84)',
  },
  accountsList: {
    gap: spacing.md,
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
    borderRadius: 99,
    backgroundColor: C.border,
  },
  alertDotActive: {
    width: 18,
    backgroundColor: C.green,
  },
  alertDate: {
    ...interMediumText,
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
    ...interBoldText,
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
    ...interMediumText,
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
    ...interMediumText,
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
