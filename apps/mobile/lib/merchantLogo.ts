/**
 * Logos marchands via favicons publics (domaine déduit du nom).
 * Clearbit (logo.clearbit.com) est déprécié / souvent bloqué — on utilise une chaîne
 * Google s2 favicons → icône DDG en secours.
 */

/** Normalized merchant display name → registrable domain */
const MERCHANT_DOMAIN_MAP: Record<string, string> = {
  starbucks: 'starbucks.com',
  netflix: 'netflix.com',
  amazon: 'amazon.com',
  'amazon prime': 'amazon.com',
  apple: 'apple.com',
  'apple store': 'apple.com',
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
  'hydro-quebec': 'hydroquebec.com',
  'hydro quebec': 'hydroquebec.com',
  hydroquebec: 'hydroquebec.com',
  'costco wholesale': 'costco.com',
  carrefour: 'carrefour.com',
};

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
  'Costco Wholesale',
  'Carrefour',
  'Maxi',
  'Super C',
  'Couche-Tard',
  'Pharmaprix',
  'Shoppers Drug Mart',
  'Jean Coutu',
];

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeMerchantKey(name: string): string {
  return stripDiacritics(name.trim().toLowerCase())
    .replace(/['`’]/g, "'")
    .replace(/\s+/g, ' ');
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
  return domainFromDomainLikeName(name);
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

/** Plusieurs URLs à essayer dans l’ordre (premier succès affiché). */
export function getMerchantLogoUrls(name: string): string[] {
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
  'Google',
  'Microsoft',
  'Adobe',
  'Dropbox',
  'Zoom',
  'PayPal',
  'Hydro-Québec',
  'Bell',
  'Vidéotron',
  'Telus',
  'Rogers',
  'Desjardins',
].map((label) => ({
  id: normalizeMerchantKey(label).replace(/\s+/g, '-'),
  label,
  logoUrl: getMerchantLogoUrl(label),
}));
