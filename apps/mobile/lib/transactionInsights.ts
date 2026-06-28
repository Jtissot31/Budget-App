import { UNCATEGORIZED_TRANSACTION_CATEGORY } from '@/constants/categoryOptions';
import { parseItemizedNote } from '@/lib/itemizedNote';
import { startOfMonth } from '@/lib/budgetMonth';
import type { Transaction } from '@/types';

export type TransactionValidationIssue = 'category' | 'articles' | 'article_category';

export type ExpenseCategorySlice = {
  id: string;
  name: string;
  spent: number;
};

function monthKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function transactionMonthKey(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 7);
  return monthKeyFromDate(date);
}

export function isExpenseMissingCategory(tx: Transaction): boolean {
  return (
    tx.categoryId === UNCATEGORIZED_TRANSACTION_CATEGORY.id ||
    !tx.categoryName?.trim()
  );
}

export function expenseExpectsArticles(tx: Transaction): boolean {
  return Boolean(tx.receiptUri || tx.receiptStatus);
}

export function getTransactionValidationIssues(tx: Transaction): TransactionValidationIssue[] {
  if (tx.type !== 'expense') return [];

  const issues: TransactionValidationIssue[] = [];
  if (isExpenseMissingCategory(tx)) {
    issues.push('category');
  }

  const articles = parseItemizedNote(tx.note);
  if (expenseExpectsArticles(tx) && articles.length === 0) {
    issues.push('articles');
  }
  if (articles.length > 0 && articles.some((article) => !article.categoryId)) {
    issues.push('article_category');
  }

  return issues;
}

export function transactionNeedsValidation(tx: Transaction): boolean {
  return getTransactionValidationIssues(tx).length > 0;
}

export function transactionNeedsArticleReview(tx: Transaction): boolean {
  return getTransactionValidationIssues(tx).includes('articles');
}

export function listTransactionsNeedingArticleReview(
  transactions: readonly Transaction[],
  month?: Date,
): Transaction[] {
  const pool = month
    ? filterExpensesForMonth(transactions, month)
    : transactions.filter((tx) => tx.type === 'expense');
  return pool.filter(transactionNeedsArticleReview);
}

export function validationIssueLabel(issue: TransactionValidationIssue): string {
  switch (issue) {
    case 'category':
      return 'Catégorie manquante';
    case 'articles':
      return 'Articles manquants';
    case 'article_category':
      return 'Catégorie d’article manquante';
  }
}

export function filterExpensesForMonth(transactions: readonly Transaction[], month: Date): Transaction[] {
  const key = monthKeyFromDate(startOfMonth(month));
  return transactions.filter(
    (tx) => tx.type === 'expense' && transactionMonthKey(tx.date) === key,
  );
}

export function aggregateExpenseCategories(
  transactions: readonly Transaction[],
  month: Date,
): { categories: ExpenseCategorySlice[]; totalSpent: number } {
  const expenses = filterExpensesForMonth(transactions, month);
  const byCategory = new Map<string, ExpenseCategorySlice>();
  let totalSpent = 0;

  for (const tx of expenses) {
    totalSpent += tx.amount;
    const id = tx.categoryId;
    const name = tx.categoryName?.trim() || 'Sans catégorie';
    const existing = byCategory.get(id);
    if (existing) {
      existing.spent += tx.amount;
    } else {
      byCategory.set(id, { id, name, spent: tx.amount });
    }
  }

  return {
    categories: [...byCategory.values()].filter((slice) => slice.spent > 0),
    totalSpent,
  };
}

export function listTransactionsNeedingValidation(
  transactions: readonly Transaction[],
  month?: Date,
): Transaction[] {
  const pool = month ? filterExpensesForMonth(transactions, month) : transactions.filter((tx) => tx.type === 'expense');
  return pool.filter(transactionNeedsValidation);
}
