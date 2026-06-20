import { getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import {
  getCategoryBudgets,
  getLoans,
  getSimulatedAccounts,
} from '@/lib/db';

import { loadEncryptedJson, removeEncryptedItem, saveEncryptedJson } from './encryptedStorage';
import { resolveDataMode } from './sanitizeForAI';
import type { AIAlert, AlertCategory, AlertSeverity } from './types';

const ALERTS_STORAGE_KEY = 'bt_ai_alerts_v1';

const LOW_CHECKING_BALANCE_THRESHOLD = 200;

function createAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadAlerts(): Promise<AIAlert[]> {
  return (await loadEncryptedJson<AIAlert[]>(ALERTS_STORAGE_KEY)) ?? [];
}

export async function saveAlerts(alerts: AIAlert[]): Promise<void> {
  await saveEncryptedJson(ALERTS_STORAGE_KEY, alerts);
}

export async function markAlertRead(alertId: string): Promise<void> {
  const alerts = await loadAlerts();
  const next = alerts.map((alert) =>
    alert.id === alertId ? { ...alert, lu: true } : alert,
  );
  await saveAlerts(next);
}

export async function clearAlerts(): Promise<void> {
  await removeEncryptedItem(ALERTS_STORAGE_KEY);
}

function upsertAlert(
  existing: AIAlert[],
  candidate: Omit<AIAlert, 'id' | 'createdAt' | 'lu'> & { categorie: AlertCategory },
): AIAlert[] {
  const duplicate = existing.find(
    (alert) =>
      alert.categorie === candidate.categorie &&
      alert.titre === candidate.titre &&
      !alert.lu,
  );
  if (duplicate) return existing;

  const alert: AIAlert = {
    ...candidate,
    id: createAlertId(),
    createdAt: new Date().toISOString(),
    lu: false,
  };
  return [alert, ...existing].slice(0, 50);
}

/**
 * MVP local rules — future batch evaluation via Gemini Flash 2.5.
 */
export async function evaluateAlerts(): Promise<AIAlert[]> {
  const dataMode = await resolveDataMode();
  const isManual = dataMode === 'manual';
  const [accounts, budgets, loans] = await Promise.all([
    getSimulatedAccounts(),
    getCategoryBudgets(),
    getLoans(),
  ]);

  let alerts = await loadAlerts();

  for (const account of accounts) {
    if (account.hidden) continue;
    if (account.kind === 'checking' && account.balance < LOW_CHECKING_BALANCE_THRESHOLD) {
      alerts = upsertAlert(alerts, {
        type: 'attention',
        categorie: 'solde_bas',
        titre: 'Solde bas',
        message: `Solde bas dans ton compte ${account.name} (${account.balance.toFixed(0)} $).`,
        montant: account.balance,
        compteReference: account.id,
        dateEcheance: null,
        actionDisponible: 'voir_compte',
        estimee: isManual,
      });
    }
  }

  for (const budget of budgets) {
    const usage = getCategoryBudgetUsage(budget.limitAmount, budget.spent);
    if (usage.isOverBudget) {
      alerts = upsertAlert(alerts, {
        type: 'attention',
        categorie: 'budget',
        titre: 'Budget dépassé',
        message: `Tu as dépassé ton budget ${budget.categoryName} ce mois-ci.`,
        montant: budget.spent - budget.limitAmount,
        compteReference: null,
        dateEcheance: null,
        actionDisponible: 'modifier_budget',
        estimee: isManual,
      });
    }
  }

  const urgentLoan = loans.find((loan) => loan.balanceRemaining > 0 && loan.interestRate >= 15);
  if (urgentLoan) {
    alerts = upsertAlert(alerts, {
      type: 'info',
      categorie: 'credit',
      titre: 'Dette à taux élevé',
      message: `${urgentLoan.name} affiche un taux de ${urgentLoan.interestRate.toFixed(2)} % — à prioriser.`,
      montant: urgentLoan.balanceRemaining,
      compteReference: urgentLoan.id,
      dateEcheance: urgentLoan.nextPaymentDate,
      actionDisponible: 'voir_plan',
      estimee: isManual,
    });
  }

  await saveAlerts(alerts);
  return alerts;
}

export function countAlertsBySeverity(alerts: AIAlert[], severity: AlertSeverity): number {
  return alerts.filter((alert) => alert.type === severity && !alert.lu).length;
}
