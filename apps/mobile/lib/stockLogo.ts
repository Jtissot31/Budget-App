/**
 * Transparent company logos for stock holding tiles (bundled PNGs with alpha).
 * No IEX / Google favicon / Clearbit — those bake opaque white/colored wells.
 */

import { Asset } from 'expo-asset';

const AAPL_LOGO = require('@/assets/stocks/apple.png');
const MSFT_LOGO = require('@/assets/stocks/microsoft.png');
const NVDA_LOGO = require('@/assets/stocks/nvidia.png');
const SHOP_LOGO = require('@/assets/stocks/shopify.png');
const VFV_LOGO = require('@/assets/stocks/vanguard.png');
const XEQT_LOGO = require('@/assets/stocks/ishares.png');

/** Normalized ticker (no exchange suffix) → bundled transparent PNG module id. */
const STOCK_LOCAL_LOGO_BY_TICKER: Record<string, number> = {
  AAPL: AAPL_LOGO,
  MSFT: MSFT_LOGO,
  NVDA: NVDA_LOGO,
  SHOP: SHOP_LOGO,
  VFV: VFV_LOGO,
  XEQT: XEQT_LOGO,
};

function normalizeStockTicker(ticker: string): string {
  const raw = ticker.trim().toUpperCase();
  if (!raw) return '';
  return raw.split('.')[0]?.trim() || raw;
}

function resolveBundledAssetUri(asset: number): string {
  return Asset.fromModule(asset).uri;
}

/** Bundled transparent PNG module for a ticker, or null. */
export function getStockLogoAsset(ticker: string): number | null {
  const key = normalizeStockTicker(ticker);
  if (!key) return null;
  return STOCK_LOCAL_LOGO_BY_TICKER[key] ?? null;
}

/** Ordered logo URI candidates (local transparent PNG only). */
export function getStockLogoUrls(ticker: string): string[] {
  const asset = getStockLogoAsset(ticker);
  if (!asset) return [];
  return [resolveBundledAssetUri(asset)];
}

export function getStockLogoUrl(ticker: string): string | null {
  return getStockLogoUrls(ticker)[0] ?? null;
}
