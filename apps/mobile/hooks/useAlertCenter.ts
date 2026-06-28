import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type AlertCenterInputs = {
  enabled: boolean;
  recurringPayments: RecurringPayment[];
  simulatedAccounts: SimulatedAccount[];
  incomeTransactions: Transaction[];
};

export function useAlertCenter({
  recurringPayments,
  simulatedAccounts,
  incomeTransactions,
  enabled = true,
}: Options) {
  const [items, setItems] = useState<AlertCenterItem[]>([]);
  const [loading, setLoading] = useState(false);

  const inputsRef = useRef<AlertCenterInputs>({
    enabled,
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
  });
  inputsRef.current = {
    enabled,
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
  };

  const refreshGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    const {
      enabled: isEnabled,
      recurringPayments: payments,
      simulatedAccounts: accounts,
      incomeTransactions: income,
    } = inputsRef.current;

    if (!isEnabled) {
      setItems((current) => (current.length === 0 ? current : []));
      return;
    }

    setLoading(true);
    try {
      const paymentSources = buildPaymentAlertSources({
        recurringPayments: payments,
        simulatedAccounts: accounts,
        incomeTransactions: income,
      });
      const next = await composeAlertCenterItems(paymentSources);
      if (generation !== refreshGenerationRef.current) return;
      setItems(next);
    } finally {
      if (generation === refreshGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refreshRef.current();
  }, [enabled, recurringPayments, simulatedAccounts, incomeTransactions]);

  useEffect(() => dataEvents.subscribe(() => void refreshRef.current()), []);

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

  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;

    const [recurring, accounts, income] = await Promise.all([
      getRecurringPayments(),
      getSimulatedAccounts(),
      getRecentIncomeTransactions(PAYCHECK_TRANSACTION_LOOKBACK_LIMIT),
    ]);

    if (generation !== loadGenerationRef.current) return;

    setRecurringPayments(recurring);
    setSimulatedAccounts(accounts);
    setIncomeTransactions(income);
    setReady(true);
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void loadRef.current();
  }, []);

  useEffect(() => dataEvents.subscribe(() => void loadRef.current()), []);

  return {
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    ready,
    refresh: load,
  };
}
