/**
 * Copilote — turns the user's data into a few short, actionable tips
 * (cash for upcoming bills, budget pace, category at risk, savings rate,
 * subscriptions, nearest goal). Pure: no I/O, easy to test.
 */
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

export type CopilotTone = 'risk' | 'warn' | 'info' | 'good';

export type CopilotRoute = string | { pathname: string; params: Record<string, string> };

export type CopilotInsight = {
  id: string;
  tone: CopilotTone;
  /** Ionicons glyph name. */
  icon: string;
  title: string;
  detail: string;
  /** Where the row leads — the exact detail page when there is one. */
  route?: CopilotRoute;
};

export type CopilotInput = {
  now: Date;
  /** Liquid cash (chèque, épargne, comptant), visible accounts only. */
  liquidCash: number;
  /** Upcoming money-out, soonest first. */
  upcoming: readonly { dateKey: string; amount: number }[];
  categories: readonly BudgetCategoryUiModel[];
  monthlyIncome: number;
  monthlyExpenses: number;
  subscriptionsMonthly: number;
  subscriptionsCount: number;
  goals: readonly { id: string; name: string; saved: number; target: number }[];
};

const TONE_ORDER: Record<CopilotTone, number> = { risk: 0, warn: 1, info: 2, good: 3 };
const money = formatDisplayMoneyAbsolute;

function daysBetween(from: Date, dateKey: string): number {
  const due = new Date(`${dateKey}T12:00:00`);
  const start = new Date(from);
  start.setHours(12, 0, 0, 0);
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

export function buildCopilotInsights(input: CopilotInput): CopilotInsight[] {
  const insights: CopilotInsight[] = [];
  const { now } = input;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = now.getDate() / lastDay;
  const daysLeft = Math.max(1, lastDay - now.getDate() + 1);

  // 1. Can the next 7 days of bills be paid?
  const dueWeek = input.upcoming
    .filter((row) => daysBetween(now, row.dateKey) <= 7)
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
  if (dueWeek > 0) {
    if (input.liquidCash < dueWeek) {
      insights.push({
        id: 'cash-week',
        tone: 'risk',
        icon: 'alert-circle-outline',
        title: 'Solde trop bas pour la semaine',
        detail: `${money(dueWeek)} à payer d’ici 7 jours, ${money(Math.max(0, input.liquidCash))} disponibles.`,
        route: '/goals',
      });
    } else {
      insights.push({
        id: 'cash-week',
        tone: 'good',
        icon: 'shield-checkmark-outline',
        title: 'Paiements de la semaine couverts',
        detail: `${money(dueWeek)} à payer d’ici 7 jours — il te restera ${money(input.liquidCash - dueWeek)}.`,
        route: '/goals',
      });
    }
  }

  // 2. Budget pace for the month.
  const limit = input.categories.reduce((sum, c) => sum + Math.max(0, c.limit), 0);
  const spent = input.categories.reduce((sum, c) => sum + Math.max(0, c.spent), 0);
  if (limit > 0) {
    const used = spent / limit;
    const remaining = limit - spent;
    if (remaining < 0) {
      insights.push({
        id: 'pace',
        tone: 'risk',
        icon: 'trending-up-outline',
        title: `Budget dépassé de ${money(-remaining)}`,
        detail: 'Limite les dépenses non essentielles jusqu’à la fin du mois.',
        route: '/budgets',
      });
    } else if (used > monthProgress + 0.1) {
      insights.push({
        id: 'pace',
        tone: 'warn',
        icon: 'speedometer-outline',
        title: 'Tu dépenses plus vite que prévu',
        detail: `${Math.round(used * 100)} % du budget utilisé à ${Math.round(monthProgress * 100)} % du mois. Vise ${money(remaining / daysLeft)} par jour.`,
        route: '/budgets',
      });
    } else {
      insights.push({
        id: 'pace',
        tone: 'good',
        icon: 'speedometer-outline',
        title: 'Bon rythme ce mois-ci',
        detail: `Tu peux dépenser ${money(remaining / daysLeft)} par jour et finir dans le vert.`,
        route: '/budgets',
      });
    }
  }

  // 3. Category most at risk (already over, or half used and on pace to go over).
  const pace = Math.max(monthProgress, 0.1);
  const atRisk = input.categories
    .filter((c) => c.limit > 0 && c.spent > 0)
    .map((c) => ({ c, projected: c.spent / pace }))
    .filter(
      ({ c, projected }) =>
        c.spent > c.limit || (c.spent < c.limit && c.spent >= c.limit * 0.5 && projected > c.limit * 1.05),
    )
    .sort((a, b) => b.projected / b.c.limit - a.projected / a.c.limit)[0];
  if (atRisk) {
    const over = atRisk.c.spent > atRisk.c.limit;
    insights.push({
      id: `category-${atRisk.c.id}`,
      tone: over ? 'risk' : 'warn',
      icon: 'pie-chart-outline',
      route: { pathname: '/budget-category', params: { id: atRisk.c.id } },
      title: over ? `${atRisk.c.name} : budget dépassé` : `${atRisk.c.name} : risque de dépassement`,
      detail: over
        ? `${money(atRisk.c.spent - atRisk.c.limit)} au-dessus des ${money(atRisk.c.limit)} prévus.`
        : `À ce rythme : ${money(atRisk.projected)} pour ${money(atRisk.c.limit)} prévus.`,
    });
  }

  // 4. Savings rate.
  if (input.monthlyIncome > 0) {
    const rate = (input.monthlyIncome - input.monthlyExpenses) / input.monthlyIncome;
    if (rate < 0.1) {
      insights.push({
        id: 'savings-rate',
        tone: rate < 0 ? 'warn' : 'info',
        icon: 'leaf-outline',
        title: `Taux d’épargne : ${Math.round(rate * 100)} %`,
        detail: 'Vise 10 à 20 % de tes revenus. Un versement automatique vers un objectif aide.',
        route: '/transactions-insights',
      });
    } else {
      insights.push({
        id: 'savings-rate',
        tone: 'good',
        icon: 'leaf-outline',
        title: `Tu épargnes ${Math.round(rate * 100)} % de tes revenus`,
        detail: rate >= 0.2 ? 'Excellent rythme — continue comme ça.' : 'Bien. 20 % accélérerait tes objectifs.',
        route: '/transactions-insights',
      });
    }
  }

  // 5. Subscriptions.
  if (input.subscriptionsCount > 0 && input.subscriptionsMonthly > 0) {
    insights.push({
      id: 'subscriptions',
      tone: 'info',
      icon: 'repeat',
      title: `${input.subscriptionsCount} abonnements · ${money(input.subscriptionsMonthly)}/mois`,
      detail: `${money(input.subscriptionsMonthly * 12)} par année. Vérifie ceux que tu n’utilises plus.`,
      route: '/subscriptions-insights',
    });
  }

  // 6. Nearest goal.
  const goal = input.goals
    .filter((g) => g.target > 0 && g.saved < g.target)
    .sort((a, b) => b.saved / b.target - a.saved / a.target)[0];
  if (goal) {
    insights.push({
      id: 'goal',
      tone: 'info',
      icon: 'flag-outline',
      title: `Plus que ${money(goal.target - goal.saved)} pour ${goal.name}`,
      detail: `${Math.round((goal.saved / goal.target) * 100)} % atteint.`,
      route: { pathname: '/goal-detail', params: { goalId: goal.id } },
    });
  }

  return insights.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** One-line status for the Copilote header. */
export function copilotHeadline(insights: readonly CopilotInsight[]): { title: string; tone: CopilotTone } {
  const risks = insights.filter((i) => i.tone === 'risk').length;
  const warns = insights.filter((i) => i.tone === 'warn').length;
  if (risks > 0) return { title: `${risks} urgent${risks > 1 ? 's' : ''}`, tone: 'risk' };
  if (warns > 0) return { title: `${warns} à surveiller`, tone: 'warn' };
  return { title: 'Tout roule', tone: 'good' };
}
