import type { Ionicons } from '@expo/vector-icons';
import { DASHBOARD_VALUE_GREEN, DASHBOARD_VALUE_RED } from '@/constants/theme';
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

function institutionLabel(account: AccountBalanceDisplayAccount): string | null {
  const institution = account.institution?.trim();
  if (!institution) return null;
  if (subtitlePartRedundantWithName(institution, account.name)) return null;
  return institution.toUpperCase();
}

/** Discreet account-type line on balance rows (Portefeuille / dashboard). */
const ACCOUNT_KIND_TYPE_LABELS: Record<AccountKind, string> = {
  checking: 'Chèque',
  savings: 'Épargne',
  credit: 'Carte de crédit',
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

function last4RedundantWithName(name: string, last4: string): boolean {
  const trimmedLast4 = last4.trim();
  if (!trimmedLast4) return true;

  const normalizedName = normalizeAccountLabel(name);
  const normalizedLast4 = normalizeAccountLabel(trimmedLast4);
  if (normalizedName.endsWith(normalizedLast4)) return true;

  const suffixPatterns = [
    `· ${trimmedLast4}`,
    `·${trimmedLast4}`,
    `• ${trimmedLast4}`,
    `•${trimmedLast4}`,
    `****${trimmedLast4}`,
    `····${trimmedLast4}`,
  ];
  return suffixPatterns.some((pattern) => name.includes(pattern));
}

function resolveAccountLast4(account: AccountBalanceDisplayAccount): string | undefined {
  const explicit = account.last4?.trim();
  if (explicit) return explicit;

  const name = account.name.trim();
  const fromSeparator = name.match(/(?:[·•]\s*|\*{4}|····)(\d{4})\s*$/);
  if (fromSeparator) return fromSeparator[1];
  return undefined;
}

function institutionLast4Title(account: AccountBalanceDisplayAccount): string {
  const institution = account.institution?.trim();
  const last4 = resolveAccountLast4(account);

  if (institution && last4) return `${institution} · ${last4}`;
  if (institution) return institution;
  if (last4) return `····${last4}`;
  return account.name.trim();
}

function nameStartsWithTypeLabel(name: string, typeLabel: string): boolean {
  const normalizedName = normalizeAccountLabel(name);
  const normalizedType = normalizeAccountLabel(typeLabel);
  if (!normalizedName || !normalizedType) return false;
  if (normalizedName === normalizedType) return true;
  const separators = [' · ', '·', ' • ', '•', ' - ', '-'];
  return separators.some((sep) => normalizedName.startsWith(`${normalizedType}${normalizeAccountLabel(sep)}`));
}

/** Row title — strips redundant kind prefix (e.g. "Épargne · 7832" → institution · last4). */
export function accountBalanceRowTitle(account: AccountBalanceDisplayAccount): string {
  const name = account.name.trim();
  const typeLabel = accountKindTypeLabel(account.kind);

  if (!name) return institutionLast4Title(account);

  if (subtitlePartRedundantWithName(typeLabel, name) || nameStartsWithTypeLabel(name, typeLabel)) {
    const institutionTitle = institutionLast4Title(account);
    if (institutionTitle && institutionTitle !== name) return institutionTitle;
  }

  return accountBalanceDisplayName(account);
}

/** Single-line card title — name with last4 when available and not already in the name. */
export function accountBalanceDisplayName(account: AccountBalanceDisplayAccount): string {
  const name = account.name.trim();
  if (!name) return '';

  const last4 = resolveAccountLast4(account);
  if (!last4 || last4RedundantWithName(name, last4)) return name;
  return `${name} · ${last4}`;
}

/** Subtitle under the balance — institution / last4 only (kind lives in trailing badge). */
export function accountBalanceSubtitle(account: AccountBalanceDisplayAccount): string | undefined {
  const institution = institutionLabel(account);
  if (institution) return institution;

  if (account.last4) {
    const rawInstitution = account.institution?.trim();
    if (rawInstitution && !subtitlePartRedundantWithName(rawInstitution, account.name)) {
      return `${rawInstitution.toUpperCase()} · ${account.last4}`;
    }
    return `····${account.last4}`;
  }

  const rawInstitution = account.institution?.trim();
  if (rawInstitution && !subtitlePartRedundantWithName(rawInstitution, account.name)) {
    return rawInstitution.toUpperCase();
  }

  return undefined;
}

export function accountBalanceIconForKind(
  kind: SimulatedAccount['kind'],
): keyof typeof Ionicons.glyphMap {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'cash-outline';
  if (kind === 'cash') return 'wallet-outline';
  return 'wallet-outline';
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
