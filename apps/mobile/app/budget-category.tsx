/**
 * Direct entry to a budget category's detail — opens the detail sheet over the
 * current screen (alerts, Copilote, Accueil…) without passing through the Budget tab.
 *
 * `/budget-category?id=<categoryId>` or `?name=<category name>` (alerts only know the name).
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BudgetCategoryDetailSheet } from '@/components/budget/BudgetCategoryDetailSheet';
import { getCategoriesForMonth, initializeCategories } from '@/lib/budgetCategories';
import { mapBudgetCategoriesToUi, type BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { startOfMonth } from '@/lib/budgetMonth';
import { dataEvents } from '@/lib/events';
import { ensureDbReady } from '@/lib/init';

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export default function BudgetCategoryRoute() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const [month] = useState(() => startOfMonth(new Date()));
  const [category, setCategory] = useState<BudgetCategoryUiModel | null>(null);
  const [visible, setVisible] = useState(true);

  const close = useCallback(() => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/budgets');
  }, [router]);

  const load = useCallback(async () => {
    await ensureDbReady();
    await initializeCategories();
    const categories = mapBudgetCategoriesToUi(await getCategoriesForMonth(month));
    const wanted = name ? normalizeName(name) : '';
    const match =
      categories.find((c) => id && c.id === id) ??
      categories.find((c) => wanted && normalizeName(c.name) === wanted) ??
      null;
    if (!match) {
      // Unknown category: fall back to the Budget tab instead of an empty sheet.
      router.replace('/budgets');
      return;
    }
    setCategory(match);
  }, [id, month, name, router]);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => void load());
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <BudgetCategoryDetailSheet
        category={category}
        visible={visible && category != null}
        onClose={close}
        onSaved={() => void load()}
        displayMonth={month}
        isCurrentMonth
      />
    </View>
  );
}
