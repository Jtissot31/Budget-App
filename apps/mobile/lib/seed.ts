import { BUDGET_PRESETS, DEFAULT_CATEGORIES } from '@/constants/categoryOptions';
import { upsertCategory, upsertCategoryBudget, insertTransaction, setSetting } from './db';

export async function seedDatabase(): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await upsertCategory(c);
  }

  for (const preset of BUDGET_PRESETS) {
    await upsertCategoryBudget(preset.id, preset.defaultLimit);
  }
  await setSetting(
    'monthly_budget_limit',
    String(BUDGET_PRESETS.reduce((sum, preset) => sum + preset.defaultLimit, 0)),
  );

  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  const samples = [
    {
      id: 'tx-1',
      label: 'Courses Carrefour',
      amount: 87.42,
      type: 'expense' as const,
      date: daysAgo(1),
      categoryId: 'cat-food',
    },
    {
      id: 'tx-2',
      label: 'Salaire',
      amount: 2450,
      type: 'income' as const,
      date: daysAgo(3),
      categoryId: 'cat-income',
    },
    {
      id: 'tx-3',
      label: 'Netflix',
      amount: 15.99,
      type: 'expense' as const,
      date: daysAgo(5),
      categoryId: 'cat-fun',
    },
    {
      id: 'tx-4',
      label: 'Essence',
      amount: 62.3,
      type: 'expense' as const,
      date: daysAgo(6),
      categoryId: 'cat-transport',
    },
    {
      id: 'tx-5',
      label: 'Restaurant',
      amount: 48.5,
      type: 'expense' as const,
      date: daysAgo(8),
      categoryId: 'cat-rest',
    },
  ];

  for (const s of samples) {
    await insertTransaction({ ...s, syncStatus: 'synced' });
  }
}
