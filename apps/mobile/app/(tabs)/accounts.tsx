import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { PaymentMethodField, type PaymentMethodAccount } from '@/components/PaymentMethodField';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { HubSectionHeader } from '@/components/plans/HubSectionHeader';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { PageTransition } from '@/components/PageTransition';
import { PatrimoineHoldingsSections } from '@/components/PatrimoineHoldingsSections';
import { ReorderableAccountBalanceList } from '@/components/ReorderableAccountBalanceList';
import { MOCK_STOCK_HOLDINGS } from '@/constants/mockStockPortfolio';
import { WealthMaterialIcon } from '@/components/WealthMaterialIcon';
import { GlassContainer } from '@/components/GlassContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import {
  ALL_NET_WORTH_CHART_PERIODS,
  PATRIMOINE_NET_WORTH_CHART_PERIODS,
  PATRIMOINE_NET_WORTH_PERIOD_LABELS,
  PortfolioChartCard,
  type NetWorthChartPeriod,
  type PortfolioChartCardHandle,
  type PortfolioChartCardPeriodData,
  CHART_FULL_BLEED_RIGHT_INSET,
} from '@/components/PortfolioChartCard';
import {
  FLOATING_SCROLL_SIZE,
  floatingGlassButtonPressed,
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
  ICON_WELL_SIZE,
  MERCHANT_LOGO_SIZE,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  PROGRESS_BAR_TRACK_HEIGHT,
  radius,
  spacing,
  typography,
  chartTokens,
  moneyAmountTypography,
  type AppColors,
  typographyKit,
} from '@/constants/theme';
import {
  buildCashflowTrendFromTransactions,
  buildCashflowTrendForChartPeriod,
  getCurrentCashflowTotal,
} from '@/lib/buildCashflowTrendSeries';
import {
  buildPatrimoineTrendFromMockStocks,
  getCurrentPatrimoineTotalFromMockStocks,
} from '@/lib/buildPatrimoineTrendFromMockStocks';
import {
  getCurrentMonthAccountMoneyFlows,
  deleteLoan,
  getContacts,
  getLoans,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactions,
  getWealthAssets,
  insertSimulatedAccount,
  updateSimulatedAccountPreferences,
  upsertContactByName,
  upsertLoan,
  upsertWealthAsset,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { creditLimitUtilizationBarColor } from '@/lib/creditLimitUtilization';
import { estimateWealthAssetValue } from '@/lib/assetValuation';
import {
  filterPatrimoineWealthAssets,
  getWealthAssetDisplayValue,
  realEstateAssetName,
} from '@/lib/wealthAssetPresentation';
import {
  capturePropertyPhoto,
  pickPropertyPhotoFromGallery,
  promptPropertyPhotoSource,
} from '@/lib/propertyPhoto';
import { MORTGAGE_DEFAULT_REASON, syncMortgageWealthAsset } from '@/lib/mortgageWealthSync';
import { HeroChartDelta } from '@/components/HeroChartDelta';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { formatDisplayMoney, formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { formatNumberInput, parseFormattedNumber, sanitizeNumericInput } from '@/lib/formatNumber';
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';
import {
  dashboardPaymentAmount,
  rowLabel,
  rowTitleTextProps,
  rowValue,
  singleLineAmountProps,
} from '@/lib/textLayout';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import type { MdiIconName } from '@/lib/mdiIconCatalog';
import { defaultLoanIcon, resolveLoanIcon } from '@/lib/loanIcons';
import {
  CHILD_SUPPORT_BENEFICIARY_HINT,
  CHILD_SUPPORT_BENEFICIARY_LABEL,
  CHILD_SUPPORT_BENEFICIARY_PLACEHOLDER,
  formatLoanDisplayTitle,
  resolveLoanReason,
} from '@/lib/loanPresentation';
import { shouldLoanSyncRecurringPayment, syncLoanRecurringPayment } from '@/lib/syncLoanRecurringPayment';
import {
  CHILD_SUPPORT_BENEFICIARY_RELATIONS,
  CHILD_SUPPORT_PAYMENT_MODES,
  CHILD_SUPPORT_PRIVATE_PROOF_REMINDER,
  CHILD_SUPPORT_QUICK_PAYMENT_DAYS,
  CHILD_SUPPORT_RECIPIENT_REVENU_QUEBEC,
  computeNextChildSupportPaymentDate,
  formatChildSupportBeneficiaryRelation,
  formatChildSupportPaymentDay,
  formatChildSupportPaymentDayLabel,
  parseChildSupportFromLoan,
} from '@/lib/childSupportLoan';
import {
  getNetWorthChartScope,
  setNetWorthChartScope,
  type NetWorthChartScope,
} from '@/lib/settings';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { normalizeSearch } from '@/lib/categoryInference';
import {
  buildContactDirectoryRows,
  findContactByName,
  resolveContactIdForName,
  searchContactSuggestions,
} from '@/lib/contactHistory';
import { useAppTheme } from '@/lib/themeContext';
import type { AccountMoneyFlow } from '@/lib/accountTransactionFlow';
import type {
  AccountKind,
  ChildSupportBeneficiaryRelation,
  Contact,
  Loan,
  LoanDurationUnit,
  LoanPaymentDebitType,
  LoanPaymentFrequency,
  LoanRateType,
  LoanType,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
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
  { id: 'cash', label: 'Argent Cash', icon: 'wallet-outline' },
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

const WEALTH_PROPERTY_TYPE_OPTIONS = [
  'Maison',
  'Condo',
  'Duplex',
  'Semi-détaché',
  'Triplex',
  'Studio',
  'Immeuble à revenus',
] as const;

const LOAN_TYPE_OPTIONS: Array<{ id: LoanType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'friend_debt', label: 'Dette à un particulier', icon: 'people-outline' },
  { id: 'personal_loan', label: 'Prêt personnel', icon: 'cash-outline' },
  { id: 'line_of_credit', label: 'Marge de crédit', icon: 'card-outline' },
  { id: 'mortgage', label: 'Hypothèque', icon: 'home-outline' },
  { id: 'child_support', label: 'Pension alimentaire', icon: 'heart-outline' },
];

type PickerOption<T extends string> = {
  id: T;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ACCOUNT_TYPE_PICKER_OPTIONS: PickerOption<AccountKind>[] = [
  { id: 'credit', label: 'Carte de crédit', description: 'Limite, solde dû, institution', icon: 'card-outline' },
  { id: 'checking', label: 'Compte chèque', description: 'Solde et institution', icon: 'wallet-outline' },
  { id: 'savings', label: 'Épargne', description: 'Épargne et taux d’intérêt', icon: 'cash-outline' },
  { id: 'cash', label: 'Argent Cash', description: 'Espèces, solde manuel', icon: 'wallet-outline' },
];

const LOAN_TYPE_PICKER_OPTIONS: PickerOption<LoanType>[] = [
  { id: 'friend_debt', label: 'Dette à un particulier', description: 'Créancier, raison, montant, échéance', icon: 'people-outline' },
  { id: 'personal_loan', label: 'Prêt personnel', description: 'Raison, prêteur, solde, taux, mensualité', icon: 'cash-outline' },
  { id: 'line_of_credit', label: 'Marge de crédit', description: 'Raison, institution, limite, solde utilisé', icon: 'card-outline' },
  { id: 'mortgage', label: 'Hypothèque', description: 'Mise de fonds, taux, paiements', icon: 'home-outline' },
  { id: 'child_support', label: 'Pension alimentaire', description: 'Revenu Québec ou accord privé, montants et compte de paie', icon: 'heart-outline' },
];

function loanFormHint(type: LoanType): string {
  if (type === 'mortgage') return 'Hypothèque en dette, paiements planifiés.';
  if (type === 'friend_debt') return 'Réduit ta valeur nette.';
  if (type === 'child_support') return 'Obligation récurrente planifiée.';
  return 'Solde en dette, paiements planifiés.';
}

const WEALTH_TYPE_PICKER_OPTIONS: PickerOption<WealthAssetType>[] = [
  { id: 'precious_material', label: 'Métaux précieux', description: 'Or, argent, platine, diamant', icon: 'diamond-outline' },
  { id: 'real_estate', label: 'Bien immobilier', description: 'Prix payé, date, valeur actuelle', icon: 'home-outline' },
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

const MORTGAGE_PAYMENT_FREQUENCIES: Array<{ id: LoanPaymentFrequency; label: string }> = [
  { id: 'monthly', label: 'Mensuel' },
  { id: 'biweekly', label: 'Aux 2 semaines' },
];

const LOAN_RATE_TYPES: Array<{ id: LoanRateType; label: string }> = [
  { id: 'fixed', label: 'Fixe' },
  { id: 'variable', label: 'Variable' },
];

const MORTGAGE_AMORTIZATION_YEARS = [15, 20, 25, 30] as const;

const LOAN_PAYMENT_DEBIT_TYPES: Array<{ id: LoanPaymentDebitType; label: string }> = [
  { id: 'automatic', label: 'Automatique' },
  { id: 'manual', label: 'Manuel' },
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
const LIGHT_SECTION_SURFACE = '#F6F8FA';
const LIGHT_SECTION_CARD_SURFACE = '#FFFFFF';
const LIGHT_SECTION_SOFT_SURFACE = '#F6F8FA';
const LIGHT_SECTION_BORDER = '#D0D7DE';
/** Espacement vertical entre blocs majeurs (chart → comptes → patrimoine / prêts). */
const PORTFOLIO_BLOCK_GAP = spacing.xl;
const PORTFOLIO_BLOCK_BREAK = spacing.xxl + spacing.lg;
const CHART_HUB_SCOPE_LABELS: Record<NetWorthChartScope, string> = {
  accounts_only: 'FLUX DE TRÉSORERIE',
  inclusive: 'PATRIMOINE',
};

const CHART_HUB_LAYOUT = {
  cardVariant: 'flat' as const,
  cardPadding: 0,
  plotHorizontalInset: 0,
  plotHorizontalInsetRight: CHART_FULL_BLEED_RIGHT_INSET,
} as const;
const PATRIMOINE_PERIOD_REAL_WINDOW_OVERRIDE = {
  '1J': 2,
  '1S': 8,
  '1M': 30,
  '6M': 180,
  '1A': 365,
} as const;
const PATRIMOINE_PERIOD_MAX_POINTS_OVERRIDE = {
  '1J': 2,
  '1S': 8,
  '1M': 30,
  '6M': 42,
  '1A': 56,
} as const;

const PAGE_SECTION_BREAK = spacing.lg;
const CHART_RED = chartTokens.negative;

type PortfolioScrollTarget = 'balances' | 'wealth';
type PortfolioScrollStage = 'top' | 'bottom' | PortfolioScrollTarget;
type PortfolioSectionMetrics = Record<PortfolioScrollTarget, { y: number; height: number }>;
type PortfolioScrollOffsetMode = 'center' | 'top';

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

/** Actif : pas de « + » ; négatif seulement avec « − ». */
function formatPortfolioAsset(value: number) {
  if (value < 0) return `−${formatDisplayMoneyAbsolute(Math.abs(value))}`;
  return formatDisplayMoneyAbsolute(value);
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

function effectiveLoanDurationUnit(loanType: LoanType, durationUnit: LoanDurationUnit): LoanDurationUnit {
  return loanType === 'mortgage' ? 'years' : durationUnit;
}

function loanDurationAmountInYears(amount: number, unit: LoanDurationUnit): number {
  if (!Number.isFinite(amount) || amount <= 0) return 25;
  return unit === 'years' ? amount : Math.max(1, Math.round(amount / 12));
}

function formatSignedMoney(value: number) {
  return formatCompactCurrency(value);
}

function PortfolioPageHeader() {
  const { colors } = useAppTheme();

  return (
    <View style={styles.pageHeroBlock}>
      <View style={styles.pageHeaderRow}>
        <Text style={[styles.pageTitle, { color: colors.text }]} numberOfLines={1}>
          Portefeuille
        </Text>
      </View>
    </View>
  );
}

export default function AccountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editWealthAssetId?: string; editLoanId?: string }>();
  const editWealthAssetId =
    typeof params.editWealthAssetId === 'string' ? params.editWealthAssetId.trim() : '';
  const editLoanId = typeof params.editLoanId === 'string' ? params.editLoanId.trim() : '';
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, ghost, ghostCardShadow, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const portfolioChartRef = useRef<PortfolioChartCardHandle>(null);
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
  const pendingPortfolioSectionScrollRef = useRef<PortfolioScrollTarget | null>(null);
  const scrollToPortfolioSectionRef = useRef<(target: PortfolioScrollTarget) => void>(() => {});
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [accountMonthlyFlows, setAccountMonthlyFlows] = useState<Record<string, AccountMoneyFlow>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAccountTypePicker, setShowAccountTypePicker] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [isAccountListDragging, setIsAccountListDragging] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SimulatedAccount | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('checking');
  const [last4, setLast4] = useState('');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [selectedInstitutionLogoId, setSelectedInstitutionLogoId] = useState<string | null>(null);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [portfolioScrollStage, setPortfolioScrollStage] = useState<PortfolioScrollStage>('top');
  const [wealthAssets, setWealthAssets] = useState<WealthAsset[]>([]);
  const [showWealthForm, setShowWealthForm] = useState(false);
  const [showWealthTypePicker, setShowWealthTypePicker] = useState(false);
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
  const [wealthPhotoUri, setWealthPhotoUri] = useState('');
  const [wealthEditingAsset, setWealthEditingAsset] = useState<WealthAsset | null>(null);
  const [netWorthChartScope, setNetWorthChartScopeState] = useState<NetWorthChartScope>('inclusive');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showLoanTypePicker, setShowLoanTypePicker] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [loanType, setLoanType] = useState<LoanType>('personal_loan');
  const [loanReason, setLoanReason] = useState('');
  const [savedContacts, setSavedContacts] = useState<Contact[]>([]);
  const [loanBeneficiaryContactId, setLoanBeneficiaryContactId] = useState<string | null>(null);
  const [creatingLoanBeneficiaryContact, setCreatingLoanBeneficiaryContact] = useState(false);
  const [loanAddress, setLoanAddress] = useState('');
  const [loanDownPayment, setLoanDownPayment] = useState('');
  const [loanPurchasePrice, setLoanPurchasePrice] = useState('');
  const [loanCurrentPropertyValue, setLoanCurrentPropertyValue] = useState('');
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
  const [loanRateType, setLoanRateType] = useState<LoanRateType>('fixed');
  const [loanRateTermYears, setLoanRateTermYears] = useState('5');
  const [loanRenewalDate, setLoanRenewalDate] = useState('');
  const [loanAmortizationYears, setLoanAmortizationYears] = useState('25');
  const [loanPaymentDebitType, setLoanPaymentDebitType] = useState<LoanPaymentDebitType>('automatic');
  const [loanBeneficiaryRelation, setLoanBeneficiaryRelation] = useState<ChildSupportBeneficiaryRelation | null>(null);
  const [loanIcon, setLoanIcon] = useState<MdiIconName>(defaultLoanIcon('personal_loan'));
  const [showLoanIconPicker, setShowLoanIconPicker] = useState(false);
  const [confirmLoanDeleteVisible, setConfirmLoanDeleteVisible] = useState(false);
  const [pendingLoanDeleteId, setPendingLoanDeleteId] = useState<string | null>(null);
  const [chartPeriodData, setChartPeriodData] = useState<PortfolioChartCardPeriodData | null>(null);
  const handleChartPeriodData = useCallback((data: PortfolioChartCardPeriodData) => {
    setChartPeriodData((prev) => {
      if (
        prev &&
        prev.period === data.period &&
        prev.currentValue === data.currentValue &&
        prev.delta === data.delta &&
        prev.deltaPercent === data.deltaPercent &&
        prev.selectedIndex === data.selectedIndex &&
        prev.selectedLabel === data.selectedLabel
      ) {
        return prev;
      }
      return data;
    });
  }, []);
  const clearPortfolioChartSelection = useCallback(() => {
    portfolioChartRef.current?.clearSelection();
  }, []);
  const load = useCallback(async () => {
    const [nextAccounts, nextSavingsGoals, nextWealthAssets, flows, nextLoans, nextTransactions, nextContacts] =
      await Promise.all([
      getSimulatedAccounts(),
      getSavingsGoals(),
      getWealthAssets(),
      getCurrentMonthAccountMoneyFlows(),
      getLoans(),
      getTransactions(),
      getContacts(),
    ]);
    setAccounts(nextAccounts);
    setSavingsGoals(nextSavingsGoals);
    setWealthAssets(nextWealthAssets);
    setAccountMonthlyFlows(flows);
    setLoans(nextLoans);
    setTransactions(nextTransactions);
    setSavedContacts(nextContacts);
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
    setChartPeriodData(null);
    clearPortfolioChartSelection();
    pendingPortfolioSectionScrollRef.current = null;
    clearPortfolioProgrammaticScroll();
    portfolioProgrammaticScrollStageRef.current = null;
    setPortfolioScrollState('top');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [clearPortfolioChartSelection]);

  const handleWealthPropertyTypeChange = useCallback((value: string) => {
    setWealthPropertyType(value);
    setWealthName(value);
  }, []);

  const populateWealthFromAsset = useCallback((asset: WealthAsset) => {
    setWealthEditingAsset(asset);
    setWealthType(asset.type);
    if (asset.type === 'precious_material') {
      setWealthName(asset.name);
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
      const propertyType = asset.propertyType ?? '';
      setWealthPropertyType(propertyType);
      setWealthName(propertyType.trim() ? realEstateAssetName(propertyType) : asset.name);
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
    setWealthPhotoUri(asset.photoUri?.trim() ?? '');
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

  const orderedAccounts = useMemo(() => sortAccountsForDisplay(accounts), [accounts]);
  const visibleAccounts = useMemo(() => orderedAccounts.filter((account) => !account.hidden), [orderedAccounts]);
  const patrimoineWealthAssets = useMemo(
    () => filterPatrimoineWealthAssets(wealthAssets),
    [wealthAssets],
  );
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);
  const chartPatrimoineTotal = useMemo(
    () => getCurrentPatrimoineTotalFromMockStocks(MOCK_STOCK_HOLDINGS),
    [],
  );
  const chartCashflowTotal = useMemo(
    () => getCurrentCashflowTotal(accounts, transactions),
    [accounts, transactions],
  );
  const chartHeroFallbackTotal =
    netWorthChartScope === 'inclusive' ? chartPatrimoineTotal : chartCashflowTotal;
  const chartHubLayoutProps = useMemo(
    () => ({
      ...CHART_HUB_LAYOUT,
      eyebrowStyle: [styles.heroEyebrow, styles.heroEyebrowCashFlow],
      chartBleedStyle: styles.chartScreenBleed(screenWidth),
    }),
    [screenWidth],
  );
  const portfolioChartPoints = useMemo(
    () =>
      netWorthChartScope === 'inclusive'
        ? buildPatrimoineTrendFromMockStocks(MOCK_STOCK_HOLDINGS)
        : buildCashflowTrendFromTransactions(accounts, transactions),
    [netWorthChartScope, accounts, transactions],
  );
  const getCashflowChartPoints = useCallback(
    (period: NetWorthChartPeriod) =>
      buildCashflowTrendForChartPeriod(accounts, transactions, period),
    [accounts, transactions],
  );
  const portfolioChartAllowedPeriods = useMemo(
    () =>
      netWorthChartScope === 'inclusive'
        ? PATRIMOINE_NET_WORTH_CHART_PERIODS
        : ALL_NET_WORTH_CHART_PERIODS,
    [netWorthChartScope],
  );
  const portfolioChartPeriodLabels = useMemo(
    () => (netWorthChartScope === 'inclusive' ? PATRIMOINE_NET_WORTH_PERIOD_LABELS : undefined),
    [netWorthChartScope],
  );
  const logoSourceName = institution.trim() || name.trim();
  const selectedInstitutionLogo = useMemo(
    () => INSTITUTION_LOGO_OPTIONS.find((option) => option.id === selectedInstitutionLogoId) ?? null,
    [selectedInstitutionLogoId],
  );
  const autoPreviewLogo = useMemo(() => getAccountLogoUrl(logoSourceName), [logoSourceName]);
  const previewLogo = selectedInstitutionLogo?.logoUrl ?? autoPreviewLogo;
  const computedLoanEndDate = useMemo(
    () => computeLoanEndDate(
      loanStartDate,
      loanDurationAmount,
      effectiveLoanDurationUnit(loanType, loanDurationUnit),
    ),
    [loanDurationAmount, loanDurationUnit, loanStartDate, loanType],
  );
  const selectedLoanPaymentAccount = useMemo(
    () => accounts.find((account) => account.id === loanPaymentAccountId) ?? null,
    [accounts, loanPaymentAccountId],
  );
  const formThemed = usePortfolioFormTheme();
  const resetForm = () => {
    setEditingAccount(null);
    setName('');
    setKind('checking');
    setLast4('');
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
    setShowAccountTypePicker(true);
  };

  const handleAccountTypeSelect = (selectedKind: AccountKind) => {
    tapHaptic();
    setShowAccountTypePicker(false);
    resetForm();
    setKind(selectedKind);
    if (selectedKind === 'cash') {
      setName('Argent Cash');
    }
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setFormFeedback(null);
    setShowForm(false);
  };

  const showPortfolioFormError = (title: string, message: string) => {
    setFormFeedback(formValidationError(title, message));
  };

  const childSupportContactDirectoryRows = useMemo(
    () => buildContactDirectoryRows(transactions, savedContacts),
    [savedContacts, transactions],
  );
  const childSupportContactSuggestions = useMemo(() => {
    if (loanType !== 'child_support') return [];
    if (loanReason.trim().length < 3) return [];
    return searchContactSuggestions(savedContacts, loanReason, 5, childSupportContactDirectoryRows);
  }, [childSupportContactDirectoryRows, loanReason, loanType, savedContacts]);
  const isKnownChildSupportContactName = useCallback(
    (name: string) => {
      const normalized = normalizeSearch(name);
      if (!normalized) return false;
      return childSupportContactDirectoryRows.some((row) => row.key === normalized);
    },
    [childSupportContactDirectoryRows],
  );
  const updateChildSupportBeneficiary = (value: string) => {
    setLoanReason(value);
    setLoanBeneficiaryContactId(findContactByName(savedContacts, value)?.id ?? null);
  };
  const selectChildSupportBeneficiary = (name: string) => {
    tapHaptic();
    setLoanReason(name);
    setLoanBeneficiaryContactId(resolveContactIdForName(savedContacts, name));
  };
  const handleCreateLoanBeneficiaryContact = async () => {
    const name = loanReason.trim();
    if (!name || isKnownChildSupportContactName(name) || loanBeneficiaryContactId) return;

    setCreatingLoanBeneficiaryContact(true);
    try {
      const contact = await upsertContactByName(name);
      setSavedContacts((current) => {
        const key = contact.normalizedName;
        const without = current.filter((item) => item.normalizedName !== key);
        return [...without, contact].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      });
      setLoanBeneficiaryContactId(contact.id);
      successHaptic();
    } catch {
      showPortfolioFormError('Erreur', 'Impossible de créer ce contact.');
    } finally {
      setCreatingLoanBeneficiaryContact(false);
    }
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

  const handleVisibleAccountsReorder = async (nextVisibleAccounts: SimulatedAccount[]) => {
    const hiddenAccounts = orderedAccounts.filter((account) => account.hidden);
    await persistAccountDisplayPreferences([
      ...nextVisibleAccounts.map((account, index) => ({
        ...account,
        displayOrder: index,
      })),
      ...hiddenAccounts.map((account, index) => ({
        ...account,
        displayOrder: nextVisibleAccounts.length + index,
      })),
    ]);
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

    if (pendingPortfolioSectionScrollRef.current === target && height > 0) {
      pendingPortfolioSectionScrollRef.current = null;
      requestAnimationFrame(() => {
        scrollToPortfolioSectionRef.current(target);
      });
    }
  };

  const clampPortfolioScrollOffset = (rawOffset: number) => {
    const viewportHeight = portfolioViewportHeightRef.current;
    const contentHeight = portfolioContentHeightRef.current;
    const maxOffset = viewportHeight > 0 && contentHeight > 0 ? Math.max(contentHeight - viewportHeight, 0) : undefined;
    const clampedOffset = Math.max(rawOffset, 0);

    return typeof maxOffset === 'number' ? Math.min(clampedOffset, maxOffset) : clampedOffset;
  };

  const getPortfolioScrollOffset = (target: PortfolioScrollTarget, mode: PortfolioScrollOffsetMode = 'center') => {
    const viewportHeight = portfolioViewportHeightRef.current;
    const section = portfolioSectionMetricsRef.current[target];
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

    return clampPortfolioScrollOffset(rawOffset);
  };

  const getPortfolioBottomScrollOffset = () => {
    const viewportHeight = portfolioViewportHeightRef.current;
    const contentHeight = portfolioContentHeightRef.current;
    return viewportHeight > 0 && contentHeight > 0 ? Math.max(contentHeight - viewportHeight, 0) : 0;
  };

  const setPortfolioScrollState = (stage: PortfolioScrollStage) => {
    setPortfolioScrollStage(stage);
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

    const bottomOffset = getPortfolioBottomScrollOffset();
    const bottomThreshold = Math.max(bottomOffset - spacing.lg, spacing.xs);
    if (bottomOffset > 0 && offsetY >= bottomThreshold) {
      setPortfolioScrollState('bottom');
      return;
    }

    const balancesOffset = getPortfolioScrollOffset('balances', 'top');
    const balancesThreshold = Math.max(balancesOffset * 0.35, spacing.lg);

    if (offsetY >= balancesThreshold) {
      setPortfolioScrollState('balances');
    } else {
      setPortfolioScrollState('top');
    }
  };

  const scrollToPortfolioTop = () => {
    tapHaptic();
    beginPortfolioProgrammaticScroll('top');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const scrollToPortfolioBottom = () => {
    tapHaptic();
    beginPortfolioProgrammaticScroll('bottom');
    scrollRef.current?.scrollTo({
      y: getPortfolioBottomScrollOffset(),
      animated: true,
    });
  };

  const scrollToPortfolioSection = (target: PortfolioScrollTarget) => {
    tapHaptic();
    beginPortfolioProgrammaticScroll(target);
    scrollRef.current?.scrollTo({
      y: getPortfolioScrollOffset(target, 'top'),
      animated: true,
    });
  };
  scrollToPortfolioSectionRef.current = scrollToPortfolioSection;

  const saveAccount = async () => {
    const parsedBalance = parseMoney(balance);
    if (!name.trim()) {
      showPortfolioFormError('Nom requis', 'Exemple : Visa Desjardins, Tangerine chèque.');
      return;
    }
    if (Number.isNaN(parsedBalance)) {
      showPortfolioFormError('Solde invalide', 'Entre un montant valide.');
      return;
    }

    const account: SimulatedAccount = {
      id: editingAccount?.id ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      kind,
      balance: kind === 'credit' ? -Math.abs(parsedBalance) : parsedBalance,
      institution:
        kind === 'cash'
          ? undefined
          : selectedInstitutionLogo?.institution ?? (institution.trim() || undefined),
      last4: kind === 'credit' ? (last4.trim() || editingAccount?.last4) : undefined,
      creditLimit: kind === 'credit' ? parseOptionalMoney(creditLimit) : undefined,
      dueDay: kind === 'credit' ? parseOptionalInt(dueDay) : undefined,
      interestRate: kind === 'savings' ? parseOptionalMoney(interestRate) : undefined,
      logoUrl:
        kind === 'cash'
          ? undefined
          : selectedInstitutionLogo?.logoUrl ?? getAccountLogoUrl(logoSourceName) ?? undefined,
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
    setWealthPhotoUri('');
    setIsSavingWealth(false);
  };

  const clearWealthEditRouteParam = () => {
    if (!editWealthAssetId) return;
    router.setParams({ editWealthAssetId: undefined });
  };

  const openNewWealthForm = () => {
    tapHaptic();
    clearWealthEditRouteParam();
    setShowWealthTypePicker(true);
  };

  const handleWealthTypeSelect = (selectedType: WealthAssetType) => {
    tapHaptic();
    setShowWealthTypePicker(false);
    clearWealthEditRouteParam();
    resetWealthForm();
    setWealthType(selectedType);
    setShowWealthForm(true);
  };

  const closeWealthForm = () => {
    clearWealthEditRouteParam();
    resetWealthForm();
    setFormFeedback(null);
    setShowWealthForm(false);
  };

  const saveWealthAsset = async () => {
    const isEditing = Boolean(wealthEditingAsset);
    const parsedPurchaseCost = parseMoney(wealthPurchaseCost);
    const weight = parseMoney(wealthWeight);
    const manualCurrentValue = parseOptionalMoney(wealthCurrentValue);
    const purchaseCost = !isEditing && wealthType === 'precious_material' && Number.isNaN(parsedPurchaseCost)
      ? (manualCurrentValue ?? 0)
      : parsedPurchaseCost;

    if (wealthType === 'real_estate' && !isEditing) {
      if (Number.isNaN(purchaseCost) || purchaseCost < 0) {
        showPortfolioFormError('Prix requis', 'Entre le prix payé à l’achat.');
        return;
      }
      if (typeof manualCurrentValue !== 'number') {
        showPortfolioFormError('Valeur requise', 'Entre la valeur actuelle du bien.');
        return;
      }
    }

    if (wealthType === 'real_estate' && typeof manualCurrentValue !== 'number' && isEditing) {
      showPortfolioFormError('Valeur requise', 'Entre une estimation de la valeur marchande.');
      return;
    }

    if (wealthType === 'precious_material' && !isEditing) {
      if (Number.isNaN(weight) || weight <= 0) {
        showPortfolioFormError('Quantité requise', 'Entre la quantité de métal.');
        return;
      }
      if (typeof manualCurrentValue !== 'number' && (Number.isNaN(purchaseCost) || purchaseCost < 0)) {
        showPortfolioFormError('Valeur requise', 'Entre une valeur actuelle estimée.');
        return;
      }
    } else if (Number.isNaN(purchaseCost) || purchaseCost < 0) {
      showPortfolioFormError('Coût requis', 'Entre le coût à l’achat du patrimoine.');
      return;
    }

    if (wealthType === 'precious_material' && isEditing && (Number.isNaN(weight) || weight <= 0)) {
      showPortfolioFormError('Poids requis', 'Entre le poids pour calculer la valeur actuelle.');
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

      const wealthNotesValue = wealthNotes.trim() || null;

      const asset: WealthAsset = {
        id: wealthEditingAsset?.id ?? `wealth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: wealthType,
        name:
          wealthType === 'real_estate'
            ? wealthPropertyType.trim()
              ? realEstateAssetName(wealthPropertyType)
              : wealthName.trim() || 'Bien immobilier'
            : wealthName.trim() || defaultWealthName(wealthType, wealthMaterial, wealthPropertyType),
        material: wealthType === 'precious_material' ? wealthMaterial : null,
        weight: wealthType === 'precious_material' ? weight : null,
        weightUnit: wealthType === 'precious_material' ? wealthWeightUnit : null,
        karats: wealthType === 'precious_material' && wealthMaterial === 'gold' ? parseOptionalMoney(wealthKarats) : null,
        purity:
          wealthType === 'precious_material' && wealthMaterial !== 'gold' && wealthMaterial !== 'diamond'
            ? parseOptionalMoney(wealthPurity)
            : null,
        purchaseCost: wealthType === 'real_estate' && !isEditing
          ? purchaseCost
          : purchaseCost,
        purchaseDate: wealthPurchaseDate.trim() || null,
        currentValue: !isEditing && typeof manualCurrentValue === 'number'
          ? manualCurrentValue
          : wealthType === 'real_estate' && typeof manualCurrentValue === 'number'
            ? manualCurrentValue
            : valuation.currentValue,
        lastValuationAt: valuation.lastValuationAt ?? wealthEditingAsset?.lastValuationAt ?? null,
        valuationSource: !isEditing && typeof manualCurrentValue === 'number' ? 'manual' : valuation.source,
        propertyType: wealthType === 'real_estate' ? wealthPropertyType.trim() || null : null,
        address: wealthType === 'real_estate' ? wealthAddress.trim() || null : null,
        photoUri: wealthType === 'real_estate' ? wealthPhotoUri.trim() || null : null,
        linkedLoanId: wealthEditingAsset?.linkedLoanId ?? null,
        notes: (valuation.note ?? wealthNotesValue) || null,
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

  const resetLoanForm = (type: LoanType = 'personal_loan') => {
    const today = formatDateKey(new Date());
    setEditingLoan(null);
    setLoanType(type);
    setLoanReason(type === 'mortgage' ? MORTGAGE_DEFAULT_REASON : '');
    setLoanBeneficiaryContactId(null);
    setCreatingLoanBeneficiaryContact(false);
    setLoanAddress('');
    setLoanDownPayment('');
    setLoanPurchasePrice('');
    setLoanCurrentPropertyValue('');
    setLoanLender('');
    setLoanPrincipal('');
    setLoanBalance('');
    setLoanRate(type === 'friend_debt' || type === 'child_support' ? '0' : '');
    setLoanMonthlyPayment('');
    setLoanStartDate(today);
    setLoanDurationAmount(type === 'child_support' ? '1' : type === 'mortgage' ? '25' : '12');
    setLoanDurationUnit(type === 'mortgage' ? 'years' : 'months');
    setLoanPaymentFrequency('monthly');
    setLoanPaymentAccountId(accounts[0]?.id ?? '');
    setLoanNextPaymentDate(today);
    setLoanRateType('fixed');
    setLoanRateTermYears('5');
    setLoanRenewalDate('');
    setLoanAmortizationYears('25');
    setLoanPaymentDebitType(type === 'child_support' ? 'automatic' : 'automatic');
    setLoanBeneficiaryRelation(null);
    setLoanIcon(defaultLoanIcon(type));
    setShowLoanIconPicker(false);
  };

  const handleLoanTypeSelect = (type: LoanType) => {
    tapHaptic();
    setShowLoanTypePicker(false);
    resetLoanForm(type);
    setShowLoanForm(true);
  };

  const openEditLoanForm = (loan: Loan) => {
    tapHaptic();
    const today = formatDateKey(new Date());
    setShowLoanTypePicker(false);
    setEditingLoan(loan);
    setLoanType(loan.type ?? 'personal_loan');
    const beneficiaryName = loan.reason?.trim() || resolveLoanReason(loan);
    setLoanReason(beneficiaryName);
    setLoanBeneficiaryContactId(
      loan.type === 'child_support' ? resolveContactIdForName(savedContacts, beneficiaryName) : null,
    );
    setCreatingLoanBeneficiaryContact(false);
    setLoanAddress(loan.address?.trim() ?? '');
    setLoanDownPayment(typeof loan.downPayment === 'number' ? String(loan.downPayment) : '');
    setLoanPurchasePrice(typeof loan.purchasePrice === 'number' ? String(loan.purchasePrice) : '');
    setLoanCurrentPropertyValue(
      typeof loan.currentPropertyValue === 'number' ? String(loan.currentPropertyValue) : '',
    );
    setLoanLender(loan.lender);
    setLoanPrincipal(String(loan.principal));
    setLoanBalance(String(loan.balanceRemaining));
    setLoanRate(String(loan.interestRate));
    setLoanMonthlyPayment(String(loan.monthlyPayment));
    setLoanStartDate(loan.startDate || today);
    if ((loan.type ?? 'personal_loan') === 'mortgage') {
      const amortYears = loan.amortizationYears
        ?? loanDurationAmountInYears(loan.durationAmount || 25, loan.durationUnit ?? 'months');
      setLoanAmortizationYears(String(amortYears));
      setLoanDurationAmount(String(amortYears));
      setLoanDurationUnit('years');
    } else {
      setLoanDurationAmount(String(loan.durationAmount || 12));
      setLoanDurationUnit(loan.durationUnit ?? 'months');
    }
    setLoanPaymentFrequency(loan.paymentFrequency ?? 'monthly');
    setLoanPaymentAccountId(loan.paymentAccountId || accounts[0]?.id || '');
    setLoanNextPaymentDate(loan.nextPaymentDate || today);
    setLoanRateType(loan.rateType ?? 'fixed');
    setLoanRateTermYears(String(loan.rateTermYears ?? 5));
    setLoanRenewalDate(loan.renewalDate?.trim() || '');
    setLoanPaymentDebitType(loan.paymentDebitType ?? 'automatic');
    if ((loan.type ?? 'personal_loan') === 'child_support') {
      const fields = parseChildSupportFromLoan(loan);
      setLoanPrincipal(String(fields.baseMonthly));
      setLoanDownPayment(fields.specialFeesMonthly > 0 ? String(fields.specialFeesMonthly) : '');
      setLoanDurationAmount(String(fields.paymentDay));
      setLoanRenewalDate(fields.indexationDate ?? '');
      setLoanPaymentDebitType(fields.paymentMode);
      setLoanBeneficiaryRelation(fields.beneficiaryRelation);
      setLoanBalance('0');
      setLoanMonthlyPayment(String(fields.totalMonthly));
    }
    setLoanIcon(resolveLoanIcon(loan));
    setShowLoanIconPicker(false);
    setShowLoanForm(true);
  };

  useEffect(() => {
    if (!editLoanId || loans.length === 0 || showLoanForm) return;
    const match = loans.find((loan) => loan.id === editLoanId);
    if (!match) return;
    openEditLoanForm(match);
  }, [editLoanId, loans, showLoanForm]);

  const clearLoanEditRouteParam = () => {
    if (!editLoanId) return;
    router.setParams({ editLoanId: undefined });
  };

  const closeLoanForm = () => {
    clearLoanEditRouteParam();
    resetLoanForm();
    setFormFeedback(null);
    setShowLoanForm(false);
  };

  const saveLoan = async () => {
    const today = formatDateKey(new Date());
    const isFriendDebt = loanType === 'friend_debt';
    const isLineOfCredit = loanType === 'line_of_credit';
    const isMortgage = loanType === 'mortgage';
    const isPersonalLoan = loanType === 'personal_loan';
    const isChildSupport = loanType === 'child_support';
    const requiresScheduling = isMortgage || isChildSupport || Boolean(editingLoan);

    let principal = parseMoney(loanPrincipal);
    let balanceRemaining = parseMoney(loanBalance);
    const interestRate = isFriendDebt || isChildSupport ? 0 : parseMoney(loanRate);
    const parsedMonthlyPayment = loanMonthlyPayment.trim() ? parseMoney(loanMonthlyPayment) : 0;
    let monthlyPayment = Number.isNaN(parsedMonthlyPayment) ? 0 : parsedMonthlyPayment;
    let durationAmount = Number.parseInt(loanDurationAmount, 10);
    const mortgageRateTermYears = Number.parseInt(loanRateTermYears, 10);
    const mortgageAmortizationYears = Number.parseInt(loanAmortizationYears, 10);
    const effectiveDurationUnit = effectiveLoanDurationUnit(loanType, loanDurationUnit);
    const startDate = loanStartDate.trim() || today;
    let nextPaymentDate = loanNextPaymentDate.trim() || startDate;
    const paymentAccount = selectedLoanPaymentAccount;
    const renewalDate = loanRenewalDate.trim();
    let childSupportSpecialFees = 0;
    let endDate = isMortgage
      ? (computeLoanEndDate(startDate, loanAmortizationYears, 'years') || startDate)
      : isChildSupport
        ? ''
        : (computeLoanEndDate(startDate, loanDurationAmount, effectiveDurationUnit) || startDate);

    if (isMortgage) {
      if (!Number.isFinite(mortgageAmortizationYears) || mortgageAmortizationYears <= 0) {
        showPortfolioFormError('Amortissement invalide', "Entre la durée d'amortissement en années.");
        return;
      }
      if (!Number.isFinite(mortgageRateTermYears) || mortgageRateTermYears <= 0) {
        showPortfolioFormError('Période du taux invalide', 'Entre la durée du taux (ex. 5 ans).');
        return;
      }
      if (!renewalDate) {
        showPortfolioFormError('Date de renouvellement requise', 'Choisis la date de renouvellement du taux.');
        return;
      }
    }
    if (!isMortgage && !isChildSupport && !loanLender.trim()) {
      showPortfolioFormError(
        isFriendDebt ? 'Créancier requis' : isLineOfCredit ? 'Institution requise' : 'Prêteur requis',
        isFriendDebt
          ? 'Indique le nom de la personne à qui tu dois de l’argent.'
          : 'Indique le nom de la banque ou du prêteur.',
      );
      return;
    }
    if (isFriendDebt) {
      if (Number.isNaN(balanceRemaining) || balanceRemaining <= 0) {
        showPortfolioFormError('Montant invalide', 'Entre le montant dû.');
        return;
      }
      principal = balanceRemaining;
    } else if (isChildSupport) {
      childSupportSpecialFees = loanDownPayment.trim() ? parseMoney(loanDownPayment) : 0;
      if (Number.isNaN(principal) || principal <= 0) {
        showPortfolioFormError('Montant invalide', 'Entre le montant de base mensuel de la pension.');
        return;
      }
      if (Number.isNaN(childSupportSpecialFees) || childSupportSpecialFees < 0) {
        showPortfolioFormError('Frais invalides', 'Entre un montant valide pour les frais particuliers.');
        return;
      }
      if (!Number.isFinite(durationAmount) || durationAmount < 1 || durationAmount > 31) {
        showPortfolioFormError('Jour invalide', 'Choisis un jour de paiement entre 1 et 31.');
        return;
      }
      if (loanPaymentDebitType === 'automatic' && !loanBeneficiaryRelation) {
        showPortfolioFormError('Bénéficiaire requis', 'Indique si la pension est versée à la mère ou au père.');
        return;
      }
      monthlyPayment = principal + childSupportSpecialFees;
      balanceRemaining = 0;
      nextPaymentDate = computeNextChildSupportPaymentDate(durationAmount);
    } else if (Number.isNaN(principal) || principal <= 0) {
      showPortfolioFormError(
        isMortgage ? 'Montant de l’emprunt invalide' : isLineOfCredit ? 'Limite invalide' : 'Montant initial invalide',
        isMortgage ? 'Entre le montant emprunté pour l’hypothèque.' : isLineOfCredit ? 'Entre la limite de crédit.' : 'Entre le montant original du prêt.',
      );
      return;
    }
    if (!isFriendDebt && !isChildSupport && (Number.isNaN(balanceRemaining) || balanceRemaining < 0)) {
      showPortfolioFormError(
        isLineOfCredit ? 'Solde utilisé invalide' : 'Solde restant invalide',
        isLineOfCredit ? 'Entre le solde utilisé sur la marge.' : 'Entre le solde restant à rembourser.',
      );
      return;
    }
    if (!isFriendDebt && !isChildSupport && (Number.isNaN(interestRate) || interestRate < 0)) {
      showPortfolioFormError('Taux invalide', 'Entre le taux d\'intérêt en %.');
      return;
    }
    if ((isPersonalLoan || isMortgage || isChildSupport) && (Number.isNaN(monthlyPayment) || monthlyPayment <= 0)) {
      showPortfolioFormError(
        'Paiement invalide',
        isChildSupport
          ? 'Entre le montant de base mensuel de la pension.'
          : isMortgage
            ? 'Entre le montant du paiement.'
            : 'Entre le montant du paiement mensuel.',
      );
      return;
    }
    if (isPersonalLoan && !loanNextPaymentDate.trim()) {
      showPortfolioFormError('Prochain paiement requis', 'Choisis la date du prochain paiement.');
      return;
    }
    if (requiresScheduling) {
      if (!isMortgage && !isChildSupport && (!Number.isFinite(durationAmount) || durationAmount <= 0)) {
        showPortfolioFormError('Durée invalide', 'Entre une durée positive en mois ou en années.');
        return;
      }
      if (!paymentAccount) {
        showPortfolioFormError('Compte requis', 'Choisis le compte qui fera les paiements.');
        return;
      }
      if (!isChildSupport && !nextPaymentDate) {
        showPortfolioFormError('Prochain paiement requis', 'Choisis la date du prochain paiement.');
        return;
      }
      if (endDate && nextPaymentDate > endDate) {
        showPortfolioFormError('Date invalide', 'Le prochain paiement doit arriver avant la fin calculée.');
        return;
      }
    }

    const loanId = editingLoan?.id ?? `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const childSupportReason = isChildSupport
      ? loanPaymentDebitType === 'automatic'
        ? formatChildSupportBeneficiaryRelation(loanBeneficiaryRelation) ?? ''
        : loanReason.trim()
      : '';
    const childSupportLender = isChildSupport
      ? loanPaymentDebitType === 'automatic'
        ? CHILD_SUPPORT_RECIPIENT_REVENU_QUEBEC
        : ''
      : loanLender.trim();
    const draftLoanForSync: Loan = {
      id: loanId,
      type: loanType,
      name: '',
      reason: isChildSupport ? childSupportReason || null : null,
      lender: childSupportLender,
      principal,
      balanceRemaining,
      interestRate,
      paymentDebitType: isChildSupport ? loanPaymentDebitType : null,
      beneficiaryRelation: isChildSupport && loanPaymentDebitType === 'automatic' ? loanBeneficiaryRelation : null,
      monthlyPayment,
      paymentAccountId: paymentAccount?.id ?? '',
      nextPaymentDate,
      paymentFrequency: isChildSupport ? 'monthly' : loanPaymentFrequency,
      createdAt: editingLoan?.createdAt ?? new Date().toISOString(),
    } as Loan;
    const shouldSyncRecurring = shouldLoanSyncRecurringPayment(
      monthlyPayment,
      nextPaymentDate,
      paymentAccount,
      draftLoanForSync,
    );
    const recurringPaymentId = shouldSyncRecurring
      ? (editingLoan?.recurringPaymentId ?? `${loanId}-payment`)
      : null;
    const reasonValue = isMortgage
      ? (loanReason.trim() || MORTGAGE_DEFAULT_REASON)
      : isChildSupport
        ? childSupportReason || null
        : loanReason.trim() || null;
    const loanNameValue = formatLoanDisplayTitle({
      type: loanType,
      reason: reasonValue,
      name: '',
      lender: childSupportLender,
    });
    let loan: Loan = {
      id: loanId,
      type: loanType,
      name: loanNameValue,
      reason: reasonValue,
      lender: childSupportLender,
      principal,
      balanceRemaining,
      interestRate,
      rateType: isMortgage ? loanRateType : null,
      rateTermYears: isMortgage && Number.isFinite(mortgageRateTermYears) ? mortgageRateTermYears : null,
      renewalDate: isMortgage || isChildSupport ? renewalDate || null : null,
      amortizationYears: isMortgage && Number.isFinite(mortgageAmortizationYears) ? mortgageAmortizationYears : null,
      paymentDebitType: isMortgage || isChildSupport ? loanPaymentDebitType : null,
      beneficiaryRelation: isChildSupport && loanPaymentDebitType === 'automatic' ? loanBeneficiaryRelation : null,
      monthlyPayment,
      startDate,
      endDate,
      durationAmount: isMortgage
        ? (Number.isFinite(mortgageAmortizationYears) && mortgageAmortizationYears > 0 ? mortgageAmortizationYears : 25)
        : isChildSupport
          ? durationAmount
          : (Number.isFinite(durationAmount) && durationAmount > 0 ? durationAmount : 12),
      durationUnit: isMortgage ? 'years' : effectiveDurationUnit,
      paymentFrequency: isChildSupport ? 'monthly' : loanPaymentFrequency,
      paymentAccountId: paymentAccount?.id ?? '',
      nextPaymentDate,
      recurringPaymentId,
      icon: loanIcon,
      address: isMortgage ? (loanAddress.trim() || editingLoan?.address?.trim() || null) : null,
      downPayment: isMortgage
        ? parseOptionalMoney(loanDownPayment)
        : isChildSupport
          ? childSupportSpecialFees
          : null,
      purchasePrice: isMortgage ? parseOptionalMoney(loanPurchasePrice) : null,
      currentPropertyValue: isMortgage ? parseOptionalMoney(loanCurrentPropertyValue) : null,
      friendDebtMode: editingLoan?.friendDebtMode ?? null,
      wealthAssetId: editingLoan?.wealthAssetId ?? null,
      createdAt: editingLoan?.createdAt ?? new Date().toISOString(),
    };

    if (isMortgage) {
      loan = await syncMortgageWealthAsset(loan);
    }

    await upsertLoan(loan);
    await syncLoanRecurringPayment(loan, paymentAccount, editingLoan?.recurringPaymentId);
    successHaptic();
    closeLoanForm();
    await load();
  };

  const handleDeleteLoan = (id: string) => {
    setPendingLoanDeleteId(id);
    setConfirmLoanDeleteVisible(true);
  };

  const portfolioBottomPadding = useMemo(
    () =>
      portfolioScrollBottomPadding(
        insets.bottom,
        MOCK_STOCK_HOLDINGS.length + patrimoineWealthAssets.length,
      ),
    [insets.bottom, patrimoineWealthAssets.length],
  );

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          isLight
            ? ['rgba(0,168,84,0.06)', 'transparent']
            : ['rgba(0,230,100,0.055)', 'transparent']
        }
        style={styles.ambientGlow}
        pointerEvents="none"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: 0,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isAccountListDragging}
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
        <View style={styles.pageHeaderBlock}>
          <PortfolioPageHeader />
          <View style={styles.pageScopeTabs}>
            <SegmentedTabs
              tabs={[
                { id: 'accounts_only', label: 'Comptes' },
                { id: 'inclusive', label: 'Patrimoine' },
              ]}
              active={netWorthChartScope}
              onChange={handleNetWorthChartScopeChange}
              showDivider={false}
            />
          </View>
        </View>

        <View style={styles.chartHubSection}>
          <DashboardCard
            variant={chartHubLayoutProps.cardVariant}
            padding={chartHubLayoutProps.cardPadding}
            innerStyle={styles.chartHubCard}
          >
            <Pressable
              onPress={clearPortfolioChartSelection}
              style={styles.heroMetricsBlock}
              accessibilityRole="none"
              accessibilityLabel="Effacer la sélection du graphique"
            >
              <DashboardSectionLabel style={chartHubLayoutProps.eyebrowStyle}>
                {CHART_HUB_SCOPE_LABELS[netWorthChartScope]}
              </DashboardSectionLabel>
              <View style={styles.heroAmountDeltaColumn}>
                <NetWorthAmountRow
                  totalBalance={chartPeriodData?.currentValue ?? chartHeroFallbackTotal}
                  centered
                />
                <HeroChartDelta periodData={chartPeriodData} centered />
              </View>
            </Pressable>
            <Pressable
              onPress={clearPortfolioChartSelection}
              accessibilityRole="none"
              accessibilityLabel="Effacer la sélection du graphique"
              style={chartHubLayoutProps.chartBleedStyle}
            >
              <PortfolioChartCard
                ref={portfolioChartRef}
                points={netWorthChartScope === 'inclusive' ? portfolioChartPoints : []}
                getChartPoints={
                  netWorthChartScope === 'accounts_only' ? getCashflowChartPoints : undefined
                }
                onPeriodData={handleChartPeriodData}
                allowedPeriods={portfolioChartAllowedPeriods}
                periodLabels={portfolioChartPeriodLabels}
                periodRealWindowOverride={
                  netWorthChartScope === 'inclusive' ? PATRIMOINE_PERIOD_REAL_WINDOW_OVERRIDE : undefined
                }
                periodMaxChartPointsOverride={
                  netWorthChartScope === 'inclusive' ? PATRIMOINE_PERIOD_MAX_POINTS_OVERRIDE : undefined
                }
                plotHorizontalInset={chartHubLayoutProps.plotHorizontalInset}
                plotHorizontalInsetRight={chartHubLayoutProps.plotHorizontalInsetRight}
                selectionPersistence="release"
              />
            </Pressable>
          </DashboardCard>
        </View>

        {netWorthChartScope === 'accounts_only' ? (
          <View
            onLayout={(event) => handlePortfolioSectionLayout('balances', event)}
            style={[styles.accountsSectionBlock, { paddingBottom: portfolioBottomPadding }]}
          >
            <AccountBalanceChart
              accounts={visibleAccounts}
              onAccountPress={openAccountDetail}
              onAddAccount={openNewAccountForm}
              onReorder={handleVisibleAccountsReorder}
              onDragStateChange={setIsAccountListDragging}
            />
          </View>
        ) : (
          <View
            onLayout={(event) => handlePortfolioSectionLayout('wealth', event)}
            style={[styles.patrimoineSectionBlock, { paddingBottom: portfolioBottomPadding }]}
          >
            <PatrimoineHoldingsSections
              stockHoldingsCount={MOCK_STOCK_HOLDINGS.length}
              wealthAssets={patrimoineWealthAssets}
              loansById={loansById}
              onAddWealthAsset={openNewWealthForm}
              onOpenWealthAsset={(asset) => {
                tapHaptic();
                skipPortfolioScrollToTopOnceRef.current = true;
                router.push({ pathname: '/wealth-asset-detail', params: { id: asset.id } });
              }}
            />
          </View>
        )}
      </ScrollView>

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
                backgroundColor: colors.containerBackground,
                borderWidth: 1,
                borderColor: colors.containerBorder,
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
                <AppIcon family="ionicons" name="close" size={20} color={colors.textSecondary} />
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
                        <AppIcon family="ionicons" name="chevron-up" size={16} color={colors.textSecondary} />
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
                        <AppIcon family="ionicons" name="chevron-down" size={16} color={colors.textSecondary} />
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
                        <AppIcon family="ionicons"
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

      <PortfolioTypePickerSheet
        visible={showAccountTypePicker}
        title="Ajouter un compte"
        subtitle="Choisis le type de compte à ajouter."
        options={ACCOUNT_TYPE_PICKER_OPTIONS}
        onClose={() => setShowAccountTypePicker(false)}
        onSelect={handleAccountTypeSelect}
      />

      <PortfolioTypePickerSheet
        visible={showLoanTypePicker}
        title="Ajouter une obligation"
        options={LOAN_TYPE_PICKER_OPTIONS}
        onClose={() => setShowLoanTypePicker(false)}
        onSelect={handleLoanTypeSelect}
      />

      <PortfolioTypePickerSheet
        visible={showWealthTypePicker}
        title="Ajouter au patrimoine"
        subtitle="Choisis le type d’actif hors compte."
        options={WEALTH_TYPE_PICKER_OPTIONS}
        onClose={() => setShowWealthTypePicker(false)}
        onSelect={handleWealthTypeSelect}
      />

      <PortfolioFormSheetModal
        visible={showForm}
        title={accountFormTitle(kind, Boolean(editingAccount))}
        onClose={closeForm}
      >
          {kind === 'cash' ? (
            <View style={styles.formHead}>
              <View style={styles.logoPreviewWrap}>
                <IconFrame size={52}>
                  <AppIcon family="ionicons" name="wallet-outline" size={22} color={colors.primary} />
                </IconFrame>
              </View>
              <View style={styles.formHeadCopy}>
                <Text style={[styles.formHint, formThemed.textMuted]}>
                  Solde manuel — pas de synchronisation bancaire.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.formHead}>
              <View style={styles.logoPreviewWrap}>
                {previewLogo ? (
                  <LogoIconFrame uri={previewLogo} size={52} />
                ) : (
                  <IconFrame size={52}>
                    <AppIcon family="ionicons" name="business-outline" size={22} color={colors.textMuted} />
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
                  <AppIcon family="ionicons" name="pencil-outline" size={15} color={isLight ? colors.text : ghost.void} />
                </Pressable>
              </View>
              <View style={styles.formHeadCopy}>
                <Text style={[styles.formHint, formThemed.textMuted]}>
                  {selectedInstitutionLogo
                    ? 'Logo manuel sélectionné.'
                    : 'Le logo se déduit du nom. Exemple : Visa Desjardins -> Desjardins.'}
                </Text>
              </View>
            </View>
          )}

          {kind !== 'cash' && showLogoPicker ? (
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
                    <LogoIconFrame uri={autoPreviewLogo} size={ICON_WELL_SIZE} />
                  ) : (
                    <IconFrame size={ICON_WELL_SIZE}>
                      <AppIcon family="ionicons" name="sparkles-outline" size={17} color={colors.textMuted} />
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
                        <LogoIconFrame uri={option.logoUrl} size={ICON_WELL_SIZE} />
                      ) : (
                        <IconFrame size={ICON_WELL_SIZE}>
                          <AppIcon family="ionicons" name="business-outline" size={17} color={colors.textMuted} />
                        </IconFrame>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {!editingAccount ? (
            <>
              <Text style={[styles.label, formThemed.textSecondary]}>Type de compte</Text>
              <View style={styles.typeRow}>
                {ACCOUNT_TYPES.map((t) => {
                  const selected = kind === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        tapHaptic();
                        setKind(t.id);
                        if (t.id === 'cash' && !name.trim()) {
                          setName('Argent Cash');
                        }
                      }}
                      style={[
                        styles.typeChip,
                        selected ? formThemed.selected : formThemed.control,
                      ]}
                    >
                      <AppIcon family="ionicons"
                        name={t.icon}
                        size={16}
                        color={selected ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <AccountInput
            label="Nom du compte"
            value={name}
            onChangeText={setName}
            placeholder={
              kind === 'credit'
                ? 'Visa Desjardins'
                : kind === 'cash'
                  ? 'Argent Cash'
                  : 'Tangerine chèque'
            }
          />
          {kind !== 'cash' ? (
            <AccountInput
              label="Institution"
              value={institution}
              onChangeText={setInstitution}
              placeholder="Desjardins, Tangerine, BMO…"
            />
          ) : null}
          <AccountInput
            label={kind === 'credit' ? 'Solde dû actuel' : 'Solde actuel'}
            value={balance}
            onChangeText={setBalance}
            placeholder={kind === 'credit' ? '580.42' : kind === 'cash' ? '120.00' : '3240.50'}
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
                suffix="$"
              />
              <AccountInput
                label="4 derniers chiffres (optionnel)"
                value={last4}
                onChangeText={setLast4}
                placeholder="1234"
                keyboardType="number-pad"
                maxLength={4}
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

          {formFeedback ? (
            <ThemedFormMessage
              variant={formFeedback.variant}
              title={formFeedback.title}
              message={formFeedback.message}
            />
          ) : null}

          <PrimarySaveButton
            label={editingAccount ? 'Enregistrer' : 'Créer le compte'}
            onPress={() => void saveAccount()}
          />
      </PortfolioFormSheetModal>

      <PortfolioFormSheetModal
        visible={showWealthForm}
        title={wealthFormTitle(wealthType, Boolean(wealthEditingAsset))}
        onClose={closeWealthForm}
      >
              <View style={styles.wealthFormHero}>
                {wealthType === 'precious_material' && wealthMaterial === 'silver' ? (
                  <WealthMaterialIcon material={wealthMaterial} size={34} />
                ) : (
                  <View style={[styles.wealthFormIcon, formThemed.control]}>
                    {wealthType === 'precious_material' ? (
                      <WealthMaterialIcon material={wealthMaterial} size={34} />
                    ) : (
                      <AppIcon family="ionicons" name="home-outline" size={26} color={colors.primary} />
                    )}
                  </View>
                )}
                <Text style={[styles.formHint, formThemed.textMuted]}>
                  {wealthType === 'precious_material'
                    ? 'Les métaux tentent une actualisation en ligne sans clé API. Si le réseau échoue, une estimation locale est utilisée.'
                    : 'Le bien immobilier contribue à ta valeur nette. Indique le prix payé, la date d’achat et la valeur actuelle.'}
                </Text>
              </View>

              {wealthEditingAsset ? (
                <>
                  <Text style={[styles.label, formThemed.textSecondary]}>Type de patrimoine</Text>
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
                            selected ? formThemed.selected : formThemed.control,
                          ]}
                        >
                          <AppIcon family="ionicons" name={typeOption.icon} size={16} color={selected ? colors.primary : colors.textSecondary} />
                          <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                            {typeOption.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {wealthType === 'precious_material' ? (
                <>
                  <Text style={[styles.label, formThemed.textSecondary]}>Type de métal</Text>
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
                            selected ? formThemed.selected : formThemed.control,
                          ]}
                        >
                          <WealthMaterialIcon material={option.id} size={30} />
                          <Text style={[styles.logoOptionText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {wealthEditingAsset ? (
                    <AccountInput
                      label="Nom"
                      value={wealthName}
                      onChangeText={setWealthName}
                      placeholder={`Ex. ${materialLabel(wealthMaterial)} familial`}
                    />
                  ) : null}
                  <AccountInput
                    label="Quantité"
                    value={wealthWeight}
                    onChangeText={setWealthWeight}
                    placeholder={wealthMaterial === 'diamond' ? '1.2' : '25'}
                    keyboardType="decimal-pad"
                    suffix={wealthWeightUnit}
                  />
                  <Text style={[styles.label, formThemed.textSecondary]}>Unité</Text>
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
                            selected ? formThemed.selected : formThemed.control,
                          ]}
                        >
                          <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                            {unit.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {!wealthEditingAsset ? (
                    <AccountInput
                      label="Valeur actuelle estimée"
                      value={wealthCurrentValue}
                      onChangeText={setWealthCurrentValue}
                      placeholder="2500"
                      keyboardType="decimal-pad"
                      suffix="$"
                    />
                  ) : wealthMaterial === 'gold' ? (
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
                    <Text style={[styles.wealthFinePrint, formThemed.textMuted]}>
                      Pour un diamant, la valeur affichée reste indicative. La coupe, la couleur, la clarté et la certification changent fortement le prix.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  {!wealthEditingAsset ? (
                    <>
                      <WealthPropertyTypeSelector
                        value={wealthPropertyType}
                        onChange={handleWealthPropertyTypeChange}
                        formThemed={formThemed}
                      />
                      <AccountInput
                        label="Coût d’achat"
                        value={wealthPurchaseCost}
                        onChangeText={setWealthPurchaseCost}
                        placeholder="350000"
                        keyboardType="decimal-pad"
                        suffix="$"
                      />
                      <DatePickerField
                        label="Date d’achat"
                        value={wealthPurchaseDate}
                        placeholder="Choisir une date"
                        variant="sheet"
                        onChangeDate={setWealthPurchaseDate}
                      />
                      <AccountInput
                        label="Valeur actuelle"
                        value={wealthCurrentValue}
                        onChangeText={setWealthCurrentValue}
                        placeholder="425000"
                        keyboardType="decimal-pad"
                        suffix="$"
                      />
                      {wealthEditingAsset?.linkedLoanId?.trim() ? (
                        <WealthRealEstateEquityHint
                          asset={wealthEditingAsset}
                          currentValueInput={wealthCurrentValue}
                          linkedLoan={
                            loans.find((loan) => loan.id === wealthEditingAsset.linkedLoanId?.trim()) ?? null
                          }
                          formThemed={formThemed}
                        />
                      ) : null}
                      <PropertyPhotoField
                        photoUri={wealthPhotoUri}
                        onPick={() => {
                          promptPropertyPhotoSource(
                            () => {
                              void pickPropertyPhotoFromGallery().then((result) => {
                                if (!result.cancelled && result.uri) setWealthPhotoUri(result.uri);
                              });
                            },
                            () => {
                              void capturePropertyPhoto().then((result) => {
                                if (!result.cancelled && result.uri) setWealthPhotoUri(result.uri);
                              });
                            },
                            wealthPhotoUri.trim()
                              ? () => setWealthPhotoUri('')
                              : undefined,
                          );
                        }}
                        colors={colors}
                        formThemed={formThemed}
                      />
                    </>
                  ) : (
                    <>
                      <WealthPropertyTypeSelector
                        value={wealthPropertyType}
                        onChange={handleWealthPropertyTypeChange}
                        formThemed={formThemed}
                      />
                      <AccountInput
                        label="Coût d’achat"
                        value={wealthPurchaseCost}
                        onChangeText={setWealthPurchaseCost}
                        placeholder="350000"
                        keyboardType="decimal-pad"
                        suffix="$"
                      />
                      <DatePickerField
                        label="Date d’achat"
                        value={wealthPurchaseDate}
                        placeholder="Choisir une date"
                        variant="sheet"
                        onChangeDate={setWealthPurchaseDate}
                      />
                      <AccountInput
                        label="Valeur actuelle"
                        value={wealthCurrentValue}
                        onChangeText={setWealthCurrentValue}
                        placeholder="425000"
                        keyboardType="decimal-pad"
                        suffix="$"
                      />
                      {wealthEditingAsset?.linkedLoanId?.trim() ? (
                        <WealthRealEstateEquityHint
                          asset={wealthEditingAsset}
                          currentValueInput={wealthCurrentValue}
                          linkedLoan={
                            loans.find((loan) => loan.id === wealthEditingAsset.linkedLoanId?.trim()) ?? null
                          }
                          formThemed={formThemed}
                        />
                      ) : null}
                      <AccountInput
                        label="Adresse"
                        value={wealthAddress}
                        onChangeText={setWealthAddress}
                        placeholder="123 rue des Érables, Montréal"
                      />
                      <PropertyPhotoField
                        photoUri={wealthPhotoUri}
                        onPick={() => {
                          promptPropertyPhotoSource(
                            () => {
                              void pickPropertyPhotoFromGallery().then((result) => {
                                if (!result.cancelled && result.uri) setWealthPhotoUri(result.uri);
                              });
                            },
                            () => {
                              void capturePropertyPhoto().then((result) => {
                                if (!result.cancelled && result.uri) setWealthPhotoUri(result.uri);
                              });
                            },
                            wealthPhotoUri.trim()
                              ? () => setWealthPhotoUri('')
                              : undefined,
                          );
                        }}
                        colors={colors}
                        formThemed={formThemed}
                      />
                    </>
                  )}
                </>
              )}

              {wealthEditingAsset && wealthType === 'precious_material' ? (
                <>
                  <AccountInput
                    label="Coût à l’achat"
                    value={wealthPurchaseCost}
                    onChangeText={setWealthPurchaseCost}
                    placeholder="1800"
                    keyboardType="decimal-pad"
                    suffix="$"
                  />
                  <AccountInput
                    label="Date d’achat (optionnel)"
                    value={wealthPurchaseDate}
                    onChangeText={setWealthPurchaseDate}
                    placeholder="2024-05-17"
                  />
                </>
              ) : null}
              <AccountInput
                label="Description (optionnel)"
                value={wealthNotes}
                onChangeText={setWealthNotes}
                placeholder={wealthType === 'real_estate' ? 'Condo, courtier, détails utiles' : 'Certification, détails utiles'}
              />

              {formFeedback ? (
                <ThemedFormMessage
                  variant={formFeedback.variant}
                  title={formFeedback.title}
                  message={formFeedback.message}
                />
              ) : null}

              <PrimarySaveButton
                label={wealthEditingAsset ? 'Enregistrer' : 'Ajouter au patrimoine'}
                onPress={() => void saveWealthAsset()}
                disabled={isSavingWealth}
                loading={isSavingWealth}
              />
      </PortfolioFormSheetModal>

      <PortfolioFormSheetModal
        visible={showLoanForm}
        title={loanFormTitle(loanType, Boolean(editingLoan))}
        onClose={closeLoanForm}
      >
              <View style={[styles.wealthFormHero, styles.loanFormHero, { marginBottom: spacing.xs }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Changer l'icône de la dette"
                  onPress={() => {
                    tapHaptic();
                    setShowLoanIconPicker((visible) => !visible);
                  }}
                >
                  <UserPickedIconWell icon={loanIcon} size={52} wellGlyphWhite />
                </Pressable>
                <Text style={[styles.formHint, styles.loanFormHeroHint, formThemed.textMuted]}>
                  {loanFormHint(loanType)}
                </Text>
              </View>

              {showLoanIconPicker ? (
                <View style={styles.logoPickerGroup}>
                  <Text style={[styles.label, formThemed.textSecondary]}>Icônes MDI</Text>
                  <MdiIconPicker
                    selectedIcon={loanIcon}
                    onSelect={(icon) => {
                      setLoanIcon(icon);
                      setShowLoanIconPicker(false);
                    }}
                  />
                </View>
              ) : null}

              {loanType === 'mortgage' ? (
                <>
                  <AccountInput
                    label="Mise de fonds"
                    value={loanDownPayment}
                    onChangeText={setLoanDownPayment}
                    placeholder="70000"
                    keyboardType="decimal-pad"
                    suffix="$"
                  />
                  <AccountInput
                    label="Montant emprunté"
                    value={loanPrincipal}
                    onChangeText={setLoanPrincipal}
                    placeholder="350000"
                    keyboardType="decimal-pad"
                    suffix="$"
                  />
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, formThemed.textSecondary]}>Temps d'amortissement</Text>
                    <View style={styles.typeRow}>
                      {MORTGAGE_AMORTIZATION_YEARS.map((years) => {
                        const selected = loanAmortizationYears === String(years);
                        return (
                          <Pressable
                            key={years}
                            onPress={() => setLoanAmortizationYears(String(years))}
                            style={[
                              styles.typeChip,
                              selected ? formThemed.selected : formThemed.control,
                            ]}
                          >
                            <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                              {years} ans
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <AccountInput
                      label="Durée personnalisée"
                      value={loanAmortizationYears}
                      onChangeText={setLoanAmortizationYears}
                      placeholder="25"
                      keyboardType="number-pad"
                      suffix="ans"
                    />
                  </View>
                  <AccountInput
                    label="Taux d'intérêt"
                    value={loanRate}
                    onChangeText={setLoanRate}
                    placeholder="5.99"
                    keyboardType="decimal-pad"
                    suffix="%"
                  />
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, formThemed.textSecondary]}>Type de taux</Text>
                    <View style={styles.typeRow}>
                      {LOAN_RATE_TYPES.map((option) => {
                        const selected = loanRateType === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => setLoanRateType(option.id)}
                            style={[
                              styles.typeChip,
                              selected ? formThemed.selected : formThemed.control,
                            ]}
                          >
                            <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <AccountInput
                    label="Période du taux"
                    value={loanRateTermYears}
                    onChangeText={setLoanRateTermYears}
                    placeholder="5"
                    keyboardType="number-pad"
                    suffix="ans"
                  />
                  <DatePickerField
                    label="Date de début"
                    value={loanStartDate}
                    placeholder="Choisir une date"
                    variant="sheet"
                    onChangeDate={setLoanStartDate}
                  />
                  <DatePickerField
                    label="Date de renouvellement"
                    value={loanRenewalDate}
                    placeholder="Choisir une date"
                    variant="sheet"
                    onChangeDate={setLoanRenewalDate}
                  />
                  <AccountInput
                    label="Solde restant"
                    value={loanBalance}
                    onChangeText={setLoanBalance}
                    placeholder="320000"
                    keyboardType="decimal-pad"
                    suffix="$"
                  />
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, formThemed.textSecondary]}>Fréquence des paiements</Text>
                    <View style={styles.typeRow}>
                      {MORTGAGE_PAYMENT_FREQUENCIES.map((option) => {
                        const selected = loanPaymentFrequency === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => setLoanPaymentFrequency(option.id)}
                            style={[
                              styles.typeChip,
                              selected ? formThemed.selected : formThemed.control,
                            ]}
                          >
                            <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <AccountInput
                    label="Montant du paiement"
                    value={loanMonthlyPayment}
                    onChangeText={setLoanMonthlyPayment}
                    placeholder="1800"
                    keyboardType="decimal-pad"
                    suffix="$"
                  />
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, formThemed.textSecondary]}>Prélèvement</Text>
                    <View style={styles.typeRow}>
                      {LOAN_PAYMENT_DEBIT_TYPES.map((option) => {
                        const selected = loanPaymentDebitType === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => setLoanPaymentDebitType(option.id)}
                            style={[
                              styles.typeChip,
                              selected ? formThemed.selected : formThemed.control,
                            ]}
                          >
                            <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <DatePickerField
                    label="Date de paiement"
                    value={loanNextPaymentDate}
                    placeholder="Choisir une date"
                    variant="sheet"
                    onChangeDate={setLoanNextPaymentDate}
                  />
                  <PaymentMethodField
                    accounts={accounts.map((a): PaymentMethodAccount => ({ id: a.id, name: a.name, last4: a.last4 ?? undefined, kind: a.kind }))}
                    selectedAccountId={loanPaymentAccountId}
                    onSelectAccount={setLoanPaymentAccountId}
                    chipControlStyle={formThemed.control}
                    chipSelectedStyle={formThemed.selected}
                    selectedTextStyle={formThemed.selectedText}
                    textSecondaryStyle={formThemed.textSecondary}
                  />
                </>
              ) : (
                <>
                  {!editingLoan && !loanType ? (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, formThemed.textSecondary]}>Type de dette</Text>
                      <View style={styles.typeRow}>
                        {LOAN_TYPE_OPTIONS.map((option) => {
                          const selected = loanType === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              onPress={() => {
                                setLoanType(option.id);
                                setLoanIcon(defaultLoanIcon(option.id));
                                if (option.id === 'friend_debt' || option.id === 'child_support') setLoanRate('0');
                              }}
                              style={[
                                styles.typeChip,
                                selected ? formThemed.selected : formThemed.control,
                              ]}
                            >
                              <AppIcon family="ionicons" name={option.icon} size={15} color={selected ? colors.primary : colors.textSecondary} />
                              <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {loanType === 'child_support' ? (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.childSupportEyebrow, formThemed.textSecondary]}>
                          Mode de paiement
                        </Text>
                        <View style={styles.typeRow}>
                          {CHILD_SUPPORT_PAYMENT_MODES.map((option) => {
                            const selected = loanPaymentDebitType === option.id;
                            return (
                              <Pressable
                                key={option.id}
                                onPress={() => {
                                  setLoanPaymentDebitType(option.id);
                                  if (option.id === 'automatic') {
                                    setLoanBeneficiaryContactId(null);
                                  } else {
                                    setLoanBeneficiaryRelation(null);
                                  }
                                }}
                                style={[
                                  styles.typeChip,
                                  selected ? formThemed.selected : formThemed.control,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.typeChipText,
                                    selected ? formThemed.selectedText : formThemed.textSecondary,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {CHILD_SUPPORT_PAYMENT_MODES.map((option) =>
                          loanPaymentDebitType === option.id ? (
                            <Text key={`${option.id}-hint`} style={[styles.formHint, formThemed.textMuted]}>
                              {option.description}
                            </Text>
                          ) : null,
                        )}
                      </View>

                      {loanPaymentDebitType === 'automatic' ? (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={[styles.childSupportEyebrow, formThemed.textSecondary]}>
                              Destinataire
                            </Text>
                            <Text style={[moneyAmountTypography({ tier: 'stat', fontSize: 18, lineHeight: 22 }), formThemed.text]}>
                              {CHILD_SUPPORT_RECIPIENT_REVENU_QUEBEC}
                            </Text>
                            <Text style={[styles.formHint, formThemed.textMuted]}>
                              Retenue à la source sur ta paie (ordre du tribunal).
                            </Text>
                          </View>
                          <View style={styles.inputGroup}>
                            <Text style={[styles.childSupportEyebrow, formThemed.textSecondary]}>
                              Bénéficiaire
                            </Text>
                            <View style={styles.typeRow}>
                              {CHILD_SUPPORT_BENEFICIARY_RELATIONS.map((option) => {
                                const selected = loanBeneficiaryRelation === option.id;
                                return (
                                  <Pressable
                                    key={option.id}
                                    onPress={() => setLoanBeneficiaryRelation(option.id)}
                                    style={[
                                      styles.typeChip,
                                      selected ? formThemed.selected : formThemed.control,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.typeChipText,
                                        selected ? formThemed.selectedText : formThemed.textSecondary,
                                      ]}
                                    >
                                      {option.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        </>
                      ) : (
                        <>
                          <ChildSupportBeneficiaryField
                            value={loanReason}
                            onChangeText={updateChildSupportBeneficiary}
                            suggestions={childSupportContactSuggestions}
                            linkedContactId={loanBeneficiaryContactId}
                            creatingContact={creatingLoanBeneficiaryContact}
                            onSelectSuggestion={selectChildSupportBeneficiary}
                            onCreateContact={() => void handleCreateLoanBeneficiaryContact()}
                            isKnownContactName={isKnownChildSupportContactName}
                            formThemed={formThemed}
                          />
                          <Text style={[styles.formHint, formThemed.textMuted]}>
                            {CHILD_SUPPORT_PRIVATE_PROOF_REMINDER}
                          </Text>
                        </>
                      )}

                      <AccountInput
                        label="Montant de base (mensuel)"
                        value={loanPrincipal}
                        onChangeText={setLoanPrincipal}
                        placeholder="650"
                        keyboardType="decimal-pad"
                        suffix="$"
                        labelStyle={styles.childSupportEyebrow}
                      />
                      <AccountInput
                        label="Total des frais particuliers (mensuel)"
                        value={loanDownPayment}
                        onChangeText={setLoanDownPayment}
                        placeholder="Garde, activités..."
                        keyboardType="decimal-pad"
                        suffix="$"
                        labelStyle={styles.childSupportEyebrow}
                      />
                      {(() => {
                        const base = parseMoney(loanPrincipal);
                        const fees = loanDownPayment.trim() ? parseMoney(loanDownPayment) : 0;
                        const total =
                          (Number.isNaN(base) ? 0 : base) + (Number.isNaN(fees) ? 0 : fees);
                        if (total <= 0) return null;
                        return (
                          <View style={styles.inputGroup}>
                            <Text style={[styles.childSupportEyebrow, formThemed.textSecondary]}>
                              Total mensuel
                            </Text>
                            <Text style={[moneyAmountTypography({ tier: 'hero' }), formThemed.text]}>
                              {formatDisplayMoneyAbsolute(total)}
                            </Text>
                          </View>
                        );
                      })()}
                      <View style={styles.inputGroup}>
                        <Text style={[styles.childSupportEyebrow, formThemed.textSecondary]}>
                          Jour du paiement
                        </Text>
                        <View style={styles.typeRow}>
                          {CHILD_SUPPORT_QUICK_PAYMENT_DAYS.map((day) => {
                            const selected = loanDurationAmount === String(day);
                            return (
                              <Pressable
                                key={day}
                                onPress={() => setLoanDurationAmount(String(day))}
                                style={[
                                  styles.typeChip,
                                  selected ? formThemed.selected : formThemed.control,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.typeChipText,
                                    selected ? formThemed.selectedText : formThemed.textSecondary,
                                  ]}
                                >
                                  {formatChildSupportPaymentDay(day)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View style={[styles.inputShell, formThemed.control]}>
                          <NumericAmountInput
                            value={loanDurationAmount}
                            onChangeText={(value) =>
                              setLoanDurationAmount(value.replace(/[^0-9]/g, '').slice(0, 2))
                            }
                            keyboardType="decimal-pad"
                            placeholder="1–31"
                            style={[styles.inputWithSuffix, formThemed.text]}
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                        {Number.isFinite(Number.parseInt(loanDurationAmount, 10)) &&
                        Number.parseInt(loanDurationAmount, 10) >= 1 &&
                        Number.parseInt(loanDurationAmount, 10) <= 31 ? (
                          <Text style={[styles.formHint, formThemed.textMuted]}>
                            {formatChildSupportPaymentDayLabel(Number.parseInt(loanDurationAmount, 10))}
                          </Text>
                        ) : null}
                      </View>
                      <DatePickerField
                        label="Date de la prochaine indexation"
                        value={loanRenewalDate}
                        placeholder="Choisir une date (optionnel)"
                        variant="sheet"
                        onChangeDate={setLoanRenewalDate}
                        labelStyle={styles.childSupportEyebrow}
                      />
                      <PaymentMethodField
                        label={
                          loanPaymentDebitType === 'automatic'
                            ? 'Compte de paie (dépôt du salaire)'
                            : 'Compte de paiement'
                        }
                        accounts={accounts.map((a): PaymentMethodAccount => ({ id: a.id, name: a.name, last4: a.last4 ?? undefined, kind: a.kind }))}
                        selectedAccountId={loanPaymentAccountId}
                        onSelectAccount={setLoanPaymentAccountId}
                        chipControlStyle={formThemed.control}
                        chipSelectedStyle={formThemed.selected}
                        selectedTextStyle={formThemed.selectedText}
                        textSecondaryStyle={formThemed.textSecondary}
                      />
                    </>
                  ) : (
                    <>
                  <AccountInput
                    label="Raison"
                    value={loanReason}
                    onChangeText={setLoanReason}
                    placeholder={
                      loanType === 'friend_debt' ? 'Souper, dépannage…' :
                      loanType === 'line_of_credit' ? 'Rénovation, voyage…' :
                      'Auto, études…'
                    }
                  />
                  <AccountInput
                    label={
                      loanType === 'friend_debt' ? 'Créancier' :
                      loanType === 'line_of_credit' ? 'Institution' : 'Prêteur'
                    }
                    value={loanLender}
                    onChangeText={setLoanLender}
                    placeholder={loanType === 'friend_debt' ? 'Nom de la personne' : 'Desjardins, RBC, BMO…'}
                  />
                  {loanType === 'friend_debt' && !editingLoan ? (
                    <AccountInput
                      label="Montant dû"
                      value={loanBalance}
                      onChangeText={setLoanBalance}
                      placeholder="250"
                      keyboardType="decimal-pad"
                      suffix="$"
                    />
                  ) : null}
                  {loanType !== 'friend_debt' ? (
                    <AccountInput
                      label={loanType === 'line_of_credit' ? 'Limite' : 'Montant emprunté'}
                      value={loanPrincipal}
                      onChangeText={setLoanPrincipal}
                      placeholder={loanType === 'line_of_credit' ? '15000' : '25000'}
                      keyboardType="decimal-pad"
                      suffix="$"
                    />
                  ) : null}
                  {loanType !== 'friend_debt' || editingLoan ? (
                    <AccountInput
                      label={loanType === 'line_of_credit' ? 'Solde utilisé' : 'Solde restant'}
                      value={loanBalance}
                      onChangeText={setLoanBalance}
                      placeholder={loanType === 'line_of_credit' ? '4200' : '18500'}
                      keyboardType="decimal-pad"
                      suffix="$"
                    />
                  ) : null}
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
                  {loanType === 'personal_loan' ? (
                    <AccountInput
                      label="Paiement mensuel"
                      value={loanMonthlyPayment}
                      onChangeText={setLoanMonthlyPayment}
                      placeholder="420"
                      keyboardType="decimal-pad"
                      suffix="$"
                    />
                  ) : null}
                  {loanType === 'personal_loan' ? (
                    <DatePickerField
                      label="Date du prochain paiement"
                      value={loanNextPaymentDate}
                      placeholder="Choisir une date"
                      variant="sheet"
                      onChangeDate={setLoanNextPaymentDate}
                    />
                  ) : null}
                  {loanType === 'friend_debt' ? (
                    <DatePickerField
                      label="Date d'échéance (optionnel)"
                      value={loanNextPaymentDate}
                      placeholder="Choisir une date"
                      variant="sheet"
                      onChangeDate={setLoanNextPaymentDate}
                    />
                  ) : null}
                  {editingLoan ? (
                    <DatePickerField
                      label="Date de début"
                      value={loanStartDate}
                      placeholder="Choisir une date"
                      variant="sheet"
                      onChangeDate={setLoanStartDate}
                    />
                  ) : null}

                  {editingLoan ? (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, formThemed.textSecondary]}>Durée</Text>
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
                                  selected ? formThemed.selected : formThemed.control,
                                ]}
                              >
                                <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {editingLoan ? (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, formThemed.textSecondary]}>Date de fin calculée</Text>
                      <View style={[styles.input, formThemed.control, { justifyContent: 'center' }]}>
                        <Text style={[styles.computedFieldText, computedLoanEndDate ? formThemed.text : formThemed.textMuted]}>
                          {computedLoanEndDate
                            ? formatFriendlyDateLabel(computedLoanEndDate)
                            : 'Entre une date de début et une durée'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {editingLoan ? (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, formThemed.textSecondary]}>Fréquence des paiements</Text>
                      <View style={styles.typeRow}>
                        {LOAN_PAYMENT_FREQUENCIES.map((option) => {
                          const selected = loanPaymentFrequency === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              onPress={() => setLoanPaymentFrequency(option.id)}
                              style={[
                                styles.typeChip,
                                selected ? formThemed.selected : formThemed.control,
                              ]}
                            >
                              <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {editingLoan ? (
                    <PaymentMethodField
                      accounts={accounts.map((a): PaymentMethodAccount => ({ id: a.id, name: a.name, last4: a.last4 ?? undefined, kind: a.kind }))}
                      selectedAccountId={loanPaymentAccountId}
                      onSelectAccount={setLoanPaymentAccountId}
                      chipControlStyle={formThemed.control}
                      chipSelectedStyle={formThemed.selected}
                      selectedTextStyle={formThemed.selectedText}
                      textSecondaryStyle={formThemed.textSecondary}
                    />
                  ) : null}

                  {editingLoan ? (
                    <DatePickerField
                      label={`Prochain paiement (${loanMonthlyPayment.trim() ? `${formatNumberInput(loanMonthlyPayment.trim())} $` : 'montant par paiement'})`}
                      value={loanNextPaymentDate}
                      placeholder="Choisir la prochaine date"
                      variant="sheet"
                      onChangeDate={setLoanNextPaymentDate}
                    />
                  ) : null}
                    </>
                  )}
                </>
              )}

              {formFeedback ? (
                <ThemedFormMessage
                  variant={formFeedback.variant}
                  title={formFeedback.title}
                  message={formFeedback.message}
                />
              ) : null}

              <PrimarySaveButton
                label={editingLoan ? 'Enregistrer' : 'Ajouter'}
                onPress={() => void saveLoan()}
              />
      </PortfolioFormSheetModal>

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

function usePortfolioFormTheme() {
  const { colors, ghost, isLight } = useAppTheme();
  return useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: {
        backgroundColor: colors.containerBackground,
        borderColor: colors.containerBorder,
        borderWidth: StyleSheet.hairlineWidth,
      },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      control: {
        backgroundColor: ghost.obsidianSoft,
        borderColor: colors.borderStrong,
        borderWidth: StyleSheet.hairlineWidth,
      },
      selected: {
        backgroundColor: colors.successMuted,
        borderColor: colors.primary,
        borderWidth: 1.5,
      },
      selectedText: { color: colors.primary },
      text: { color: colors.text },
      textSecondary: { color: colors.textSecondary },
      textMuted: { color: colors.textMuted },
    }),
    [colors, ghost, isLight],
  );
}

function accountFormTitle(kind: AccountKind, editing: boolean) {
  if (editing) return 'Modifier le compte';
  if (kind === 'credit') return 'Carte de crédit';
  if (kind === 'savings') return 'Compte épargne';
  if (kind === 'cash') return 'Argent Cash';
  return 'Compte chèque';
}

function loanFormTitle(type: LoanType, editing: boolean) {
  if (type === 'friend_debt') return editing ? 'Modifier la dette' : 'Dette à un particulier';
  if (type === 'line_of_credit') return editing ? 'Modifier la marge' : 'Marge de crédit';
  if (type === 'mortgage') return editing ? "Modifier l'hypothèque" : 'Hypothèque';
  if (type === 'child_support') return editing ? 'Modifier la pension alimentaire' : 'Pension alimentaire';
  return editing ? 'Modifier le prêt' : 'Prêt personnel';
}

function wealthFormTitle(type: WealthAssetType, editing: boolean) {
  if (editing) return 'Modifier le patrimoine';
  return type === 'real_estate' ? 'Bien immobilier' : 'Métaux précieux';
}

function PortfolioTypePickerSheet<T extends string>({
  visible,
  title,
  subtitle,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption<T>[];
  onClose: () => void;
  onSelect: (id: T) => void;
}) {
  const { colors } = useAppTheme();
  const formThemed = usePortfolioFormTheme();

  return (
    <PortfolioFormSheetModal visible={visible} title={title} onClose={onClose}>
      {subtitle ? (
        <Text style={[styles.typePickerSubtitle, formThemed.textMuted]}>{subtitle}</Text>
      ) : null}
      <View style={styles.typePickerList}>
        {options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.typePickerRow,
              formThemed.control,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.typePickerIconWell, { backgroundColor: colors.surfaceElevated }]}>
              <AppIcon family="ionicons" name={option.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.typePickerCopy}>
              <Text style={[styles.typePickerLabel, formThemed.text]}>{option.label}</Text>
              <Text style={[styles.typePickerDescription, formThemed.textMuted]}>{option.description}</Text>
            </View>
            <AppIcon family="ionicons" name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </PortfolioFormSheetModal>
  );
}

function PortfolioFormSheetModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors, ghostCardShadow } = useAppTheme();
  const formThemed = usePortfolioFormTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.formModalBackdrop, formThemed.modalBackdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.formModalKeyboard}
        >
          <View
            style={[
              styles.formModalSheet,
              ghostCardShadow,
              formThemed.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
          >
            <View style={[styles.formModalHandle, formThemed.handle]} />
            <View style={styles.modalTitleRow}>
              <Text style={[styles.formTitle, formThemed.text]} numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, formThemed.closeButton]}>
                <AppIcon family="ionicons" name="close" size={19} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function WealthRealEstateEquityHint({
  asset,
  currentValueInput,
  linkedLoan,
  formThemed,
}: {
  asset: WealthAsset;
  currentValueInput: string;
  linkedLoan: Loan | null;
  formThemed: ReturnType<typeof usePortfolioFormTheme>;
}) {
  if (!linkedLoan || linkedLoan.type !== 'mortgage') return null;

  const parsedValue = parseOptionalMoney(currentValueInput);
  const previewAsset: WealthAsset = {
    ...asset,
    currentValue: typeof parsedValue === 'number' ? parsedValue : asset.currentValue,
  };
  const displayValue = getWealthAssetDisplayValue(previewAsset, linkedLoan);

  return (
    <Text style={[styles.wealthFinePrint, formThemed.textMuted]}>
      Équité nette affichée : {formatDisplayMoneyAbsolute(displayValue)} (valeur du bien − solde hypothèque)
    </Text>
  );
}

function ChildSupportBeneficiaryField({
  value,
  onChangeText,
  suggestions,
  linkedContactId,
  creatingContact,
  onSelectSuggestion,
  onCreateContact,
  isKnownContactName,
  formThemed,
}: {
  value: string;
  onChangeText: (value: string) => void;
  suggestions: string[];
  linkedContactId: string | null;
  creatingContact: boolean;
  onSelectSuggestion: (name: string) => void;
  onCreateContact: () => void;
  isKnownContactName: (name: string) => boolean;
  formThemed: ReturnType<typeof usePortfolioFormTheme>;
}) {
  const { colors } = useAppTheme();
  const trimmedValue = value.trim();
  const showCreateContact =
    trimmedValue.length > 0 && !linkedContactId && !isKnownContactName(trimmedValue);

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, formThemed.textSecondary]}>
        {CHILD_SUPPORT_BENEFICIARY_LABEL} (optionnel)
      </Text>
      <Text style={[styles.formHint, formThemed.textMuted]}>{CHILD_SUPPORT_BENEFICIARY_HINT}</Text>
      <TextInput
        style={[styles.input, formThemed.control, formThemed.text]}
        placeholder={CHILD_SUPPORT_BENEFICIARY_PLACEHOLDER}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestionRow}>
          {suggestions.map((name) => (
            <Pressable
              key={name}
              onPress={() => onSelectSuggestion(name)}
              style={({ pressed }) => [styles.suggestionChip, formThemed.control, pressed && styles.pressed]}
            >
              <AppIcon family="ionicons" name="person-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.suggestionText, formThemed.text]} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showCreateContact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer le contact"
          onPress={onCreateContact}
          disabled={creatingContact}
          style={({ pressed }) => [
            styles.createContactButton,
            formThemed.control,
            pressed && styles.pressed,
            creatingContact && styles.createContactButtonDisabled,
          ]}
        >
          <AppIcon family="ionicons" name="person-add-outline" size={16} color={colors.primary} />
          <Text style={[styles.createContactButtonText, formThemed.selectedText]}>
            {creatingContact ? 'Création...' : 'Créer le contact'}
          </Text>
        </Pressable>
      ) : null}
      {linkedContactId ? (
        <Text style={[styles.linkedContactHint, formThemed.textMuted]}>
          Lié au contact existant — aucun doublon ne sera créé.
        </Text>
      ) : null}
    </View>
  );
}

function AccountInput(props: React.ComponentProps<typeof TextInput> & { label: string; suffix?: string }) {
  const { label, suffix, keyboardType, ...inputProps } = props;
  const { colors } = useAppTheme();
  const formThemed = usePortfolioFormTheme();
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, formThemed.textSecondary]}>{label}</Text>
      {suffix ? (
        <View style={[styles.inputShell, formThemed.control]}>
          <InputComponent
            {...inputProps}
            keyboardType={keyboardType}
            style={[styles.inputWithSuffix, formThemed.text]}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.inputSuffix, formThemed.textSecondary]}>{suffix}</Text>
        </View>
      ) : (
        <InputComponent
          {...inputProps}
          keyboardType={keyboardType}
          style={[styles.input, formThemed.control, formThemed.text]}
          placeholderTextColor={colors.textMuted}
        />
      )}
    </View>
  );
}

function AccountBalanceChart({
  accounts,
  onAccountPress,
  onAddAccount,
  onReorder,
  onDragStateChange,
}: {
  accounts: SimulatedAccount[];
  onAccountPress: (account: SimulatedAccount) => void;
  onAddAccount: () => void;
  onReorder: (nextAccounts: SimulatedAccount[]) => void | Promise<void>;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const sectionCardSurface = colors.containerBackground;
  const sectionSoftSurface = colors.surfaceElevated;
  const sectionBorder = colors.containerBorder;

  return (
    <View style={styles.accountVisualSection}>
      <HubSectionHeader eyebrow="Comptes" title="Soldes des comptes" />

      {accounts.length === 0 ? (
        <View
          style={[
            styles.balanceChartEmpty,
            {
              backgroundColor: sectionCardSurface,
              borderColor: sectionBorder,
            },
          ]}
        >
          <View style={[styles.emptyVisualIcon, { backgroundColor: sectionSoftSurface }]}>
            <AppIcon family="ionicons" name="bar-chart-outline" size={18} color={colors.textMuted} />
          </View>
          <Text style={[styles.balanceChartEmptyTitle, { color: colors.text }]}>Aucun compte à afficher</Text>
          <Text style={[styles.balanceChartEmptyText, { color: colors.textMuted }]}>
            Crée un compte simulé pour obtenir une carte de solde distincte avec son indicateur visuel.
          </Text>
        </View>
      ) : (
        <ReorderableAccountBalanceList
          accounts={accounts}
          onAccountPress={onAccountPress}
          onReorder={onReorder}
          onDragStateChange={onDragStateChange}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter un compte"
        onPress={onAddAccount}
        style={({ pressed }) => [
          styles.premiumAddCta,
          {
            backgroundColor: sectionCardSurface,
            borderColor: sectionBorder,
          },
          pressed && floatingGlassButtonPressed,
        ]}
      >
        <AppIcon family="ionicons" name="add" size={18} color={colors.textSecondary} />
        <Text style={[styles.premiumAddCtaLabel, typographyKit.bodyBold, { color: colors.text }]}>
          Ajouter
        </Text>
      </Pressable>
    </View>
  );
}

function WealthPropertyTypeSelector({
  value,
  onChange,
  formThemed,
}: {
  value: string;
  onChange: (value: string) => void;
  formThemed: ReturnType<typeof usePortfolioFormTheme>;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, formThemed.textSecondary]}>Type de bien</Text>
      <View style={styles.typeRow}>
        {WEALTH_PROPERTY_TYPE_OPTIONS.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                tapHaptic();
                onChange(option);
              }}
              style={[styles.typeChip, selected ? formThemed.selected : formThemed.control]}
            >
              <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PropertyPhotoField({
  photoUri,
  onPick,
  colors,
  formThemed,
}: {
  photoUri: string;
  onPick: () => void;
  colors: AppColors;
  formThemed: ReturnType<typeof usePortfolioFormTheme>;
}) {
  const trimmed = photoUri.trim();
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, formThemed.textSecondary]}>Photo (optionnel)</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={trimmed ? 'Modifier la photo du bien' : 'Ajouter une photo du bien'}
        onPress={onPick}
        style={({ pressed }) => [
          styles.propertyPhotoBtn,
          formThemed.control,
          pressed && { opacity: 0.78 },
        ]}
      >
        {trimmed ? (
          <Image source={{ uri: trimmed }} style={styles.propertyPhotoPreview} contentFit="cover" />
        ) : (
          <View style={styles.propertyPhotoPlaceholder}>
            <AppIcon family="ionicons" name="image-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.propertyPhotoHint, formThemed.textMuted]}>Galerie ou caméra</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function parseMoney(value: string) {
  return parseFormattedNumber(value);
}


function parseOptionalMoney(value: string) {
  const parsed = parseMoney(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(sanitizeNumericInput(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}


function accountKindLabel(kind: AccountKind) {
  if (kind === 'credit') return 'Crédit';
  if (kind === 'savings') return 'Épargne';
  if (kind === 'cash') return 'Argent Cash';
  return 'Chèque';
}

function materialLabel(material: WealthMaterial) {
  if (material === 'gold') return 'Or';
  if (material === 'silver') return 'Argent';
  if (material === 'platinum') return 'Platine';
  return 'Diamant';
}

function defaultWealthName(type: WealthAssetType, material: WealthMaterial, propertyType: string) {
  if (type === 'real_estate') return realEstateAssetName(propertyType);
  return materialLabel(material);
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


const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
    gap: 0,
  },
  ambientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 420,
    height: 260,
    zIndex: 0,
  },
  pageHeaderBlock: {
    gap: PAGE_TITLE_CONTENT_GAP,
  },
  pageHeroBlock: {
    alignItems: 'flex-start',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  pageHeaderRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  pageScopeTabs: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  chartHubSection: {
    marginTop: PORTFOLIO_SECTION_GAP,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  chartHubCard: {
    gap: spacing.md,
  },
  chartScreenBleed: (screenWidth: number) => ({
    width: screenWidth - 4,
    marginLeft: -(PAGE_PADDING_HORIZONTAL - 2),
  }),
  heroMetricsBlock: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  heroAmountDeltaColumn: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  accountsSectionBlock: {
    gap: 0,
    marginTop: PAGE_SECTION_BREAK,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  patrimoineSectionBlock: {
    gap: PORTFOLIO_SECTION_GAP,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: PAGE_SECTION_BREAK,
    marginBottom: spacing.sm,
  },
  sectionCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  sectionCountBadgeLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
  },
  heroEyebrow: {
    marginBottom: spacing.md,
  },
  heroEyebrowCashFlow: {
    marginBottom: spacing.xl,
  },
  pageTitle: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
    minWidth: 0,
  },
  pageTitleInHeader: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
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
    letterSpacing: 0.1,
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
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
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
  loanFormHero: {
    alignItems: 'flex-start',
  },
  loanFormHeroHint: {
    flex: 1,
    flexShrink: 1,
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
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  propertyPhotoBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 120,
    justifyContent: 'center',
  },
  propertyPhotoPreview: {
    width: '100%',
    height: 160,
  },
  propertyPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 120,
    paddingVertical: spacing.md,
  },
  propertyPhotoHint: {
    fontSize: typography.meta,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  accountVisualSection: {
    gap: spacing.lg,
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
    ...jakartaBoldText,
    color: colors.text,
    minWidth: 0,
    fontSize: typography.meta,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  accountVisualMeta: {
    ...jakartaBoldText,
    color: colors.textMuted,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
  accountVisualBalanceStack: {
    flexShrink: 0,
    maxWidth: '40%',
    alignItems: 'flex-end',
    gap: 2,
  },
  accountVisualAmount: {
    ...dashboardPaymentAmount,
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
    ...jakartaSemiboldText,
    fontSize: typography.micro,
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
  accountVisualCompactInfoGroup: {
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
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  accountVisualLimitNearBannerText: {
    flex: 1,
    flexShrink: 1,
    ...jakartaBoldText,
    fontSize: typography.meta,
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
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  balanceChartEmpty: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
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
  floatingActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 92,
    minHeight: 46,
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
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
  formModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  formModalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '86%',
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
    borderRadius: 30,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...ghostCardShadow,
  },
  formModalSheet: {
    marginTop: 88,
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: spacing.md,
  },
  formModalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
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
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
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
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  formHeadCopy: { flex: 1, minWidth: 0, gap: 4 },
  formTitle: {
    flex: 1,
    ...jakartaExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  formHint: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 17,
  },
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
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
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
  typePickerSubtitle: {
    ...jakartaMediumText,
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  typePickerList: {
    gap: spacing.sm,
  },
  typePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  typePickerIconWell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePickerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  typePickerLabel: {
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  typePickerDescription: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
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
  typeChipText: {
    ...jakartaMediumText,
    fontSize: typography.meta,
  },
  inputGroup: { gap: spacing.sm },
  childSupportEyebrow: {
    ...typographyKit.eyebrow,
  },
  label: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 21,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: radius.lg,
    paddingRight: spacing.md,
  },
  inputWithSuffix: {
    flex: 1,
    minWidth: 0,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.md,
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  inputSuffix: {
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  suggestionText: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  createContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  createContactButtonDisabled: {
    opacity: 0.6,
  },
  createContactButtonText: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  linkedContactHint: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    lineHeight: 15,
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
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
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
  loansExpandedContent: {
    gap: spacing.sm,
  },
});
