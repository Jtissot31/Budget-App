import type { Loan, WealthAsset, WealthAssetType, WealthMaterial, WealthWeightUnit } from '@/types';

/** Asset types shown in the Patrimoine (inclusive) wealth section. */
export const PATRIMOINE_WEALTH_ASSET_TYPES = [
  'real_estate',
  'precious_material',
] as const satisfies readonly WealthAssetType[];

const patrimoineWealthAssetTypeSet = new Set<string>(PATRIMOINE_WEALTH_ASSET_TYPES);

export function isPatrimoineWealthAssetType(type: string): type is WealthAssetType {
  return patrimoineWealthAssetTypeSet.has(type);
}

/** Keeps only immobilier and métaux précieux for Patrimoine display. */
export function filterPatrimoineWealthAssets(assets: readonly WealthAsset[]): WealthAsset[] {
  return assets.filter((asset) => isPatrimoineWealthAssetType(asset.type));
}

/** Hypothèque liée à un bien immobilier — seule dette affichée en mode Patrimoine. */
export function getPatrimoineLinkedMortgage(
  asset: WealthAsset,
  loansById: ReadonlyMap<string, Loan>,
): Loan | null {
  if (asset.type !== 'real_estate') return null;
  const loanId = asset.linkedLoanId?.trim();
  if (!loanId) return null;
  const loan = loansById.get(loanId) ?? null;
  return loan?.type === 'mortgage' ? loan : null;
}

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

/**
 * Default / official weight unit per material — same mapping as the wealth form
 * (`WEALTH_MATERIAL_OPTIONS` in accounts.tsx).
 */
export function wealthMaterialOfficialWeightUnit(material: WealthMaterial): WealthWeightUnit {
  if (material === 'diamond') return 'ct';
  return 'g';
}

/** Display label for a stored weight unit (matches WEIGHT_UNIT_OPTIONS). */
export function wealthWeightUnitLabel(unit: WealthWeightUnit | null | undefined): string {
  if (unit === 'oz') return 'oz troy';
  if (unit === 'ct') return 'carat';
  return 'g';
}

/**
 * Weight line for precious-material tiles — uses the asset's stored weight/unit
 * (form defaults to the material's official unit: g for metals, carat for diamond).
 */
export function formatWealthAssetWeight(asset: WealthAsset): string | null {
  if (asset.type !== 'precious_material') return null;
  if (typeof asset.weight !== 'number' || !(asset.weight > 0)) return null;

  const unit =
    asset.weightUnit ??
    (asset.material ? wealthMaterialOfficialWeightUnit(asset.material) : 'g');
  const amount = asset.weight.toLocaleString('fr-CA', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
  return `${amount} ${wealthWeightUnitLabel(unit)}`;
}

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Generic real-estate labels that repeat the « Immobilier » type badge. */
function isGenericRealEstateSubtitle(value: string) {
  const normalized = normalizeLabel(value);
  return normalized === 'immobilier' || normalized === 'bien immobilier' || normalized === 'bien immo';
}

function labelsMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizeLabel(a) === normalizeLabel(b);
}

/** Real-estate asset title derived from the selected property type. */
export function realEstateAssetName(propertyType: string | null | undefined) {
  const trimmed = propertyType?.trim();
  return trimmed || 'Bien immobilier';
}

function realEstateAddressSnippet(address: string) {
  const line = address.split('\n')[0]?.trim();
  if (!line) return null;
  return line.length > 48 ? `${line.slice(0, 45)}…` : line;
}

/**
 * Specific subtitle for identity rows (shown beside the type badge).
 * Returns null when there is nothing more specific than the badge itself.
 */
export function wealthAssetHeroSubtitle(asset: WealthAsset): string | null {
  if (asset.type === 'real_estate') {
    const name = asset.name?.trim();
    const propertyType = asset.propertyType?.trim();
    const address = asset.address?.trim();
    if (address) {
      const snippet = realEstateAddressSnippet(address);
      if (snippet && !labelsMatch(snippet, name)) return snippet;
    }
    if (propertyType && !isGenericRealEstateSubtitle(propertyType) && !labelsMatch(propertyType, name)) {
      return propertyType;
    }
    return null;
  }

  if (!asset.material) return 'Matériau précieux';

  const material = wealthMaterialLabel(asset.material);
  const weight = formatWealthAssetWeight(asset);
  if (asset.material === 'gold' && asset.karats) {
    return `${material} ${asset.karats}k${weight ? ` · ${weight}` : ''}`;
  }
  if (weight) return `${material} · ${weight}`;
  return null;
}

/** Standalone contexts without a type badge (e.g. transaction header). */
export function wealthAssetHeroSubtitleWithFallback(asset: WealthAsset): string {
  return wealthAssetHeroSubtitle(asset) ?? (asset.type === 'real_estate' ? 'Bien immobilier' : wealthAssetTypeShortTag(asset));
}

/** Compact line under the sheet title — omits values repeated in detail rows. */
export function wealthAssetHeaderMeta(asset: WealthAsset): string | null {
  if (asset.type === 'real_estate') {
    const propertyType = asset.propertyType?.trim();
    if (propertyType && !isGenericRealEstateSubtitle(propertyType) && !labelsMatch(propertyType, asset.name)) {
      return propertyType;
    }
    return null;
  }

  return wealthAssetHeroSubtitle(asset);
}

export type WealthAssetDetailField = 'type' | 'purchase_date' | 'address' | 'spec' | 'notes';

export type WealthAssetDetailRow = {
  field: WealthAssetDetailField;
  label: string;
  value: string;
};

export type RealEstateNetEquity = {
  propertyValue: number;
  mortgageBalance: number;
  netEquity: number;
  hasMortgage: boolean;
  linkedLoanId: string | null;
};

/** Net equity for a real-estate asset — property value minus linked mortgage balance. */
export function computeRealEstateNetEquity(asset: WealthAsset, loan: Loan | null): RealEstateNetEquity {
  const propertyValue = Math.max(Number(asset.currentValue) || 0, 0);
  const linkedLoanId = asset.linkedLoanId?.trim() || loan?.id?.trim() || null;
  const mortgageBalance =
    loan && loan.type === 'mortgage' ? Math.max(Number(loan.balanceRemaining) || 0, 0) : 0;
  const hasMortgage = mortgageBalance > 0 || Boolean(linkedLoanId && loan?.type === 'mortgage');
  const netEquity = Math.max(propertyValue - mortgageBalance, 0);

  return { propertyValue, mortgageBalance, netEquity, hasMortgage, linkedLoanId };
}

/**
 * Patrimoine display value — gross `currentValue` except for mortgaged real estate,
 * where net equity (property value − remaining mortgage balance) is shown.
 */
export function getWealthAssetDisplayValue(asset: WealthAsset, linkedLoan?: Loan | null): number {
  const gross = Math.max(Number(asset.currentValue) || 0, 0);
  if (asset.type !== 'real_estate') return gross;
  if (linkedLoan?.type === 'mortgage') {
    return computeRealEstateNetEquity(asset, linkedLoan).netEquity;
  }
  return gross;
}

/** Label for the primary value on cards and summaries. */
export function getWealthAssetDisplayLabel(asset: WealthAsset, linkedLoan?: Loan | null): string {
  if (asset.type === 'real_estate' && linkedLoan?.type === 'mortgage') {
    const equity = computeRealEstateNetEquity(asset, linkedLoan);
    if (equity.hasMortgage) return 'Équité nette';
  }
  return 'Valeur actuelle';
}

/**
 * Appreciation vs `purchaseCost` — null when purchase cost is unknown or zero.
 * Same basis as {@link WealthAssetCard} and wealth-asset-detail plus-value KPI.
 */
export function getWealthAssetValueGainPercent(asset: WealthAsset): number | null {
  if (!(asset.purchaseCost > 0)) return null;
  return ((asset.currentValue - asset.purchaseCost) / asset.purchaseCost) * 100;
}

export function formatWealthValueGainPercent(percent: number): string {
  if (Math.abs(percent) < 0.05) return '0 %';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)} %`;
}

/** Sum of display values for patrimoine totals and net-worth offsets. */
export function sumWealthAssetsDisplayValue(
  assets: readonly WealthAsset[],
  loansById: ReadonlyMap<string, Loan>,
): number {
  return assets.reduce((sum, asset) => {
    const loanId = asset.linkedLoanId?.trim();
    const linkedLoan = loanId ? loansById.get(loanId) ?? null : null;
    return sum + getWealthAssetDisplayValue(asset, linkedLoan);
  }, 0);
}

/** Context rows for real-estate detail — excludes purchase KPIs shown elsewhere. */
export function buildRealEstateDetailInfoRows(asset: WealthAsset): WealthAssetDetailRow[] {
  const rows: WealthAssetDetailRow[] = [];

  const propertyType = asset.propertyType?.trim();
  if (propertyType && !isGenericRealEstateSubtitle(propertyType) && !labelsMatch(propertyType, asset.name)) {
    rows.push({ field: 'type', label: 'Type de bien', value: propertyType });
  }
  if (asset.address?.trim()) {
    rows.push({ field: 'address', label: 'Adresse', value: asset.address.trim() });
  }
  if (asset.notes?.trim()) {
    rows.push({ field: 'notes', label: 'Notes', value: asset.notes.trim() });
  }

  return rows;
}

/** Context rows for the detail sheet — excludes KPIs already shown in the hero strip. */
export function buildWealthAssetDetailRows(asset: WealthAsset): WealthAssetDetailRow[] {
  const rows: WealthAssetDetailRow[] = [];

  if (asset.type === 'real_estate') {
    const propertyType = asset.propertyType?.trim();
    if (propertyType && !isGenericRealEstateSubtitle(propertyType) && !labelsMatch(propertyType, asset.name)) {
      rows.push({ field: 'type', label: 'Type de bien', value: propertyType });
    }
    if (asset.purchaseDate?.trim()) {
      rows.push({ field: 'purchase_date', label: 'Date d\'achat', value: formatWealthShortDate(asset.purchaseDate) });
    }
    if (asset.address?.trim()) {
      rows.push({ field: 'address', label: 'Adresse', value: asset.address.trim() });
    }
  } else {
    // Material / spec already appear in the sheet header — keep only fields not shown elsewhere.
    if (asset.purchaseDate?.trim()) {
      rows.push({ field: 'purchase_date', label: 'Date d\'achat', value: formatWealthShortDate(asset.purchaseDate) });
    }
  }

  if (asset.notes?.trim()) {
    rows.push({ field: 'notes', label: 'Notes', value: asset.notes.trim() });
  }

  return rows;
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
