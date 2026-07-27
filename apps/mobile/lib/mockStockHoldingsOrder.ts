import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_STOCK_HOLDINGS, type MockStockHolding } from '@/constants/mockStockPortfolio';
import { isDemoSeedEnabled } from '@/lib/demoSeedGate';

const STORAGE_KEY = 'mock_stock_holdings_display_order';

/** Session cache — survives tab switches while the JS runtime is alive. */
let sessionOrderIds: string[] | null = null;

function applyOrderIds(
  holdings: readonly MockStockHolding[],
  orderIds: readonly string[] | null,
): MockStockHolding[] {
  if (!orderIds?.length) return [...holdings];

  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  const ordered: MockStockHolding[] = [];
  const seen = new Set<string>();

  for (const id of orderIds) {
    const holding = byId.get(id);
    if (!holding || seen.has(id)) continue;
    ordered.push(holding);
    seen.add(id);
  }

  for (const holding of holdings) {
    if (seen.has(holding.id)) continue;
    ordered.push(holding);
  }

  return ordered;
}

/** Active mock stock list — empty on release APKs so Patrimoine starts blank. */
export function getDemoStockHoldings(): readonly MockStockHolding[] {
  return isDemoSeedEnabled() ? MOCK_STOCK_HOLDINGS : [];
}

export function getOrderedMockStockHoldings(
  holdings: readonly MockStockHolding[] = getDemoStockHoldings(),
): MockStockHolding[] {
  return applyOrderIds(holdings, sessionOrderIds);
}

export async function loadMockStockHoldingsOrder(): Promise<MockStockHolding[]> {
  if (sessionOrderIds) return getOrderedMockStockHoldings();

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
        sessionOrderIds = parsed;
      }
    }
  } catch {
    // Keep default mock order if storage is unavailable or corrupt.
  }

  return getOrderedMockStockHoldings();
}

export async function persistMockStockHoldingsOrder(
  nextHoldings: readonly MockStockHolding[],
): Promise<MockStockHolding[]> {
  const orderIds = nextHoldings.map((holding) => holding.id);
  sessionOrderIds = orderIds;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orderIds));
  } catch {
    // Session order still applies even if persistence fails.
  }
  return [...nextHoldings];
}

/** Merge a reordered visible prefix back into the full ordered list. */
export function mergeVisibleStockHoldingsOrder(
  fullOrdered: readonly MockStockHolding[],
  nextVisible: readonly MockStockHolding[],
): MockStockHolding[] {
  const visibleIds = new Set(nextVisible.map((holding) => holding.id));
  const hiddenTail = fullOrdered.filter((holding) => !visibleIds.has(holding.id));
  return [...nextVisible, ...hiddenTail];
}
