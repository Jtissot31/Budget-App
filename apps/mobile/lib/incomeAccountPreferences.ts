import { normalizeSearch } from '@/lib/categoryInference';
import { getLastIncomeAccountForContact } from '@/lib/contactHistory';
import { getSetting, setSetting } from '@/lib/db';
import type { Transaction } from '@/types';

const EMPLOYER_INCOME_ACCOUNTS_KEY = 'employer_income_accounts';

export type EmployerIncomeAccountMap = Record<string, string>;

function parseEmployerIncomeAccountMap(raw: string): EmployerIncomeAccountMap {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: EmployerIncomeAccountMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === 'string' && typeof value === 'string' && key.trim() && value.trim()) {
        map[key.trim()] = value.trim();
      }
    }
    return map;
  } catch {
    return {};
  }
}

export async function getEmployerIncomeAccountMap(): Promise<EmployerIncomeAccountMap> {
  const raw = await getSetting(EMPLOYER_INCOME_ACCOUNTS_KEY, '{}');
  return parseEmployerIncomeAccountMap(raw);
}

export async function saveEmployerIncomeAccount(contactName: string, accountId: string): Promise<void> {
  const normalizedName = normalizeSearch(contactName);
  const trimmedAccountId = accountId.trim();
  if (!normalizedName || !trimmedAccountId) return;

  const current = await getEmployerIncomeAccountMap();
  if (current[normalizedName] === trimmedAccountId) return;

  await setSetting(
    EMPLOYER_INCOME_ACCOUNTS_KEY,
    JSON.stringify({ ...current, [normalizedName]: trimmedAccountId }),
  );
}

/** Pick deposit account after selecting an income source contact or employer. */
export function resolveIncomeAccountForSelectedContact(
  transactions: Transaction[],
  savedMap: EmployerIncomeAccountMap,
  contactName: string,
  validAccountIds: readonly string[],
): string | null {
  const normalized = normalizeSearch(contactName);
  if (!normalized) return null;

  const fromMap = savedMap[normalized];
  if (fromMap && validAccountIds.includes(fromMap)) return fromMap;

  const fromContact = getLastIncomeAccountForContact(transactions, contactName);
  if (fromContact && validAccountIds.includes(fromContact)) return fromContact;

  return null;
}
