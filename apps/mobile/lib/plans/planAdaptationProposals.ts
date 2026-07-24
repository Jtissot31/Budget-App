/**
 * Automatic plan adaptations — propose via in-app alert, never mutate silently.
 * Detection is heuristic (RFA + active plans); apply only after explicit user confirm.
 */
import { loadEncryptedJson, saveEncryptedJson } from '@/lib/ai/encryptedStorage';
import { buildHeuristicRFA, buildRFAInputFromAppData } from '@/lib/ai/sanitizeForAI';
import { appendAIMemory } from '@/lib/ai/aiMemory';
import { ALERT_TITLES } from '@/lib/alertPresentation';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { dataEvents } from '@/lib/events';
import type { AIAlert } from '@/lib/ai/types';

import { buildPlanRecommendationContext } from './buildPlanRecommendationContext';
import type { PlanActifOuTermine, PlanParametres } from './Plan';
import { loadUserPlans, upsertUserPlan } from './plansStore';

const PROPOSALS_STORAGE_KEY = 'bt_plan_adaptation_proposals_v1';
const MAX_PENDING_PROPOSALS = 3;

export type PlanAdaptationKind =
  | 'increase_cadence'
  | 'decrease_extra'
  | 'increase_target'
  | 'adjust_budget_cap';

export type PlanAdaptationProposal = {
  id: string;
  planId: string;
  planTitre: string;
  kind: PlanAdaptationKind;
  status: 'pending' | 'accepted' | 'dismissed';
  /** What would change (user-facing). */
  summary: string;
  /** Why the change is useful (user-facing). */
  whyUseful: string;
  /** Full alert body: what + why. */
  alertMessage: string;
  patch: {
    cadence?: string;
    montant_cible?: number | null;
    statut?: PlanActifOuTermine['statut'];
    parametres?: PlanParametres;
    description?: string;
  };
  createdAt: string;
  alertId?: string;
};

function createProposalId(): string {
  return `adapt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAlertId(): string {
  return `alert-plan-adapt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadPlanAdaptationProposals(): Promise<PlanAdaptationProposal[]> {
  return (await loadEncryptedJson<PlanAdaptationProposal[]>(PROPOSALS_STORAGE_KEY)) ?? [];
}

async function savePlanAdaptationProposals(proposals: PlanAdaptationProposal[]): Promise<void> {
  await saveEncryptedJson(PROPOSALS_STORAGE_KEY, proposals);
}

export async function getPlanAdaptationProposal(
  proposalId: string,
): Promise<PlanAdaptationProposal | null> {
  const all = await loadPlanAdaptationProposals();
  return all.find((item) => item.id === proposalId) ?? null;
}

export async function findPendingAdaptationForPlan(
  planId: string,
): Promise<PlanAdaptationProposal | null> {
  const all = await loadPlanAdaptationProposals();
  return all.find((item) => item.planId === planId && item.status === 'pending') ?? null;
}

function parseCadenceAmount(cadence: string | undefined): number | null {
  if (!cadence?.trim()) return null;
  const match = cadence.replace(/\u00a0/g, ' ').match(/(\d[\d\s]*(?:[.,]\d+)?)/);
  if (!match) return null;
  const normalized = match[1].replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isWeeklyCadence(cadence: string | undefined): boolean {
  if (!cadence) return false;
  const lower = cadence.toLowerCase();
  return lower.includes('sem') || lower.includes('week');
}

function formatCadenceLabel(amount: number, weekly: boolean): string {
  const money = formatDisplayMoneyAbsolute(amount);
  return weekly ? `${money} / semaine` : `${money} / mois`;
}

function buildAlertBody(summary: string, whyUseful: string): string {
  return `${summary}\n\nPourquoi c’est utile : ${whyUseful}`;
}

type DetectionCtx = ReturnType<typeof buildPlanRecommendationContext>;

function detectForPlan(
  plan: PlanActifOuTermine,
  ctx: DetectionCtx,
): Omit<PlanAdaptationProposal, 'id' | 'status' | 'createdAt' | 'alertId'> | null {
  if (plan.statut !== 'actif') return null;

  // Fonds d’urgence : augmenter la cadence si marge OK + couverture faible + propriétaire.
  if (plan.subtype === 'fonds_urgence' && ctx.est_proprietaire && ctx.couverture_mois < 3) {
    const current = parseCadenceAmount(plan.cadence) ?? 100;
    const weekly = isWeeklyCadence(plan.cadence) || !plan.cadence;
    const monthlyEquivalent = weekly ? (current * 52) / 12 : current;
    if (ctx.surplus_mensuel >= monthlyEquivalent + 40) {
      const nextAmount = Math.round(current * 1.25);
      if (nextAmount > current) {
        const nextCadence = formatCadenceLabel(nextAmount, weekly);
        const summary = `Passer la cadence de « ${plan.titre} » à ${nextCadence} (au lieu de ${formatCadenceLabel(current, weekly)}).`;
        const whyUseful =
          'Ton surplus le permet, et ça rapproche plus vite une couverture de ~3 mois pour sécuriser le paiement d’hypothèque.';
        return {
          planId: plan.id,
          planTitre: plan.titre,
          kind: 'increase_cadence',
          summary,
          whyUseful,
          alertMessage: buildAlertBody(summary, whyUseful),
          patch: { cadence: nextCadence },
        };
      }
    }
  }

  // Fonds d’urgence : relever la cible si elle est sous ~3 mois de dépenses.
  if (plan.subtype === 'fonds_urgence' && plan.montant_cible != null && plan.montant_cible > 0) {
    const suggestedTarget = Math.round(ctx.depenses_mensuelles * 3);
    if (
      suggestedTarget > plan.montant_cible * 1.15 &&
      ctx.couverture_mois < 2.5 &&
      ctx.est_proprietaire
    ) {
      const summary = `Relever l’objectif de « ${plan.titre} » à ${formatDisplayMoneyAbsolute(suggestedTarget)} (au lieu de ${formatDisplayMoneyAbsolute(plan.montant_cible)}).`;
      const whyUseful =
        'Une réserve d’environ 3 mois de dépenses réduit le recours au crédit si un imprévu menace le paiement d’hypothèque.';
      return {
        planId: plan.id,
        planTitre: plan.titre,
        kind: 'increase_target',
        summary,
        whyUseful,
        alertMessage: buildAlertBody(summary, whyUseful),
        patch: { montant_cible: suggestedTarget },
      };
    }
  }

  // Dette accélérée : baisser l’extra si le cashflow n’est plus viable.
  if (
    (plan.subtype === 'snowball' || plan.subtype === 'avalanche') &&
    !ctx.cashflow_viable_pour_extra_dette
  ) {
    const extra = plan.parametres?.extra_paiement ?? 0;
    if (extra > 0) {
      const nextExtra = Math.max(0, Math.round(extra * 0.5));
      if (nextExtra < extra) {
        const cadence = plan.parametres?.extra_cadence === 'week' ? 'semaine' : 'mois';
        const summary = `Réduire l’extra de « ${plan.titre} » à ${formatDisplayMoneyAbsolute(nextExtra)}/${cadence} (au lieu de ${formatDisplayMoneyAbsolute(extra)}/${cadence}).`;
        const whyUseful =
          'Ton surplus mensuel est trop serré : un extra plus léger évite de fragiliser le budget tout en gardant le plan actif.';
        return {
          planId: plan.id,
          planTitre: plan.titre,
          kind: 'decrease_extra',
          summary,
          whyUseful,
          alertMessage: buildAlertBody(summary, whyUseful),
          patch: {
            parametres: {
              ...plan.parametres,
              extra_paiement: nextExtra,
            },
          },
        };
      }
    }
  }

  // Dette : augmenter un peu l’extra si le cashflow s’améliore nettement.
  if (
    (plan.subtype === 'snowball' || plan.subtype === 'avalanche') &&
    ctx.cashflow_viable_pour_extra_dette &&
    ctx.surplus_mensuel >= 200
  ) {
    const extra = plan.parametres?.extra_paiement ?? 0;
    const weekly = plan.parametres?.extra_cadence === 'week';
    const monthlyExtra = weekly ? (extra * 52) / 12 : extra;
    if (extra > 0 && ctx.surplus_mensuel >= monthlyExtra + 80) {
      const nextExtra = Math.round(extra * 1.2);
      if (nextExtra > extra) {
        const cadenceLabel = weekly ? 'semaine' : 'mois';
        const summary = `Augmenter l’extra de « ${plan.titre} » à ${formatDisplayMoneyAbsolute(nextExtra)}/${cadenceLabel} (au lieu de ${formatDisplayMoneyAbsolute(extra)}/${cadenceLabel}).`;
        const whyUseful =
          'Tu as de la marge : un extra un peu plus élevé accélère le remboursement sans compromettre le reste du budget.';
        return {
          planId: plan.id,
          planTitre: plan.titre,
          kind: 'increase_cadence',
          summary,
          whyUseful,
          alertMessage: buildAlertBody(summary, whyUseful),
          patch: {
            parametres: {
              ...plan.parametres,
              extra_paiement: nextExtra,
            },
          },
        };
      }
    }
  }

  // Budget enveloppe : proposer de recalibrer le plafond si dépassements répétés.
  if (
    plan.subtype === 'enveloppe' &&
    ctx.categorie_depassee_mois_consecutifs >= 1 &&
    plan.parametres?.budget_mensuel != null &&
    plan.parametres.budget_mensuel > 0
  ) {
    const current = plan.parametres.budget_mensuel;
    const next = Math.round(current * 1.1);
    if (next > current) {
      const summary = `Ajuster le plafond de « ${plan.titre} » à ${formatDisplayMoneyAbsolute(next)}/mois (au lieu de ${formatDisplayMoneyAbsolute(current)}/mois).`;
      const whyUseful =
        'L’enveloppe a été dépassée récemment : un plafond un peu plus réaliste évite les fausses alertes tout en gardant une limite claire.';
      return {
        planId: plan.id,
        planTitre: plan.titre,
          kind: 'adjust_budget_cap',
        summary,
        whyUseful,
        alertMessage: buildAlertBody(summary, whyUseful),
        patch: {
          parametres: {
            ...plan.parametres,
            budget_mensuel: next,
          },
          montant_cible: next,
        },
      };
    }
  }

  return null;
}

/**
 * Detect suggested adaptations for active plans. Does NOT mutate plans —
 * returns proposal drafts only.
 */
export async function detectPlanAdaptationDrafts(): Promise<
  Omit<PlanAdaptationProposal, 'id' | 'status' | 'createdAt' | 'alertId'>[]
> {
  const [plans, input] = await Promise.all([loadUserPlans(), buildRFAInputFromAppData()]);
  const rfa = buildHeuristicRFA(input);
  const ctx = buildPlanRecommendationContext(input, rfa);

  const drafts: Omit<PlanAdaptationProposal, 'id' | 'status' | 'createdAt' | 'alertId'>[] = [];
  for (const plan of plans) {
    const draft = detectForPlan(plan, ctx);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

function upsertPlanAlert(
  existing: AIAlert[],
  proposal: PlanAdaptationProposal,
): { alerts: AIAlert[]; alertId: string } {
  const duplicate = existing.find(
    (alert) =>
      alert.categorie === 'plan' &&
      alert.adaptationProposalId === proposal.id &&
      !alert.lu,
  );
  if (duplicate) {
    return { alerts: existing, alertId: duplicate.id };
  }

  const alertId = createAlertId();
  const alert: AIAlert = {
    id: alertId,
    type: 'info',
    categorie: 'plan',
    titre: `${ALERT_TITLES.planAdaptation} · ${proposal.planTitre}`,
    message: proposal.alertMessage,
    montant: null,
    compteReference: null,
    dateEcheance: null,
    actionDisponible: 'confirmer_adaptation',
    lu: false,
    createdAt: new Date().toISOString(),
    adaptationProposalId: proposal.id,
    relatedPlanId: proposal.planId,
  };

  return { alerts: [alert, ...existing].slice(0, 50), alertId };
}

/**
 * Evaluate adaptations: store pending proposals + surface as alerts.
 * Never applies patches to plansStore.
 */
export async function evaluateAndSurfacePlanAdaptations(): Promise<PlanAdaptationProposal[]> {
  const [existingProposals, drafts] = await Promise.all([
    loadPlanAdaptationProposals(),
    detectPlanAdaptationDrafts(),
  ]);

  const pending = existingProposals.filter((item) => item.status === 'pending');
  const pendingPlanIds = new Set(pending.map((item) => item.planId));
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const cooledDownKeys = new Set(
    existingProposals
      .filter((item) => {
        if (item.status === 'pending') return true;
        const age = Date.now() - Date.parse(item.createdAt);
        return Number.isFinite(age) && age < COOLDOWN_MS;
      })
      .map((item) => `${item.planId}:${item.kind}`),
  );

  const nextProposals = [...existingProposals];
  const { loadAlerts, saveAlerts } = await import('@/lib/ai/alertService');
  let alerts = await loadAlerts();
  let created = 0;

  for (const draft of drafts) {
    if (created + pending.length >= MAX_PENDING_PROPOSALS) break;
    if (pendingPlanIds.has(draft.planId)) continue;
    if (cooledDownKeys.has(`${draft.planId}:${draft.kind}`)) continue;

    const proposal: PlanAdaptationProposal = {
      ...draft,
      id: createProposalId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const upserted = upsertPlanAlert(alerts, proposal);
    alerts = upserted.alerts;
    proposal.alertId = upserted.alertId;
    nextProposals.unshift(proposal);
    pendingPlanIds.add(proposal.planId);
    created += 1;
  }

  if (created > 0) {
    await Promise.all([savePlanAdaptationProposals(nextProposals), saveAlerts(alerts)]);
  }

  return nextProposals.filter((item) => item.status === 'pending');
}

/** Apply a pending adaptation after user confirmation. */
export async function acceptPlanAdaptation(
  proposalId: string,
): Promise<{ ok: boolean; message: string; planId?: string }> {
  const proposals = await loadPlanAdaptationProposals();
  const index = proposals.findIndex((item) => item.id === proposalId);
  if (index < 0) {
    return { ok: false, message: 'Cette proposition n’est plus disponible.' };
  }

  const proposal = proposals[index];
  if (proposal.status !== 'pending') {
    return {
      ok: false,
      message:
        proposal.status === 'accepted'
          ? 'Cette adaptation a déjà été appliquée.'
          : 'Cette proposition a été ignorée.',
    };
  }

  const plans = await loadUserPlans();
  const plan = plans.find((item) => item.id === proposal.planId);
  if (!plan) {
    return { ok: false, message: 'Le plan lié à cette adaptation est introuvable.' };
  }

  const updated: PlanActifOuTermine = {
    ...plan,
    ...proposal.patch,
    parametres: proposal.patch.parametres
      ? { ...plan.parametres, ...proposal.patch.parametres }
      : plan.parametres,
  };

  await upsertUserPlan(updated);

  const nextProposals = proposals.map((item, i) =>
    i === index ? { ...item, status: 'accepted' as const } : item,
  );
  await savePlanAdaptationProposals(nextProposals);

  if (proposal.alertId) {
    const { loadAlerts, saveAlerts } = await import('@/lib/ai/alertService');
    const alerts = await loadAlerts();
    await saveAlerts(
      alerts.map((alert) =>
        alert.id === proposal.alertId || alert.adaptationProposalId === proposalId
          ? { ...alert, lu: true }
          : alert,
      ),
    );
  }

  void appendAIMemory({
    type: 'plan_adaptation',
    summary: `Adapté ${proposal.planTitre}: ${proposal.summary.slice(0, 100)}`,
    context: { subtype: plan.subtype, kind: proposal.kind, accepted: true },
  });

  dataEvents.emit();
  return {
    ok: true,
    message: `Adaptation appliquée sur « ${proposal.planTitre} ».`,
    planId: proposal.planId,
  };
}

/** Dismiss without applying. */
export async function dismissPlanAdaptation(
  proposalId: string,
): Promise<{ ok: boolean; message: string }> {
  const proposals = await loadPlanAdaptationProposals();
  const index = proposals.findIndex((item) => item.id === proposalId);
  if (index < 0) {
    return { ok: false, message: 'Cette proposition n’est plus disponible.' };
  }

  const proposal = proposals[index];
  if (proposal.status !== 'pending') {
    return { ok: true, message: 'Proposition déjà traitée.' };
  }

  const nextProposals = proposals.map((item, i) =>
    i === index ? { ...item, status: 'dismissed' as const } : item,
  );
  await savePlanAdaptationProposals(nextProposals);

  if (proposal.alertId) {
    const { loadAlerts, saveAlerts } = await import('@/lib/ai/alertService');
    const alerts = await loadAlerts();
    await saveAlerts(
      alerts.map((alert) =>
        alert.id === proposal.alertId || alert.adaptationProposalId === proposalId
          ? { ...alert, lu: true }
          : alert,
      ),
    );
  }

  void appendAIMemory({
    type: 'plan_adaptation',
    summary: `Ignoré adaptation ${proposal.planTitre}`,
    context: { kind: proposal.kind, accepted: false },
  });

  dataEvents.emit();
  return { ok: true, message: 'Proposition ignorée.' };
}
