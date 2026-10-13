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

/** Runs `fetcher` once at a time per key and stores the result. */
export function refreshScreenCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const inFlight = pending.get(key) as Promise<T> | undefined;
  if (inFlight) return inFlight;
  const run = fetcher()
    .then((value) => {
      store.set(key, value);
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, run);
  return run;
}
