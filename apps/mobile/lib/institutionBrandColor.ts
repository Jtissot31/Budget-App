import type { SimulatedAccount } from '@/types';

/** Keyword → primary brand color (matches institution logo resolution in merchantLogo.ts). */
const INSTITUTION_BRAND_COLORS: ReadonlyArray<readonly [string, string]> = [
  ['desjardins', '#00874E'],
  ['rbc', '#0051A5'],
  ['royal bank', '#0051A5'],
  ['td', '#008A00'],
  ['bmo', '#0079C1'],
  ['scotiabank', '#EC111A'],
  ['scotia', '#EC111A'],
  ['cibc', '#C41F3E'],
  ['national bank', '#E31937'],
  ['banque nationale', '#E31937'],
  ['laurentienne', '#003DA5'],
  ['tangerine', '#FF7900'],
  ['wealthsimple', '#FFD044'],
  ['koho', '#7C3AED'],
  ['neo financial', '#00D395'],
  ['eq bank', '#FFD029'],
  ['simplii', '#EA0029'],
  ['pc financial', '#EE3124'],
  ['president choice', '#EE3124'],
  ['presidents choice', '#EE3124'],
  ['visa', '#1A1F71'],
  ['mastercard', '#EB001B'],
  ['amex', '#006FCF'],
  ['american express', '#006FCF'],
  ['interac', '#FDB913'],
];

const DEFAULT_BRAND_COLOR = '#9CA3AF';

export const MASTERCARD_GLOW_RED = '#EB001B';
export const MASTERCARD_GLOW_ORANGE = '#F79E1B';

/** Institutions whose favicon/mark reads as white-on-dark on BankAccountCard (#101010). */
const INSTITUTION_WHITE_LOGO_KEYWORDS: readonly string[] = [
  'wealthsimple',
  'neo financial',
  'neofinancial',
  'koho',
];

const INSTITUTION_GLOW_WHITE = '#FFFFFF';

function normalizeKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveBrandColorFromName(name: string): string | null {
  const key = normalizeKey(name);
  if (!key) return null;

  for (const [needle, color] of INSTITUTION_BRAND_COLORS) {
    if (key.includes(needle)) return color;
  }

  return null;
}

function institutionHasWhiteDominantLogo(name: string): boolean {
  const key = normalizeKey(name);
  if (!key) return false;

  return INSTITUTION_WHITE_LOGO_KEYWORDS.some((needle) => key.includes(needle));
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
  return `${account.institution ?? ''} ${account.name}`.trim().toLowerCase();
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
