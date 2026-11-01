/**
 * In-memory screen snapshots — stale-while-revalidate for heavy screens (Accueil, Copilote).
 *
 * Data is preloaded once at boot; a screen initialises its state from the last snapshot so it
 * renders the real content immediately, then refreshes quietly in the background (no empty
 * state, no flash). Lives for the app session only.
 */
const store = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

export function readScreenCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeScreenCache<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Keys asked to refresh again while a fetch was already running. */
const rerunRequested = new Set<string>();

/**
 * Runs `fetcher` once at a time per key and stores the result.
 *
 * A request that arrives while a fetch is running joins it — but that fetch may have read the
 * data before the change that triggered the request, so one more run is queued and everyone
 * waiting gets the final result (otherwise the screen keeps showing the stale snapshot).
 */
export function refreshScreenCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const inFlight = pending.get(key) as Promise<T> | undefined;
  if (inFlight) {
    rerunRequested.add(key);
    return inFlight;
  }
  const run = (async () => {
    let value = await fetcher();
    while (rerunRequested.delete(key)) {
      value = await fetcher();
    }
    store.set(key, value);
    return value;
  })().finally(() => pending.delete(key));
  pending.set(key, run);
  return run;
}

/** Current month's budget categories (UI model) — written by Accueil's boot preload and by Budget. */
export const BUDGET_SCREEN_CACHE_KEY = 'budgets:current-month';
