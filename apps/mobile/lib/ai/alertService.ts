import { getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import {
  getCategoryBudgets,
  getSimulatedAccounts,
} from '@/lib/db';
import {
  buildBalanceLowAlertTitle,
  buildBudgetOverAlertTitle,
  suppressGenericBudgetOverAlerts,
} from '@/lib/alertPresentation';
import { decideAlertRaise } from '@/lib/alertGuardrails';
import {
  alertKindKeyForAiAlert,
  balanceLowAlertKey,
  currentBudgetOverAlertKey,
  MAX_STORED_ALERTS,
  repairStoredAlerts,
  resolveAlertIdentityKey,
  type AlertIdentityOptions,
} from '@/lib/alertIdentity';

import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from './encryptedStorage';
import { resolveDataMode } from './sanitizeForAI';
import type { AIAlert, AlertCategory, AlertSeverity } from './types';

const ALERTS_STORAGE_KEY = 'bt_ai_alerts_v1';

const LOW_CHECKING_BALANCE_THRESHOLD = 200;

function createAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Every read goes through the repair pass, so duplicates written by older builds
 * collapse on sight and disappear from storage on the next write.
 */
export async function loadAlerts(options?: AlertIdentityOptions): Promise<AIAlert[]> {
  const stored = (await loadEncryptedJson<AIAlert[]>(ALERTS_STORAGE_KEY)) ?? [];
  return repairStoredAlerts(stored, options);
}

export async function saveAlerts(alerts: AIAlert[]): Promise<void> {
  await saveEncryptedJson(ALERTS_STORAGE_KEY, alerts);
}

let alertWriteQueue: Promise<unknown> = Promise.resolve();

/**
 * Serializes read-modify-write cycles on the alert list. Evaluation, mark-as-read and
 * plan proposals all mutate the same key, and interleaved passes used to lose writes.
 */
export async function mutateAlerts(
  mutator: (alerts: AIAlert[]) => AIAlert[] | Promise<AIAlert[]>,
  options?: AlertIdentityOptions,
): Promise<AIAlert[]> {
  const run = alertWriteQueue.then(async () => {
    const current = await loadAlerts(options);
    const next = repairStoredAlerts(await mutator(current), options);
    await saveAlerts(next);
    return next;
  });
  alertWriteQueue = run.catch(() => undefined);
  return run;
}

export async function markAlertRead(alertId: string): Promise<void> {
  await mutateAlerts((alerts) =>
    alerts.map((alert) => (alert.id === alertId ? { ...alert, lu: true } : alert)),
  );
}

export async function clearAlerts(): Promise<void> {
  await removeEncryptedItem(ALERTS_STORAGE_KEY);
}

type AlertCandidate = Omit<
  AIAlert,
  'id' | 'createdAt' | 'lu' | 'raisedAt' | 'raisedMontant'
> & {
  categorie: AlertCategory;
  dedupeKey: string;
};

/**
 * Insert or refresh by identity. A repeated pass for the same condition and period
 * updates the existing row; it only becomes unread again once the cooldown elapsed
 * or the situation got materially worse.
 */
function upsertAlert(existing: AIAlert[], candidate: AlertCandidate, now: Date): AIAlert[] {
  const index = existing.findIndex(
    (alert) => resolveAlertIdentityKey(alert) === candidate.dedupeKey,
  );

  const decision = decideAlertRaise({
    type: alertKindKeyForAiAlert(candidate),
    now,
    existing: index < 0 ? null : existing[index],
    montant: candidate.montant,
  });

  if (decision === 'insert') {
    const alert: AIAlert = {
      ...candidate,
      id: createAlertId(),
      createdAt: now.toISOString(),
      raisedAt: now.toISOString(),
      raisedMontant: candidate.montant,
      lu: false,
    };
    return [alert, ...existing].slice(0, MAX_STORED_ALERTS);
  }

  const current = existing[index];
  const refreshed: AIAlert =
    decision === 'reraise'
      ? {
          ...current,
          ...candidate,
          id: current.id,
          lu: false,
          createdAt: now.toISOString(),
          raisedAt: now.toISOString(),
          raisedMontant: candidate.montant,
        }
      : {
          ...current,
          ...candidate,
          id: current.id,
          lu: current.lu,
          createdAt: current.createdAt,
          raisedAt: current.raisedAt ?? current.createdAt,
          raisedMontant: current.raisedMontant ?? current.montant,
        };

  const next = [...existing];
  next[index] = refreshed;
  return next;
}

let evaluationInFlight: Promise<AIAlert[]> | null = null;

/**
 * MVP local rules — future batch evaluation via Gemini Flash 2.5.
 *
 * Idempotent: concurrent callers (boot, Accueil, Messages, data events) share one pass,
 * and a repeated pass for the same condition updates rather than inserts.
 */
export function evaluateAlerts(): Promise<AIAlert[]> {
  if (!evaluationInFlight) {
    evaluationInFlight = runAlertEvaluation().finally(() => {
      evaluationInFlight = null;
    });
  }
  return evaluationInFlight;
}

async function runAlertEvaluation(): Promise<AIAlert[]> {
  // Surface plan adaptation proposals as alerts (never silently mutate plans).
  const { evaluateAndSurfacePlanAdaptations } = await import(
    '@/lib/plans/planAdaptationProposals'
  );
  await evaluateAndSurfacePlanAdaptations().catch(() => undefined);

  const { getAlertTypePreferences, isAlertTypeEnabled } = await import(
    '@/lib/alertTypePreferences'
  );
  const prefs = await getAlertTypePreferences();

  const dataMode = await resolveDataMode();
  const isManual = dataMode === 'manual';
  const [accounts, budgets] = await Promise.all([
    getSimulatedAccounts(),
    getCategoryBudgets(),
  ]);

  const now = new Date();
  // Legacy budget rows only carry the category name — map it back to the stable id
  // so repaired rows land on the same identity as freshly evaluated ones.
  const categoryIdByName = new Map(
    budgets.map((budget) => [budget.categoryName.trim().toLowerCase(), budget.categoryId]),
  );
  const identityOptions: AlertIdentityOptions = {
    resolveBudgetCategoryId: (name) => categoryIdByName.get(name.trim().toLowerCase()),
  };

  return mutateAlerts((stored) => {
    // High-interest debt tips are not alerts/notifications — drop previously stored ones.
    let alerts = stored.filter((alert) => !isHighInterestDebtAlert(alert));
    // Drop legacy generic « Budget dépassé » when category-specific overruns exist.
    alerts = suppressGenericBudgetOverAlerts(alerts);

    if (isAlertTypeEnabled(prefs, 'balance_low')) {
      for (const account of accounts) {
        if (account.hidden) continue;
        if (account.kind === 'checking' && account.balance < LOW_CHECKING_BALANCE_THRESHOLD) {
          alerts = upsertAlert(
            alerts,
            {
              // critique → Accueil triangle rouge (déjà vrai maintenant)
              type: 'critique',
              categorie: 'solde_bas',
              dedupeKey: balanceLowAlertKey(account.id),
              titre: buildBalanceLowAlertTitle(account.name),
              message: `Le solde de ${account.name} est bas (${account.balance.toFixed(0)} $). Un petit ajout avant le prochain paiement conserve ta tranquillité.`,
              montant: account.balance,
              compteReference: account.id,
              dateEcheance: null,
              actionDisponible: 'voir_compte',
              estimee: isManual,
            },
            now,
          );
        }
      }
    }

    if (isAlertTypeEnabled(prefs, 'budget_over')) {
      for (const budget of budgets) {
        const usage = getCategoryBudgetUsage(budget.limitAmount, budget.spent);
        if (usage.isOverBudget) {
          alerts = upsertAlert(
            alerts,
            {
              // critique → Accueil triangle rouge (dépassement déjà constaté)
              type: 'critique',
              categorie: 'budget',
              dedupeKey: currentBudgetOverAlertKey(budget.categoryId, now),
              titre: buildBudgetOverAlertTitle(
                budget.categoryName,
                budget.spent - budget.limitAmount,
              ),
              message: `L’enveloppe ${budget.categoryName} a été dépassée ce mois-ci. Réajuster l’enveloppe ou revoir quelques dépenses te remet dans le rythme.`,
              montant: budget.spent - budget.limitAmount,
              compteReference: null,
              dateEcheance: null,
              actionDisponible: 'modifier_budget',
              estimee: isManual,
            },
            now,
          );
        }
      }
    }

    return suppressGenericBudgetOverAlerts(alerts);
  }, identityOptions);
}

/** Stored tip-style credit alerts about high interest rates (no longer surfaced). */
function isHighInterestDebtAlert(alert: Pick<AIAlert, 'categorie' | 'titre'>): boolean {
  if (alert.categorie !== 'credit') return false;
  const lowerTitle = alert.titre.toLowerCase();
  return (
    lowerTitle.includes('taux élevé') ||
    lowerTitle.includes('dette à taux') ||
    lowerTitle.includes('prioriser le remboursement')
  );
}

export function countAlertsBySeverity(alerts: AIAlert[], severity: AlertSeverity): number {
  return alerts.filter((alert) => alert.type === severity && !alert.lu).length;
}
