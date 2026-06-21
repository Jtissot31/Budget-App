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
