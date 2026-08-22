import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { inferRecurringAddVariant } from '@/lib/recurringPaymentsForm';
import type { RecurringPayment, RecurringPaymentFrequency } from '@/types';

/** Categories that typically hold consumer subscriptions (streaming, telecom, gym). */
const SUBSCRIPTION_CATEGORY_IDS = new Set(['cat-fun', 'cat-phone', 'cat-sports']);

/**
 * Well-known subscription merchants — catches digital services even when
 * category is missing or mis-tagged (e.g. iCloud under phone).
 */
const KNOWN_SUBSCRIPTION_NAME =
  /\b(netflix|disney\+?|spotify|youtube|apple\s*music|icloud|amazon\s*prime|prime\s*video|crave|paramount|hbo|max\b|apple\s*tv|microsoft\s*365|office\s*365|adobe|dropbox|notion|chatgpt|openai|github|cursor|figma|canva|econofitness|goodlife|orange\s*th[eé]orie)\b/i;

export function monthlyRecurringEquivalent(
  amount: number,
  frequency: RecurringPaymentFrequency,
): number {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'biweekly':
      return (amount * 26) / 12;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

export function isSubscriptionLikePayment(
  payment: RecurringPayment,
  loanRecurringIds?: ReadonlySet<string>,
): boolean {
  if (!payment.active) return false;
  if ((payment.kind ?? 'payment') === 'income') return false;
  if (loanRecurringIds?.has(payment.id)) return false;
  if (inferRecurringAddVariant(payment) === 'subscription') return true;
  if (payment.categoryId && SUBSCRIPTION_CATEGORY_IDS.has(payment.categoryId)) return true;
  return KNOWN_SUBSCRIPTION_NAME.test(payment.name.trim());
}

export type SubscriptionListItem = {
  payment: RecurringPayment;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
};

export type SubscriptionCategoryBreakdown = {
  categoryId: string | null;
  categoryName: string;
  count: number;
  monthlyTotal: number;
};

export type SubscriptionAnalysis = {
  items: SubscriptionListItem[];
  count: number;
  monthlyTotal: number;
  yearlyTotal: number;
  topCategories: SubscriptionCategoryBreakdown[];
  insights: string[];
};

function categoryLabel(payment: RecurringPayment): string {
  const name = payment.categoryName?.trim();
  if (name) return name;
  if (payment.categoryId === 'cat-fun') return 'Loisirs';
  if (payment.categoryId === 'cat-phone') return 'Télécom & cloud';
  if (payment.categoryId === 'cat-sports') return 'Sport';
  return 'Autres';
}

function buildInsights(items: SubscriptionListItem[], monthlyTotal: number): string[] {
  if (items.length === 0) {
    return [
      'Aucun abonnement détecté pour le moment. Ajoute-en depuis l’Agenda pour suivre leur coût.',
    ];
  }

  const insights: string[] = [];
  const mostExpensive = items[0]!;
  insights.push(
    `${items.length} abonnement${items.length > 1 ? 's' : ''} actif${items.length > 1 ? 's' : ''} — environ ${formatInsightMoney(monthlyTotal)} / mois.`,
  );
  insights.push(
    `${mostExpensive.payment.name} est le plus coûteux (${formatInsightMoney(mostExpensive.monthlyEquivalent)} / mois).`,
  );

  if (items.length >= 3) {
    const topThree = items.slice(0, 3).reduce((sum, item) => sum + item.monthlyEquivalent, 0);
    const share = monthlyTotal > 0 ? Math.round((topThree / monthlyTotal) * 100) : 0;
    insights.push(
      `Les 3 plus chers représentent ${share} % du total — une revue ciblée libère souvent du budget.`,
    );
  } else if (monthlyTotal >= 50) {
    insights.push(
      'Une revue trimestrielle des services peu utilisés peut facilement économiser 20–50 $ / mois.',
    );
  }

  return insights;
}

function formatInsightMoney(value: number): string {
  return formatDisplayMoneyAbsolute(value);
}

export function analyzeSubscriptions(
  payments: readonly RecurringPayment[],
  loanRecurringIds?: ReadonlySet<string>,
): SubscriptionAnalysis {
  const items: SubscriptionListItem[] = payments
    .filter((payment) => isSubscriptionLikePayment(payment, loanRecurringIds))
    .map((payment) => {
      const monthly = monthlyRecurringEquivalent(payment.amount, payment.frequency);
      return {
        payment,
        monthlyEquivalent: monthly,
        yearlyEquivalent: monthly * 12,
      };
    })
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

  const monthlyTotal = items.reduce((sum, item) => sum + item.monthlyEquivalent, 0);
  const yearlyTotal = monthlyTotal * 12;

  const byCategory = new Map<string, SubscriptionCategoryBreakdown>();
  for (const item of items) {
    const key = item.payment.categoryId ?? categoryLabel(item.payment);
    const existing = byCategory.get(key);
    if (existing) {
      existing.count += 1;
      existing.monthlyTotal += item.monthlyEquivalent;
    } else {
      byCategory.set(key, {
        categoryId: item.payment.categoryId ?? null,
        categoryName: categoryLabel(item.payment),
        count: 1,
        monthlyTotal: item.monthlyEquivalent,
      });
    }
  }

  const topCategories = [...byCategory.values()]
    .sort((a, b) => b.monthlyTotal - a.monthlyTotal)
    .slice(0, 4);

  return {
    items,
    count: items.length,
    monthlyTotal,
    yearlyTotal,
    topCategories,
    insights: buildInsights(items, monthlyTotal),
  };
}
