import { UNCATEGORIZED_TRANSACTION_CATEGORY } from '@/constants/categoryOptions';

import { repairOrphanTransactionCategories, upsertCategory } from './db';

import { ensureDisplayLanguageFromDevice, hydrateRuntimePreferences } from './settings';

import { hydrateRFAOnBoot } from './ai/rfaService';
import { evaluateAlerts } from './ai/alertService';
import { seedDemoTransactionsIfMissing } from './seed';



let schemaReady = false;

let schemaInitPromise: Promise<void> | null = null;



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

  if (!schemaReady) {

    if (!schemaInitPromise) {

      schemaInitPromise = withTimeout(runSchemaInit(), 'Database schema initialization', DB_INIT_TIMEOUT_MS)

        .then(() => {

          schemaReady = true;

        })

        .catch((error: unknown) => {

          console.warn('[Boot] database schema init failed (non-blocking)', error);

        })

        .finally(() => {

          schemaInitPromise = null;

        });

    }

    await schemaInitPromise;

  }



  if (!schemaReady) return;



  try {

    await withTimeout(seedDemoTransactionsIfMissing(), 'Demo data seeding', DB_INIT_TIMEOUT_MS);

    await ensureDisplayLanguageFromDevice();
    await hydrateRuntimePreferences();
    void hydrateRFAOnBoot();
    void evaluateAlerts();

  } catch (error: unknown) {

    console.warn('[Boot] demo seed failed (non-blocking)', error);

  }

}


