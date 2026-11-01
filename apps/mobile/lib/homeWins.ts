/**
 * Accueil « Tes victoires » — turns the month's data into encouragement.
 * Only positive facts become wins; a rough patch gets a gentle, forward-looking line
 * instead of a warning. Pure: no I/O.
 */
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

export type HomeWin = {
  id: string;
  /** Ionicons glyph name. */
  icon: string;
  label: string;
};

export type HomeWinsMood = 'great' | 'good' | 'fresh';

export type HomeWins = {
  mood: HomeWinsMood;
  headline: string;
  subline: string;
  wins: HomeWin[];
};

export type HomeWinsInput = {
  firstName: string;
  now: Date;
  streakDays: number;
  loggedToday: boolean;
  categories: readonly { name: string; limit: number; spent: number }[];
  monthlyIncome: number;
  monthlyExpenses: number;
  netWorthUp: boolean;
  goals: readonly { name: string; saved: number; target: number }[];
};

const MAX_WINS = 3;

export function buildHomeWins(input: HomeWinsInput): HomeWins {
  const candidates: HomeWin[] = [];
  const lastDay = new Date(input.now.getFullYear(), input.now.getMonth() + 1, 0).getDate();
  const monthProgress = input.now.getDate() / lastDay;

  if (input.streakDays >= 2) {
    candidates.push({ id: 'streak', icon: 'flame', label: `${input.streakDays} jours de suite` });
  }

  const budgeted = input.categories.filter((c) => c.limit > 0);
  const onTrack = budgeted.filter((c) => c.spent <= c.limit);
  if (budgeted.length > 0 && onTrack.length > 0) {
    candidates.push({
      id: 'on-track',
      icon: 'checkmark-circle',
      label:
        onTrack.length === budgeted.length
          ? 'Toutes tes catégories dans le budget'
          : `${onTrack.length} catégorie${onTrack.length > 1 ? 's' : ''} sur ${budgeted.length} dans le budget`,
    });
  }

  const limit = budgeted.reduce((sum, c) => sum + c.limit, 0);
  const spent = budgeted.reduce((sum, c) => sum + Math.max(0, c.spent), 0);
  if (limit > 0 && monthProgress > 0.15 && spent / limit < monthProgress - 0.05) {
    candidates.push({ id: 'pace', icon: 'speedometer', label: 'En avance sur ton budget' });
  }

  const saved = input.monthlyIncome - input.monthlyExpenses;
  if (input.monthlyIncome > 0 && saved > 0) {
    candidates.push({ id: 'saved', icon: 'leaf', label: `${formatDisplayMoneyAbsolute(saved)} mis de côté ce mois` });
  }

  const bestGoal = [...input.goals]
    .filter((g) => g.target > 0 && g.saved < g.target)
    .sort((a, b) => b.saved / b.target - a.saved / a.target)[0];
  if (bestGoal && bestGoal.saved / bestGoal.target >= 0.25) {
    candidates.push({
      id: 'goal',
      icon: 'flag',
      label: `${bestGoal.name} à ${Math.round((bestGoal.saved / bestGoal.target) * 100)} %`,
    });
  }

  if (input.netWorthUp) {
    candidates.push({ id: 'net-worth', icon: 'trending-up', label: 'Patrimoine en hausse' });
  }

  if (input.loggedToday && input.streakDays < 2) {
    candidates.push({ id: 'logged', icon: 'checkmark-done', label: 'Dépenses du jour notées' });
  }

  const wins = candidates.slice(0, MAX_WINS);
  const name = input.firstName ? `, ${input.firstName}` : '';

  if (candidates.length >= 3) {
    return { mood: 'great', headline: `Belle lancée${name} !`, subline: 'Tu gardes le cap — continue comme ça.', wins };
  }
  if (candidates.length > 0) {
    return { mood: 'good', headline: `Bien joué${name}`, subline: 'Chaque petit pas compte.', wins };
  }
  return {
    mood: 'fresh',
    headline: 'Nouveau jour, nouveau départ',
    subline: 'Note une dépense pour lancer ta série — on s’occupe du reste.',
    wins,
  };
}
