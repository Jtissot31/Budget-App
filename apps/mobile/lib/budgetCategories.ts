import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVERAGE_USER_BUDGET_PRESETS } from '@/constants/categoryOptions';
import { getCategoryBudgets } from '@/lib/db';

export type BudgetCategory = {
  id: string;
  name: string;
  icon: string;
  limit: number;
  spent: number;
  period: 'monthly';
  created_by: 'user' | 'fyn';
  createdAt: string;
};

const STORAGE_KEY = 'budget_tracker_categories';
const INITIALIZED_KEY = 'budget_tracker_categories_initialized';

function buildBaselineCategories(): BudgetCategory[] {
  const createdAt = new Date().toISOString();
  return AVERAGE_USER_BUDGET_PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    icon: preset.icon,
    limit: preset.defaultLimit,
    spent: 0,
    period: 'monthly' as const,
    created_by: 'fyn' as const,
    createdAt,
  }));
}

async function readStoredCategories(): Promise<BudgetCategory[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBudgetCategory);
  } catch {
    return [];
  }
}

function isBudgetCategory(value: unknown): value is BudgetCategory {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<BudgetCategory>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.icon === 'string' &&
    typeof entry.limit === 'number' &&
    typeof entry.spent === 'number' &&
    entry.period === 'monthly' &&
    (entry.created_by === 'user' || entry.created_by === 'fyn') &&
    typeof entry.createdAt === 'string'
  );
}

async function enrichFromDatabase(categories: BudgetCategory[]): Promise<BudgetCategory[]> {
  try {
    const sqliteBudgets = await getCategoryBudgets();
    if (sqliteBudgets.length === 0) return categories;

    const byId = new Map(sqliteBudgets.map((budget) => [budget.categoryId, budget]));
    return categories.map((category) => {
      const fromDb = byId.get(category.id);
      if (!fromDb) return category;
      return {
        ...category,
        name: fromDb.categoryName || category.name,
        icon: fromDb.categoryIcon || category.icon,
        limit: fromDb.limitAmount,
        spent: fromDb.spent,
      };
    });
  } catch {
    return categories;
  }
}

export async function initializeCategories(): Promise<void> {
  try {
    const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
    if (initialized === '1') return;

    const categories = await enrichFromDatabase(buildBaselineCategories());
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    await AsyncStorage.setItem(INITIALIZED_KEY, '1');
  } catch (error) {
    console.warn('[budgetCategories] initializeCategories failed', error);
  }
}

export async function getCategories(): Promise<BudgetCategory[]> {
  try {
    return await readStoredCategories();
  } catch (error) {
    console.warn('[budgetCategories] getCategories failed', error);
    return [];
  }
}

export async function saveCategories(categories: BudgetCategory[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (error) {
    console.warn('[budgetCategories] saveCategories failed', error);
  }
}

export async function addCategory(category: BudgetCategory): Promise<void> {
  try {
    const categories = await readStoredCategories();
    const next = [...categories.filter((entry) => entry.id !== category.id), category];
    await saveCategories(next);
  } catch (error) {
    console.warn('[budgetCategories] addCategory failed', error);
  }
}

export async function updateCategoryLimit(id: string, limit: number): Promise<void> {
  try {
    const categories = await readStoredCategories();
    const next = categories.map((category) =>
      category.id === id ? { ...category, limit } : category,
    );
    await saveCategories(next);
  } catch (error) {
    console.warn('[budgetCategories] updateCategoryLimit failed', error);
  }
}

export async function updateCategorySpent(id: string, spent: number): Promise<void> {
  try {
    const categories = await readStoredCategories();
    const next = categories.map((category) =>
      category.id === id ? { ...category, spent } : category,
    );
    await saveCategories(next);
  } catch (error) {
    console.warn('[budgetCategories] updateCategorySpent failed', error);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    const categories = await readStoredCategories();
    await saveCategories(categories.filter((category) => category.id !== id));
  } catch (error) {
    console.warn('[budgetCategories] deleteCategory failed', error);
  }
}

export async function resetMonthlySpent(): Promise<void> {
  try {
    const categories = await readStoredCategories();
    await saveCategories(categories.map((category) => ({ ...category, spent: 0 })));
  } catch (error) {
    console.warn('[budgetCategories] resetMonthlySpent failed', error);
  }
}

/** Keeps AsyncStorage spent/limit aligned with SQLite transaction totals. */
export async function syncSpentFromDatabase(): Promise<void> {
  try {
    const categories = await readStoredCategories();
    if (categories.length === 0) return;

    const sqliteBudgets = await getCategoryBudgets();
    const byId = new Map(sqliteBudgets.map((budget) => [budget.categoryId, budget]));
    let changed = false;

    const next = categories.map((category) => {
      const fromDb = byId.get(category.id);
      if (!fromDb) return category;
      if (fromDb.spent === category.spent && fromDb.limitAmount === category.limit) {
        return category;
      }
      changed = true;
      return {
        ...category,
        spent: fromDb.spent,
        limit: fromDb.limitAmount,
        name: fromDb.categoryName || category.name,
        icon: fromDb.categoryIcon || category.icon,
      };
    });

    if (changed) {
      await saveCategories(next);
    }
  } catch (error) {
    console.warn('[budgetCategories] syncSpentFromDatabase failed', error);
  }
}
