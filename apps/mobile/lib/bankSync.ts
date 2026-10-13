/**
 * Bank sync (Plaid) — client-side service used by the « Connecter ma banque » flow.
 *
 * PREVIEW ONLY: no backend yet. Every call resolves with demo data after a short delay so the
 * UI can be built and tested end to end. To go live, keep these signatures and replace the bodies:
 *
 * - `startBankConnection(institutionId)`
 *     1. POST /api/plaid/link-token            → { linkToken }   (server holds the Plaid secret)
 *     2. open Plaid Link with the token         → { publicToken } (Plaid's own secure UI — the app
 *                                                 never sees bank credentials; needs a dev build)
 *     3. POST /api/plaid/exchange { publicToken } → { connectionId, accounts }
 * - `importBankAccounts(connectionId, accountIds)`
 *     POST /api/plaid/import → then write the accounts / transactions to SQLite.
 */
import type { AccountKind } from '@/types';
import {
  BANK_INSTITUTIONS,
  getBankInstitutionLogoAsset,
  getBankInstitutionLogoUrl,
} from '@/lib/bankInstitutions';

/** False until the Plaid backend exists — the UI shows a « Aperçu » badge meanwhile. */
export const BANK_SYNC_LIVE = false;

export type BankSyncInstitution = {
  id: string;
  name: string;
  logoAsset: number | null;
  logoUrl: string | null;
  popular: boolean;
};

export type BankSyncAccount = {
  id: string;
  name: string;
  mask: string;
  kind: AccountKind;
  balance: number;
};

export type BankConnection = {
  connectionId: string;
  institution: BankSyncInstitution;
  accounts: BankSyncAccount[];
};

/** Most-used Canadian institutions, shown first. */
const POPULAR_IDS = ['desjardins', 'rbc', 'td', 'banque-nationale', 'bmo', 'scotiabank', 'cibc', 'tangerine'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function listBankInstitutions(): BankSyncInstitution[] {
  return BANK_INSTITUTIONS.filter((institution) => institution.kind !== 'card_network')
    .map((institution) => ({
      id: institution.id,
      name: institution.displayName,
      logoAsset: getBankInstitutionLogoAsset(institution.displayName),
      logoUrl: getBankInstitutionLogoUrl(institution.displayName),
      popular: POPULAR_IDS.includes(institution.id),
    }))
    .sort((a, b) => {
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      if (a.popular) return POPULAR_IDS.indexOf(a.id) - POPULAR_IDS.indexOf(b.id);
      return a.name.localeCompare(b.name, 'fr');
    });
}

/** Preview: pretends Plaid Link succeeded and returns demo accounts for the institution. */
export async function startBankConnection(institution: BankSyncInstitution): Promise<BankConnection> {
  await wait(1800);
  const seed = institution.id.length;
  return {
    connectionId: `preview-${institution.id}-${Date.now()}`,
    institution,
    accounts: [
      { id: `${institution.id}-chq`, name: 'Compte chèque', mask: String(4021 + seed * 7).slice(-4), kind: 'checking', balance: 2840.12 },
      { id: `${institution.id}-epa`, name: 'Épargne', mask: String(7310 + seed * 3).slice(-4), kind: 'savings', balance: 12450 },
      { id: `${institution.id}-visa`, name: 'Carte Visa', mask: String(1188 + seed * 11).slice(-4), kind: 'credit', balance: -612.47 },
    ],
  };
}

/** Preview: no data is written. Live version imports accounts + recent transactions. */
export async function importBankAccounts(_connectionId: string, _accountIds: string[]): Promise<void> {
  await wait(900);
}
