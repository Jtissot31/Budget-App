import * as Network from 'expo-network';
import {
  getPendingTransactions,
  markTransactionSynced,
  upsertCategory,
  upsertCategoryBudget,
  insertTransaction,
} from './db';
import {
  fetchBudgetsFromApi,
  fetchCategoriesFromApi,
  fetchTransactionsFromApi,
  postTransactionToApi,
} from './api';
import { getUseMockOnly } from './settings';
import type { Transaction } from '@/types';

export async function isOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function syncWithServer(): Promise<{ ok: boolean; message: string }> {
  if (await getUseMockOnly()) {
    return { ok: true, message: 'Mode démo — pas de synchronisation.' };
  }

  if (!(await isOnline())) {
    return { ok: false, message: 'Hors ligne. Les données locales restent disponibles.' };
  }

  let pushed = 0;
  const pending = await getPendingTransactions();
  for (const tx of pending) {
    const ok = await postTransactionToApi(tx);
    if (ok) {
      await markTransactionSynced(tx.id);
      pushed++;
    }
  }

  const remoteCategories = await fetchCategoriesFromApi();
  if (remoteCategories?.length) {
    for (const c of remoteCategories) {
      await upsertCategory(c);
    }
  }

  const remoteTx = await fetchTransactionsFromApi();
  if (remoteTx?.length) {
    for (const t of remoteTx) {
      await insertTransaction({
        id: t.id,
        label: t.label,
        amount: t.amount,
        type: t.type,
        date: t.date,
        categoryId: t.categoryId,
        transactionIcon: t.transactionIcon,
        receiptUri: t.receiptUri,
        receiptStatus: t.receiptStatus,
        note: t.note,
        syncStatus: 'synced',
      });
    }
  }

  const remoteBudgets = await fetchBudgetsFromApi();
  if (remoteBudgets?.length) {
    for (const b of remoteBudgets) {
      await upsertCategoryBudget(b.categoryId, b.limitAmount, b.weeklyLimitAmount);
    }
  }

  return {
    ok: true,
    message:
      pushed > 0
        ? `Synchronisé (${pushed} transaction(s) envoyée(s)).`
        : 'Synchronisation terminée.',
  };
}

export function createLocalTransaction(input: {
  label: string;
  amount: number;
  type: Transaction['type'];
  date: string;
  categoryId: string;
  transactionIcon?: string | null;
  receiptUri?: string | null;
  receiptStatus?: Transaction['receiptStatus'];
  note?: string;
}): Transaction {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: input.label,
    amount: input.amount,
    type: input.type,
    date: input.date,
    categoryId: input.categoryId,
    transactionIcon: input.transactionIcon,
    receiptUri: input.receiptUri,
    receiptStatus: input.receiptStatus,
    note: input.note,
    syncStatus: 'pending',
  };
}
