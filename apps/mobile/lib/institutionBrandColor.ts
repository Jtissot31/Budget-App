/**
 * Gradient of the account card on the account detail page, keyed by `BankInstitution.id`.
 * A deep tint of the bank's colour fading to graphite: the card should read as dark metal with a
 * hint of the brand, never as a saturated block. Accounts from other institutions use their kind.
 */
import { matchBankInstitution } from '@/lib/bankInstitutions';
import type { AccountKind } from '@/types';

export type CardGradient = readonly [string, string];

const GRAPHITE = '#101012';

const INSTITUTION_TINTS: Record<string, string> = {
  desjardins: '#0C3B2A',
  rbc: '#0D2C52',
  td: '#10391C',
  bmo: '#0B3350',
  scotiabank: '#471219',
  cibc: '#3F1423',
  'banque-nationale': '#44151A',
  tangerine: '#4A2A0C',
  'eq-bank': '#2E1A40',
  wealthsimple: '#29292C',
  koho: '#261E52',
  revolut: '#1A2358',
  visa: '#171C50',
  mastercard: '#29292C',
};

const KIND_TINTS: Record<AccountKind, string> = {
  checking: '#1C2150',
  savings: '#0D3633',
  credit: '#29292C',
  cash: '#12351F',
};

export function accountCardGradient(account: {
  name: string;
  institution?: string | null;
  kind: AccountKind;
}): CardGradient {
  const match = matchBankInstitution(`${account.institution ?? ''} ${account.name}`.trim());
  return [(match && INSTITUTION_TINTS[match.id]) || KIND_TINTS[account.kind], GRAPHITE];
}
