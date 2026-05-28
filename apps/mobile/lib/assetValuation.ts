import type { WealthAsset, WealthMaterial, WealthValuationSource, WealthWeightUnit } from '@/types';

const TROY_OUNCE_IN_GRAMS = 31.1034768;

const FALLBACK_CAD_PER_GRAM: Record<Exclude<WealthMaterial, 'diamond'>, number> = {
  gold: 150,
  silver: 1.65,
  platinum: 48,
};

const FALLBACK_DIAMOND_CAD_PER_CARAT = 4200;

const MARKET_SYMBOLS: Partial<Record<WealthMaterial, string>> = {
  gold: 'xauusd',
  silver: 'xagusd',
  platinum: 'xptusd',
};

export type AssetValuationResult = {
  currentValue: number;
  source: WealthValuationSource;
  sourceLabel: string;
  lastValuationAt: string;
  note?: string;
};

export type AssetValuationInput = Pick<
  WealthAsset,
  'type' | 'material' | 'weight' | 'weightUnit' | 'karats' | 'purity' | 'purchaseCost' | 'currentValue'
>;

export async function estimateWealthAssetValue(input: AssetValuationInput): Promise<AssetValuationResult> {
  const now = new Date().toISOString();

  if (input.type === 'real_estate') {
    return {
      currentValue: roundCurrency(input.currentValue || input.purchaseCost || 0),
      source: 'manual',
      sourceLabel: 'Valeur manuelle',
      lastValuationAt: now,
    };
  }

  if (!input.material || !input.weight || input.weight <= 0) {
    return {
      currentValue: roundCurrency(input.purchaseCost || 0),
      source: 'estimate',
      sourceLabel: 'Estimation incomplète',
      lastValuationAt: now,
      note: 'Ajoute un poids pour générer une valeur estimée.',
    };
  }

  if (input.material === 'diamond') {
    return {
      currentValue: roundCurrency(weightToCarats(input.weight, input.weightUnit) * FALLBACK_DIAMOND_CAD_PER_CARAT),
      source: 'estimate',
      sourceLabel: 'Estimation diamant',
      lastValuationAt: now,
      note: 'Le prix réel dépend de la coupe, couleur, clarté et certification.',
    };
  }

  const marketRate = await fetchCadPerGram(input.material);
  const source = marketRate ? 'market' : 'estimate';
  const cadPerGram = marketRate ?? FALLBACK_CAD_PER_GRAM[input.material];
  const purityMultiplier = getPurityMultiplier(input.material, input.karats, input.purity);
  const currentValue = weightToGrams(input.weight, input.weightUnit) * cadPerGram * purityMultiplier;

  return {
    currentValue: roundCurrency(currentValue),
    source,
    sourceLabel: source === 'market' ? 'Cours marché estimé' : 'Estimation locale',
    lastValuationAt: now,
    note: source === 'market' ? undefined : 'Cours en ligne indisponible, taux local utilisé.',
  };
}

async function fetchCadPerGram(material: Exclude<WealthMaterial, 'diamond'>): Promise<number | null> {
  const symbol = MARKET_SYMBOLS[material];
  if (!symbol) return null;

  try {
    const [spotUsd, usdCad] = await Promise.all([fetchStooqSpotUsd(symbol), fetchUsdCad()]);
    if (!spotUsd || !usdCad) return null;
    return (spotUsd * usdCad) / TROY_OUNCE_IN_GRAMS;
  } catch {
    return null;
  }
}

async function fetchStooqSpotUsd(symbol: string): Promise<number | null> {
  const response = await fetch(`https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`);
  if (!response.ok) return null;

  const text = await response.text();
  const [, row] = text.trim().split(/\r?\n/);
  if (!row) return null;

  const columns = row.split(',');
  const close = Number.parseFloat(columns[6]);
  return Number.isFinite(close) && close > 0 ? close : null;
}

async function fetchUsdCad(): Promise<number | null> {
  const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=CAD');
  if (!response.ok) return null;

  const json = await response.json();
  const rate = Number(json?.rates?.CAD);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function getPurityMultiplier(material: WealthMaterial, karats?: number | null, purity?: number | null) {
  if (material === 'gold' && karats && karats > 0) return Math.min(karats / 24, 1);
  if (purity && purity > 0) return purity > 1 ? Math.min(purity / 100, 1) : Math.min(purity, 1);
  return 1;
}

function weightToGrams(weight: number, unit?: WealthWeightUnit | null) {
  if (unit === 'oz') return weight * TROY_OUNCE_IN_GRAMS;
  if (unit === 'ct') return weight * 0.2;
  return weight;
}

function weightToCarats(weight: number, unit?: WealthWeightUnit | null) {
  if (unit === 'g') return weight * 5;
  if (unit === 'oz') return weight * TROY_OUNCE_IN_GRAMS * 5;
  return weight;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
