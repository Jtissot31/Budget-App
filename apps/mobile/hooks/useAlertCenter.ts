import { useCallback, useEffect, useMemo, useState } from 'react';
import { PAYCHECK_TRANSACTION_LOOKBACK_LIMIT } from '@/lib/estimatedPaycheck';
import { dataEvents } from '@/lib/events';
import {
  composeAlertCenterItems,
  countUnreadAlerts,
  markAlertCenterItemRead,
  type AlertCenterItem,
} from '@/lib/alerts';
import { buildPaymentAlertSources } from '@/lib/buildPaymentAlerts';
import { getRecentIncomeTransactions, getRecurringPayments, getSimulatedAccounts } from '@/lib/db';
import type { RecurringPayment, SimulatedAccount, Transaction } from '@/types';

type Options = {
  recurringPayments: RecurringPayment[];
  simulatedAccounts: SimulatedAccount[];
  incomeTransactions: Transaction[];
  enabled?: boolean;
};

export function useAlertCenter({
  recurringPayments,
  simulatedAccounts,
  incomeTransactions,
  enabled = true,
}: Options) {
  const [items, setItems] = useState<AlertCenterItem[]>([]);
  const [loading, setLoading] = useState(false);

  const paymentSources = useMemo(
    () =>
      enabled
        ? buildPaymentAlertSources({
            recurringPayments,
            simulatedAccounts,
            incomeTransactions,
          })
        : [],
    [enabled, recurringPayments, simulatedAccounts, incomeTransactions],
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const next = await composeAlertCenterItems(paymentSources);
      setItems(next);
    } finally {
      setLoading(false);
    }
  }, [enabled, paymentSources]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => dataEvents.subscribe(() => void refresh()), [refresh]);

  const unreadCount = useMemo(() => countUnreadAlerts(items), [items]);

  const markRead = useCallback(async (item: AlertCenterItem) => {
    if (item.read) return;
    await markAlertCenterItemRead(item);
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = items.filter((item) => !item.read);
    await Promise.all(unread.map((item) => markAlertCenterItemRead(item)));
    setItems((current) => current.map((entry) => ({ ...entry, read: true })));
  }, [items]);

  return {
    items,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
  };
}

/** Loads alert-center inputs for standalone screens (e.g. `/alert-center`). */
export function useAlertCenterSources() {
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [recurring, accounts, income] = await Promise.all([
      getRecurringPayments(),
      getSimulatedAccounts(),
      getRecentIncomeTransactions(PAYCHECK_TRANSACTION_LOOKBACK_LIMIT),
    ]);
    setRecurringPayments(recurring);
    setSimulatedAccounts(accounts);
    setIncomeTransactions(income);
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  return {
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    ready,
    refresh: load,
  };
}
