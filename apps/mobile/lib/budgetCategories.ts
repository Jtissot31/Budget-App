import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategoryBudgets, getCategorySpentForMonth } from '@/lib/db';
import { isSameMonth } from '@/lib/budgetMonth';
import { getMockBudgetSnapshotForMonth } from '@/lib/budgetMonthMock';

export type BudgetCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
  spent: number;
  period: 'monthly';
  created_by: 'user' | 'fyn';
  createdAt: string;
};

const STORAGE_KEY = 'budget_tracker_categories';
const MOCK_VERSION = '2';
const VERSION_KEY = 'budget_tracker_categories_version';

/** Green-toned palette — one unique color per mock category (shuffled). */
const MOCK_CATEGORY_COLORS = [
  '#4ADE80',
  '#14532D',
  '#22C55E',
  '#3A4A40',
  '#16A34A',
  '#2A3530',
  '#15803D',
  '#4A5D52',
  '#166534',
] as const;

type MockCategoryDef = {
  id: string;
  name: string;
  icon: string;
  limit: number;
  spent: number;
};

/** Lucide icon names (PascalCase) — baseline mock budget categories. */
const MOCK_CATEGORY_DEFS: MockCategoryDef[] = [
  { id: 'cat-budget-logement', name: 'Logement', icon: 'House', limit: 1200, spent: 1200 },
  { id: 'cat-budget-epicerie', name: 'Épicerie', icon: 'ShoppingBag', limit: 400, spent: 320 },
  { id: 'cat-budget-transport', name: 'Transport', icon: 'Car', limit: 300, spent: 245 },
  { id: 'cat-budget-telephone', name: 'Téléphone', icon: 'Smartphone', limit: 100, spent: 100 },
  { id: 'cat-budget-restaurants', name: 'Restaurants', icon: 'Utensils', limit: 200, spent: 158 },
  { id: 'cat-budget-loisirs', name: 'Loisirs', icon: 'Gamepad2', limit: 150, spent: 87 },
  { id: 'cat-budget-vetements', name: 'Vêtements', icon: 'Shirt', limit: 100, spent: 45 },
  { id: 'cat-budget-sante', name: 'Santé', icon: 'HeartPulse', limit: 100, spent: 30 },
  { id: 'cat-budget-depenses-inutiles', name: 'Dépenses inutiles', icon: 'CircleAlert', limit: 150, spent: 95 },
];

export const MOCK_BUDGET_CATEGORIES: BudgetCategory[] = MOCK_CATEGORY_DEFS.map((def, index) => ({
  ...def,
  color: MOCK_CATEGORY_COLORS[index] ?? MOCK_CATEGORY_COLORS[0],
  period: 'monthly' as const,
  created_by: 'fyn' as const,
  createdAt: '2026-06-26T00:00:00.000Z',
}));

function buildBaselineCategories(): BudgetCategory[] {
  return MOCK_BUDGET_CATEGORIES.map((category) => ({ ...category }));
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
    typeof entry.color === 'string' &&
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
        color: fromDb.categoryColor?.trim() || category.color,
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
    const version = await AsyncStorage.getItem(VERSION_KEY);
    if (version === MOCK_VERSION) return;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buildBaselineCategories()));
    await AsyncStorage.setItem(VERSION_KEY, MOCK_VERSION);
  } catch (error) {
    console.warn('[budgetCategories] initializeCategories failed', error);
  }
}

export async function getCategories(): Promise<BudgetCategory[]> {
  try {
    const stored = await readStoredCategories();
    if (stored.length > 0) return stored;
    return buildBaselineCategories();
  } catch (error) {
    console.warn('[budgetCategories] getCategories failed', error);
    return buildBaselineCategories();
  }
}

function applyMonthSnapshot(
  categories: BudgetCategory[],
  snapshot: NonNullable<ReturnType<typeof getMockBudgetSnapshotForMonth>>,
): BudgetCategory[] {
  return categories.map((category) => {
    const entry = snapshot.categories[category.id];
    if (!entry) return category;
    return { ...category, limit: entry.limit, spent: entry.spent };
  });
}

/** Categories with spent totals for the given calendar month (SQLite transactions when available). */
export async function getCategoriesForMonth(monthDate: Date): Promise<BudgetCategory[]> {
  const categories = await getCategories();
  const viewingCurrentMonth = isSameMonth(monthDate, new Date());
  const mockSnapshot = getMockBudgetSnapshotForMonth(monthDate);

  if (mockSnapshot) {
    return applyMonthSnapshot(categories, mockSnapshot);
  }

  try {
    const spentByCategory = await getCategorySpentForMonth(monthDate);
    if (spentByCategory.size === 0 && viewingCurrentMonth) {
      return categories;
    }

    return categories.map((category) => {
      const fromDb = spentByCategory.get(category.id);
      if (fromDb !== undefined) {
        return { ...category, spent: fromDb };
      }
      if (viewingCurrentMonth) return category;
      return { ...category, spent: 0 };
    });
  } catch (error) {
    console.warn('[budgetCategories] getCategoriesForMonth failed', error);
    return categories;
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
        color: fromDb.categoryColor?.trim() || category.color,
      };
    });

    if (changed) {
      await saveCategories(next);
    }
  } catch (error) {
    console.warn('[budgetCategories] syncSpentFromDatabase failed', error);
  }
}
