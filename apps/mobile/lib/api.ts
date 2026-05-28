import { getApiBaseUrl } from './settings';
import type { Category, CategoryBudget, DashboardSummary, Transaction } from '@/types';

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = await getApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDashboardFromApi(): Promise<DashboardSummary | null> {
  return request<DashboardSummary>('/api/dashboard');
}

export async function fetchTransactionsFromApi(search?: string): Promise<Transaction[] | null> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search)}` : '';
  return request<Transaction[]>(`/api/transactions${q}`);
}

export async function fetchBudgetsFromApi(): Promise<CategoryBudget[] | null> {
  return request<CategoryBudget[]>('/api/budgets');
}

export async function fetchCategoriesFromApi(): Promise<Category[] | null> {
  return request<Category[]>('/api/categories');
}

export async function postTransactionToApi(tx: Transaction): Promise<boolean> {
  const result = await request<unknown>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: tx.id,
      label: tx.label,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      categoryId: tx.categoryId,
      transactionIcon: tx.transactionIcon,
      receiptUri: tx.receiptUri,
      receiptStatus: tx.receiptStatus,
      note: tx.note,
    }),
  });
  return result !== null;
}
