import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

// TODO: brancher sur getSavingsGoals() — voir types/index.ts SavingsGoal

export type SavingsGoalListItem = {
  id: string;
  name: string;
  category: string;
  status: string;
  statusTone: 'positive' | 'warning';
  progress: number;
  progressPositive: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  currentAmount: number;
  targetAmount: number;
  summary: string;
  contributionLabel: string;
  targetDateLabel: string;
};

export const MOCK_SAVINGS_GOALS: SavingsGoalListItem[] = [
  {
    id: 'mock-goal-fonds-urgence',
    name: "Fonds d'urgence",
    category: 'Sécurité',
    status: 'Actif',
    statusTone: 'positive',
    progress: 62,
    progressPositive: true,
    icon: 'shield-check-outline',
    currentAmount: 6_200,
    targetAmount: 10_000,
    summary: '3 mois de dépenses en réserve.',
    contributionLabel: '150 $ / semaine',
    targetDateLabel: 'Oct. 2026',
  },
  {
    id: 'mock-goal-vacances',
    name: 'Vacances',
    category: 'Loisirs',
    status: 'En cours',
    statusTone: 'positive',
    progress: 45,
    progressPositive: true,
    icon: 'beach',
    currentAmount: 2_250,
    targetAmount: 5_000,
    summary: 'Voyage au Portugal — vols, hébergement et activités.',
    contributionLabel: '75 $ / semaine',
    targetDateLabel: 'Juin 2027',
  },
  {
    id: 'mock-goal-voiture',
    name: 'Voiture',
    category: 'Achat',
    status: 'En cours',
    statusTone: 'positive',
    progress: 28,
    progressPositive: true,
    icon: 'car-outline',
    currentAmount: 4_200,
    targetAmount: 15_000,
    summary: 'Mise de fonds pour un véhicule d’occasion fiable.',
    contributionLabel: '200 $ / mois',
    targetDateLabel: 'Déc. 2027',
  },
  {
    id: 'mock-goal-reer',
    name: 'REER',
    category: 'Retraite',
    status: 'Actif',
    statusTone: 'positive',
    progress: 18,
    progressPositive: true,
    icon: 'chart-line',
    currentAmount: 3_600,
    targetAmount: 20_000,
    summary: 'Cotisations annuelles pour maximiser le report d’impôt.',
    contributionLabel: '100 $ / semaine',
    targetDateLabel: 'Fév. 2028',
  },
];

export function savingsGoalRemainingAmount(goal: SavingsGoalListItem): number {
  return Math.max(0, goal.targetAmount - goal.currentAmount);
}

export function savingsGoalProgressSummary(goal: SavingsGoalListItem): string {
  const remaining = savingsGoalRemainingAmount(goal);
  return `${formatDisplayMoneyAbsolute(goal.currentAmount)} / ${formatDisplayMoneyAbsolute(goal.targetAmount)} · ${formatDisplayMoneyAbsolute(remaining)} restants`;
}

export function savingsGoalListSubtitle(goal: SavingsGoalListItem): string {
  return `${goal.progress} % · ${goal.contributionLabel} · ${goal.targetDateLabel}`;
}
