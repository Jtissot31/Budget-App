import type { WealthAsset, WealthMaterial } from '@/types';

/** Row chip / tag for asset class (narrow label). */
export function wealthAssetTypeShortTag(asset: WealthAsset): string {
  if (asset.type === 'real_estate') return 'Immobilier';
  if (asset.material === 'gold') return 'Or';
  if (asset.material === 'silver') return 'Argent';
  if (asset.material === 'platinum') return 'Platine';
  if (asset.material === 'diamond') return 'Diamant';
  return 'Précieux';
}

export function wealthMaterialLabel(material: WealthMaterial) {
  if (material === 'gold') return 'Or';
  if (material === 'silver') return 'Argent';
  if (material === 'platinum') return 'Platine';
  return 'Diamant';
}

export function wealthAssetHeroSubtitle(asset: WealthAsset) {
  if (asset.type === 'real_estate') return asset.propertyType?.trim() || 'Bien immobilier';
  const material = asset.material ? wealthMaterialLabel(asset.material) : 'Matériau précieux';
  const weight = typeof asset.weight === 'number' ? `${asset.weight} ${asset.weightUnit ?? ''}`.trim() : null;
  if (asset.material === 'gold' && asset.karats) return `${material} ${asset.karats}k${weight ? ` · ${weight}` : ''}`;
  return weight ? `${material} · ${weight}` : material;
}

/** Human label for wealth_assets.valuation_source. */
export function valuationSourceLabel(asset: WealthAsset): string {
  if (asset.valuationSource === 'market') return 'Cours en ligne';
  if (asset.valuationSource === 'manual') return 'Valeur manuelle';
  return 'Estimation locale';
}

export function formatWealthShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type WealthValuationAsOfDisplay = { title: string; subtitle?: string };

/**
 * `wealth_assets.last_valuation_at` is persisted when valuations run; SQLite has no generic `updated_at` on rows.
 * When missing we surface the fetch instant (honest placeholder, not pretending to have history).
 */
export function getWealthValuationAsOfDisplay(
  asset: WealthAsset | null,
  screenOpenedAt: Date | null,
): WealthValuationAsOfDisplay {
  const iso = asset?.lastValuationAt?.trim();
  if (iso) {
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) {
      return { title: `Actualisée le ${formatWealthShortDate(iso)}` };
    }
  }

  const opened =
    screenOpenedAt?.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }) ?? null;

  if (opened) {
    return {
      title: `Actualisation non horodatée`,
      subtitle: `Affichage à l’instant de la visite · ${opened}`,
    };
  }
  return { title: `Actualisation non horodatée` };
}
