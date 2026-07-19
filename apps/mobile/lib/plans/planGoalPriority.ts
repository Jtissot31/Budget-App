/**
 * Pure priority for which plan goal Fyn suggests first.
 * Kept free of DB / RFA I/O so unit tests stay Node-friendly.
 */

export type PlanGoalPriorityInput = {
  cashflowViableForDebtExtra: boolean;
  surplusMensuel: number;
  dettesAccelerablesCount: number;
  detteTotale: number;
  couvertureMois: number;
  nombreAbonnements: number;
  droitsCeli: number;
  droitsReer: number;
  contexteDetteLourde: boolean;
  singleDebtLabel?: string;
};

export type PlanGoalPriorityResult = {
  suggested:
    | 'budget_rebalance'
    | 'debt_repayment'
    | 'reduce_bills'
    | 'emergency_fund'
    | 'savings_investment';
  reason: string;
};

function formatSurplusFr(surplus: number): string {
  const abs = Math.round(Math.abs(surplus)).toLocaleString('fr-CA');
  if (surplus < 0) return `−${abs}`;
  if (surplus > 0) return `+${abs}`;
  return '0';
}

export function buildNegativeCashflowBudgetReason(surplusMensuel: number): string {
  return `tes dépenses dépassent ou serrent tes revenus (surplus d’environ ${formatSurplusFr(surplusMensuel)} $/mois) — sans marge, un plan de remboursement accéléré n’est pas réaliste pour l’instant`;
}

/**
 * When cashflow cannot fund a small debt extra, budget comes before snowball/avalanche.
 */
export function resolveSuggestedPlanGoal(input: PlanGoalPriorityInput): PlanGoalPriorityResult {
  if (!input.cashflowViableForDebtExtra) {
    return {
      suggested: 'budget_rebalance',
      reason: buildNegativeCashflowBudgetReason(input.surplusMensuel),
    };
  }

  if (input.contexteDetteLourde || input.dettesAccelerablesCount >= 2) {
    return {
      suggested: 'debt_repayment',
      reason: `tu as ${input.dettesAccelerablesCount} dettes actives (${Math.round(input.detteTotale).toLocaleString('fr-CA')} $ au total) — les rembourser en priorité libère du cashflow.`,
    };
  }

  if (input.dettesAccelerablesCount === 1) {
    const label = input.singleDebtLabel ?? 'Cette dette';
    return {
      suggested: 'debt_repayment',
      reason: `${label} affiche encore ${Math.round(input.detteTotale).toLocaleString('fr-CA')} $ — un plan ciblé accélère le remboursement.`,
    };
  }

  if (input.couvertureMois < 3) {
    return {
      suggested: 'emergency_fund',
      reason: `tu as environ ${input.couvertureMois.toFixed(1).replace('.', ',')} mois de dépenses en liquidités — un coussin d'urgence te protège sans recourir au crédit.`,
    };
  }

  if (input.nombreAbonnements >= 5) {
    return {
      suggested: 'reduce_bills',
      reason: `${input.nombreAbonnements} abonnements détectés — une revue ciblée libère souvent du budget chaque mois.`,
    };
  }

  if (input.droitsCeli > 0 || input.droitsReer > 0) {
    return {
      suggested: 'savings_investment',
      reason: "tu as de l'espace de cotisation disponible — structurer l'épargne t'aide à avancer plus vite.",
    };
  }

  return {
    suggested: 'emergency_fund',
    reason: 'un fonds de secours te donne de la marge de manœuvre avant tout le reste.',
  };
}
