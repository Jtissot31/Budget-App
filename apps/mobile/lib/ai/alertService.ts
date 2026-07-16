import { getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import {
  getCategoryBudgets,
  getLoans,
  getSimulatedAccounts,
} from '@/lib/db';
import { ALERT_TITLES } from '@/lib/alertPresentation';

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
        titre: ALERT_TITLES.balanceLow,
        message: `Le solde de ${account.name} est bas (${account.balance.toFixed(0)} $). Un petit ajout avant le prochain paiement conserve ta tranquillité.`,
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
        titre: ALERT_TITLES.budgetOver,
        message: `L’enveloppe ${budget.categoryName} a été dépassée ce mois-ci. Réajuster l’enveloppe ou revoir quelques dépenses te remet dans le rythme.`,
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
      titre: ALERT_TITLES.highInterestDebt,
      message: `${urgentLoan.name} porte un taux de ${urgentLoan.interestRate.toFixed(2)} %. La prioriser t’épargne des intérêts au fil du temps.`,
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
