import { getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import {
  getCategoryBudgets,
  getDashboard,
  getLoans,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
} from '@/lib/db';
import { getCloudAccountConnected, getDisplayLanguage } from '@/lib/settings';
import type { AccountKind, Loan, LoanType, RecurringPayment, SimulatedAccount } from '@/types';

import type {
  DataMode,
  FinancialSummaryAnonymous,
  RfaAccount,
  RfaDebt,
  RfaGoal,
  RfaProfile,
  RfaSubscription,
  SupportedAiLanguage,
} from './types';

export const FIELDS_TO_REMOVE = [
  'userId',
  'email',
  'phone',
  'sin',
  'firstName',
  'lastName',
  'fullName',
  'address',
  'postalCode',
  'dateOfBirth',
  'accountNumber',
  'routingNumber',
  'deviceId',
  'ipAddress',
] as const;

type Sanitizable = Record<string, unknown>;

function isPlainObject(value: unknown): value is Sanitizable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strip personal identifiers before any AI API call. */
export function sanitizeForAI<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeForAI(item)) as T;
  }

  if (!isPlainObject(payload)) {
    return payload;
  }

  const sanitized: Sanitizable = {};
  for (const [key, value] of Object.entries(payload)) {
    if ((FIELDS_TO_REMOVE as readonly string[]).includes(key)) {
      continue;
    }
    sanitized[key] = sanitizeForAI(value);
  }
  return sanitized as T;
}

export async function resolveDataMode(): Promise<DataMode> {
  const connected = await getCloudAccountConnected();
  return connected ? 'plaid' : 'manual';
}

function mapDisplayLanguage(language: string): SupportedAiLanguage {
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('es')) return 'es';
  return 'fr';
}

function mapAccountKind(kind: AccountKind): RfaAccount['type'] {
  switch (kind) {
    case 'savings':
      return 'epargne';
    case 'credit':
      return 'credit';
    case 'cash':
    case 'checking':
    default:
      return 'cheque';
  }
}

function mapLoanType(type: LoanType): RfaDebt['type'] {
  switch (type) {
    case 'mortgage':
      return 'hypotheque';
    case 'line_of_credit':
      return 'marge';
    case 'personal_loan':
    case 'friend_debt':
    case 'child_support':
    default:
      return 'autre';
  }
}

function anonymizeAccount(account: SimulatedAccount): RfaAccount {
  const limiteCredit = account.creditLimit ?? 0;
  const solde = account.balance;
  const tauxUtilisation =
    account.kind === 'credit' && limiteCredit > 0
      ? Math.round((Math.max(0, -solde) / limiteCredit) * 100)
      : undefined;

  return {
    type: mapAccountKind(account.kind),
    institution: account.institution?.trim() || 'Institution',
    produit: account.name.trim() || 'Compte',
    solde,
    limiteCredit: limiteCredit > 0 ? limiteCredit : undefined,
    tauxUtilisation,
  };
}

function anonymizeLoan(loan: Loan, index: number): RfaDebt {
  return {
    type: mapLoanType(loan.type),
    institution: loan.lender.trim() || 'Prêteur',
    solde: loan.balanceRemaining,
    tauxInteret: loan.interestRate,
    paiementMinimum: loan.monthlyPayment,
    prioriteRemboursement: index + 1,
  };
}

function detectSubscriptions(payments: RecurringPayment[]): RfaSubscription[] {
  return payments
    .filter((payment) => payment.amount > 0)
    .slice(0, 12)
    .map((payment) => ({
      marchand: payment.name.trim() || 'Abonnement',
      montant: payment.amount,
      frequence:
        payment.frequency === 'yearly'
          ? 'annuel'
          : 'mensuel',
    }));
}

function detectProfile(
  monthlyIncome: number,
  monthlyExpenses: number,
  loans: Loan[],
): RfaProfile {
  const revenuMensuelNet = Math.max(0, monthlyIncome);
  const depensesMensuellesMoyennes = Math.max(0, monthlyExpenses);
  const tauxEpargneActuel =
    revenuMensuelNet > 0
      ? Math.round(((revenuMensuelNet - depensesMensuellesMoyennes) / revenuMensuelNet) * 100)
      : 0;

  let typeDetecte: RfaProfile['typeDetecte'] = 'inconnu';
  if (revenuMensuelNet > 0 && revenuMensuelNet < 1500) {
    typeDetecte = 'etudiant';
  } else if (revenuMensuelNet >= 1500 && revenuMensuelNet <= 4000) {
    typeDetecte = 'jeune_travailleur';
  } else if (loans.some((loan) => loan.type === 'mortgage')) {
    typeDetecte = 'famille';
  } else if (revenuMensuelNet === 0 && depensesMensuellesMoyennes > 0) {
    typeDetecte = 'retraite';
  }

  let situationGlobale: RfaProfile['situationGlobale'] = 'saine';
  if (tauxEpargneActuel < 0 || depensesMensuellesMoyennes > revenuMensuelNet * 1.05) {
    situationGlobale = 'critique';
  } else if (tauxEpargneActuel < 5) {
    situationGlobale = 'tendue';
  }

  return {
    typeDetecte,
    revenuMensuelNet,
    depensesMensuellesMoyennes,
    tauxEpargneActuel,
    situationGlobale,
  };
}

function buildGoals(): Promise<RfaGoal[]> {
  return getSavingsGoals().then((goals) =>
    goals.map((goal) => {
      const progression = goal.currentAmount;
      const cible = Math.max(goal.targetAmount, 1);
      return {
        nom: goal.name,
        cible: goal.targetAmount,
        progression,
        progressionPourcent: Math.min(100, Math.round((progression / cible) * 100)),
        contributionHebdo: goal.weeklyContribution,
      };
    }),
  );
}

export type RfaInputBundle = {
  dataMode: DataMode;
  langue: SupportedAiLanguage;
  dashboard: Awaited<ReturnType<typeof getDashboard>>;
  accounts: SimulatedAccount[];
  loans: Loan[];
  goals: RfaGoal[];
  budgets: Awaited<ReturnType<typeof getCategoryBudgets>>;
  subscriptions: RfaSubscription[];
};

/** Gather anonymized app data from SQLite stores for RFA generation. */
export async function buildRFAInputFromAppData(): Promise<RfaInputBundle> {
  const [dataMode, language, dashboard, accounts, loans, goals, budgets, recurring] =
    await Promise.all([
      resolveDataMode(),
      getDisplayLanguage(),
      getDashboard(),
      getSimulatedAccounts(),
      getLoans(),
      buildGoals(),
      getCategoryBudgets(),
      getRecurringPayments(),
    ]);

  const visibleAccounts = accounts.filter((account) => !account.hidden);

  return sanitizeForAI({
    dataMode,
    langue: mapDisplayLanguage(language),
    dashboard,
    accounts: visibleAccounts,
    loans,
    goals,
    budgets,
    subscriptions: detectSubscriptions(recurring),
  });
}

export function buildSanitizedPayloadForAI(input: RfaInputBundle): Record<string, unknown> {
  return sanitizeForAI({
    dataMode: input.dataMode,
    langue: input.langue,
    revenuMensuel: input.dashboard.monthlyIncome,
    depensesMensuelles: input.dashboard.monthlyExpenses,
    soldeNet: input.dashboard.balance,
    limiteBudgetMensuelle: input.dashboard.monthlyBudgetLimit,
    comptes: input.accounts.map(anonymizeAccount),
    dettes: [...input.loans]
      .sort((a, b) => b.interestRate - a.interestRate)
      .map(anonymizeLoan),
    objectifs: input.goals,
    budgets: input.budgets.map((budget) => ({
      categorie: budget.categoryName,
      limite: budget.limitAmount,
      depense: budget.spent,
    })),
    abonnements: input.subscriptions,
  });
}

export function buildHeuristicRFA(input: RfaInputBundle): FinancialSummaryAnonymous {
  const comptes = input.accounts.map(anonymizeAccount);
  const dettes = [...input.loans]
    .sort((a, b) => b.interestRate - a.interestRate)
    .map(anonymizeLoan);

  const profil = detectProfile(
    input.dashboard.monthlyIncome,
    input.dashboard.monthlyExpenses,
    input.loans,
  );

  const overBudgetCategories = input.budgets
    .filter((budget) => getCategoryBudgetUsage(budget.limitAmount, budget.spent).isOverBudget)
    .map((budget) => budget.categoryName);

  const totalDebt = dettes.reduce((sum, debt) => sum + debt.solde, 0);
  const totalCash = comptes
    .filter((account) => account.type !== 'credit')
    .reduce((sum, account) => sum + account.solde, 0);

  const manualNuance =
    input.dataMode === 'manual'
      ? ' Les montants proviennent de saisies manuelles et peuvent être incomplets.'
      : '';

  const analyse = [
    `Situation ${profil.situationGlobale} avec un revenu mensuel net estimé à ${profil.revenuMensuelNet.toFixed(0)} $`,
    `et des dépenses moyennes de ${profil.depensesMensuellesMoyennes.toFixed(0)} $.`,
    totalDebt > 0
      ? `Dettes actives totalisant ${totalDebt.toFixed(0)} $ — prioriser les soldes à taux élevé.`
      : 'Aucune dette enregistrée pour le moment.',
    totalCash > 0
      ? `Liquidités disponibles d’environ ${totalCash.toFixed(0)} $.`
      : 'Peu de liquidités enregistrées — vérifier le fonds d’urgence.',
    overBudgetCategories.length > 0
      ? `Budgets dépassés : ${overBudgetCategories.join(', ')}.`
      : 'Les budgets suivis sont dans les limites ce mois-ci.',
    manualNuance,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    generatedAt: new Date().toISOString(),
    dataMode: input.dataMode,
    langue: input.langue,
    profil,
    comptes,
    dettes,
    abonnementsDetectes: input.subscriptions,
    objectifsActifs: input.goals,
    plansFinanciersActifs: [],
    alertesActives: [],
    analyse: analyse.trim(),
  };
}
