/**
 * Demo / mock financial data gate (accounts, txns, loans, budgets, alerts, stocks…).
 *
 * Cursor / Expo Go / Expo web / Metro (`__DEV__`): ON — rich sample data for design & QA.
 *   Web still seeds deferred + chunked in `init.ts` so Accueil can paint first.
 * EAS preview/production APK (`!__DEV__`): OFF — clean empty install after first open.
 *   `eas.json` sets `EXPO_PUBLIC_SEED_DEMO=0` on those profiles so a stray env cannot re-enable mocks.
 *
 * Force ON anywhere:  `EXPO_PUBLIC_SEED_DEMO=1` (alias: `EXPO_PUBLIC_USE_MOCK_DATA=1`).
 * Force OFF locally:  `EXPO_PUBLIC_SEED_DEMO=0` (or `false`) — overrides `__DEV__`.
 *
 * Category taxonomy (picker catalog) may still seed without demo.
 * Budget allocations + fake spend history must stay gated behind this helper.
 */
import Constants from 'expo-constants';

type EnvTriState = 'on' | 'off' | 'unset';

function parseTriState(raw: string | undefined): EnvTriState {
  const value = raw?.trim();
  if (!value) return 'unset';
  const lower = value.toLowerCase();
  if (value === '1' || lower === 'true' || lower === 'yes' || lower === 'on') return 'on';
  if (value === '0' || lower === 'false' || lower === 'no' || lower === 'off') return 'off';
  return 'unset';
}

function readEnvTriState(): EnvTriState {
  const keys = ['EXPO_PUBLIC_SEED_DEMO', 'EXPO_PUBLIC_USE_MOCK_DATA'] as const;

  try {
    for (const key of keys) {
      const state = parseTriState(process.env[key]);
      if (state !== 'unset') return state;
    }
  } catch {
    // process.env may be unavailable in some runtimes
  }

  try {
    const extra = Constants.expoConfig?.extra as
      | { seedDemo?: string; useMockData?: string }
      | undefined;
    for (const raw of [extra?.seedDemo, extra?.useMockData]) {
      const state = parseTriState(raw);
      if (state !== 'unset') return state;
    }
  } catch {
    // Constants may be unavailable during early boot / tests
  }

  return 'unset';
}

/** True when fake accounts, transactions, loans, plans, stocks, alerts may be injected. */
export function isDemoSeedEnabled(): boolean {
  const env = readEnvTriState();
  if (env === 'on') return true;
  if (env === 'off') return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
