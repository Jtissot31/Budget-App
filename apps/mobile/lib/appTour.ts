import { getSetting, setSetting } from '@/lib/db';

/**
 * One-shot in-app guided visit (spotlight on real tabs).
 * Runs after first onboarding completes; « Revoir l’introduction » clears both.
 */
const APP_TOUR_COMPLETED_KEY = 'app_tour_completed';
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

type AppTourListener = (active: boolean) => void;

const listeners = new Set<AppTourListener>();

/** In-memory: overlay visible right now. */
let tourActive = false;
let gateReadyPromise: Promise<void> | null = null;

function emitActive(active: boolean): void {
  listeners.forEach((listener) => {
    try {
      listener(active);
    } catch (error) {
      console.warn('[AppTour] listener failed', error);
    }
  });
}

/**
 * Existing installs that already finished intro before this feature
 * should not suddenly see the tour — only brand-new / reset flows.
 */
async function ensureAppTourGateInitialized(): Promise<void> {
  if (!gateReadyPromise) {
    gateReadyPromise = (async () => {
      const flag = await getSetting(APP_TOUR_COMPLETED_KEY, '__missing__');
      if (flag !== '__missing__') return;

      const onboardingDone = (await getSetting(ONBOARDING_COMPLETED_KEY, '0')) === '1';
      await setSetting(APP_TOUR_COMPLETED_KEY, onboardingDone ? '1' : '0', { emit: false });
    })().catch((error: unknown) => {
      console.warn('[AppTour] gate init failed', error);
      gateReadyPromise = null;
    });
  }
  await gateReadyPromise;
}

export function subscribeAppTourActive(listener: AppTourListener): () => void {
  listeners.add(listener);
  listener(tourActive);
  return () => {
    listeners.delete(listener);
  };
}

export function isAppTourActive(): boolean {
  return tourActive;
}

export async function isAppTourCompleted(): Promise<boolean> {
  await ensureAppTourGateInitialized();
  return (await getSetting(APP_TOUR_COMPLETED_KEY, '0')) === '1';
}

export async function setAppTourCompleted(done: boolean): Promise<void> {
  await setSetting(APP_TOUR_COMPLETED_KEY, done ? '1' : '0', { emit: false });
}

/** Start overlay if intro is done and the tour was never completed. */
export async function maybeStartPendingAppTour(): Promise<boolean> {
  await ensureAppTourGateInitialized();
  const [onboardingFlag, tourFlag] = await Promise.all([
    getSetting(ONBOARDING_COMPLETED_KEY, '0'),
    getSetting(APP_TOUR_COMPLETED_KEY, '0'),
  ]);
  const onboardingDone = onboardingFlag === '1';
  const tourDone = tourFlag === '1';
  if (!onboardingDone || tourDone) {
    if (tourActive) {
      tourActive = false;
      emitActive(false);
    }
    return false;
  }
  if (!tourActive) {
    tourActive = true;
    emitActive(true);
  }
  return true;
}

export function startAppTour(): void {
  if (tourActive) return;
  tourActive = true;
  emitActive(true);
}

export async function finishAppTour(): Promise<void> {
  await setAppTourCompleted(true);
  if (tourActive) {
    tourActive = false;
    emitActive(false);
  }
}

/** Clear completion so the next app entry (or after intro) can replay the tour. */
export async function resetAppTour(): Promise<void> {
  await setAppTourCompleted(false);
  if (tourActive) {
    tourActive = false;
    emitActive(false);
  }
}
