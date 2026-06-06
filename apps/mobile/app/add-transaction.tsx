import { useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { GhostNumpad } from '@/components/GhostNumpad';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { DatePickerField } from '@/components/MinimalDatePicker';
import {
  ICON_WELL_SIZE,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { hasMerchantLogoCandidate } from '@/components/TransactionAvatar';
import { LogoIconFrame } from '@/components/IconFrame';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  TRANSFER_CATEGORY,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, isExpenseDefaultIcon, type ExpenseFallbackIcon } from '@/lib/expenseIcon';
import { EXPENSE_MDI_ICON, type MdiIconName } from '@/lib/mdiIconCatalog';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import { getMerchantLogoUrl, KNOWN_MERCHANT_NAMES } from '@/lib/merchantLogo';
import { useAppTheme } from '@/lib/themeContext';
import {
  adjustSavingsGoalCurrentAmount,
  adjustSimulatedAccountBalance,
  getCategories,
  getCategoryBudgets,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactionById,
  insertTransaction,
  upsertCategory,
} from '@/lib/db';
import {
  findInsufficientFundsViolation,
  getTransactionAccountDeltas,
  parseAccountIdFromNote,
  parseTransferAccountsFromNote,
} from '@/lib/accountTransactionFlow';
import { formatMoneyAmountInput } from '@/lib/formatMoneyAmountInput';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { createLocalTransaction, syncWithServer } from '@/lib/sync';
import type { Category, SavingsGoal, SimulatedAccount, Transaction, TransactionType } from '@/types';

type PaymentAccountOption = {
  id: string;
  label: string;
  isSimulated: boolean;
};
type TransferEndpoint = {
  id: string;
  label: string;
  sublabel: string;
  kind: 'account' | 'goal';
  isSimulated: boolean;
  icon: string;
  color: string;
};
type ItemizedExpense = {
  id: string;
  name: string;
  price: string;
  categoryId: string | null;
};
type CategoryRule = {
  categoryIds: string[];
  categoryNames: string[];
  keywords: string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    categoryIds: ['cat-rest'],
    categoryNames: ['restaurant', 'cafe', 'repas', 'livraison'],
    keywords: [
      'starbucks',
      'tim hortons',
      'cafe',
      'coffee',
      'restaurant',
      'resto',
      'pizza',
      'subway',
      'mcdonald',
      'doordash',
      'uber eats',
      'ubereats',
      'skip',
      'sushi',
      'boulangerie',
      'brunch',
    ],
  },
  {
    categoryIds: ['cat-food'],
    categoryNames: ['epicerie', 'grocery', 'alimentation', 'nourriture', 'courses'],
    keywords: [
      'epicerie',
      'grocery',
      'groceries',
      'iga',
      'metro',
      'provigo',
      'maxi',
      'walmart',
      'costco',
      'instacart',
      'whole foods',
      'carrefour',
      'super c',
      'loblaws',
      'fruiterie',
      'marche',
      'pain',
      'lait',
      'oeuf',
      'viande',
      'legume',
    ],
  },
  {
    categoryIds: ['cat-gas', 'cat-transport'],
    categoryNames: ['gas', 'essence', 'transport', 'carburant'],
    keywords: ['gas', 'gaz', 'essence', 'fuel', 'shell', 'esso', 'petro-canada', 'petro canada', 'carburant', 'station service'],
  },
  {
    categoryIds: ['cat-fun'],
    categoryNames: ['loisir', 'loisirs', 'divertissement'],
    keywords: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'subscription',
      'abonnement',
      'mensualite',
      'paiement mensuel',
      'apple music',
      'apple tv',
      'google one',
      'adobe',
      'dropbox',
      'notion',
      'slack',
      'zoom',
      'icloud',
      'disney',
      'disney plus',
      'crave',
    ],
  },
  {
    categoryIds: ['cat-phone'],
    categoryNames: ['telephone', 'facture', 'internet', 'cellulaire'],
    keywords: ['telephone', 'cellulaire', 'internet', 'telus', 'bell', 'rogers', 'videotron', 'phone', 'fizz', 'koodo', 'virgin'],
  },
  {
    categoryIds: ['cat-home-maintenance', 'cat-home'],
    categoryNames: ['entretien maison', 'renovation', 'quincaillerie', 'outil', 'outils', 'reparations'],
    keywords: [
      'tape a mesurer',
      'tape amesurer',
      'ruban a mesurer',
      'metre a ruban',
      'outil',
      'outils',
      'quincaillerie',
      'renovation',
      'reparation',
      'reparations',
      'entretien maison',
      'home depot',
      'rona',
      'canac',
      'bmr',
      'marteau',
      'vis',
      'clou',
      'perceuse',
      'tournevis',
      'scie',
      'peinture',
    ],
  },
  {
    categoryIds: ['cat-home'],
    categoryNames: ['appartement', 'maison', 'loyer', 'logement', 'hypotheque'],
    keywords: ['loyer', 'rent', 'maison', 'appartement', 'home depot', 'ikea', 'hydro', 'electricite', 'chauffage', 'hypotheque'],
  },
  {
    categoryIds: ['cat-car-payment', 'cat-car-insurance', 'cat-car-emergency'],
    categoryNames: ['auto', 'reparations', 'vehicule', 'assurance auto'],
    keywords: ['auto', 'car', 'garage', 'pneu', 'tires', 'vehicule', 'canadian tire', 'mecanique', 'huile', 'permis', 'saaq', 'assurance auto'],
  },
  {
    categoryIds: ['cat-bank-loan'],
    categoryNames: ['pret bancaire'],
    keywords: ['pret', 'loan', 'banque', 'interac', 'paypal', 'stripe'],
  },
  {
    categoryIds: ['cat-fun'],
    categoryNames: ['loisir', 'loisirs', 'divertissement', 'sortie', 'fun'],
    keywords: ['cinema', 'film', 'jeu', 'jeux', 'concert', 'billet', 'sortie', 'bar', 'arcade', 'theatre', 'loisir', 'loisirs'],
  },
  {
    categoryIds: [],
    categoryNames: ['sante', 'pharmacie', 'medical', 'medicament'],
    keywords: ['pharmacie', 'pharmaprix', 'jean coutu', 'uniprix', 'medicament', 'dentiste', 'docteur', 'clinique', 'lunettes'],
  },
  {
    categoryIds: [],
    categoryNames: ['vetement', 'vetements', 'shopping', 'magasin', 'achats', 'chaussure'],
    keywords: ['amazon', 'zara', 'hm', 'h&m', 'uniqlo', 'simons', 'winners', 'marshalls', 'vetement', 'vetements', 'linge', 'chaussure', 'chaussures'],
  },
  {
    categoryIds: [],
    categoryNames: ['voyage', 'vacances', 'hotel', 'avion'],
    keywords: ['airbnb', 'hotel', 'vol', 'avion', 'air canada', 'transat', 'uber', 'taxi', 'train', 'bus', 'opus', 'stm', 'voyage'],
  },
];

const DISCRETIONARY_CATEGORY_TERMS = [
  'depense inutile',
  'depenses inutiles',
  'inutile',
  'non essentiel',
  'non essentiels',
  'discretionnaire',
  'extra',
  'plaisir',
  'loisir',
  'loisirs',
  'divertissement',
];
const GENERAL_FALLBACK_CATEGORY_TERMS = ['autre', 'autres', 'divers', 'general', 'misc', 'depenses'];

function amountFontSize(raw: string) {
  const len = (raw || '0').replace(/[^0-9]/g, '').length;
  return Math.max(36, 64 - Math.min(len, 12) * 2.2);
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

function parseMoney(raw: string): number {
  const parsed = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function toDateInputValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function toTransactionDate(value: string): string {
  const day = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date().toISOString();
  return new Date(`${day}T12:00:00`).toISOString();
}

function parseItemizedExpensesFromNote(note?: string): ItemizedExpense[] {
  const line = note?.split('\n').find((part) => part.startsWith('articles:'));
  if (!line) return [];

  try {
    const parsed = JSON.parse(line.slice('articles:'.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item, index): ItemizedExpense[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : '';
      const price = typeof record.price === 'number' ? record.price : Number(record.price);
      return [{
        id: `${Date.now()}-${index}`,
        name,
        price: Number.isFinite(price) ? formatMoneyInput(price) : '',
        categoryId: typeof record.categoryId === 'string' ? record.categoryId : null,
      }];
    });
  } catch {
    return [];
  }
}

function isIconName(value?: string | null): value is IconName {
  return Boolean(value && value in Ionicons.glyphMap);
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

function getRuleCategoryMatches(rule: CategoryRule, categories: Category[]): Category[] {
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

function getRelevantCategoryChoices(text: string, categories: Category[], selectedId: string | null): Category[] {
  const normalized = normalizeSearch(text);
  const matches: Category[] = [];

  if (normalized) {
    for (const rule of CATEGORY_RULES) {
      const matchesKeyword = rule.keywords.some((keyword) => searchMatchesKeyword(normalized, keyword));
      if (!matchesKeyword) continue;

      for (const category of getRuleCategoryMatches(rule, categories)) {
        addUniqueCategory(matches, category);
      }
    }
  }

  for (const category of findCategoriesByName(categories, DISCRETIONARY_CATEGORY_TERMS)) {
    addUniqueCategory(matches, category);
  }

  if (matches.length === 0) {
    for (const category of findCategoriesByName(categories, GENERAL_FALLBACK_CATEGORY_TERMS).slice(0, 2)) {
      addUniqueCategory(matches, category);
    }
  }

  addUniqueCategory(matches, categories.find((category) => category.id === selectedId));
  return matches.length > 0 ? matches : categories.slice(0, 1);
}

function getCategorySearchChoices(query: string, categories: Category[], selectedId: string | null): Category[] {
  const normalized = normalizeSearch(query);
  const matches: Category[] = [];

  addUniqueCategory(matches, categories.find((category) => category.id === selectedId));

  const filtered = normalized
    ? categories.filter((category) => {
        const categoryName = normalizeSearch(category.name);
        const queryTokens = tokenizeSearch(query);
        return (
          categoryName.includes(normalized) ||
          queryTokens.every((token) => categoryName.split(' ').some((nameToken) => nameToken.startsWith(token)))
        );
      })
    : categories;

  for (const category of filtered.slice(0, 8)) {
    addUniqueCategory(matches, category);
  }

  return matches.slice(0, 8);
}

function inferCategoryId(text: string, categories: Category[], fallbackId: string | null): string | null {
  const normalized = normalizeSearch(text);
  if (!normalized) return fallbackId;

  for (const rule of CATEGORY_RULES) {
    const matchesKeyword = rule.keywords.some((keyword) => searchMatchesKeyword(normalized, keyword));
    if (!matchesKeyword) continue;

    const [match] = getRuleCategoryMatches(rule, categories);
    if (match) return match.id;
  }

  const directCategoryMatch = categories.find((category) => {
    const categoryName = normalizeSearch(category.name);
    return categoryName.length >= 4 && searchMatchesKeyword(normalized, categoryName);
  });
  if (directCategoryMatch) return directCategoryMatch.id;

  return fallbackId;
}

async function applyLinkedSavingsGoalDeltas(
  accounts: SimulatedAccount[],
  accountDeltas: Array<{ id: string; delta: number }>,
  multiplier = 1,
) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const goalDeltas = new Map<string, number>();

  for (const { id, delta } of accountDeltas) {
    const linkedGoalId = accountById.get(id)?.linkedSavingsGoalId?.trim();
    if (!linkedGoalId) continue;
    goalDeltas.set(linkedGoalId, (goalDeltas.get(linkedGoalId) ?? 0) + delta * multiplier);
  }

  for (const [goalId, delta] of goalDeltas) {
    await adjustSavingsGoalCurrentAmount(goalId, delta);
  }
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    type?: string;
    label?: string;
    accountId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const editId = typeof params.editId === 'string' ? params.editId : '';
  const routeType = typeof params.type === 'string' ? params.type : '';
  const routeLabel = typeof params.label === 'string' ? params.label : '';
  const routeAccountId = typeof params.accountId === 'string' ? params.accountId : '';
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetCategoryIds, setBudgetCategoryIds] = useState<Set<string>>(new Set());
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefilledEditId, setPrefilledEditId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [accountId, setAccountId] = useState<string>(MANUAL_ENTRY_ACCOUNTS[0].id);
  const [destinationAccountId, setDestinationAccountId] = useState<string>(MANUAL_ENTRY_ACCOUNTS[1].id);
  const [fallbackIcon, setFallbackIcon] = useState<string>(EXPENSE_MDI_ICON);
  const [itemizedExpenses, setItemizedExpenses] = useState<ItemizedExpense[]>([]);
  const [categoryPickerItemId, setCategoryPickerItemId] = useState<string | null>(null);
  const [itemCategoryQuery, setItemCategoryQuery] = useState('');
  const [receiptUri, setReceiptUri] = useState('');
  const [receiptStatus, setReceiptStatus] = useState<Transaction['receiptStatus'] | null>(null);
  const [receiptOptionsExpanded, setReceiptOptionsExpanded] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const labelInputRef = useRef<TextInput>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const amountSectionYRef = useRef(0);
  const nameSectionYRef = useRef(0);

  const merchantSuggestions = useMemo(() => {
    if (type !== 'expense') return [];
    const query = normalizeSearch(label);
    if (query.length < 2) return [];

    return KNOWN_MERCHANT_NAMES.filter((merchant) => {
      const normalized = normalizeSearch(merchant);
      return normalized !== query && (normalized.startsWith(query) || normalized.includes(query));
    }).slice(0, 5);
  }, [label, type]);

  useEffect(() => {
    void getCategories().then((cats) => {
      setCategories(cats);
      if (editId && editingTransaction?.type === type) return;
      const defaultCat =
        type === 'transfer'
          ? cats.find((c) => c.id === TRANSFER_CATEGORY.id) ?? TRANSFER_CATEGORY
          : cats.find((c) => (type === 'income' ? c.name === 'Revenus' : c.name !== 'Revenus')) ??
        cats[0];
      setCategoryManuallySelected(false);
      setCategoryId(defaultCat?.id ?? null);
    });
  }, [editId, editingTransaction?.type, type]);

  useEffect(() => {
    if (editId) return;
    if (routeType === 'income') setType('income');
    if (routeLabel) setLabel(routeLabel);
    if (routeAccountId) setAccountId(routeAccountId);
  }, [editId, routeAccountId, routeLabel, routeType]);

  useEffect(() => {
    void getSimulatedAccounts().then(setSimulatedAccounts);
  }, []);

  useEffect(() => {
    void getCategoryBudgets().then((budgets) => {
      setBudgetCategoryIds(new Set(budgets.map((b) => b.categoryId)));
    });
  }, []);

  useEffect(() => {
    void getSavingsGoals().then(setSavingsGoals);
  }, []);

  useEffect(() => {
    if (type === 'expense') return;
    setReceiptUri('');
    setReceiptStatus(null);
    setReceiptOptionsExpanded(false);
  }, [type]);

  useEffect(() => {
    if (editId) return;
    if (type === 'expense') {
      setFallbackIcon(EXPENSE_DEFAULT_ICON);
      return;
    }
    setFallbackIcon((current) => (current === EXPENSE_DEFAULT_ICON ? 'receipt-outline' : current));
  }, [editId, type]);

  useEffect(() => {
    if (type === 'transfer') return;

    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      focusTimer = setTimeout(() => labelInputRef.current?.focus(), 180);
    });

    return () => {
      interaction.cancel();
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [type]);

  // When autocomplete suggestions appear while the keyboard is open, scroll the
  // sheet so the suggestion chips are visible above the keyboard.
  useEffect(() => {
    if (merchantSuggestions.length === 0) return;
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollTo({
        y: Math.max(nameSectionYRef.current - 16, 0),
        animated: true,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantSuggestions.length]);

  const visibleCats = useMemo(() => {
    if (type === 'transfer') {
      return [categories.find((c) => c.id === TRANSFER_CATEGORY.id) ?? TRANSFER_CATEGORY];
    }
    if (type === 'income') {
      return categories.filter((c) => c.name === 'Revenus');
    }
    // expense: only show categories that exist in the budget page
    const budgetCats = categories.filter(
      (c) => c.name !== 'Revenus' && budgetCategoryIds.has(c.id),
    );
    return budgetCats.length > 0 ? budgetCats : categories.filter((c) => c.name !== 'Revenus');
  }, [categories, type, budgetCategoryIds]);
  const accountOptions = useMemo<PaymentAccountOption[]>(() => {
    if (simulatedAccounts.length > 0) {
      return simulatedAccounts.map((account) => ({
        id: account.id,
        label: account.last4 ? `${account.name} • ${account.last4}` : account.name,
        isSimulated: true,
      }));
    }

    return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
      id: account.id,
      label: account.label,
      isSimulated: false,
    }));
  }, [simulatedAccounts]);

  const transferEndpoints = useMemo<TransferEndpoint[]>(() => {
    const accountEntries: TransferEndpoint[] = accountOptions.map((a) => ({
      id: a.id,
      label: a.label.split(' • ')[0] ?? a.label,
      sublabel: a.label.includes(' • ') ? `••${a.label.split(' • ')[1]}` : 'Compte',
      kind: 'account',
      isSimulated: a.isSimulated,
      icon: 'card-outline',
      color: colors.textSecondary,
    }));
    const goalEntries: TransferEndpoint[] = savingsGoals.map((g) => ({
      id: g.id,
      label: g.name,
      sublabel: `${Math.round(g.currentAmount).toLocaleString('fr-CA')} $`,
      kind: 'goal',
      isSimulated: false,
      icon: (g.icon as string) || 'flag-outline',
      color: g.color || colors.primary,
    }));
    return [...accountEntries, ...goalEntries];
  }, [accountOptions, colors.primary, colors.textSecondary, savingsGoals]);

  useEffect(() => {
    if (!editId || prefilledEditId === editId || categories.length === 0 || accountOptions.length === 0) return;

    let cancelled = false;
    void getTransactionById(editId).then((tx) => {
      if (cancelled || !tx) return;
      const transferAccounts = parseTransferAccountsFromNote(tx.note);
      const sourceAccountId = tx.type === 'transfer' ? transferAccounts.sourceId : parseAccountIdFromNote(tx.note);
      const fallbackAccount = accountOptions[0];
      const fallbackDestination = accountOptions[1] ?? fallbackAccount;

      const isKnownEndpoint = (id: string | null) =>
        id ? (accountOptions.some((a) => a.id === id) || savingsGoals.some((g) => g.id === id)) : false;

      setEditingTransaction(tx);
      setType(tx.type);
      setLabel(tx.type === 'transfer' ? '' : tx.label);
      setAmount(formatMoneyInput(tx.amount));
      setDate(toDateInputValue(tx.date));
      setCategoryId(tx.categoryId);
      setCategoryManuallySelected(true);
      setAccountId(
        isKnownEndpoint(sourceAccountId) ? sourceAccountId! : fallbackAccount.id,
      );
      setDestinationAccountId(
        isKnownEndpoint(transferAccounts.destinationId) ? transferAccounts.destinationId! : fallbackDestination.id,
      );
      setFallbackIcon(
        tx.type === 'expense'
          ? isExpenseDefaultIcon(tx.transactionIcon)
            ? EXPENSE_MDI_ICON
            : tx.transactionIcon ?? EXPENSE_MDI_ICON
          : tx.transactionIcon ?? 'AttachMoney',
      );
      setItemizedExpenses(tx.type === 'expense' ? parseItemizedExpensesFromNote(tx.note) : []);
      setReceiptUri(tx.receiptUri ?? '');
      setReceiptStatus(tx.receiptStatus ?? null);
      setReceiptOptionsExpanded(false);
      setPrefilledEditId(editId);
    });

    return () => {
      cancelled = true;
    };
  }, [accountOptions, categories.length, editId, prefilledEditId, savingsGoals]);

  useEffect(() => {
    if (accountOptions.length === 0) return;
    const firstAccount = accountOptions[0];
    const defaultDestination = accountOptions[1] ?? firstAccount;
    if (!firstAccount) return;

    setAccountId((current) =>
      accountOptions.some((account) => account.id === current) ? current : firstAccount.id,
    );
    setDestinationAccountId((current) =>
      accountOptions.some((account) => account.id === current)
        ? current
        : defaultDestination.id,
    );
  }, [accountOptions]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const itemizedTotal = useMemo(
    () => itemizedExpenses.reduce((sum, item) => sum + parseMoney(item.price), 0),
    [itemizedExpenses],
  );
  const hasPricedItems = type === 'expense' && itemizedTotal > 0;
  const hasItemizedItems = type === 'expense' && itemizedExpenses.length > 0;
  const categorySearchText = useMemo(
    () => [label, ...itemizedExpenses.map((item) => item.name)].filter(Boolean).join(' '),
    [itemizedExpenses, label],
  );
  const relevantCategoryChoices = useMemo(
    () =>
      type === 'expense'
        ? getRelevantCategoryChoices(categorySearchText, visibleCats, categoryId)
        : visibleCats,
    [categoryId, categorySearchText, type, visibleCats],
  );
  const inferredExpenseCategoryId = useMemo(
    () => (type === 'expense' ? inferCategoryId(categorySearchText, visibleCats, null) : null),
    [categorySearchText, type, visibleCats],
  );
  useEffect(() => {
    if (categoryManuallySelected) return;
    if (!inferredExpenseCategoryId || categoryId === inferredExpenseCategoryId) return;
    setCategoryId(inferredExpenseCategoryId);
  }, [categoryId, categoryManuallySelected, inferredExpenseCategoryId]);
  const itemizedRows = useMemo(
    () =>
      itemizedExpenses.map((item) => {
        const itemSearchText = item.name.trim() ? item.name : label;
        const inferredCategoryId = inferCategoryId(itemSearchText, visibleCats, null);
        const detectedCategoryId = item.categoryId ?? inferredCategoryId;
        return {
          ...item,
          inferredCategoryId,
          detectedCategoryId,
          detectedCategory: detectedCategoryId ? categoryById.get(detectedCategoryId) : undefined,
          hasManualCategory: Boolean(item.categoryId),
        };
      }),
    [categoryById, itemizedExpenses, label, visibleCats],
  );

  const addItemizedExpense = () => {
    tapHaptic();
    setItemizedExpenses((items) => [
      ...items,
      {
        id: `${Date.now()}-${items.length}`,
        name: '',
        price: '',
        categoryId: null,
      },
    ]);
  };

  const updateItemizedExpense = (id: string, patch: Partial<Omit<ItemizedExpense, 'id'>>) => {
    setItemizedExpenses((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItemizedExpense = (id: string) => {
    tapHaptic();
    setItemizedExpenses((items) => items.filter((item) => item.id !== id));
    if (categoryPickerItemId === id) {
      setCategoryPickerItemId(null);
      setItemCategoryQuery('');
    }
  };

  const attachReceiptAsset = (uri?: string) => {
    if (!uri) return;
    setReceiptUri(uri);
    setReceiptStatus('attached');
    setReceiptOptionsExpanded(false);
  };

  const pickReceiptImage = async () => {
    tapHaptic();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormFeedback(formValidationError('Permission requise', 'Autorise l’accès à tes images pour importer un reçu.'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled) {
      attachReceiptAsset(result.assets[0]?.uri);
    }
  };

  const captureReceiptImage = async () => {
    tapHaptic();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setFormFeedback(formValidationError('Permission requise', 'Autorise l’accès à la caméra pour prendre le reçu en photo.'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled) {
      attachReceiptAsset(result.assets[0]?.uri);
    }
  };

  const displayAmount = useMemo(() => {
    const amt = amount.length ? formatMoneyAmountInput(amount) : '0';
    const sign = type === 'transfer' ? '' : type === 'income' ? '+' : '−';
    return `${sign}${amt} $`;
  }, [amount, type]);
  const labelHasLogo = useMemo(() => hasMerchantLogoCandidate(label), [label]);
  const autoLogoUrl = useMemo(() => getMerchantLogoUrl(label.trim()), [label]);
  const fallbackIconColor = colors.textSecondary;
  const fallbackSourceAccount = accountOptions[0] ?? { id: 'checking', label: 'Chèques', isSimulated: false };
  const sourceAccount = accountOptions.find((account) => account.id === accountId) ?? fallbackSourceAccount;
  const destinationAccount =
    accountOptions.find((account) => account.id === destinationAccountId) ?? accountOptions[1] ?? fallbackSourceAccount;
  const sourceEndpoint = transferEndpoints.find((e) => e.id === accountId);
  const destinationEndpoint = transferEndpoints.find((e) => e.id === destinationAccountId);
  const isTransfer = type === 'transfer';
  const isEditing = Boolean(editingTransaction);
  const sheetTitle = isEditing
    ? 'Modifier la transaction'
    : type === 'income'
      ? 'Nouveau revenu'
      : isTransfer
        ? 'Nouveau transfert'
        : 'Nouvelle dépense';
  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: { backgroundColor: colors.cardBackground, borderColor: colors.border },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      control: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      controlStrong: {
        backgroundColor: colors.input,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      selected: {
        backgroundColor: colors.successMuted,
        borderColor: colors.primary,
        borderWidth: 1.5,
      },
      selectedText: { color: colors.primary },
      text: { color: colors.text },
      textMuted: { color: colors.textMuted },
      detectedCategory: { backgroundColor: colors.successMuted },
    }),
    [colors, isLight],
  );

  const canSubmit =
    (isTransfer || Boolean(label.trim())) &&
    Boolean(amount) &&
    parseMoney(amount) > 0 &&
    Boolean(categoryId) &&
    (!isTransfer || accountId !== destinationAccountId);

  const scrollToAmountSection = () => {
    if (isTransfer) return;

    Keyboard.dismiss();
    requestAnimationFrame(() => {
      setTimeout(() => {
        sheetScrollRef.current?.scrollTo({
          y: Math.max(amountSectionYRef.current - 16, 0),
          animated: true,
        });
      }, 220);
    });
  };

  const selectNameSuggestion = (name: string) => {
    tapHaptic();
    setLabel(name);
    scrollToAmountSection();
  };

  const save = async () => {
    if (!isTransfer && !label.trim()) {
      setFormFeedback(formValidationError('Champ requis', 'Indiquez un marchand ou une description.'));
      return;
    }
    const itemNotes =
      type === 'expense'
        ? itemizedRows
            .filter((item) => item.name.trim() || parseMoney(item.price) > 0)
            .map((item) => {
              const noteCategoryId = item.detectedCategoryId ?? categoryId;
              const noteCategory = noteCategoryId ? categoryById.get(noteCategoryId) : undefined;
              return {
                name: item.name.trim() || 'Article',
                price: Number(parseMoney(item.price).toFixed(2)),
                categoryId: noteCategoryId,
                categoryName: noteCategory?.name ?? null,
              };
            })
        : [];
    const parsed = parseMoney(amount);
    if (!parsed || parsed <= 0) {
      setFormFeedback(formValidationError('Montant invalide', 'Saisissez un montant positif.'));
      return;
    }
    if (!categoryId) {
      setFormFeedback(formValidationError('Catégorie', 'Choisissez une catégorie.'));
      return;
    }
    if (isTransfer && accountId === destinationAccountId) {
      setFormFeedback(formValidationError('Transfert invalide', 'Choisis deux comptes différents.'));
      return;
    }

    const note = isTransfer
      ? `transfert:${accountId}->${destinationAccountId}`
      : itemNotes.length > 0
        ? `compte:${accountId}\narticles:${JSON.stringify(itemNotes)}`
        : `compte:${accountId}`;
    const nextDeltas = getTransactionAccountDeltas({ amount: parsed, type, note });
    const insufficientFunds = findInsufficientFundsViolation(
      simulatedAccounts,
      nextDeltas,
      editingTransaction,
    );
    if (insufficientFunds) {
      setFormFeedback(
        formValidationError(
          'Fonds insuffisants',
          `Le solde de ${insufficientFunds.accountLabel} est insuffisant pour cette opération.`,
        ),
      );
      return;
    }

    setFormFeedback(null);

    if (isTransfer) {
      await upsertCategory(TRANSFER_CATEGORY);
    }

    setSaving(true);
    const srcLabel = sourceEndpoint?.label ?? sourceAccount.label;
    const dstLabel = destinationEndpoint?.label ?? destinationAccount.label;
    const transactionLabel = isTransfer
      ? `Transfert ${srcLabel} → ${dstLabel}`
      : label.trim();
    const transactionDate = toTransactionDate(date);
    const transactionIcon = isTransfer
      ? 'SwapHoriz'
      : labelHasLogo
        ? null
        : type === 'expense' && isExpenseDefaultIcon(fallbackIcon)
          ? null
          : fallbackIcon;
    const normalizedReceiptUri = type === 'expense' ? receiptUri.trim() : '';
    const normalizedReceiptStatus =
      type === 'expense'
        ? receiptStatus === 'scan_pending'
          ? receiptStatus
          : normalizedReceiptUri
            ? 'attached'
            : null
        : null;

    const tx = editingTransaction
      ? {
          ...editingTransaction,
          label: transactionLabel,
          amount: parsed,
          type,
          date: transactionDate,
          categoryId: isTransfer ? TRANSFER_CATEGORY.id : categoryId,
          transactionIcon,
          receiptUri: normalizedReceiptUri || (normalizedReceiptStatus === 'scan_pending' ? receiptUri : null),
          receiptStatus: normalizedReceiptStatus,
          note,
        }
      : createLocalTransaction({
      label: transactionLabel,
      amount: parsed,
      type,
      date: transactionDate,
      categoryId: isTransfer ? TRANSFER_CATEGORY.id : categoryId,
      transactionIcon,
      receiptUri: normalizedReceiptUri || (normalizedReceiptStatus === 'scan_pending' ? receiptUri : null),
      receiptStatus: normalizedReceiptStatus,
      note,
    });
    await insertTransaction({
      id: tx.id,
      label: tx.label,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      categoryId: tx.categoryId,
      transactionIcon: tx.transactionIcon,
      receiptUri: tx.receiptUri,
      receiptStatus: tx.receiptStatus,
      note: tx.note,
      syncStatus: 'pending',
    });

    if (editingTransaction) {
      const previousDeltas = getTransactionAccountDeltas(editingTransaction);
      const nextDeltas = getTransactionAccountDeltas({ amount: parsed, type, note });
      for (const delta of previousDeltas) {
        await adjustSimulatedAccountBalance(delta.id, -delta.delta);
      }
      for (const delta of nextDeltas) {
        await adjustSimulatedAccountBalance(delta.id, delta.delta);
      }
      if (editingTransaction.type === 'transfer') {
        await applyLinkedSavingsGoalDeltas(simulatedAccounts, previousDeltas, -1);
      }
      if (type === 'transfer') {
        await applyLinkedSavingsGoalDeltas(simulatedAccounts, nextDeltas);
      }
    } else if (isTransfer) {
      if (sourceEndpoint?.kind === 'goal') {
        await adjustSavingsGoalCurrentAmount(sourceEndpoint.id, -parsed);
      } else if (sourceAccount.isSimulated) {
        await adjustSimulatedAccountBalance(sourceAccount.id, -parsed);
      }
      if (destinationEndpoint?.kind === 'goal') {
        await adjustSavingsGoalCurrentAmount(destinationEndpoint.id, parsed);
      } else if (destinationAccount.isSimulated) {
        await adjustSimulatedAccountBalance(destinationAccount.id, parsed);
      }
      if (sourceEndpoint?.kind !== 'goal' && destinationEndpoint?.kind !== 'goal') {
        await applyLinkedSavingsGoalDeltas(
          simulatedAccounts,
          getTransactionAccountDeltas({ amount: parsed, type, note }),
        );
      }
    } else if (sourceAccount.isSimulated) {
      await adjustSimulatedAccountBalance(sourceAccount.id, type === 'income' ? parsed : -parsed);
    }
    await syncWithServer();
    setSaving(false);
    successHaptic();
    router.back();
  };

  return (
    <View style={[styles.screen, styles.modalBackdrop, themed.modalBackdrop]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}
      >
        <ScrollView
              ref={sheetScrollRef}
              style={[styles.sheet, themed.sheet]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <View style={[styles.handle, themed.handle]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, themed.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {sheetTitle}
                </Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.sheetClose, themed.closeButton]}>
                  <Ionicons name="close" size={19} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.section}>
                <DashboardSectionLabel>Type</DashboardSectionLabel>
                <View style={styles.wrapRow}>
                  {(['expense', 'income', 'transfer'] as const).map((t) => {
                    const on = type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => {
                          tapHaptic();
                          setCategoryManuallySelected(false);
                          setType(t);
                        }}
                        style={[styles.chip, themed.control, on && themed.selected]}
                      >
                        <Text style={[styles.chipText, themed.text, on && themed.selectedText]} numberOfLines={1}>
                          {t === 'expense' ? 'Dépense' : t === 'income' ? 'Revenu' : 'Transfert'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {!isTransfer ? (
                <View
                  style={styles.section}
                  onLayout={(e) => { nameSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>{type === 'income' ? 'Source du revenu' : 'Marchand / paiement'}</DashboardSectionLabel>
                  <TextInput
                    ref={labelInputRef}
                    style={[styles.input, themed.controlStrong, themed.text]}
                    placeholder={type === 'income' ? 'Ex. Paie, pension, allocation...' : 'Ex. Starbucks, loyer, épicerie...'}
                    placeholderTextColor={colors.textMuted}
                    value={label}
                    onChangeText={setLabel}
                  />
                  {merchantSuggestions.length > 0 ? (
                    <View style={styles.suggestionRow}>
                      {merchantSuggestions.map((merchant) => (
                        <Pressable
                          key={merchant}
                          onPress={() => selectNameSuggestion(merchant)}
                          style={({ pressed }) => [styles.suggestionChip, themed.control, pressed && styles.pressed]}
                        >
                          <Ionicons name="sparkles-outline" size={13} color={colors.textMuted} />
                          <Text style={[styles.suggestionText, themed.text]} numberOfLines={1}>
                            {merchant}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View
                style={styles.amountWrap}
                onLayout={(event) => {
                  amountSectionYRef.current = event.nativeEvent.layout.y;
                }}
              >
                <Text
                  style={[styles.amountText, themed.text, { fontSize: amountFontSize(amount) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.35}
                >
                  {displayAmount}
                </Text>
              </View>

              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 260 }}
              >
                <GhostNumpad value={amount} onChange={setAmount} />
              </MotiView>

              <DatePickerField
                label="Date"
                value={date}
                placeholder="Choisir une date"
                variant="sheet"
                onChangeDate={setDate}
              />

              {type === 'expense' ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Compte utilisé comme paiement</DashboardSectionLabel>
                  <View style={styles.accountRow}>
                    {accountOptions.map((a) => {
                      const on = accountId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => {
                            tapHaptic();
                            setAccountId(a.id);
                          }}
                          style={[styles.accountChip, themed.control, on && themed.selected]}
                        >
                          <Text
                            style={[styles.accountText, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                          >
                            {a.label.replace(' • ', '\n')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {type === 'expense' ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <View>
                      <DashboardSectionLabel>Articles</DashboardSectionLabel>
                      <Text style={[styles.sectionHint, themed.textMuted]}>Facultatif, sans changer le montant.</Text>
                    </View>
                  </View>

                  {itemizedRows.map((item) => (
                    <View key={item.id} style={[styles.itemCard, themed.control]}>
                      <View style={styles.itemRow}>
                        <TextInput
                          style={[styles.input, styles.itemInput, themed.controlStrong, themed.text]}
                          placeholder="Article"
                          placeholderTextColor={colors.textMuted}
                          value={item.name}
                          onChangeText={(value) => updateItemizedExpense(item.id, { name: value })}
                        />
                        <View style={[styles.priceInputWrap, themed.controlStrong]}>
                          <TextInput
                            style={[styles.priceInput, themed.text]}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            value={item.price}
                            onChangeText={(value) => updateItemizedExpense(item.id, { price: value.replace(/[^0-9.,]/g, '') })}
                            keyboardType="decimal-pad"
                          />
                          <Text style={[styles.priceCurrency, themed.textMuted]}>$</Text>
                        </View>
                        <Pressable
                          onPress={() => removeItemizedExpense(item.id)}
                          hitSlop={8}
                          style={({ pressed }) => [styles.removeItemBtn, pressed && styles.pressed]}
                        >
                          <Ionicons name="close" size={16} color={colors.textMuted} />
                        </Pressable>
                      </View>
                      <View style={styles.itemCategoryBlock}>
                        <View style={styles.itemCategorySummary}>
                          {item.detectedCategory ? (
                            <Pressable
                              onPress={() => {
                                tapHaptic();
                                updateItemizedExpense(item.id, { categoryId: item.detectedCategory?.id ?? null });
                              }}
                              style={({ pressed }) => [
                                styles.itemCategoryChip,
                                themed.controlStrong,
                                item.hasManualCategory && themed.selected,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons
                                name={getCategoryIconName(item.detectedCategory)}
                                size={13}
                                color={item.hasManualCategory ? colors.primary : colors.textSecondary}
                                style={styles.categoryChipIcon}
                              />
                              <Text
                                style={[styles.itemCategoryChipText, themed.text, item.hasManualCategory && themed.selectedText]}
                                numberOfLines={1}
                              >
                                {item.hasManualCategory ? 'Catégorie: ' : 'Suggestion: '}
                                {item.detectedCategory.name}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text style={[styles.itemCategoryLabel, themed.textMuted]}>Aucune suggestion</Text>
                          )}
                          <Pressable
                            onPress={() => {
                              tapHaptic();
                              setItemCategoryQuery('');
                              setCategoryPickerItemId(categoryPickerItemId === item.id ? null : item.id);
                            }}
                            style={({ pressed }) => [styles.changeCategoryBtn, themed.controlStrong, pressed && styles.pressed]}
                          >
                            <Text style={[styles.changeCategoryText, themed.text]}>{categoryPickerItemId === item.id ? 'Fermer' : 'Changer'}</Text>
                          </Pressable>
                        </View>
                        {categoryPickerItemId === item.id ? (
                          <View style={styles.itemCategoryPicker}>
                            <TextInput
                              style={[styles.categorySearchInput, themed.controlStrong, themed.text]}
                              placeholder="Chercher une catégorie"
                              placeholderTextColor={colors.textMuted}
                              value={itemCategoryQuery}
                              onChangeText={setItemCategoryQuery}
                            />
                            <View style={styles.itemCategoryChips}>
                              {getCategorySearchChoices(itemCategoryQuery, visibleCats, item.detectedCategoryId).map((c) => {
                                const on = item.detectedCategoryId === c.id;
                                return (
                                  <Pressable
                                    key={c.id}
                                    onPress={() => {
                                      tapHaptic();
                                      updateItemizedExpense(item.id, { categoryId: c.id });
                                      setCategoryPickerItemId(null);
                                      setItemCategoryQuery('');
                                    }}
                                    style={({ pressed }) => [
                                      styles.itemCategoryChip,
                                      themed.controlStrong,
                                      on && themed.selected,
                                      pressed && styles.pressed,
                                    ]}
                                  >
                                    <Ionicons
                                      name={getCategoryIconName(c)}
                                      size={13}
                                      color={on ? colors.primary : colors.textSecondary}
                                      style={styles.categoryChipIcon}
                                    />
                                    <Text
                                      style={[styles.itemCategoryChipText, themed.text, on && themed.selectedText]}
                                      numberOfLines={1}
                                    >
                                      {c.name}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}

                  <Pressable
                    onPress={addItemizedExpense}
                    style={({ pressed }) => [styles.addItemBtn, themed.controlStrong, pressed && styles.pressed]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
                    <Text style={[styles.addItemText, themed.text]}>Ajouter un article</Text>
                  </Pressable>

                  {hasPricedItems ? (
                    <Text style={[styles.itemTotalText, themed.text]}>Total des articles indicatif: {formatMoneyInput(itemizedTotal)} $</Text>
                  ) : null}
                </View>
              ) : null}

              {type === 'expense' && !hasItemizedItems ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {relevantCategoryChoices.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            tapHaptic();
                            setCategoryManuallySelected(true);
                            setCategoryId(c.id);
                          }}
                          style={[styles.categoryChip, themed.control, on && themed.selected]}
                        >
                          <Ionicons
                            name={getCategoryIconName(c)}
                            size={14}
                            color={on ? colors.primary : colors.textSecondary}
                            style={styles.categoryChipIcon}
                          />
                          <Text
                            style={[styles.categoryChipText, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                          >
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {type === 'expense' ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <View>
                      <DashboardSectionLabel>Reçu</DashboardSectionLabel>
                      <Text style={[styles.sectionHint, themed.textMuted]}>Facultatif, lié à cette dépense.</Text>
                    </View>
                    {receiptUri.trim() || receiptStatus ? (
                      <View style={[styles.receiptStatusPill, themed.control]}>
                        <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
                        <Text style={[styles.receiptStatusText, themed.textMuted]}>
                          {receiptStatus === 'scan_pending' ? 'À scanner' : 'Joint'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      tapHaptic();
                      setReceiptOptionsExpanded((expanded) => !expanded);
                    }}
                    style={({ pressed }) => [styles.receiptAttachButton, themed.control, pressed && styles.pressed]}
                  >
                    <View style={styles.inlineScanLabel}>
                      <Ionicons name="attach-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.receiptActionText, themed.text]}>Joindre un reçu</Text>
                    </View>
                    <Ionicons
                      name={receiptOptionsExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {receiptOptionsExpanded ? (
                    <View style={styles.receiptActionGrid}>
                      <Pressable
                        onPress={() => void pickReceiptImage()}
                        style={({ pressed }) => [styles.receiptAction, themed.control, pressed && styles.pressed]}
                      >
                        <Ionicons name="image-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.receiptActionText, themed.text]}>Importer le reçu</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void captureReceiptImage()}
                        style={({ pressed }) => [styles.receiptAction, themed.control, pressed && styles.pressed]}
                      >
                        <Ionicons name="camera-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.receiptActionText, themed.text]}>Prendre une photo</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {!isTransfer ? (
                <View style={[styles.logoSection, themed.control]}>
                  <View style={styles.logoHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Changer le logo ou l'icône"
                      onPress={() => {
                        tapHaptic();
                        setShowLogoPicker((visible) => !visible);
                      }}
                    >
                      {autoLogoUrl ? (
                        <LogoIconFrame uri={autoLogoUrl} size={52} />
                      ) : (
                        <UserPickedIconBadge icon={fallbackIcon} color={fallbackIconColor} size={52} iconSize={22} />
                      )}
                    </Pressable>
                    <View style={styles.logoCopy}>
                      <DashboardSectionLabel>Logo</DashboardSectionLabel>
                      <Text style={[styles.logoHint, themed.textMuted]}>
                        {autoLogoUrl
                          ? 'Logo automatique trouvé avec le nom.'
                          : 'Touche l\'icône pour choisir dans la bibliothèque MDI.'}
                      </Text>
                    </View>
                  </View>

                  {showLogoPicker && !autoLogoUrl ? (
                    <View style={styles.logoPicker}>
                      <Text style={[styles.logoPickerHint, themed.textMuted]}>Icônes MDI</Text>
                      <MdiIconPicker
                        selectedIcon={fallbackIcon}
                        onSelect={(icon: MdiIconName) => {
                          setFallbackIcon(icon);
                          setShowLogoPicker(false);
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {type !== 'expense' && !isTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Compte de dépôt</DashboardSectionLabel>
                  <View style={styles.accountRow}>
                    {accountOptions.map((a) => {
                      const on = accountId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => { tapHaptic(); setAccountId(a.id); }}
                          style={[styles.accountChip, themed.control, on && themed.selected]}
                        >
                          <Text
                            style={[styles.accountText, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                          >
                            {a.label.replace(' • ', '\n')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {isTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>De</DashboardSectionLabel>
                  {transferEndpoints.length === 0 ? (
                    <Text style={[styles.sectionHint, themed.textMuted]}>Aucun compte ou objectif trouvé.</Text>
                  ) : null}
                  {accountOptions.length > 0 ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>Comptes</Text>
                      <View style={styles.accountRow}>
                        {accountOptions.map((a) => {
                          const on = accountId === a.id;
                          return (
                            <Pressable
                              key={a.id}
                              onPress={() => { tapHaptic(); setAccountId(a.id); }}
                              style={[styles.accountChip, themed.control, on && themed.selected]}
                            >
                              <Text style={[styles.accountText, themed.text, on && themed.selectedText]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
                                {a.label.replace(' • ', '\n')}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {savingsGoals.length > 0 ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>Objectifs d'épargne</Text>
                      <View style={styles.accountRow}>
                        {savingsGoals.map((g) => {
                          const on = accountId === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() => { tapHaptic(); setAccountId(g.id); }}
                              style={[styles.transferGoalChip, themed.control, on && themed.selected]}
                            >
                              <Ionicons name={(g.icon as string) || 'flag-outline'} size={15} color={on ? colors.primary : colors.textSecondary} />
                              <Text style={[styles.transferGoalName, themed.text, on && themed.selectedText]} numberOfLines={1}>
                                {g.name}
                              </Text>
                              <Text style={[styles.transferGoalBalance, on ? themed.selectedText : themed.textMuted]} numberOfLines={1}>
                                {Math.round(g.currentAmount).toLocaleString('fr-CA')} $
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              {isTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Vers</DashboardSectionLabel>
                  {accountOptions.length > 0 ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>Comptes</Text>
                      <View style={styles.accountRow}>
                        {accountOptions.map((a) => {
                          const on = destinationAccountId === a.id;
                          return (
                            <Pressable
                              key={a.id}
                              onPress={() => { tapHaptic(); setDestinationAccountId(a.id); }}
                              style={[styles.accountChip, themed.control, on && themed.selected]}
                            >
                              <Text style={[styles.accountText, themed.text, on && themed.selectedText]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
                                {a.label.replace(' • ', '\n')}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {savingsGoals.length > 0 ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>Objectifs d'épargne</Text>
                      <View style={styles.accountRow}>
                        {savingsGoals.map((g) => {
                          const on = destinationAccountId === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() => { tapHaptic(); setDestinationAccountId(g.id); }}
                              style={[styles.transferGoalChip, themed.control, on && themed.selected]}
                            >
                              <Ionicons name={(g.icon as string) || 'flag-outline'} size={15} color={on ? colors.primary : colors.textSecondary} />
                              <Text style={[styles.transferGoalName, themed.text, on && themed.selectedText]} numberOfLines={1}>
                                {g.name}
                              </Text>
                              <Text style={[styles.transferGoalBalance, on ? themed.selectedText : themed.textMuted]} numberOfLines={1}>
                                {Math.round(g.currentAmount).toLocaleString('fr-CA')} $
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {accountId === destinationAccountId ? (
                    <Text style={[styles.transferWarning, { color: colors.warning }]}>Sélectionne deux sources différentes.</Text>
                  ) : null}
                </View>
              ) : null}

              {type === 'income' ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {relevantCategoryChoices.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            tapHaptic();
                            setCategoryManuallySelected(true);
                            setCategoryId(c.id);
                          }}
                          style={[styles.categoryChip, themed.control, on && themed.selected]}
                        >
                          <Ionicons
                            name={getCategoryIconName(c)}
                            size={14}
                            color={on ? colors.primary : colors.textSecondary}
                            style={styles.categoryChipIcon}
                          />
                          <Text
                            style={[styles.categoryChipText, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                          >
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {formFeedback ? (
                <ThemedFormMessage
                  variant={formFeedback.variant}
                  title={formFeedback.title}
                  message={formFeedback.message}
                />
              ) : null}

              <PrimarySaveButton
                label={saving ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Enregistrer'}
                onPress={() => void save()}
                disabled={saving || !canSubmit}
              />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  pressed: { opacity: 0.72 },
  sheet: {
    marginTop: 88,
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHint: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 17,
    marginTop: 2,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...interBoldText,
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
    ...interBoldText,
    fontSize: typography.meta,
    maxWidth: 138,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addItemText: {
    ...interExtraBoldText,
    fontSize: typography.caption,
  },
  itemCard: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  itemNameWrap: {
    flex: 1,
    gap: 5,
  },
  itemInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: typography.caption,
  },
  priceInputWrap: {
    width: 92,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.sm,
    paddingRight: 9,
  },
  priceInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 9,
    ...interBoldText,
    fontSize: typography.caption,
    textAlign: 'right',
  },
  priceCurrency: {
    marginLeft: spacing.xs,
    ...interExtraBoldText,
    fontSize: typography.meta,
  },
  removeItemBtn: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCategoryBlock: {
    gap: 6,
  },
  itemCategorySummary: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  itemCategoryLabel: {
    ...interExtraBoldText,
    fontSize: typography.micro,
    paddingHorizontal: 2,
  },
  changeCategoryBtn: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeCategoryText: {
    ...interExtraBoldText,
    fontSize: typography.micro,
  },
  itemCategoryPicker: {
    gap: 6,
  },
  categorySearchInput: {
    minHeight: 40,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...interBoldText,
    fontSize: typography.caption,
  },
  itemCategoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemCategoryChip: {
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  itemCategoryChipText: {
    ...interExtraBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  detectedCategory: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detectedCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 150,
  },
  itemTotalText: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    textAlign: 'right',
  },
  inlineScanControl: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineScanLabel: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineScanText: {
    flexShrink: 1,
    ...interExtraBoldText,
    fontSize: typography.meta,
  },
  receiptStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  receiptStatusText: {
    ...interExtraBoldText,
    fontSize: typography.micro,
  },
  receiptAttachButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  receiptActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  receiptAction: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  receiptActionText: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    textAlign: 'center',
  },
  premiumBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 2,
  },
  premiumBadgeText: {
    ...interExtraBoldText,
    fontSize: 10,
  },
  logoSection: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
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
  logoPicker: {
    gap: 10,
  },
  logoPickerHint: {
    ...interExtraBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
  logoOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logoOption: {
    width: 54,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
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
  chipText: {
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  categoryChipText: {
    ...interBoldText,
    fontSize: typography.meta,
    lineHeight: 16,
    flexShrink: 1,
  },
  accountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  accountChip: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 66,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: spacing.sm,
  },
  accountText: {
    textAlign: 'center',
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  transferWarning: {
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  transferGroupLabel: {
    ...interMediumText,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  transferGoalChip: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 66,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  transferGoalName: {
    textAlign: 'center',
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  transferGoalBalance: {
    textAlign: 'center',
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 14,
  },
});
