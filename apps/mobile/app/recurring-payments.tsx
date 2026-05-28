import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { GlassContainer } from '@/components/GlassContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { DetailSurfaceGradient } from '@/components/DetailSurfaceGradient';
import { GhostNumpad } from '@/components/GhostNumpad';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import {
  FLOATING_FAB_ICON_SIZE,
  FLOATING_FAB_SIZE,
  FLOATING_SCROLL_SIZE,
  floatingGlassButtonPressed,
  floatingGlassFabSurface,
} from '@/constants/floatingGlassButton';
import { SCREEN_TOP_GUTTER, ghost, ghostCardShadow } from '@/constants/ghostUi';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_CONTENT_GAP, colors, radius, spacing, typography } from '@/constants/theme';
import {
  deleteRecurringPayment,
  getCategoryBudgets,
  getCategories,
  getRecurringPayments,
  getSimulatedAccounts,
  upsertRecurringPayment,
} from '@/lib/db';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { getMerchantLogoUrl, RECURRING_SERVICE_LOGO_OPTIONS } from '@/lib/merchantLogo';
import { useAppTheme } from '@/lib/themeContext';
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
  icon: IconName;
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
const DEFAULT_COLOR = '#60A5FA';
const DEFAULT_ICON: IconName = 'repeat-outline';
const DETAIL_SHEET_TOP_RADIUS = 22;
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

const MANUAL_RECURRING_ICON_OPTIONS: Array<{ id: string; label: string; icon: IconName; color: string }> = [
  { id: 'rent', label: 'Loyer', icon: 'home-outline', color: '#A78BFA' },
  { id: 'bill', label: 'Facture', icon: 'receipt-outline', color: '#60A5FA' },
  { id: 'internet', label: 'Internet', icon: 'wifi-outline', color: '#38BDF8' },
  { id: 'phone', label: 'Téléphone', icon: 'call-outline', color: '#22C55E' },
  { id: 'power', label: 'Électricité', icon: 'flash-outline', color: '#FACC15' },
  { id: 'insurance', label: 'Assurance', icon: 'shield-checkmark-outline', color: '#F97316' },
  { id: 'car', label: 'Auto', icon: 'car-outline', color: '#FB7185' },
  { id: 'subscription', label: 'Abonnement', icon: 'play-circle-outline', color: '#F43F5E' },
  { id: 'gym', label: 'Gym', icon: 'fitness-outline', color: '#34D399' },
  { id: 'groceries', label: 'Épicerie', icon: 'basket-outline', color: '#84CC16' },
  { id: 'pay', label: 'Paie', icon: 'briefcase-outline', color: ghost.mint },
  { id: 'income', label: 'Revenu', icon: 'cash-outline', color: ghost.mint },
];

function amountFontSize(raw: string) {
  const len = (raw || '0').replace(/[^0-9]/g, '').length;
  return Math.max(36, 64 - Math.min(len, 12) * 2.2);
}

export default function RecurringPaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ new?: string; editId?: string }>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, ghostCardShadow: themedGhostCardShadow, isLight } = useAppTheme();
  const recurringFabSurface = floatingGlassFabSurface(themeColors, isLight);
  const openedInitialForm = useRef(false);
  const openedInitialEditId = useRef<string | null>(null);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>(manualAccountOptions());
  const [form, setForm] = useState<PaymentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  const [pendingRemovePayment, setPendingRemovePayment] = useState<RecurringPayment | null>(null);
  const [confirmFormDeleteVisible, setConfirmFormDeleteVisible] = useState(false);
  const [pendingFormDeleteId, setPendingFormDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextPayments, nextCategories, nextCategoryBudgets, simulatedAccounts] = await Promise.all([
      getRecurringPayments(),
      getCategories(),
      getCategoryBudgets(),
      getSimulatedAccounts(),
    ]);
    const accountOptions = toAccountOptions(simulatedAccounts);
    setPayments(nextPayments);
    setCategories(nextCategories);
    setCategoryBudgets(nextCategoryBudgets);
    setAccounts(accountOptions.length ? accountOptions : manualAccountOptions());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => payments.reduce((sum, payment) => sum + (payment.active && payment.kind !== 'income' ? monthlyEquivalent(payment) : 0), 0),
    [payments],
  );

  const openNew = useCallback(() => {
    tapHaptic();
    const account = accounts[0] ?? manualAccountOptions()[0];
    setForm({
      id: createLocalId(),
      name: '',
      amount: '',
      kind: 'payment',
      accountId: account.id,
      accountLabel: account.label,
      categoryId: getDefaultCategoryId(categories, 'payment'),
      frequency: 'monthly',
      dueDay: '',
      nextDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      active: true,
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      logoUrl: null,
      logoMode: 'auto',
      createdAt: new Date().toISOString(),
    });
  }, [accounts, categories]);

  useEffect(() => {
    if (params.new !== '1' || openedInitialForm.current || accounts.length === 0 || categories.length === 0) return;
    openedInitialForm.current = true;
    openNew();
  }, [accounts.length, categories.length, openNew, params.new]);

  const openEdit = useCallback((payment: RecurringPayment) => {
    tapHaptic();
    setForm(recurringPaymentToForm(payment));
  }, []);

  useEffect(() => {
    const editId = typeof params.editId === 'string' ? params.editId : '';
    if (!editId || openedInitialEditId.current === editId || payments.length === 0 || accounts.length === 0) return;
    const payment = payments.find((item) => item.id === editId);
    if (!payment) return;
    openedInitialEditId.current = editId;
    openEdit(payment);
  }, [accounts.length, openEdit, params.editId, payments]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const ok = await saveRecurringPaymentForm(form, accounts);
    setSaving(false);
    if (!ok) return;
    await load();
    setForm(null);
    router.replace({ pathname: '/(tabs)/transactions', params: { view: 'agenda' } });
  };

  const remove = (payment: RecurringPayment) => {
    setPendingRemovePayment(payment);
    setConfirmRemoveVisible(true);
  };

  const removeForm = (current: PaymentForm) => {
    setPendingFormDeleteId(current.id);
    setConfirmFormDeleteVisible(true);
  };
  const canDeleteForm = form ? payments.some((payment) => payment.id === form.id) : false;

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <Pressable
          onPress={() => {
            tapHaptic();
            router.back();
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={26} color={themeColors.textSecondary} />
        </Pressable>
        <Text style={[styles.topTitle, { color: themeColors.text }]} numberOfLines={2}>
          Paiements et revenus récurrents
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: spacing.sm,
            paddingBottom: FLOATING_NAV_CONTENT_PADDING + Math.max(insets.bottom, 16),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GlassContainer style={themedGhostCardShadow} innerStyle={styles.summaryCardInner} padding={spacing.lg} borderRadius={radius.xxl}>
          <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>Engagements mensuels</Text>
          <Text style={[styles.total, { color: themeColors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
            {formatMoney(totals)} $
          </Text>
          <Text style={[styles.helper, { color: themeColors.textMuted }]}>
            Suis tes paiements et revenus fixes au même endroit.
          </Text>
        </GlassContainer>

        <View style={styles.list}>
          {payments.map((payment) => {
            const tint = normalizeColor(payment.color);
            return (
              <Pressable
                key={payment.id}
                android_ripple={null}
                onPress={() => openEdit(payment)}
                onLongPress={() => remove(payment)}
                style={[themedGhostCardShadow, !payment.active && styles.inactiveCard]}
              >
                <GlassContainer innerStyle={styles.cardInner} padding={spacing.md} borderRadius={radius.xxl}>
                <RecurringPaymentAvatar payment={payment} tint={tint} size={46} />
                <View style={styles.cardBody}>
                  <View style={styles.rowBetween}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>
                        {payment.name}
                      </Text>
                      {payment.kind === 'income' ? (
                        <Text style={[styles.kindBadge, { backgroundColor: themeColors.successMuted, color: themeColors.success }]} numberOfLines={1}>
                          Revenu
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.amount, { color: themeColors.text }, payment.kind === 'income' && { color: themeColors.success }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                    >
                      {payment.kind === 'income' ? '+' : '-'}{formatMoney(payment.amount)} $
                    </Text>
                  </View>
                  <Text style={[styles.meta, { color: themeColors.textMuted }]} numberOfLines={1}>
                    {frequencyLabel(payment.frequency)} · {payment.accountLabel}
                  </Text>
                  <Text style={[styles.meta, { color: themeColors.textMuted }]} numberOfLines={1}>
                    {payment.nextDate ? `Prochain: ${payment.nextDate}` : payment.dueDay ? `Jour ${payment.dueDay}` : 'Date à préciser'}
                    {payment.endDate ? ` · fin: ${payment.endDate}` : ''}
                    {payment.active ? '' : ' · inactif'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
                </GlassContainer>
              </Pressable>
            );
          })}

          {payments.length === 0 ? (
            <GlassContainer style={[styles.emptyCard, themedGhostCardShadow]} padding={spacing.lg} borderRadius={radius.xxl}>
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Aucun paiement ou revenu récurrent</Text>
              <Text style={[styles.helper, { color: themeColors.textMuted }]}>Ajoute tes montants fixes pour les suivre ici.</Text>
            </GlassContainer>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter un paiement ou revenu récurrent"
        onPress={openNew}
        style={({ pressed }) => [
          styles.recurringFab,
          recurringFabSurface,
          {
            bottom:
              FLOATING_NAV_CONTENT_PADDING +
              Math.max(insets.bottom, 16) -
              10 -
              (FLOATING_FAB_SIZE - FLOATING_SCROLL_SIZE),
          },
          themedGhostCardShadow,
          pressed && floatingGlassButtonPressed,
        ]}
      >
        <MotiView animate={{ rotate: '180deg' }} transition={{ type: 'timing', duration: 260 }} style={styles.recurringFabIconWrap}>
          <Ionicons name="repeat-outline" size={FLOATING_FAB_ICON_SIZE} color={themeColors.text} />
        </MotiView>
      </Pressable>

      <PaymentFormModal
        visible={form != null}
        form={form}
        accounts={accounts}
        categories={categories}
        categoryBudgets={categoryBudgets}
        saving={saving}
        bottomInset={insets.bottom}
        onClose={() => setForm(null)}
        onChange={setForm}
        onSave={() => void save()}
        onDelete={canDeleteForm && form ? () => removeForm(form) : undefined}
      />
      <ConfirmDeleteModal
        visible={confirmRemoveVisible}
        title={pendingRemovePayment?.kind === 'income' ? 'Supprimer ce revenu ?' : 'Supprimer ce paiement ?'}
        message={pendingRemovePayment ? `${pendingRemovePayment.name} sera retiré des récurrents.` : undefined}
        onConfirm={async () => {
          if (!pendingRemovePayment) return;
          setConfirmRemoveVisible(false);
          await deleteRecurringPayment(pendingRemovePayment.id);
          await load();
          setPendingRemovePayment(null);
          successHaptic();
        }}
        onCancel={() => {
          setConfirmRemoveVisible(false);
          setPendingRemovePayment(null);
        }}
      />
      <ConfirmDeleteModal
        visible={confirmFormDeleteVisible}
        title={payments.find((p) => p.id === pendingFormDeleteId)?.kind === 'income' ? 'Supprimer ce revenu ?' : 'Supprimer ce paiement ?'}
        message="Cette action est irréversible."
        onConfirm={async () => {
          if (!pendingFormDeleteId) return;
          setConfirmFormDeleteVisible(false);
          await deleteRecurringPayment(pendingFormDeleteId);
          await load();
          setForm(null);
          setPendingFormDeleteId(null);
          successHaptic();
        }}
        onCancel={() => {
          setConfirmFormDeleteVisible(false);
          setPendingFormDeleteId(null);
        }}
      />
    </View>
  );
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
}) {
  const { colors: themeColors, ghost: themeGhost, isLight } = useAppTheme();
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
      sheet: { backgroundColor: isLight ? themeColors.surfaceSolid : '#131313', borderColor: themeColors.border },
      handle: { backgroundColor: themeColors.borderStrong },
      closeButton: { backgroundColor: themeGhost.obsidianSoft, borderColor: themeColors.borderStrong },
      control: { backgroundColor: themeGhost.obsidianSoft, borderColor: themeColors.border },
      controlStrong: { backgroundColor: themeGhost.obsidianSoft, borderColor: themeColors.borderStrong },
      logoPanel: { backgroundColor: themeGhost.obsidianSoft, borderColor: themeColors.border },
      logoFallback: { backgroundColor: themeColors.surface, borderColor: themeColors.border },
      selected: { backgroundColor: themeColors.text, borderColor: themeColors.text },
      selectedText: { color: themeGhost.void },
      text: { color: themeColors.text },
      textSecondary: { color: themeColors.textSecondary },
      textMuted: { color: themeColors.textMuted },
      submitDisabled: { backgroundColor: themeGhost.obsidianSoft, borderColor: themeColors.border },
    }),
    [isLight, themeColors, themeGhost],
  );

  if (!form) return null;
  const displayAmount = `${form.kind === 'income' ? '+' : '-'}${form.amount || '0'} $`;
  const canSubmit = Boolean(form.name.trim()) && parseAmount(form.amount) > 0 && Boolean(form.accountId) && Boolean(form.nextDate.trim());
  const visibleCategories = getRecurringCategoryBase(categories, form.kind);
  const suggestedCategories = getRelevantRecurringCategoryChoices(form.name, visibleCategories, form.categoryId, form.kind);
  const categoriesToShow = showAllCategories ? visibleCategories : suggestedCategories;
  const shownCategoryIds = new Set(suggestedCategories.map((category) => category.id));
  const hasHiddenCategories = visibleCategories.some((category) => !shownCategoryIds.has(category.id));
  const autoLogoUrl = getMerchantLogoUrl(form.name.trim());
  const previewLogoUrl = form.logoMode === 'logo' ? form.logoUrl : form.logoMode === 'auto' ? autoLogoUrl : null;
  const previewIcon = form.logoMode === 'icon' ? form.icon : form.kind === 'income' ? 'cash-outline' : DEFAULT_ICON;
  const previewTint = form.logoMode === 'icon' ? form.color : form.kind === 'income' ? themeGhost.mint : DEFAULT_COLOR;
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
            <DetailSurfaceGradient isLight={isLight} />
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
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.sheetClose,
                    themed.closeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="close" size={18} color={themeColors.textMuted} />
                </Pressable>
              </View>

            <View style={styles.section}>
              <Text style={[styles.fieldEyebrow, themed.textSecondary]}>Type</Text>
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
                                icon: kind === 'income' ? 'cash-outline' : DEFAULT_ICON,
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
              <Text style={[styles.fieldEyebrow, themed.textSecondary]}>{form.kind === 'income' ? 'Source du revenu' : 'Marchand / paiement'}</Text>
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
                {previewLogoUrl ? (
                  <LogoIconFrame uri={previewLogoUrl} size={52} />
                ) : (
                  <IconFrame size={52}>
                    <Ionicons name={previewIcon} size={22} color={previewTint} />
                  </IconFrame>
                )}
                <View style={styles.logoCopy}>
                  <Text style={[styles.fieldEyebrow, themed.textSecondary]}>Logo</Text>
                  <Text style={[styles.logoHint, themed.textMuted]}>
                    {form.logoMode === 'auto'
                      ? autoLogoUrl
                        ? 'Logo automatique trouvé avec le nom.'
                        : 'Automatique utilisera une icône si aucun logo exact existe.'
                      : form.logoMode === 'logo'
                        ? 'Logo manuel sélectionné.'
                        : 'Icône manuelle sélectionnée.'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    tapHaptic();
                    setShowLogoPicker((shown) => !shown);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.logoEditButton,
                    themed.controlStrong,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="pencil-outline" size={14} color={themeColors.textMuted} />
                </Pressable>
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

                  <Text style={[styles.logoPickerHint, themed.textMuted]}>Icônes</Text>
                  <View style={styles.logoOptionRow}>
                    {MANUAL_RECURRING_ICON_OPTIONS.map((option) => (
                      <RecurringLogoOption
                        key={option.id}
                        label={option.label}
                        selected={form.logoMode === 'icon' && form.icon === option.icon}
                        fallbackIcon={option.icon}
                        fallbackColor={option.color}
                        onPress={() => {
                          tapHaptic();
                          onChange((current) =>
                            current
                              ? {
                                  ...current,
                                  logoMode: 'icon',
                                  logoUrl: null,
                                  icon: option.icon,
                                  color: option.color,
                                }
                              : current,
                          );
                          setShowLogoPicker(false);
                        }}
                      />
                    ))}
                  </View>
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
              <View style={styles.impactHeader}>
                <Text style={[styles.impactEyebrow, themed.textSecondary]}>
                  {form.kind === 'income' ? 'Projection revenu' : 'Impact budget'}
                </Text>
                <Text style={[styles.impactFrequency, themed.textMuted]}>{frequencyLabel(form.frequency)}</Text>
              </View>
              <Text
                style={[
                  styles.impactValue,
                  themed.text,
                  form.kind === 'income' && { color: themeGhost.mint },
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
              <Text style={[styles.fieldEyebrow, themed.textSecondary]}>Fréquence</Text>
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
              <Text style={[styles.fieldEyebrow, themed.textSecondary]}>{form.kind === 'income' ? 'Compte de dépôt' : 'Compte utilisé comme paiement'}</Text>
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
                <Text style={[styles.fieldEyebrow, themed.textSecondary]}>Catégorie</Text>
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
                        style={[styles.chip, themed.control, on && themed.selected]}
                      >
                        <Text style={[styles.chipText, themed.text, on && themed.selectedText]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
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

            <Pressable
              onPress={() => {
                tapHaptic();
                onChange((current) => (current ? { ...current, active: !current.active } : current));
              }}
              style={[styles.activeRow, themed.controlStrong]}
            >
              <Text style={[styles.fieldEyebrow, themed.textSecondary]}>Actif</Text>
              <Ionicons name={form.active ? 'toggle' : 'toggle-outline'} size={34} color={form.active ? themeGhost.mint : themeColors.textMuted} />
            </Pressable>

            <PrimarySaveButton
              label={saving ? 'Enregistrement...' : 'Enregistrer'}
              onPress={onSave}
              disabled={saving || !canSubmit}
            />
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={form.kind === 'income' ? 'Supprimer le revenu récurrent' : 'Supprimer le paiement récurrent'}
                onPress={onDelete}
                style={({ pressed }) => [
                  styles.deleteFormButton,
                  { backgroundColor: themeColors.dangerMuted, borderColor: themeColors.danger },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={themeColors.danger} />
                <Text style={[styles.deleteFormText, { color: themeColors.danger }]}>
                  {form.kind === 'income' ? 'Supprimer le revenu récurrent' : 'Supprimer le paiement récurrent'}
                </Text>
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
  const icon = isIconName(payment.icon) ? payment.icon : defaultIconForKind(payment.kind === 'income' ? 'income' : 'payment');

  return (
    <UserPickedIconBadge
      icon={icon}
      color={tint}
      size={size}
      logoUrl={payment.logoUrl}
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
          backgroundColor: selected ? colors.blueMuted : colors.surfaceSolid,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {logoUrl ? (
        <LogoIconFrame uri={logoUrl} size={36} />
      ) : (
        <UserPickedIconBadge icon={fallbackIcon} color={fallbackColor} size={36} iconSize={17} />
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

function getRecurringImpactSummary(form: PaymentForm, categoryBudgets: CategoryBudget[]) {
  const amount = Number.isFinite(parseAmount(form.amount)) ? parseAmount(form.amount) : 0;
  const annualAmount = amount * annualMultiplier(form.frequency);
  const monthlyAmount = annualAmount / 12;

  if (form.kind === 'income') {
    return {
      primary: `+${formatMoney(annualAmount)} $ / an`,
      secondary: 'Revenu total projeté après 1 an.',
    };
  }

  const categoryBudget = categoryBudgets.find((budget) => budget.categoryId === form.categoryId);
  if (!categoryBudget?.limitAmount) {
    return {
      primary: `${formatMoney(annualAmount)} $ / an`,
      secondary: 'Coût annuel estimé. Aucune limite liée.',
    };
  }

  const percent = categoryBudget.limitAmount > 0 ? (monthlyAmount / categoryBudget.limitAmount) * 100 : 0;
  return {
    primary: `${formatMoney(annualAmount)} $ / an`,
    secondary: `${formatMoney(monthlyAmount)} $ / mois, soit ${formatPercent(percent)} de ${categoryBudget.categoryName}.`,
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
    .replace(/[’']/g, '')
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

function defaultIconForKind(kind: RecurringPaymentKind): IconName {
  return kind === 'income' ? 'cash-outline' : DEFAULT_ICON;
}

function inferLogoMode(payment: RecurringPayment): LogoSelectionMode {
  const logoUrl = payment.logoUrl ?? null;
  if (logoUrl) {
    return logoUrl === getMerchantLogoUrl(payment.name) ? 'auto' : 'logo';
  }

  const icon = isIconName(payment.icon) ? payment.icon : defaultIconForKind(payment.kind === 'income' ? 'income' : 'payment');
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
    icon: isIconName(payment.icon) ? payment.icon : DEFAULT_ICON,
    color: normalizeColor(payment.color),
    logoUrl: payment.logoUrl ?? null,
    logoMode: inferLogoMode(payment),
    createdAt: payment.createdAt,
  };
}

export async function saveRecurringPaymentForm(form: PaymentForm, accounts: AccountOption[]): Promise<boolean> {
  const name = form.name.trim();
  const amount = parseAmount(form.amount);
  const account = accounts.find((item) => item.id === form.accountId);

  if (!name) {
    Alert.alert('Nom requis', 'Indique le paiement ou le revenu.');
    return false;
  }
  if (Number.isNaN(amount) || amount <= 0) {
    Alert.alert('Montant invalide', 'Saisis un montant positif.');
    return false;
  }
  if (!account) {
    Alert.alert('Compte requis', 'Choisis le compte utilisé.');
    return false;
  }
  if (!form.nextDate.trim()) {
    Alert.alert('Date requise', 'Choisis la prochaine date.');
    return false;
  }
  if (form.endDate.trim() && form.endDate.trim() < form.nextDate.trim()) {
    Alert.alert('Date de fin invalide', 'La date de fin doit être après la prochaine date.');
    return false;
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

function formatMoney(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
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
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: PAGE_TITLE_CONTENT_GAP,
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
  scroller: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
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
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...ghostCardShadow,
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
    borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
    borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetScroller: { maxHeight: '100%' },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 2,
  },
  amountText: {
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: 8 },
  fieldEyebrow: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  input: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
  },
  logoSection: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
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
  logoHint: { fontSize: typography.micro, fontWeight: '700', lineHeight: 15 },
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
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  logoOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logoOption: {
    width: 54,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
  },
  logoOptionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackOptionIcon: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  logoOptionImage: { width: 24, height: 24 },
  impactCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 7,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  impactEyebrow: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  impactFrequency: {
    flexShrink: 0,
    fontSize: typography.micro,
    fontWeight: '800',
  },
  impactValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  impactHint: {
    fontSize: typography.meta,
    fontWeight: '700',
    lineHeight: 17,
  },
  impactBudgetProgress: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '100%',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  chipText: {
    maxWidth: '100%',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryMoreChip: {
    width: 44,
    minHeight: 42,
    borderRadius: 9,
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  accountChipOn: { backgroundColor: ghost.text },
  accountText: {
    width: '100%',
    minWidth: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
    flexShrink: 1,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  submit: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 17,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  submitText: { fontSize: 18, fontWeight: '800' },
  deleteFormButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 15,
  },
  deleteFormText: { fontSize: typography.body, fontWeight: '900' },
});

export { PaymentFormModal as RecurringPaymentFormModal };
