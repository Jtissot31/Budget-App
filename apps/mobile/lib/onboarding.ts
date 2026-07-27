import { getSetting, setSetting } from '@/lib/db';
import { resetAppTour } from '@/lib/appTour';
import { isDemoSeedEnabled } from '@/lib/demoSeedGate';
import { Platform } from 'react-native';

/**
 * Single completion flag for the first-run intro:
 * welcome → features → name → pay → housing → optional Fyn.
 * Pay + housing answers feed agenda estimates and Budgets (see `onboardingMoney.ts`).
 * The in-app guided tab tour is disabled after intro (see `appTour.ts`).
 * « Revoir l’introduction » clears intro only.
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
 * Existing installs that already ran demo seed → completed.
 * Brand-new / release APK (no demo seed) → show intro.
 * Must run before demo seed on first boot of this feature.
 */
async function ensureOnboardingGateInitialized(): Promise<void> {
  if (!gateReadyPromise) {
    gateReadyPromise = (async () => {
      const flag = await getSetting(ONBOARDING_COMPLETED_KEY, '__missing__');
      if (flag !== '__missing__') return;

      // Never auto-skip onboarding on release builds — fresh APKs must see intro.
      // Only treat prior demo seed as "already onboarded" when demo seeding is enabled.
      if (!isDemoSeedEnabled()) {
        // Web Metro: skip intro so Accueil cold-start isn't blocked by the wizard
        // (demo seed is also off on web by default).
        if (Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && __DEV__) {
          await setSetting(ONBOARDING_COMPLETED_KEY, '1', { emit: false });
          return;
        }
        await setSetting(ONBOARDING_COMPLETED_KEY, '0', { emit: false });
        return;
      }

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

/** Clear intro; guided tour stays marked completed (no post-onboarding overlay). */
export async function resetOnboarding(): Promise<void> {
  await resetAppTour();
  await setOnboardingCompleted(false);
}
