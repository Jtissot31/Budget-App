import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WealthAsset } from '@/types';

const STORAGE_KEY = 'wealth_assets_display_order';

/** Session cache — survives tab switches while the JS runtime is alive. */
let sessionOrderIds: string[] | null = null;

export function applyWealthAssetsDisplayOrder(
  assets: readonly WealthAsset[],
  orderIds: readonly string[] | null = sessionOrderIds,
): WealthAsset[] {
  if (!orderIds?.length) return [...assets];

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const ordered: WealthAsset[] = [];
  const seen = new Set<string>();

  for (const id of orderIds) {
    const asset = byId.get(id);
    if (!asset || seen.has(id)) continue;
    ordered.push(asset);
    seen.add(id);
  }

  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    ordered.push(asset);
  }

  return ordered;
}

export async function loadWealthAssetsDisplayOrder(
  assets: readonly WealthAsset[],
): Promise<WealthAsset[]> {
  if (sessionOrderIds) return applyWealthAssetsDisplayOrder(assets);

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
        sessionOrderIds = parsed;
      }
    }
  } catch {
    // Keep default DB order if storage is unavailable or corrupt.
  }

  return applyWealthAssetsDisplayOrder(assets);
}

export async function persistWealthAssetsDisplayOrder(
  nextAssets: readonly WealthAsset[],
): Promise<WealthAsset[]> {
  const orderIds = nextAssets.map((asset) => asset.id);
  sessionOrderIds = orderIds;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orderIds));
  } catch {
    // Session order still applies even if persistence fails.
  }
  return [...nextAssets];
}

/** Merge a reordered visible prefix back into the full ordered list. */
export function mergeVisibleWealthAssetsOrder(
  fullOrdered: readonly WealthAsset[],
  nextVisible: readonly WealthAsset[],
): WealthAsset[] {
  const visibleIds = new Set(nextVisible.map((asset) => asset.id));
  const hiddenTail = fullOrdered.filter((asset) => !visibleIds.has(asset.id));
  return [...nextVisible, ...hiddenTail];
}
