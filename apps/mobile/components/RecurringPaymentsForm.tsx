import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  DraggableSheetScrollView,
  DraggableSheetSurface,
} from '@/components/DraggableSheetSurface';
import {
  FORM_SHEET_CONTENT_PADDING_TOP,
  FormSheetChromeHeader,
  FormSheetModalBody,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  useFormSheetHeight,
  useFormSheetKeyboardInset,
} from '@/lib/sheet/formSheetScroll';
import { BudgetCategoryPicker } from '@/components/BudgetCategoryPicker';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { LogoIconFrame } from '@/components/IconFrame';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PremiumSwitch } from '@/components/PremiumSwitch';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { SettingsSelectField } from '@/components/SettingsSelectField';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { formValidationError, type FormFeedback, type FormSaveResult } from '@/lib/formFeedback';
import { parseFormattedNumber, sanitizeNumericInput } from '@/lib/formatNumber';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { type MdiIconName } from '@/lib/mdiIconCatalog';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import { ghost } from '@/constants/ghostUi';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  FORM_SECTION_LABEL_STYLE,
  colors,
  ICON_WELL_SIZE,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaSemiboldText,
  moneyAmountTypography,
  jakartaMediumText,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typography,
  typographyKit,
} from '@/constants/theme';
import {
  accountBalanceIconForKind,
  accountPickerRowPresentation,
} from '@/lib/accountBalancePresentation';
import {
  getLoans,
  upsertRecurringPayment,
} from '@/lib/db';
import { getChildSupportSalaryNotices } from '@/lib/childSupportLoan';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { getMerchantLogoUrl, RECURRING_SERVICE_LOGO_OPTIONS } from '@/lib/merchantLogo';
import { resolveRecurringPaymentDisplayIcon } from '@/lib/recurringPaymentPresentation';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import type { AccountKind, Category, CategoryBudget, Loan, RecurringPayment, RecurringPaymentFrequency, RecurringPaymentKind, SimulatedAccount } from '@/types';

type IconName = keyof typeof Ionicons.glyphMap;
type LogoSelectionMode = 'auto' | 'logo' | 'icon';

export type AccountOption = {
  id: string;
  label: string;
  tint: string;
  kind?: AccountKind;
  /** Sheet primary line (institution / account name). */
  pickerLabel?: string;
  description?: string;
  fieldLabel?: string;
  icon?: string | null;
  logoUrl?: string | null;
};

type RecurringCategoryRule = {
  categoryIds: string[];
  categoryNames: string[];
  keywords: string[];
  kinds?: RecurringPaymentKind[];
};

export type RecurringPaymentAddVariant = 'subscription' | 'bill' | 'income';

export type PaymentForm = {
  id: string;
  name: string;
  amount: string;
  kind: RecurringPaymentKind;
  /** UI variant for add/edit — locks title + fields (chooser sets this; edit infers it). */
  addVariant: RecurringPaymentAddVariant;
  accountId: string;
  accountLabel: string;
  categoryId: string | null;
  frequency: RecurringPaymentFrequency;
  dueDay: string;
  nextDate: string;
  endDate: string;
  active: boolean;
  icon: string;
  color: string;
  logoUrl: string | null;
  logoMode: LogoSelectionMode;
  createdAt: string;
  /** True while creating — hide impact/projection until the item exists. */
  isNew?: boolean;
};

const FREQUENCIES: Array<{ id: RecurringPaymentFrequency; label: string }> = [
  { id: 'weekly', label: 'Hebdo' },
  { id: 'biweekly', label: 'Bihebdo' },
  { id: 'monthly', label: 'Mensuel' },
  { id: 'yearly', label: 'Annuel' },
];
const DEFAULT_COLOR = '#00A854';
const DEFAULT_ICON = 'RecurringEvent';
const COMPACT_CATEGORY_LIMIT = 5;

const MANUAL_ACCOUNT_ICONS: Record<string, string> = {
  checking: 'wallet-outline',
  credit: 'card-outline',
  savings: 'cash-outline',
  cash: 'cash-banknotes-outline',
};

const INCOME_CATEGORY_TERMS = ['revenu', 'revenus', 'salaire', 'paie', 'paye', 'payroll', 'income'];

const RECURRING_CATEGORY_RULES: RecurringCategoryRule[] = [
  {
    categoryIds: ['cat-fun'],
    categoryNames: ['loisir', 'loisirs', 'divertissement'],
    keywords: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'disney',
      'disney plus',
      'crave',
      'apple music',
      'apple tv',
      'google one',
      'icloud',
      'adobe',
      'dropbox',
      'notion',
      'slack',
      'zoom',
      'abonnement',
      'subscription',
      'mensualite',
    ],
  },
  {
    categoryIds: ['cat-phone'],
    categoryNames: ['telephone', 'internet', 'cellulaire', 'telecom', 'facture'],
    keywords: ['telephone', 'cellulaire', 'internet', 'telus', 'bell', 'rogers', 'videotron', 'fizz', 'koodo', 'virgin', 'phone'],
  },
  {
    categoryIds: ['cat-home'],
    categoryNames: ['loyer', 'logement', 'maison', 'appartement', 'hypotheque', 'habitation'],
    keywords: ['loyer', 'rent', 'logement', 'appartement', 'maison', 'hypotheque', 'mortgage', 'condo'],
  },
  {
    categoryIds: ['cat-home'],
    categoryNames: ['hydro', 'electricite', 'chauffage', 'eau', 'gaz', 'energie', 'facture'],
    keywords: ['hydro', 'electricite', 'chauffage', 'eau', 'gaz', 'energie', 'utility', 'utilities', 'bill', 'facture'],
  },
  {
    categoryIds: ['cat-car-payment', 'cat-car-insurance', 'cat-transport', 'cat-gas'],
    categoryNames: ['auto', 'vehicule', 'transport', 'assurance auto', 'stationnement', 'essence'],
    keywords: ['auto', 'voiture', 'vehicule', 'saaq', 'permis', 'assurance auto', 'stationnement', 'opus', 'stm', 'transport', 'essence'],
  },
  {
    categoryIds: [],
    categoryNames: ['assurance', 'assurances'],
    keywords: ['assurance', 'insurance', 'desjardins assurance', 'belair', 'intact', 'beneva', 'ssq'],
  },
  {
    categoryIds: ['cat-bank-loan'],
    categoryNames: ['pret', 'credit', 'dette', 'carte de credit', 'banque', 'financement'],
    keywords: ['pret', 'loan', 'credit', 'visa', 'mastercard', 'marge', 'financement', 'dette', 'banque'],
  },
  {
    categoryIds: [],
    categoryNames: ['epargne', 'economies', 'placement', 'investissement', 'reer', 'celi'],
    keywords: ['epargne', 'savings', 'placement', 'investissement', 'reer', 'celi', 'wealthsimple'],
  },
  {
    categoryIds: ['cat-food'],
    categoryNames: ['epicerie', 'alimentation', 'nourriture', 'courses'],
    keywords: ['epicerie', 'costco', 'walmart', 'iga', 'metro', 'provigo', 'maxi', 'goodfood', 'hello fresh', 'meal kit'],
  },
  {
    categoryIds: [],
    categoryNames: INCOME_CATEGORY_TERMS,
    keywords: ['paie', 'salaire', 'payroll', 'revenu', 'pension', 'allocation', 'depot direct', 'direct deposit'],
    kinds: ['income'],
  },
];

const RECURRING_FALLBACK_CATEGORY_TERMS = [
  'facture',
  'loyer',
  'logement',
  'maison',
  'transport',
  'auto',
  'assurance',
  'pret',
  'epargne',
  'autre',
  'divers',
];

const SUBSCRIPTION_CATEGORY_TERMS = ['abonnement', 'subscription', 'loisir', 'loisirs', 'divertissement'];
const SUBSCRIPTION_DEFAULT_ICON = 'Movie';
const SUBSCRIPTION_DEFAULT_COLOR = '#F43F5E';

export function createNewRecurringPaymentForm(
  _accounts: AccountOption[],
  _categories: Category[],
  variant: RecurringPaymentAddVariant = 'bill',
): PaymentForm {
  const kind: RecurringPaymentKind = variant === 'income' ? 'income' : 'payment';
  const isSubscription = variant === 'subscription';
  return {
    id: createLocalId(),
    name: '',
    amount: '',
    kind,
    addVariant: variant,
    accountId: '',
    accountLabel: '',
    categoryId: null,
    frequency: 'monthly',
    dueDay: '',
    nextDate: '',
    endDate: '',
    active: true,
    icon: kind === 'income' ? 'AttachMoney' : isSubscription ? SUBSCRIPTION_DEFAULT_ICON : DEFAULT_ICON,
    color: kind === 'income' ? ghost.mint : isSubscription ? SUBSCRIPTION_DEFAULT_COLOR : DEFAULT_COLOR,
    logoUrl: null,
    logoMode: isSubscription ? 'icon' : 'auto',
    createdAt: new Date().toISOString(),
    isNew: true,
  };
}

function formAddVariant(form: PaymentForm): RecurringPaymentAddVariant {
  return form.addVariant ?? (form.kind === 'income' ? 'income' : 'bill');
}

export function recurringFormTitle(variant: RecurringPaymentAddVariant): string {
  if (variant === 'income') return 'Revenu récurrent';
  if (variant === 'subscription') return 'Abonnement';
  return 'Paiement récurrent';
}

function nameFieldLabel(variant: RecurringPaymentAddVariant): string {
  if (variant === 'income') return 'Source du revenu';
  if (variant === 'subscription') return 'Service / abonnement';
  return 'Marchand / paiement';
}

function nameFieldPlaceholder(variant: RecurringPaymentAddVariant): string {
  if (variant === 'income') return 'Ex. Paie, pension, allocation...';
  if (variant === 'subscription') return 'Ex. Netflix, Spotify, iCloud...';
  return 'Ex. Loyer, Hydro, assurance...';
}

function nextDateFieldLabel(variant: RecurringPaymentAddVariant): string {
  if (variant === 'subscription') return 'Renouvellement';
  if (variant === 'income') return 'Prochaine date';
  return 'Prochaine échéance';
}

function impactFieldLabel(variant: RecurringPaymentAddVariant): string {
  if (variant === 'income') return 'Projection revenu';
  if (variant === 'subscription') return 'Coût abonnement';
  return 'Impact budget';
}

function identityGhostIcon(variant: RecurringPaymentAddVariant): IconName {
  if (variant === 'income') return 'trending-up-outline';
  if (variant === 'subscription') return 'repeat-outline';
  return 'receipt-outline';
}

export function inferRecurringAddVariant(payment: RecurringPayment): RecurringPaymentAddVariant {
  if ((payment.kind ?? 'payment') === 'income') return 'income';
  if (payment.categoryId === 'cat-fun') return 'subscription';
  const categoryName = payment.categoryName?.trim() ?? '';
  if (categoryName && SUBSCRIPTION_CATEGORY_TERMS.some((term) => searchMatchesKeyword(categoryName, term))) {
    return 'subscription';
  }
  return 'bill';
}

function PaymentFormModal({
  visible,
  form,
  accounts,
  categories,
  categoryBudgets,
  saving,
  bottomInset,
  onClose,
  onChange,
  onSave,
  onDelete,
  feedback,
}: {
  visible: boolean;
  form: PaymentForm | null;
  accounts: AccountOption[];
  categories: Category[];
  categoryBudgets: CategoryBudget[];
  saving: boolean;
  bottomInset: number;
  onClose: () => void;
  onChange: (form: PaymentForm | null | ((current: PaymentForm | null) => PaymentForm | null)) => void;
  onSave: () => void;
  onDelete?: () => void;
  feedback?: FormFeedback | null;
}) {
  const { colors: themeColors, isLight } = useAppTheme();
  const sheetHeight = useFormSheetHeight(0.92);
  const keyboardInset = useFormSheetKeyboardInset();
  const sectionLabelStyle = useMemo(
    () => [FORM_SECTION_LABEL_STYLE, { color: themeColors.text }],
    [themeColors.text],
  );
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (!visible) return;
    void getLoans().then(setLoans);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setShowLogoPicker(false);
    }
  }, [visible]);

  useEffect(() => {
    setShowLogoPicker(false);
  }, [form?.id, form?.kind]);

  const accountPickerOptions = useMemo<SettingsPickerOption<string>[]>(
    () =>
      accounts.map((account) => ({
        id: account.id,
        label: account.pickerLabel ?? account.label.split(' • ')[0] ?? account.label,
        description: account.description,
        fieldLabel: account.fieldLabel ?? account.label,
        icon:
          account.icon ??
          (account.kind ? accountBalanceIconForKind(account.kind) : 'wallet-outline'),
        logoUrl: account.logoUrl ?? null,
      })),
    [accounts],
  );

  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: {
        backgroundColor: themeColors.background,
        borderColor: themeColors.containerBorder,
      },
      /** Must override StyleSheet — static `colors` is always dark. */
      sheetScroller: { backgroundColor: themeColors.background },
      handle: { backgroundColor: themeColors.borderStrong },
      closeButton: {
        backgroundColor: themeColors.surfaceElevated,
        borderColor: themeColors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      control: {
        backgroundColor: themeColors.surfaceElevated,
        borderColor: themeColors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      controlStrong: {
        backgroundColor: themeColors.input,
        borderColor: themeColors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      logoPanel: {
        backgroundColor: themeColors.surfaceElevated,
        borderColor: themeColors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      logoFallback: { backgroundColor: themeColors.surface, borderColor: themeColors.border },
      selected: {
        backgroundColor: themeColors.successMuted,
        borderColor: themeColors.primary,
      },
      selectedText: { color: themeColors.primary },
      text: { color: themeColors.text },
      textSecondary: { color: themeColors.textSecondary },
      textMuted: { color: themeColors.textMuted },
    }),
    [isLight, themeColors],
  );

  const childSupportSalaryNotices = useMemo(
    () =>
      form?.kind === 'income'
        ? getChildSupportSalaryNotices(loans, form.accountId, form.name)
        : [],
    [form?.accountId, form?.kind, form?.name, loans],
  );

  if (!form) return null;
  const addVariant = formAddVariant(form);
  const isIncome = addVariant === 'income';
  const isSubscription = addVariant === 'subscription';
  const isBill = addVariant === 'bill';
  const canSubmit = Boolean(form.name.trim()) && parseAmount(form.amount) > 0 && Boolean(form.accountId) && Boolean(form.nextDate.trim());
  const visibleCategories = getRecurringCategoryBase(categories, form.kind);
  const autoLogoUrl = getMerchantLogoUrl(form.name.trim());
  const previewLogoUrl = form.logoMode === 'logo' ? form.logoUrl : form.logoMode === 'auto' ? autoLogoUrl : null;
  const previewIcon =
    form.logoMode === 'icon'
      ? form.icon
      : isIncome
        ? 'AttachMoney'
        : isSubscription
          ? SUBSCRIPTION_DEFAULT_ICON
          : DEFAULT_ICON;
  const impactSummary = getRecurringImpactSummary(form, categoryBudgets);
  const selectedCategoryBudget =
    !isIncome && form.categoryId
      ? categoryBudgets.find((item) => item.categoryId === form.categoryId) ?? null
      : null;
  const showBudgetProgress =
    isBill &&
    selectedCategoryBudget != null &&
    (selectedCategoryBudget.limitAmount > 0 || selectedCategoryBudget.spent > 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.modalBackdrop, themed.modalBackdrop]}>
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[styles.sheet, themed.sheet]}
            >
              <FormSheetChromeHeader
                title={recurringFormTitle(addVariant)}
                onClose={onClose}
                titleColor={themeColors.text}
                closeIconColor={themeColors.textMuted}
                handleColor={themeColors.borderStrong}
                closeButtonStyle={themed.closeButton}
                headerStyle={styles.sheetHeaderPad}
              />
              <DraggableSheetScrollView
                style={[styles.sheetScroller, themed.sheetScroller, formSheetScrollViewStyle()]}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                contentContainerStyle={[
                  styles.sheetContent,
                  formSheetScrollContentStyle,
                  { paddingBottom: formSheetScrollPaddingBottom(bottomInset, keyboardInset) },
                ]}
              >

            <View style={styles.section}>
              <DashboardSectionLabel>{nameFieldLabel(addVariant)}</DashboardSectionLabel>
              <View style={styles.identityRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Changer le logo ou l'icône"
                  onPress={() => {
                    tapHaptic();
                    setShowLogoPicker((shown) => !shown);
                  }}
                  style={({ pressed }) => [styles.iconAffordance, pressed && styles.pressed]}
                >
                  {previewLogoUrl ? (
                    <LogoIconFrame uri={previewLogoUrl} size={40} />
                  ) : form.name.trim() || form.logoMode === 'icon' ? (
                    <View style={styles.iconSlot}>
                      <UserPickedIconBadge icon={previewIcon} size={40} iconSize={22} wellGlyphWhite />
                    </View>
                  ) : (
                    <View style={styles.iconGhostSlot} accessibilityElementsHidden>
                      <AppIcon
                        family="ionicons"
                        name={identityGhostIcon(addVariant)}
                        size={28}
                        color={themeColors.textMuted}
                      />
                    </View>
                  )}
                  <AppIcon
                    family="ionicons"
                    name="create-outline"
                    size={16}
                    color={themeColors.textMuted}
                  />
                </Pressable>
                <TextInput
                  style={[
                    styles.nameInput,
                    {
                      color: themeColors.text,
                      borderBottomColor: themeColors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  placeholder={nameFieldPlaceholder(addVariant)}
                  placeholderTextColor={themeColors.textMuted}
                  value={form.name}
                  onChangeText={(name) =>
                    onChange((current) =>
                      current
                        ? {
                            ...current,
                            name,
                            logoUrl: current.logoMode === 'auto' ? null : current.logoUrl,
                          }
                        : current,
                    )
                  }
                  returnKeyType="next"
                />
              </View>
            </View>

            {showLogoPicker ? (
              <View style={styles.section}>
                <DashboardSectionLabel>Logo / icône</DashboardSectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.logoOptionRow}
                  keyboardShouldPersistTaps="handled"
                >
                  <RecurringLogoOption
                    label="Auto"
                    selected={form.logoMode === 'auto'}
                    logoUrl={autoLogoUrl}
                    fallbackIcon="sparkles-outline"
                    fallbackColor={themeColors.textMuted}
                    onPress={() => {
                      tapHaptic();
                      onChange((current) =>
                        current
                          ? {
                              ...current,
                              logoMode: 'auto',
                              logoUrl: null,
                              icon:
                                formAddVariant(current) === 'subscription'
                                  ? SUBSCRIPTION_DEFAULT_ICON
                                  : defaultIconForKind(current.kind),
                              color:
                                current.kind === 'income'
                                  ? ghost.mint
                                  : formAddVariant(current) === 'subscription'
                                    ? SUBSCRIPTION_DEFAULT_COLOR
                                    : DEFAULT_COLOR,
                            }
                          : current,
                      );
                      setShowLogoPicker(false);
                    }}
                  />
                  {RECURRING_SERVICE_LOGO_OPTIONS.map((option) => (
                    <RecurringLogoOption
                      key={option.id}
                      label={option.label}
                      selected={form.logoMode === 'logo' && form.logoUrl === option.logoUrl}
                      logoUrl={option.logoUrl}
                      fallbackIcon="storefront-outline"
                      fallbackColor={themeColors.textMuted}
                      onPress={() => {
                        tapHaptic();
                        onChange((current) =>
                          current
                            ? {
                                ...current,
                                logoMode: 'logo',
                                logoUrl: option.logoUrl,
                                icon: defaultIconForKind(current.kind),
                                color: current.kind === 'income' ? ghost.mint : DEFAULT_COLOR,
                              }
                            : current,
                        );
                        setShowLogoPicker(false);
                      }}
                    />
                  ))}
                </ScrollView>
                <Text style={[styles.logoPickerHint, themed.textMuted]}>Icônes MDI</Text>
                <MdiIconPicker
                  selectedIcon={form.logoMode === 'icon' ? form.icon : previewIcon}
                  onSelect={(icon: MdiIconName) => {
                    onChange((current) =>
                      current
                        ? {
                            ...current,
                            logoMode: 'icon',
                            logoUrl: null,
                            icon,
                            color:
                              current.kind === 'income'
                                ? ghost.mint
                                : formAddVariant(current) === 'subscription'
                                  ? SUBSCRIPTION_DEFAULT_COLOR
                                  : DEFAULT_COLOR,
                          }
                        : current,
                    );
                    setShowLogoPicker(false);
                  }}
                />
              </View>
            ) : null}

            <View style={styles.section}>
              <DashboardSectionLabel style={sectionLabelStyle}>Montant</DashboardSectionLabel>
              <View style={[styles.inputShell, themed.controlStrong]}>
                <NumericAmountInput
                  value={form.amount}
                  onChangeText={(amount) =>
                    onChange((current) => (current ? { ...current, amount } : current))
                  }
                  placeholder="0"
                  placeholderTextColor={themeColors.textMuted}
                  style={[styles.inputWithSuffix, { color: themeColors.text }]}
                />
                <Text style={[styles.suffix, { color: themeColors.textSecondary }]}>$</Text>
              </View>
            </View>

            <View style={styles.section}>
              <DashboardSectionLabel style={sectionLabelStyle}>Fréquence</DashboardSectionLabel>
              <ThemeSegmentedControl
                tabs={FREQUENCIES}
                active={form.frequency}
                size="sm"
                variant="section"
                onChange={(frequency) => {
                  tapHaptic();
                  onChange((current) => (current ? { ...current, frequency } : current));
                }}
              />
            </View>

            {!form.isNew ? (
              <View style={[styles.impactCard, themed.logoPanel]}>
                <DashboardSectionLabel style={sectionLabelStyle}>
                  {impactFieldLabel(addVariant)}
                </DashboardSectionLabel>
                <Text
                  style={[
                    styles.impactValue,
                    themed.text,
                    isIncome && { color: themeColors.primary },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {impactSummary.primary}
                </Text>
                <Text style={[styles.impactHint, themed.textMuted]}>{impactSummary.secondary}</Text>
                {showBudgetProgress && selectedCategoryBudget ? (
                  <View style={styles.impactBudgetProgress}>
                    <CategoryBudgetProgress budget={selectedCategoryBudget} />
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.activeRow, themed.control]}>
              <Text style={[sectionLabelStyle, styles.activeRowLabel]}>Actif</Text>
              <PremiumSwitch
                accessibilityLabel={form.active ? 'Paiement actif' : 'Paiement inactif'}
                value={form.active}
                onValueChange={(active) => {
                  tapHaptic();
                  onChange((current) => (current ? { ...current, active } : current));
                }}
              />
            </View>

            <DatePickerField
              label={nextDateFieldLabel(addVariant)}
              value={form.nextDate}
              placeholder="Choisir une date"
              variant="sheet"
              labelStyle={sectionLabelStyle}
              onChangeDate={(nextDate) => onChange((current) => (current ? { ...current, nextDate } : current))}
            />

            {isBill || isSubscription ? (
              <DatePickerField
                label="Date de fin (optionnelle)"
                value={form.endDate}
                placeholder="Aucune date de fin"
                allowClear
                variant="sheet"
                labelStyle={sectionLabelStyle}
                onChangeDate={(endDate) => onChange((current) => (current ? { ...current, endDate } : current))}
              />
            ) : null}

            <View style={styles.section}>
              <SettingsSelectField
                label={isIncome ? 'Compte de dépôt' : 'Méthode de paiement'}
                options={accountPickerOptions}
                selectedId={form.accountId}
                onSelect={(accountId) => {
                  tapHaptic();
                  const account = accounts.find((a) => a.id === accountId);
                  if (!account) return;
                  onChange((current) =>
                    current
                      ? { ...current, accountId: account.id, accountLabel: account.label }
                      : current,
                  );
                }}
                pickerTitle={isIncome ? 'Compte de dépôt' : 'Compte de paiement'}
                placeholder="Choisir un compte"
                emptyHint="Ajoute un compte pour enregistrer."
                labelStyle={sectionLabelStyle}
              />
            </View>

            {childSupportSalaryNotices.map((notice) => (
              <ThemedFormMessage
                key={`${notice.variant}-${notice.title}`}
                variant={notice.variant === 'info' ? 'success' : notice.variant}
                title={notice.title}
                message={notice.message}
              />
            ))}

            {!isIncome ? (
              <View style={styles.section}>
                <BudgetCategoryPicker
                  categories={visibleCategories}
                  searchText={form.name}
                  selectedId={form.categoryId}
                  labelStyle={sectionLabelStyle}
                  onSelect={(categoryId) => {
                    tapHaptic();
                    onChange((current) =>
                      current ? { ...current, categoryId } : current,
                    );
                  }}
                />
              </View>
            ) : null}

            {feedback ? (
              <ThemedFormMessage
                variant={feedback.variant}
                title={feedback.title}
                message={feedback.message}
              />
            ) : null}

            <PrimarySaveButton
              label={saving ? 'Enregistrement...' : 'Enregistrer'}
              onPress={onSave}
              disabled={saving || !canSubmit}
            />
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer"
                onPress={onDelete}
                style={({ pressed }) => [
                  subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                  pressed && { opacity: 0.72 },
                ]}
              >
                <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                <Text style={destructiveTextActionStyle(isLight)}>Supprimer</Text>
              </Pressable>
            ) : null}
            </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function RecurringPaymentAvatar({ payment, tint, size }: { payment: RecurringPayment; tint: string; size: number }) {
  return (
    <UserPickedIconBadge
      icon={resolvePaymentIcon(payment)}
      color={tint}
      size={size}
      logoUrl={payment.logoUrl}
      wellGlyphWhite
    />
  );
}

function RecurringLogoOption({
  label,
  selected,
  logoUrl,
  fallbackIcon,
  fallbackColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  logoUrl?: string | null;
  fallbackIcon: IconName;
  fallbackColor: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Auto' ? 'Utiliser le logo automatique' : logoUrl ? 'Choisir ce logo' : 'Choisir cette icône'}
      onPress={onPress}
      style={[
        styles.logoOption,
        {
          backgroundColor: selected ? colors.scopeActive : colors.surfaceSolid,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {logoUrl ? (
        <LogoIconFrame uri={logoUrl} size={ICON_WELL_SIZE} />
      ) : (
        <UserPickedIconBadge icon={fallbackIcon} color={fallbackColor} size={ICON_WELL_SIZE} />
      )}
    </Pressable>
  );
}

export function toAccountOptions(accounts: SimulatedAccount[]): AccountOption[] {
  return accounts.map((account) => {
    const row = accountPickerRowPresentation(account);
    return {
      id: account.id,
      label: row.fieldLabel,
      pickerLabel: row.label,
      description: row.description,
      fieldLabel: row.fieldLabel,
      icon: row.icon,
      logoUrl: row.logoUrl,
      kind: account.kind,
      tint:
        account.kind === 'checking'
          ? ghost.mint
          : account.kind === 'cash'
            ? '#22C55E'
            : account.kind === 'credit'
              ? '#d4d4d8'
              : '#A78BFA',
    };
  });
}

export function manualAccountOptions(): AccountOption[] {
  return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
    id: account.id,
    label: account.label,
    pickerLabel: account.label,
    description:
      account.id === 'checking' ? 'Chèque' : account.id === 'credit' ? 'Crédit' : 'Épargne',
    fieldLabel: account.label,
    icon: MANUAL_ACCOUNT_ICONS[account.id] ?? 'wallet-outline',
    logoUrl: null,
    tint: account.tint,
    kind: account.id as AccountKind,
  }));
}

function monthlyEquivalent(payment: RecurringPayment) {
  return (payment.amount * annualMultiplier(payment.frequency)) / 12;
}

function annualMultiplier(frequency: RecurringPaymentFrequency) {
  if (frequency === 'weekly') return 52;
  if (frequency === 'biweekly') return 26;
  if (frequency === 'yearly') return 1;
  return 12;
}

export function getRecurringImpactSummary(form: PaymentForm, categoryBudgets: CategoryBudget[]) {
  if (!form.active) {
    return {
      primary: 'Inactif',
      secondary:
        form.kind === 'income'
          ? "Ce revenu récurrent n'est pas compté dans les projections."
          : "Ce paiement n'est pas compté dans les dépenses du mois.",
    };
  }

  const amount = Number.isFinite(parseAmount(form.amount)) ? parseAmount(form.amount) : 0;
  const annualAmount = amount * annualMultiplier(form.frequency);
  const monthlyAmount = annualAmount / 12;

  if (form.kind === 'income') {
    return {
      primary: `${formatSignedDisplayMoney(annualAmount, { leadingPlusWhenPositive: true })} / an`,
      secondary: 'Revenu total projeté après 1 an.',
    };
  }

  const categoryBudget = categoryBudgets.find((budget) => budget.categoryId === form.categoryId);
  if (!categoryBudget?.limitAmount) {
    return {
      primary: `${formatDisplayMoneyAbsolute(annualAmount)} / an`,
      secondary: 'Coût annuel estimé. Aucune limite liée.',
    };
  }

  const percent = categoryBudget.limitAmount > 0 ? (monthlyAmount / categoryBudget.limitAmount) * 100 : 0;
  return {
    primary: `${formatDisplayMoneyAbsolute(annualAmount)} / an`,
    secondary: `${formatDisplayMoneyAbsolute(monthlyAmount)} / mois, soit ${formatPercent(percent)} de ${categoryBudget.categoryName}.`,
  };
}

export function frequencyLabel(frequency: RecurringPaymentFrequency) {
  return FREQUENCIES.find((item) => item.id === frequency)?.label ?? 'Mensuel';
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeSearch(input: string): string {
  return stripDiacritics(input.trim().toLowerCase())
    .replace(/['']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearch(input: string): string[] {
  const normalized = normalizeSearch(input);
  return normalized ? normalized.split(' ') : [];
}

function compactSearch(input: string): string {
  return normalizeSearch(input).replace(/\s+/g, '');
}

function tokenMatchesKeyword(token: string, keywordToken: string): boolean {
  if (token === keywordToken) return true;
  if (keywordToken.length < 4) return false;
  return token === `${keywordToken}s` || token === `${keywordToken}x`;
}

function tokenSequenceMatches(tokens: string[], keywordTokens: string[]): boolean {
  if (keywordTokens.length === 0 || keywordTokens.length > tokens.length) return false;

  for (let start = 0; start <= tokens.length - keywordTokens.length; start += 1) {
    const sequenceMatches = keywordTokens.every((keywordToken, offset) =>
      tokenMatchesKeyword(tokens[start + offset], keywordToken),
    );
    if (sequenceMatches) return true;
  }

  return false;
}

function searchMatchesKeyword(text: string, keyword: string): boolean {
  const tokens = tokenizeSearch(text);
  const keywordTokens = tokenizeSearch(keyword);
  if (keywordTokens.length === 0) return false;

  if (keywordTokens.length === 1) {
    return tokens.some((token) => tokenMatchesKeyword(token, keywordTokens[0]));
  }

  if (tokenSequenceMatches(tokens, keywordTokens)) return true;

  const compactKeyword = compactSearch(keyword);
  return compactKeyword.length >= 8 && compactSearch(text).includes(compactKeyword);
}

function addUniqueCategory(target: Category[], category?: Category) {
  if (!category || target.some((item) => item.id === category.id)) return;
  target.push(category);
}

function categoryNameMatches(category: Category, terms: string[]): boolean {
  return terms.some((term) => searchMatchesKeyword(category.name, term));
}

function findCategoriesByName(categories: Category[], terms: string[]): Category[] {
  return categories.filter((category) => categoryNameMatches(category, terms));
}

function getRuleCategoryMatches(rule: RecurringCategoryRule, categories: Category[]): Category[] {
  const matches: Category[] = [];
  for (const id of rule.categoryIds) {
    addUniqueCategory(matches, categories.find((category) => category.id === id));
  }
  for (const category of categories) {
    if (categoryNameMatches(category, rule.categoryNames)) {
      addUniqueCategory(matches, category);
    }
  }
  return matches;
}

function getRecurringCategoryBase(categories: Category[], kind: RecurringPaymentKind): Category[] {
  if (kind === 'income') {
    const incomeCategories = findCategoriesByName(categories, INCOME_CATEGORY_TERMS);
    return incomeCategories.length ? incomeCategories : categories;
  }

  return categories.filter((category) => !categoryNameMatches(category, INCOME_CATEGORY_TERMS));
}

function getRelevantRecurringCategoryChoices(
  text: string,
  categories: Category[],
  selectedId: string | null,
  kind: RecurringPaymentKind,
): Category[] {
  const normalized = normalizeSearch(text);
  const matches: Category[] = [];

  if (kind === 'income') {
    for (const category of findCategoriesByName(categories, INCOME_CATEGORY_TERMS)) {
      addUniqueCategory(matches, category);
    }
  }

  if (normalized) {
    for (const rule of RECURRING_CATEGORY_RULES) {
      if (kind === 'income' && !rule.kinds) continue;
      if (rule.kinds && !rule.kinds.includes(kind)) continue;
      if (!rule.keywords.some((keyword) => searchMatchesKeyword(normalized, keyword))) continue;

      for (const category of getRuleCategoryMatches(rule, categories)) {
        addUniqueCategory(matches, category);
      }
    }

    for (const category of categories) {
      const categoryName = normalizeSearch(category.name);
      if (categoryName.length >= 4 && searchMatchesKeyword(normalized, categoryName)) {
        addUniqueCategory(matches, category);
      }
    }
  }

  if (matches.length === 0) {
    for (const category of findCategoriesByName(categories, RECURRING_FALLBACK_CATEGORY_TERMS)) {
      addUniqueCategory(matches, category);
    }
  }

  const compact = (matches.length > 0 ? matches : categories).slice(0, COMPACT_CATEGORY_LIMIT);
  addUniqueCategory(compact, categories.find((category) => category.id === selectedId));
  return compact;
}

function defaultIconForKind(kind: RecurringPaymentKind): string {
  return kind === 'income' ? 'AttachMoney' : DEFAULT_ICON;
}

function resolvePaymentIcon(payment: RecurringPayment): string {
  return resolveRecurringPaymentDisplayIcon(payment);
}

function inferLogoMode(payment: RecurringPayment): LogoSelectionMode {
  const logoUrl = payment.logoUrl ?? null;
  if (logoUrl) {
    return logoUrl === getMerchantLogoUrl(payment.name) ? 'auto' : 'logo';
  }

  const icon = resolvePaymentIcon(payment);
  return icon === defaultIconForKind(payment.kind === 'income' ? 'income' : 'payment') ? 'auto' : 'icon';
}

function resolveRecurringLogoUrl(form: PaymentForm, savedName: string) {
  if (form.logoMode === 'auto') return getMerchantLogoUrl(savedName);
  if (form.logoMode === 'logo') return form.logoUrl;
  return null;
}

export function recurringPaymentToForm(payment: RecurringPayment): PaymentForm {
  const kind = payment.kind ?? 'payment';
  const addVariant = inferRecurringAddVariant(payment);
  return {
    id: payment.id,
    name: payment.name,
    amount: String(payment.amount || ''),
    kind,
    addVariant,
    accountId: payment.accountId,
    accountLabel: payment.accountLabel,
    categoryId: payment.categoryId ?? null,
    frequency: payment.frequency,
    dueDay: payment.dueDay ? String(payment.dueDay) : '',
    nextDate: payment.nextDate ?? getNextDate(payment.dueDay ?? null, payment.frequency) ?? '',
    endDate: payment.endDate ?? '',
    active: payment.active,
    icon: resolvePaymentIcon(payment),
    color: normalizeColor(payment.color),
    logoUrl: payment.logoUrl ?? null,
    logoMode: inferLogoMode(payment),
    createdAt: payment.createdAt,
    isNew: false,
  };
}

export async function saveRecurringPaymentForm(form: PaymentForm, accounts: AccountOption[]): Promise<FormSaveResult> {
  const name = form.name.trim();
  const amount = parseAmount(form.amount);
  const account = accounts.find((item) => item.id === form.accountId);

  if (!name) {
    return formValidationError('Nom requis', 'Indique le paiement ou le revenu.');
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return formValidationError('Montant invalide', 'Saisis un montant positif.');
  }
  if (!account) {
    return formValidationError('Compte requis', 'Choisis le compte utilisé.');
  }
  if (!form.nextDate.trim()) {
    return formValidationError('Date requise', 'Choisis la prochaine date.');
  }
  if (form.endDate.trim() && form.endDate.trim() < form.nextDate.trim()) {
    return formValidationError('Date de fin invalide', 'La date de fin doit être après la prochaine date.');
  }

  await upsertRecurringPayment({
    id: form.id,
    name,
    amount,
    kind: form.kind,
    accountId: account.id,
    accountLabel: account.label,
    categoryId: form.kind === 'income' ? null : form.categoryId,
    frequency: form.frequency,
    dueDay: null,
    nextDate: form.nextDate.trim(),
    endDate: form.endDate.trim() || null,
    active: form.active,
    icon: form.icon,
    color: form.color,
    logoUrl: resolveRecurringLogoUrl(form, name),
    createdAt: form.createdAt,
  });
  successHaptic();
  return true;
}

function getNextDate(dueDay: number | null, frequency: RecurringPaymentFrequency) {
  const today = new Date();
  if (frequency !== 'monthly' || !dueDay) return undefined;
  const next = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, 28));
  if (next < today) next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function createLocalId() {
  return `recurring-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeAmount(value: string) {
  return sanitizeNumericInput(value);
}

function parseAmount(value: string) {
  return parseFormattedNumber(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0 %';
  return `${value.toFixed(value >= 10 ? 0 : 1)} %`;
}

function normalizeColor(value?: string) {
  const color = value?.trim();
  return color?.startsWith('#') ? color : DEFAULT_COLOR;
}

function isIconName(value: string): value is IconName {
  return value in Ionicons.glyphMap;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  topTitle: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: spacing.sm,
    fontSize: typography.screenTitle,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  scroller: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  summaryCardInner: {
    flexShrink: 0,
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  total: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  helper: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20 },
  list: { gap: spacing.md },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inactiveCard: { opacity: 0.58 },
  pressedCard: { opacity: 0.82 },
  iconWell: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  rowBetween: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: typography.body, fontWeight: '800' },
  kindBadge: {
    flexShrink: 0,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,250,154,0.14)',
    color: ghost.mint,
    fontSize: typography.micro,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  amount: { flexShrink: 1, maxWidth: '42%', color: colors.text, ...moneyAmountTypography({ tier: 'card' }), textAlign: 'right' },
  incomeAmount: { color: ghost.mint },
  meta: { minWidth: 0, color: colors.textMuted, fontSize: typography.micro, fontWeight: '700', lineHeight: 16 },
  emptyCard: {
    backgroundColor: colors.containerBackground,
    borderColor: colors.containerBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  recurringFab: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 20,
  },
  recurringFabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetScroller: { flex: 1, minHeight: 0 },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
    gap: spacing.md,
  },
  sheetHeaderPad: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  inputShell: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputWithSuffix: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    ...jakartaBoldText,
  },
  suffix: {
    ...typographyKit.metaMedium,
  },
  section: { gap: spacing.sm },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  iconAffordance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  iconGhostSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.42,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: typography.body,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...jakartaSemiboldText,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  logoSection: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  logoHeader: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoPreview: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackPreview: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  logoPreviewImage: { width: 32, height: 32 },
  logoCopy: { flex: 1, minWidth: 0, gap: 2 },
  logoHint: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    lineHeight: 15,
  },
  logoEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPicker: { gap: 10 },
  logoPickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  logoPickerHint: {
    flexShrink: 1,
    maxWidth: '50%',
    ...jakartaExtraBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
  logoOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  logoOption: {
    width: 54,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  logoOptionIcon: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackOptionIcon: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  logoOptionImage: { width: 24, height: 24 },
  impactCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  impactEyebrow: {
    flex: 1,
    minWidth: 0,
  },
  impactValue: {
    ...moneyAmountTypography({ tier: 'stat', letterSpacing: -0.5 }),
  },
  impactHint: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 17,
  },
  impactBudgetProgress: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  activeRowLabel: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
});

export { PaymentFormModal as RecurringPaymentFormModal };
