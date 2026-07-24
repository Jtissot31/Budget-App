import type { DashboardPlanDetail } from '@/lib/dashboardPlansMock';
import {
  mockDashboardPlanToPlan,
  resolveDashboardPlanById,
} from './planDashboardAdapter';
import type { PlanActifOuTermine } from './Plan';
import {
  removeUserPlan,
  resolveEditablePlan,
  setUserPlanStatut,
  upsertUserPlan,
} from './plansStore';

/** Ensure the plan exists in encrypted storage (seeds from mock/runtime detail if needed). */
export async function ensureUserPlan(planId: string): Promise<PlanActifOuTermine | null> {
  const editable = await resolveEditablePlan(planId);
  if (!editable) return null;
  await upsertUserPlan(editable);
  return editable;
}

export async function togglePlanPause(planId: string): Promise<PlanActifOuTermine | null> {
  const plan = await ensureUserPlan(planId);
  if (!plan) return null;
  if (plan.statut === 'complete') return plan;

  const nextStatut: PlanActifOuTermine['statut'] =
    plan.statut === 'en_pause' ? 'actif' : 'en_pause';
  return setUserPlanStatut(planId, nextStatut);
}

export async function archiveUserPlan(planId: string): Promise<boolean> {
  return removeUserPlan(planId);
}

export async function buildPlanEditParams(
  planId: string,
  detail: DashboardPlanDetail,
): Promise<Record<string, string>> {
  const editable = (await resolveEditablePlan(planId)) ?? mockDashboardPlanToPlan(detail);
  return {
    editPlanId: editable.id,
    subtype: editable.subtype,
    category: editable.category,
    titre: editable.titre || detail.name,
    montantCible:
      editable.montant_cible != null && editable.montant_cible > 0
        ? String(editable.montant_cible)
        : detail.targetAmount > 0
          ? String(detail.targetAmount)
          : '',
    raison: editable.description || detail.summary,
    total: '1',
    index: '1',
  };
}

export function isPlanPaused(detail: DashboardPlanDetail | undefined): boolean {
  if (!detail) return false;
  return detail.status === 'En pause' || detail.status.toLowerCase().includes('pause');
}

/** Prefer runtime/storage detail; fall back to mock catalog. */
export function refreshPlanDetail(planId: string): DashboardPlanDetail | undefined {
  return resolveDashboardPlanById(planId);
}
