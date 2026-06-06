import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback, type FormSaveResult } from '@/lib/formFeedback';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { GhostNumpad } from '@/components/GhostNumpad';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { getCategoryIconName } from '@/constants/categoryOptions';
import { EXPENSE_MDI_ICON, type MdiIconName } from '@/lib/mdiIconCatalog';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import { ghost, ghostCardShadow } from '@/constants/ghostUi';
import {
  colors,
  ICON_WELL_SIZE,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import {
  getCategories,
  getCategoryBudgets,
  getSimulatedAccounts,
  upsertRecurringPayment,
} from '@/lib/db';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { getMerchantLogoUrl, RECURRING_SERVICE_LOGO_OPTIONS } from '@/lib/merchantLogo';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import type { Category, CategoryBudget, RecurringPayment, RecurringPaymentFrequency, RecurringPaymentKind, SimulatedAccount } from '@/types';

type IconName = keyof typeof Ionicons.glyphMap;
type LogoSelectionMode = 'auto' | 'logo' | 'icon';

export type AccountOption = {
  id: string;
  label: string;
  tint: string;
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

function amountFontSize(raw: string) {
  const len = (raw || '0').replace(/[^0-9]/g, '').length;
  return Math.max(36, 64 - Math.min(len, 12) * 2.2);
}

const SUBSCRIPTION_CATEGORY_TERMS = ['abonnement', 'subscription', 'loisir', 'loisirs', 'divertissement'];
const SUBSCRIPTION_DEFAULT_ICON = 'Movie';
const SUBSCRIPTION_DEFAULT_COLOR = '#F43F5E';

export function createNewRecurringPaymentForm(
  accounts: AccountOption[],
  categories: Category[],
  variant: RecurringPaymentAddVariant = 'bill',
): PaymentForm {
  const kind: RecurringPaymentKind = variant === 'income' ? 'income' : 'payment';
  const account = accounts[0] ?? manualAccountOptions()[0];
  const isSubscription = variant === 'subscription';
  return {
    id: createLocalId(),
    name: '',
    amount: '',
    kind,
    accountId: account.id,
    accountLabel: account.label,
    categoryId: getDefaultCategoryIdForVariant(categories, variant),
    frequency: 'monthly',
    dueDay: '',
    nextDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    active: true,
    icon: kind === 'income' ? 'AttachMoney' : isSubscription ? SUBSCRIPTION_DEFAULT_ICON : DEFAULT_ICON,
    color: kind === 'income' ? ghost.mint : isSubscription ? SUBSCRIPTION_DEFAULT_COLOR : DEFAULT_COLOR,
    logoUrl: null,
    logoMode: isSubscription ? 'icon' : 'auto',
    createdAt: new Date().toISOString(),
  };
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
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowLogoPicker(false);
      setShowAllCategories(false);
    }
  }, [visible]);

  useEffect(() => {
    setShowAllCategories(false);
  }, [form?.id, form?.kind]);

  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
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
        borderWidth: 1.5,
      },
      selectedText: { color: themeColors.primary },
      text: { color: themeColors.text },
      textSecondary: { color: themeColors.textSecondary },
      textMuted: { color: themeColors.textMuted },
    }),
    [isLight, themeColors],
  );

  if (!form) return null;
  const displayAmount = `${form.kind === 'income' ? '+' : '−'}${form.amount || '0'} $`;
  const canSubmit = Boolean(form.name.trim()) && parseAmount(form.amount) > 0 && Boolean(form.accountId) && Boolean(form.nextDate.trim());
  const visibleCategories = getRecurringCategoryBase(categories, form.kind);
  const suggestedCategories = getRelevantRecurringCategoryChoices(form.name, visibleCategories, form.categoryId, form.kind);
  const categoriesToShow = showAllCategories ? visibleCategories : suggestedCategories;
  const shownCategoryIds = new Set(suggestedCategories.map((category) => category.id));
  const hasHiddenCategories = visibleCategories.some((category) => !shownCategoryIds.has(category.id));
  const autoLogoUrl = getMerchantLogoUrl(form.name.trim());
  const previewLogoUrl = form.logoMode === 'logo' ? form.logoUrl : form.logoMode === 'auto' ? autoLogoUrl : null;
  const previewIcon = form.logoMode === 'icon' ? form.icon : form.kind === 'income' ? 'AttachMoney' : DEFAULT_ICON;
  const impactSummary = getRecurringImpactSummary(form, categoryBudgets);
  const selectedCategoryBudget =
    form.kind === 'payment' && form.categoryId
      ? categoryBudgets.find((item) => item.categoryId === form.categoryId) ?? null
      : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, themed.modalBackdrop]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
          <View style={[styles.sheet, themed.sheet]}>
            <ScrollView
              style={styles.sheetScroller}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(bottomInset, 20) }]}
            >
              <View style={[styles.handle, themed.handle]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, themed.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {form.kind === 'income' ? 'Revenu récurrent' : 'Paiement récurrent'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fermer le paiement récurrent"
                  onPress={onClose}
                  hitSlop={12}
                  style={[styles.sheetClose, themed.closeButton]}
                >
                  <Ionicons name="close" size={19} color={themeColors.textMuted} />
                </Pressable>
              </View>

            <View style={styles.section}>
              <DashboardSectionLabel>Type</DashboardSectionLabel>
              <View style={styles.wrapRow}>
                {(['payment', 'income'] as const).map((kind) => {
                  const on = form.kind === kind;
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => {
                        tapHaptic();
                        onChange((current) =>
                          current
                            ? {
                                ...current,
                                kind,
                                categoryId: getDefaultCategoryId(categories, kind),
                                icon: kind === 'income' ? 'AttachMoney' : DEFAULT_ICON,
                                color: kind === 'income' ? ghost.mint : DEFAULT_COLOR,
                              }
                            : current,
                        );
                      }}
                      style={[styles.chip, themed.control, on && themed.selected]}
                    >
                      <Text style={[styles.chipText, themed.text, on && themed.selectedText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                        {kind === 'income' ? 'Revenu' : 'Paiement'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <DashboardSectionLabel>{form.kind === 'income' ? 'Source du revenu' : 'Marchand / paiement'}</DashboardSectionLabel>
              <TextInput
                style={[styles.input, themed.controlStrong, themed.text]}
                placeholder={form.kind === 'income' ? 'Ex. Paie, pension, allocation...' : 'Ex. Loyer, Netflix, Hydro...'}
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
              />
            </View>

            <View style={[styles.logoSection, themed.logoPanel]}>
              <View style={styles.logoHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Changer le logo ou l'icône"
                  onPress={() => {
                    tapHaptic();
                    setShowLogoPicker((shown) => !shown);
                  }}
                >
                  {previewLogoUrl ? (
                    <LogoIconFrame uri={previewLogoUrl} size={52} />
                  ) : (
                    <UserPickedIconBadge icon={previewIcon} size={52} iconSize={22} wellGlyphWhite />
                  )}
                </Pressable>
                <View style={styles.logoCopy}>
                  <DashboardSectionLabel>Logo</DashboardSectionLabel>
                  <Text style={[styles.logoHint, themed.textMuted]}>
                    {form.logoMode === 'auto'
                      ? autoLogoUrl
                        ? 'Logo automatique trouvé avec le nom.'
                        : 'Touche l\'icône pour choisir dans la bibliothèque MDI.'
                      : form.logoMode === 'logo'
                        ? 'Logo manuel sélectionné.'
                        : 'Icône MDI sélectionnée.'}
                  </Text>
                </View>
              </View>

              {showLogoPicker ? (
                <View style={styles.logoPicker}>
                  <View style={styles.logoPickerTitleRow}>
                    <Text style={[styles.logoPickerHint, themed.textMuted]} numberOfLines={1}>
                      Auto ou manuel
                    </Text>
                    <Text style={[styles.logoPickerHint, themed.textMuted]} numberOfLines={1}>
                      Services populaires
                    </Text>
                  </View>
                  <View style={styles.logoOptionRow}>
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
                                icon: defaultIconForKind(current.kind),
                                color: current.kind === 'income' ? ghost.mint : DEFAULT_COLOR,
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
                  </View>

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
                              color: current.kind === 'income' ? ghost.mint : DEFAULT_COLOR,
                            }
                          : current,
                      );
                      setShowLogoPicker(false);
                    }}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.amountWrap}>
              <Text
                style={[styles.amountText, themed.text, { fontSize: amountFontSize(form.amount) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.35}
              >
                {displayAmount}
              </Text>
            </View>

            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
              <GhostNumpad value={form.amount} onChange={(amount) => onChange((current) => (current ? { ...current, amount } : current))} />
            </MotiView>

            <View style={[styles.impactCard, themed.logoPanel]}>
              <DashboardSectionLabel>
                {form.kind === 'income' ? 'Projection revenu' : 'Impact budget'}
              </DashboardSectionLabel>
              <Text
                style={[
                  styles.impactValue,
                  themed.text,
                  form.kind === 'income' && { color: themeColors.primary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {impactSummary.primary}
              </Text>
              <Text style={[styles.impactHint, themed.textMuted]}>{impactSummary.secondary}</Text>
              {selectedCategoryBudget &&
              (selectedCategoryBudget.limitAmount > 0 || selectedCategoryBudget.spent > 0) ? (
                <View style={styles.impactBudgetProgress}>
                  <CategoryBudgetProgress budget={selectedCategoryBudget} />
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <DashboardSectionLabel>Fréquence</DashboardSectionLabel>
              <View style={styles.wrapRow}>
                {FREQUENCIES.map((frequency) => {
                  const on = form.frequency === frequency.id;
                  return (
                    <Pressable
                      key={frequency.id}
                      onPress={() => {
                        tapHaptic();
                        onChange((current) => (current ? { ...current, frequency: frequency.id } : current));
                      }}
                      style={[styles.chip, themed.control, on && themed.selected]}
                    >
                      <Text style={[styles.chipText, themed.text, on && themed.selectedText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                        {frequency.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <DatePickerField
              label="Prochaine date"
              value={form.nextDate}
              placeholder="Choisir une date"
              variant="sheet"
              onChangeDate={(nextDate) => onChange((current) => (current ? { ...current, nextDate } : current))}
            />

            <DatePickerField
              label="Date de fin (optionnelle)"
              value={form.endDate}
              placeholder="Aucune date de fin"
              allowClear
              variant="sheet"
              onChangeDate={(endDate) => onChange((current) => (current ? { ...current, endDate } : current))}
            />

            <View style={styles.section}>
              <DashboardSectionLabel>{form.kind === 'income' ? 'Compte de dépôt' : 'Compte utilisé comme paiement'}</DashboardSectionLabel>
              <View style={styles.accountRow}>
                {accounts.map((account) => {
                  const on = form.accountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => {
                        tapHaptic();
                        onChange((current) => (current ? { ...current, accountId: account.id, accountLabel: account.label } : current));
                      }}
                      style={[styles.accountChip, themed.control, on && themed.selected]}
                    >
                      <Text
                        style={[styles.accountText, themed.text, on && themed.selectedText]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        adjustsFontSizeToFit
                        minimumFontScale={0.78}
                      >
                        {account.label.replace(' • ', '\n')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {visibleCategories.length ? (
              <View style={styles.section}>
                <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                <View style={styles.wrapRow}>
                  {categoriesToShow.map((category) => {
                    const on = form.categoryId === category.id;
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => {
                          tapHaptic();
                          onChange((current) => (current ? { ...current, categoryId: on ? null : category.id } : current));
                        }}
                        style={[styles.categoryChip, themed.control, on && themed.selected]}
                      >
                        <Ionicons
                          name={getCategoryIconName(category)}
                          size={14}
                          color={on ? themeColors.primary : themeColors.textSecondary}
                          style={styles.categoryChipIcon}
                        />
                        <Text
                          style={[styles.categoryChipText, themed.text, on && themed.selectedText]}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.82}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!showAllCategories && hasHiddenCategories ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Voir les autres catégories"
                      onPress={() => {
                        tapHaptic();
                        setShowAllCategories(true);
                      }}
                      style={({ pressed }) => [styles.categoryMoreChip, themed.control, pressed && styles.pressed]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={themeColors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
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
                  styles.deleteFormButton,
                  { backgroundColor: themeColors.dangerMuted, borderColor: themeColors.danger },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={themeColors.danger} />
                <Text style={[styles.deleteFormText, { color: themeColors.danger }]}>Supprimer</Text>
              </Pressable>
            ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
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
  return accounts.map((account) => ({
    id: account.id,
    label: account.last4 ? `${account.name} • ${account.last4}` : account.name,
    tint: account.kind === 'checking' ? ghost.mint : account.kind === 'credit' ? '#d4d4d8' : '#A78BFA',
  }));
}

export function manualAccountOptions(): AccountOption[] {
  return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
    id: account.id,
    label: account.label,
    tint: account.tint,
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

function getDefaultCategoryId(categories: Category[], kind: RecurringPaymentKind) {
  const category = getRecurringCategoryBase(categories, kind)[0];
  return category?.id ?? null;
}

function getDefaultCategoryIdForVariant(categories: Category[], variant: RecurringPaymentAddVariant) {
  if (variant === 'income') {
    return getDefaultCategoryId(categories, 'income');
  }

  if (variant === 'subscription') {
    const subscriptionCategory =
      categories.find((category) => category.id === 'cat-fun') ??
      findCategoriesByName(categories, SUBSCRIPTION_CATEGORY_TERMS)[0];
    return subscriptionCategory?.id ?? getDefaultCategoryId(categories, 'payment');
  }

  return getDefaultCategoryId(categories, 'payment');
}

function defaultIconForKind(kind: RecurringPaymentKind): string {
  return kind === 'income' ? 'AttachMoney' : DEFAULT_ICON;
}

function resolvePaymentIcon(payment: RecurringPayment): string {
  if (payment.icon?.trim()) return payment.icon;
  return defaultIconForKind(payment.kind === 'income' ? 'income' : 'payment');
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
  return {
    id: payment.id,
    name: payment.name,
    amount: String(payment.amount || ''),
    kind: payment.kind ?? 'payment',
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
    categoryId: form.categoryId,
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
  return value.replace(/[^0-9.,]/g, '').replace(',', '.');
}

function parseAmount(value: string) {
  return Number.parseFloat(sanitizeAmount(value));
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
  amount: { flexShrink: 1, maxWidth: '42%', color: colors.text, fontSize: typography.body, fontWeight: '800', textAlign: 'right' },
  incomeAmount: { color: ghost.mint },
  meta: { minWidth: 0, color: colors.textMuted, fontSize: typography.micro, fontWeight: '700', lineHeight: 16 },
  emptyCard: {
    backgroundColor: colors.surfaceSolid,
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
    marginTop: 88,
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetScroller: { maxHeight: '100%' },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    ...interExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 2,
  },
  amountText: {
    ...interExtraBoldText,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: spacing.sm },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...interBoldText,
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
    ...interMediumText,
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
    ...interExtraBoldText,
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
    ...interExtraBoldText,
    fontSize: 24,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  impactHint: {
    ...interMediumText,
    fontSize: typography.meta,
    lineHeight: 17,
  },
  impactBudgetProgress: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipText: {
    maxWidth: '100%',
    flexShrink: 1,
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryChip: {
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryChipIcon: {
    marginRight: 5,
  },
  categoryChipText: {
    ...interBoldText,
    fontSize: typography.meta,
    lineHeight: 16,
    flexShrink: 1,
  },
  categoryMoreChip: {
    width: 44,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  accountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  accountChip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '31%',
    minWidth: 94,
    maxWidth: '100%',
    minHeight: 66,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: spacing.sm,
  },
  accountChipOn: { backgroundColor: ghost.text },
  accountText: {
    width: '100%',
    minWidth: 0,
    textAlign: 'center',
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  deleteFormButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 15,
  },
  deleteFormText: {
    ...interExtraBoldText,
    fontSize: typography.body,
  },
});

export { PaymentFormModal as RecurringPaymentFormModal };
