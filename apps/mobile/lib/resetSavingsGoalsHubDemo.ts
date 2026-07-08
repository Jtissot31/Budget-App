import { deleteAllSavingsGoals, getSetting, setSetting } from '@/lib/db';

/**
 * One-time migration: wipe persisted savings goals so Plan Hub shows the
 * suggestions empty state (Fonds d'urgence, Vacances, etc.).
 * Bump SAVINGS_GOALS_HUB_DEMO_VERSION to re-run on all devices.
 */
export const SAVINGS_GOALS_HUB_DEMO_VERSION = '1';
const SAVINGS_GOALS_HUB_DEMO_KEY = 'savings_goals_hub_demo_version';

export async function resetSavingsGoalsForHubDemoIfNeeded(): Promise<boolean> {
  const version = await getSetting(SAVINGS_GOALS_HUB_DEMO_KEY, '0');
  if (version === SAVINGS_GOALS_HUB_DEMO_VERSION) return false;

  const deletedCount = await deleteAllSavingsGoals();
  await setSetting(SAVINGS_GOALS_HUB_DEMO_KEY, SAVINGS_GOALS_HUB_DEMO_VERSION, { emit: false });
  return deletedCount > 0;
}
