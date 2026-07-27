import { getSetting, setSetting } from '@/lib/db';

/**
 * Optional in-app guided visit (spotlight on real tabs).
 * Kept for a future manual entry point — does not auto-start after onboarding.
 * Onboarding finish marks the tour completed so it never blocks the main tabs.
 */
const APP_TOUR_COMPLETED_KEY = 'app_tour_completed';

type AppTourListener = (active: boolean) => void;

const listeners = new Set<AppTourListener>();

/** In-memory: overlay visible right now. */
let tourActive = false;
/** Survives remounts while the overlay is active (tab navigations / Strict Mode). */
let tourStopIndex = 0;
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
 * Ensure the tour never auto-schedules. Existing installs that still have
 * `app_tour_completed=0` are upgraded so the overlay cannot return.
 */
async function ensureAppTourGateInitialized(): Promise<void> {
  if (!gateReadyPromise) {
    gateReadyPromise = (async () => {
      await setSetting(APP_TOUR_COMPLETED_KEY, '1', { emit: false });
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

export function getAppTourStopIndex(): number {
  return tourStopIndex;
}

export function setAppTourStopIndex(index: number): void {
  tourStopIndex = Math.max(0, index);
}

export async function isAppTourCompleted(): Promise<boolean> {
  await ensureAppTourGateInitialized();
  return (await getSetting(APP_TOUR_COMPLETED_KEY, '0')) === '1';
}

export async function setAppTourCompleted(done: boolean): Promise<void> {
  await setSetting(APP_TOUR_COMPLETED_KEY, done ? '1' : '0', { emit: false });
}

/**
 * Auto-start after onboarding is disabled (overlay froze main tabs).
 * Marks the tour completed and ensures any in-memory overlay is cleared.
 * Use `startAppTour()` only from an explicit future entry point.
 */
export async function maybeStartPendingAppTour(): Promise<boolean> {
  await ensureAppTourGateInitialized();
  await setAppTourCompleted(true);
  if (tourActive) {
    tourActive = false;
    emitActive(false);
  }
  return false;
}

export function startAppTour(): void {
  if (tourActive) return;
  tourStopIndex = 0;
  tourActive = true;
  emitActive(true);
}

export async function finishAppTour(): Promise<void> {
  await setAppTourCompleted(true);
  tourStopIndex = 0;
  if (tourActive) {
    tourActive = false;
    emitActive(false);
  }
}

/**
 * Clears any active overlay. Keeps completion flagged so the tour does not
 * auto-resurface after « Revoir l'introduction » / onboarding replay.
 */
export async function resetAppTour(): Promise<void> {
  await setAppTourCompleted(true);
  tourStopIndex = 0;
  if (tourActive) {
    tourActive = false;
    emitActive(false);
  }
}
