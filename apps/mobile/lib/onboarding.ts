import { getSetting, setSetting } from '@/lib/db';
import { isDemoSeedEnabled } from '@/lib/demoSeedGate';
import { Platform } from 'react-native';

/**
 * Optional first-run intro (welcome → features → name → pay → housing).
 * Not forced on launch — open via settings « Revoir l’introduction ».
 * Pay + housing answers feed agenda estimates and Budgets (see `onboardingMoney.ts`).
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

/** Subscribe to completion changes (settings replay). */
export function subscribeOnboardingCompleted(listener: OnboardingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * One-shot: if `onboarding_completed` was never written, decide from prior seed.
 * Existing installs that already ran demo seed → completed.
 * Brand-new installs → also mark completed (intro is optional, not a gate).
 */
async function ensureOnboardingGateInitialized(): Promise<void> {
  if (!gateReadyPromise) {
    gateReadyPromise = (async () => {
      const flag = await getSetting(ONBOARDING_COMPLETED_KEY, '__missing__');
      if (flag !== '__missing__') return;

      if (!isDemoSeedEnabled()) {
        if (Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && __DEV__) {
          await setSetting(ONBOARDING_COMPLETED_KEY, '1', { emit: false });
          return;
        }
        // Intro is no longer forced — treat fresh installs as completed.
        await setSetting(ONBOARDING_COMPLETED_KEY, '1', { emit: false });
        return;
      }

      const seedVersion = await getSetting('demo_transactions_seed_version', '');
      const completed = Boolean(seedVersion && seedVersion !== '0');
      await setSetting(ONBOARDING_COMPLETED_KEY, completed ? '1' : '0', { emit: false });
      // Even without prior seed, don't block the app — mark completed.
      if (!completed) {
        await setSetting(ONBOARDING_COMPLETED_KEY, '1', { emit: false });
      }
    })().catch((error: unknown) => {
      console.warn('[Onboarding] gate init failed', error);
      gateReadyPromise = null;
    });
  }
  await gateReadyPromise;
}

export async function isOnboardingCompleted(): Promise<boolean> {
  await ensureOnboardingGateInitialized();
  return (await getSetting(ONBOARDING_COMPLETED_KEY, '1')) === '1';
}

export async function setOnboardingCompleted(done: boolean): Promise<void> {
  await setSetting(ONBOARDING_COMPLETED_KEY, done ? '1' : '0', { emit: false });
  emitOnboardingCompleted(done);
}

/** Clear intro so settings can replay it. */
export async function resetOnboarding(): Promise<void> {
  await setOnboardingCompleted(false);
}
