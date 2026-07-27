/**
 * Bank / institution logo bank — parallel to merchant recognition in `merchantLogo.ts`.
 *
 * Resolution order for an account name / institution field:
 * 1. Bundled local asset (`localAsset`) when wired
 * 2. Google s2 favicon → DuckDuckGo icon for `domain`
 * 3. null (caller falls back to initials / stored logoUrl)
 *
 * Match rules (same quality as merchants):
 * - Normalize: trim, lower-case, strip diacritics (Banque Nationale ≈ banque nationale)
 * - Aliases sorted longest-first so « banque nationale » wins over shorter needles
 * - Short codes (≤3 chars: td, rbc, bmo…) use word boundaries (avoid matching inside words)
 * - Banks / fintechs win over card networks (« Visa Desjardins » → Desjardins, not Visa)
 *
 * How to add a new bank:
 * 1. Append an entry to `BANK_INSTITUTIONS` with `id`, `displayName`, `aliases`, `domain`, `kind`
 * 2. Include FR/EN aliases users type in COMPTES (e.g. « Banque Nationale », « National Bank »)
 * 3. Optional: drop `assets/banks/<id>.png` and `require('@/assets/banks/<id>.png')` as `localAsset`
 * 4. Optional: add brand color in `institutionBrandColor.ts` keyed by the same `id`
 */

import { Asset } from 'expo-asset';

/**
 * Local PNGs live in `assets/banks/` (create the file, then require it here).
 * Card-network marks that already ship under merchants/ may be reused until a banks/ copy exists.
 *
 * Example once the PNG is present:
 *   const DESJARDINS_LOGO = require('@/assets/banks/desjardins.png');
 */
const VISA_LOGO = require('@/assets/merchants/visa.png') as number;

export type BankInstitutionKind = 'bank' | 'fintech' | 'card_network';

export type BankInstitution = {
  /** Stable catalog id (also suggested filename under assets/banks/). */
  id: string;
  displayName: string;
  /** Match needles — stored without relying on accents; matching strips diacritics anyway. */
  aliases: readonly string[];
  /** Registrable domain for favicon CDN chain. */
  domain: string;
  kind: BankInstitutionKind;
  /** Bundled `require()` module id when a local PNG exists. */
  localAsset?: number;
};

/**
 * Canonical CA / QC / FR institution catalog.
 * Prefer adding aliases here rather than scattering keyword maps elsewhere.
 */
export const BANK_INSTITUTIONS: readonly BankInstitution[] = [
  // —— Canada / Québec (big 6 + credit unions) ——
  {
    id: 'desjardins',
    displayName: 'Desjardins',
    aliases: ['desjardins', 'caisse populaire', 'caisse desjardins', 'mouvement desjardins'],
    domain: 'desjardins.com',
    kind: 'bank',
  },
  {
    id: 'rbc',
    displayName: 'RBC',
    aliases: [
      'rbc royal bank',
      'royal bank of canada',
      'banque royale du canada',
      'banque royale',
      'royal bank',
      'rbc',
    ],
    domain: 'rbcroyalbank.com',
    kind: 'bank',
  },
  {
    id: 'td',
    displayName: 'TD',
    aliases: [
      'td canada trust',
      'toronto dominion',
      'toronto-dominion',
      'banque td',
      'td bank',
      'td',
    ],
    domain: 'td.com',
    kind: 'bank',
  },
  {
    id: 'bmo',
    displayName: 'BMO',
    aliases: ['banque de montreal', 'bank of montreal', 'bmo'],
    domain: 'bmo.com',
    kind: 'bank',
  },
  {
    id: 'scotiabank',
    displayName: 'Scotiabank',
    aliases: [
      'banque de nouvelle-ecosse',
      'banque scotia',
      'scotiabank',
      'scotia',
    ],
    domain: 'scotiabank.com',
    kind: 'bank',
  },
  {
    id: 'cibc',
    displayName: 'CIBC',
    aliases: ['canadian imperial bank', 'banque cibc', 'cibc'],
    domain: 'cibc.com',
    kind: 'bank',
  },
  {
    id: 'banque-nationale',
    displayName: 'Banque Nationale',
    aliases: [
      'national bank of canada',
      'banque nationale du canada',
      'banque nationale',
      'national bank',
      'bnc',
      'nbc',
    ],
    domain: 'bnc.ca',
    kind: 'bank',
  },
  {
    id: 'banque-laurentienne',
    displayName: 'Banque Laurentienne',
    aliases: ['laurentian bank', 'banque laurentienne', 'laurentienne'],
    domain: 'blc.ca',
    kind: 'bank',
  },
  {
    id: 'tangerine',
    displayName: 'Tangerine',
    aliases: ['tangerine'],
    domain: 'tangerine.ca',
    kind: 'bank',
  },
  {
    id: 'simplii',
    displayName: 'Simplii',
    aliases: ['simplii', 'simplii financial'],
    domain: 'simplii.com',
    kind: 'bank',
  },
  {
    id: 'eq-bank',
    displayName: 'EQ Bank',
    aliases: ['eq bank', 'eqbank'],
    domain: 'eqbank.ca',
    kind: 'bank',
  },
  {
    id: 'pc-financial',
    displayName: 'PC Financial',
    aliases: [
      'pc financial',
      'president choice financial',
      'presidents choice financial',
      "president's choice financial",
      'presidents choice',
      "president's choice",
      'pcf',
    ],
    domain: 'pcfinancial.ca',
    kind: 'bank',
  },
  {
    id: 'manulife-bank',
    displayName: 'Manulife Bank',
    aliases: ['manulife bank', 'banque manuvie', 'manuvie'],
    domain: 'manulifebank.ca',
    kind: 'bank',
  },
  {
    id: 'atb',
    displayName: 'ATB Financial',
    aliases: ['atb financial', 'atb'],
    domain: 'atb.com',
    kind: 'bank',
  },
  {
    id: 'vancity',
    displayName: 'Vancity',
    aliases: ['vancity'],
    domain: 'vancity.com',
    kind: 'bank',
  },
  {
    id: 'hsbc-ca',
    displayName: 'HSBC',
    aliases: ['hsbc canada', 'hsbc'],
    domain: 'hsbc.ca',
    kind: 'bank',
  },

  // —— Fintech / neo-banks (CA) ——
  {
    id: 'wealthsimple',
    displayName: 'Wealthsimple',
    aliases: ['wealthsimple', 'wealth simple'],
    domain: 'wealthsimple.com',
    kind: 'fintech',
  },
  {
    id: 'koho',
    displayName: 'Koho',
    aliases: ['koho'],
    domain: 'koho.ca',
    kind: 'fintech',
  },
  {
    id: 'neo',
    displayName: 'Neo Financial',
    aliases: ['neo financial', 'neofinancial', 'neo'],
    domain: 'neofinancial.com',
    kind: 'fintech',
  },

  // —— France (common FR aliases) ——
  {
    id: 'bnp-paribas',
    displayName: 'BNP Paribas',
    aliases: ['bnp paribas', 'bnp'],
    domain: 'bnpparibas.com',
    kind: 'bank',
  },
  {
    id: 'societe-generale',
    displayName: 'Société Générale',
    aliases: ['societe generale', 'socgen'],
    domain: 'societegenerale.com',
    kind: 'bank',
  },
  {
    id: 'credit-agricole',
    displayName: 'Crédit Agricole',
    // Avoid bare « ca » — too ambiguous in CA/QC account labels.
    aliases: ['credit agricole'],
    domain: 'credit-agricole.com',
    kind: 'bank',
  },
  {
    id: 'banque-populaire',
    displayName: 'Banque Populaire',
    aliases: ['banque populaire'],
    domain: 'banquepopulaire.fr',
    kind: 'bank',
  },
  {
    id: 'credit-mutuel',
    displayName: 'Crédit Mutuel',
    aliases: ['credit mutuel'],
    domain: 'creditmutuel.fr',
    kind: 'bank',
  },
  {
    id: 'la-banque-postale',
    displayName: 'La Banque Postale',
    aliases: ['la banque postale', 'banque postale'],
    domain: 'labanquepostale.fr',
    kind: 'bank',
  },
  {
    id: 'boursorama',
    displayName: 'Boursorama',
    aliases: ['boursorama', 'bourso'],
    domain: 'boursorama.com',
    kind: 'bank',
  },
  {
    id: 'revolut',
    displayName: 'Revolut',
    aliases: ['revolut'],
    domain: 'revolut.com',
    kind: 'fintech',
  },
  {
    id: 'n26',
    displayName: 'N26',
    aliases: ['n26'],
    domain: 'n26.com',
    kind: 'fintech',
  },

  // —— Card networks (matched only when no bank/fintech hit) ——
  {
    id: 'visa',
    displayName: 'Visa',
    aliases: ['visa'],
    domain: 'visa.com',
    kind: 'card_network',
    localAsset: VISA_LOGO,
  },
  {
    id: 'mastercard',
    displayName: 'Mastercard',
    aliases: ['mastercard', 'master card'],
    domain: 'mastercard.com',
    kind: 'card_network',
  },
  {
    id: 'amex',
    displayName: 'Amex',
    aliases: ['american express', 'amex'],
    domain: 'americanexpress.com',
    kind: 'card_network',
  },
  {
    id: 'interac',
    displayName: 'Interac',
    aliases: ['interac'],
    domain: 'interac.ca',
    kind: 'card_network',
  },
] as const;

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Same normalization as merchant keys (accents, quotes, whitespace). */
export function normalizeInstitutionKey(name: string): string {
  return stripDiacritics(name.trim().toLowerCase())
    .replace(/['`’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

type AliasIndexEntry = {
  needle: string;
  institution: BankInstitution;
};

function buildAliasIndex(entries: readonly BankInstitution[]): AliasIndexEntry[] {
  const index: AliasIndexEntry[] = [];
  for (const institution of entries) {
    for (const alias of institution.aliases) {
      const needle = normalizeInstitutionKey(alias);
      if (needle) index.push({ needle, institution });
    }
  }
  // Longest needle first; ties keep catalog order.
  return index.sort((a, b) => b.needle.length - a.needle.length);
}

const BANK_ALIAS_INDEX = buildAliasIndex(
  BANK_INSTITUTIONS.filter((entry) => entry.kind !== 'card_network'),
);
const CARD_ALIAS_INDEX = buildAliasIndex(
  BANK_INSTITUTIONS.filter((entry) => entry.kind === 'card_network'),
);

/** Word-boundary match for short codes (td, neo, bmo, ca…); substring for longer needles. */
function institutionKeywordMatches(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.length <= 3) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystack);
  }
  return haystack.includes(needle);
}

function matchAliasIndex(key: string, index: AliasIndexEntry[]): BankInstitution | null {
  for (const { needle, institution } of index) {
    if (institutionKeywordMatches(key, needle)) return institution;
  }
  return null;
}

/** Resolve the best catalog entry for a free-text account / institution label. */
export function matchBankInstitution(name: string): BankInstitution | null {
  const key = normalizeInstitutionKey(name);
  if (!key) return null;

  const fromBank = matchAliasIndex(key, BANK_ALIAS_INDEX);
  if (fromBank) return fromBank;

  return matchAliasIndex(key, CARD_ALIAS_INDEX);
}

function faviconUrlsForDomain(domain: string): string[] {
  const enc = encodeURIComponent(domain);
  return [
    `https://www.google.com/s2/favicons?domain=${enc}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

function resolveBundledAssetUri(asset: number): string {
  return Asset.fromModule(asset).uri;
}

/** URI for a bundled institution logo, or null when only remote favicons apply. */
export function getLocalBankInstitutionLogoUri(name: string): string | null {
  const match = matchBankInstitution(name);
  if (!match?.localAsset) return null;
  // Card-network local assets only when no bank was preferred (matchBankInstitution already orders).
  return resolveBundledAssetUri(match.localAsset);
}

/** Favicon / local URL candidates in display order (first success wins in UI). */
export function getBankInstitutionLogoUrls(name: string): string[] {
  const match = matchBankInstitution(name);
  if (!match) return [];

  if (match.localAsset) {
    return [resolveBundledAssetUri(match.localAsset)];
  }
  return faviconUrlsForDomain(match.domain);
}

export function getBankInstitutionLogoUrl(name: string): string | null {
  return getBankInstitutionLogoUrls(name)[0] ?? null;
}

/** Display labels covered by the institution logo bank (pickers / docs). */
export const KNOWN_BANK_INSTITUTION_LABELS: readonly string[] = BANK_INSTITUTIONS.map(
  (entry) => entry.displayName,
);

/** @deprecated Prefer `KNOWN_BANK_INSTITUTION_LABELS` — kept for existing imports. */
export const KNOWN_INSTITUTION_LOGO_LABELS = KNOWN_BANK_INSTITUTION_LABELS;

/** Catalog size helpers (tests / diagnostics). */
export const BANK_INSTITUTION_CATALOG_SIZE = BANK_INSTITUTIONS.length;
