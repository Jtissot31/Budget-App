import { getSetting, setSetting } from '@/lib/db';
import { resetAppTour } from '@/lib/appTour';

/**
 * Single completion flag for the first-run intro:
 * welcome → features → name → optional Fyn.
 * The in-app guided tab tour runs after this (see `appTour.ts`).
 * « Revoir l’introduction » clears intro + tour so both replay.
 */
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

type OnboardingListener = (completed: boolean) => void;

const listeners = new Set<OnboardingListener>();

let gateReadyPromise: Promise<void> | null = null;

function emitOnboardingCompleted(completed: boolean): void {
  listeners.forEach((listener) => {
    try {
      listener(completed);
    } catch (error) {
      console.warn('[Onboarding] listener failed', error);
    }
  });
}

/** Subscribe to completion changes (root gate + settings replay). */
export function subscribeOnboardingCompleted(listener: OnboardingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * One-shot: if `onboarding_completed` was never written, decide from prior seed.
 * Existing installs (seed version already present) → completed.
 * Brand-new DB (no seed yet) → show intro.
 * Must run before demo seed on first boot of this feature.
 */
async function ensureOnboardingGateInitialized(): Promise<void> {
  if (!gateReadyPromise) {
    gateReadyPromise = (async () => {
      const flag = await getSetting(ONBOARDING_COMPLETED_KEY, '__missing__');
      if (flag !== '__missing__') return;

      const seedVersion = await getSetting('demo_transactions_seed_version', '');
      const completed = Boolean(seedVersion && seedVersion !== '0');
      await setSetting(ONBOARDING_COMPLETED_KEY, completed ? '1' : '0', { emit: false });
    })().catch((error: unknown) => {
      console.warn('[Onboarding] gate init failed', error);
      gateReadyPromise = null;
    });
  }
  await gateReadyPromise;
}

export async function isOnboardingCompleted(): Promise<boolean> {
  await ensureOnboardingGateInitialized();
  return (await getSetting(ONBOARDING_COMPLETED_KEY, '0')) === '1';
}

export async function setOnboardingCompleted(done: boolean): Promise<void> {
  await setSetting(ONBOARDING_COMPLETED_KEY, done ? '1' : '0', { emit: false });
  emitOnboardingCompleted(done);
}

/** Clear intro + guided tour so both show again (Réglages → Revoir l'introduction). */
export async function resetOnboarding(): Promise<void> {
  await resetAppTour();
  await setOnboardingCompleted(false);
}
