import type { SimulatedAccount } from '@/types';
import { matchBankInstitution, normalizeInstitutionKey } from '@/lib/bankInstitutions';

/**
 * Brand colors keyed by `BankInstitution.id` from `bankInstitutions.ts`.
 * Keep ids in sync when adding a bank to the logo catalog.
 */
const INSTITUTION_BRAND_COLOR_BY_ID: Readonly<Record<string, string>> = {
  desjardins: '#00874E',
  rbc: '#0051A5',
  td: '#008A00',
  bmo: '#0079C1',
  scotiabank: '#EC111A',
  cibc: '#C41F3E',
  'banque-nationale': '#E31937',
  'banque-laurentienne': '#003DA5',
  tangerine: '#FF7900',
  wealthsimple: '#FFD044',
  koho: '#7C3AED',
  neo: '#00D395',
  'eq-bank': '#FFD029',
  simplii: '#EA0029',
  'pc-financial': '#EE3124',
  'manulife-bank': '#00A758',
  atb: '#FFB81C',
  vancity: '#E31837',
  'hsbc-ca': '#DB0011',
  'bnp-paribas': '#00915A',
  'societe-generale': '#E60028',
  'credit-agricole': '#00694E',
  'banque-populaire': '#0091DA',
  'credit-mutuel': '#E2001A',
  'la-banque-postale': '#003DA5',
  boursorama: '#EE0527',
  revolut: '#0666EB',
  n26: '#36A18B',
  visa: '#1A1F71',
  mastercard: '#EB001B',
  amex: '#006FCF',
  interac: '#FDB913',
};

const DEFAULT_BRAND_COLOR = '#9CA3AF';

export const MASTERCARD_GLOW_RED = '#EB001B';
export const MASTERCARD_GLOW_ORANGE = '#F79E1B';

/** Institutions whose favicon/mark reads as white-on-dark on BankAccountCard (#101010). */
const INSTITUTION_WHITE_LOGO_IDS: ReadonlySet<string> = new Set([
  'wealthsimple',
  'neo',
  'koho',
]);

const INSTITUTION_GLOW_WHITE = '#FFFFFF';

function resolveBrandColorFromName(name: string): string | null {
  const match = matchBankInstitution(name);
  if (!match) return null;
  return INSTITUTION_BRAND_COLOR_BY_ID[match.id] ?? null;
}

function institutionHasWhiteDominantLogo(name: string): boolean {
  const match = matchBankInstitution(name);
  if (!match) return false;
  return INSTITUTION_WHITE_LOGO_IDS.has(match.id);
}

/** Primary brand color for an account's institution (logo area glow on BankAccountCard). */
export function getInstitutionBrandColor(
  account: Pick<SimulatedAccount, 'institution' | 'name'>,
): string {
  const institution = account.institution?.trim();
  if (institution) {
    const fromInstitution = resolveBrandColorFromName(institution);
    if (fromInstitution) return fromInstitution;
  }

  return resolveBrandColorFromName(account.name) ?? DEFAULT_BRAND_COLOR;
}

function accountHaystack(account: Pick<SimulatedAccount, 'institution' | 'name'>): string {
  return normalizeInstitutionKey(`${account.institution ?? ''} ${account.name}`);
}

/** True when the account is a Mastercard-branded card (dual red/orange inner glow). */
export function isMastercardAccount(
  account: Pick<SimulatedAccount, 'institution' | 'name'>,
): boolean {
  const haystack = accountHaystack(account);
  if (!haystack) return false;

  return (
    /\bmaster\s*card\b/.test(haystack) ||
    /\bmastercard\b/.test(haystack) ||
    /\bvisa\s*mc\b/.test(haystack) ||
    /\bmc\b/.test(haystack)
  );
}

/** Inner-glow tint: white when the institution logo is predominantly white, else brand color. */
export function getInstitutionGlowColor(
  account: Pick<SimulatedAccount, 'institution' | 'name'>,
): string {
  const institution = account.institution?.trim();
  if (institution && institutionHasWhiteDominantLogo(institution)) {
    return INSTITUTION_GLOW_WHITE;
  }

  if (institutionHasWhiteDominantLogo(account.name)) {
    return INSTITUTION_GLOW_WHITE;
  }

  return getInstitutionBrandColor(account);
}
