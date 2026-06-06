import { isDatabaseEmpty } from './db';
import { seedDatabase } from './seed';

let initialized = false;
let initPromise: Promise<void> | null = null;

const DB_INIT_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, label: string, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function ensureDbReady(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = withTimeout(
      (async () => {
        if (await isDatabaseEmpty()) {
          await seedDatabase();
        }
        initialized = true;
      })(),
      'Database initialization',
      DB_INIT_TIMEOUT_MS,
    )
      .catch((error: unknown) => {
        console.warn('[Boot] database init failed (non-blocking)', error);
        initialized = true;
      })
      .finally(() => {
        initPromise = null;
      });
  }
  await initPromise;
}
