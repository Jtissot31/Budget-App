import { InteractionManager, Platform } from 'react-native';
import { UNCATEGORIZED_TRANSACTION_CATEGORY } from '@/constants/categoryOptions';

import { repairOrphanTransactionCategories, upsertCategory } from './db';

import { ensureDisplayLanguageFromDevice, hydrateRuntimePreferences } from './settings';

import { hydrateRFAOnBoot } from './ai/rfaService';
import { evaluateAlerts } from './ai/alertService';
import { hydrateUserApiKeys } from './ai/userApiKeys';
import { resetFinancialPlansHubIfNeeded } from './resetFinancialPlansHub';
import { resetSavingsGoalsForHubDemoIfNeeded } from './resetSavingsGoalsHubDemo';
import { ensureAverageUserBudgetBaseline, ensureDemoAccounts, seedDemoTransactionsIfMissing } from './seed';
import { seedLoansIfMissing } from './seedLoans';
import { seedRecurringPaymentsIfMissing } from './seedRecurringPayments';
import { ensureMerchantLogoMemory } from './merchantLogoMemory';

const INIT_SINGLETON_KEY = '__budgetTrackerDbInit__';

interface InitSingletonState {
  schemaReady: boolean;
  bootComplete: boolean;
  schemaInitPromise: Promise<void> | null;
  bootPromise: Promise<void> | null;
}

const nativeInitState: InitSingletonState = {
  schemaReady: false,
  bootComplete: false,
  schemaInitPromise: null,
  bootPromise: null,
};

/** Web Fast Refresh resets module state while OPFS handles stay open — persist init flags globally. */
function getInitSingletonState(): InitSingletonState {
  if (Platform.OS === 'web') {
    const globalState = globalThis as typeof globalThis & {
      [INIT_SINGLETON_KEY]?: InitSingletonState;
    };
    if (!globalState[INIT_SINGLETON_KEY]) {
      globalState[INIT_SINGLETON_KEY] = {
        schemaReady: false,
        bootComplete: false,
        schemaInitPromise: null,
        bootPromise: null,
      };
    }
    return globalState[INIT_SINGLETON_KEY]!;
  }
  return nativeInitState;
}

/** Large demo seed (~170 rows) can exceed a short native budget on persisted DBs. */
const DB_INIT_TIMEOUT_MS = 60_000;

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

function runWhenIdle(task: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    // Yield one frame so Accueil can paint before enrichment work.
    setTimeout(task, 0);
  });
}

async function runSchemaInit(): Promise<void> {
  await upsertCategory(UNCATEGORIZED_TRANSACTION_CATEGORY);
  // Orphan rows (missing category FK target) are excluded by getTransactions()' INNER JOIN.
  await repairOrphanTransactionCategories(UNCATEGORIZED_TRANSACTION_CATEGORY.id);
}

/**
 * Opens SQLite, repairs schema/orphans once, then ensures demo transactions exist.
 * Seeding runs on every call (fast no-op when Historique is already populated).
 */
export async function ensureDbReady(): Promise<void> {
  const initState = getInitSingletonState();
  if (initState.bootComplete) return;

  if (!initState.bootPromise) {
    initState.bootPromise = runBootSequence(initState).finally(() => {
      initState.bootPromise = null;
    });
  }

  await initState.bootPromise;
}

/**
 * Non-critical enrichment that must not block first paint / home data load.
 * Runs after interactions once core seed completes (or fails non-blocking).
 */
function scheduleDeferredBootWork(): void {
  runWhenIdle(() => {
    void (async () => {
      await withTimeout(ensureMerchantLogoMemory(), 'Merchant logo memory', DB_INIT_TIMEOUT_MS).catch(
        (error: unknown) => {
          console.warn('[Boot] merchant logo memory failed (non-blocking)', error);
        },
      );
      await ensureDisplayLanguageFromDevice().catch((error: unknown) => {
        console.warn('[Boot] display language hydrate failed (non-blocking)', error);
      });
      await hydrateRuntimePreferences().catch((error: unknown) => {
        console.warn('[Boot] runtime preferences hydrate failed (non-blocking)', error);
      });
      void hydrateRFAOnBoot();
      void evaluateAlerts();
    })();
  });
}

async function runBootSequence(initState: InitSingletonState): Promise<void> {
  if (!initState.schemaReady) {
    if (!initState.schemaInitPromise) {
      initState.schemaInitPromise = withTimeout(
        runSchemaInit(),
        'Database schema initialization',
        DB_INIT_TIMEOUT_MS,
      )
        .then(() => {
          initState.schemaReady = true;
        })
        .catch((error: unknown) => {
          console.warn('[Boot] database schema init failed (non-blocking)', error);
        })
        .finally(() => {
          initState.schemaInitPromise = null;
        });
    }

    await initState.schemaInitPromise;
  }

  if (!initState.schemaReady) return;

  // Kick off BYOK hydrate in parallel (do not await) so Fyn can use keys soon
  // without serializing behind demo seeding.
  void hydrateUserApiKeys().catch((error: unknown) => {
    console.warn('[Boot] user API keys hydrate failed (non-blocking)', error);
  });

  try {
    // Core demo/data path — needed for Accueil / Historique correctness.
    await withTimeout(
      resetSavingsGoalsForHubDemoIfNeeded(),
      'Savings goals hub demo reset',
      DB_INIT_TIMEOUT_MS,
    );
    await withTimeout(
      resetFinancialPlansHubIfNeeded(),
      'Financial plans hub reset',
      DB_INIT_TIMEOUT_MS,
    );
    await withTimeout(ensureAverageUserBudgetBaseline(), 'Budget baseline seeding', DB_INIT_TIMEOUT_MS);
    await withTimeout(ensureDemoAccounts(), 'Demo accounts seeding', DB_INIT_TIMEOUT_MS);
    await withTimeout(seedDemoTransactionsIfMissing(), 'Demo data seeding', DB_INIT_TIMEOUT_MS);
    await withTimeout(seedRecurringPaymentsIfMissing(), 'Recurring payments seeding', DB_INIT_TIMEOUT_MS);
    await withTimeout(seedLoansIfMissing(), 'Demo loans seeding', DB_INIT_TIMEOUT_MS);

    initState.bootComplete = true;
  } catch (error: unknown) {
    console.warn('[Boot] demo seed failed (non-blocking)', error);
    // Still mark complete so screens stop awaiting; deferred work may still help.
    initState.bootComplete = true;
  }

  scheduleDeferredBootWork();
}
