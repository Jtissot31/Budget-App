/**
 * Logos marchands : assets locaux haute résolution en priorité, puis favicons publics
 * (domaine déduit du nom). Clearbit (logo.clearbit.com) est déprécié / souvent bloqué —
 * on utilise une chaîne Google s2 favicons → icône DDG en secours.
 */

import { Asset } from 'expo-asset';
import type { MerchantOverride } from '@/types';

/** Bundled merchant logos (full resolution — not downscaled favicons). */
const TIM_HORTONS_LOGO = require('@/assets/merchants/tim-hortons.png');
const IGA_LOGO = require('@/assets/merchants/iga.png');
const STM_LOGO = require('@/assets/merchants/stm.png');
const NETFLIX_LOGO = require('@/assets/merchants/netflix.png');
const REM_LOGO = require('@/assets/merchants/rem.png');
const JEAN_COUTU_LOGO = require('@/assets/merchants/jean-coutu.png');
const PETRO_CANADA_LOGO = require('@/assets/merchants/petro-canada.png');
const MAXI_LOGO = require('@/assets/merchants/maxi.png');
const COUCHE_TARD_LOGO = require('@/assets/merchants/couche-tard.png');
const MCDONALDS_LOGO = require('@/assets/merchants/mcdonalds.png');
const SUPER_C_LOGO = require('@/assets/merchants/super-c.png');
const VISA_LOGO = require('@/assets/merchants/visa.png');

/** Normalized merchant key → bundled asset module id */
const MERCHANT_LOCAL_ASSET_BY_KEY: Record<string, number> = {
  timhortons: TIM_HORTONS_LOGO,
  'tim hortons': TIM_HORTONS_LOGO,
  iga: IGA_LOGO,
  stm: STM_LOGO,
  'stm opus': STM_LOGO,
  'stm — opus': STM_LOGO,
  netflix: NETFLIX_LOGO,
  rem: REM_LOGO,
  'rem — billet': REM_LOGO,
  'rem billet': REM_LOGO,
  'jean coutu': JEAN_COUTU_LOGO,
  jeancoutu: JEAN_COUTU_LOGO,
  pjc: JEAN_COUTU_LOGO,
  'petro-canada': PETRO_CANADA_LOGO,
  petrocanada: PETRO_CANADA_LOGO,
  'petro canada': PETRO_CANADA_LOGO,
  maxi: MAXI_LOGO,
  'couche-tard': COUCHE_TARD_LOGO,
  'couche tard': COUCHE_TARD_LOGO,
  couchetard: COUCHE_TARD_LOGO,
  mcdonalds: MCDONALDS_LOGO,
  "mcdonald's": MCDONALDS_LOGO,
  'super c': SUPER_C_LOGO,
  superc: SUPER_C_LOGO,
};

/** Partial label match → bundled asset (seed labels, bank descriptors). */
const MERCHANT_LOCAL_ASSET_KEYWORDS: Array<[string, number]> = [
  ['tim hortons', TIM_HORTONS_LOGO],
  ['iga', IGA_LOGO],
  ['stm', STM_LOGO],
  ['stm opus', STM_LOGO],
  ['stm — opus', STM_LOGO],
  ['netflix', NETFLIX_LOGO],
  ['rem — billet', REM_LOGO],
  ['jean coutu', JEAN_COUTU_LOGO],
  ['petro-canada', PETRO_CANADA_LOGO],
  ['petro canada', PETRO_CANADA_LOGO],
  ['couche-tard', COUCHE_TARD_LOGO],
  ['couche tard', COUCHE_TARD_LOGO],
  ['mcdonald', MCDONALDS_LOGO],
  ['super c', SUPER_C_LOGO],
  ['maxi', MAXI_LOGO],
];

/** Normalized merchant display name → registrable domain */
const MERCHANT_DOMAIN_MAP: Record<string, string> = {
  starbucks: 'starbucks.com',
  netflix: 'netflix.com',
  amazon: 'amazon.com',
  'amazon prime': 'amazon.com',
  apple: 'apple.com',
  'apple store': 'apple.com',
  icloud: 'icloud.com',
  'icloud+': 'icloud.com',
  icloud: 'icloud.com',
  'icloud+': 'icloud.com',
  'disney+': 'disneyplus.com',
  disneyplus: 'disneyplus.com',
  spotify: 'spotify.com',
  uber: 'uber.com',
  lyft: 'lyft.com',
  mcdonalds: 'mcdonalds.com',
  "mcdonald's": 'mcdonalds.com',
  walmart: 'walmart.com',
  maxi: 'maxi.ca',
  superc: 'superc.ca',
  'super c': 'superc.ca',
  target: 'target.com',
  costco: 'costco.com',
  'whole foods': 'wholefoodsmarket.com',
  wholefoods: 'wholefoodsmarket.com',
  subway: 'subway.com',
  timhortons: 'timhortons.com',
  'tim hortons': 'timhortons.com',
  iga: 'iga.net',
  metro: 'metro.ca',
  saq: 'saq.com',
  lcbo: 'lcbo.com',
  dollarama: 'dollarama.com',
  ikea: 'ikea.com',
  'home depot': 'homedepot.com',
  'the home depot': 'homedepot.com',
  lowes: 'lowes.com',
  bestbuy: 'bestbuy.com',
  'best buy': 'bestbuy.com',
  canadiantire: 'canadiantire.ca',
  'canadian tire': 'canadiantire.ca',
  shell: 'shell.com',
  'couchetard': 'couche-tard.com',
  'couche tard': 'couche-tard.com',
  'couche-tard': 'couche-tard.com',
  petrocanada: 'petro-canada.ca',
  'petro-canada': 'petro-canada.ca',
  esso: 'esso.ca',
  dominos: 'dominos.com',
  "domino's": 'dominos.com',
  pizzahut: 'pizzahut.com',
  'pizza hut': 'pizzahut.com',
  doordash: 'doordash.com',
  'uber eats': 'ubereats.com',
  instacart: 'instacart.com',
  airbnb: 'airbnb.com',
  booking: 'booking.com',
  expedia: 'expedia.com',
  delta: 'delta.com',
  aircanada: 'aircanada.com',
  'air canada': 'aircanada.com',
  google: 'google.com',
  microsoft: 'microsoft.com',
  adobe: 'adobe.com',
  dropbox: 'dropbox.com',
  notion: 'notion.so',
  slack: 'slack.com',
  zoom: 'zoom.us',
  paypal: 'paypal.com',
  stripe: 'stripe.com',
  interac: 'interac.ca',
  pharmaprix: 'pharmaprix.ca',
  shoppers: 'shoppersdrugmart.ca',
  'shoppers drug mart': 'shoppersdrugmart.ca',
  'jean coutu': 'jeancoutu.com',
  jeancoutu: 'jeancoutu.com',
  desjardins: 'desjardins.com',
  rbc: 'rbcroyalbank.com',
  td: 'td.com',
  bmo: 'bmo.com',
  scotiabank: 'scotiabank.com',
  cibc: 'cibc.com',
  telus: 'telus.com',
  bell: 'bell.ca',
  rogers: 'rogers.com',
  videotron: 'videotron.com',
  fizz: 'fizz.ca',
  'fizz mobile': 'fizz.ca',
  'hydro-quebec': 'hydroquebec.com',
  'hydro quebec': 'hydroquebec.com',
  hydroquebec: 'hydroquebec.com',
  'costco wholesale': 'costco.com',
  carrefour: 'carrefour.com',
  provigo: 'provigo.ca',
  loblaws: 'loblaws.ca',
  'bureau en gros': 'bureauengros.com',
  'st-hubert': 'st-hubert.com',
  'st hubert': 'st-hubert.com',
  econofitness: 'econofitness.com',
  'sport expert': 'sportsexperts.ca',
  winners: 'winners.ca',
  cineplex: 'cineplex.com',
  uniprix: 'uniprix.com',
  'via rail': 'viarail.ca',
  rona: 'rona.ca',
  'bell mobilite': 'bell.ca',
  'bell mobilité': 'bell.ca',
};

/** Partial label match → domain (seed labels like "STM — Opus", "REM — Billet"). */
const MERCHANT_KEYWORD_DOMAIN_MAP: Array<[string, string]> = [
  ['provigo', 'provigo.ca'],
  ['loblaws', 'loblaws.ca'],
  ['bureau en gros', 'bureauengros.com'],
  ['st-hubert', 'st-hubert.com'],
  ['st hubert', 'st-hubert.com'],
  ['econofitness', 'econofitness.com'],
  ['sport expert', 'sportsexperts.ca'],
  ['winners', 'winners.ca'],
  ['cineplex', 'cineplex.com'],
  ['uniprix', 'uniprix.com'],
  ['via rail', 'viarail.ca'],
  ['rona', 'rona.ca'],
  ['stm', 'stm.info'],
  ['rem', 'rem.info'],
  ['indigo', 'indigopark.com'],
  ['icloud', 'icloud.com'],
  ['disney', 'disneyplus.com'],
  ['hydro-quebec', 'hydroquebec.com'],
  ['hydro quebec', 'hydroquebec.com'],
  ['videotron', 'videotron.com'],
  ['fizz mobile', 'fizz.ca'],
  ['fizz', 'fizz.ca'],
  ['bell', 'bell.ca'],
  ['netflix', 'netflix.com'],
  ['spotify', 'spotify.com'],
  ['tim hortons', 'timhortons.com'],
  ['super c', 'superc.ca'],
  ['canadian tire', 'canadiantire.ca'],
  ['home depot', 'homedepot.com'],
  ['jean coutu', 'jeancoutu.com'],
  ['couche-tard', 'couche-tard.com'],
  ['couche tard', 'couche-tard.com'],
  ['petro-canada', 'petro-canada.ca'],
  ['dollarama', 'dollarama.com'],
  ['pharmaprix', 'pharmaprix.ca'],
  ['saq', 'saq.com'],
  ['walmart', 'walmart.com'],
  ['costco', 'costco.com'],
  ['iga', 'iga.net'],
  ['metro', 'metro.ca'],
  ['maxi', 'maxi.ca'],
];

const GENERIC_TRANSACTION_LABELS = new Set([
  'essence',
  'essense',
  'essance',
  'gas',
  'gaz',
  'fuel',
  'carburant',
  'epicerie',
  'epicerie generale',
  'grocery',
  'groceries',
  'restaurant',
  'resto',
  'cafe',
  'loyer',
  'rent',
  'facture',
  'bill',
  'telephone',
  'internet',
  'transport',
  'taxi',
  'stationnement',
  'parking',
  'revenu',
  'paie',
  'salaire',
  'autre',
  'divers',
]);

/** Partial account/institution label → bundled logo (checked before remote favicons). */
const ACCOUNT_LOCAL_ASSET_KEYWORDS: Array<[string, number]> = [
  ['visa', VISA_LOGO],
];

const ACCOUNT_KEYWORD_DOMAIN_MAP: Array<[string, string]> = [
  ['desjardins', 'desjardins.com'],
  ['tangerine', 'tangerine.ca'],
  ['visa', 'visa.com'],
  ['mastercard', 'mastercard.com'],
  ['amex', 'americanexpress.com'],
  ['american express', 'americanexpress.com'],
  ['rbc', 'rbcroyalbank.com'],
  ['royal bank', 'rbcroyalbank.com'],
  ['td', 'td.com'],
  ['bmo', 'bmo.com'],
  ['scotia', 'scotiabank.com'],
  ['scotiabank', 'scotiabank.com'],
  ['cibc', 'cibc.com'],
  ['national bank', 'nbc.ca'],
  ['banque nationale', 'bnc.ca'],
  ['laurentienne', 'blc.ca'],
  ['wealthsimple', 'wealthsimple.com'],
  ['koho', 'koho.ca'],
  ['neo financial', 'neofinancial.com'],
  ['neo', 'neofinancial.com'],
  ['eq bank', 'eqbank.ca'],
  ['simplii', 'simplii.com'],
  ['pc financial', 'pcfinancial.ca'],
  ['president choice financial', 'pcfinancial.ca'],
  ['presidents choice financial', 'pcfinancial.ca'],
  ["president's choice financial", 'pcfinancial.ca'],
];

export const KNOWN_MERCHANT_NAMES = [
  'Starbucks',
  'Netflix',
  'Amazon',
  'Amazon Prime',
  'Apple',
  'Apple Store',
  'iCloud+',
  'Disney+',
  'Spotify',
  'Uber',
  'Lyft',
  "McDonald's",
  'Walmart',
  'Target',
  'Costco',
  'Whole Foods',
  'Subway',
  'Tim Hortons',
  'IGA',
  'Metro',
  'SAQ',
  'LCBO',
  'Dollarama',
  'IKEA',
  'Home Depot',
  'Lowes',
  'Best Buy',
  'Canadian Tire',
  'Shell',
  'Petro-Canada',
  'Esso',
  "Domino's",
  'Pizza Hut',
  'DoorDash',
  'Uber Eats',
  'Instacart',
  'Airbnb',
  'Booking',
  'Expedia',
  'Air Canada',
  'Google',
  'Microsoft',
  'Adobe',
  'Dropbox',
  'Notion',
  'Slack',
  'Zoom',
  'PayPal',
  'Stripe',
  'Interac',
  'Desjardins',
  'RBC',
  'TD',
  'BMO',
  'Scotiabank',
  'CIBC',
  'Telus',
  'Bell',
  'Rogers',
  'Videotron',
  'Fizz Mobile',
  'Costco Wholesale',
  'Carrefour',
  'Maxi',
  'Super C',
  'Couche-Tard',
  'Pharmaprix',
  'Shoppers Drug Mart',
  'Jean Coutu',
];

/** Quebec / Canada merchants from demo seed transactions (weekly + recurring + occasional). */
export const QUEBEC_DEMO_MERCHANT_NAMES = [
  'IGA',
  'Super C',
  'Maxi',
  'Metro',
  'Provigo',
  'Loblaws',
  'Walmart',
  'Costco',
  'Tim Hortons',
  "McDonald's",
  'Starbucks',
  'Subway',
  'STM — Opus',
  'REM — Billet',
  'Petro-Canada',
  'Couche-Tard',
  'Jean Coutu',
  'St-Hubert',
  'Dollarama',
  'Netflix',
  'Spotify',
  'Vidéotron',
  'Hydro-Québec',
  'Bell Mobilité',
  'Éconofitness',
  'Sport Expert',
  'Winners',
  'Home Depot',
  'Cineplex',
  'Uniprix',
  'Bureau en Gros',
  'Pharmaprix',
  'VIA Rail',
  'Canadian Tire',
  'Stationnement Indigo',
  'RONA',
  'SAQ',
];

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeMerchantKey(name: string): string {
  return stripDiacritics(name.trim().toLowerCase())
    .replace(/['`’]/g, "'")
    .replace(/\s*\+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pick the transaction label that best represents a merchant override key. */
export function resolveCanonicalMerchantOriginalName(
  merchantName: string,
  transactionLabels: Iterable<string>,
): string {
  const trimmed = merchantName.trim();
  const targetKey = normalizeMerchantKey(trimmed);
  if (!targetKey) return trimmed;

  const counts = new Map<string, number>();
  for (const label of transactionLabels) {
    if (normalizeMerchantKey(label) !== targetKey) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  if (counts.size === 0) return trimmed;
  if (counts.has(trimmed)) return trimmed;

  let best = trimmed;
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = label;
    }
  }
  return best;
}

export function buildMerchantOverrideByNormalizedName(
  overrides: MerchantOverride[],
): Map<string, MerchantOverride> {
  const map = new Map<string, MerchantOverride>();
  for (const override of overrides) {
    if (override.hidden) continue;
    const key = normalizeMerchantKey(override.originalName);
    if (key) map.set(key, override);
  }
  return map;
}

export function getMerchantOverrideForLabel(
  label: string,
  lookup: ReadonlyMap<string, MerchantOverride>,
): MerchantOverride | undefined {
  return lookup.get(normalizeMerchantKey(label));
}

/** If the label looks like a bare hostname, extract it for favicon lookup */
function domainFromDomainLikeName(raw: string): string | null {
  const t = raw.trim();
  if (!t.includes('.') || /\s/.test(t)) return null;
  let host = t.replace(/^https?:\/\//i, '').split('/')[0]?.split('?')[0] ?? '';
  if (!host) return null;
  if (host.startsWith('www.')) host = host.slice(4);
  host = host.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return host;
}

function resolveMerchantDomain(name: string): string | null {
  const key = normalizeMerchantKey(name);
  if (!key) return null;
  if (GENERIC_TRANSACTION_LABELS.has(key)) return null;
  const mapped = MERCHANT_DOMAIN_MAP[key];
  if (mapped) return mapped;
  for (const [needle, domain] of MERCHANT_KEYWORD_DOMAIN_MAP) {
    if (key.includes(needle)) return domain;
  }
  return domainFromDomainLikeName(name);
}

/** Up to two initials for logo fallback when favicon fetch fails. */
export function merchantInitials(label: string): string {
  const stripped = stripDiacritics(label.trim());
  const words = stripped.split(/[\s—\-–|/]+/).filter((word) => word.length > 0);
  if (words.length >= 2) {
    const first = words[0].replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').charAt(0);
    const second = words[1].replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').charAt(0);
    if (first && second) return `${first}${second}`.toUpperCase();
  }
  const compact = stripped.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '');
  return (compact.slice(0, 2) || '?').toUpperCase();
}

export type TransactionMerchantLogoResolution = {
  logoUrl: string | null;
  merchantLabel: string | null;
  manualIcon: string | null;
};

/** Resolve logo display for a transaction row (auto favicon chain + merchant overrides). */
export function resolveTransactionMerchantLogo(
  label: string,
  override?: {
    logoUrl?: string | null;
    icon?: string | null;
    useAutoLogo?: boolean;
  } | null,
): TransactionMerchantLogoResolution {
  if (override?.useAutoLogo === false) {
    const manualLogo = override.logoUrl?.trim();
    if (manualLogo) {
      return { logoUrl: manualLogo, merchantLabel: null, manualIcon: null };
    }
    return { logoUrl: null, merchantLabel: null, manualIcon: override.icon ?? null };
  }

  const storedLogo = override?.logoUrl?.trim();
  if (storedLogo) {
    return { logoUrl: storedLogo, merchantLabel: label, manualIcon: null };
  }

  return { logoUrl: null, merchantLabel: label, manualIcon: null };
}

function resolveAccountLogoDomain(name: string): string | null {
  const key = normalizeMerchantKey(name);
  if (!key) return null;

  for (const [needle, domain] of ACCOUNT_KEYWORD_DOMAIN_MAP) {
    if (key.includes(needle)) return domain;
  }

  const exact = MERCHANT_DOMAIN_MAP[key];
  if (exact) return exact;
  return domainFromDomainLikeName(name);
}

function faviconUrlsForDomain(domain: string): string[] {
  const enc = encodeURIComponent(domain);
  return [
    `https://www.google.com/s2/favicons?domain=${enc}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

function resolveLocalMerchantAsset(name: string): number | null {
  const key = normalizeMerchantKey(name);
  if (!key) return null;
  const direct = MERCHANT_LOCAL_ASSET_BY_KEY[key];
  if (direct) return direct;
  for (const [needle, asset] of MERCHANT_LOCAL_ASSET_KEYWORDS) {
    if (key.includes(needle)) return asset;
  }
  return null;
}

function resolveLocalAccountAsset(name: string): number | null {
  const key = normalizeMerchantKey(name);
  if (!key) return null;
  for (const [needle, asset] of ACCOUNT_LOCAL_ASSET_KEYWORDS) {
    if (key.includes(needle)) return asset;
  }
  return null;
}

/** Resolve a bundled `require()` asset to a URI on native and web. */
function resolveBundledAssetUri(asset: number): string {
  return Asset.fromModule(asset).uri;
}

/** URI for a bundled merchant logo, or null when only remote favicons apply. */
export function getLocalMerchantLogoUri(name: string): string | null {
  const asset = resolveLocalMerchantAsset(name);
  if (!asset) return null;
  return resolveBundledAssetUri(asset);
}

/** Plusieurs URLs à essayer dans l’ordre (premier succès affiché). */
export function getMerchantLogoUrls(name: string): string[] {
  const local = getLocalMerchantLogoUri(name);
  if (local) return [local];
  const domain = resolveMerchantDomain(name);
  if (!domain) return [];
  return faviconUrlsForDomain(domain);
}

/** Première URL candidate, ou null (rétrocompat). */
export function getMerchantLogoUrl(name: string): string | null {
  const urls = getMerchantLogoUrls(name);
  return urls[0] ?? null;
}

export function getAccountLogoUrls(name: string): string[] {
  const localAsset = resolveLocalAccountAsset(name);
  if (localAsset) return [resolveBundledAssetUri(localAsset)];
  const domain = resolveAccountLogoDomain(name);
  if (!domain) return [];
  return faviconUrlsForDomain(domain);
}

export function getAccountLogoUrl(name: string): string | null {
  return getAccountLogoUrls(name)[0] ?? null;
}

export const POPULAR_MERCHANT_LOGO_OPTIONS = [
  'IGA',
  'Metro',
  'Super C',
  'Maxi',
  'Walmart',
  'Costco',
  'Canadian Tire',
  'Tim Hortons',
  'Starbucks',
  "McDonald's",
  'Couche-Tard',
  'Shell',
  'Esso',
  'Petro-Canada',
  'SAQ',
  'Pharmaprix',
  'Shoppers Drug Mart',
  'Jean Coutu',
  'Dollarama',
  'Amazon',
  'Netflix',
  'Spotify',
  'Uber',
  'Uber Eats',
].map((label) => ({
  id: normalizeMerchantKey(label).replace(/\s+/g, '-'),
  label,
  logoUrl: getMerchantLogoUrl(label),
}));

export const RECURRING_SERVICE_LOGO_OPTIONS = [
  'Netflix',
  'Spotify',
  'Amazon Prime',
  'Apple',
  'iCloud+',
  'Disney+',
  'Google',
  'Microsoft',
  'Adobe',
  'Dropbox',
  'Zoom',
  'PayPal',
  'Hydro-Québec',
  'Bell',
  'Vidéotron',
  'Fizz Mobile',
  'Telus',
  'Rogers',
  'Desjardins',
].map((label) => ({
  id: normalizeMerchantKey(label).replace(/\s+/g, '-'),
  label,
  logoUrl: getMerchantLogoUrl(label),
}));

function formatMerchantKeyAsLabel(key: string): string {
  return key
    .split(/\s+/)
    .map((part) =>
      part
        .split('-')
        .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment))
        .join('-'),
    )
    .join(' ');
}

function buildMerchantSuggestionCatalog(): string[] {
  const seen = new Set<string>();
  const catalog: string[] = [];

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = normalizeMerchantKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    catalog.push(trimmed);
  };

  for (const name of QUEBEC_DEMO_MERCHANT_NAMES) add(name);
  for (const name of KNOWN_MERCHANT_NAMES) add(name);
  for (const option of POPULAR_MERCHANT_LOGO_OPTIONS) add(option.label);
  for (const option of RECURRING_SERVICE_LOGO_OPTIONS) add(option.label);
  for (const key of Object.keys(MERCHANT_DOMAIN_MAP)) add(formatMerchantKeyAsLabel(key));

  return catalog.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

const MERCHANT_SUGGESTION_CATALOG = buildMerchantSuggestionCatalog();

/** Filtered merchant name suggestions for autocomplete (Quebec/Canada catalog + optional extras). */
export function searchMerchantNameSuggestions(
  query: string,
  extraNames: Iterable<string> = [],
  limit = 8,
): string[] {
  const normalizedQuery = normalizeMerchantKey(query);
  if (normalizedQuery.length < 1) return [];

  const seen = new Set<string>();
  const startsWith: string[] = [];
  const contains: string[] = [];

  const consider = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = normalizeMerchantKey(trimmed);
    if (!key || key === normalizedQuery || seen.has(key)) return;
    seen.add(key);
    if (key.startsWith(normalizedQuery)) startsWith.push(trimmed);
    else if (key.includes(normalizedQuery)) contains.push(trimmed);
  };

  for (const name of extraNames) consider(name);
  for (const name of MERCHANT_SUGGESTION_CATALOG) consider(name);

  return [...startsWith, ...contains].slice(0, limit);
}
