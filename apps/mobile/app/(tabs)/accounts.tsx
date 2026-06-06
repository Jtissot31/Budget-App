import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { PageTransition } from '@/components/PageTransition';
import { GlassContainer } from '@/components/GlassContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { DatePickerField } from '@/components/MinimalDatePicker';
import Svg, { Circle, Path } from 'react-native-svg';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { PortfolioChartCard, type NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import {
  FLOATING_SCROLL_ICON_SIZE,
  FLOATING_SCROLL_SIZE,
  floatingGlassButtonPressed,
  floatingGlassScrollSurface,
} from '@/constants/floatingGlassButton';
import {
  SCREEN_TOP_GUTTER,
  darkGhostCardShadow,
  ghost,
  ghostCardShadow,
  lightGhostCardShadow,
} from '@/constants/ghostUi';
import {
  colors,
  FLOATING_NAV_CONTENT_PADDING,
  interBoldText,
  interExtraBoldText,
  portfolioDark,
  portfolioLight,
  PAGE_PADDING_HORIZONTAL,
  PORTFOLIO_SECTION_GAP,
  SECTION_TITLE_STYLE,
  PROGRESS_BAR_TRACK_HEIGHT,
  radius,
  spacing,
  typography,
  type AppColors,
} from '@/constants/theme';
import {
  getCurrentMonthAccountMoneyFlows,
  deleteLoan,
  getLoans,
  getSavingsGoals,
  getSimulatedAccounts,
  getWealthAssets,
  insertSimulatedAccount,
  updateSimulatedAccountPreferences,
  upsertLoan,
  upsertRecurringPayment,
  upsertWealthAsset,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import {
  creditLimitUtilizationBarColor,
  creditUsedFromBalance,
} from '@/lib/creditLimitUtilization';
import { estimateWealthAssetValue } from '@/lib/assetValuation';
import {
  formatCompactCurrency,
  formatCompactGainDollars,
  formatCompactMoneyMagnitude,
} from '@/lib/formatCompactGainDollars';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { rowLabel, rowTitleTextProps, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import { userPickedIconWellStyle } from '@/lib/userPickedIcon';
import {
  getNetWorthChartScope,
  setNetWorthChartScope,
  type NetWorthChartScope,
} from '@/lib/settings';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { AccountMoneyFlow } from '@/lib/accountTransactionFlow';
import type {
  AccountKind,
  Loan,
  LoanDurationUnit,
  LoanPaymentFrequency,
  LoanType,
  SavingsGoal,
  SimulatedAccount,
  WealthAsset,
  WealthAssetType,
  WealthMaterial,
  WealthWeightUnit,
} from '@/types';

type GhostCardShadowStyle = typeof darkGhostCardShadow | typeof lightGhostCardShadow;

const ACCOUNT_TYPES: Array<{
  id: AccountKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'credit', label: 'Crédit', icon: 'card-outline' },
  { id: 'checking', label: 'Compte chèque', icon: 'wallet-outline' },
  { id: 'savings', label: 'Épargne', icon: 'cash-outline' },
];

const INSTITUTION_LOGO_OPTIONS = [
  { id: 'desjardins', label: 'Desjardins', institution: 'Desjardins' },
  { id: 'rbc', label: 'RBC', institution: 'RBC' },
  { id: 'td', label: 'TD', institution: 'TD' },
  { id: 'bmo', label: 'BMO', institution: 'BMO' },
  { id: 'scotiabank', label: 'Scotiabank', institution: 'Scotiabank' },
  { id: 'cibc', label: 'CIBC', institution: 'CIBC' },
  { id: 'banque-nationale', label: 'Banque Nationale', institution: 'Banque Nationale' },
  { id: 'tangerine', label: 'Tangerine', institution: 'Tangerine' },
  { id: 'wealthsimple', label: 'Wealthsimple', institution: 'Wealthsimple' },
  { id: 'koho', label: 'KOHO', institution: 'KOHO' },
  { id: 'neo-financial', label: 'Neo', institution: 'Neo Financial' },
  { id: 'eq-bank', label: 'EQ Bank', institution: 'EQ Bank' },
  { id: 'simplii', label: 'Simplii', institution: 'Simplii' },
  { id: 'pc-financial', label: 'PC Financial', institution: 'PC Financial' },
  { id: 'visa', label: 'Visa', institution: 'Visa' },
  { id: 'mastercard', label: 'Mastercard', institution: 'Mastercard' },
  { id: 'amex', label: 'Amex', institution: 'American Express' },
].map((option) => ({
  ...option,
  logoUrl: getAccountLogoUrl(option.institution),
}));

const WEALTH_ASSET_TYPES: Array<{ id: WealthAssetType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'precious_material', label: 'Matériau précieux', icon: 'diamond-outline' },
  { id: 'real_estate', label: 'Bien immobilier', icon: 'home-outline' },
];

const WEALTH_MATERIAL_OPTIONS: Array<{ id: WealthMaterial; label: string; unit: WealthWeightUnit }> = [
  { id: 'gold', label: 'Or', unit: 'g' },
  { id: 'silver', label: 'Argent', unit: 'g' },
  { id: 'platinum', label: 'Platine', unit: 'g' },
  { id: 'diamond', label: 'Diamant', unit: 'ct' },
];

const WEIGHT_UNIT_OPTIONS: Array<{ id: WealthWeightUnit; label: string }> = [
  { id: 'g', label: 'g' },
  { id: 'oz', label: 'oz troy' },
  { id: 'ct', label: 'carat' },
];

const LOAN_TYPE_OPTIONS: Array<{ id: LoanType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'friend_debt', label: 'Dette à un ami', icon: 'people-outline' },
  { id: 'personal_loan', label: 'Prêt personnel', icon: 'cash-outline' },
  { id: 'line_of_credit', label: 'Marge de crédit', icon: 'card-outline' },
];

const LOAN_DURATION_UNITS: Array<{ id: LoanDurationUnit; label: string }> = [
  { id: 'months', label: 'Mois' },
  { id: 'years', label: 'Années' },
];

const LOAN_PAYMENT_FREQUENCIES: Array<{ id: LoanPaymentFrequency; label: string }> = [
  { id: 'weekly', label: 'Hebdo' },
  { id: 'biweekly', label: 'Aux 2 semaines' },
  { id: 'monthly', label: 'Mensuel' },
];

/** Shared card/lower-section heights keep account cards visually equal. */
const ACCOUNT_VISUAL_CARD_MIN_HEIGHT = 176;
const ACCOUNT_VISUAL_LOWER_SECTION_MIN_HEIGHT = 88;
const ACCOUNT_VISUAL_PROGRESS_GROUP_GAP = 6;
const ACCOUNT_VISUAL_PROGRESS_DETAIL_ROW_MIN_HEIGHT = 22;
const ACCOUNT_CREDIT_PROGRESS_SECTION_HEIGHT = 44;

const FLOATING_ACTION_THUMB_RAISE = FLOATING_SCROLL_SIZE;
const FLOATING_ACTION_CLEARANCE = 136 + FLOATING_ACTION_THUMB_RAISE;

/** Portfolio scroll tail below Patrimoine: tab reserve + FAB breathing room (~legacy `FLOATING_ACTION_CLEARANCE`).
 * Compressed ~½ for short lists; grows with extra assets, capped toward legacy clearance for long lists. */
const PORTFOLIO_LEGACY_FAB_CLEARANCE = FLOATING_ACTION_CLEARANCE;
const PORTFOLIO_FAB_CLEARANCE_BASE = Math.round(PORTFOLIO_LEGACY_FAB_CLEARANCE / 2);
/** Max regain toward legacy FAB clearance via `portfolioScrollBottomPadding(...)` (+ per-asset increments). */
const PORTFOLIO_FAB_CLEARANCE_EXTRA_CAP = PORTFOLIO_LEGACY_FAB_CLEARANCE - PORTFOLIO_FAB_CLEARANCE_BASE;
const PORTFOLIO_FAB_CLEARANCE_PER_EXTRA_ASSET = 10;

function portfolioScrollBottomPadding(insetsBottom: number, wealthAssetCount: number) {
  const extraAssets = Math.max(0, wealthAssetCount - 1);
  const dynamicFabClearance =
    PORTFOLIO_FAB_CLEARANCE_BASE +
    Math.min(extraAssets * PORTFOLIO_FAB_CLEARANCE_PER_EXTRA_ASSET, PORTFOLIO_FAB_CLEARANCE_EXTRA_CAP);
  return (
    insetsBottom + FLOATING_NAV_CONTENT_PADDING + dynamicFabClearance
  );
}
const NET_WORTH_TREND_MOVEMENTS = [-0.5, 0.25, -0.6, 0.7];
const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const LIGHT_SECTION_SURFACE = '#F6F8FA';
const LIGHT_SECTION_CARD_SURFACE = '#FFFFFF';
const LIGHT_SECTION_SOFT_SURFACE = '#F6F8FA';
const LIGHT_SECTION_BORDER = '#D0D7DE';
const PORTFOLIO_PAGE_PADDING = PAGE_PADDING_HORIZONTAL;
/** Espacement vertical entre blocs majeurs (chart → comptes → patrimoine / prêts). */
const PORTFOLIO_BLOCK_GAP = spacing.xl;
const PORTFOLIO_BLOCK_BREAK = spacing.xxl + spacing.lg;
const CHART_RED = '#F85149';
const LIGHT_PORTFOLIO_TEXT = portfolioLight.text;
const DELTA_MINT = '#00E676';
const LIGHT_DELTA_MINT = portfolioLight.chartCurve;
const LIGHT_CHART_RED = '#CF222E';
const DELTA_MINT_BG = 'rgba(0, 230, 118, 0.15)';
const DELTA_MINT_BORDER = 'rgba(0, 230, 118, 0.28)';
const LIGHT_DELTA_MINT_BG = portfolioLight.deltaBg;
const LIGHT_DELTA_MINT_BORDER = portfolioLight.deltaBorder;
const LIGHT_TREND_RED_BG = 'rgba(207, 34, 46, 0.1)';

type PortfolioScrollTarget = 'balances' | 'wealth';
type PortfolioScrollStage = 'top' | PortfolioScrollTarget;
type PortfolioSectionMetrics = Record<PortfolioScrollTarget, { y: number; height: number }>;
/** Top alignment keeps section titles below the status bar; scroll Y subtracts safe-area top (see `getPortfolioScrollOffset`). */
type PortfolioScrollOffsetMode = 'center' | 'top';

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

/** Actif : pas de « + » ; négatif seulement avec « − ». */
function formatPortfolioAsset(value: number) {
  if (value < 0) return `−${formatDisplayMoneyAbsolute(Math.abs(value))}`;
  return formatDisplayMoneyAbsolute(value);
}

/** Dette ou sortie d'argent : toujours préfixé « − » (sauf zéro). */
function formatPortfolioOutflow(value: number) {
  const abs = Math.abs(value);
  if (abs === 0) return formatDisplayMoneyAbsolute(0);
  return `−${formatDisplayMoneyAbsolute(abs)}`;
}

/** Entrée d'argent : préfixe « + » si > 0. */
function formatPortfolioInflow(value: number) {
  return formatSignedDisplayMoney(Math.abs(value), { leadingPlusWhenPositive: true });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInMonth));
  next.setHours(0, 0, 0, 0);
  return next;
}

function computeLoanEndDate(startDate: string, durationAmount: string, durationUnit: LoanDurationUnit) {
  const start = parseDateKey(startDate);
  const amount = Number.parseInt(durationAmount, 10);
  if (!start || !Number.isFinite(amount) || amount <= 0) return '';

  return formatDateKey(addMonthsClamped(start, durationUnit === 'years' ? amount * 12 : amount));
}

function formatSignedMoney(value: number) {
  return formatCompactCurrency(value);
}

function formatMonthlyNetWorthDelta(value: number) {
  return `${formatCompactGainDollars(value, { leadingPlusWhenPositive: true })} ce mois-ci`;
}

function NetWorthDeltaBadge({ delta }: { delta: number }) {
  const { colors, isLight } = useAppTheme();
  const deltaPositive = delta >= 0;
  const deltaTextColor = deltaPositive ? (isLight ? LIGHT_DELTA_MINT : DELTA_MINT) : isLight ? LIGHT_CHART_RED : CHART_RED;
  const deltaBadgeBackground = deltaPositive
    ? isLight
      ? LIGHT_DELTA_MINT_BG
      : DELTA_MINT_BG
    : isLight
      ? LIGHT_TREND_RED_BG
      : colors.dangerMuted;
  const deltaBadgeBorder = deltaPositive
    ? isLight
      ? LIGHT_DELTA_MINT_BORDER
      : DELTA_MINT_BORDER
    : isLight
      ? 'rgba(185, 28, 28, 0.24)'
      : colors.danger;

  return (
    <View
      style={[
        styles.deltaBadge,
        {
          backgroundColor: deltaBadgeBackground,
          borderColor: deltaBadgeBorder,
        },
      ]}
    >
      <Text style={[styles.deltaBadgeText, { color: deltaTextColor }]}>
        {deltaPositive ? '↗ ' : '↘ '}
        {formatMonthlyNetWorthDelta(delta)}
      </Text>
    </View>
  );
}
function PortfolioHeaderRow() {
  const { isLight } = useAppTheme();
  const titleColor = isLight ? LIGHT_PORTFOLIO_TEXT : portfolioDark.text;
  const iconBg = isLight ? portfolioLight.iconButton : portfolioDark.iconButton;
  const iconBorder = isLight ? portfolioLight.border : portfolioDark.border;
  const iconColor = isLight ? LIGHT_PORTFOLIO_TEXT : portfolioDark.text;

  return (
    <View style={styles.portfolioHeaderRow}>
      <Text style={[styles.pageTitle, styles.pageTitleInHeader, { color: titleColor }]}>Portefeuille</Text>
      <View style={styles.portfolioHeaderActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rechercher"
          onPress={() => tapHaptic()}
          style={[styles.portfolioHeaderIconButton, { backgroundColor: iconBg, borderColor: iconBorder }]}
        >
          <Ionicons name="search-outline" size={20} color={iconColor} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Statistiques"
          onPress={() => tapHaptic()}
          style={[styles.portfolioHeaderIconButton, { backgroundColor: iconBg, borderColor: iconBorder }]}
        >
          <Ionicons name="bar-chart-outline" size={20} color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

export default function AccountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editWealthAssetId?: string }>();
  const editWealthAssetId =
    typeof params.editWealthAssetId === 'string' ? params.editWealthAssetId.trim() : '';
  const insets = useSafeAreaInsets();
  const { colors, ghost, ghostCardShadow, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  /** Skip one scroll-to-top after closing `wealth-asset-detail` (stack) opened from this tab. */
  const skipPortfolioScrollToTopOnceRef = useRef(false);
  const portfolioViewportHeightRef = useRef(0);
  const portfolioContentHeightRef = useRef(0);
  const portfolioProgrammaticScrollStageRef = useRef<PortfolioScrollStage | null>(null);
  const portfolioProgrammaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portfolioSectionMetricsRef = useRef<PortfolioSectionMetrics>({
    balances: { y: 0, height: 0 },
    wealth: { y: 0, height: 0 },
  });
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [accountMonthlyFlows, setAccountMonthlyFlows] = useState<Record<string, AccountMoneyFlow>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SimulatedAccount | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('checking');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [selectedInstitutionLogoId, setSelectedInstitutionLogoId] = useState<string | null>(null);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [portfolioScrollStage, setPortfolioScrollStage] = useState<PortfolioScrollStage>('top');
  const [hasPortfolioScrolledDown, setHasPortfolioScrolledDown] = useState(false);
  const [wealthAssets, setWealthAssets] = useState<WealthAsset[]>([]);
  const [showWealthForm, setShowWealthForm] = useState(false);
  const [isSavingWealth, setIsSavingWealth] = useState(false);
  const [wealthType, setWealthType] = useState<WealthAssetType>('precious_material');
  const [wealthName, setWealthName] = useState('');
  const [wealthMaterial, setWealthMaterial] = useState<WealthMaterial>('gold');
  const [wealthWeight, setWealthWeight] = useState('');
  const [wealthWeightUnit, setWealthWeightUnit] = useState<WealthWeightUnit>('g');
  const [wealthKarats, setWealthKarats] = useState('24');
  const [wealthPurity, setWealthPurity] = useState('');
  const [wealthPurchaseCost, setWealthPurchaseCost] = useState('');
  const [wealthPurchaseDate, setWealthPurchaseDate] = useState('');
  const [wealthCurrentValue, setWealthCurrentValue] = useState('');
  const [wealthPropertyType, setWealthPropertyType] = useState('');
  const [wealthAddress, setWealthAddress] = useState('');
  const [wealthNotes, setWealthNotes] = useState('');
  const [wealthEditingAsset, setWealthEditingAsset] = useState<WealthAsset | null>(null);
  const [netWorthChartScope, setNetWorthChartScopeState] = useState<NetWorthChartScope>('inclusive');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [loanType, setLoanType] = useState<LoanType>('personal_loan');
  const [loanName, setLoanName] = useState('');
  const [loanLender, setLoanLender] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanBalance, setLoanBalance] = useState('');
  const [loanRate, setLoanRate] = useState('');
  const [loanMonthlyPayment, setLoanMonthlyPayment] = useState('');
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanDurationAmount, setLoanDurationAmount] = useState('12');
  const [loanDurationUnit, setLoanDurationUnit] = useState<LoanDurationUnit>('months');
  const [loanPaymentFrequency, setLoanPaymentFrequency] = useState<LoanPaymentFrequency>('monthly');
  const [loanPaymentAccountId, setLoanPaymentAccountId] = useState('');
  const [loanNextPaymentDate, setLoanNextPaymentDate] = useState('');
  const [confirmLoanDeleteVisible, setConfirmLoanDeleteVisible] = useState(false);
  const [pendingLoanDeleteId, setPendingLoanDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextAccounts, nextSavingsGoals, nextWealthAssets, flows, nextLoans] = await Promise.all([
      getSimulatedAccounts(),
      getSavingsGoals(),
      getWealthAssets(),
      getCurrentMonthAccountMoneyFlows(),
      getLoans(),
    ]);
    setAccounts(nextAccounts);
    setSavingsGoals(nextSavingsGoals);
    setWealthAssets(nextWealthAssets);
    setAccountMonthlyFlows(flows);
    setLoans(nextLoans);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useEffect(() => {
    void getNetWorthChartScope().then(setNetWorthChartScopeState);
  }, []);

  const handleNetWorthChartScopeChange = useCallback((scope: NetWorthChartScope) => {
    setNetWorthChartScopeState(scope);
    void setNetWorthChartScope(scope);
    clearPortfolioProgrammaticScroll();
    portfolioProgrammaticScrollStageRef.current = null;
    setPortfolioScrollState('top');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const populateWealthFromAsset = useCallback((asset: WealthAsset) => {
    setWealthEditingAsset(asset);
    setWealthType(asset.type);
    setWealthName(asset.name);
    if (asset.type === 'precious_material') {
      if (asset.material) setWealthMaterial(asset.material);
      setWealthWeightUnit(asset.weightUnit ?? 'g');
      setWealthWeight(typeof asset.weight === 'number' ? String(asset.weight) : '');
      setWealthKarats(asset.material === 'gold' && typeof asset.karats === 'number' ? String(asset.karats) : asset.material === 'gold' ? '24' : '');
      setWealthPurity(
        asset.material && asset.material !== 'gold' && asset.material !== 'diamond' && typeof asset.purity === 'number'
          ? String(asset.purity)
          : '',
      );
      setWealthCurrentValue('');
    } else {
      setWealthPropertyType(asset.propertyType ?? '');
      setWealthAddress(asset.address ?? '');
      setWealthCurrentValue(typeof asset.currentValue === 'number' ? String(asset.currentValue) : '');
      setWealthWeight('');
      setWealthKarats('24');
      setWealthPurity('');
      setWealthWeightUnit('g');
    }
    setWealthPurchaseCost(String(asset.purchaseCost ?? ''));
    setWealthPurchaseDate(asset.purchaseDate?.trim() ?? '');
    setWealthNotes(asset.notes ?? '');
    setIsSavingWealth(false);
  }, []);

  useEffect(() => {
    if (!editWealthAssetId || wealthAssets.length === 0 || showWealthForm) return;
    const match = wealthAssets.find((asset) => asset.id === editWealthAssetId);
    if (!match) return;

    populateWealthFromAsset(match);
    setShowWealthForm(true);
  }, [editWealthAssetId, populateWealthFromAsset, showWealthForm, wealthAssets]);

  useRefreshOnFocus(load);
  useScrollToTopOnFocus(
    useCallback(() => {
      if (portfolioProgrammaticScrollTimeoutRef.current) {
        clearTimeout(portfolioProgrammaticScrollTimeoutRef.current);
        portfolioProgrammaticScrollTimeoutRef.current = null;
      }
      portfolioProgrammaticScrollStageRef.current = null;
      setPortfolioScrollStage('top');
      setHasPortfolioScrolledDown(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
    skipPortfolioScrollToTopOnceRef,
  );

  useEffect(() => {
    return () => {
      if (portfolioProgrammaticScrollTimeoutRef.current) {
        clearTimeout(portfolioProgrammaticScrollTimeoutRef.current);
      }
    };
  }, []);

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
  const orderedAccounts = useMemo(() => sortAccountsForDisplay(accounts), [accounts]);
  const visibleAccounts = useMemo(() => orderedAccounts.filter((account) => !account.hidden), [orderedAccounts]);
  const offAccountAssetsBalance = useMemo(
    () => wealthAssets.reduce((sum, asset) => sum + Math.max(asset.currentValue, 0), 0),
    [wealthAssets],
  );
  const loansTotalBalance = useMemo(
    () => loans.reduce((sum, loan) => sum + Math.max(loan.balanceRemaining, 0), 0),
    [loans],
  );
  const chartScopeBreakdown = useMemo(
    () =>
      computeNetWorthBreakdown(
        netWorthChartScope,
        accounts,
        offAccountAssetsBalance,
        loansTotalBalance,
      ),
    [netWorthChartScope, accounts, offAccountAssetsBalance, loansTotalBalance],
  );
  const totalNetWorth = totalBalance + offAccountAssetsBalance;
  const chartNetWorthTotal = netWorthChartScope === 'inclusive' ? totalNetWorth : totalBalance;
  const netWorthTrend = useMemo(
    () => buildNetWorthTrend(netWorthChartScope, chartNetWorthTotal, accounts, offAccountAssetsBalance),
    [netWorthChartScope, chartNetWorthTotal, accounts, offAccountAssetsBalance],
  );
  const netWorthDelta = useMemo(() => {
    const values = netWorthTrend.map((point) => point.value);
    const previousMonthValue = values[Math.max(values.length - 2, 0)] ?? 0;
    return values[values.length - 1] - previousMonthValue;
  }, [netWorthTrend]);
  const logoSourceName = institution.trim() || name.trim();
  const selectedInstitutionLogo = useMemo(
    () => INSTITUTION_LOGO_OPTIONS.find((option) => option.id === selectedInstitutionLogoId) ?? null,
    [selectedInstitutionLogoId],
  );
  const autoPreviewLogo = useMemo(() => getAccountLogoUrl(logoSourceName), [logoSourceName]);
  const previewLogo = selectedInstitutionLogo?.logoUrl ?? autoPreviewLogo;
  const computedLoanEndDate = useMemo(
    () => computeLoanEndDate(loanStartDate, loanDurationAmount, loanDurationUnit),
    [loanDurationAmount, loanDurationUnit, loanStartDate],
  );
  const selectedLoanPaymentAccount = useMemo(
    () => accounts.find((account) => account.id === loanPaymentAccountId) ?? null,
    [accounts, loanPaymentAccountId],
  );
  const loanThemed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: { backgroundColor: colors.surfaceSolid, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth },
      control: { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong },
      selected: { backgroundColor: colors.text, borderColor: colors.text },
      selectedText: { color: ghost.void },
      text: { color: colors.text },
      textSecondary: { color: colors.textSecondary },
      textMuted: { color: colors.textMuted },
      submit: { backgroundColor: colors.text },
      submitText: { color: ghost.void },
    }),
    [colors, ghost, isLight],
  );
  const resetForm = () => {
    setEditingAccount(null);
    setName('');
    setKind('checking');
    setBalance('');
    setInstitution('');
    setCreditLimit('');
    setDueDay('');
    setInterestRate('');
    setSelectedInstitutionLogoId(null);
    setShowLogoPicker(false);
  };

  const openNewAccountForm = () => {
    tapHaptic();
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  const openAccountDetail = (account: SimulatedAccount) => {
    tapHaptic();
    router.push({ pathname: '/account-detail', params: { accountId: account.id } });
  };

  const openAccountManager = () => {
    tapHaptic();
    setShowAccountManager(true);
  };

  const closeAccountManager = () => {
    setShowAccountManager(false);
  };

  const persistAccountDisplayPreferences = async (nextAccounts: SimulatedAccount[]) => {
    setAccounts(nextAccounts);
    await Promise.all(
      nextAccounts.map((account) =>
        updateSimulatedAccountPreferences(account.id, {
          hidden: account.hidden,
          displayOrder: account.displayOrder,
        }),
      ),
    );
  };

  const toggleAccountVisibility = async (accountId: string) => {
    const nextAccounts = orderedAccounts.map((account, index) => ({
      ...account,
      displayOrder: account.displayOrder ?? index,
      hidden: account.id === accountId ? !account.hidden : account.hidden,
    }));
    await persistAccountDisplayPreferences(nextAccounts);
  };

  const moveAccount = async (accountId: string, direction: -1 | 1) => {
    const index = orderedAccounts.findIndex((account) => account.id === accountId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedAccounts.length) return;

    const nextAccounts = [...orderedAccounts];
    [nextAccounts[index], nextAccounts[targetIndex]] = [nextAccounts[targetIndex], nextAccounts[index]];
    await persistAccountDisplayPreferences(
      nextAccounts.map((account, order) => ({
        ...account,
        displayOrder: order,
      })),
    );
  };

  const handlePortfolioViewportLayout = (event: LayoutChangeEvent) => {
    portfolioViewportHeightRef.current = event.nativeEvent.layout.height;
  };

  const handlePortfolioContentSizeChange = (_width: number, height: number) => {
    portfolioContentHeightRef.current = height;
  };

  const handlePortfolioSectionLayout = (target: PortfolioScrollTarget, event: LayoutChangeEvent) => {
    const { height, y } = event.nativeEvent.layout;
    portfolioSectionMetricsRef.current[target] = { y, height };
  };

  const getPortfolioScrollOffset = (target: PortfolioScrollTarget, mode: PortfolioScrollOffsetMode = 'center') => {
    const section = portfolioSectionMetricsRef.current[target];
    const viewportHeight = portfolioViewportHeightRef.current;
    const contentHeight = portfolioContentHeightRef.current;
    // Sections are direct children of the scroll-content container, so onLayout `y` is already
    // the absolute scroll offset.
    const sectionY = section.y;
    // Fall back to a reasonable section height when onLayout hasn't fired yet (e.g. first tap
    // before AccountBalanceChart has measured), so the center formula stays sensible.
    const sectionHeight = section.height > 0 ? section.height : 300;
    // ScrollView aligns `y` with the raw viewport top (under the Android status bar). Offset by safe area +
    // a small gutter so Patrimoine isn’t clipped; same value drives FAB stage threshold via `handleScroll`.
    const rawOffset =
      mode === 'top'
        ? sectionY - insets.top - spacing.sm
        : sectionY - (viewportHeight - sectionHeight) / 2;
    const maxOffset = viewportHeight > 0 && contentHeight > 0 ? Math.max(contentHeight - viewportHeight, 0) : undefined;
    const clampedOffset = Math.max(rawOffset, 0);

    return typeof maxOffset === 'number' ? Math.min(clampedOffset, maxOffset) : clampedOffset;
  };

  const setPortfolioScrollState = (stage: PortfolioScrollStage) => {
    setPortfolioScrollStage(stage);
    setHasPortfolioScrolledDown(stage !== 'top');
  };

  const clearPortfolioProgrammaticScroll = () => {
    if (portfolioProgrammaticScrollTimeoutRef.current) {
      clearTimeout(portfolioProgrammaticScrollTimeoutRef.current);
      portfolioProgrammaticScrollTimeoutRef.current = null;
    }
  };

  const finishPortfolioProgrammaticScroll = () => {
    const targetStage = portfolioProgrammaticScrollStageRef.current;
    clearPortfolioProgrammaticScroll();
    portfolioProgrammaticScrollStageRef.current = null;

    if (targetStage) {
      setPortfolioScrollState(targetStage);
    }
  };

  const beginPortfolioProgrammaticScroll = (targetStage: PortfolioScrollStage) => {
    portfolioProgrammaticScrollStageRef.current = targetStage;
    setPortfolioScrollState(targetStage);
    clearPortfolioProgrammaticScroll();
    portfolioProgrammaticScrollTimeoutRef.current = setTimeout(finishPortfolioProgrammaticScroll, 900);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (portfolioProgrammaticScrollStageRef.current) {
      return;
    }

    const offsetY = event.nativeEvent.contentOffset.y;

    if (offsetY <= spacing.xs) {
      setPortfolioScrollState('top');
      return;
    }

    if (netWorthChartScope === 'inclusive') {
      const wealthOffset = getPortfolioScrollOffset('wealth', 'top');
      const wealthThreshold = Math.max(wealthOffset * 0.35, spacing.lg);
      setPortfolioScrollState(offsetY >= wealthThreshold ? 'wealth' : 'top');
      return;
    }

    const balancesOffset = getPortfolioScrollOffset('balances', 'top');
    const balancesThreshold = Math.max(balancesOffset * 0.35, spacing.lg);
    setPortfolioScrollState(offsetY >= balancesThreshold ? 'balances' : 'top');
  };

  const scrollToPortfolioTop = () => {
    tapHaptic();
    beginPortfolioProgrammaticScroll('top');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const scrollToPortfolioSection = (target: PortfolioScrollTarget) => {
    tapHaptic();
    beginPortfolioProgrammaticScroll(target);
    scrollRef.current?.scrollTo({
      y: getPortfolioScrollOffset(target, 'top'),
      animated: true,
    });
  };

  const nextPortfolioScrollTarget: PortfolioScrollTarget | null =
    netWorthChartScope === 'inclusive'
      ? portfolioScrollStage === 'top'
        ? 'wealth'
        : null
      : portfolioScrollStage === 'top'
        ? 'balances'
        : null;

  const saveAccount = async () => {
    const parsedBalance = parseMoney(balance);
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Exemple : Visa Desjardins, Tangerine chèque.');
      return;
    }
    if (Number.isNaN(parsedBalance)) {
      Alert.alert('Solde invalide', 'Entre un montant valide.');
      return;
    }

    const account: SimulatedAccount = {
      id: editingAccount?.id ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      kind,
      balance: kind === 'credit' ? -Math.abs(parsedBalance) : parsedBalance,
      institution: selectedInstitutionLogo?.institution ?? (institution.trim() || undefined),
      last4: editingAccount?.last4,
      creditLimit: kind === 'credit' ? parseOptionalMoney(creditLimit) : undefined,
      dueDay: kind === 'credit' ? parseOptionalInt(dueDay) : undefined,
      interestRate: kind !== 'checking' ? parseOptionalMoney(interestRate) : undefined,
      logoUrl: selectedInstitutionLogo?.logoUrl ?? getAccountLogoUrl(logoSourceName) ?? undefined,
      linkedSavingsGoalId: editingAccount?.linkedSavingsGoalId ?? null,
      hidden: editingAccount?.hidden ?? false,
      displayOrder: editingAccount?.displayOrder ?? accounts.length,
      createdAt: editingAccount?.createdAt ?? new Date().toISOString(),
    };

    await insertSimulatedAccount(account);
    successHaptic();
    closeForm();
    await load();
  };

  const resetWealthForm = () => {
    setWealthEditingAsset(null);
    setWealthType('precious_material');
    setWealthName('');
    setWealthMaterial('gold');
    setWealthWeight('');
    setWealthWeightUnit('g');
    setWealthKarats('24');
    setWealthPurity('');
    setWealthPurchaseCost('');
    setWealthPurchaseDate('');
    setWealthCurrentValue('');
    setWealthPropertyType('');
    setWealthAddress('');
    setWealthNotes('');
    setIsSavingWealth(false);
  };

  const clearWealthEditRouteParam = () => {
    if (!editWealthAssetId) return;
    router.setParams({ editWealthAssetId: undefined });
  };

  const openNewWealthForm = () => {
    tapHaptic();
    clearWealthEditRouteParam();
    resetWealthForm();
    setShowWealthForm(true);
  };

  const closeWealthForm = () => {
    clearWealthEditRouteParam();
    resetWealthForm();
    setShowWealthForm(false);
  };

  const saveWealthAsset = async () => {
    const purchaseCost = parseMoney(wealthPurchaseCost);
    const weight = parseMoney(wealthWeight);
    const manualCurrentValue = parseOptionalMoney(wealthCurrentValue);

    if (Number.isNaN(purchaseCost) || purchaseCost < 0) {
      Alert.alert('Coût requis', 'Entre le coût à l’achat du patrimoine.');
      return;
    }

    if (wealthType === 'precious_material' && (Number.isNaN(weight) || weight <= 0)) {
      Alert.alert('Poids requis', 'Entre le poids pour calculer la valeur actuelle.');
      return;
    }

    if (wealthType === 'real_estate' && typeof manualCurrentValue !== 'number') {
      Alert.alert('Valeur actuelle requise', 'Entre une estimation actuelle pour le bien immobilier.');
      return;
    }

    setIsSavingWealth(true);
    try {
      const valuation = await estimateWealthAssetValue({
        type: wealthType,
        material: wealthType === 'precious_material' ? wealthMaterial : null,
        weight: wealthType === 'precious_material' ? weight : null,
        weightUnit: wealthType === 'precious_material' ? wealthWeightUnit : null,
        karats: wealthMaterial === 'gold' ? parseOptionalMoney(wealthKarats) : null,
        purity: wealthMaterial !== 'gold' && wealthMaterial !== 'diamond' ? parseOptionalMoney(wealthPurity) : null,
        purchaseCost,
        currentValue: manualCurrentValue ?? purchaseCost,
      });

      const asset: WealthAsset = {
        id: wealthEditingAsset?.id ?? `wealth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: wealthType,
        name: wealthName.trim() || defaultWealthName(wealthType, wealthMaterial, wealthPropertyType),
        material: wealthType === 'precious_material' ? wealthMaterial : null,
        weight: wealthType === 'precious_material' ? weight : null,
        weightUnit: wealthType === 'precious_material' ? wealthWeightUnit : null,
        karats: wealthType === 'precious_material' && wealthMaterial === 'gold' ? parseOptionalMoney(wealthKarats) : null,
        purity:
          wealthType === 'precious_material' && wealthMaterial !== 'gold' && wealthMaterial !== 'diamond'
            ? parseOptionalMoney(wealthPurity)
            : null,
        purchaseCost,
        purchaseDate: wealthPurchaseDate.trim() || null,
        currentValue: valuation.currentValue,
        lastValuationAt: valuation.lastValuationAt ?? wealthEditingAsset?.lastValuationAt ?? null,
        valuationSource: valuation.source,
        propertyType: wealthType === 'real_estate' ? wealthPropertyType.trim() || null : null,
        address: wealthType === 'real_estate' ? wealthAddress.trim() || null : null,
        notes: (valuation.note ?? wealthNotes.trim()) || null,
        createdAt: wealthEditingAsset?.createdAt ?? new Date().toISOString(),
      };

      await upsertWealthAsset(asset);
      successHaptic();
      closeWealthForm();
      await load();
    } finally {
      setIsSavingWealth(false);
    }
  };

  const resetLoanForm = () => {
    const today = formatDateKey(new Date());
    setEditingLoan(null);
    setLoanType('personal_loan');
    setLoanName('');
    setLoanLender('');
    setLoanPrincipal('');
    setLoanBalance('');
    setLoanRate('');
    setLoanMonthlyPayment('');
    setLoanStartDate(today);
    setLoanDurationAmount('12');
    setLoanDurationUnit('months');
    setLoanPaymentFrequency('monthly');
    setLoanPaymentAccountId(accounts[0]?.id ?? '');
    setLoanNextPaymentDate(today);
  };

  const openNewLoanForm = () => {
    tapHaptic();
    resetLoanForm();
    setShowLoanForm(true);
  };

  const openEditLoanForm = (loan: Loan) => {
    tapHaptic();
    const today = formatDateKey(new Date());
    setEditingLoan(loan);
    setLoanType(loan.type ?? 'personal_loan');
    setLoanName(loan.name);
    setLoanLender(loan.lender);
    setLoanPrincipal(String(loan.principal));
    setLoanBalance(String(loan.balanceRemaining));
    setLoanRate(String(loan.interestRate));
    setLoanMonthlyPayment(String(loan.monthlyPayment));
    setLoanStartDate(loan.startDate || today);
    setLoanDurationAmount(String(loan.durationAmount || 12));
    setLoanDurationUnit(loan.durationUnit ?? 'months');
    setLoanPaymentFrequency(loan.paymentFrequency ?? 'monthly');
    setLoanPaymentAccountId(loan.paymentAccountId || accounts[0]?.id || '');
    setLoanNextPaymentDate(loan.nextPaymentDate || today);
    setShowLoanForm(true);
  };

  const closeLoanForm = () => {
    resetLoanForm();
    setShowLoanForm(false);
  };

  const saveLoan = async () => {
    const principal = parseMoney(loanPrincipal);
    const balanceRemaining = parseMoney(loanBalance);
    const interestRate = loanType === 'friend_debt' ? 0 : parseMoney(loanRate);
    const monthlyPayment = parseMoney(loanMonthlyPayment);
    const durationAmount = Number.parseInt(loanDurationAmount, 10);
    const paymentAccount = selectedLoanPaymentAccount;
    const endDate = computedLoanEndDate;

    if (!loanLender.trim()) {
      Alert.alert('Prêteur requis', 'Indique le nom de la personne, de la banque ou du prêteur.');
      return;
    }
    if (Number.isNaN(principal) || principal < 0) {
      Alert.alert('Montant initial invalide', 'Entre le montant original du prêt.');
      return;
    }
    if (Number.isNaN(balanceRemaining) || balanceRemaining < 0) {
      Alert.alert('Solde restant invalide', 'Entre le solde restant à rembourser.');
      return;
    }
    if (Number.isNaN(interestRate) || interestRate < 0) {
      Alert.alert('Taux invalide', 'Entre le taux d\'intérêt en %.');
      return;
    }
    if (Number.isNaN(monthlyPayment) || monthlyPayment <= 0) {
      Alert.alert('Paiement invalide', 'Entre le montant de chaque paiement.');
      return;
    }
    if (!loanStartDate.trim()) {
      Alert.alert('Date de début requise', 'Choisis la date de début du prêt ou de la dette.');
      return;
    }
    if (!Number.isFinite(durationAmount) || durationAmount <= 0) {
      Alert.alert('Durée invalide', 'Entre une durée positive en mois ou en années.');
      return;
    }
    if (!endDate) {
      Alert.alert('Date de fin invalide', 'La date de fin calculée est invalide.');
      return;
    }
    if (!paymentAccount) {
      Alert.alert('Compte requis', 'Choisis le compte qui fera les paiements.');
      return;
    }
    if (!loanNextPaymentDate.trim()) {
      Alert.alert('Prochain paiement requis', 'Choisis la date du prochain paiement.');
      return;
    }
    if (loanNextPaymentDate.trim() > endDate) {
      Alert.alert('Date invalide', 'Le prochain paiement doit arriver avant la fin calculée.');
      return;
    }

    const loanId = editingLoan?.id ?? `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recurringPaymentId = editingLoan?.recurringPaymentId ?? `${loanId}-payment`;
    const loanNameValue = loanName.trim() || loanLender.trim();
    const loan: Loan = {
      id: loanId,
      type: loanType,
      name: loanNameValue,
      lender: loanLender.trim(),
      principal,
      balanceRemaining,
      interestRate,
      monthlyPayment,
      startDate: loanStartDate.trim(),
      endDate,
      durationAmount,
      durationUnit: loanDurationUnit,
      paymentFrequency: loanPaymentFrequency,
      paymentAccountId: paymentAccount.id,
      nextPaymentDate: loanNextPaymentDate.trim(),
      recurringPaymentId,
      createdAt: editingLoan?.createdAt ?? new Date().toISOString(),
    };

    await upsertLoan(loan);
    await upsertRecurringPayment({
      id: recurringPaymentId,
      name: `${loanNameValue} - ${loan.lender}`,
      amount: monthlyPayment,
      kind: 'payment',
      accountId: paymentAccount.id,
      accountLabel: paymentAccount.last4 ? `${paymentAccount.name} • ${paymentAccount.last4}` : paymentAccount.name,
      categoryId: null,
      frequency: loanPaymentFrequency,
      dueDay: null,
      nextDate: loanNextPaymentDate.trim(),
      endDate,
      active: true,
      icon: loanType === 'friend_debt' ? 'people-outline' : loanType === 'line_of_credit' ? 'card-outline' : 'cash-outline',
      color: colors.danger,
      logoUrl: null,
      createdAt: editingLoan?.createdAt ?? new Date().toISOString(),
    });
    successHaptic();
    closeLoanForm();
    await load();
  };

  const handleDeleteLoan = (id: string) => {
    setPendingLoanDeleteId(id);
    setConfirmLoanDeleteVisible(true);
  };

  const portfolioBottomPadding = useMemo(
    () => portfolioScrollBottomPadding(insets.bottom, wealthAssets.length),
    [insets.bottom, wealthAssets.length],
  );

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: 0,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        nestedScrollEnabled
        onContentSizeChange={handlePortfolioContentSizeChange}
        onLayout={handlePortfolioViewportLayout}
        onMomentumScrollEnd={finishPortfolioProgrammaticScroll}
        onScrollEndDrag={finishPortfolioProgrammaticScroll}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.portfolioHeroBlock}>
          <PortfolioHeaderRow />
          <View style={styles.portfolioScopeWrap}>
            <SegmentedTabs
              tabs={[
                { id: 'accounts_only', label: 'Comptes' },
                { id: 'inclusive', label: 'Patrimoine' },
              ]}
              active={netWorthChartScope}
              onChange={handleNetWorthChartScopeChange}
              showDivider={false}
              trackBgColor="#161616"
              activeBgColor="#2c2c2c"
              activeLabelColor="#ffffff"
              inactiveLabelColor="rgba(255,255,255,0.38)"
            />
          </View>
          <DashboardSectionLabel style={styles.heroEyebrow}>VALEUR NETTE</DashboardSectionLabel>
          <NetWorthAmountRow totalBalance={chartNetWorthTotal} />
          <NetWorthDeltaBadge delta={netWorthDelta} />
        </View>
        <View style={styles.chartSectionWrap}>
          <PortfolioChartCard
            points={netWorthTrend}
            totalAssets={chartScopeBreakdown.totalAssets}
            totalDebts={chartScopeBreakdown.totalDebts}
          />
        </View>
        {netWorthChartScope === 'accounts_only' ? (
          <View
            onLayout={(event) => handlePortfolioSectionLayout('balances', event)}
            style={[styles.accountPortfolioSection, { paddingBottom: portfolioBottomPadding }]}
          >
            <AccountBalanceChart
              accounts={visibleAccounts}
              savingsGoals={savingsGoals}
              monthlyFlowsByAccountId={accountMonthlyFlows}
              onAccountPress={openAccountDetail}
              onAddAccount={openNewAccountForm}
              onManageAccounts={openAccountManager}
            />
            <LoansSection
              loans={loans}
              onAdd={openNewLoanForm}
              onEdit={openEditLoanForm}
              onDelete={handleDeleteLoan}
            />
          </View>
        ) : (
          <View
            onLayout={(event) => handlePortfolioSectionLayout('wealth', event)}
            style={[
              styles.wealthPortfolioSection,
              styles.wealthPortfolioSectionUnderChart,
              { paddingBottom: portfolioBottomPadding },
            ]}
          >
            <View style={styles.balanceChartHeader}>
              <View style={styles.balanceChartTitleGroup}>
                <DashboardSectionLabel>Actifs hors compte</DashboardSectionLabel>
                <Text style={[styles.balanceChartTitle, { color: colors.text }]}>Patrimoine</Text>
              </View>
              {wealthAssets.length > 0 && (
                <View
                  style={[
                    styles.wealthToggleBadge,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.wealthToggleBadgeLabel, { color: colors.textSecondary }]}>
                    {wealthAssets.length}
                  </Text>
                </View>
              )}
            </View>

            <WealthAssetsSection
              assets={wealthAssets}
              onAdd={openNewWealthForm}
              onOpenAsset={(asset) => {
                tapHaptic();
                skipPortfolioScrollToTopOnceRef.current = true;
                router.push({ pathname: '/wealth-asset-detail', params: { id: asset.id } });
              }}
            />
          </View>
        )}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[
          styles.floatingActions,
          {
            right: spacing.lg,
            bottom: Math.max(
              insets.bottom + FLOATING_NAV_CONTENT_PADDING + 88 + FLOATING_ACTION_THUMB_RAISE,
              132 + FLOATING_ACTION_THUMB_RAISE,
            ),
          },
        ]}
      >
        {hasPortfolioScrolledDown ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remonter tout en haut du portefeuille"
            style={({ pressed }) => [
              floatingGlassScrollSurface(colors, isLight),
              ghostCardShadow,
              pressed && floatingGlassButtonPressed,
            ]}
            onPress={scrollToPortfolioTop}
          >
            <Ionicons name="chevron-up" size={FLOATING_SCROLL_ICON_SIZE} color={colors.text} />
          </Pressable>
        ) : null}

        {nextPortfolioScrollTarget ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              nextPortfolioScrollTarget === 'balances' ? 'Centrer les soldes des comptes' : 'Centrer le patrimoine hors compte'
            }
            style={({ pressed }) => [
              floatingGlassScrollSurface(colors, isLight),
              ghostCardShadow,
              pressed && floatingGlassButtonPressed,
            ]}
            onPress={() => scrollToPortfolioSection(nextPortfolioScrollTarget)}
          >
            <Ionicons name="chevron-down" size={FLOATING_SCROLL_ICON_SIZE} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={showAccountManager}
        animationType="fade"
        transparent
        onRequestClose={closeAccountManager}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAccountManager} />
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 180 }}
            style={[
              styles.modalSheet,
              ghostCardShadow,
              {
                backgroundColor: colors.surfaceSolid,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <View style={styles.accountManagerTitleGroup}>
                <Text style={[styles.formTitle, { color: colors.text }]}>Gérer les comptes</Text>
                <Text style={[styles.accountManagerHint, { color: colors.textMuted }]}>
                  Change l'ordre et choisis les comptes visibles dans Portefeuille.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: ghost.obsidianSoft },
                  pressed && styles.pressed,
                ]}
                onPress={closeAccountManager}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountManagerList}>
              {orderedAccounts.length > 0 ? (
                orderedAccounts.map((account, index) => (
                  <View
                    key={account.id}
                    style={[styles.accountManagerRow, { backgroundColor: ghost.obsidianSoft, borderColor: colors.border }]}
                  >
                    <View style={styles.accountManagerIdentity}>
                      <Text style={[styles.accountManagerName, { color: colors.text }]} {...rowTitleTextProps}>
                        {account.name}
                      </Text>
                      <Text style={[styles.accountManagerMeta, { color: colors.textMuted }]}>
                        {account.hidden ? 'Masqué' : 'Visible'}
                      </Text>
                    </View>
                    <View style={styles.accountManagerActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Monter ${account.name}`}
                        disabled={index === 0}
                        style={({ pressed }) => [
                          styles.accountManagerIconButton,
                          { borderColor: colors.borderStrong },
                          index === 0 && styles.disabledButton,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => void moveAccount(account.id, -1)}
                      >
                        <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Descendre ${account.name}`}
                        disabled={index === orderedAccounts.length - 1}
                        style={({ pressed }) => [
                          styles.accountManagerIconButton,
                          { borderColor: colors.borderStrong },
                          index === orderedAccounts.length - 1 && styles.disabledButton,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => void moveAccount(account.id, 1)}
                      >
                        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: !account.hidden }}
                        accessibilityLabel={`${account.hidden ? 'Afficher' : 'Masquer'} ${account.name}`}
                        style={({ pressed }) => [
                          styles.accountVisibilityButton,
                          {
                            backgroundColor: account.hidden ? 'transparent' : colors.successMuted,
                            borderColor: account.hidden ? colors.borderStrong : colors.primary,
                          },
                          pressed && styles.pressed,
                        ]}
                        onPress={() => void toggleAccountVisibility(account.id)}
                      >
                        <Ionicons
                          name={account.hidden ? 'eye-off-outline' : 'eye-outline'}
                          size={16}
                          color={account.hidden ? colors.textMuted : colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.balanceChartEmptyText, { color: colors.textMuted }]}>Aucun compte à gérer.</Text>
              )}
            </ScrollView>
          </MotiView>
        </View>
      </Modal>

      <Modal
        visible={showForm}
        animationType="fade"
        transparent
        onRequestClose={closeForm}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeForm} />
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 180 }}
            style={[
              styles.modalSheet,
              ghostCardShadow,
              {
                backgroundColor: colors.surfaceSolid,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={[styles.formTitle, { color: colors.text }]}>
                {editingAccount ? 'Modifier le compte' : 'Nouveau compte simulé'}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: ghost.obsidianSoft },
                  pressed && styles.pressed,
                ]}
                onPress={closeForm}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
          <View style={styles.formHead}>
            <View style={styles.logoPreviewWrap}>
              {previewLogo ? (
                <LogoIconFrame uri={previewLogo} size={52} />
              ) : (
                <IconFrame size={52}>
                  <Ionicons name="business-outline" size={22} color={colors.textMuted} />
                </IconFrame>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Modifier le logo"
                style={({ pressed }) => [
                  styles.logoEditButton,
                  { backgroundColor: colors.primary, borderColor: colors.surfaceSolid, shadowColor: colors.primary },
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  tapHaptic();
                  setShowLogoPicker((visible) => !visible);
                }}
              >
                <Ionicons name="pencil-outline" size={15} color={isLight ? colors.text : ghost.void} />
              </Pressable>
            </View>
            <View style={styles.formHeadCopy}>
              <Text style={[styles.formHint, { color: colors.textMuted }]}>
                {selectedInstitutionLogo
                  ? 'Logo manuel sélectionné.'
                  : 'Le logo se déduit du nom. Exemple : Visa Desjardins -> Desjardins.'}
              </Text>
            </View>
          </View>

          {showLogoPicker ? (
            <View style={styles.logoPickerGroup}>
              <View style={styles.logoPickerTitleRow}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Logo</Text>
                <Text style={[styles.logoPickerHint, { color: colors.textMuted }]}>Auto par défaut</Text>
              </View>
              <View style={styles.logoOptionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Utiliser le logo automatique"
                  onPress={() => {
                    tapHaptic();
                    setSelectedInstitutionLogoId(null);
                    setShowLogoPicker(false);
                  }}
                  style={[
                    styles.logoOption,
                    !selectedInstitutionLogoId && styles.logoOptionActive,
                    { borderColor: !selectedInstitutionLogoId ? colors.primary : colors.border },
                  ]}
                >
                  {autoPreviewLogo ? (
                    <LogoIconFrame uri={autoPreviewLogo} size={34} />
                  ) : (
                    <IconFrame size={34}>
                      <Ionicons name="sparkles-outline" size={17} color={colors.textMuted} />
                    </IconFrame>
                  )}
                </Pressable>

                {INSTITUTION_LOGO_OPTIONS.map((option) => {
                  const selected = selectedInstitutionLogoId === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityLabel="Choisir ce logo"
                      onPress={() => {
                        tapHaptic();
                        setSelectedInstitutionLogoId(option.id);
                        setShowLogoPicker(false);
                      }}
                      style={[
                        styles.logoOption,
                        selected && styles.logoOptionActive,
                        { borderColor: selected ? colors.primary : colors.border },
                      ]}
                    >
                      {option.logoUrl ? (
                        <LogoIconFrame uri={option.logoUrl} size={34} />
                      ) : (
                        <IconFrame size={34}>
                          <Ionicons name="business-outline" size={17} color={colors.textMuted} />
                        </IconFrame>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Type de compte</Text>
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((t) => {
              const selected = kind === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    tapHaptic();
                    setKind(t.id);
                  }}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: selected ? colors.text : ghost.obsidianSoft,
                      borderColor: selected ? colors.text : colors.borderStrong,
                    },
                  ]}
                >
                  <Ionicons
                    name={t.icon}
                    size={16}
                    color={selected ? ghost.void : colors.textSecondary}
                  />
                  <Text style={[styles.typeChipText, { color: selected ? ghost.void : colors.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <AccountInput
            label="Nom du compte"
            value={name}
            onChangeText={setName}
            placeholder={kind === 'credit' ? 'Visa Desjardins' : 'Tangerine chèque'}
          />
          <AccountInput
            label="Institution"
            value={institution}
            onChangeText={setInstitution}
            placeholder="Desjardins, Tangerine, BMO…"
          />
          <AccountInput
            label={kind === 'credit' ? 'Solde dû actuel' : 'Solde actuel'}
            value={balance}
            onChangeText={setBalance}
            placeholder={kind === 'credit' ? '580.42' : '3240.50'}
            keyboardType="decimal-pad"
            suffix="$"
          />

          {kind === 'credit' ? (
            <>
              <AccountInput
                label="Limite de crédit"
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="5000"
                keyboardType="decimal-pad"
              />
              <AccountInput
                label="Jour d’échéance"
                value={dueDay}
                onChangeText={setDueDay}
                placeholder="15"
                keyboardType="number-pad"
                maxLength={2}
              />
              <AccountInput
                label="Taux d’intérêt (%)"
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="19.99"
                keyboardType="decimal-pad"
              />
            </>
          ) : null}

          {kind === 'savings' ? (
            <AccountInput
              label="Taux d’intérêt (%)"
              value={interestRate}
              onChangeText={setInterestRate}
              placeholder="3.25"
              keyboardType="decimal-pad"
            />
          ) : null}

          <PrimarySaveButton
            label={editingAccount ? 'Enregistrer' : 'Créer le compte'}
            onPress={() => void saveAccount()}
          />
            </ScrollView>
          </MotiView>
        </View>
      </Modal>

      <Modal
        visible={showWealthForm}
        animationType="fade"
        transparent
        onRequestClose={closeWealthForm}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeWealthForm} />
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 180 }}
            style={[
              styles.modalSheet,
              ghostCardShadow,
              {
                backgroundColor: colors.surfaceSolid,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={[styles.formTitle, { color: colors.text }]}>
                {wealthEditingAsset ? 'Modifier le patrimoine' : 'Nouveau patrimoine'}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: ghost.obsidianSoft },
                  pressed && styles.pressed,
                ]}
                onPress={closeWealthForm}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.wealthFormHero}>
                <View style={[styles.wealthFormIcon, { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong }]}>
                  {wealthType === 'precious_material' ? (
                    <MaterialIcon material={wealthMaterial} size={34} />
                  ) : (
                    <Ionicons name="home-outline" size={26} color={colors.primary} />
                  )}
                </View>
                <Text style={[styles.formHint, { color: colors.textMuted }]}>
                  Les métaux tentent une actualisation en ligne sans clé API. Si le réseau échoue, une estimation locale est utilisée.
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Type de patrimoine</Text>
              <View style={styles.typeRow}>
                {WEALTH_ASSET_TYPES.map((typeOption) => {
                  const selected = wealthType === typeOption.id;
                  return (
                    <Pressable
                      key={typeOption.id}
                      onPress={() => {
                        tapHaptic();
                        setWealthType(typeOption.id);
                      }}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: selected ? colors.text : ghost.obsidianSoft,
                          borderColor: selected ? colors.text : colors.borderStrong,
                        },
                      ]}
                    >
                      <Ionicons name={typeOption.icon} size={16} color={selected ? ghost.void : colors.textSecondary} />
                      <Text style={[styles.typeChipText, { color: selected ? ghost.void : colors.textSecondary }]}>
                        {typeOption.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {wealthType === 'precious_material' ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Matériau</Text>
                  <View style={styles.wealthMaterialGrid}>
                    {WEALTH_MATERIAL_OPTIONS.map((option) => {
                      const selected = wealthMaterial === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => {
                            tapHaptic();
                            setWealthMaterial(option.id);
                            setWealthWeightUnit(option.unit);
                            setWealthKarats(option.id === 'gold' ? '24' : '');
                            setWealthPurity('');
                          }}
                          style={[
                            styles.wealthMaterialOption,
                            {
                              backgroundColor: selected ? colors.scopeActive : ghost.obsidianSoft,
                              borderColor: selected ? colors.primary : colors.borderStrong,
                            },
                          ]}
                        >
                          <MaterialIcon material={option.id} size={30} />
                          <Text style={[styles.logoOptionText, { color: selected ? colors.text : colors.textSecondary }]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <AccountInput
                    label="Nom"
                    value={wealthName}
                    onChangeText={setWealthName}
                    placeholder={`Ex. ${materialLabel(wealthMaterial)} familial`}
                  />
                  <AccountInput
                    label={wealthMaterial === 'diamond' ? 'Poids' : 'Poids du métal'}
                    value={wealthWeight}
                    onChangeText={setWealthWeight}
                    placeholder={wealthMaterial === 'diamond' ? '1.2' : '25'}
                    keyboardType="decimal-pad"
                    suffix={wealthWeightUnit}
                  />
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Unité</Text>
                  <View style={styles.typeRow}>
                    {WEIGHT_UNIT_OPTIONS.map((unit) => {
                      const selected = wealthWeightUnit === unit.id;
                      return (
                        <Pressable
                          key={unit.id}
                          onPress={() => {
                            tapHaptic();
                            setWealthWeightUnit(unit.id);
                          }}
                          style={[
                            styles.typeChip,
                            {
                              backgroundColor: selected ? colors.text : ghost.obsidianSoft,
                              borderColor: selected ? colors.text : colors.borderStrong,
                            },
                          ]}
                        >
                          <Text style={[styles.typeChipText, { color: selected ? ghost.void : colors.textSecondary }]}>
                            {unit.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {wealthMaterial === 'gold' ? (
                    <AccountInput
                      label="Karats"
                      value={wealthKarats}
                      onChangeText={setWealthKarats}
                      placeholder="24"
                      keyboardType="decimal-pad"
                    />
                  ) : wealthMaterial !== 'diamond' ? (
                    <AccountInput
                      label="Pureté (%)"
                      value={wealthPurity}
                      onChangeText={setWealthPurity}
                      placeholder="99.9"
                      keyboardType="decimal-pad"
                    />
                  ) : (
                    <Text style={[styles.wealthFinePrint, { color: colors.textMuted }]}>
                      Pour un diamant, la valeur affichée reste indicative. La coupe, la couleur, la clarté et la certification changent fortement le prix.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <AccountInput
                    label="Nom du bien"
                    value={wealthName}
                    onChangeText={setWealthName}
                    placeholder="Condo Montréal"
                  />
                  <AccountInput
                    label="Type de bien"
                    value={wealthPropertyType}
                    onChangeText={setWealthPropertyType}
                    placeholder="Condo, maison, terrain"
                  />
                  <AccountInput
                    label="Adresse (optionnel)"
                    value={wealthAddress}
                    onChangeText={setWealthAddress}
                    placeholder="Rue, ville"
                  />
                  <AccountInput
                    label="Valeur actuelle estimée"
                    value={wealthCurrentValue}
                    onChangeText={setWealthCurrentValue}
                    placeholder="425000"
                    keyboardType="decimal-pad"
                    suffix="$"
                  />
                </>
              )}

              <AccountInput
                label="Coût à l’achat"
                value={wealthPurchaseCost}
                onChangeText={setWealthPurchaseCost}
                placeholder={wealthType === 'real_estate' ? '350000' : '1800'}
                keyboardType="decimal-pad"
                suffix="$"
              />
              <AccountInput
                label="Date d’achat (optionnel)"
                value={wealthPurchaseDate}
                onChangeText={setWealthPurchaseDate}
                placeholder="2024-05-17"
              />
              <AccountInput
                label="Note (optionnel)"
                value={wealthNotes}
                onChangeText={setWealthNotes}
                placeholder="Certification, courtier, détails utiles"
              />

              <PrimarySaveButton
                label={wealthEditingAsset ? 'Enregistrer' : 'Ajouter au patrimoine'}
                onPress={() => void saveWealthAsset()}
                disabled={isSavingWealth}
                loading={isSavingWealth}
              />
            </ScrollView>
          </MotiView>
        </View>
      </Modal>

      <Modal
        visible={showLoanForm}
        animationType="fade"
        transparent
        onRequestClose={closeLoanForm}
      >
        <View style={[styles.modalBackdrop, loanThemed.modalBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeLoanForm} />
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 180 }}
            style={[
              styles.modalSheet,
              ghostCardShadow,
              loanThemed.sheet,
              {
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={[styles.modalHandle, loanThemed.handle]} />
            <View style={styles.modalTitleRow}>
              <Text style={[styles.formTitle, loanThemed.text]}>
                {editingLoan ? 'Modifier le prêt' : 'Nouveau prêt bancaire'}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  loanThemed.closeButton,
                  pressed && styles.pressed,
                ]}
                onPress={closeLoanForm}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={[styles.wealthFormHero, { marginBottom: spacing.xs }]}>
                <View style={[styles.wealthFormIcon, loanThemed.control]}>
                  <Ionicons name="business-outline" size={26} color={colors.primary} />
                </View>
                <Text style={[styles.formHint, loanThemed.textMuted]}>
                  Le solde restant est comptabilisé comme une dette et ses paiements seront ajoutés à l’agenda.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, loanThemed.textSecondary]}>Type de dette</Text>
                <View style={styles.typeRow}>
                  {LOAN_TYPE_OPTIONS.map((option) => {
                    const selected = loanType === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          setLoanType(option.id);
                          if (option.id === 'friend_debt') setLoanRate('0');
                        }}
                        style={[
                          styles.typeChip,
                          selected ? loanThemed.selected : loanThemed.control,
                        ]}
                      >
                        <Ionicons name={option.icon} size={15} color={selected ? ghost.void : colors.textSecondary} />
                        <Text style={[styles.typeChipText, selected ? loanThemed.selectedText : loanThemed.textSecondary]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <AccountInput
                label={loanType === 'friend_debt' ? 'Ami ou personne' : loanType === 'line_of_credit' ? 'Institution' : 'Prêteur'}
                value={loanLender}
                onChangeText={setLoanLender}
                placeholder={loanType === 'friend_debt' ? 'Nom de la personne' : 'Desjardins, RBC, BMO…'}
              />
              <AccountInput
                label={loanType === 'friend_debt' ? 'Nom de la dette (optionnel)' : 'Nom du prêt (optionnel)'}
                value={loanName}
                onChangeText={setLoanName}
                placeholder={loanType === 'line_of_credit' ? 'Marge rénovations…' : loanType === 'friend_debt' ? 'Souper, dépannage…' : 'Prêt auto, hypothèque…'}
              />
              <AccountInput
                label={loanType === 'line_of_credit' ? 'Montant utilisé initialement' : loanType === 'friend_debt' ? 'Montant emprunté' : 'Montant initial du prêt'}
                value={loanPrincipal}
                onChangeText={setLoanPrincipal}
                placeholder="25000"
                keyboardType="decimal-pad"
                suffix="$"
              />
              <AccountInput
                label="Solde restant à rembourser"
                value={loanBalance}
                onChangeText={setLoanBalance}
                placeholder="18500"
                keyboardType="decimal-pad"
                suffix="$"
              />
              {loanType !== 'friend_debt' ? (
                <AccountInput
                  label="Taux d'intérêt"
                  value={loanRate}
                  onChangeText={setLoanRate}
                  placeholder="5.99"
                  keyboardType="decimal-pad"
                  suffix="%"
                />
              ) : null}
              <AccountInput
                label="Montant par paiement"
                value={loanMonthlyPayment}
                onChangeText={setLoanMonthlyPayment}
                placeholder="420"
                keyboardType="decimal-pad"
                suffix="$"
              />
              <DatePickerField
                label="Date de début"
                value={loanStartDate}
                placeholder="Choisir une date"
                variant="sheet"
                onChangeDate={setLoanStartDate}
              />

              <View style={styles.inputGroup}>
                <Text style={[styles.label, loanThemed.textSecondary]}>Durée</Text>
                <View style={styles.loanDurationRow}>
                  <View style={styles.loanDurationAmount}>
                    <AccountInput
                      label="Nombre"
                      value={loanDurationAmount}
                      onChangeText={setLoanDurationAmount}
                      placeholder="12"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.typeRow, styles.loanDurationUnitRow]}>
                    {LOAN_DURATION_UNITS.map((option) => {
                      const selected = loanDurationUnit === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => setLoanDurationUnit(option.id)}
                          style={[
                            styles.typeChip,
                            selected ? loanThemed.selected : loanThemed.control,
                          ]}
                        >
                          <Text style={[styles.typeChipText, selected ? loanThemed.selectedText : loanThemed.textSecondary]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, loanThemed.textSecondary]}>Date de fin calculée</Text>
                <View style={[styles.input, loanThemed.control, { justifyContent: 'center' }]}>
                  <Text style={computedLoanEndDate ? loanThemed.text : loanThemed.textMuted}>
                    {computedLoanEndDate || 'Entre une date de début et une durée'}
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, loanThemed.textSecondary]}>Fréquence des paiements</Text>
                <View style={styles.typeRow}>
                  {LOAN_PAYMENT_FREQUENCIES.map((option) => {
                    const selected = loanPaymentFrequency === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => setLoanPaymentFrequency(option.id)}
                        style={[
                          styles.typeChip,
                          selected ? loanThemed.selected : loanThemed.control,
                        ]}
                      >
                        <Text style={[styles.typeChipText, selected ? loanThemed.selectedText : loanThemed.textSecondary]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, loanThemed.textSecondary]}>Compte utilisé pour payer</Text>
                <View style={styles.typeRow}>
                  {accounts.length === 0 ? (
                    <Text style={[styles.formHint, loanThemed.textMuted]}>Ajoute un compte pour planifier les paiements.</Text>
                  ) : (
                    accounts.map((account) => {
                      const selected = loanPaymentAccountId === account.id;
                      return (
                        <Pressable
                          key={account.id}
                          onPress={() => setLoanPaymentAccountId(account.id)}
                          style={[
                            styles.typeChip,
                            selected ? loanThemed.selected : loanThemed.control,
                          ]}
                        >
                          <Ionicons name={iconForKind(account.kind)} size={15} color={selected ? ghost.void : colors.textSecondary} />
                          <Text style={[styles.typeChipText, selected ? loanThemed.selectedText : loanThemed.textSecondary]}>
                            {account.last4 ? `${account.name} • ${account.last4}` : account.name}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>

              <DatePickerField
                label={`Prochain paiement (${loanMonthlyPayment.trim() ? `${loanMonthlyPayment.trim().replace(',', '.')} $` : 'montant par paiement'})`}
                value={loanNextPaymentDate}
                placeholder="Choisir la prochaine date"
                variant="sheet"
                onChangeDate={setLoanNextPaymentDate}
              />

              <PrimarySaveButton
                label={editingLoan ? 'Enregistrer' : 'Ajouter le prêt'}
                onPress={() => void saveLoan()}
              />
            </ScrollView>
          </MotiView>
        </View>
      </Modal>

      <ConfirmDeleteModal
        visible={confirmLoanDeleteVisible}
        title="Supprimer ce prêt ?"
        message="Cette action est irréversible."
        onConfirm={() => {
          if (!pendingLoanDeleteId) return;
          setConfirmLoanDeleteVisible(false);
          void deleteLoan(pendingLoanDeleteId).then(() => load());
          setPendingLoanDeleteId(null);
        }}
        onCancel={() => {
          setConfirmLoanDeleteVisible(false);
          setPendingLoanDeleteId(null);
        }}
      />
    </View>
    </PageTransition>
  );
}

function AccountInput(props: React.ComponentProps<typeof TextInput> & { label: string; suffix?: string }) {
  const { label, suffix, ...inputProps } = props;
  const { colors, ghost } = useAppTheme();
  const controlStyle = {
    backgroundColor: ghost.obsidianSoft,
    borderColor: colors.borderStrong,
  };
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {suffix ? (
        <View style={[styles.inputShell, controlStyle]}>
          <TextInput
            {...inputProps}
            style={[styles.inputWithSuffix, { color: colors.text }]}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>{suffix}</Text>
        </View>
      ) : (
        <TextInput
          {...inputProps}
          style={[styles.input, controlStyle, { color: colors.text }]}
          placeholderTextColor={colors.textMuted}
        />
      )}
    </View>
  );
}

function WealthPatrimoineAssetCard({
  asset,
  ghostCardShadow,
  isLight,
  colors,
  onOpenAsset,
}: {
  asset: WealthAsset;
  ghostCardShadow: GhostCardShadowStyle;
  isLight: boolean;
  colors: AppColors;
  onOpenAsset: (asset: WealthAsset) => void;
}) {
  const gain = asset.currentValue - asset.purchaseCost;
  const gainPositive = gain >= 0;
  const surfaceColor = isLight ? colors.surfaceSolid : colors.surfaceSolid;
  const mutedSurface = isLight ? colors.surfaceElevated : colors.input;
  const metaDate = asset.lastValuationAt ?? asset.purchaseDate ?? undefined;

  const pct = asset.purchaseCost !== 0 ? ((asset.currentValue - asset.purchaseCost) / asset.purchaseCost) * 100 : null;
  const pctLabel =
    pct === null ? '—' : Math.abs(pct) < 0.05 ? '0 %' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %`;
  const pctIsPositive = pct !== null && pct > 0.05;
  const pctIsNegative = pct !== null && pct < -0.05;
  const pctBg = pctIsPositive
    ? colors.successMuted
    : pctIsNegative
      ? colors.dangerMuted
      : mutedSurface;
  const pctColor = pctIsPositive ? colors.success : pctIsNegative ? colors.danger : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir le détail du patrimoine ${asset.name}`}
      android_ripple={null}
      onPress={() => onOpenAsset(asset)}
      style={ghostCardShadow}
    >
      <GlassContainer style={styles.wealthCard} padding={spacing.lg} borderRadius={radius.card}>
      <View style={styles.wealthPatrimoineAssetIdentity}>
        <View style={[styles.wealthAssetIcon, { backgroundColor: mutedSurface }]}>
          {asset.type === 'real_estate' ? (
            <Ionicons name="home-outline" size={22} color={colors.primary} />
          ) : asset.material ? (
            <MaterialIcon material={asset.material} size={26} />
          ) : (
            <Ionicons name="diamond-outline" size={22} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.wealthPatrimoineAssetTitles}>
          <Text style={[styles.wealthPatrimoineAssetName, { color: colors.text }]} {...rowTitleTextProps}>
            {asset.name}
          </Text>
          <Text style={[styles.wealthPatrimoineAssetSubtitle, { color: colors.textMuted }]} numberOfLines={2} ellipsizeMode="tail">
            {assetSubtitle(asset)}
          </Text>
        </View>
        <View style={[styles.wealthPctPill, { backgroundColor: pctBg }]}>
          <Text style={[styles.wealthPctPillText, { color: pctColor }]}>{pctLabel}</Text>
        </View>
      </View>

      <View style={styles.wealthPerformanceRow}>
        <View style={styles.wealthValueBlock}>
          <Text style={[styles.wealthValueLabel, { color: colors.textMuted }]}>Valeur actuelle</Text>
          <Text
            style={[styles.wealthValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {formatCompactMoneyMagnitude(asset.currentValue)}
          </Text>
          <Text style={[styles.wealthCostText, { color: colors.textMuted }]}>
            Coût · {formatCompactMoneyMagnitude(asset.purchaseCost)}
          </Text>
        </View>

        <View style={styles.wealthGainPanel}>
          <Text
            style={[styles.wealthGainAmount, { color: gainPositive ? colors.success : colors.danger }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {formatCompactGainDollars(gain, { leadingPlusWhenPositive: true })}
          </Text>
          <Text style={[styles.wealthGainLabel, { color: colors.textMuted }]}>Variation</Text>
        </View>
      </View>

      <View style={styles.wealthMetaRow}>
        <Text style={[styles.wealthSourceText, { color: colors.textMuted }]} numberOfLines={1}>
          {valuationSourceLabel(asset)}
        </Text>
        <Text style={[styles.wealthSourceText, { color: colors.textMuted }]} numberOfLines={1}>
          {metaDate ? formatShortDate(metaDate) : '—'}
        </Text>
      </View>
      </GlassContainer>
    </Pressable>
  );
}

function WealthAssetsSection({
  assets,
  onAdd,
  onOpenAsset,
}: {
  assets: WealthAsset[];
  onAdd: () => void;
  onOpenAsset: (asset: WealthAsset) => void;
}) {
  const { colors, ghostCardShadow, isLight } = useAppTheme();
  const [patrimoineListExpanded, setPatrimoineListExpanded] = useState(false);

  useEffect(() => {
    if (assets.length <= 1) setPatrimoineListExpanded(false);
  }, [assets.length]);

  const patrimoineHeroAsset = assets[0];

  const togglePatrimoineList = useCallback(() => {
    if (assets.length <= 1) return;
    tapHaptic();
    setPatrimoineListExpanded((v) => !v);
  }, [assets.length]);

  return (
    <View style={styles.wealthSection}>
      {assets.length === 0 ? (
        <View style={styles.loansExpandedContent}>
          <Text style={[styles.wealthCompactEmptyText, { color: colors.textMuted }]}>
            Aucun actif hors compte enregistré. Ajoutes-en un pour qu'il soit ajouté à ta valeur nette.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un actif hors compte"
            onPress={onAdd}
            style={({ pressed }) => [
              styles.premiumAddCta,
              {
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
                borderColor: colors.borderStrong,
              },
              pressed && floatingGlassButtonPressed,
            ]}
          >
            <Ionicons name="add" size={18} color={colors.textSecondary} />
            <Text style={[styles.premiumAddCtaLabel, { color: colors.text }]}>Ajouter</Text>
          </Pressable>
        </View>
      ) : patrimoineHeroAsset ? (
        <>
          <View style={styles.wealthCards}>
            <WealthPatrimoineAssetCard
              asset={patrimoineHeroAsset}
              ghostCardShadow={ghostCardShadow}
              isLight={isLight}
              colors={colors}
              onOpenAsset={onOpenAsset}
            />

            {assets.length > 1 ? (
              <>
                <View style={styles.wealthCarouselFooter}>
                  <Text style={[styles.wealthCarouselCounter, { color: colors.textMuted }]}>
                    {assets.length} actifs
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: patrimoineListExpanded }}
                    accessibilityLabel={
                      patrimoineListExpanded
                        ? 'Masquer les actifs hors compte supplémentaires'
                        : 'Voir tous les actifs hors compte'
                    }
                    accessibilityHint={`${assets.length} conteneurs suivis au total.`}
                    onPress={togglePatrimoineList}
                    style={({ pressed }) => [
                      styles.wealthVoirPlus,
                      {
                        borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.14)',
                        backgroundColor: isLight ? 'rgba(248, 250, 252, 0.9)' : 'rgba(12, 12, 12, 0.85)',
                      },
                      pressed && floatingGlassButtonPressed,
                    ]}
                  >
                    <Text style={[styles.wealthVoirPlusLabel, { color: colors.textSecondary }]}>
                      {patrimoineListExpanded ? 'Voir moins' : 'Voir plus'}
                    </Text>
                    <MotiView
                      animate={{ rotate: patrimoineListExpanded ? '180deg' : '0deg' }}
                      transition={{ type: 'timing', duration: 220 }}
                      style={styles.wealthVoirPlusChevronWrap}
                    >
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </MotiView>
                  </Pressable>
                </View>

                {patrimoineListExpanded ? (
                  <MotiView
                    from={{ opacity: 0, translateY: -6 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 240 }}
                    style={styles.wealthPatrimoineExpandedStack}
                  >
                    {assets.slice(1).map((asset) => (
                      <WealthPatrimoineAssetCard
                        key={asset.id}
                        asset={asset}
                        ghostCardShadow={ghostCardShadow}
                        isLight={isLight}
                        colors={colors}
                        onOpenAsset={onOpenAsset}
                      />
                    ))}
                  </MotiView>
                ) : null}
              </>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un patrimoine"
            onPress={onAdd}
            style={({ pressed }) => [
              styles.premiumAddCta,
              {
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
                borderColor: colors.borderStrong,
              },
              pressed && floatingGlassButtonPressed,
            ]}
          >
            <Ionicons name="add" size={18} color={colors.textSecondary} />
            <Text style={[styles.premiumAddCtaLabel, { color: colors.text }]}>Ajouter</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function LoanCard({
  loan,
  onEdit,
  onDelete,
}: {
  loan: Loan;
  onEdit: (loan: Loan) => void;
  onDelete: (id: string) => void;
}) {
  const { colors, ghostCardShadow, isLight } = useAppTheme();
  const surfaceColor = isLight ? colors.surfaceSolid : colors.surfaceSolid;
  const mutedSurface = isLight ? colors.surfaceElevated : colors.input;
  const trackColor = isLight ? '#E8EDF3' : '#08090B';

  const paidAmount = Math.max(loan.principal - loan.balanceRemaining, 0);
  const progressPct = loan.principal > 0 ? Math.min((paidAmount / loan.principal) * 100, 100) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Modifier le prêt ${loan.name}`}
      android_ripple={null}
      onPress={() => onEdit(loan)}
      style={ghostCardShadow}
    >
      <GlassContainer style={styles.loanCard} padding={spacing.md} borderRadius={radius.card}>
      <View style={styles.loanCardTopRow}>
        <View style={[styles.loanCardIcon, { backgroundColor: mutedSurface }]}>
          <Ionicons name="business-outline" size={20} color={colors.danger} />
        </View>
        <View style={styles.loanCardTitles}>
          <Text style={[styles.loanCardName, { color: colors.text }]} {...rowTitleTextProps}>
            {loan.name}
          </Text>
          <Text style={[styles.loanCardSub, { color: colors.textMuted }]} {...rowTitleTextProps}>
            {loanTypeLabel(loan.type)} · {loan.lender}
          </Text>
        </View>
        <View style={styles.loanCardAmountStack}>
          <Text style={[styles.loanCardBalance, { color: colors.danger }]} {...singleLineAmountProps}>
            {formatPortfolioOutflow(loan.balanceRemaining)}
          </Text>
          <Text style={[styles.loanCardBalanceLabel, { color: colors.textMuted }]}>restant</Text>
        </View>
      </View>

      <View style={[styles.loanProgressTrack, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.loanProgressFill,
            { width: `${Math.max(progressPct, 3)}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>

      <View style={styles.loanCardMetaRow}>
        <Text style={[styles.loanCardMeta, { color: colors.textMuted }]}>
          {progressPct.toFixed(0)} % remboursé
        </Text>
        <View style={styles.loanCardMetaRight}>
          <Text style={[styles.loanCardMeta, { color: colors.textMuted }]}>
            {formatPortfolioOutflow(loan.monthlyPayment)}/{loanPaymentFrequencyLabel(loan.paymentFrequency)} · fin {loan.endDate}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Supprimer ce prêt"
            hitSlop={8}
            onPress={(e) => { e.stopPropagation?.(); onDelete(loan.id); }}
            style={({ pressed }) => [styles.loanDeleteBtn, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
      </GlassContainer>
    </Pressable>
  );
}

function LoansSection({
  loans,
  onAdd,
  onEdit,
  onDelete,
}: {
  loans: Loan[];
  onAdd: () => void;
  onEdit: (loan: Loan) => void;
  onDelete: (id: string) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const totalDebt = loans.reduce((sum, l) => sum + Math.max(l.balanceRemaining, 0), 0);

  return (
    <View style={styles.loansSectionContainer}>
      <View style={styles.balanceChartHeader}>
        <View style={styles.balanceChartTitleGroup}>
          <DashboardSectionLabel>Dettes</DashboardSectionLabel>
          <Text style={[styles.balanceChartTitle, { color: colors.text }]}>Prêts bancaires</Text>
        </View>
        <View style={styles.loansSectionHeaderActions}>
          {loans.length > 0 && (
            <View style={[styles.wealthToggleBadge, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.wealthToggleBadgeLabel, { color: colors.danger }]}>
                {formatPortfolioOutflow(totalDebt)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.loansExpandedContent}>
        {loans.length === 0 ? (
          <Text style={[styles.wealthCompactEmptyText, { color: colors.textMuted }]}>
            Aucun prêt enregistré. Ajoutes-en un pour qu'il soit déduit de ta valeur nette.
          </Text>
        ) : (
          <View style={styles.loanCardList}>
            {loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un prêt bancaire"
          onPress={onAdd}
          style={({ pressed }) => [
            styles.premiumAddCta,
            {
              backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
              borderColor: colors.borderStrong,
            },
            pressed && floatingGlassButtonPressed,
          ]}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
          <Text style={[styles.premiumAddCtaLabel, { color: colors.text }]}>Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AccountBalanceChart({
  accounts,
  savingsGoals,
  monthlyFlowsByAccountId,
  onAccountPress,
  onAddAccount,
  onManageAccounts,
}: {
  accounts: SimulatedAccount[];
  savingsGoals: SavingsGoal[];
  monthlyFlowsByAccountId: Record<string, AccountMoneyFlow>;
  onAccountPress: (account: SimulatedAccount) => void;
  onAddAccount: () => void;
  onManageAccounts: () => void;
}) {
  const { colors, ghost, ghostCardShadow, isLight } = useAppTheme();
  const sectionCardSurface = colors.cardBackground;
  const sectionSoftSurface = colors.surfaceElevated;
  const sectionBorder = colors.border;
  const savingsGoalNameById = useMemo(
    () => new Map(savingsGoals.map((goal) => [goal.id, goal.name])),
    [savingsGoals],
  );

  return (
    <View style={styles.accountVisualSection}>
      <View style={styles.balanceChartHeader}>
        <View style={styles.balanceChartTitleGroup}>
          <DashboardSectionLabel>Répartition</DashboardSectionLabel>
          <Text style={[styles.balanceChartTitle, { color: colors.text }]}>Soldes des comptes</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gérer les comptes"
          style={({ pressed }) => [
            styles.balanceChartManageButton,
            { borderColor: sectionBorder, backgroundColor: sectionSoftSurface },
            pressed && styles.pressed,
          ]}
          onPress={onManageAccounts}
        >
          <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
        </Pressable>
      </View>

      {accounts.length === 0 ? (
        <View style={[styles.balanceChartEmpty, { backgroundColor: sectionCardSurface }]}>
          <View style={[styles.emptyVisualIcon, { backgroundColor: sectionSoftSurface }]}>
            <Ionicons name="bar-chart-outline" size={18} color={colors.textMuted} />
          </View>
          <Text style={[styles.balanceChartEmptyTitle, { color: colors.text }]}>Aucun compte à afficher</Text>
          <Text style={[styles.balanceChartEmptyText, { color: colors.textMuted }]}>
            Crée un compte simulé pour obtenir une carte de solde distincte avec son indicateur visuel.
          </Text>
        </View>
      ) : (
        <View style={styles.accountVisualCards}>
          {accounts.map((account) => {
            const isCreditCard = account.kind === 'credit';
            const creditLimit =
              isCreditCard && typeof account.creditLimit === 'number' && account.creditLimit > 0
                ? account.creditLimit
                : undefined;
            const creditUsed = creditUsedFromBalance(account.balance);
            const creditUsagePercent = creditLimit ? Math.min((creditUsed / creditLimit) * 100, 100) : undefined;
            const creditRemaining = creditLimit ? creditLimit - creditUsed : undefined;
            const isNearCreditLimit = typeof creditRemaining === 'number' && creditRemaining < 100;
            const monthFlow = monthlyFlowsByAccountId[account.id] ?? { moneyIn: 0, moneyOut: 0 };
            const flowInColor = colors.primary;
            const flowOutColor = colors.danger;
            const tone = account.balance < 0 ? colors.danger : account.kind === 'savings' ? colors.primaryAlt : colors.primary;
            const showAccountProgressBar = account.kind === 'credit';
            const creditBalanceIsPositive = isCreditCard && account.balance > 0;
            const progressBarFillColor =
              isCreditCard && typeof creditUsagePercent === 'number'
                ? creditLimitUtilizationBarColor(creditUsagePercent, colors, isLight)
                : tone;
            const showCreditLimitNearlyAtCap =
              isCreditCard && typeof creditUsagePercent === 'number' && creditUsagePercent >= 90;
            const logoUrl = getSimulatedAccountLogoUrl(account);
            const balanceRatio =
              typeof creditUsagePercent === 'number'
                ? creditUsagePercent
                : Math.min((creditUsed / Math.max(creditUsed, 1)) * 100, 100);
            const statusLabel = isCreditCard
              ? typeof creditUsagePercent === 'number'
                ? `${Math.round(creditUsagePercent)}% utilisé`
                : 'Crédit'
              : accountKindLabel(account.kind);
            const linkedSavingsGoalName = account.linkedSavingsGoalId
              ? savingsGoalNameById.get(account.linkedSavingsGoalId)
              : undefined;
            const surfaceColor = colors.surfaceSolid;
            const mutedSurface = colors.input;
            const textColor = colors.text;
            const mutedTextColor = colors.textMuted;
            const creditWarningOutline = [colors.danger, colors.dangerMuted, colors.danger] as const;

            return (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                accessibilityLabel={`Voir le détail du compte ${account.name}`}
                android_ripple={null}
                style={ghostCardShadow}
                onPress={() => onAccountPress(account)}
              >
                <GlassContainer
                  borderRadius={radius.card}
                  padding={0}
                  innerStyle={styles.accountVisualCard}
                  outlineColors={isNearCreditLimit ? creditWarningOutline : undefined}
                >
                <View style={styles.accountVisualTopRow}>
                  <View style={styles.accountVisualIdentity}>
                    {logoUrl ? (
                      <LogoIconFrame uri={logoUrl} size={40} />
                    ) : (
                      <View style={userPickedIconWellStyle(40, isLight)}>
                        <Ionicons name={iconForKind(account.kind)} size={16} color={tone} />
                      </View>
                    )}
                    <View style={styles.accountVisualNameGroup}>
                      <Text style={[styles.accountVisualName, { color: textColor }]} {...rowTitleTextProps}>
                        {account.name}
                      </Text>
                      <Text style={[styles.accountVisualMeta, { color: mutedTextColor }]} {...rowTitleTextProps}>
                        {linkedSavingsGoalName
                          ? `Objectif · ${linkedSavingsGoalName}`
                          : account.institution?.trim() || statusLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accountVisualBalanceStack}>
                    <Text
                      style={[
                        styles.accountVisualAmount,
                        {
                          color: account.balance < 0
                            ? colors.danger
                            : creditBalanceIsPositive
                              ? colors.success
                              : textColor,
                        },
                      ]}
                      {...singleLineAmountProps}
                    >
                      {formatCompactCurrency(account.balance, {
                        leadingPlusWhenPositive: creditBalanceIsPositive,
                      })}
                    </Text>
                    <View
                      style={[
                        styles.accountVisualStatusPill,
                        { backgroundColor: isNearCreditLimit ? colors.dangerMuted : mutedSurface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.accountVisualStatusText,
                          { color: isNearCreditLimit ? colors.danger : mutedTextColor },
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.accountVisualLowerZone} pointerEvents="none">
                  {showAccountProgressBar ? (
                    <View style={styles.accountVisualTrackGroup}>
                      <View style={[styles.accountVisualTrack, { backgroundColor: mutedSurface }]}>
                        <View
                          style={[
                            styles.accountVisualFill,
                            {
                              width: `${Math.max(balanceRatio, 4)}%`,
                              backgroundColor: progressBarFillColor,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.accountVisualDetailRow}>
                        <Text style={[styles.accountVisualDetailText, { color: mutedTextColor }]} numberOfLines={1}>
                          {creditLimit ? 'Crédit disponible' : 'Solde dû'}
                        </Text>
                        <Text style={[styles.accountVisualDetailValue, { color: textColor }]} numberOfLines={1}>
                          {typeof creditRemaining === 'number'
                            ? `${formatPortfolioAsset(Math.max(creditRemaining, 0))} dispo`
                            : formatPortfolioOutflow(creditUsed)}
                        </Text>
                      </View>
                      {showCreditLimitNearlyAtCap ? (
                        <View
                          style={[
                            styles.accountVisualLimitNearBanner,
                            {
                              backgroundColor: isLight ? 'rgba(249, 115, 22, 0.14)' : 'rgba(251, 146, 60, 0.22)',
                              borderColor: isLight ? 'rgba(234, 88, 12, 0.35)' : 'rgba(251, 146, 60, 0.4)',
                            },
                          ]}
                        >
                          <Ionicons name="warning" size={14} color={isLight ? '#EA580C' : '#FB923C'} />
                          <Text
                            style={[
                              styles.accountVisualLimitNearBannerText,
                              { color: isLight ? '#9A3412' : '#FED7AA' },
                            ]}
                            numberOfLines={1}
                          >
                            Limite presque atteinte
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.accountVisualMonthlyFlowGroup}>
                    <View style={styles.accountVisualFlowSplit}>
                      <View style={styles.accountVisualFlowItem}>
                        <Ionicons name="arrow-down" size={13} color={flowInColor} />
                        <View style={styles.accountVisualFlowTextStack}>
                          <Text style={[styles.accountVisualFlowColumnLabel, { color: mutedTextColor }]} numberOfLines={1}>
                            Entrées
                          </Text>
                          <Text
                            style={[styles.accountVisualFlowColumnAmount, { color: flowInColor }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                          >
                            {formatPortfolioInflow(monthFlow.moneyIn)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.accountVisualFlowItem}>
                        <Ionicons name="arrow-up" size={13} color={flowOutColor} />
                        <View style={styles.accountVisualFlowTextStack}>
                          <Text style={[styles.accountVisualFlowColumnLabel, { color: mutedTextColor }]} numberOfLines={1}>
                            Sorties
                          </Text>
                          <Text
                            style={[styles.accountVisualFlowColumnAmount, { color: flowOutColor }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                          >
                            {formatPortfolioOutflow(monthFlow.moneyOut)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                </GlassContainer>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter un compte"
        onPress={onAddAccount}
        style={({ pressed }) => [
          styles.premiumAddCta,
          {
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
            borderColor: colors.borderStrong,
          },
          pressed && floatingGlassButtonPressed,
        ]}
      >
        <Ionicons name="add" size={18} color={colors.textSecondary} />
        <Text style={[styles.premiumAddCtaLabel, { color: colors.text }]}>Ajouter</Text>
      </Pressable>
    </View>
  );
}

function parseMoney(value: string) {
  return Number.parseFloat(value.replace(',', '.'));
}

function loanPaymentFrequencyLabel(frequency: LoanPaymentFrequency) {
  if (frequency === 'weekly') return 'sem.';
  if (frequency === 'biweekly') return '2 sem.';
  return 'mois';
}

function loanTypeLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Dette à un ami';
  if (type === 'line_of_credit') return 'Marge de crédit';
  return 'Prêt personnel';
}

function parseOptionalMoney(value: string) {
  const parsed = parseMoney(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function iconForKind(kind: AccountKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'cash-outline';
  return 'wallet-outline';
}

function accountKindLabel(kind: AccountKind) {
  if (kind === 'credit') return 'Crédit';
  if (kind === 'savings') return 'Épargne';
  return 'Chèque';
}

function MaterialIcon({ material, size }: { material: WealthMaterial; size: number }) {
  const { isLight } = useAppTheme();
  const tone = materialTone(material, isLight);

  if (material === 'diamond') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M9 13 L15 7 H25 L31 13 L20 33 Z" fill={tone.fill} stroke={tone.stroke} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M9 13 H31 M15 7 L20 13 L25 7 M15 13 L20 33 L25 13" fill="none" stroke={tone.stroke} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    );
  }

  if (material === 'silver') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={13} fill={tone.fill} stroke={tone.stroke} strokeWidth={2} />
        <Path d="M14 22 C16 25 24 25 26 21 C28 17 18 18 16 15 C15 13 17 11 20 11 C23 11 25 12 26 14" fill="none" stroke={tone.stroke} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (material === 'platinum') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M10 28 L14 10 H24 C29 10 32 13 32 18 C32 23 28 26 22 26 H17 L16 28 Z" fill={tone.fill} stroke={tone.stroke} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M18 16 H23 C25 16 26 17 26 19 C26 21 24 22 21 22 H17" fill="none" stroke={tone.stroke} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={14} fill={tone.fill} stroke={tone.stroke} strokeWidth={2} />
      <Path d="M25 15 C23.8 12.8 21.6 11.7 18.8 12 C15 12.5 12.6 15.5 12.6 20 C12.6 24.4 15.1 27.4 19.2 28 C22.1 28.4 24.4 27.2 25.8 24.8" fill="none" stroke={tone.stroke} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M19 17 H28 M19 23 H28" stroke={tone.stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function materialTone(material: WealthMaterial, isLight: boolean) {
  if (material === 'gold') return { fill: isLight ? '#FDE68A' : '#FACC15', stroke: '#A16207' };
  if (material === 'silver') return { fill: isLight ? '#E5E7EB' : '#CBD5E1', stroke: '#64748B' };
  if (material === 'platinum') return { fill: isLight ? '#D8F3F0' : '#9FE7DF', stroke: '#0F766E' };
  return { fill: isLight ? '#EDE9FE' : '#C4B5FD', stroke: '#7C3AED' };
}

function materialLabel(material: WealthMaterial) {
  if (material === 'gold') return 'Or';
  if (material === 'silver') return 'Argent';
  if (material === 'platinum') return 'Platine';
  return 'Diamant';
}

function defaultWealthName(type: WealthAssetType, material: WealthMaterial, propertyType: string) {
  if (type === 'real_estate') return propertyType.trim() || 'Bien immobilier';
  return materialLabel(material);
}

function assetSubtitle(asset: WealthAsset) {
  if (asset.type === 'real_estate') return asset.propertyType?.trim() || 'Bien immobilier';
  const material = asset.material ? materialLabel(asset.material) : 'Matériau précieux';
  const weight = typeof asset.weight === 'number' ? `${asset.weight} ${asset.weightUnit ?? ''}`.trim() : null;
  if (asset.material === 'gold' && asset.karats) return `${material} ${asset.karats}k${weight ? ` · ${weight}` : ''}`;
  return weight ? `${material} · ${weight}` : material;
}

function valuationSourceLabel(asset: WealthAsset) {
  if (asset.valuationSource === 'market') return 'Cours en ligne';
  if (asset.valuationSource === 'manual') return 'Valeur manuelle';
  return 'Estimation locale';
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
}

function getSimulatedAccountLogoUrl(account: SimulatedAccount) {
  return account.logoUrl ?? getAccountLogoUrl(account.institution?.trim() || account.name) ?? getAccountLogoUrl(account.name);
}

function findInstitutionLogoId(account: SimulatedAccount) {
  const byLogo = account.logoUrl
    ? INSTITUTION_LOGO_OPTIONS.find((option) => option.logoUrl === account.logoUrl)
    : undefined;
  if (byLogo) return byLogo.id;

  const institution = account.institution?.trim().toLowerCase();
  if (!institution) return null;
  return INSTITUTION_LOGO_OPTIONS.find((option) => option.institution.toLowerCase() === institution)?.id ?? null;
}

function sortAccountsForDisplay(accounts: SimulatedAccount[]) {
  return [...accounts].sort((a, b) => {
    const aOrder = typeof a.displayOrder === 'number' ? a.displayOrder : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.displayOrder === 'number' ? b.displayOrder : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const byCreatedAt = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (Number.isFinite(byCreatedAt) && byCreatedAt !== 0) return byCreatedAt;

    return a.name.localeCompare(b.name, 'fr');
  });
}

function computeNetWorthBreakdown(
  scope: NetWorthChartScope,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  loansTotalBalance: number,
) {
  const accountAssets = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const accountDebts = accounts.reduce(
    (sum, account) => sum + creditUsedFromBalance(account.balance),
    0,
  );

  if (scope === 'inclusive') {
    return {
      totalAssets: accountAssets + offAccountAssetsBalance,
      totalDebts: accountDebts + loansTotalBalance,
    };
  }

  return {
    totalAssets: accountAssets,
    totalDebts: accountDebts,
  };
}

function buildNetWorthTrend(
  scope: NetWorthChartScope,
  netWorthTotal: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
) {
  const labels = buildRecentMonthLabels(NET_WORTH_TREND_MOVEMENTS.length + 1);
  if (accounts.length === 0 && offAccountAssetsBalance === 0) return labels.map((label) => ({ label, value: 0 }));
  if (scope === 'accounts_only' && accounts.length === 0) return labels.map((label) => ({ label, value: 0 }));

  const accountMagnitude = accounts.reduce((sum, account) => sum + Math.abs(account.balance), 0);
  const magnitudeSeed = accountMagnitude + (scope === 'inclusive' ? offAccountAssetsBalance : 0);
  const direction = netWorthTotal >= 0 ? 1 : -1;
  const currentValue = netWorthTotal === 0 ? Math.max(magnitudeSeed, 1000) * direction : netWorthTotal;
  const movementMultiplier = NET_WORTH_TREND_MOVEMENTS.reduce((product, movement) => product * (1 + movement), 1);
  const startingValue = currentValue / movementMultiplier;
  const values = NET_WORTH_TREND_MOVEMENTS.reduce<number[]>(
    (trendValues, movement) => {
      const previousValue = trendValues[trendValues.length - 1];
      return [...trendValues, previousValue * (1 + movement)];
    },
    [startingValue],
  );

  return values.map((value, index) => ({
    label: labels[index],
    value,
  }));
}

function buildRecentMonthLabels(monthCount: number) {
  const today = new Date();

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - monthCount + 1 + index, 1);
    return MONTH_LABELS_FR[date.getMonth()];
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
    gap: 0,
  },
  chartSectionWrap: {
    marginBottom: PORTFOLIO_BLOCK_GAP,
  },
  portfolioHeroBlock: {
    alignItems: 'flex-start',
    gap: 0,
    paddingHorizontal: PORTFOLIO_PAGE_PADDING,
  },
  portfolioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  portfolioHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portfolioHeaderIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioScopeWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: spacing.md,
  },
  pageTitle: {
    ...interExtraBoldText,
    fontSize: 32,
    letterSpacing: -0.8,
  },
  pageTitleInHeader: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  heroEyebrow: {
    marginBottom: 6,
  },
  deltaBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  deltaBadgeText: {
    ...interBoldText,
    fontSize: 13,
  },
  wealthSection: {
    gap: PORTFOLIO_SECTION_GAP,
  },
  premiumAddCta: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  premiumAddCtaLabel: {
    fontSize: typography.meta,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  wealthCompactEmptyText: {
    fontSize: typography.meta,
    lineHeight: 18,
  },
  wealthCards: {
    gap: PORTFOLIO_SECTION_GAP,
  },
  wealthPatrimoineAssetIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wealthPatrimoineAssetTitles: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  wealthPatrimoineAssetName: {
    ...rowLabel,
    fontWeight: '800',
  },
  wealthPatrimoineAssetSubtitle: {
    fontSize: typography.meta,
    fontWeight: '600',
    lineHeight: 18,
  },
  wealthCarouselFooter: {
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  wealthCarouselCounter: {
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  wealthVoirPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wealthVoirPlusLabel: {
    fontSize: typography.meta,
    fontWeight: '700',
  },
  wealthVoirPlusChevronWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wealthToggleBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  wealthToggleBadgeLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
  },
  wealthToggleCollapsedAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wealthToggleCollapsedAddLabel: {
    fontSize: typography.meta,
    fontWeight: '600',
  },
  wealthPatrimoineExpandedStack: {
    gap: spacing.lg,
  },
  wealthCard: {
    gap: spacing.lg,
  },
  wealthAssetIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  wealthGainBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  wealthGainBadgeText: {
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  wealthPctPill: {
    flexShrink: 0,
    alignSelf: 'center',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  wealthPctPillText: {
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 0.15,
  },
  wealthPerformanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  wealthValueBlock: {
    flex: 1,
    minWidth: 0,
  },
  wealthValueLabel: {
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  wealthValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  wealthCostText: {
    marginTop: 2,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  wealthGainPanel: {
    minWidth: 104,
    alignItems: 'flex-end',
    paddingVertical: 2,
  },
  wealthGainAmount: {
    fontSize: typography.body,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  wealthGainLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wealthMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  wealthSourceText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  wealthFormHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  wealthFormIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wealthMaterialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  wealthMaterialOption: {
    width: 92,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  wealthFinePrint: {
    fontSize: typography.meta,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.55,
  },
  accountPortfolioSection: {
    gap: 0,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: PORTFOLIO_BLOCK_GAP,
    paddingTop: spacing.sm,
  },
  accountVisualSection: {
    gap: spacing.lg,
  },
  wealthPortfolioSection: {
    gap: PORTFOLIO_SECTION_GAP,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: PORTFOLIO_BLOCK_BREAK,
    paddingTop: spacing.md,
  },
  wealthPortfolioSectionUnderChart: {
    marginTop: 0,
    paddingTop: 0,
  },
  accountVisualCards: {
    gap: spacing.md,
  },
  accountVisualCard: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: ACCOUNT_VISUAL_CARD_MIN_HEIGHT,
    justifyContent: 'space-between',
    position: 'relative',
  },
  accountVisualTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  accountVisualIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountVisualIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountVisualIconFallback: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accountVisualLogoImage: { width: 32, height: 32 },
  accountVisualNameGroup: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  accountVisualName: {
    color: colors.text,
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  accountVisualMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  accountVisualBalanceStack: {
    flexShrink: 0,
    maxWidth: '40%',
    alignItems: 'flex-end',
    gap: 2,
  },
  accountVisualAmount: {
    ...rowValue,
    letterSpacing: -0.45,
    textAlign: 'right',
  },
  accountVisualStatusPill: {
    alignSelf: 'flex-end',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  accountVisualStatusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  accountVisualLowerZone: {
    minWidth: 0,
    minHeight: ACCOUNT_VISUAL_LOWER_SECTION_MIN_HEIGHT,
    justifyContent: 'center',
    gap: 8,
  },
  accountVisualTrackGroup: {
    minWidth: 0,
    width: '100%',
    minHeight: ACCOUNT_CREDIT_PROGRESS_SECTION_HEIGHT,
    justifyContent: 'center',
    gap: ACCOUNT_VISUAL_PROGRESS_GROUP_GAP,
  },
  accountVisualMonthlyFlowGroup: {
    minWidth: 0,
    width: '100%',
    justifyContent: 'center',
    minHeight: 36,
    gap: 7,
  },
  accountVisualFlowSplit: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 0,
    gap: 14,
  },
  accountVisualFlowItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountVisualFlowTextStack: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  accountVisualFlowColumnLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  accountVisualFlowColumnAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  accountVisualTrack: {
    width: '100%',
    height: PROGRESS_BAR_TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: ghost.obsidianSoft,
  },
  accountVisualFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  accountVisualDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: ACCOUNT_VISUAL_PROGRESS_DETAIL_ROW_MIN_HEIGHT,
  },
  accountVisualDetailText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  accountVisualDetailValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  accountVisualLimitNearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  accountVisualLimitNearBannerText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.12,
  },
  emptyVisualIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  balanceChartCard: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  balanceChartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  balanceChartTitleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  balanceChartTitle: {
    ...SECTION_TITLE_STYLE,
    color: colors.text,
  },
  balanceChartManageButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 22,
  },
  balanceChartEmpty: {
    borderRadius: radius.card,
    backgroundColor: colors.cardBackground,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  balanceChartEmptyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  balanceChartEmptyText: {
    color: colors.textMuted,
    fontSize: typography.meta,
    lineHeight: typography.meta + 5,
  },
  compositionTrack: {
    height: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: ghost.obsidianSoft,
  },
  compositionSegment: {
    height: '100%',
  },
  compositionAssets: {
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
  },
  compositionLiabilities: {
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  balanceChartLegend: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  legendItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  legendValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '800',
    textAlign: 'right',
  },
  accountBars: {
    gap: spacing.md,
  },
  accountBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountBarCopy: {
    flex: 0.92,
    minWidth: 0,
    gap: 2,
  },
  accountBarName: {
    color: colors.text,
    fontSize: typography.meta,
    fontWeight: '800',
  },
  accountBarKind: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '600',
  },
  accountBarVisualGroup: {
    flex: 1.2,
    minWidth: 0,
    gap: spacing.xs,
  },
  accountBarAmount: {
    color: colors.text,
    fontSize: typography.meta,
    fontWeight: '800',
    textAlign: 'right',
  },
  accountBarTrack: {
    height: 9,
    alignItems: 'flex-end',
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: ghost.obsidianSoft,
  },
  accountBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  floatingActions: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: spacing.sm,
    zIndex: 10,
    elevation: 10,
  },
  floatingActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 92,
    minHeight: 46,
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...ghostCardShadow,
  },
  primaryFloatingAction: {
    borderColor: colors.primary,
  },
  floatingActionText: {
    color: colors.text,
    fontSize: typography.meta,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  pressed: { opacity: 0.78 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  modalSheet: {
    maxHeight: '86%',
    backgroundColor: colors.surfaceSolid,
    borderRadius: 30,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...ghostCardShadow,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: spacing.md,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ghost.obsidianSoft,
  },
  modalContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  accountManagerTitleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  accountManagerHint: {
    fontSize: typography.meta,
    lineHeight: 18,
  },
  accountManagerList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  accountManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  accountManagerIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountManagerName: {
    ...rowLabel,
    fontWeight: '800',
  },
  accountManagerMeta: {
    fontSize: typography.micro,
    fontWeight: '800',
  },
  accountManagerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accountManagerIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accountVisibilityButton: {
    width: 38,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accountDetailSheet: {
    maxHeight: '88%',
    backgroundColor: colors.surfaceSolid,
    borderRadius: 30,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...ghostCardShadow,
  },
  accountDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accountDetailIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accountDetailLogoImage: { width: 30, height: 30 },
  accountDetailTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountDetailEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  accountDetailEditText: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '800',
  },
  accountDetailSummary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  accountDetailSummaryLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  accountDetailSummaryAmount: {
    color: colors.text,
    fontSize: typography.heroStat,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  accountDetailSummaryMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    paddingBottom: 4,
  },
  accountDetailContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  recurringList: {
    gap: spacing.xs,
    marginTop: -spacing.xs,
  },
  recurringPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  recurringPaymentIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringPaymentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recurringPaymentName: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  recurringPaymentMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  recurringPaymentAmount: {
    color: colors.text,
    fontSize: typography.meta,
    fontWeight: '800',
    flexShrink: 0,
  },
  accountDetailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  accountDetailSectionTitle: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  accountDetailSectionMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  accountTransactionsList: {
    gap: spacing.xs,
  },
  accountDetailEmpty: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  formCard: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  formHeadCopy: { flex: 1, minWidth: 0, gap: 4 },
  formTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  formHint: { color: colors.textMuted, fontSize: typography.meta, lineHeight: 17 },
  logoPreviewWrap: {
    position: 'relative',
    paddingRight: 4,
    paddingBottom: 4,
  },
  logoPreview: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackPreview: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  logoEditButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 5,
  },
  logoImage: { width: 30, height: 30 },
  logoPickerGroup: {
    gap: spacing.sm,
  },
  logoPickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  logoPickerHint: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  logoOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logoOption: {
    width: 58,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  logoOptionActive: {
    backgroundColor: colors.scopeActive,
  },
  logoOptionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackOptionIcon: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  logoOptionImage: { width: 24, height: 24 },
  logoOptionText: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '800',
    textAlign: 'center',
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  loanDurationRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  loanDurationAmount: { flex: 1, minWidth: 110 },
  loanDurationUnitRow: { flex: 1, paddingBottom: 2 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { color: colors.textSecondary, fontSize: typography.meta, fontWeight: '600' },
  inputGroup: { gap: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingRight: spacing.md,
  },
  inputWithSuffix: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: typography.body,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.md,
  },
  inputSuffix: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  saveText: { color: colors.background, fontSize: typography.body, fontWeight: '800' },
  groupCard: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.card,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  accountRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  accName: { ...rowLabel, color: colors.text, fontWeight: '800' },
  accNum: { color: colors.textMuted, fontSize: typography.meta },
  accBal: { ...rowValue, color: colors.text, flexShrink: 0 },
  neg: { color: colors.danger },
  empty: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    padding: spacing.lg,
    textAlign: 'center',
  },
  loansSectionContainer: {
    gap: PORTFOLIO_SECTION_GAP,
    marginTop: PORTFOLIO_BLOCK_BREAK,
    paddingTop: spacing.md,
  },
  loansSectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  loansExpandedContent: {
    gap: spacing.sm,
  },
  loanCardList: {
    gap: spacing.sm,
  },
  loanCard: {
    gap: spacing.sm,
  },
  loanCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loanCardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  loanCardTitles: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  loanCardName: {
    ...rowLabel,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  loanCardSub: {
    fontSize: typography.meta,
    fontWeight: '500',
  },
  loanCardAmountStack: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  loanCardBalance: {
    ...rowValue,
    letterSpacing: -0.45,
    textAlign: 'right',
  },
  loanCardBalanceLabel: {
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  loanProgressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  loanProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  loanCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loanCardMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loanCardMeta: {
    fontSize: typography.meta,
    fontWeight: '500',
  },
  loanDeleteBtn: {
    padding: 4,
  },
});
