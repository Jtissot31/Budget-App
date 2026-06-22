import type { DashboardPlanDetail } from '@/lib/dashboardPlansMock';
import { MOCK_DASHBOARD_PLANS } from '@/lib/dashboardPlansMock';
import {
  PLAN_CATEGORY_LABELS,
  PLAN_STATUT_LABELS,
  planProgressionPourcent,
  planProgressionPositive,
  type Plan,
  type PlanActifOuTermine,
  type PlanSuggere,
} from './Plan';
import { planSubtypeIcon } from './planCardPresentation';

const runtimePlanDetails = new Map<string, DashboardPlanDetail>();

export function registerPlanDetailForNavigation(plan: PlanActifOuTermine): void {
  runtimePlanDetails.set(plan.id, planToDashboardDetail(plan));
}

export function getRegisteredPlanDetail(planId: string): DashboardPlanDetail | undefined {
  return runtimePlanDetails.get(planId);
}

export function resolveDashboardPlanById(planId: string): DashboardPlanDetail | undefined {
  return runtimePlanDetails.get(planId) ?? MOCK_DASHBOARD_PLANS.find((plan) => plan.id === planId);
}

export function mockDashboardPlanToPlan(detail: DashboardPlanDetail): PlanActifOuTermine {
  const categoryKey = Object.entries(PLAN_CATEGORY_LABELS).find(
    ([, label]) => label === detail.category,
  )?.[0] as Plan['category'] | undefined;

  return {
    id: detail.id,
    category: categoryKey ?? 'epargne',
    subtype: 'fonds_urgence',
    titre: detail.name,
    description: detail.summary,
    statut: detail.status === 'Actif' ? 'actif' : detail.status === 'Complété' ? 'complete' : 'en_pause',
    montant_actuel: detail.currentAmount,
    montant_cible: detail.targetAmount,
    cadence: detail.contributionLabel,
    compte_lie: detail.linkedAccountLabel,
    etapes: detail.steps.map((step) => ({
      id: step.id,
      titre: step.label,
      description: step.description,
      statut: step.completed ? 'complete' : 'a_faire',
      date: step.dueLabel,
    })),
  };
}

export function planToDashboardDetail(plan: PlanActifOuTermine): DashboardPlanDetail {
  const progress = planProgressionPourcent(plan);
  const progressPositive = planProgressionPositive(plan);
  const activeStep = plan.etapes.find((etape) => etape.statut !== 'complete');

  return {
    id: plan.id,
    name: plan.titre,
    category: PLAN_CATEGORY_LABELS[plan.category],
    status: PLAN_STATUT_LABELS[plan.statut],
    statusTone: progressPositive ? 'positive' : 'warning',
    progress,
    progressPositive,
    icon: planSubtypeIcon(plan.category),
    currentAmount: plan.montant_actuel ?? 0,
    targetAmount: plan.montant_cible ?? 0,
    summary: plan.description,
    strategy: {
      name: plan.titre,
      description: plan.description,
    },
    startedAtLabel: plan.date_debut ?? '—',
    targetDateLabel: plan.date_cible ?? '—',
    estimatedCompletionLabel: plan.date_cible ?? '—',
    contributionLabel: plan.cadence ?? '—',
    linkedAccountLabel: plan.compte_lie,
    nextAction: {
      title: activeStep?.titre ?? 'Continuer le plan',
      description: activeStep?.description ?? plan.description,
    },
    metrics: [],
    rationale: plan.description,
    impactBullets: [],
    steps: plan.etapes.map((etape) => ({
      id: etape.id,
      label: etape.titre,
      description: etape.description,
      completed: etape.statut === 'complete',
      dueLabel: etape.date,
    })),
  };
}

export function suggestedPlanToCreateParams(plan: PlanSuggere): Record<string, string> {
  return {
    subtype: plan.subtype,
    category: plan.category,
    titre: plan.titre,
    montantCible: plan.montant_cible?.toString() ?? '',
    raison: plan.raison_recommandation,
    signal: plan.signal_declencheur,
    total: '1',
    index: '1',
  };
}
