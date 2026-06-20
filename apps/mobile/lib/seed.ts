import {
  BUDGET_PRESETS,
  DEFAULT_CATEGORIES,
  INCOME_CATEGORY,
  TRANSFER_CATEGORY,
  UNCATEGORIZED_TRANSACTION_CATEGORY,
} from '@/constants/categoryOptions';
import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import { inferCategoryId } from '@/lib/categoryInference';
import { dataEvents } from '@/lib/events';
import type { Category } from '@/types';
import {
  adjustSimulatedAccountBalance,
  ensureCashAccount,
  getSimulatedAccounts,
  getDb,
  getTransactionCount,
  getVisibleTransactionCount,
  getWealthAssets,
  insertSimulatedAccount,
  insertTransaction,
  repairOrphanTransactionCategories,
  setSetting,
  upsertCategory,
  upsertCategoryBudget,
  upsertWealthAsset,
} from './db';

type SeedTransaction = {
  id: string;
  label: string;
  amount: number;
  type: 'expense' | 'income';
  date: string;
  accountId: string;
};

const DEMO_WEEKS = 12;

/** Full demo seed: 12 weekly cycles + recurring + occasional (~170 visible rows). */
export const DEMO_EXPECTED_VISIBLE_TX = 170;

/** In __DEV__, wipe and reseed when Historique has fewer visible rows than this. */
const DEV_DEMO_RESEED_THRESHOLD = 50;

function isDevDemoReseedEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function shouldReseedDemoTransactions(visibleCount: number): boolean {
  if (visibleCount === 0) return true;
  return isDevDemoReseedEnabled() && visibleCount < DEV_DEMO_RESEED_THRESHOLD;
}

const PAYMENT_ACCOUNT_IDS = {
  checking: '1',
  savings: '2',
  credit: '3',
  cash: 'argent-cash-seed',
} as const;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Deterministic cents jitter from index (reproducible demo data). */
function amount(base: number, index: number, spread = 0.12): number {
  const jitter = ((index * 17 + 3) % 100) / 100;
  return roundMoney(base * (1 - spread / 2 + spread * jitter));
}

function dateDaysAgo(now: Date, days: number, hour = 12): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Days since the most recent Friday (0 = today is Friday). */
function daysSinceFriday(now: Date): number {
  return (now.getDay() - 5 + 7) % 7;
}

function accountNote(accountId: string): string {
  return `compte:${accountId}`;
}

function pickPaymentAccount(index: number, type: 'expense' | 'income', label: string): string {
  if (type === 'income') return PAYMENT_ACCOUNT_IDS.checking;

  const lower = label.toLowerCase();
  if (
    lower.includes('courses') ||
    lower.includes('boulangerie') ||
    lower.includes('métro') ||
    lower.includes('navigo') ||
    lower.includes('stationnement')
  ) {
    return index % 2 === 0 ? PAYMENT_ACCOUNT_IDS.cash : PAYMENT_ACCOUNT_IDS.checking;
  }
  if (
    lower.includes('netflix') ||
    lower.includes('spotify') ||
    lower.includes('amazon') ||
    lower.includes('zara') ||
    lower.includes('decathlon') ||
    lower.includes('fnac') ||
    lower.includes('uber eats')
  ) {
    return PAYMENT_ACCOUNT_IDS.credit;
  }
  if (lower.includes('salaire')) return PAYMENT_ACCOUNT_IDS.checking;

  const pool = [PAYMENT_ACCOUNT_IDS.checking, PAYMENT_ACCOUNT_IDS.credit, PAYMENT_ACCOUNT_IDS.cash];
  return pool[index % pool.length];
}

/** Categories usable for expense inference (same pool as add-transaction expense picker). */
function expenseCategoriesForInference(categories: Category[]): Category[] {
  return categories.filter(
    (category) => category.name !== 'Revenus' && category.id !== TRANSFER_CATEGORY.id,
  );
}

function resolveDemoCategoryId(
  label: string,
  type: 'expense' | 'income',
  expenseCategories: Category[],
): string {
  if (type === 'income') return INCOME_CATEGORY.id;

  return (
    inferCategoryId(label, expenseCategories, expenseCategories[0]?.id ?? null) ??
    expenseCategories[0]?.id ??
    UNCATEGORIZED_TRANSACTION_CATEGORY.id
  );
}

async function seedDemoAccounts(options?: { forceResetBalances?: boolean }): Promise<void> {
  await ensureCashAccount();
  const existingIds = new Set((await getSimulatedAccounts()).map((account) => account.id));
  const createdAt = new Date().toISOString();

  for (const mock of DASHBOARD_ACCOUNTS) {
    if (!options?.forceResetBalances && existingIds.has(mock.id)) continue;
    await insertSimulatedAccount({
      id: mock.id,
      name: mock.name,
      kind: mock.kind,
      balance: mock.balance,
      institution: mock.domain,
      last4: mock.number.replace(/\D/g, '').slice(-4),
      creditLimit: mock.creditLimit,
      createdAt,
    });
  }

  if (options?.forceResetBalances) {
    const db = await getDb();
    await db.runAsync('UPDATE simulated_accounts SET balance = 0 WHERE id = ?', [
      PAYMENT_ACCOUNT_IDS.cash,
    ]);
  }
}

async function wipeAllTransactions(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions');
}

async function insertBuiltDemoTransactions(): Promise<number> {
  const expenseCategories = expenseCategoriesForInference(DEFAULT_CATEGORIES);
  const samples = buildDemoTransactions(new Date());

  for (const sample of samples) {
    const categoryId = resolveDemoCategoryId(sample.label, sample.type, expenseCategories);
    await insertTransaction(
      {
        id: sample.id,
        label: sample.label,
        amount: sample.amount,
        type: sample.type,
        date: sample.date,
        categoryId,
        note: accountNote(sample.accountId),
        syncStatus: 'pending',
      },
      { emit: false },
    );
  }

  for (const sample of samples) {
    for (const { id, delta } of getTransactionAccountDeltas({
      amount: sample.amount,
      type: sample.type,
      note: accountNote(sample.accountId),
    })) {
      await adjustSimulatedAccountBalance(id, delta, { emit: false });
    }
  }

  return samples.length;
}

function buildDemoTransactions(now: Date): SeedTransaction[] {
  const txs: SeedTransaction[] = [];
  let seq = 1;
  const nextId = () => `tx-seed-${String(seq++).padStart(3, '0')}`;

  const fridayBase = daysSinceFriday(now);

  for (let week = 0; week < DEMO_WEEKS; week += 1) {
    const weekBase = week * 7;

    txs.push({
      id: nextId(),
      label: 'Salaire',
      amount: amount(612.5, week, 0.02),
      type: 'income',
      date: dateDaysAgo(now, weekBase + fridayBase, 9),
      accountId: pickPaymentAccount(week, 'income', 'Salaire'),
    });

    const weekExpenses: Array<{
      daysAgo: number;
      hour?: number;
      label: string;
      base: number;
    }> = [
      { daysAgo: weekBase + 0, label: 'Courses Carrefour', base: 87 },
      { daysAgo: weekBase + 1, label: 'Métro — Navigo', base: 2.15 },
      { daysAgo: weekBase + 1, label: 'Café Le Petit Nuage', base: 4.8 },
      { daysAgo: weekBase + 2, label: 'Essence Total', base: 58 },
      { daysAgo: weekBase + 3, label: 'Courses Monoprix', base: 43 },
      { daysAgo: weekBase + 3, label: 'Uber Eats — Sushi', base: 26.5 },
      { daysAgo: weekBase + 4, label: 'Pharmacie Citypharma', base: 18.9 },
      { daysAgo: weekBase + 5, label: 'Restaurant Le Comptoir', base: 42 },
      { daysAgo: weekBase + 5, label: 'SNCF — Paris Lyon', base: 32 },
      { daysAgo: weekBase + 6, label: 'Courses Intermarché', base: 64 },
      { daysAgo: weekBase + 6, label: 'Boulangerie du Marché', base: 6.2 },
    ];

    weekExpenses.forEach((item, index) => {
      const txIndex = week * 20 + index;
      txs.push({
        id: nextId(),
        label: item.label,
        amount: amount(item.base, txIndex),
        type: 'expense',
        date: dateDaysAgo(now, item.daysAgo, item.hour ?? 14),
        accountId: pickPaymentAccount(txIndex, 'expense', item.label),
      });
    });
  }

  const monthlyRecurring: Array<{
    monthOffset: number;
    day: number;
    label: string;
    base: number;
  }> = [
    { monthOffset: 0, day: 3, label: 'Netflix', base: 15.99 },
    { monthOffset: 0, day: 5, label: 'Spotify', base: 11.99 },
    { monthOffset: 0, day: 8, label: 'Forfait Orange', base: 29.99 },
    { monthOffset: 0, day: 12, label: 'Électricité EDF', base: 78 },
    { monthOffset: 0, day: 18, label: 'Amazon', base: 34.9 },
    { monthOffset: 0, day: 22, label: 'Basic Fit', base: 29.99 },
    { monthOffset: 1, day: 3, label: 'Netflix', base: 15.99 },
    { monthOffset: 1, day: 5, label: 'Spotify', base: 11.99 },
    { monthOffset: 1, day: 8, label: 'Forfait Orange', base: 29.99 },
    { monthOffset: 1, day: 12, label: 'Électricité EDF', base: 82 },
    { monthOffset: 1, day: 15, label: 'Decathlon', base: 67 },
    { monthOffset: 1, day: 22, label: 'Basic Fit', base: 29.99 },
    { monthOffset: 2, day: 3, label: 'Netflix', base: 15.99 },
    { monthOffset: 2, day: 5, label: 'Spotify', base: 11.99 },
    { monthOffset: 2, day: 8, label: 'Forfait Orange', base: 29.99 },
    { monthOffset: 2, day: 12, label: 'Électricité EDF', base: 75 },
    { monthOffset: 2, day: 20, label: 'Zara', base: 89 },
    { monthOffset: 2, day: 22, label: 'Basic Fit', base: 29.99 },
  ];

  monthlyRecurring.forEach((item, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - item.monthOffset, item.day, 10, 0, 0, 0);
    if (d > now) return;
    txs.push({
      id: nextId(),
      label: item.label,
      amount: amount(item.base, 200 + index, 0.05),
      type: 'expense',
      date: d.toISOString(),
      accountId: pickPaymentAccount(200 + index, 'expense', item.label),
    });
  });

  const occasional: Array<{
    daysAgo: number;
    label: string;
    base: number;
  }> = [
    { daysAgo: 10, label: 'Leroy Merlin', base: 124 },
    { daysAgo: 17, label: 'Cinéma UGC', base: 13.5 },
    { daysAgo: 24, label: 'Coiffeur', base: 35 },
    { daysAgo: 31, label: 'Fnac — écouteurs', base: 79 },
    { daysAgo: 38, label: 'Vétérinaire', base: 52 },
    { daysAgo: 45, label: 'Train OUIGO', base: 29 },
    { daysAgo: 52, label: 'Cadeau anniversaire', base: 45 },
    { daysAgo: 60, label: 'Stationnement Indigo', base: 12 },
    { daysAgo: 68, label: 'IKEA', base: 156 },
    { daysAgo: 75, label: 'Frais bancaires', base: 4.2 },
  ];

  occasional.forEach((item, index) => {
    const txIndex = 300 + index;
    txs.push({
      id: nextId(),
      label: item.label,
      amount: amount(item.base, txIndex),
      type: 'expense',
      date: dateDaysAgo(now, item.daysAgo, 16),
      accountId: pickPaymentAccount(txIndex, 'expense', item.label),
    });
  });

  return txs;
}

/** Demo immobilier + métaux précieux when the patrimoine table is empty. */
async function seedDemoPatrimoineWealthAssetsIfEmpty(): Promise<void> {
  const existing = await getWealthAssets();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  await upsertWealthAsset({
    id: 'wealth-gold-seed',
    type: 'precious_material',
    name: 'Or',
    material: 'gold',
    weight: 50,
    weightUnit: 'g',
    karats: 24,
    purchaseCost: 3200,
    purchaseDate: now,
    currentValue: 3800,
    lastValuationAt: now,
    valuationSource: 'estimate',
    createdAt: now,
  });
  await upsertWealthAsset({
    id: 'wealth-condo-seed',
    type: 'real_estate',
    name: 'Condo',
    propertyType: 'Condo',
    address: '123 rue Exemple, Montréal',
    purchaseCost: 280_000,
    purchaseDate: now,
    currentValue: 320_000,
    valuationSource: 'manual',
    createdAt: now,
  });
}

/** Idempotent catalog seed (categories, budgets, demo accounts). Safe before transactions. */
export async function ensureSeedCatalog(): Promise<void> {
  await upsertCategory(UNCATEGORIZED_TRANSACTION_CATEGORY);
  await upsertCategory(TRANSFER_CATEGORY);

  for (const category of DEFAULT_CATEGORIES) {
    await upsertCategory(category);
  }

  for (const preset of BUDGET_PRESETS) {
    await upsertCategoryBudget(preset.id, preset.defaultLimit);
  }

  await setSetting(
    'monthly_budget_limit',
    String(BUDGET_PRESETS.reduce((sum, preset) => sum + preset.defaultLimit, 0)),
  );

  await seedDemoAccounts();
  await seedDemoPatrimoineWealthAssetsIfEmpty();
}

/**
 * Inserts demo transactions when Historique is empty (prod) or under-filled (__DEV__).
 * Uses the same insert path and field patterns as manual entry (compte: note, inferred
 * categories, pending sync). Native persistence can retain orphan rows hidden by INNER JOIN;
 * those are wiped before reseeding.
 */
export async function seedDemoTransactionsIfMissing(): Promise<boolean> {
  await upsertCategory(UNCATEGORIZED_TRANSACTION_CATEGORY);
  await repairOrphanTransactionCategories(UNCATEGORIZED_TRANSACTION_CATEGORY.id);

  const visibleCount = await getVisibleTransactionCount();
  if (!shouldReseedDemoTransactions(visibleCount)) return false;

  const rawCount = await getTransactionCount();
  if (rawCount > 0 || visibleCount > 0) {
    await wipeAllTransactions();
  }

  await ensureSeedCatalog();
  if (isDevDemoReseedEnabled()) {
    await seedDemoAccounts({ forceResetBalances: true });
  }

  const inserted = await insertBuiltDemoTransactions();
  if (isDevDemoReseedEnabled()) {
    console.log(`[Seed] demo transactions inserted: ${inserted} (visible was ${visibleCount})`);
  }

  dataEvents.emit();
  return true;
}

/** Wipes transactions, resets demo account balances, and reseeds (dev / manual recovery). */
export async function resetAndSeedDemoData(): Promise<void> {
  await upsertCategory(UNCATEGORIZED_TRANSACTION_CATEGORY);
  await repairOrphanTransactionCategories(UNCATEGORIZED_TRANSACTION_CATEGORY.id);
  await wipeAllTransactions();
  await ensureSeedCatalog();
  await seedDemoAccounts({ forceResetBalances: true });
  const inserted = await insertBuiltDemoTransactions();
  if (isDevDemoReseedEnabled()) {
    console.log(`[Seed] resetAndSeedDemoData inserted ${inserted} transactions`);
  }
  dataEvents.emit();
}

/** Repairs orphan rows, then seeds catalog + demo transactions when history is empty. */
export async function seedDatabase(): Promise<void> {
  await upsertCategory(UNCATEGORIZED_TRANSACTION_CATEGORY);
  await repairOrphanTransactionCategories(UNCATEGORIZED_TRANSACTION_CATEGORY.id);
  await ensureSeedCatalog();
  await seedDemoTransactionsIfMissing();
}
