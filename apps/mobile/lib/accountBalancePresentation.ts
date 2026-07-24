import { cashBanknotesLogoUri } from '@/components/icons/CashBanknotesOutlineIcon';
import { DASHBOARD_VALUE_GREEN, DASHBOARD_VALUE_RED } from '@/constants/theme';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import type { AccountKind, SimulatedAccount } from '@/types';

export type AccountBalanceDisplayAccount = Pick<
  SimulatedAccount,
  'id' | 'name' | 'balance' | 'institution' | 'last4' | 'kind' | 'creditLimit' | 'logoUrl'
>;

function normalizeAccountLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function subtitlePartRedundantWithName(part: string, accountName: string): boolean {
  const normalizedPart = normalizeAccountLabel(part.trim());
  const normalizedName = normalizeAccountLabel(accountName.trim());
  if (!normalizedPart || !normalizedName) return false;
  if (normalizedPart === normalizedName) return true;
  if (normalizedName.startsWith(`${normalizedPart} `)) return true;
  if (normalizedName.startsWith(`${normalizedPart} ·`)) return true;
  if (normalizedName.startsWith(`${normalizedPart}·`)) return true;
  return false;
}

/** Bare hostname / URL used as institution (seed stores logo domains). */
function isWebsiteOrDomainLabel(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.includes('.') || /\s/.test(trimmed)) return false;
  let host = trimmed.replace(/^https?:\/\//i, '').split('/')[0]?.split('?')[0] ?? '';
  if (!host) return false;
  if (host.startsWith('www.')) host = host.slice(4);
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host);
}

function humanizeDomainLabel(value: string): string | null {
  if (!isWebsiteOrDomainLabel(value)) return null;
  let host = value.trim().replace(/^https?:\/\//i, '').split('/')[0]?.split('?')[0] ?? '';
  if (host.startsWith('www.')) host = host.slice(4);
  const base = host.split('.')[0]?.trim();
  if (!base) return null;
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

const CARD_NETWORK_BRANDS = new Set([
  'visa',
  'mastercard',
  'master card',
  'mc',
  'amex',
  'american express',
  'visa mc',
]);

function isCardNetworkBrand(value: string): boolean {
  return CARD_NETWORK_BRANDS.has(normalizeAccountLabel(value.trim()));
}

/** Strip trailing last4 / digit suffixes from account display names. */
function stripTrailingAccountDigits(name: string): string {
  return name
    .replace(/(?:\s*[·•]\s*|\*{4}|····)\d{4}\s*$/u, '')
    .replace(/\s+\d{4}\s*$/u, '')
    .trim();
}

/**
 * Institution suitable for on-tile text — never a website/domain.
 * Network brands (Visa, MC) are not treated as bank issuers.
 */
function resolveDisplayInstitution(
  account: AccountBalanceDisplayAccount,
  options?: { allowNetworkBrand?: boolean },
): string | null {
  const raw = account.institution?.trim();
  if (!raw) return null;

  // Logo domains (desjardins.com, visa.com) are never shown as text.
  if (isWebsiteOrDomainLabel(raw)) return null;

  if (!options?.allowNetworkBrand && isCardNetworkBrand(raw)) return null;
  return raw;
}

/** Discreet account-type line on balance rows (Portefeuille / dashboard). */
const ACCOUNT_KIND_TYPE_LABELS: Record<AccountKind, string> = {
  checking: 'Chèque',
  savings: 'Épargne',
  credit: 'Crédit',
  cash: 'Espèces',
};

export function accountKindTypeLabel(kind: AccountKind): string {
  return ACCOUNT_KIND_TYPE_LABELS[kind];
}

function kindLabel(kind: AccountKind, account: AccountBalanceDisplayAccount) {
  if (kind === 'checking') return 'Chèque';
  if (kind === 'savings') return 'Épargne';
  if (kind === 'cash') return 'Comptant';
  const haystack = `${account.name} ${account.institution ?? ''}`.toLowerCase();
  const hasVisa = /\bvisa\b/.test(haystack);
  const hasMc =
    /\bmaster\s*card\b/.test(haystack) ||
    /\bmastercard\b/.test(haystack) ||
    /\bvisa\s*mc\b/.test(haystack) ||
    /\bmc\b/.test(haystack);
  if (hasVisa && hasMc) return 'Visa MC';
  if (hasVisa) return 'Visa';
  if (hasMc) return 'MC';
  return 'Crédit';
}

/** Card / account kind badge — shown on the right of balance rows. */
export function accountKindDisplayLabel(account: AccountBalanceDisplayAccount): string | undefined {
  const label = kindLabel(account.kind, account);
  if (subtitlePartRedundantWithName(label, account.name)) return undefined;
  return label;
}

function institutionOnlyTitle(account: AccountBalanceDisplayAccount): string {
  const institution = resolveDisplayInstitution(account, { allowNetworkBrand: true });
  if (institution) return institution;

  // Last resort: humanize logo domain when name is empty / type-only.
  const fromDomain = account.institution?.trim()
    ? humanizeDomainLabel(account.institution)
    : null;
  if (fromDomain) return fromDomain;

  return stripTrailingAccountDigits(account.name.trim()) || account.name.trim();
}

function nameStartsWithTypeLabel(name: string, typeLabel: string): boolean {
  const normalizedName = normalizeAccountLabel(name);
  const normalizedType = normalizeAccountLabel(typeLabel);
  if (!normalizedName || !normalizedType) return false;
  if (normalizedName === normalizedType) return true;
  const separators = [' · ', '·', ' • ', '•', ' - ', '-'];
  return separators.some((sep) => normalizedName.startsWith(`${normalizedType}${normalizeAccountLabel(sep)}`));
}

/** Row title — clean name without last4 / digits; never a website. */
export function accountBalanceRowTitle(account: AccountBalanceDisplayAccount): string {
  const name = stripTrailingAccountDigits(account.name.trim());
  const typeLabel = accountKindTypeLabel(account.kind);

  if (!name) return institutionOnlyTitle(account);

  if (subtitlePartRedundantWithName(typeLabel, name) || nameStartsWithTypeLabel(name, typeLabel)) {
    const institutionTitle = institutionOnlyTitle(account);
    if (institutionTitle && normalizeAccountLabel(institutionTitle) !== normalizeAccountLabel(name)) {
      return institutionTitle;
    }
  }

  return accountBalanceDisplayName(account);
}

/** Single-line card title — account name without trailing last4 digits. */
export function accountBalanceDisplayName(account: AccountBalanceDisplayAccount): string {
  const name = stripTrailingAccountDigits(account.name.trim());
  return name || account.name.trim();
}

/**
 * Secondary line under the title.
 * - Never websites/domains (desjardins.com, visa.com)
 * - Never last4 / digits-only
 * - Credit: issuer bank when primary is a network brand (Visa, MC, …)
 * - Bank/cash: non-domain institution only when it adds info vs the title
 */
export function accountBalanceSubtitle(account: AccountBalanceDisplayAccount): string | undefined {
  const primary = accountBalanceRowTitle(account);
  const issuer = resolveDisplayInstitution(account);

  if (account.kind === 'credit') {
    if (!issuer) return undefined;
    if (subtitlePartRedundantWithName(issuer, primary)) return undefined;
    // Show issuer under network-brand titles (Visa → Desjardins).
    if (isCardNetworkBrand(primary) || isCardNetworkBrand(stripTrailingAccountDigits(account.name))) {
      return issuer;
    }
    // Issuer already in / as primary — no secondary.
    return undefined;
  }

  if (!issuer) return undefined;
  if (subtitlePartRedundantWithName(issuer, primary)) return undefined;
  if (normalizeAccountLabel(issuer) === normalizeAccountLabel(primary)) return undefined;
  return issuer;
}

export function accountBalanceIconForKind(
  kind: SimulatedAccount['kind'],
): string {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'cash-outline';
  if (kind === 'cash') return 'cash-banknotes-outline';
  return 'wallet-outline';
}

/** Resolve institution logo for account tiles / picker rows. */
export function resolveSimulatedAccountLogoUrl(account: SimulatedAccount): string | null {
  if (account.kind === 'cash') {
    return account.logoUrl?.trim() || cashBanknotesLogoUri() || null;
  }
  return (
    account.logoUrl?.trim() ||
    getAccountLogoUrl(account.institution?.trim() || account.name) ||
    getAccountLogoUrl(account.name) ||
    null
  );
}

/** Sheet / select-field presentation for a payment account row. */
export function accountPickerRowPresentation(account: SimulatedAccount): {
  label: string;
  description: string;
  fieldLabel: string;
  icon: string;
  logoUrl: string | null;
} {
  const label = accountBalanceDisplayName(account);
  const last4 = account.last4?.trim();
  const subtitle = accountBalanceSubtitle(account);
  const parts: string[] = [];
  if (subtitle) parts.push(subtitle);
  if (last4) parts.push(`••${last4}`);
  if (parts.length === 0) parts.push(accountKindTypeLabel(account.kind));

  return {
    label,
    description: parts.join(' · '),
    fieldLabel: last4 ? `${label} · ${last4}` : label,
    icon: accountBalanceIconForKind(account.kind),
    logoUrl: resolveSimulatedAccountLogoUrl(account),
  };
}
export function accountBalanceValueColor(
  account: AccountBalanceDisplayAccount,
  defaultTextColor: string,
): string {
  if (account.balance < 0 && account.kind !== 'credit') return DASHBOARD_VALUE_RED;
  if (account.kind === 'credit' && account.balance > 0) return DASHBOARD_VALUE_GREEN;
  return defaultTextColor;
}

export function accountBalanceIconTone(
  kind: AccountKind,
  colors: { warning: string; primaryAlt: string; primary: string },
): string {
  if (kind === 'credit') return colors.warning;
  if (kind === 'savings') return colors.primaryAlt;
  return colors.primary;
}
