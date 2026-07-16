import type { MdiIconName } from '@/lib/mdiIconCatalog';
import type { WealthAsset } from '@/types';

export type PatrimoineWealthLucideIcon = 'House' | 'Gem';

/** Lucide glyphs for BIENS PHYSIQUES tiles — null keeps MDI via {@link resolveWealthAssetIcon}. */
export function resolvePatrimoineWealthLucideIcon(asset: WealthAsset): PatrimoineWealthLucideIcon | null {
  if (asset.type === 'real_estate') return 'House';
  if (asset.type === 'precious_material') return 'Gem';
  return null;
}

export function resolveWealthAssetIcon(asset: WealthAsset): MdiIconName {
  if (asset.type === 'real_estate') return 'Apartments1StoryGabledRoof';
  switch (asset.material) {
    case 'gold':
      return 'EmojiEvents';
    case 'silver':
      return 'AccountBalance';
    case 'platinum':
      return 'Star';
    case 'diamond':
      return 'AlertDiamondFill';
    default:
      return 'Star';
  }
}
