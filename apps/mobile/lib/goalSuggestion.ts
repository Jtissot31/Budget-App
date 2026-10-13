/**
 * Copilote — suggests the *next* savings goal that fits this user, based on what they already
 * have (never a second emergency fund) and their real numbers. Pure: no I/O.
 *
 * Priority (first gap wins):
 *   1. Emergency fund (3 months of expenses) — the foundation, if missing.
 *   2. Emergency fund top-up — if one exists but covers < 3 months of expenses.
 *   3. Annual bills cushion — when subscriptions are significant (≈ one year of them).
 *   4. Vacation fund.
 *   5. Long-term investing (CELI / REER) — ~10 % of yearly income.
 */

export type GoalSuggestion = {
  id: string;
  name: string;
  /** Ionicons glyph used by the goal form. */
  icon: string;
  targetAmount: number;
  /** Suggested monthly contribution to reach the target in `months`. */
  monthly: number;
  months: number;
  /** One short sentence: why this goal, for this user. */
  reason: string;
};

export type GoalSuggestionInput = {
  monthlyIncome: number;
  monthlyExpenses: number;
  subscriptionsMonthly: number;
  goals: readonly { name: string; saved: number; target: number }[];
};

const EMERGENCY_RE = /urgence|emergency|impr[ée]vu|coussin|s[ée]curit[ée]/i;
const TRAVEL_RE = /voyage|vacance|trip|travel/i;
const INVEST_RE = /celi|reer|tfsa|rrsp|retraite|placement|invest/i;
const BILLS_RE = /facture|abonnement|annuel/i;

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

function plan(target: number, months: number): { monthly: number; months: number } {
  return { monthly: Math.ceil(target / months / 5) * 5, months };
}

export function suggestNextGoal(input: GoalSuggestionInput): GoalSuggestion | null {
  const has = (re: RegExp) => input.goals.find((g) => re.test(g.name));
  // Fall back to a modest baseline when spending data is thin.
  const expenses = input.monthlyExpenses > 0 ? input.monthlyExpenses : 1500;

  const emergency = has(EMERGENCY_RE);
  const emergencyTarget = roundTo(expenses * 3, 500);
  if (!emergency) {
    return {
      id: 'emergency',
      name: 'Fonds d’urgence',
      icon: 'shield-checkmark-outline',
      targetAmount: emergencyTarget,
      ...plan(emergencyTarget, 12),
      reason: '3 mois de dépenses de côté : la base pour dormir tranquille.',
    };
  }
  if (emergency.target < expenses * 3 * 0.8) {
    const topUp = roundTo(expenses * 3 - emergency.target, 250);
    return {
      id: 'emergency-top-up',
      name: 'Compléter le fonds d’urgence',
      icon: 'shield-checkmark-outline',
      targetAmount: topUp,
      ...plan(topUp, 10),
      reason: `Ton fonds couvre moins de 3 mois de dépenses — il manque environ ${topUp} $.`,
    };
  }

  if (input.subscriptionsMonthly >= 60 && !has(BILLS_RE)) {
    const target = roundTo(input.subscriptionsMonthly * 12, 100);
    return {
      id: 'bills-cushion',
      name: 'Coussin factures annuelles',
      icon: 'receipt-outline',
      targetAmount: target,
      ...plan(target, 12),
      reason: 'Un an d’abonnements d’avance : plus jamais de mauvaise surprise.',
    };
  }

  if (!has(TRAVEL_RE)) {
    return {
      id: 'travel',
      name: 'Vacances',
      icon: 'airplane-outline',
      targetAmount: 1500,
      ...plan(1500, 10),
      reason: 'Ton coussin est solide — place à un objectif qui fait plaisir.',
    };
  }

  if (!has(INVEST_RE) && input.monthlyIncome > 0) {
    const target = roundTo(input.monthlyIncome * 12 * 0.1, 500);
    return {
      id: 'invest',
      name: 'CELI / placements',
      icon: 'trending-up-outline',
      targetAmount: target,
      ...plan(target, 12),
      reason: 'Investir 10 % de tes revenus fait travailler ton argent à long terme.',
    };
  }

  return null;
}
