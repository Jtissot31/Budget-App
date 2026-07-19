export type {
  Plan,
  PlanActifOuTermine,
  PlanBase,
  PlanCategory,
  PlanDebtFeasibilitySnapshot,
  PlanDebtSelection,
  PlanDebtSource,
  PlanEtape,
  PlanEtapeStatut,
  PlanExtraCadence,
  PlanParametres,
  PlanSignalDeclencheur,
  PlanStatut,
  PlanSubtype,
  PlanSubtypeBudget,
  PlanSubtypeComportemental,
  PlanSubtypeDette,
  PlanSubtypeEpargne,
  PlanSubtypeFiscal,
  PlanSubtypeInvestissement,
  PlanSubtypeRisque,
  PlanSuggere,
} from './Plan';

export {
  PLAN_CATEGORIES,
  PLAN_CATEGORY_LABELS,
  PLAN_STATUTS,
  PLAN_STATUT_LABELS,
  PLAN_SUBTYPES_BY_CATEGORY,
  PLAN_SUBTYPES_SANS_MONTANT_CIBLE,
  PLAN_SUBTYPE_LABELS,
  assertPlanTaxonomy,
  isPlanCategory,
  isPlanSuggere,
  isPlanSubtypeForCategory,
  planEtapeEstComplete,
  planEtapesCompletees,
  planIndexEtapeActive,
  planMontantRestant,
  planPossedeCibleMonetaire,
  planProgressionPositive,
  planProgressionPourcent,
  planSubtypeSansMontantCible,
} from './Plan';

export {
  extraToMonthly,
  formatDebtFreeDuration,
  orderDebtsForStrategy,
  projectDebtPayoff,
} from './debtPayoffMath';
export type { DebtPayoffInput, DebtPayoffProjection, DebtPayoffStrategy, OrderedDebt } from './debtPayoffMath';

export {
  candidateFromLoan,
  candidateFromCreditAccount,
  excludeMortgagesFromDebtSelections,
  filterEligibleDebtPlanCandidates,
  filterRfaDebtsEligibleForAcceleratedPlan,
  isDebtPlanCandidateEligibleForAcceleratedPlan,
  isLoanEligibleForAcceleratedDebtPlan,
  isRfaDebtEligibleForAcceleratedDebtPlan,
  loadDebtPlanCandidates,
  RFA_MORTGAGE_DEBT_TYPE,
  sanitizeDebtParametresForAcceleratedPlan,
  strategyForDebtSubtype,
  usesDebtPayoffWizard,
} from './debtPlanCandidates';
export type { DebtPlanCandidate } from './debtPlanCandidates';

export {
  assessDebtExtraFeasibility,
  isCashflowViableForAcceleratedDebtPlan,
  MIN_SURPLUS_FOR_ACCELERATED_DEBT_PLAN,
  monthlySurplusFromCashflow,
} from './debtPlanFeasibility';
