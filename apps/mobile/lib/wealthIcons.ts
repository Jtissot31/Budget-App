import type { MdiIconName } from '@/lib/mdiIconCatalog';
import type { WealthAsset } from '@/types';

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
