import { CASH_BANKNOTES_ICON } from '@/components/icons/CashBanknotesOutlineIcon';
import { DASHBOARD_VALUE_GREEN, DASHBOARD_VALUE_RED } from '@/constants/theme';
import { getAccountLogoAsset, getAccountLogoUrls } from '@/lib/merchantLogo';
import type { MdiIconName } from '@/lib/mdiIconCatalog';
import type { AccountKind, SimulatedAccount } from '@/types';

export type AccountBalanceDisplayAccount = Pick<
  SimulatedAccount,
  'id' | 'name' | 'balance' | 'institution' | 'last4' | 'kind' | 'creditLimit' | 'logoUrl' | 'icon'
>;

/** Curated bank / account glyphs for the create-account identity picker. */
export const ACCOUNT_ICON_PICKER_OPTIONS: Array<{
  id: string;
  icon: MdiIconName;
  label: string;
}> = [
  { id: 'bank', icon: 'AccountBalance', label: 'Banque' },
  { id: 'wallet', icon: 'AccountBalanceWallet', label: 'Portefeuille' },
  { id: 'card', icon: 'CreditCard', label: 'Carte' },
  { id: 'savings', icon: 'Savings', label: 'Épargne' },
  { id: 'atm', icon: 'LocalAtm', label: 'Guichet' },
  { id: 'payments', icon: 'Payments', label: 'Paiements' },
  { id: 'money', icon: 'AttachMoney', label: 'Argent' },
  { id: 'business', icon: 'Business', label: 'Institution' },
  { id: 'store', icon: 'Storefront', label: 'Commerce' },
  { id: 'exchange', icon: 'CurrencyExchange', label: 'Change' },
];

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

/** Manual icon when set; otherwise kind fallback (tiles prefer logo when auto). */
export function resolveSimulatedAccountIcon(account: Pick<SimulatedAccount, 'kind' | 'icon'>): string {
  const manual = account.icon?.trim();
  if (manual) return manual;
  return accountBalanceIconForKind(account.kind);
}

/** True when the user locked a glyph instead of auto logo deduction. */
export function hasManualSimulatedAccountIcon(
  account: Pick<SimulatedAccount, 'icon'>,
): boolean {
  return Boolean(account.icon?.trim());
}

/**
 * True for logo URIs that work in both Expo Go and release APKs.
 * Rejects Metro packager URLs and bare Asset registry paths.
 */
export function isReleaseSafeLogoUri(uri: string): boolean {
  const t = uri.trim();
  if (!t) return false;
  if (/:8081\//.test(t) || t.includes('unstable_path') || t.includes('/assets/?')) return false;
  if (/^https:\/\//i.test(t)) return true;
  if (/^(file|content):/i.test(t)) return true;
  return false;
}

export type SimulatedAccountLogoSources = {
  /** Bundled `require()` module — preferred for expo-image in release APKs. */
  asset: number | null;
  /** Remote https favicon chain (gstatic → Google s2 → DDG). */
  urls: string[];
};

/** Resolve institution logo sources for account tiles / picker rows. */
export function resolveSimulatedAccountLogoSources(
  account: SimulatedAccount,
): SimulatedAccountLogoSources {
  if (hasManualSimulatedAccountIcon(account)) {
    return { asset: null, urls: [] };
  }
  if (account.kind === 'cash') {
    return { asset: CASH_BANKNOTES_ICON, urls: [] };
  }

  const primary = account.institution?.trim() || account.name;
  const asset = getAccountLogoAsset(primary) ?? getAccountLogoAsset(account.name);

  const seen = new Set<string>();
  const urls: string[] = [];
  const pushAll = (candidates: string[]) => {
    for (const candidate of candidates) {
      if (!isReleaseSafeLogoUri(candidate) || seen.has(candidate)) continue;
      seen.add(candidate);
      urls.push(candidate);
    }
  };

  // Prefer live name→logo inference so "Visa Desjardins" tracks the bank mark
  // even when an older saved favicon pointed at the card network.
  pushAll(getAccountLogoUrls(primary));
  pushAll(getAccountLogoUrls(account.name));
  const stored = account.logoUrl?.trim();
  if (stored) pushAll([stored]);

  return { asset, urls };
}

/** First remote https favicon (or null). Prefer {@link resolveSimulatedAccountLogoSources}. */
export function resolveSimulatedAccountLogoUrl(account: SimulatedAccount): string | null {
  const { urls } = resolveSimulatedAccountLogoSources(account);
  return urls[0] ?? null;
}

/** Sheet / select-field presentation for a payment account row. */
export function accountPickerRowPresentation(account: SimulatedAccount): {
  label: string;
  description: string;
  fieldLabel: string;
  icon: string;
  logoUrl: string | null;
  logoAsset: number | null;
} {
  const label = accountBalanceDisplayName(account);
  const last4 = account.last4?.trim();
  const subtitle = accountBalanceSubtitle(account);
  const parts: string[] = [];
  if (subtitle) parts.push(subtitle);
  if (last4) parts.push(`••${last4}`);
  if (parts.length === 0) parts.push(accountKindTypeLabel(account.kind));

  const logo = resolveSimulatedAccountLogoSources(account);
  return {
    label,
    description: parts.join(' · '),
    fieldLabel: last4 ? `${label} · ${last4}` : label,
    icon: resolveSimulatedAccountIcon(account),
    logoUrl: logo.urls[0] ?? null,
    logoAsset: logo.asset,
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
