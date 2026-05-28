import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import { SCREEN_TOP_GUTTER, ghost } from '@/constants/ghostUi';
import { FLOATING_NAV_CONTENT_PADDING, spacing, typography, type AppColors } from '@/constants/theme';
import { getDashboard, getMerchantOverrides, getRecurringPayments, getSetting, getSimulatedAccounts, setSetting } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { getUserDisplayName } from '@/lib/userDisplay';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  creditLimitUtilizationBarColor,
  creditLimitUtilizationPercent,
  creditUsedFromBalance,
  formatCreditUtilTimelineLabel,
} from '@/lib/creditLimitUtilization';
import { getAccountLogoUrl, getMerchantLogoUrls } from '@/lib/merchantLogo';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { tapHaptic } from '@/lib/haptics';
import { syncWithServer } from '@/lib/sync';
import { useAppTheme } from '@/lib/themeContext';
import {
  logoIconWellStyle,
  userPickedIconLogoSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';
import { GlassContainer } from '@/components/GlassContainer';
import type {
  DashboardSummary,
  MerchantOverride,
  RecurringPayment,
  RecurringPaymentKind,
  SimulatedAccount,
} from '@/types';

type UpcomingPayment = {
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

/** Matches `styles.content` horizontal padding — used until `onLayout` provides the real strip width. */
const DASHBOARD_CONTENT_HORIZONTAL_PADDING = 24;

const PAYMENT_WARNING_TITLE_CHECKING = 'Fonds insuffisants';
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
  return `${value.toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
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

type BudgetInsightTone = 'safe' | 'warning' | 'danger';

function getDashboardBudgetInsight(
  summary: DashboardSummary,
  projectedExpenses: number,
): { message: string; tone: BudgetInsightTone } {
  const limit = summary.monthlyBudgetLimit;
  const spent = summary.monthlyExpenses;
  /** Dépassement réel ce mois : dépenses > limite (> 100 % utilisé si limite définie). */
  const isOverBudget = limit > 0 && spent > limit;

  if (limit <= 0) {
    return { message: 'Définis une limite budgétaire.', tone: 'warning' };
  }

  if (isOverBudget) {
    return {
      message: 'Compense le mois prochain en réduisant un peu tes dépenses.',
      tone: 'danger',
    };
  }

  const progress = spent / limit;

  if (projectedExpenses > limit) {
    return {
      message: 'À ce rythme, risque de dépassement — ralentis les achats.',
      tone: 'warning',
    };
  }

  if (progress >= 0.82) {
    return {
      message: 'Peu de marge avant la limite — sois vigilant.',
      tone: 'warning',
    };
  }

  return {
    message: 'Bon rythme, tu respectes bien ton budget.',
    tone: 'safe',
  };
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

function formatDaysUntilLabel(days: number) {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
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
  if (kind === 'savings') return 1;
  if (kind === 'credit') return 2;
  return 3;
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

function clampPercent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

/**
 * Barre d’utilisation — mocks tableau de bord uniquement (pas l’onglet Portefeuille).
 * Seuils en part de 100 :
 * - &lt; 80 % → couleur primaire (marge confortable)
 * - 80 % à &lt; 95 % → orange (zone d’avertissement)
 * - ≥ 95 % → rouge (critique / proche ou au-delà du plafond)
 */
function mockCreditUtilizationBarColor(utilizationPercent: number, theme: AppColors, isLight: boolean): string {
  if (utilizationPercent >= 95) return isLight ? '#dc2626' : '#ff3131';
  if (utilizationPercent >= 80) return isLight ? '#f97316' : '#ff8a00';
  return theme.primary;
}

function clampMarkerPercent(value: number) {
  return `${Math.max(7, Math.min(93, value))}%`;
}

const BUDGET_RING_SEGMENT_COUNT = 144;
const BUDGET_RING_SEGMENTS = Array.from({ length: BUDGET_RING_SEGMENT_COUNT }, (_, index) => index);
const TIMELINE_INTENSITY_BANDS = Array.from({ length: 80 }, (_, index) => 0.32 + (index / 79) * 0.68);

function getBudgetRingColor(usedPercent: number, isLight: boolean) {
  if (usedPercent >= 121) return isLight ? '#dc2626' : '#ff3131';
  if (usedPercent >= 101) return isLight ? '#f97316' : '#ff8a00';
  return isLight ? '#00a86b' : '#00fa9a';
}

function timelinePosition(date: Date, start: Date, end: Date) {
  const duration = Math.max(1, end.getTime() - start.getTime());
  const elapsed = date.getTime() - start.getTime();
  return clampPercent((elapsed / duration) * 100);
}

function timelineMarkerPosition(date: Date, start: Date, end: Date) {
  const duration = Math.max(1, end.getTime() - start.getTime());
  const elapsed = date.getTime() - start.getTime();
  return clampMarkerPercent((elapsed / duration) * 100);
}

/** Données de démonstration fixes — aucune lecture/écriture DB. */
const MOCK_CHECKING_SHORTFALL = 142.51;
const MOCK_CHECKING_PAYMENT_NAME = 'Hydro Québec';
const MOCK_CHECKING_ACCOUNT_NAME = 'Desjardins · 4521';
const MOCK_CREDIT_CARD_NAME = 'Visa · 4782';
/** Limite carte (démo). */
const MOCK_CREDIT_LIMIT = 5000;
/** Solde avant paiement (négatif = dette), 4350 $ dus. */
const MOCK_CREDIT_BALANCE_BEFORE = -4350;
/** Paiement a J+3 : 4350 + 450 = 4800 -> 96 % de la limite (bande rouge mock >= 95 %). */
const MOCK_CREDIT_PAYMENT_AMOUNT = 450;
/** Ex. zone orange 80-94,99 % (mockCreditUtilizationBarColor) : usedAfter / limite ~0,88 -> ajuster PAYMENT ou BALANCE. */
const MOCK_CREDIT_PAYMENT_NAME = 'Abonnement cloud';

type PaymentPreviewTone = 'ok' | 'warning';

/** Bloc carte « prochain paiement » (réutilisable live / simulation). */
function PaymentPreviewSection({
  name,
  amount,
  dateLabel,
  accountNameLine,
  /** Pastille compte/carte lorsque tone === 'warning' (séparée du corps du message). */
  warningAccountLabel,
  amountColor,
  iconFallbackColor,
  logoUrl,
  merchantOverrides,
  colors,
  tone,
  cardShadow,
}: {
  name: string;
  amount: number;
  dateLabel: string;
  /** Ligne courte sous le paiement : avertissement ou « compte · délai ». */
  accountNameLine: string;
  warningAccountLabel?: string | null;
  amountColor: string;
  iconFallbackColor: string;
  logoUrl: string | null;
  merchantOverrides: MerchantOverride[];
  colors: AppColors;
  tone: PaymentPreviewTone;
  cardShadow: ViewStyle | ViewStyle[] | undefined;
}) {
  const resolvedLogoUrl =
    logoUrl ?? merchantOverrides.find((override) => override.originalName === name)?.logoUrl ?? null;
  const successColor = colors.success;
  const textSecondaryColor = colors.textSecondary;

  return (
    <View style={styles.openSection}>
      <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>Prochain paiement</Text>
      <View
        style={[
          styles.paymentPreview,
          cardShadow,
          { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
        ]}
      >
        <View style={styles.paymentHeaderRow}>
          <UpcomingPaymentLogo
            name={name}
            logoUrl={resolvedLogoUrl}
            fallbackColor={iconFallbackColor}
          />
          <View style={styles.paymentCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.paymentDateLine, { color: colors.textMuted }]} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
          <Text
            style={[styles.rowAmountStrong, { color: amountColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {formatMoneyDetailed(amount)}
          </Text>
        </View>

        {tone === 'warning' ? (
          <>
            {warningAccountLabel?.trim().length ? (
              <View style={styles.paymentAlertAccountStrip}>
                <AlertAccountPill label={warningAccountLabel} colors={colors} />
              </View>
            ) : null}
            <View style={styles.paymentAlertRow}>
              <Ionicons name="warning" size={13} color={iconFallbackColor} style={{ marginTop: 2 }} />
              <Text
                style={[styles.paymentAlertText, { color: amountColor }]}
                numberOfLines={4}
                ellipsizeMode="tail"
              >
                {accountNameLine}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.paymentAlertRow}>
            <Ionicons name="checkmark-circle-outline" size={13} color={successColor} style={{ marginTop: 2 }} />
            <Text
              style={[styles.paymentAlertText, { color: textSecondaryColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {accountNameLine}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Pastille minimaliste : compte / carte visé par l’alerte (tronquée si trop long). */
function AlertAccountPill({
  label,
  colors,
  containerStyle,
}: {
  label: string;
  colors: AppColors;
  containerStyle?: ViewStyle;
}) {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return (
    <View
      style={[
        styles.alertAccountPill,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        containerStyle,
      ]}
    >
      <Text style={[styles.alertAccountPillText, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
        {trimmed}
      </Text>
    </View>
  );
}

/** Carte alerte avec ligne de temps (réutilisable live + simulations vue seule). */
function FundsTimelineAlertCard({
  eyebrow,
  accountPillLabel,
  bodyText,
  warningColor,
  warningBadgeBg,
  colors,
  cardShadow,
  monthStart,
  timelineEnd,
  today,
  timelineFillWidth,
  todayPosition,
  nextPaymentPosition,
  nextPayPosition,
  nextPaymentDate,
  estimatedPayDate,
  highlightPaymentLegend,
  markerIconColor,
  paymentLegendLine,
  timelineTodayUtilLabel,
  timelineAfterPaymentUtilLabel,
}: {
  eyebrow: string;
  /** Compte ou carte concerné(e) ; pastille omise si vide. */
  accountPillLabel?: string | null;
  bodyText: string;
  warningColor: string;
  warningBadgeBg: string;
  colors: AppColors;
  cardShadow: ViewStyle | ViewStyle[] | undefined;
  monthStart: Date;
  timelineEnd: Date;
  today: Date;
  timelineFillWidth: string;
  todayPosition: string;
  nextPaymentPosition: string;
  nextPayPosition: string;
  nextPaymentDate: Date;
  estimatedPayDate: Date;
  highlightPaymentLegend: boolean;
  markerIconColor: string;
  /** Si défini (ex. carte en maj.), remplace la ligne « Paiement · date » de la légende. */
  paymentLegendLine?: string;
  /** % utilisation actuelle (carte), au-dessus du marqueur « aujourd’hui ». */
  timelineTodayUtilLabel?: string | null;
  /** % utilisation projetée après le paiement récurrent, sous le marqueur paiement. */
  timelineAfterPaymentUtilLabel?: string | null;
}) {
  const hasTimelineUtilLabels = Boolean(
    timelineTodayUtilLabel?.trim().length || timelineAfterPaymentUtilLabel?.trim().length,
  );

  return (
    <GlassContainer style={[styles.forecastSurface, cardShadow]} padding={0} borderRadius={24}>
      <View style={styles.forecastClip}>
        <View style={styles.forecastInline}>
        <View style={styles.timelineAlertHeader}>
          <Text
            style={[styles.inlineEyebrow, styles.timelineAlertEyebrow, { color: colors.textMuted }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {eyebrow}
          </Text>
          {accountPillLabel ? (
            <AlertAccountPill label={accountPillLabel} colors={colors} containerStyle={styles.alertAccountPillInCardHeader} />
          ) : null}
        </View>
        <View style={[styles.shortfallCard, { backgroundColor: warningBadgeBg }]}>
          <View style={[styles.shortfallIconBadge, { backgroundColor: warningBadgeBg }]}>
            <Ionicons name="alert-circle" size={18} color={warningColor} style={{ marginTop: 2 }} />
          </View>
          <View style={styles.shortfallMessageColumn}>
            <Text
              style={[styles.shortfallText, { color: warningColor }]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {bodyText}
            </Text>
          </View>
        </View>
        <View style={styles.timelineDates}>
          <Text style={[styles.timelineDateText, { color: colors.textMuted }]}>{formatShortDate(monthStart)}</Text>
          <Text style={[styles.timelineDateText, { color: colors.textMuted }]}>{formatShortDate(timelineEnd)}</Text>
        </View>
        <View
          style={[
            styles.timeline,
            hasTimelineUtilLabels ? styles.timelineExpanded : styles.timelineCompact,
          ]}
        >
          {timelineTodayUtilLabel?.trim() ? (
            <Text
              style={[
                styles.timelineTodayUtilLabel,
                { left: todayPosition, color: colors.textSecondary },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {timelineTodayUtilLabel.trim()}
            </Text>
          ) : null}
          <View style={hasTimelineUtilLabels ? styles.timelineTrackLayer : styles.timelineTrackLayerCompact}>
            <View style={[styles.timelineRail, { backgroundColor: colors.borderStrong }]} />
            <MotiView
              style={[styles.timelineFill, { backgroundColor: 'transparent' }]}
              from={{ width: '0%' }}
              animate={{ width: timelineFillWidth }}
              transition={{ type: 'timing', duration: 900 }}
            >
              {TIMELINE_INTENSITY_BANDS.map((opacity, index) => (
                <View
                  key={index}
                  style={[
                    styles.timelineFillBand,
                    {
                      backgroundColor: warningColor,
                      opacity,
                    },
                  ]}
                />
              ))}
            </MotiView>
            <View style={[styles.todayMarker, { left: todayPosition, borderTopColor: colors.textSecondary }]} />
            <View
              style={[
                styles.iconMarker,
                styles.paymentMarker,
                { left: nextPaymentPosition, backgroundColor: warningColor, borderColor: colors.surfaceSolid },
              ]}
            >
              <Ionicons name="warning" size={13} color={markerIconColor} />
            </View>
            <View
              style={[
                styles.iconMarker,
                styles.payMarker,
                { left: nextPayPosition, backgroundColor: colors.primary, borderColor: colors.surfaceSolid },
              ]}
            >
              <Ionicons name="wallet" size={14} color={colors.background} />
            </View>
          </View>
          {timelineAfterPaymentUtilLabel?.trim() ? (
            <Text
              style={[
                styles.timelineAfterPayUtilLabel,
                { left: nextPaymentPosition, color: warningColor },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {timelineAfterPaymentUtilLabel.trim()}
            </Text>
          ) : null}
        </View>
        <View style={styles.timelineLegend}>
          <View style={styles.legendLabels}>
            <View style={styles.legendPair}>
              <View style={[styles.legendTodayMarker, { borderTopColor: colors.textSecondary }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Aujourd’hui · {formatShortDate(today)}</Text>
            </View>
            <View style={styles.legendPair}>
              <Ionicons name="warning" size={11} color={warningColor} />
              <Text
                style={[styles.legendLabel, { color: colors.textMuted }, highlightPaymentLegend && { color: warningColor }]}
              >
                {paymentLegendLine ?? `Paiement · ${formatShortDate(nextPaymentDate)}`}
              </Text>
            </View>
            <View style={styles.legendPair}>
              <View style={[styles.legendIconMarker, styles.legendPayMarker, { backgroundColor: colors.primary }]}>
                <Ionicons name="wallet" size={10} color={colors.background} />
              </View>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                Dépôt de paie estimé · {formatShortDate(estimatedPayDate)}
              </Text>
            </View>
          </View>
        </View>
        </View>
      </View>
    </GlassContainer>
  );
}

// ── Multi-ring concentric gauge with glow effect ─────────────────────────────
const GAUGE_RINGS = [
  { r: 63, sw: 13, opFactor: 1.0 },
  { r: 50, sw: 9,  opFactor: 0.72 },
  { r: 39, sw: 6,  opFactor: 0.48 },
] as const;

const GAUGE_GLOW_LAYERS = [
  { extraSW: 36, opacity: 0.03 },
  { extraSW: 24, opacity: 0.06 },
  { extraSW: 14, opacity: 0.12 },
  { extraSW:  6, opacity: 0.25 },
] as const;

const GAUGE_SVG_SIZE = 160;
const GAUGE_CX = GAUGE_SVG_SIZE / 2;
const GAUGE_CY = GAUGE_SVG_SIZE / 2;
const GAUGE_TICK_COUNT = 36;
const GAUGE_TICKS = Array.from({ length: GAUGE_TICK_COUNT }, (_, i) => {
  const angleRad = ((i * 360) / GAUGE_TICK_COUNT - 90) * (Math.PI / 180);
  return {
    x1: GAUGE_CX + 70 * Math.cos(angleRad),
    y1: GAUGE_CY + 70 * Math.sin(angleRad),
    x2: GAUGE_CX + 75 * Math.cos(angleRad),
    y2: GAUGE_CY + 75 * Math.sin(angleRad),
  };
});

function gaugeRingColor(usedPercent: number, isLight: boolean): string {
  if (usedPercent >= 100) return isLight ? '#DC2626' : '#FF3131';
  if (usedPercent >= 80)  return isLight ? '#F97316' : '#FF8A00';
  return isLight ? '#00A86B' : '#00FA9A';
}

function BudgetUsageChart({
  usedPercent,
  budgetAvailable,
  progress,
  isLight,
  mutedColor,
  textColor,
  surfaceColor,
}: {
  usedPercent: number;
  /** Raw remaining budget — can be negative when over budget. */
  budgetAvailable: number;
  /** Fraction spent (can be > 1 when over budget, capped to 1 for arc). */
  progress: number;
  isLight: boolean;
  mutedColor: string;
  textColor: string;
  surfaceColor: string;
}) {
  const isOverBudget = usedPercent >= 100;
  const isWarning    = usedPercent >= 80 && usedPercent < 100;
  const ringCol      = gaugeRingColor(usedPercent, isLight);
  const cappedProg   = Math.max(0, Math.min(1, progress));

  const usageLabel = isOverBudget
    ? `OVERDRIVE ${Math.round(usedPercent)}%`
    : `${Math.round(usedPercent)}%`;

  const sign        = budgetAvailable < 0 ? '\u2212\u00A0' : '';
  const absAmt      = Math.abs(budgetAvailable);
  const amountStr   = `${sign}$ ${absAmt.toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const warnColor = isOverBudget
    ? (isLight ? '#DC2626' : '#FF3131')
    : (isLight ? '#F97316' : '#FF8A00');

  return (
    <View style={[styles.gaugeCard, { backgroundColor: surfaceColor }]}>
      <View style={styles.gaugeRow}>

        {/* ── Left: SVG gauge ─────────────────────────────────────────────── */}
        <Svg width={GAUGE_SVG_SIZE} height={GAUGE_SVG_SIZE}>
          {GAUGE_RINGS.flatMap(({ r, sw, opFactor }, ri) => {
            const circ    = 2 * Math.PI * r;
            const dashOff = circ - cappedProg * circ;
            const origin  = `${GAUGE_CX}, ${GAUGE_CY}`;
            const arcs: ReactElement[] = [];

            // Track (dim background arc)
            arcs.push(
              <Circle
                key={`tr${ri}`}
                cx={GAUGE_CX} cy={GAUGE_CY} r={r}
                stroke={ringCol}
                strokeOpacity={0.13 * opFactor}
                strokeWidth={sw}
                fill="none"
              />,
            );

            // Glow halos behind fill (over-budget only) — widest first
            if (isOverBudget) {
              GAUGE_GLOW_LAYERS.forEach(({ extraSW, opacity }, gi) => {
                arcs.push(
                  <Circle
                    key={`gl${ri}-${gi}`}
                    cx={GAUGE_CX} cy={GAUGE_CY} r={r}
                    stroke={ringCol}
                    strokeOpacity={opacity * opFactor}
                    strokeWidth={sw + extraSW}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${circ} ${circ}`}
                    strokeDashoffset={dashOff}
                    rotation={-90}
                    origin={origin}
                  />,
                );
              });
            }

            // Main fill arc
            arcs.push(
              <Circle
                key={`fi${ri}`}
                cx={GAUGE_CX} cy={GAUGE_CY} r={r}
                stroke={ringCol}
                strokeOpacity={opFactor}
                strokeWidth={sw}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={dashOff}
                rotation={-90}
                origin={origin}
              />,
            );

            return arcs;
          })}

          {/* Tick marks — evenly spaced around outer ring */}
          {GAUGE_TICKS.map((t, i) => (
            <Line
              key={`tk${i}`}
              x1={t.x1} y1={t.y1}
              x2={t.x2} y2={t.y2}
              stroke="#ffffff"
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          ))}
        </Svg>

        {/* ── Right: text copy ─────────────────────────────────────────────── */}
        <View style={styles.gaugeCopy}>
          {/* Warning icon — top-right, only when 80%+ */}
          {(isOverBudget || isWarning) ? (
            <Ionicons
              name="warning"
              size={16}
              color={warnColor}
              style={styles.gaugeWarnIcon}
            />
          ) : (
            <View style={styles.gaugeWarnIconPlaceholder} />
          )}

          <Text
            style={[styles.gaugeUsageLabel, { color: isOverBudget ? warnColor : textColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {usageLabel}
          </Text>
          <Text style={[styles.gaugeEyebrow, { color: mutedColor }]}>
            BUDGET UTILISÉ
          </Text>

          <View style={styles.gaugeSpacer} />

          <Text
            style={[styles.gaugeAmountLabel, { color: textColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {amountStr}
          </Text>
          <Text style={[styles.gaugeEyebrow, { color: mutedColor }]}>
            DISPONIBLE
          </Text>
        </View>

      </View>
    </View>
  );
}

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

function UpcomingPaymentLogo({
  name,
  logoUrl,
  fallbackColor,
}: {
  name: string;
  logoUrl?: string | null;
  fallbackColor: string;
}) {
  const { isLight } = useAppTheme();
  const paymentIconSize = 34;
  const urls = useMemo(() => (logoUrl ? [logoUrl] : getMerchantLogoUrls(name)), [logoUrl, name]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [giveUp, setGiveUp] = useState(false);
  const uri = urls[sourceIndex];
  const showLogo = Boolean(uri) && !giveUp;
  const logoSize = userPickedIconLogoSize(paymentIconSize);

  useEffect(() => {
    setSourceIndex(0);
    setGiveUp(false);
  }, [urls]);

  return (
    <View style={[styles.paymentIcon, userPickedIconWellStyle(paymentIconSize, isLight)]}>
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
        <Ionicons name="calendar-clear-outline" size={17} color={fallbackColor} />
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const balanceSelectorMaxHeight = Math.min(windowHeight * 0.82, windowHeight - insets.top - 24);
  const { colors, ghost, ghostCardShadow, isLight, toggleLightMode } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
  const [displayName, setDisplayName] = useState('Jérémie');
  const [refreshing, setRefreshing] = useState(false);
  const [balanceAccountOptions, setBalanceAccountOptions] = useState<BalanceCompareAccount[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [selectedBalanceAccountIds, setSelectedBalanceAccountIds] = useState<string[]>([]);
  const [draftBalanceAccountIds, setDraftBalanceAccountIds] = useState<string[]>([]);
  const [balanceSelectorVisible, setBalanceSelectorVisible] = useState(false);
  const [balanceInsightPage, setBalanceInsightPage] = useState(0);
  const [balanceInsightPagerWidth, setBalanceInsightPagerWidth] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [dash, name, recurring, overrides, loadedSimulatedAccounts, storedBalanceIds] = await Promise.all([
      getDashboard(),
      getUserDisplayName(),
      getRecurringPayments(),
      getMerchantOverrides(),
      getSimulatedAccounts(),
      getSetting(BALANCE_COMPARE_SETTING_KEY, ''),
    ]);
    const compareAccounts = toBalanceCompareAccounts(loadedSimulatedAccounts);
    const storedIds = parseBalanceCompareIds(storedBalanceIds);

    setData(dash);
    setDisplayName(name);
    setRecurringPayments(recurring);
    setMerchantOverrides(overrides);
    setSimulatedAccounts(loadedSimulatedAccounts);
    setBalanceAccountOptions(compareAccounts);
    setSelectedBalanceAccountIds(resolveBalanceCompareSelection(compareAccounts, storedIds).map((account) => account.id));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useRefreshOnFocus(load);
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

  const projection = useMemo(() => {
    if (!data) return { fill: 0, breach: false, projected: 0 };
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = Math.max(1, now.getDate());
    const pace = data.monthlyExpenses / day;
    const projected = pace * dim;
    const limit = data.monthlyBudgetLimit;
    const breach = limit > 0 && projected > limit;
    const fill = limit > 0 ? Math.min(1, projected / limit) : Math.min(1, projected / 10000);
    return { fill, breach, projected };
  }, [data]);

  const balanceCompareAccounts = useMemo(
    () => resolveBalanceCompareSelection(balanceAccountOptions, selectedBalanceAccountIds),
    [balanceAccountOptions, selectedBalanceAccountIds],
  );

  const balanceCompareMax = useMemo(
    () => Math.max(1, ...balanceCompareAccounts.map((account) => Math.abs(account.balance))),
    [balanceCompareAccounts],
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

  const upcomingPayments = useMemo(
    () => getUpcomingPayments(recurringPayments, paymentResolutionPool),
    [recurringPayments, paymentResolutionPool],
  );

  if (!data) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  }

  const limit = data.monthlyBudgetLimit;
  const budgetAvailable = data.monthlyBudgetLimit - data.monthlyExpenses;
  const budgetUsedPercent =
    limit <= 0 ? 0 : Math.min(999, Math.round((data.monthlyExpenses / limit) * 100));
  const budgetProgress = limit <= 0 ? 0 : data.monthlyExpenses / limit;
  const budgetInsight = getDashboardBudgetInsight(data, projection.projected);
  const budgetInsightColor =
    budgetInsight.tone === 'danger'
      ? colors.danger
      : budgetInsight.tone === 'warning'
        ? colors.warning
        : colors.textMuted;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextPayment =
    upcomingPayments.find((payment) => payment.date >= isoDate(today)) ??
    upcomingPayments[0];

  const resolvedAccount = resolvePaymentAccountForUpcoming(
    nextPayment.account,
    nextPayment.accountId,
    paymentResolutionPool,
  );

  const isIncomeRecurring = nextPayment.kind === 'income';
  const isCreditWithLimit = Boolean(
    resolvedAccount &&
      resolvedAccount.kind === 'credit' &&
      typeof resolvedAccount.creditLimit === 'number' &&
      resolvedAccount.creditLimit > 0,
  );

  let nextPaymentShortfall = 0;
  let showInsufficientFundsWarning = false;
  let creditRiskActive: Extract<CreditPaymentRisk, { shouldWarn: true }> | null = null;

  if (!isIncomeRecurring && nextPayment.recurring && resolvedAccount) {
    if (resolvedAccount.kind === 'credit') {
      if (isCreditWithLimit && resolvedAccount.creditLimit != null) {
        const risk = evaluateCreditPaymentRisk(
          resolvedAccount.creditLimit,
          resolvedAccount.balance,
          nextPayment.amount,
        );
        if (risk.shouldWarn) {
          showInsufficientFundsWarning = true;
          creditRiskActive = risk;
        }
      }
      // Sans limite enregistrée : pas d’heuristique « solde ≥ 0 » (inadaptée aux cartes).
    } else {
      const available = Math.max(0, resolvedAccount.balance);
      nextPaymentShortfall = Math.max(0, nextPayment.amount - available);
      showInsufficientFundsWarning = nextPaymentShortfall > 0;
    }
  }

  const nextPaymentAccountName = resolvedAccount?.name ?? nextPayment.account;
  const insufficientFundsPillLabel = creditRiskActive
    ? nextPaymentAccountName
    : insufficientFundsAlertPillLabel(resolvedAccount);
  const nextPaymentDate = new Date(`${nextPayment.date}T00:00:00`);
  const nextPaymentLogoUrl =
    nextPayment.logoUrl ??
    merchantOverrides.find((override) => override.originalName === nextPayment.name)?.logoUrl ??
    null;
  const creditTimelinePaymentLegendLine =
    creditRiskActive && resolvedAccount
      ? `${nextPayment.name} · ${formatShortDate(nextPaymentDate)}`
      : undefined;
  const daysToNextPayment = daysUntil(nextPayment.date);
  const estimatedPayDate = addDays(today, 14);
  const riskBeforePay =
    nextPaymentDate < estimatedPayDate && showInsufficientFundsWarning && !isIncomeRecurring;

  const fundsAlertEyebrow = creditRiskActive
    ? PAYMENT_WARNING_TITLE_CREDIT_LIMIT
    : PAYMENT_WARNING_TITLE_CHECKING;

  /** Phrase très courte commune quand une échéance tombe avant le dépôt de paie supposé. */
  const beforePayRiskFragment = riskBeforePay ? ' Avant le dépôt de paie.' : '';

  const creditTimelineTodayUtilLabel =
    creditRiskActive && resolvedAccount && typeof resolvedAccount.creditLimit === 'number' && resolvedAccount.creditLimit > 0
      ? formatCreditUtilTimelineLabel(
          (creditUsedFromBalance(resolvedAccount.balance) / resolvedAccount.creditLimit) * 100,
        )
      : undefined;
  const creditTimelineAfterPaymentUtilLabel =
    creditRiskActive && resolvedAccount && typeof resolvedAccount.creditLimit === 'number' && resolvedAccount.creditLimit > 0
      ? formatCreditUtilTimelineLabel((creditRiskActive.usedAfter / resolvedAccount.creditLimit) * 100)
      : undefined;

  const forecastShortfallMessage = (() => {
    if (creditRiskActive) {
      return creditRiskActive.reason === 'over_limit'
        ? `Limite dépassée après « ${nextPayment.name} ».${beforePayRiskFragment}`.trim()
        : `Marge ≤ 10 % après « ${nextPayment.name} ».${beforePayRiskFragment}`.trim();
    }
    if (showInsufficientFundsWarning) {
      return `Manque ${formatMoneyDetailed(nextPaymentShortfall)} — « ${nextPayment.name} ».${beforePayRiskFragment}`.trim();
    }
    return '';
  })();

  const paymentAlertLine = (() => {
    if (creditRiskActive) {
      return creditRiskActive.reason === 'over_limit'
        ? `Dépassement · ${formatDaysUntilLabel(daysToNextPayment)}`
        : `Marge ≤ 10 % · ${formatDaysUntilLabel(daysToNextPayment)}`;
    }
    if (showInsufficientFundsWarning) {
      return `Manque ${formatMoneyDetailed(nextPaymentShortfall)} · ${formatDaysUntilLabel(daysToNextPayment)}`;
    }
    return `${nextPaymentAccountName} · ${formatDaysUntilLabel(daysToNextPayment)}`;
  })();

  const balanceInsightPagerWidthFallback = Math.max(
    280,
    windowWidth - DASHBOARD_CONTENT_HORIZONTAL_PADDING * 2,
  );
  const balanceInsightPagerStripWidth = balanceInsightPagerWidth ?? balanceInsightPagerWidthFallback;
  const mockRiskBeforePayScenario = true;
  const mockRiskBeforePaymentFragment = mockRiskBeforePayScenario ? ' Avant le dépôt de paie.' : '';
  const mockCheckingForecastMessage =
    `Manque ${formatMoneyDetailed(MOCK_CHECKING_SHORTFALL)} — « ${MOCK_CHECKING_PAYMENT_NAME} ».${mockRiskBeforePaymentFragment}`.trim();

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const timelineEnd = [nextPaymentDate, estimatedPayDate, monthEnd].reduce((latest, date) =>
    date > latest ? date : latest
  );
  const todayPosition = timelineMarkerPosition(today, monthStart, timelineEnd);
  const nextPaymentPosition = timelineMarkerPosition(nextPaymentDate, monthStart, timelineEnd);
  const nextPayPosition = timelineMarkerPosition(estimatedPayDate, monthStart, timelineEnd);
  const shortfallWarningColor = isLight ? '#f97316' : '#ff8a00';
  const shortfallWarningBadge = isLight ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 138, 0, 0.2)';
  const creditDangerBadge = isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(255, 49, 49, 0.18)';
  const timelineFill = timelinePosition(today, monthStart, timelineEnd);

  /** Paiement récurrent démo carte : J+3 (aligné légende « Paiement »). */
  const mockCreditNextPaymentDate = addDays(today, 3);
  const mockCreditTimelineEnd = [mockCreditNextPaymentDate, estimatedPayDate, monthEnd].reduce((latest, date) =>
    date > latest ? date : latest,
  );
  const mockCreditTodayPosition = timelineMarkerPosition(today, monthStart, mockCreditTimelineEnd);
  const mockCreditTimelineFill = timelinePosition(today, monthStart, mockCreditTimelineEnd);
  const mockCreditNextPaymentPosition = timelineMarkerPosition(
    mockCreditNextPaymentDate,
    monthStart,
    mockCreditTimelineEnd,
  );
  const mockCreditNextPayPosition = timelineMarkerPosition(estimatedPayDate, monthStart, mockCreditTimelineEnd);
  const mockCreditUsedAfter = creditUsedFromBalance(MOCK_CREDIT_BALANCE_BEFORE) + MOCK_CREDIT_PAYMENT_AMOUNT;
  const mockCreditCurrentUtilPct =
    (creditUsedFromBalance(MOCK_CREDIT_BALANCE_BEFORE) / MOCK_CREDIT_LIMIT) * 100;
  const mockCreditProjectedUtilPct = (mockCreditUsedAfter / MOCK_CREDIT_LIMIT) * 100;
  const mockCreditTimelineTodayLabel = formatCreditUtilTimelineLabel(mockCreditCurrentUtilPct);
  const mockCreditTimelineAfterLabel = formatCreditUtilTimelineLabel(mockCreditProjectedUtilPct);
  const mockCreditBarColor = mockCreditUtilizationBarColor(mockCreditProjectedUtilPct, colors, isLight);
  const mockCreditAlertBadgeBg =
    mockCreditProjectedUtilPct >= 95 ? creditDangerBadge : shortfallWarningBadge;
  const mockCreditLegendHighlight =
    mockCreditNextPaymentDate < estimatedPayDate && mockRiskBeforePayScenario;
  const mockCreditMarkerIconColor = mockCreditProjectedUtilPct >= 95 ? colors.background : colors.text;
  const mockCreditOverLimitBody =
    `Limite critique après ce paiement.${mockRiskBeforePaymentFragment}`.trim();
  const themeLabel = isLight ? 'Mode clair' : 'Mode sombre';
  const nextThemeLabel = isLight ? 'sombre' : 'clair';
  const themeIcon = isLight ? 'sunny-outline' : 'moon-outline';

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + SCREEN_TOP_GUTTER,
          paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.md,
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
          <View style={styles.headerActions}>
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
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="settings-outline" size={21} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => {
                tapHaptic();
                void toggleLightMode(!isLight);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: !isLight }}
              accessibilityLabel={`Basculer vers le thème ${nextThemeLabel}`}
              accessibilityValue={{ text: themeLabel }}
              style={({ pressed }) => [
                styles.themeQuickToggle,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.themeSwitchTrack,
                  {
                    backgroundColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.12)',
                    borderColor: colors.borderStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themeSwitchThumb,
                    {
                      backgroundColor: colors.surfaceSolid,
                      transform: [{ translateX: isLight ? 0 : 20 }],
                    },
                  ]}
                >
                  <Ionicons name={themeIcon} size={12} color={colors.textSecondary} />
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.budgetSummaryOpen}>
        <BudgetUsageChart
          usedPercent={budgetUsedPercent}
          budgetAvailable={budgetAvailable}
          progress={budgetProgress}
          isLight={isLight}
          mutedColor={colors.textMuted}
          textColor={colors.text}
          surfaceColor="transparent"
        />

        <GlassContainer padding={9}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
            <View style={[styles.aiDot, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="sparkles" size={14} color={budgetInsight.tone === 'safe' ? ghost.mint : ghost.blaze} />
            </View>
            <Text
              style={[styles.health, { color: budgetInsightColor }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {budgetInsight.message}
            </Text>
          </View>
        </GlassContainer>
      </View>

      <View
        style={styles.balanceInsightPagerWrap}
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth <= 0) return;
          setBalanceInsightPagerWidth((prev) => (prev !== nextWidth ? nextWidth : prev));
        }}
      >
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          style={[styles.balanceInsightPagerViewport, { width: '100%' }]}
          contentContainerStyle={styles.balanceInsightPagerPages}
          decelerationRate="fast"
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const step = balanceInsightPagerStripWidth;
            if (step <= 0) return;
            const page = Math.round(e.nativeEvent.contentOffset.x / step);
            setBalanceInsightPage(Math.max(0, Math.min(2, page)));
          }}
        >
          <View style={[styles.balanceInsightPage, { width: balanceInsightPagerStripWidth }]}>
            {showInsufficientFundsWarning ? (
              <GlassContainer padding={0} style={styles.balanceInsightPagerCard}>
              <FundsTimelineAlertCard
                eyebrow={fundsAlertEyebrow}
                accountPillLabel={insufficientFundsPillLabel}
                bodyText={forecastShortfallMessage}
                warningColor={shortfallWarningColor}
                warningBadgeBg={shortfallWarningBadge}
                colors={colors}
                cardShadow={ghostCardShadow}
                monthStart={monthStart}
                timelineEnd={timelineEnd}
                today={today}
                timelineFillWidth={timelineFill}
                todayPosition={todayPosition}
                nextPaymentPosition={nextPaymentPosition}
                nextPayPosition={nextPayPosition}
                nextPaymentDate={nextPaymentDate}
                estimatedPayDate={estimatedPayDate}
                highlightPaymentLegend={riskBeforePay}
                markerIconColor={colors.text}
                paymentLegendLine={creditTimelinePaymentLegendLine}
              />
              </GlassContainer>
            ) : (
              <GlassContainer padding={18} style={styles.balanceInsightPagerCard}>
                <Pressable
                  onPress={openBalanceSelector}
                  accessibilityRole="button"
                  accessibilityLabel="Choisir les comptes à comparer"
                  android_ripple={null}
                >
                  <View style={{ gap: 18 }}>
                  <View style={styles.balanceCompareHeader}>
                    <View style={styles.balanceCompareTitleBlock}>
                      <Text
                        style={[styles.inlineEyebrow, { color: colors.textMuted }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        2 comptes favoris
                      </Text>
                      <Text
                        style={[styles.balanceCompareTitle, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        Mes soldes
                      </Text>
                    </View>
                    <View style={[styles.balanceCompareAction, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="swap-horizontal-outline" size={15} color={colors.textSecondary} />
                      <Text style={[styles.balanceCompareActionText, { color: colors.textSecondary }]}>Choisir</Text>
                    </View>
                  </View>

                  <View style={styles.balanceCompareChart}>
                    {balanceCompareAccounts.map((account, index) => {
                      const creditUtilPct =
                        account.kind === 'credit'
                          ? creditLimitUtilizationPercent(account.balance, account.creditLimit)
                          : undefined;
                      const barFillColor = balanceCompareProgressBarColor(
                        account,
                        creditUtilPct,
                        colors,
                        isLight,
                      );
                      const utilizationLabelColor =
                        typeof creditUtilPct === 'number'
                          ? creditLimitUtilizationBarColor(creditUtilPct, colors, isLight)
                          : colors.primary;
                      const width = `${Math.max(9, Math.min(100, (Math.abs(account.balance) / balanceCompareMax) * 100))}%`;

                      return (
                        <View key={account.id} style={styles.balanceCompareRow}>
                          <BalanceCompareAccountAvatar account={account} colors={colors} />
                          <View style={styles.balanceCompareRowBody}>
                            <View style={styles.balanceCompareRowHeader}>
                              <View style={styles.balanceCompareAccountCopy}>
                                <Text style={[styles.balanceCompareAccountName, { color: colors.text }]} numberOfLines={1}>
                                  {account.name}
                                </Text>
                                <Text style={[styles.balanceCompareAccountMeta, { color: colors.textMuted }]} numberOfLines={1}>
                                  {formatAccountMeta(account)}
                                </Text>
                              </View>
                              <View style={styles.balanceCompareAmountBlock}>
                                <Text
                                  style={[
                                    styles.balanceCompareAmount,
                                    { color: account.balance < 0 ? colors.danger : colors.text },
                                  ]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.78}
                                >
                                  {formatCompactCurrency(account.balance)}
                                </Text>
                                {typeof creditUtilPct === 'number' ? (
                                  <Text
                                    style={[styles.balanceCompareCreditUtil, { color: utilizationLabelColor }]}
                                    numberOfLines={1}
                                  >
                                    {`${Math.round(creditUtilPct)} % utilisé`}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                            <View style={[styles.balanceCompareTrack, { backgroundColor: colors.borderStrong }]}>
                              <MotiView
                                from={{ width: '8%' }}
                                animate={{ width }}
                                transition={{ type: 'timing', duration: 760 + index * 120 }}
                                style={[styles.balanceCompareFill, { backgroundColor: barFillColor }]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  </View>
                </Pressable>
              </GlassContainer>
            )}
      </View>

          <View style={[styles.balanceInsightPage, { width: balanceInsightPagerStripWidth }]}>
            <GlassContainer padding={0} style={styles.balanceInsightPagerCard}>
            <FundsTimelineAlertCard
              eyebrow={PAYMENT_WARNING_TITLE_CHECKING}
              accountPillLabel={MOCK_CHECKING_ACCOUNT_NAME}
              bodyText={mockCheckingForecastMessage}
              warningColor={shortfallWarningColor}
              warningBadgeBg={shortfallWarningBadge}
              colors={colors}
              cardShadow={ghostCardShadow}
              monthStart={monthStart}
              timelineEnd={timelineEnd}
              today={today}
              timelineFillWidth={timelineFill}
              todayPosition={todayPosition}
              nextPaymentPosition={nextPaymentPosition}
              nextPayPosition={nextPayPosition}
              nextPaymentDate={nextPaymentDate}
              estimatedPayDate={estimatedPayDate}
              highlightPaymentLegend={mockRiskBeforePayScenario}
              markerIconColor={colors.text}
            />
            </GlassContainer>
          </View>

          <View style={[styles.balanceInsightPage, { width: balanceInsightPagerStripWidth }]}>
            <GlassContainer padding={0} style={styles.balanceInsightPagerCard}>
            <FundsTimelineAlertCard
              eyebrow={PAYMENT_WARNING_TITLE_CREDIT_LIMIT}
              accountPillLabel={MOCK_CREDIT_CARD_NAME}
              bodyText={mockCreditOverLimitBody}
              warningColor={mockCreditBarColor}
              warningBadgeBg={mockCreditAlertBadgeBg}
              colors={colors}
              cardShadow={ghostCardShadow}
              monthStart={monthStart}
              timelineEnd={mockCreditTimelineEnd}
              today={today}
              timelineFillWidth={mockCreditTimelineFill}
              todayPosition={mockCreditTodayPosition}
              nextPaymentPosition={mockCreditNextPaymentPosition}
              nextPayPosition={mockCreditNextPayPosition}
              nextPaymentDate={mockCreditNextPaymentDate}
              estimatedPayDate={estimatedPayDate}
              highlightPaymentLegend={mockCreditLegendHighlight}
              markerIconColor={mockCreditMarkerIconColor}
              paymentLegendLine={`${MOCK_CREDIT_PAYMENT_NAME} · ${formatShortDate(mockCreditNextPaymentDate)}`}
            />
            </GlassContainer>
          </View>
        </ScrollView>

        <View style={styles.pagerDotsRow} accessibilityRole="tablist">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              accessibilityRole="tab"
              accessibilityState={{ selected: balanceInsightPage === i }}
              style={[
                styles.pagerDot,
                { backgroundColor: colors.borderStrong },
                balanceInsightPage === i && { backgroundColor: colors.primary, width: 18 },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.balancePagerHint, { color: colors.textMuted }]} pointerEvents="none">
          Glissez pour des exemples d’alertes (démo)
        </Text>
      </View>
      <View style={styles.openSection}>
        <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>Prochain paiement</Text>
        <GlassContainer padding={12}>
          <View style={{ gap: 9 }}>
            <View style={styles.paymentHeaderRow}>
              <UpcomingPaymentLogo
                name={nextPayment.name}
                logoUrl={nextPaymentLogoUrl}
                fallbackColor={showInsufficientFundsWarning ? shortfallWarningColor : colors.textSecondary}
              />
              <View style={styles.paymentCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {nextPayment.name}
                </Text>
                <Text style={[styles.paymentDateLine, { color: colors.textMuted }]} numberOfLines={1}>
                  {formatUpcomingDate(nextPayment.date)}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmountStrong,
                  { color: showInsufficientFundsWarning ? shortfallWarningColor : colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {formatMoneyDetailed(nextPayment.amount)}
              </Text>
            </View>

            {showInsufficientFundsWarning ? (
              <>
                {insufficientFundsPillLabel.trim().length ? (
                  <View style={styles.paymentAlertAccountStrip}>
                    <AlertAccountPill label={insufficientFundsPillLabel} colors={colors} />
                  </View>
                ) : null}
                <View style={styles.paymentAlertRow}>
                  <Ionicons name="warning" size={13} color={shortfallWarningColor} style={{ marginTop: 2 }} />
                  <Text
                    style={[styles.paymentAlertText, { color: shortfallWarningColor }]}
                    numberOfLines={4}
                    ellipsizeMode="tail"
                  >
                    {paymentAlertLine}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.paymentAlertRow}>
                <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} style={{ marginTop: 2 }} />
                <Text
                  style={[styles.paymentAlertText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {nextPaymentAccountName} · {formatDaysUntilLabel(daysToNextPayment)}
                </Text>
              </View>
            )}
          </View>
        </GlassContainer>
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
                backgroundColor: colors.surfaceSolid,
                borderColor: colors.border,
                maxHeight: balanceSelectorMaxHeight,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.selectorHeader}>
              <View style={styles.selectorTitleBlock}>
                <Text style={[styles.selectorEyebrow, { color: colors.textMuted }]} numberOfLines={1}>
                  Comparaison des soldes
                </Text>
                <Text style={[styles.selectorTitle, { color: colors.text }]} numberOfLines={1}>
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
                  { backgroundColor: colors.surface, borderColor: colors.border },
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
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {account.name}
                      </Text>
                      <Text style={[styles.selectorAccountMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {formatAccountMeta(account)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.selectorAccountAmount,
                        { color: account.balance < 0 ? colors.danger : colors.textSecondary },
                      ]}
                      numberOfLines={1}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ghost.void },
  content: { paddingHorizontal: 24, gap: 26 },
  block: { gap: 12 },
  budgetSummaryOpen: {
    gap: 14,
    paddingHorizontal: 2,
    marginTop: 10,
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
    maxWidth: '45%',
    alignItems: 'flex-end',
    gap: 4,
  },
  balanceCompareAmount: {
    textAlign: 'right',
    fontSize: typography.body,
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
    paddingTop: 0,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    minWidth: 0,
  },
  headerActions: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 8,
  },
  greeting: {
    flex: 1,
    minWidth: 0,
    // Visual-only offset: aligns with the theme switch row without moving dashboard content.
    transform: [{ translateY: 48 }],
    fontSize: typography.screenTitle,
    fontWeight: '700',
    color: ghost.text,
    letterSpacing: -0.35,
    lineHeight: typography.screenTitle + 7,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeQuickToggle: {
    flexShrink: 0,
    borderRadius: 999,
    padding: 3,
  },
  themeSwitchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    justifyContent: 'center',
  },
  themeSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  health: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    fontWeight: '700',
    lineHeight: typography.meta + 4,
    color: 'rgba(245,245,245,0.72)',
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
    color: 'rgba(245,245,245,0.68)',
    lineHeight: typography.micro + 4,
  },
  balanceMint: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '900',
    color: ghost.mint,
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
  },
  metricUnit: {
    fontSize: typography.dashboardGreeting,
    fontWeight: '800',
    color: 'rgba(245,245,245,0.72)',
  },
  balanceWhite: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '800',
    color: ghost.text,
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
    gap: 10,
    overflow: 'visible',
    marginBottom: 6,
    paddingBottom: 6,
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
    color: 'rgba(245,245,245,0.68)',
  },
  forecastAmount: {
    flexShrink: 1,
    maxWidth: '48%',
    textAlign: 'right',
    color: 'rgba(245,245,245,0.76)',
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
    color: 'rgba(245,245,245,0.62)',
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
    backgroundColor: 'rgba(255,255,255,0.14)',
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
    borderTopColor: 'rgba(245,245,245,0.9)',
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
    borderColor: ghost.obsidian,
    zIndex: 2,
  },
  paymentMarker: {
    backgroundColor: 'rgba(255,121,85,0.72)',
  },
  payMarker: {
    backgroundColor: 'rgba(0,250,154,0.9)',
  },
  timelineLegend: {
    gap: 8,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(0,250,154,0.62)',
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
    borderTopColor: 'rgba(245,245,245,0.86)',
  },
  legendIconMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendPayMarker: {
    backgroundColor: 'rgba(0,250,154,0.9)',
  },
  legendLabel: {
    color: 'rgba(245,245,245,0.66)',
    fontSize: typography.micro,
    fontWeight: '700',
  },
  legendLabelRisk: { color: 'rgba(255,214,198,0.82)' },
  legendDotToday: { backgroundColor: 'rgba(245,245,245,0.86)' },
  legendDotPayment: { backgroundColor: 'rgba(255,196,160,0.85)' },
  legendDotPay: { backgroundColor: 'rgba(0,250,154,0.72)' },
  openSection: {
    gap: 16,
  },
  sectionEyebrow: {
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    color: 'rgba(245,245,245,0.62)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: 999 },
  alertText: { fontSize: typography.caption, fontWeight: '600', color: 'rgba(245,245,245,0.78)', marginTop: 4 },
  captionMuted: { flex: 1, fontSize: typography.meta, fontWeight: '700', color: 'rgba(245,245,245,0.68)', lineHeight: typography.meta + 4 },
  paymentPreview: {
    gap: 9,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  rowTitle: { flexShrink: 1, fontSize: typography.body, fontWeight: '700', color: ghost.text, lineHeight: typography.body + 5 },
  paymentDateLine: { fontSize: typography.meta, fontWeight: '700', lineHeight: typography.meta + 4 },
  rowSub: { fontSize: typography.meta, fontWeight: '700', color: 'rgba(245,245,245,0.64)', marginTop: 2 },
  rowAmountStrong: {
    flexShrink: 0,
    maxWidth: '34%',
    textAlign: 'right',
    fontSize: typography.body,
    fontWeight: '700',
    color: ghost.text,
    fontVariant: ['tabular-nums'],
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
    maxWidth: '28%',
    fontSize: typography.caption,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
