import type { CurrencyCode } from '@/lib/settings';
import type { WealthAsset, WealthMaterial, WealthValuationSource, WealthWeightUnit } from '@/types';

const TROY_OUNCE_IN_GRAMS = 31.1034768;

/** Demo spot prices per gram (metals) — used when live market fetch fails or for form auto-fill. */
const MOCK_SPOT_PER_GRAM: Record<'CAD' | 'USD', Record<Exclude<WealthMaterial, 'diamond'>, number>> = {
  CAD: {
    gold: 150,
    silver: 1.65,
    platinum: 48,
  },
  USD: {
    gold: 110,
    silver: 1.2,
    platinum: 35,
  },
};

/** Demo diamond price per carat. */
const MOCK_DIAMOND_PER_CARAT: Record<'CAD' | 'USD', number> = {
  CAD: 4200,
  USD: 3100,
};

/** Approximate USD→currency multipliers for non CAD/USD display currencies. */
const USD_TO_CURRENCY: Record<CurrencyCode, number> = {
  USD: 1,
  CAD: 1.36,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.88,
};

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
> & {
  currency?: CurrencyCode;
};

export type PreciousMetalEstimateInput = {
  material: WealthMaterial;
  weight: number;
  weightUnit?: WealthWeightUnit | null;
  karats?: number | null;
  purity?: number | null;
  currency?: CurrencyCode;
};

/**
 * Sync estimate for form auto-fill: weight × mock spot/unit × purity, in display currency.
 * Metals priced per gram; diamond per carat. Units are converted before applying the table.
 */
export function estimatePreciousMetalValueSync(input: PreciousMetalEstimateInput): number {
  if (!input.weight || input.weight <= 0) return 0;

  const currency = input.currency ?? 'CAD';
  const purityMultiplier = getPurityMultiplier(input.material, input.karats, input.purity);

  if (input.material === 'diamond') {
    return roundCurrency(weightToCarats(input.weight, input.weightUnit) * mockDiamondPerCarat(currency));
  }

  const perGram = mockMetalPerGram(input.material, currency);
  return roundCurrency(weightToGrams(input.weight, input.weightUnit) * perGram * purityMultiplier);
}

export async function estimateWealthAssetValue(input: AssetValuationInput): Promise<AssetValuationResult> {
  const now = new Date().toISOString();
  const currency = input.currency ?? 'CAD';

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
      currentValue: roundCurrency(
        weightToCarats(input.weight, input.weightUnit) * mockDiamondPerCarat(currency),
      ),
      source: 'estimate',
      sourceLabel: 'Estimation diamant',
      lastValuationAt: now,
      note: 'Le prix réel dépend de la coupe, couleur, clarté et certification.',
    };
  }

  const marketRate = await fetchCurrencyPerGram(input.material, currency);
  const source = marketRate ? 'market' : 'estimate';
  const perGram = marketRate ?? mockMetalPerGram(input.material, currency);
  const purityMultiplier = getPurityMultiplier(input.material, input.karats, input.purity);
  const currentValue = weightToGrams(input.weight, input.weightUnit) * perGram * purityMultiplier;

  return {
    currentValue: roundCurrency(currentValue),
    source,
    sourceLabel: source === 'market' ? 'Cours marché estimé' : 'Estimation locale',
    lastValuationAt: now,
    note: source === 'market' ? undefined : 'Cours en ligne indisponible, taux local utilisé.',
  };
}

function mockMetalPerGram(material: Exclude<WealthMaterial, 'diamond'>, currency: CurrencyCode): number {
  if (currency === 'CAD' || currency === 'USD') {
    return MOCK_SPOT_PER_GRAM[currency][material];
  }
  return MOCK_SPOT_PER_GRAM.USD[material] * USD_TO_CURRENCY[currency];
}

function mockDiamondPerCarat(currency: CurrencyCode): number {
  if (currency === 'CAD' || currency === 'USD') {
    return MOCK_DIAMOND_PER_CARAT[currency];
  }
  return MOCK_DIAMOND_PER_CARAT.USD * USD_TO_CURRENCY[currency];
}

async function fetchCurrencyPerGram(
  material: Exclude<WealthMaterial, 'diamond'>,
  currency: CurrencyCode,
): Promise<number | null> {
  const symbol = MARKET_SYMBOLS[material];
  if (!symbol) return null;

  try {
    const spotUsd = await fetchStooqSpotUsd(symbol);
    if (!spotUsd) return null;

    const usdPerGram = spotUsd / TROY_OUNCE_IN_GRAMS;
    if (currency === 'USD') return usdPerGram;

    const usdToTarget = await fetchUsdToCurrency(currency);
    if (!usdToTarget) return null;
    return usdPerGram * usdToTarget;
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

async function fetchUsdToCurrency(currency: CurrencyCode): Promise<number | null> {
  if (currency === 'USD') return 1;

  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
    if (!response.ok) return null;

    const json = await response.json();
    const rate = Number(json?.rates?.[currency]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return USD_TO_CURRENCY[currency] ?? null;
  }
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
