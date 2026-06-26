import { assignCategoryColor } from '@/constants/budgetCategoryColors';
import {
  CATEGORY_ICON_OPTIONS,
  UNCATEGORIZED_TRANSACTION_CATEGORY,
} from '@/constants/categoryOptions';
import { getGoalGreenShade } from '@/constants/theme';
import { loadAlerts, saveAlerts } from '@/lib/ai/alertService';
import {
  mapAccountKind,
  resolveAccount,
  resolveCategory,
  resolveLoan,
  resolveRecurringPayment,
  resolveSavingsGoal,
  resolveTransaction,
  resolveWealthAsset,
} from '@/lib/ai/entityResolver';
import type {
  ChatAction,
  ChatActionType,
  CreerCategorieBudgetParams,
  CreerCompteParams,
  CreerMarchandParams,
  CreerObjectifParams,
  CreerPaiementRecurrentParams,
  CreerPatrimoineParams,
  CreerPretParams,
  CreerTransactionParams,
  ModifierCategorieBudgetParams,
  ModifierCompteParams,
  ModifierMarchandParams,
  ModifierObjectifParams,
  ModifierPaiementRecurrentParams,
  ModifierPatrimoineParams,
  ModifierPretParams,
  ModifierTransactionParams,
} from '@/lib/ai/types';
import { normalizeSearch } from '@/lib/categoryInference';
import {
  getCategories,
  getCategoryBudgets,
  getLoans,
  getMerchantOverrides,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactionById,
  getTransactions,
  getWealthAssets,
  insertSimulatedAccount,
  insertTransaction,
  upsertCategory,
  upsertCategoryBudget,
  upsertLoan,
  upsertMerchantOverride,
  upsertRecurringPayment,
  upsertSavingsGoal,
  upsertWealthAsset,
} from '@/lib/db';
import type {
  Loan,
  LoanDurationUnit,
  LoanPaymentFrequency,
  LoanType,
  RecurringPayment,
  RecurringPaymentFrequency,
  RecurringPaymentKind,
  SavingsGoal,
  SimulatedAccount,
  TransactionType,
  WealthAsset,
} from '@/types';

export type ExecuteChatActionResult = {
  ok: boolean;
  message: string;
  entityId?: string;
};

const SUPPORTED_ACTIONS: ChatActionType[] = [
  'creer_objectif',
  'modifier_objectif',
  'creer_categorie_budget',
  'modifier_categorie_budget',
  'creer_compte',
  'modifier_compte',
  'creer_marchand',
  'modifier_marchand',
  'creer_patrimoine',
  'modifier_patrimoine',
  'creer_pret',
  'modifier_pret',
  'creer_transaction',
  'modifier_transaction',
  'creer_paiement_recurrent',
  'modifier_paiement_recurrent',
  'creer_alerte',
];

function createEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function asRecord(params: unknown): Record<string, unknown> {
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
}

function readString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function requireString(params: Record<string, unknown>, key: string, label: string): string {
  const value = readString(params, key);
  if (!value) throw new Error(`${label} requis.`);
  return value;
}

function readNumber(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function requireNumber(params: Record<string, unknown>, key: string, label: string): number {
  const value = readNumber(params, key);
  if (value === undefined) throw new Error(`${label} requis.`);
  return value;
}

function readBoolean(params: Record<string, unknown>, key: string): boolean | undefined {
  const value = params[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsIsoDate(base: string, months: number): string {
  const date = new Date(`${base}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function parseTransactionType(value: string | undefined): TransactionType {
  const normalized = normalizeSearch(value ?? 'depense');
  if (normalized.includes('revenu') || normalized.includes('income')) return 'income';
  return 'expense';
}

function parseRecurringKind(value: string | undefined): RecurringPaymentKind {
  return normalizeSearch(value ?? '') === 'income' ? 'income' : 'payment';
}

function parseRecurringFrequency(value: string | undefined): RecurringPaymentFrequency {
  const normalized = normalizeSearch(value ?? 'monthly');
  if (normalized.includes('week') && normalized.includes('bi')) return 'biweekly';
  if (normalized.includes('week')) return 'weekly';
  if (normalized.includes('year') || normalized.includes('ann')) return 'yearly';
  return 'monthly';
}

function parseLoanType(value: string | undefined): LoanType {
  const normalized = normalizeSearch(value ?? 'personal_loan');
  if (normalized.includes('hypoth') || normalized.includes('mortgage')) return 'mortgage';
  if (normalized.includes('marge') || normalized.includes('line')) return 'line_of_credit';
  if (normalized.includes('ami') || normalized.includes('friend')) return 'friend_debt';
  return 'personal_loan';
}

async function resolveCategoryFromParams(
  params: Record<string, unknown>,
): Promise<{ id: string; name: string; icon: string; color: string }> {
  const categoryId = readString(params, 'categorie_id');
  const categoryName = readString(params, 'categorie_nom');
  const categories = await getCategories();

  if (categoryId) {
    const match = categories.find((category) => category.id === categoryId);
    if (match) return match;
  }

  if (categoryName) {
    const match = resolveCategory(categories, { nom: categoryName });
    if (match) return match;
  }

  const fallback =
    categories.find((category) => category.id !== UNCATEGORIZED_TRANSACTION_CATEGORY.id) ??
    UNCATEGORIZED_TRANSACTION_CATEGORY;
  return fallback;
}

async function resolveAccountFromParams(
  params: Record<string, unknown>,
): Promise<SimulatedAccount | null> {
  const accountId = readString(params, 'compte_id');
  const accountName = readString(params, 'compte_nom');
  const accounts = await getSimulatedAccounts();
  return resolveAccount(accounts, { id: accountId, nom: accountName });
}

async function executeCreerObjectif(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const name = requireString(params, 'nom', 'Nom');
  const targetAmount = requireNumber(params, 'montant_cible', 'Montant cible');
  const currentAmount = readNumber(params, 'montant_actuel') ?? 0;
  const id = createEntityId('goal');

  const goal: SavingsGoal = {
    id,
    name,
    targetAmount,
    currentAmount,
    initialSavedAmount: currentAmount,
    weeklyContribution: readNumber(params, 'contribution_hebdo'),
    dueDate: readString(params, 'date_echeance'),
    color: getGoalGreenShade(id, true),
    icon: 'flag-outline',
    createdAt: new Date().toISOString(),
  };

  await upsertSavingsGoal(goal);
  return {
    ok: true,
    message: `Objectif « ${name} » créé (${targetAmount.toFixed(0)} $).`,
    entityId: id,
  };
}

async function executeModifierObjectif(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierObjectifParams;
  const goals = await getSavingsGoals();
  const existing = resolveSavingsGoal(goals, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Objectif introuvable — précise l\'id ou le nom.');

  const nextName = readString(params, 'nom') ?? existing.name;
  const nextTarget = readNumber(params, 'montant_cible') ?? existing.targetAmount;
  const nextCurrent = readNumber(params, 'montant_actuel') ?? existing.currentAmount;

  await upsertSavingsGoal({
    ...existing,
    name: nextName,
    targetAmount: nextTarget,
    currentAmount: nextCurrent,
    weeklyContribution: readNumber(params, 'contribution_hebdo') ?? existing.weeklyContribution,
    dueDate: readString(params, 'date_echeance') ?? existing.dueDate,
  });

  return {
    ok: true,
    message: `Objectif « ${nextName} » mis à jour.`,
    entityId: existing.id,
  };
}

// TODO(budget-categories-fresh-start): rewrite when new budget category model/UI lands.
async function executeCreerCategorieBudget(
  params: Record<string, unknown>,
): Promise<ExecuteChatActionResult> {
  const name = requireString(params, 'nom', 'Nom');
  const limitAmount = requireNumber(params, 'limite_mensuelle', 'Limite mensuelle');
  const id = createEntityId('cat');
  const budgets = await getCategoryBudgets();
  const color = assignCategoryColor(budgets.map((budget) => budget.categoryColor));

  await upsertCategory({
    id,
    name,
    icon: readString(params, 'icone') ?? CATEGORY_ICON_OPTIONS[0] ?? 'cart-outline',
    color,
  });
  await upsertCategoryBudget(id, limitAmount, readNumber(params, 'limite_hebdomadaire'));

  return {
    ok: true,
    message: `Catégorie « ${name} » créée avec limite ${limitAmount.toFixed(0)} $/mois.`,
    entityId: id,
  };
}

// TODO(budget-categories-fresh-start): rewrite when new budget category model/UI lands.
async function executeModifierCategorieBudget(
  params: Record<string, unknown>,
): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierCategorieBudgetParams;
  const categories = await getCategories();
  const existing = resolveCategory(categories, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Catégorie introuvable — précise l\'id ou le nom.');

  const nextName = readString(params, 'nom') ?? existing.name;
  await upsertCategory({
    id: existing.id,
    name: nextName,
    icon: readString(params, 'icone') ?? existing.icon,
    color: existing.color,
  });

  const budgets = await getCategoryBudgets();
  const currentBudget = budgets.find((budget) => budget.categoryId === existing.id);
  const limitAmount = readNumber(params, 'limite_mensuelle') ?? currentBudget?.limitAmount ?? 0;
  const weeklyLimit = readNumber(params, 'limite_hebdomadaire') ?? currentBudget?.weeklyLimitAmount ?? null;
  await upsertCategoryBudget(existing.id, limitAmount, weeklyLimit);

  return {
    ok: true,
    message: `Budget « ${nextName} » mis à jour.`,
    entityId: existing.id,
  };
}

async function executeCreerCompte(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const name = requireString(params, 'nom', 'Nom');
  const kind = mapAccountKind(readString(params, 'type')) ?? 'checking';
  const balance = readNumber(params, 'solde') ?? 0;
  const id = createEntityId('sim');
  const accounts = await getSimulatedAccounts();

  const account: SimulatedAccount = {
    id,
    name,
    kind,
    balance: kind === 'credit' ? -Math.abs(balance) : balance,
    institution: readString(params, 'institution'),
    createdAt: new Date().toISOString(),
    displayOrder: accounts.length,
    hidden: false,
    linkedSavingsGoalId: null,
  };

  await insertSimulatedAccount(account);
  return {
    ok: true,
    message: `Compte « ${name} » créé.`,
    entityId: id,
  };
}

async function executeModifierCompte(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierCompteParams;
  const accounts = await getSimulatedAccounts();
  const existing = resolveAccount(accounts, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Compte introuvable — précise l\'id ou le nom.');

  const nextKind = mapAccountKind(readString(params, 'type')) ?? existing.kind;
  const rawBalance = readNumber(params, 'solde');
  const nextBalance =
    rawBalance === undefined
      ? existing.balance
      : nextKind === 'credit'
        ? -Math.abs(rawBalance)
        : rawBalance;

  const updated: SimulatedAccount = {
    ...existing,
    name: readString(params, 'nom') ?? existing.name,
    kind: nextKind,
    balance: nextBalance,
    institution: readString(params, 'institution') ?? existing.institution,
  };

  await insertSimulatedAccount(updated);
  return {
    ok: true,
    message: `Compte « ${updated.name} » mis à jour.`,
    entityId: existing.id,
  };
}

async function executeCreerMarchand(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const originalName = requireString(params, 'nom_original', 'Nom original');

  await upsertMerchantOverride({
    originalName,
    displayName: readString(params, 'nom_affichage') ?? originalName,
    icon: readString(params, 'icone') ?? null,
    hidden: readBoolean(params, 'masque') ?? false,
    useAutoLogo: true,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: `Marchand « ${originalName} » enregistré.`,
    entityId: originalName,
  };
}

async function executeModifierMarchand(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const originalName = requireString(params, 'nom_original', 'Nom original');
  const overrides = await getMerchantOverrides();
  const existing = overrides.find(
    (override) => normalizeSearch(override.originalName) === normalizeSearch(originalName),
  );

  await upsertMerchantOverride({
    originalName,
    displayName: readString(params, 'nom_affichage') ?? existing?.displayName ?? originalName,
    icon: readString(params, 'icone') ?? existing?.icon ?? null,
    hidden: readBoolean(params, 'masque') ?? existing?.hidden ?? false,
    useAutoLogo: existing?.useAutoLogo ?? true,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: `Marchand « ${originalName} » mis à jour.`,
    entityId: originalName,
  };
}

async function executeCreerPatrimoine(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const name = requireString(params, 'nom', 'Nom');
  const currentValue = requireNumber(params, 'valeur_actuelle', 'Valeur actuelle');
  const purchaseCost = readNumber(params, 'cout_achat') ?? currentValue;
  const id = createEntityId('wealth');
  const assetType = readString(params, 'type') === 'real_estate' ? 'real_estate' : 'precious_material';

  const asset: WealthAsset = {
    id,
    type: assetType,
    name,
    purchaseCost,
    currentValue,
    valuationSource: 'manual',
    address: readString(params, 'adresse') ?? null,
    notes: readString(params, 'notes') ?? null,
    createdAt: new Date().toISOString(),
  };

  await upsertWealthAsset(asset);
  return {
    ok: true,
    message: `Patrimoine « ${name} » ajouté (${currentValue.toFixed(0)} $).`,
    entityId: id,
  };
}

async function executeModifierPatrimoine(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierPatrimoineParams;
  const assets = await getWealthAssets();
  const existing = resolveWealthAsset(assets, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Actif patrimonial introuvable — précise l\'id ou le nom.');

  const updated: WealthAsset = {
    ...existing,
    name: readString(params, 'nom') ?? existing.name,
    type: readString(params, 'type') === 'real_estate' ? 'real_estate' : existing.type,
    currentValue: readNumber(params, 'valeur_actuelle') ?? existing.currentValue,
    purchaseCost: readNumber(params, 'cout_achat') ?? existing.purchaseCost,
    address: readString(params, 'adresse') ?? existing.address,
    notes: readString(params, 'notes') ?? existing.notes,
  };

  await upsertWealthAsset(updated);
  return {
    ok: true,
    message: `Patrimoine « ${updated.name} » mis à jour.`,
    entityId: existing.id,
  };
}

async function executeCreerPret(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const name = requireString(params, 'nom', 'Nom');
  const principal = requireNumber(params, 'principal', 'Montant principal');
  const balanceRemaining = readNumber(params, 'solde_restant') ?? principal;
  const interestRate = readNumber(params, 'taux_interet') ?? 0;
  const monthlyPayment = readNumber(params, 'paiement_mensuel') ?? Math.max(principal / 60, 1);
  const startDate = readString(params, 'date_debut') ?? todayIsoDate();
  const endDate = readString(params, 'date_fin') ?? addMonthsIsoDate(startDate, 60);
  const account = await resolveAccountFromParams(params);
  const paymentAccountId = account?.id ?? '';
  const id = createEntityId('loan');
  const loanType = parseLoanType(readString(params, 'type'));

  const loan: Loan = {
    id,
    type: loanType,
    name,
    lender: readString(params, 'preteur') ?? 'Prêteur',
    principal,
    balanceRemaining,
    interestRate,
    monthlyPayment,
    startDate,
    endDate,
    durationAmount: 60,
    durationUnit: 'months' as LoanDurationUnit,
    paymentFrequency: 'monthly' as LoanPaymentFrequency,
    paymentAccountId,
    nextPaymentDate: startDate,
    createdAt: new Date().toISOString(),
  };

  await upsertLoan(loan);
  return {
    ok: true,
    message: `Prêt « ${name} » créé.`,
    entityId: id,
  };
}

async function executeModifierPret(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierPretParams;
  const loans = await getLoans();
  const existing = resolveLoan(loans, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Prêt introuvable — précise l\'id ou le nom.');

  const account = await resolveAccountFromParams(params);
  const updated: Loan = {
    ...existing,
    name: readString(params, 'nom') ?? existing.name,
    lender: readString(params, 'preteur') ?? existing.lender,
    principal: readNumber(params, 'principal') ?? existing.principal,
    balanceRemaining: readNumber(params, 'solde_restant') ?? existing.balanceRemaining,
    interestRate: readNumber(params, 'taux_interet') ?? existing.interestRate,
    monthlyPayment: readNumber(params, 'paiement_mensuel') ?? existing.monthlyPayment,
    paymentAccountId: account?.id ?? existing.paymentAccountId,
    startDate: readString(params, 'date_debut') ?? existing.startDate,
    endDate: readString(params, 'date_fin') ?? existing.endDate,
  };

  await upsertLoan(updated);
  return {
    ok: true,
    message: `Prêt « ${updated.name} » mis à jour.`,
    entityId: existing.id,
  };
}

async function executeCreerTransaction(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const label = requireString(params, 'libelle', 'Libellé');
  const amount = requireNumber(params, 'montant', 'Montant');
  const type = parseTransactionType(readString(params, 'type'));
  const category = await resolveCategoryFromParams(params);
  const id = createEntityId('tx');

  await insertTransaction({
    id,
    label,
    amount: Math.abs(amount),
    type,
    date: readString(params, 'date') ?? new Date().toISOString(),
    categoryId: category.id,
    note: readString(params, 'note'),
    receiptUri: readString(params, 'facture_uri') ?? null,
    receiptStatus: readString(params, 'facture_uri') ? 'attached' : null,
    syncStatus: 'pending',
  });

  return {
    ok: true,
    message: `Transaction « ${label} » (${Math.abs(amount).toFixed(2)} $) enregistrée.`,
    entityId: id,
  };
}

async function executeModifierTransaction(
  params: Record<string, unknown>,
): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierTransactionParams;
  const transactions = await getTransactions();
  const existing =
    (typed.id ? await getTransactionById(typed.id) : null) ??
    resolveTransaction(transactions, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Transaction introuvable — précise l\'id ou le libellé.');

  const category = await resolveCategoryFromParams({
    categorie_id: readString(params, 'categorie_id') ?? existing.categoryId,
    categorie_nom: readString(params, 'categorie_nom'),
  });

  const nextLabel = readString(params, 'libelle') ?? existing.label;
  const nextAmount = readNumber(params, 'montant') ?? existing.amount;
  const nextType = readString(params, 'type')
    ? parseTransactionType(readString(params, 'type'))
    : existing.type;

  await insertTransaction({
    id: existing.id,
    label: nextLabel,
    amount: Math.abs(nextAmount),
    type: nextType,
    date: readString(params, 'date') ?? existing.date,
    categoryId: category.id,
    note: readString(params, 'note') ?? existing.note,
    receiptUri: existing.receiptUri,
    receiptStatus: existing.receiptStatus,
    syncStatus: existing.syncStatus === 'failed' ? 'pending' : existing.syncStatus,
  });

  return {
    ok: true,
    message: `Transaction « ${nextLabel} » mise à jour.`,
    entityId: existing.id,
  };
}

async function executeCreerPaiementRecurrent(
  params: Record<string, unknown>,
): Promise<ExecuteChatActionResult> {
  const name = requireString(params, 'nom', 'Nom');
  const amount = requireNumber(params, 'montant', 'Montant');
  const account = await resolveAccountFromParams(params);
  if (!account) throw new Error('Compte requis — précise compte_id ou compte_nom.');

  const category = await resolveCategoryFromParams(params);
  const frequency = parseRecurringFrequency(readString(params, 'frequence'));
  const kind = parseRecurringKind(readString(params, 'type'));
  const id = createEntityId('recurring');

  const payment: RecurringPayment = {
    id,
    name,
    amount: Math.abs(amount),
    kind,
    accountId: account.id,
    accountLabel: account.name,
    categoryId: category.id,
    categoryName: category.name,
    categoryIcon: category.icon,
    categoryColor: category.color,
    frequency,
    dueDay: readNumber(params, 'jour_echeance') ?? null,
    nextDate: todayIsoDate(),
    active: readBoolean(params, 'actif') ?? true,
    icon: kind === 'income' ? 'cash-outline' : 'repeat',
    color: kind === 'income' ? '#14B8A6' : '#00A854',
    createdAt: new Date().toISOString(),
  };

  await upsertRecurringPayment(payment);
  return {
    ok: true,
    message: `Paiement récurrent « ${name} » créé.`,
    entityId: id,
  };
}

async function executeModifierPaiementRecurrent(
  params: Record<string, unknown>,
): Promise<ExecuteChatActionResult> {
  const typed = params as ModifierPaiementRecurrentParams;
  const payments = await getRecurringPayments();
  const existing = resolveRecurringPayment(payments, { id: typed.id, nom: typed.nom });
  if (!existing) throw new Error('Paiement récurrent introuvable — précise l\'id ou le nom.');

  const account = (await resolveAccountFromParams(params)) ?? {
    id: existing.accountId,
    name: existing.accountLabel,
  } as SimulatedAccount;
  const category = await resolveCategoryFromParams({
    categorie_id: readString(params, 'categorie_id') ?? existing.categoryId ?? undefined,
    categorie_nom: readString(params, 'categorie_nom'),
  });

  const updated: RecurringPayment = {
    ...existing,
    name: readString(params, 'nom') ?? existing.name,
    amount: Math.abs(readNumber(params, 'montant') ?? existing.amount),
    kind: readString(params, 'type') ? parseRecurringKind(readString(params, 'type')) : existing.kind,
    accountId: account.id,
    accountLabel: account.name,
    categoryId: category.id,
    categoryName: category.name,
    categoryIcon: category.icon,
    categoryColor: category.color,
    frequency: readString(params, 'frequence')
      ? parseRecurringFrequency(readString(params, 'frequence'))
      : existing.frequency,
    dueDay: readNumber(params, 'jour_echeance') ?? existing.dueDay ?? null,
    active: readBoolean(params, 'actif') ?? existing.active,
  };

  await upsertRecurringPayment(updated);
  return {
    ok: true,
    message: `Paiement récurrent « ${updated.name} » mis à jour.`,
    entityId: existing.id,
  };
}

async function executeCreerAlerte(params: Record<string, unknown>): Promise<ExecuteChatActionResult> {
  const titre = requireString(params, 'titre', 'Titre');
  const message = requireString(params, 'message', 'Message');
  const typeRaw = readString(params, 'type') ?? 'info';
  const type = (['critique', 'attention', 'info'].includes(typeRaw) ? typeRaw : 'info') as
    | 'critique'
    | 'attention'
    | 'info';

  const alerts = await loadAlerts();
  const alert = {
    id: createEntityId('alert'),
    type,
    categorie: 'autre' as const,
    titre,
    message,
    montant: readNumber(params, 'montant') ?? null,
    compteReference: readString(params, 'compte_id') ?? null,
    dateEcheance: readString(params, 'date_echeance') ?? null,
    actionDisponible: null,
    lu: false,
    createdAt: new Date().toISOString(),
  };

  await saveAlerts([alert, ...alerts].slice(0, 50));
  return {
    ok: true,
    message: `Alerte « ${titre} » créée.`,
    entityId: alert.id,
  };
}

async function executeLegacyUnsupported(action: ChatActionType): Promise<ExecuteChatActionResult> {
  return {
    ok: false,
    message: `L'action « ${action} » n'est pas encore exécutable depuis le chat.`,
  };
}

export async function executeChatAction(action: ChatAction): Promise<ExecuteChatActionResult> {
  const params = asRecord(action.params);

  try {
    switch (action.action) {
      case 'creer_objectif':
        return await executeCreerObjectif(params);
      case 'modifier_objectif':
        return await executeModifierObjectif(params);
      case 'creer_categorie_budget':
        return await executeCreerCategorieBudget(params);
      case 'modifier_categorie_budget':
        return await executeModifierCategorieBudget(params);
      case 'creer_compte':
        return await executeCreerCompte(params);
      case 'modifier_compte':
        return await executeModifierCompte(params);
      case 'creer_marchand':
        return await executeCreerMarchand(params);
      case 'modifier_marchand':
        return await executeModifierMarchand(params);
      case 'creer_patrimoine':
        return await executeCreerPatrimoine(params);
      case 'modifier_patrimoine':
        return await executeModifierPatrimoine(params);
      case 'creer_pret':
        return await executeCreerPret(params);
      case 'modifier_pret':
        return await executeModifierPret(params);
      case 'creer_transaction':
        return await executeCreerTransaction(params);
      case 'modifier_transaction':
        return await executeModifierTransaction(params);
      case 'creer_paiement_recurrent':
        return await executeCreerPaiementRecurrent(params);
      case 'modifier_paiement_recurrent':
        return await executeModifierPaiementRecurrent(params);
      case 'creer_alerte':
        return await executeCreerAlerte(params);
      case 'modifier_plan':
      case 'pause_plan':
      case 'modifier_priorite_dette':
      case 'adapter_dashboard':
        return await executeLegacyUnsupported(action.action);
      default:
        return {
          ok: false,
          message: `Action inconnue : ${action.action}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.';
    return { ok: false, message };
  }
}

export function isExecutableChatAction(action: ChatActionType): boolean {
  return SUPPORTED_ACTIONS.includes(action);
}

export function describeChatAction(action: ChatAction): string {
  return action.confirmation.trim();
}
