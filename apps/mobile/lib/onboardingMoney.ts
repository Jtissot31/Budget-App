import { getColorForCategoryIndex } from '@/constants/budgetCategoryColors';
import {
  addCategory,
  getCategories,
  initializeCategories,
  updateCategoryLimit,
  updateCategoryName,
  type BudgetCategory,
} from '@/lib/budgetCategories';
import { canAddBudgetCategory } from '@/lib/budgetCategoryModel';
import { upsertCategory, upsertCategoryBudget } from '@/lib/db';
import {
  applyOnboardingPayEstimation,
  setPayAverageAmount,
  setPayEstimationFrequency,
  type OnboardingPayEstimationInput,
  type PayEstimationFrequency,
} from '@/lib/payEstimationSettings';

/** Taxonomy housing id — matches Budgets suggestions / average-user baseline. */
export const ONBOARDING_HOUSING_CATEGORY_ID = 'cat-home';
const DEMO_HOUSING_CATEGORY_ID = 'cat-budget-logement';
const HOUSING_DISPLAY_NAME = 'Logement';
const HOUSING_ICON = 'home-outline';

const HOUSING_NAME_RE = /logement|appartement|maison|loyer|\brent\b|hypotheque|hypothèque/i;

function isHousingCategory(category: BudgetCategory): boolean {
  return (
    category.id === ONBOARDING_HOUSING_CATEGORY_ID ||
    category.id === DEMO_HOUSING_CATEGORY_ID ||
    HOUSING_NAME_RE.test(category.name)
  );
}

/**
 * Create or update a Logement budget category with the monthly rent limit.
 * Prefers existing housing rows (incl. demo `cat-budget-logement`) over adding a duplicate.
 */
export async function ensureOnboardingHousingBudget(monthlyRent: number): Promise<boolean> {
  if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return false;

  await initializeCategories();
  const categories = await getCategories();
  const existing = categories.find(isHousingCategory);

  if (existing) {
    const name = HOUSING_NAME_RE.test(existing.name) ? existing.name : HOUSING_DISPLAY_NAME;
    await upsertCategory({
      id: existing.id,
      name,
      icon: existing.icon || HOUSING_ICON,
      color: existing.color,
    });
    await upsertCategoryBudget(existing.id, monthlyRent);
    await updateCategoryLimit(existing.id, monthlyRent);
    if (name !== existing.name) {
      await updateCategoryName(existing.id, name);
    }
    return true;
  }

  if (!canAddBudgetCategory(categories.length)) {
    console.warn('[onboardingMoney] housing budget skipped — at category capacity');
    return false;
  }

  const color = getColorForCategoryIndex(categories.length);
  const createdAt = new Date().toISOString();

  await upsertCategory({
    id: ONBOARDING_HOUSING_CATEGORY_ID,
    name: HOUSING_DISPLAY_NAME,
    icon: HOUSING_ICON,
    color,
  });
  await Promise.all([
    upsertCategoryBudget(ONBOARDING_HOUSING_CATEGORY_ID, monthlyRent),
    addCategory({
      id: ONBOARDING_HOUSING_CATEGORY_ID,
      name: HOUSING_DISPLAY_NAME,
      icon: HOUSING_ICON,
      color,
      limit: monthlyRent,
      spent: 0,
      period: 'monthly',
      created_by: 'user',
      createdAt,
    }),
  ]);
  return true;
}

export type OnboardingMoneyAnswers = {
  payFrequency: PayEstimationFrequency | null;
  lastPayday: string;
  averageSalary: number | null;
  monthlyRent: number | null;
};

/** Persist pay estimation + housing budget from onboarding answers (partial OK). */
export async function applyOnboardingMoneyAnswers(answers: OnboardingMoneyAnswers): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (answers.payFrequency && answers.lastPayday.trim()) {
    const input: OnboardingPayEstimationInput = {
      frequency: answers.payFrequency,
      lastDate: answers.lastPayday.trim(),
      averageAmount: answers.averageSalary,
    };
    tasks.push(applyOnboardingPayEstimation(input));
  } else {
    if (answers.payFrequency) {
      tasks.push(setPayEstimationFrequency(answers.payFrequency));
    }
    if (answers.averageSalary != null && answers.averageSalary > 0) {
      tasks.push(setPayAverageAmount(answers.averageSalary));
    }
  }

  if (answers.monthlyRent != null && answers.monthlyRent > 0) {
    tasks.push(ensureOnboardingHousingBudget(answers.monthlyRent));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}
