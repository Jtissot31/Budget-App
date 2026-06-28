import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import {
  accumulateAccountMoneyFlows,
  getTransactionAccountDeltas,
  type AccountMoneyFlow,
} from '@/lib/accountTransactionFlow';
import { normalizeRecurringPaymentIconsFromLoans } from '@/lib/recurringPaymentPresentation';
import { parseItemizedNote } from '@/lib/itemizedNote';
import { dataEvents } from '@/lib/events';
import { normalizeSearch } from '@/lib/categoryInference';
import { DEPRECATED_BUDGET_CATEGORY_IDS } from '@/constants/categoryOptions';
import type {
  Category,
  CategoryBudget,
  Contact,
  DashboardSummary,
  Loan,
  MonthlyBudgetSummary,
  MerchantOverride,
  RecurringPayment,
  RecurringPaymentFrequency,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
  TransactionType,
  WealthAsset,
} from '@/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbOpenFailed = false;

/** Web needs extra time for WASM worker + OPFS; native can be slower on cold start with WAL. */
const DB_OPEN_TIMEOUT_MS = Platform.OS === 'web' ? 30_000 : 15_000;

export function isDatabaseAvailable(): boolean {
  return !dbOpenFailed;
}

function withDbOpenTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${DB_OPEN_TIMEOUT_MS}ms`)),
      DB_OPEN_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Parses stored `transactions.date` for chronological ordering (ISO from device / API). */
export function transactionInstantMs(dateStr: string): number {
  const parsed = Date.parse(dateStr.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** History / lists: newest first; stable tie-break on `id`. */
export function compareTransactionsNewestFirst(a: Transaction, b: Transaction): number {
  const byTime = transactionInstantMs(b.date) - transactionInstantMs(a.date);
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

export function sortTransactionsNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(compareTransactionsNewestFirst);
}

async function initializeDatabaseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          color TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY NOT NULL,
          label TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL,
          date TEXT NOT NULL,
          category_id TEXT NOT NULL,
          transaction_icon TEXT,
          receipt_uri TEXT,
          receipt_status TEXT,
          note TEXT,
          savings_goal_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        CREATE TABLE IF NOT EXISTS category_budgets (
          category_id TEXT PRIMARY KEY NOT NULL,
          limit_amount REAL NOT NULL,
          weekly_limit_amount REAL,
          FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS simulated_accounts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          balance REAL NOT NULL,
          institution TEXT,
          last4 TEXT,
          credit_limit REAL,
          due_day INTEGER,
          interest_rate REAL,
          logo_url TEXT,
          linked_savings_goal_id TEXT,
          hidden INTEGER NOT NULL DEFAULT 0,
          display_order INTEGER,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS merchant_overrides (
          original_name TEXT PRIMARY KEY NOT NULL,
          display_name TEXT,
          logo_url TEXT,
          hidden INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS savings_goals (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          target_amount REAL NOT NULL,
          current_amount REAL NOT NULL,
          initial_saved_amount REAL NOT NULL DEFAULT 0,
          weekly_contribution REAL,
          due_date TEXT,
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recurring_payments (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          kind TEXT NOT NULL DEFAULT 'payment',
          account_id TEXT NOT NULL,
          account_label TEXT NOT NULL,
          category_id TEXT,
          frequency TEXT NOT NULL,
          due_day INTEGER,
          next_date TEXT,
          end_date TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          logo_url TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        CREATE TABLE IF NOT EXISTS wealth_assets (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          material TEXT,
          weight REAL,
          weight_unit TEXT,
          karats REAL,
          purity REAL,
          purchase_cost REAL NOT NULL,
          purchase_date TEXT,
          current_value REAL NOT NULL,
          last_valuation_at TEXT,
          valuation_source TEXT NOT NULL DEFAULT 'estimate',
          property_type TEXT,
          address TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS loans (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL DEFAULT 'personal_loan',
          name TEXT NOT NULL,
          lender TEXT NOT NULL,
          principal REAL NOT NULL,
          balance_remaining REAL NOT NULL,
          interest_rate REAL NOT NULL,
          monthly_payment REAL NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          duration_amount INTEGER NOT NULL DEFAULT 0,
          duration_unit TEXT NOT NULL DEFAULT 'months',
          payment_frequency TEXT NOT NULL DEFAULT 'monthly',
          payment_account_id TEXT NOT NULL DEFAULT '',
          next_payment_date TEXT NOT NULL DEFAULT '',
          recurring_payment_id TEXT,
          created_at TEXT NOT NULL
        );
      `);
  await ensureSavingsGoalColumns(db);
  await ensureSimulatedAccountColumns(db);
  await ensureTransactionColumns(db);
  await ensureCategoryBudgetColumns(db);
  await ensureRecurringPaymentColumns(db);
  await ensureLoanColumns(db);
  await ensureWealthAssetColumns(db);
  await ensureMerchantOverrideColumns(db);
  await ensureContactsTable(db);
  await removeDeprecatedBudgetCategories(db);
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await withDbOpenTimeout(
        SQLite.openDatabaseAsync('budget.db'),
        'SQLite open',
      );
      await initializeDatabaseSchema(db);
      return db;
    })().catch((error: unknown) => {
      dbPromise = null;
      dbOpenFailed = true;
      console.warn('[Boot] SQLite open failed', error);
      throw error;
    });
  }
  return dbPromise;
}

async function ensureSavingsGoalColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(savings_goals)');
  if (!columns.some((column) => column.name === 'weekly_contribution')) {
    await db.execAsync('ALTER TABLE savings_goals ADD COLUMN weekly_contribution REAL');
  }
  if (!columns.some((column) => column.name === 'initial_saved_amount')) {
    await db.execAsync(
      'ALTER TABLE savings_goals ADD COLUMN initial_saved_amount REAL NOT NULL DEFAULT 0',
    );
  }
}

async function ensureSimulatedAccountColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(simulated_accounts)');
  if (!columns.some((column) => column.name === 'linked_savings_goal_id')) {
    await db.execAsync('ALTER TABLE simulated_accounts ADD COLUMN linked_savings_goal_id TEXT');
  }
  if (!columns.some((column) => column.name === 'hidden')) {
    await db.execAsync('ALTER TABLE simulated_accounts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.some((column) => column.name === 'display_order')) {
    await db.execAsync('ALTER TABLE simulated_accounts ADD COLUMN display_order INTEGER');
  }
}

async function ensureTransactionColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
  if (!columns.some((column) => column.name === 'transaction_icon')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN transaction_icon TEXT');
  }
  if (!columns.some((column) => column.name === 'receipt_uri')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN receipt_uri TEXT');
  }
  if (!columns.some((column) => column.name === 'receipt_status')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN receipt_status TEXT');
  }
  if (!columns.some((column) => column.name === 'wealth_asset_id')) {
    await db.execAsync(
      `ALTER TABLE transactions ADD COLUMN wealth_asset_id TEXT REFERENCES wealth_assets(id)`,
    );
  }
  if (!columns.some((column) => column.name === 'savings_goal_id')) {
    await db.execAsync(
      `ALTER TABLE transactions ADD COLUMN savings_goal_id TEXT REFERENCES savings_goals(id)`,
    );
  }
}

async function ensureCategoryBudgetColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(category_budgets)');
  if (!columns.some((column) => column.name === 'weekly_limit_amount')) {
    await db.execAsync('ALTER TABLE category_budgets ADD COLUMN weekly_limit_amount REAL');
  }
}

async function ensureRecurringPaymentColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(recurring_payments)');
  const addColumn = async (name: string, definition: string) => {
    if (!columns.some((column) => column.name === name)) {
      await db.execAsync(`ALTER TABLE recurring_payments ADD COLUMN ${definition}`);
    }
  };

  await addColumn('account_label', 'account_label TEXT NOT NULL DEFAULT ""');
  await addColumn('category_id', 'category_id TEXT');
  await addColumn('kind', 'kind TEXT NOT NULL DEFAULT "payment"');
  await addColumn('frequency', 'frequency TEXT NOT NULL DEFAULT "monthly"');
  await addColumn('due_day', 'due_day INTEGER');
  await addColumn('next_date', 'next_date TEXT');
  await addColumn('end_date', 'end_date TEXT');
  await addColumn('active', 'active INTEGER NOT NULL DEFAULT 1');
  await addColumn('icon', 'icon TEXT NOT NULL DEFAULT "repeat-outline"');
  await addColumn('color', 'color TEXT NOT NULL DEFAULT "#00FA9A"');
  await addColumn('logo_url', 'logo_url TEXT');
  await addColumn('created_at', 'created_at TEXT NOT NULL DEFAULT ""');
}

async function ensureLoanColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(loans)');
  const addColumn = async (name: string, definition: string) => {
    if (!columns.some((column) => column.name === name)) {
      await db.execAsync(`ALTER TABLE loans ADD COLUMN ${definition}`);
    }
  };

  await addColumn('type', 'type TEXT NOT NULL DEFAULT "personal_loan"');
  await addColumn('duration_amount', 'duration_amount INTEGER NOT NULL DEFAULT 0');
  await addColumn('duration_unit', 'duration_unit TEXT NOT NULL DEFAULT "months"');
  await addColumn('payment_frequency', 'payment_frequency TEXT NOT NULL DEFAULT "monthly"');
  await addColumn('payment_account_id', 'payment_account_id TEXT NOT NULL DEFAULT ""');
  await addColumn('next_payment_date', 'next_payment_date TEXT NOT NULL DEFAULT ""');
  await addColumn('recurring_payment_id', 'recurring_payment_id TEXT');
  await addColumn('icon', 'icon TEXT');
  await addColumn('address', 'address TEXT');
  await addColumn('down_payment', 'down_payment REAL');
  await addColumn('purchase_price', 'purchase_price REAL');
  await addColumn('current_property_value', 'current_property_value REAL');
  await addColumn('wealth_asset_id', 'wealth_asset_id TEXT');
  await addColumn('reason', 'reason TEXT');
  await addColumn('rate_type', 'rate_type TEXT');
  await addColumn('rate_term_years', 'rate_term_years INTEGER');
  await addColumn('renewal_date', 'renewal_date TEXT');
  await addColumn('amortization_years', 'amortization_years INTEGER');
  await addColumn('payment_debit_type', 'payment_debit_type TEXT');
  await addColumn('beneficiary_relation', 'beneficiary_relation TEXT');
}

async function ensureWealthAssetColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(wealth_assets)');
  const addColumn = async (name: string, definition: string) => {
    if (!columns.some((column) => column.name === name)) {
      await db.execAsync(`ALTER TABLE wealth_assets ADD COLUMN ${definition}`);
    }
  };

  await addColumn('material', 'material TEXT');
  await addColumn('weight', 'weight REAL');
  await addColumn('weight_unit', 'weight_unit TEXT');
  await addColumn('karats', 'karats REAL');
  await addColumn('purity', 'purity REAL');
  await addColumn('purchase_date', 'purchase_date TEXT');
  await addColumn('last_valuation_at', 'last_valuation_at TEXT');
  await addColumn('valuation_source', 'valuation_source TEXT NOT NULL DEFAULT "estimate"');
  await addColumn('property_type', 'property_type TEXT');
  await addColumn('address', 'address TEXT');
  await addColumn('notes', 'notes TEXT');
  await addColumn('photo_uri', 'photo_uri TEXT');
  await addColumn('linked_loan_id', 'linked_loan_id TEXT');
}

async function ensureMerchantOverrideColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(merchant_overrides)');
  if (!columns.some((column) => column.name === 'icon')) {
    await db.execAsync('ALTER TABLE merchant_overrides ADD COLUMN icon TEXT');
  }
  if (!columns.some((column) => column.name === 'use_auto_logo')) {
    await db.execAsync('ALTER TABLE merchant_overrides ADD COLUMN use_auto_logo INTEGER NOT NULL DEFAULT 1');
  }
}

async function ensureContactsTable(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      is_employer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_normalized_name ON contacts(normalized_name);
  `);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(contacts)');
  if (!columns.some((column) => column.name === 'is_employer')) {
    await db.execAsync('ALTER TABLE contacts ADD COLUMN is_employer INTEGER NOT NULL DEFAULT 0');
  }
  if (!columns.some((column) => column.name === 'photo_uri')) {
    await db.execAsync('ALTER TABLE contacts ADD COLUMN photo_uri TEXT');
  }
}

async function removeDeprecatedBudgetCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const categoryId of DEPRECATED_BUDGET_CATEGORY_IDS) {
    await db.runAsync('DELETE FROM category_budgets WHERE category_id = ?', [categoryId]);

    const transactionRefs =
      (await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?',
        [categoryId],
      ))?.count ?? 0;
    const recurringRefs =
      (await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM recurring_payments WHERE category_id = ?',
        [categoryId],
      ))?.count ?? 0;

    if (transactionRefs === 0 && recurringRefs === 0) {
      await db.runAsync('DELETE FROM categories WHERE id = ?', [categoryId]);
    }
  }
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    `SELECT id, name, icon, color
     FROM categories
     WHERE id NOT IN (${DEPRECATED_BUDGET_CATEGORY_IDS.map(() => '?').join(', ')})
     ORDER BY name`,
    [...DEPRECATED_BUDGET_CATEGORY_IDS],
  );
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  );
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
  dataEvents.emit();
}

export async function getSimulatedAccounts(): Promise<SimulatedAccount[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    Omit<SimulatedAccount, 'hidden'> & {
      hidden: number;
    }
  >(
    `SELECT
       id,
       name,
       kind,
       balance,
       institution,
       last4,
       credit_limit AS creditLimit,
       due_day AS dueDay,
       interest_rate AS interestRate,
       logo_url AS logoUrl,
       linked_savings_goal_id AS linkedSavingsGoalId,
       COALESCE(hidden, 0) AS hidden,
       display_order AS displayOrder,
       created_at AS createdAt
     FROM simulated_accounts
     ORDER BY COALESCE(display_order, 999999), datetime(created_at) DESC, lower(name) ASC`,
  );

  return rows.map((row) => ({
    ...row,
    hidden: row.hidden === 1,
  }));
}

export async function insertSimulatedAccount(account: SimulatedAccount): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO simulated_accounts (
       id, name, kind, balance, institution, last4, credit_limit, due_day,
       interest_rate, logo_url, linked_savings_goal_id, hidden, display_order, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.id,
      account.name,
      account.kind,
      account.balance,
      account.institution ?? null,
      account.last4 ?? null,
      account.creditLimit ?? null,
      account.dueDay ?? null,
      account.interestRate ?? null,
      account.logoUrl ?? null,
      account.linkedSavingsGoalId ?? null,
      account.hidden ? 1 : 0,
      account.displayOrder ?? null,
      account.createdAt,
    ],
  );
  dataEvents.emit();
}

/**
 * Ensures exactly one cash account exists. Uses a single atomic INSERT … WHERE NOT EXISTS
 * so it is safe to call on every app load without emitting a data event.
 */
export async function ensureCashAccount(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO simulated_accounts (
       id, name, kind, balance, institution, last4, credit_limit, due_day,
       interest_rate, logo_url, linked_savings_goal_id, hidden, display_order, created_at
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM simulated_accounts WHERE kind = 'cash')`,
    ['argent-cash-seed', 'Argent Cash', 'cash', 0, null, null, null, null, null, null, null, 0, null, new Date().toISOString()],
  );
}

export async function updateSimulatedAccountPreferences(
  id: string,
  preferences: Pick<SimulatedAccount, 'hidden' | 'displayOrder'>,
): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;

  const db = await getDb();
  await db.runAsync(
    'UPDATE simulated_accounts SET hidden = ?, display_order = ? WHERE id = ?',
    [preferences.hidden ? 1 : 0, preferences.displayOrder ?? null, trimmed],
  );
  dataEvents.emit();
}

export async function deleteSimulatedAccount(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;

  const db = await getDb();
  await db.runAsync('DELETE FROM simulated_accounts WHERE id = ?', [trimmed]);
  dataEvents.emit();
}

export async function adjustSimulatedAccountBalance(
  id: string,
  delta: number,
  options?: { emit?: boolean },
): Promise<void> {
  const trimmedId = id.trim();
  if (!trimmedId || !Number.isFinite(delta) || delta === 0) return;

  const db = await getDb();
  await db.runAsync('UPDATE simulated_accounts SET balance = balance + ? WHERE id = ?', [delta, trimmedId]);
  if (options?.emit !== false) {
    dataEvents.emit();
  }
}

export async function adjustSavingsGoalCurrentAmount(id: string, delta: number): Promise<void> {
  const trimmedId = id.trim();
  if (!trimmedId || !Number.isFinite(delta) || delta === 0) return;

  const db = await getDb();
  await db.runAsync(
    'UPDATE savings_goals SET current_amount = MAX(0, current_amount + ?) WHERE id = ?',
    [delta, trimmedId],
  );
  dataEvents.emit();
}

export async function getWealthAssets(): Promise<WealthAsset[]> {
  const db = await getDb();
  return db.getAllAsync<WealthAsset>(
    `SELECT
       id,
       type,
       name,
       material,
       weight,
       weight_unit AS weightUnit,
       karats,
       purity,
       purchase_cost AS purchaseCost,
       purchase_date AS purchaseDate,
       current_value AS currentValue,
       last_valuation_at AS lastValuationAt,
       valuation_source AS valuationSource,
       property_type AS propertyType,
       address,
       photo_uri AS photoUri,
       linked_loan_id AS linkedLoanId,
       notes,
       created_at AS createdAt
     FROM wealth_assets
     ORDER BY created_at DESC`,
  );
}

export async function upsertWealthAsset(asset: WealthAsset): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO wealth_assets (
       id, type, name, material, weight, weight_unit, karats, purity,
       purchase_cost, purchase_date, current_value, last_valuation_at,
       valuation_source, property_type, address, photo_uri, linked_loan_id, notes, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.id,
      asset.type,
      asset.name,
      asset.material ?? null,
      asset.weight ?? null,
      asset.weightUnit ?? null,
      asset.karats ?? null,
      asset.purity ?? null,
      asset.purchaseCost,
      asset.purchaseDate ?? null,
      asset.currentValue,
      asset.lastValuationAt ?? null,
      asset.valuationSource,
      asset.propertyType ?? null,
      asset.address ?? null,
      asset.photoUri ?? null,
      asset.linkedLoanId ?? null,
      asset.notes ?? null,
      asset.createdAt,
    ],
  );
  dataEvents.emit();
}

export async function deleteWealthAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM wealth_assets WHERE id = ?', [id]);
  dataEvents.emit();
}

const LOAN_SELECT_COLUMNS = `
       id,
       COALESCE(type, 'personal_loan') AS type,
       name,
       reason,
       lender,
       principal,
       balance_remaining AS balanceRemaining,
       interest_rate AS interestRate,
       rate_type AS rateType,
       rate_term_years AS rateTermYears,
       renewal_date AS renewalDate,
       amortization_years AS amortizationYears,
       payment_debit_type AS paymentDebitType,
       beneficiary_relation AS beneficiaryRelation,
       monthly_payment AS monthlyPayment,
       start_date AS startDate,
       end_date AS endDate,
       COALESCE(duration_amount, 0) AS durationAmount,
       COALESCE(duration_unit, 'months') AS durationUnit,
       COALESCE(payment_frequency, 'monthly') AS paymentFrequency,
       COALESCE(payment_account_id, '') AS paymentAccountId,
       COALESCE(next_payment_date, '') AS nextPaymentDate,
       recurring_payment_id AS recurringPaymentId,
       icon,
       address,
       down_payment AS downPayment,
       purchase_price AS purchasePrice,
       current_property_value AS currentPropertyValue,
       wealth_asset_id AS wealthAssetId,
       created_at AS createdAt`;

export async function getLoanById(id: string): Promise<Loan | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<Loan>(
    `SELECT ${LOAN_SELECT_COLUMNS}
     FROM loans
     WHERE id = ?
     LIMIT 1`,
    [trimmed],
  );
  return row ?? null;
}

export async function getLoans(): Promise<Loan[]> {
  const db = await getDb();
  return db.getAllAsync<Loan>(
    `SELECT ${LOAN_SELECT_COLUMNS}
     FROM loans
     ORDER BY created_at DESC`,
  );
}

export async function upsertLoan(loan: Loan): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO loans (
       id, type, name, reason, lender, principal, balance_remaining, interest_rate,
       rate_type, rate_term_years, renewal_date, amortization_years, payment_debit_type,
       beneficiary_relation, monthly_payment, start_date, end_date, duration_amount, duration_unit,
       payment_frequency, payment_account_id, next_payment_date, recurring_payment_id,
       icon, address, down_payment, purchase_price, current_property_value, wealth_asset_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loan.id,
      loan.type,
      loan.name,
      loan.reason ?? null,
      loan.lender,
      loan.principal,
      loan.balanceRemaining,
      loan.interestRate,
      loan.rateType ?? null,
      loan.rateTermYears ?? null,
      loan.renewalDate ?? null,
      loan.amortizationYears ?? null,
      loan.paymentDebitType ?? null,
      loan.beneficiaryRelation ?? null,
      loan.monthlyPayment,
      loan.startDate,
      loan.endDate,
      loan.durationAmount,
      loan.durationUnit,
      loan.paymentFrequency,
      loan.paymentAccountId,
      loan.nextPaymentDate,
      loan.recurringPaymentId ?? null,
      loan.icon ?? null,
      loan.address ?? null,
      loan.downPayment ?? null,
      loan.purchasePrice ?? null,
      loan.currentPropertyValue ?? null,
      loan.wealthAssetId ?? null,
      loan.createdAt,
    ],
  );
  dataEvents.emit();
}

export async function deleteLoan(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;
  const db = await getDb();
  const row = await db.getFirstAsync<{ recurringPaymentId?: string | null; wealthAssetId?: string | null }>(
    'SELECT recurring_payment_id AS recurringPaymentId, wealth_asset_id AS wealthAssetId FROM loans WHERE id = ? LIMIT 1',
    [trimmed],
  );
  if (row?.wealthAssetId) {
    const asset = await getWealthAssetById(row.wealthAssetId);
    if (asset) {
      await db.runAsync('UPDATE wealth_assets SET linked_loan_id = NULL WHERE id = ?', [row.wealthAssetId]);
    }
  }
  await db.runAsync('DELETE FROM loans WHERE id = ?', [trimmed]);
  if (row?.recurringPaymentId) {
    await db.runAsync('DELETE FROM recurring_payments WHERE id = ?', [row.recurringPaymentId]);
  }
  dataEvents.emit();
}

function mapContactRow(row: {
  id: string;
  name: string;
  normalizedName: string;
  isEmployer?: number | null;
  photoUri?: string | null;
  createdAt: string;
}): Contact {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    isEmployer: row.isEmployer === 1,
    photoUri: row.photoUri ?? null,
    createdAt: row.createdAt,
  };
}

export async function getContacts(): Promise<Contact[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    normalizedName: string;
    isEmployer: number;
    photoUri?: string | null;
    createdAt: string;
  }>(
    `SELECT id, name, normalized_name AS normalizedName, COALESCE(is_employer, 0) AS isEmployer, photo_uri AS photoUri, created_at AS createdAt
     FROM contacts
     ORDER BY name COLLATE NOCASE ASC`,
  );
  return rows.map(mapContactRow);
}

export async function getContactByNormalizedName(normalizedName: string): Promise<Contact | null> {
  const trimmed = normalizedName.trim();
  if (!trimmed) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    normalizedName: string;
    isEmployer: number;
    photoUri?: string | null;
    createdAt: string;
  }>(
    `SELECT id, name, normalized_name AS normalizedName, COALESCE(is_employer, 0) AS isEmployer, photo_uri AS photoUri, created_at AS createdAt
     FROM contacts
     WHERE normalized_name = ?
     LIMIT 1`,
    [trimmed],
  );
  return row ? mapContactRow(row) : null;
}

export async function upsertContactByName(
  name: string,
  options?: { isEmployer?: boolean },
): Promise<Contact> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Contact name is required');
  }

  const normalizedName = normalizeSearch(trimmed);
  const db = await getDb();
  const existing = await db.getFirstAsync<{
    id: string;
    name: string;
    normalizedName: string;
    isEmployer: number;
    photoUri?: string | null;
    createdAt: string;
  }>(
    `SELECT id, name, normalized_name AS normalizedName, COALESCE(is_employer, 0) AS isEmployer, photo_uri AS photoUri, created_at AS createdAt
     FROM contacts
     WHERE normalized_name = ?
     LIMIT 1`,
    [normalizedName],
  );
  if (existing) {
    const nextIsEmployer = options?.isEmployer ?? existing.isEmployer === 1;
    if (existing.name !== trimmed || nextIsEmployer !== (existing.isEmployer === 1)) {
      await db.runAsync('UPDATE contacts SET name = ?, is_employer = ? WHERE id = ?', [
        trimmed,
        nextIsEmployer ? 1 : 0,
        existing.id,
      ]);
      dataEvents.emit();
      return mapContactRow({
        ...existing,
        name: trimmed,
        isEmployer: nextIsEmployer ? 1 : 0,
      });
    }
    return mapContactRow(existing);
  }

  const isEmployer = options?.isEmployer ?? false;
  const contact: Contact = {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: trimmed,
    normalizedName,
    isEmployer,
    photoUri: null,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    'INSERT INTO contacts (id, name, normalized_name, is_employer, photo_uri, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [contact.id, contact.name, contact.normalizedName, isEmployer ? 1 : 0, null, contact.createdAt],
  );
  dataEvents.emit();
  return contact;
}

export async function updateContactEmployer(contactId: string, isEmployer: boolean): Promise<void> {
  const trimmed = contactId.trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.runAsync('UPDATE contacts SET is_employer = ? WHERE id = ?', [isEmployer ? 1 : 0, trimmed]);
  dataEvents.emit();
}

export async function updateContactPhoto(contactId: string, photoUri: string | null): Promise<void> {
  const trimmed = contactId.trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.runAsync('UPDATE contacts SET photo_uri = ? WHERE id = ?', [photoUri?.trim() || null, trimmed]);
  dataEvents.emit();
}

export async function getMerchantOverrides(): Promise<MerchantOverride[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    originalName: string;
    displayName?: string | null;
    logoUrl?: string | null;
    icon?: string | null;
    useAutoLogo: number;
    hidden: number;
    updatedAt: string;
  }>(
    `SELECT
       original_name AS originalName,
       display_name AS displayName,
       logo_url AS logoUrl,
       icon,
       use_auto_logo AS useAutoLogo,
       hidden,
       updated_at AS updatedAt
     FROM merchant_overrides
     ORDER BY updated_at DESC`,
  );

  return rows.map((row) => ({
    originalName: row.originalName,
    displayName: row.displayName,
    logoUrl: row.logoUrl,
    icon: row.icon,
    useAutoLogo: row.useAutoLogo !== 0,
    hidden: row.hidden === 1,
    updatedAt: row.updatedAt,
  }));
}

export async function upsertMerchantOverride(override: MerchantOverride): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO merchant_overrides (original_name, display_name, logo_url, icon, use_auto_logo, hidden, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(original_name) DO UPDATE SET
       display_name = excluded.display_name,
       logo_url = excluded.logo_url,
       icon = excluded.icon,
       use_auto_logo = excluded.use_auto_logo,
       hidden = excluded.hidden,
       updated_at = excluded.updated_at`,
    [
      override.originalName,
      override.displayName?.trim() || null,
      override.logoUrl ?? null,
      override.icon ?? null,
      override.useAutoLogo !== false ? 1 : 0,
      override.hidden ? 1 : 0,
      override.updatedAt,
    ],
  );
  dataEvents.emit();
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const db = await getDb();
  return db.getAllAsync<SavingsGoal>(
    `SELECT
       id,
       name,
       target_amount AS targetAmount,
       current_amount AS currentAmount,
       COALESCE(initial_saved_amount, 0) AS initialSavedAmount,
       weekly_contribution AS weeklyContribution,
       due_date AS dueDate,
       color,
       icon,
       created_at AS createdAt
     FROM savings_goals
     ORDER BY created_at DESC`,
  );
}

export async function upsertSavingsGoal(goal: SavingsGoal): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO savings_goals (
       id, name, target_amount, current_amount, initial_saved_amount, weekly_contribution, due_date, color, icon, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.id,
      goal.name,
      goal.targetAmount,
      goal.currentAmount,
      goal.initialSavedAmount,
      goal.weeklyContribution ?? null,
      goal.dueDate ?? null,
      goal.color,
      goal.icon,
      goal.createdAt,
    ],
  );
  dataEvents.emit();
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;

  const db = await getDb();
  await db.runAsync('UPDATE transactions SET savings_goal_id = NULL WHERE savings_goal_id = ?', [trimmed]);
  await db.runAsync(
    'UPDATE simulated_accounts SET linked_savings_goal_id = NULL WHERE linked_savings_goal_id = ?',
    [trimmed],
  );
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [trimmed]);
  dataEvents.emit();
}

export async function getRecurringPayments(): Promise<RecurringPayment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    amount: number;
    kind?: RecurringPayment['kind'];
    accountId: string;
    accountLabel: string;
    categoryId?: string | null;
    categoryName?: string;
    categoryIcon?: string;
    categoryColor?: string;
    frequency: RecurringPaymentFrequency;
    dueDay?: number | null;
    nextDate?: string | null;
    endDate?: string | null;
    active: number;
    icon: string;
    color: string;
    logoUrl?: string | null;
    createdAt: string;
  }>(
    `SELECT
       rp.id,
       rp.name,
       rp.amount,
       rp.kind,
       rp.account_id AS accountId,
       rp.account_label AS accountLabel,
       rp.category_id AS categoryId,
       c.name AS categoryName,
       c.icon AS categoryIcon,
       c.color AS categoryColor,
       rp.frequency,
       rp.due_day AS dueDay,
       rp.next_date AS nextDate,
       rp.end_date AS endDate,
       rp.active,
       rp.icon,
       rp.color,
       rp.logo_url AS logoUrl,
       rp.created_at AS createdAt
     FROM recurring_payments rp
     LEFT JOIN categories c ON c.id = rp.category_id
     ORDER BY rp.active DESC, COALESCE(rp.next_date, rp.created_at) ASC`,
  );

  const payments = rows.map((row) => ({
    ...row,
    kind: row.kind === 'income' ? 'income' : 'payment',
    active: row.active === 1,
  }));

  const loans = await getLoans();
  const { payments: normalized, repairs } = normalizeRecurringPaymentIconsFromLoans(payments, loans);
  if (repairs.length > 0) {
    for (const payment of repairs) {
      await db.runAsync('UPDATE recurring_payments SET icon = ? WHERE id = ?', [payment.icon, payment.id]);
    }
  }
  return normalized;
}

export async function upsertRecurringPayment(payment: RecurringPayment): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO recurring_payments (
       id, name, amount, kind, account_id, account_label, category_id, frequency,
       due_day, next_date, end_date, active, icon, color, logo_url, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.id,
      payment.name,
      payment.amount,
      payment.kind ?? 'payment',
      payment.accountId,
      payment.accountLabel,
      payment.categoryId ?? null,
      payment.frequency,
      payment.dueDay ?? null,
      payment.nextDate ?? null,
      payment.endDate ?? null,
      payment.active ? 1 : 0,
      payment.icon,
      payment.color,
      payment.logoUrl ?? null,
      payment.createdAt,
    ],
  );
  dataEvents.emit();
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_payments WHERE id = ?', [id]);
  dataEvents.emit();
}

export async function insertTransaction(
  tx: {
    id: string;
    label: string;
    amount: number;
    type: TransactionType;
    date: string;
    categoryId: string;
    transactionIcon?: string | null;
    receiptUri?: string | null;
    receiptStatus?: Transaction['receiptStatus'];
    note?: string;
    wealthAssetId?: string | null;
    savingsGoalId?: string | null;
    syncStatus?: 'pending' | 'synced';
  },
  options?: { emit?: boolean },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO transactions (id, label, amount, type, date, category_id, transaction_icon, receipt_uri, receipt_status, note, wealth_asset_id, savings_goal_id, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       amount = excluded.amount,
       type = excluded.type,
       date = excluded.date,
       category_id = excluded.category_id,
       transaction_icon = COALESCE(excluded.transaction_icon, transactions.transaction_icon),
       receipt_uri = excluded.receipt_uri,
       receipt_status = excluded.receipt_status,
       note = excluded.note,
       wealth_asset_id = COALESCE(excluded.wealth_asset_id, transactions.wealth_asset_id),
       savings_goal_id = COALESCE(excluded.savings_goal_id, transactions.savings_goal_id),
       sync_status = excluded.sync_status`,
    [
      tx.id,
      tx.label,
      tx.amount,
      tx.type,
      tx.date,
      tx.categoryId,
      tx.transactionIcon ?? null,
      tx.receiptUri ?? null,
      tx.receiptStatus ?? null,
      tx.note ?? null,
      tx.wealthAssetId ?? null,
      tx.savingsGoalId ?? null,
      tx.syncStatus ?? 'pending',
    ],
  );
  if (options?.emit !== false) {
    dataEvents.emit();
  }
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDb();
  return db.getFirstAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.id = ?
     LIMIT 1`,
    [id],
  );
}

export async function deleteTransactionById(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [trimmed]);
  dataEvents.emit();
}

export async function getWealthAssetById(id: string): Promise<WealthAsset | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const db = await getDb();
  return db.getFirstAsync<WealthAsset>(
    `SELECT
       id,
       type,
       name,
       material,
       weight,
       weight_unit AS weightUnit,
       karats,
       purity,
       purchase_cost AS purchaseCost,
       purchase_date AS purchaseDate,
       current_value AS currentValue,
       last_valuation_at AS lastValuationAt,
       valuation_source AS valuationSource,
       property_type AS propertyType,
       address,
       photo_uri AS photoUri,
       linked_loan_id AS linkedLoanId,
       notes,
       created_at AS createdAt
     FROM wealth_assets
     WHERE id = ?
     LIMIT 1`,
    [trimmed],
  );
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.sync_status = 'pending'
     ORDER BY datetime(t.date) DESC, t.id DESC`,
  );
}

/**
 * Mouvements (dépenses + revenus) liés à un actif de patrimoine hors compte.
 * Liaison DB : colonne optionnelle `wealth_asset_id` ; rétrocompat : une ligne dans `note`
 * contenant `wealth:{id}`, `patrimoine:{id}` ou `horscompte:{id}`.
 */
export async function getTransactionsForWealthAsset(assetId: string): Promise<Transaction[]> {
  const trimmed = assetId.trim();
  if (!trimmed) return [];
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.type IN ('expense', 'income')
     AND (
       t.wealth_asset_id = ?
       OR instr(COALESCE(t.note, ''), 'wealth:' || ?) > 0
       OR instr(COALESCE(t.note, ''), 'patrimoine:' || ?) > 0
       OR instr(COALESCE(t.note, ''), 'horscompte:' || ?) > 0
     )
     ORDER BY datetime(t.date) DESC, t.id DESC`,
    [trimmed, trimmed, trimmed, trimmed],
  );
}

/**
 * Mouvements liés à un objectif d'épargne.
 *
 * Règles incluses :
 * - lien direct optionnel `transactions.savings_goal_id`;
 * - marqueurs historiques dans `note` : `goal:{id}`, `objectif:{id}`, `savingsGoal:{id}`;
 * - transactions/transferts dont les deltas touchent un compte encore lié à cet objectif
 *   (`simulated_accounts.linked_savings_goal_id`).
 */
export async function getTransactionsForSavingsGoal(goalId: string): Promise<Transaction[]> {
  const trimmed = goalId.trim();
  if (!trimmed) return [];
  const db = await getDb();
  const linkedAccounts = await db.getAllAsync<Pick<SimulatedAccount, 'id' | 'name'>>(
    `SELECT id, name
     FROM simulated_accounts
     WHERE linked_savings_goal_id = ?`,
    [trimmed],
  );
  const linkedAccountIds = new Set(linkedAccounts.map((account) => account.id));
  const linkedAccountNames = linkedAccounts
    .map((account) => account.name.trim().toLowerCase())
    .filter(Boolean);

  const rows = await db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId, t.savings_goal_id AS savingsGoalId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.type IN ('expense', 'income', 'transfer')
     ORDER BY datetime(t.date) DESC, t.id DESC`,
  );

  return rows.filter((tx) => {
    if (tx.savingsGoalId?.trim() === trimmed) return true;

    const note = tx.note ?? '';
    const normalizedNote = note.toLowerCase();
    const normalizedGoalId = trimmed.toLowerCase();

    if (
      normalizedNote.includes(`goal:${normalizedGoalId}`) ||
      normalizedNote.includes(`objectif:${normalizedGoalId}`) ||
      normalizedNote.includes(`savingsgoal:${normalizedGoalId}`)
    ) {
      return true;
    }

    // Transferts directs vers/depuis l'objectif : note = "transfert:source->dest"
    if (tx.type === 'transfer') {
      const match = /^transfert:(.+)->(.+)$/.exec(note.split('\n')[0] ?? '');
      if (match) {
        const sourceId = match[1]?.trim();
        const destId = match[2]?.trim();
        if (sourceId === trimmed || destId === trimmed) return true;
      }
    }

    if (linkedAccountIds.size > 0) {
      const touchesLinkedAccount = getTransactionAccountDeltas(tx).some(({ id }) => linkedAccountIds.has(id));
      if (touchesLinkedAccount) return true;
    }

    return linkedAccountNames.some((name) => normalizedNote.includes(`compte:${name}`));
  });
}

export async function getTransactionsForBudgetCategory(categoryId: string): Promise<Transaction[]> {
  const trimmed = categoryId.trim();
  if (!trimmed) return [];
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId, t.savings_goal_id AS savingsGoalId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.category_id = ? AND t.type = 'expense'
     ORDER BY datetime(t.date) DESC, t.id DESC`,
    [trimmed],
  );
}

export async function markTransactionSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE transactions SET sync_status = 'synced' WHERE id = ?`, [id]);
  dataEvents.emit();
}

export async function getTransactions(search?: string): Promise<Transaction[]> {
  const db = await getDb();
  const q = `%${(search ?? '').trim()}%`;
  if (search?.trim()) {
    return db.getAllAsync<Transaction>(
      `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
              t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
              t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
              t.wealth_asset_id AS wealthAssetId, t.savings_goal_id AS savingsGoalId,
              c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.label LIKE ? OR c.name LIKE ?
       ORDER BY datetime(t.date) DESC, t.id DESC`,
      [q, q],
    );
  }
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId, t.savings_goal_id AS savingsGoalId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ORDER BY datetime(t.date) DESC, t.id DESC`,
  );
}

export async function getRecentIncomeTransactions(limit = 12): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'income'
     ORDER BY datetime(t.date) DESC, t.id DESC
     LIMIT ?`,
    [limit],
  );
}

/** Matches Budget page → Categories: limit set or spending this month. */
export function isActiveCategoryBudget(
  budget: Pick<CategoryBudget, 'limitAmount' | 'spent'>,
): boolean {
  return budget.limitAmount > 0 || budget.spent > 0;
}

export function filterActiveCategoryBudgets(budgets: CategoryBudget[]): CategoryBudget[] {
  return budgets.filter(isActiveCategoryBudget);
}

export async function getCategoryBudgets(): Promise<CategoryBudget[]> {
  return getCategoryBudgetsForMonth(new Date());
}

export async function getCategoryBudgetsForMonth(monthDate: Date): Promise<CategoryBudget[]> {
  const db = await getDb();
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1, 0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();
  const monthEndIso = monthEnd.toISOString();

  return db.getAllAsync<CategoryBudget>(
    `SELECT
       c.id AS categoryId,
       c.name AS categoryName,
       c.icon AS categoryIcon,
       c.color AS categoryColor,
       b.limit_amount AS limitAmount,
       b.weekly_limit_amount AS weeklyLimitAmount,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         WHERE t.category_id = c.id AND t.type = 'expense'
           AND t.date >= ? AND t.date < ?
       ), 0) AS spent
     FROM category_budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.category_id NOT IN (${DEPRECATED_BUDGET_CATEGORY_IDS.map(() => '?').join(', ')})
     ORDER BY spent DESC`,
    [monthStartIso, monthEndIso, ...DEPRECATED_BUDGET_CATEGORY_IDS],
  );
}

/** First day of the earliest calendar month containing an expense transaction. */
export async function getEarliestExpenseMonthStart(): Promise<Date> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ date: string | null }>(
    `SELECT MIN(date) AS date FROM transactions WHERE type = 'expense'`,
  );
  const now = new Date();
  if (!row?.date) {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  const earliest = new Date(row.date);
  if (Number.isNaN(earliest.getTime())) {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  return new Date(earliest.getFullYear(), earliest.getMonth(), 1, 0, 0, 0, 0);
}

/** Expense totals per category for a single calendar month. */
export async function getCategorySpentForMonth(monthDate: Date): Promise<Map<string, number>> {
  const db = await getDb();
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1, 0, 0, 0, 0);

  const rows = await db.getAllAsync<{ categoryId: string; spent: number }>(
    `SELECT t.category_id AS categoryId, COALESCE(SUM(t.amount), 0) AS spent
     FROM transactions t
     WHERE t.type = 'expense' AND t.date >= ? AND t.date < ?
     GROUP BY t.category_id`,
    [monthStart.toISOString(), monthEnd.toISOString()],
  );

  return new Map(rows.map((row) => [row.categoryId, row.spent]));
}

export async function getMonthlyBudgetHistory(monthCount = 6): Promise<MonthlyBudgetSummary[]> {
  const db = await getDb();
  const safeMonthCount = Math.max(1, Math.min(12, Math.round(monthCount)));
  const today = new Date();
  const firstMonth = new Date(today.getFullYear(), today.getMonth() - safeMonthCount + 1, 1);
  firstMonth.setHours(0, 0, 0, 0);
  const firstMonthIso = firstMonth.toISOString();
  const monthlyBudgetLimit = Number(await getSetting('monthly_budget_limit', '1500'));

  const rows = await db.getAllAsync<{ month: string; expenses: number }>(
    `SELECT substr(date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS expenses
     FROM transactions
     WHERE type = 'expense' AND date >= ?
     GROUP BY substr(date, 1, 7)
     ORDER BY month ASC`,
    [firstMonthIso],
  );
  const expensesByMonth = new Map(rows.map((row) => [row.month, row.expenses]));

  return Array.from({ length: safeMonthCount }, (_, index) => {
    const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      month,
      expenses: expensesByMonth.get(month) ?? 0,
      budgetLimit: monthlyBudgetLimit,
    };
  });
}

export async function getDashboard(): Promise<DashboardSummary> {
  const db = await getDb();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  const monthlyIncome =
    (await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE type = 'income' AND date >= ?`,
      [monthStartIso],
    ))?.total ?? 0;

  const monthlyExpenses =
    (await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE type = 'expense' AND date >= ?`,
      [monthStartIso],
    ))?.total ?? 0;

  const balance =
    (await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(CASE
         WHEN type = 'income' THEN amount
         WHEN type = 'expense' THEN -amount
         ELSE 0
       END), 0) AS total
       FROM transactions`,
    ))?.total ?? 0;

  const monthlyBudgetLimit = Number(
    await getSetting('monthly_budget_limit', '1500'),
  );

  /** Aperçu accueil : les 3 opérations les plus récentes (`date` décroissant). */
  const recentTransactions = await db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ORDER BY datetime(t.date) DESC, t.id DESC
     LIMIT 3`,
  );

  const topBudgets = (await getCategoryBudgets()).filter((b) => b.limitAmount > 0);

  return {
    balance,
    monthlyIncome,
    monthlyExpenses,
    monthlyBudgetLimit,
    recentTransactions,
    topBudgets,
  };
}

export async function upsertCategory(c: Category): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, icon=excluded.icon, color=excluded.color',
    [c.id, c.name, c.icon, c.color],
  );
  dataEvents.emit();
}

export async function upsertCategoryBudget(
  categoryId: string,
  limitAmount: number,
  weeklyLimitAmount?: number | null,
): Promise<void> {
  const db = await getDb();
  if (weeklyLimitAmount === undefined) {
    await db.runAsync(
      `INSERT INTO category_budgets (category_id, limit_amount, weekly_limit_amount)
       VALUES (?, ?, NULL)
       ON CONFLICT(category_id) DO UPDATE SET limit_amount = excluded.limit_amount`,
      [categoryId, limitAmount],
    );
    dataEvents.emit();
    return;
  }

  await db.runAsync(
    `INSERT INTO category_budgets (category_id, limit_amount, weekly_limit_amount)
     VALUES (?, ?, ?)
     ON CONFLICT(category_id) DO UPDATE SET
       limit_amount = excluded.limit_amount,
       weekly_limit_amount = excluded.weekly_limit_amount`,
    [categoryId, limitAmount, weeklyLimitAmount ?? null],
  );
  dataEvents.emit();
}

export async function deleteCategoryBudget(categoryId: string): Promise<void> {
  const trimmed = categoryId.trim();
  if (!trimmed) return;

  const db = await getDb();
  await db.runAsync('DELETE FROM category_budgets WHERE category_id = ?', [trimmed]);

  const transactionRefs =
    (await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?',
      [trimmed],
    ))?.count ?? 0;
  const recurringRefs =
    (await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM recurring_payments WHERE category_id = ?',
      [trimmed],
    ))?.count ?? 0;

  if (transactionRefs === 0 && recurringRefs === 0) {
    await db.runAsync('DELETE FROM categories WHERE id = ?', [trimmed]);
  }
  dataEvents.emit();
}

/** Raw row count in `transactions` (includes rows hidden from history by a missing category). */
export async function getTransactionCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions',
  );
  return row?.count ?? 0;
}

/** Rows returned by `getTransactions()` (requires a matching category JOIN). */
export async function getVisibleTransactionCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM transactions t
     INNER JOIN categories c ON c.id = t.category_id`,
  );
  return row?.count ?? 0;
}

/** True when Historique would be empty — gates demo transaction seeding. */
export async function isDatabaseEmpty(): Promise<boolean> {
  return (await getVisibleTransactionCount()) === 0;
}

/**
 * Rows with a category_id that no longer exists are invisible to getTransactions()
 * (INNER JOIN categories). Re-link them to the internal uncategorized placeholder.
 */
export async function repairOrphanTransactionCategories(uncategorizedCategoryId: string): Promise<number> {
  const trimmed = uncategorizedCategoryId.trim();
  if (!trimmed) return 0;

  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE transactions
     SET category_id = ?
     WHERE category_id NOT IN (SELECT id FROM categories)`,
    [trimmed],
  );
  const repaired = result.changes ?? 0;
  if (repaired > 0) {
    dataEvents.emit();
  }
  return repaired;
}

/** Local calendar month bounds (same convention as `getDashboard` month start). */
function calendarMonthBounds(year?: number, monthIndex0?: number): { startInclusiveIso: string; endExclusiveIso: string } {
  const ref = new Date();
  const y = year ?? ref.getFullYear();
  const m0 = monthIndex0 ?? ref.getMonth();
  const monthStart = new Date(y, m0, 1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(y, m0 + 1, 1);
  nextMonthStart.setHours(0, 0, 0, 0);
  return { startInclusiveIso: monthStart.toISOString(), endExclusiveIso: nextMonthStart.toISOString() };
}

export async function getTransactionsInDateRange(
  startInclusiveIso: string,
  endExclusiveIso: string,
): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.date >= ? AND t.date < ?
     ORDER BY datetime(t.date) DESC, t.id DESC`,
    [startInclusiveIso, endExclusiveIso],
  );
}

/** Lower-bound date filter — for sparklines / rolling windows (avoids full table scan). */
export async function getTransactionsSince(startInclusiveIso: string): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT t.id, t.label, t.amount, t.type, t.date, t.category_id AS categoryId,
            t.transaction_icon AS transactionIcon, t.receipt_uri AS receiptUri,
            t.receipt_status AS receiptStatus, t.note, t.sync_status AS syncStatus,
            t.wealth_asset_id AS wealthAssetId, t.savings_goal_id AS savingsGoalId,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.date >= ?
     ORDER BY datetime(t.date) DESC, t.id DESC`,
    [startInclusiveIso],
  );
}

/** Sums money in (income + transfer in) and money out (expenses + transfer out) per simulated account for the current calendar month. */
export async function getCurrentMonthAccountMoneyFlows(): Promise<Record<string, AccountMoneyFlow>> {
  const { startInclusiveIso, endExclusiveIso } = calendarMonthBounds();
  const txs = await getTransactionsInDateRange(startInclusiveIso, endExclusiveIso);
  return Object.fromEntries(accumulateAccountMoneyFlows(txs));
}

export async function getAccountMonthlyFlow(accountId: string, yearMonth: string): Promise<AccountMoneyFlow> {
  const trimmedId = accountId.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!trimmedId || !match) return { moneyIn: 0, moneyOut: 0 };
  const y = Number(match[1]);
  const mo = Number(match[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return { moneyIn: 0, moneyOut: 0 };
  const { startInclusiveIso, endExclusiveIso } = calendarMonthBounds(y, mo - 1);
  const txs = await getTransactionsInDateRange(startInclusiveIso, endExclusiveIso);
  return accumulateAccountMoneyFlows(txs).get(trimmedId) ?? { moneyIn: 0, moneyOut: 0 };
}

/**
 * Returns unique article names from all past transactions, ordered by most
 * recent occurrence. Used to power autocomplete suggestions in the article
 * add sheet.
 */
export async function getArticleNameHistory(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ note: string }>(
    `SELECT note FROM transactions WHERE note LIKE '%articles:%' ORDER BY datetime(date) DESC LIMIT 300`,
  );
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of rows) {
    for (const item of parseItemizedNote(row.note)) {
      const key = item.name.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        names.push(item.name.trim());
      }
    }
  }
  return names;
}
