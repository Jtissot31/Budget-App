import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'wallet_sections_display_order';

export const WALLET_SECTION_IDS = ['accounts', 'goals', 'loans'] as const;
export type WalletSectionId = (typeof WALLET_SECTION_IDS)[number];

const DEFAULT_ORDER: WalletSectionId[] = [...WALLET_SECTION_IDS];

/** Session cache — survives tab switches while the JS runtime is alive. */
let sessionOrderIds: WalletSectionId[] | null = null;

function isWalletSectionId(value: unknown): value is WalletSectionId {
  return (
    typeof value === 'string' &&
    (WALLET_SECTION_IDS as readonly string[]).includes(value)
  );
}

export function applyWalletSectionsDisplayOrder(
  orderIds: readonly string[] | null = sessionOrderIds,
): WalletSectionId[] {
  if (!orderIds?.length) return [...DEFAULT_ORDER];

  const ordered: WalletSectionId[] = [];
  const seen = new Set<WalletSectionId>();

  for (const id of orderIds) {
    if (!isWalletSectionId(id) || seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  for (const id of DEFAULT_ORDER) {
    if (seen.has(id)) continue;
    ordered.push(id);
  }

  return ordered;
}

export async function loadWalletSectionsDisplayOrder(): Promise<WalletSectionId[]> {
  if (sessionOrderIds) return applyWalletSectionsDisplayOrder(sessionOrderIds);

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
        sessionOrderIds = applyWalletSectionsDisplayOrder(parsed);
      }
    }
  } catch {
    // Keep default order if storage is unavailable or corrupt.
  }

  return applyWalletSectionsDisplayOrder(sessionOrderIds);
}

export async function persistWalletSectionsDisplayOrder(
  nextOrder: readonly WalletSectionId[],
): Promise<WalletSectionId[]> {
  const orderIds = applyWalletSectionsDisplayOrder(nextOrder);
  sessionOrderIds = orderIds;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orderIds));
  } catch {
    // Session order still applies even if persistence fails.
  }
  return orderIds;
}
